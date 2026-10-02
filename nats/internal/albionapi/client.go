package albionapi

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"albion-assistant/nats/internal/cell"
)

const maxURLLength = 4096

// Clock is the time source for the rate limiter and observation timestamps.
type Clock interface {
	Now() time.Time
	Sleep(time.Duration)
}

type realClock struct{}

func (realClock) Now() time.Time        { return time.Now() }
func (realClock) Sleep(d time.Duration) { time.Sleep(d) }

// Client reads current prices from the Americas West API.
type Client struct {
	baseURL string
	http    *http.Client
	clock   Clock
	limiter *limiter
}

// New builds a client. A nil clock or HTTP client uses the real ones.
func New(baseURL string, ratePerMinute int, clock Clock, httpClient *http.Client) *Client {
	if clock == nil {
		clock = realClock{}
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	if ratePerMinute <= 0 {
		ratePerMinute = 150
	}
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    httpClient,
		clock:   clock,
		limiter: &limiter{limit: ratePerMinute, clock: clock},
	}
}

// Current fetches sell minima and buy maxima. Zero prices and year-1 dates are omitted.
func (client *Client) Current(ctx context.Context, items []string, cities []string, qualities []int) ([]cell.Update, error) {
	if len(items) == 0 {
		return nil, nil
	}
	batches := splitItems(client.baseURL, items, cities, qualities)
	var updates []cell.Update
	for _, batch := range batches {
		if err := client.limiter.Wait(ctx); err != nil {
			return nil, err
		}
		got, err := client.fetch(ctx, batch, cities, qualities, client.clock.Now())
		if err != nil {
			return nil, err
		}
		updates = append(updates, got...)
	}
	return updates, nil
}

func (client *Client) fetch(ctx context.Context, items []string, cities []string, qualities []int, observedAt time.Time) ([]cell.Update, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL(client.baseURL, items, cities, qualities), nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept-Encoding", "gzip")
	response, err := client.http.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("albion api returned 429")
	}
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("albion api returned %d", response.StatusCode)
	}
	body, err := decodedBody(response)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	var rows []priceRow
	if err := json.NewDecoder(body).Decode(&rows); err != nil {
		return nil, err
	}
	updates := make([]cell.Update, 0, len(rows))
	for _, row := range rows {
		update, ok := rowUpdate(row, observedAt)
		if ok {
			updates = append(updates, update)
		}
	}
	return updates, nil
}

func decodedBody(response *http.Response) (io.ReadCloser, error) {
	if !strings.EqualFold(response.Header.Get("Content-Encoding"), "gzip") {
		return io.NopCloser(response.Body), nil
	}
	return gzip.NewReader(response.Body)
}

type priceRow struct {
	ItemID           string `json:"item_id"`
	City             string `json:"city"`
	Quality          int    `json:"quality"`
	SellPriceMin     int    `json:"sell_price_min"`
	SellPriceMinDate string `json:"sell_price_min_date"`
	BuyPriceMax      int    `json:"buy_price_max"`
	BuyPriceMaxDate  string `json:"buy_price_max_date"`
}

func rowUpdate(row priceRow, observedAt time.Time) (cell.Update, bool) {
	base, enchant := cell.SplitItemID(row.ItemID)
	if base == "" || row.City == "" {
		return cell.Update{}, false
	}
	update := cell.Update{
		Key: cell.Key{
			Item:        base,
			City:        row.City,
			Quality:     row.Quality,
			Enchantment: enchant,
		},
		UpdatedAt: observedAt,
		Source:    cell.SourceAPI,
	}
	if seen(row.SellPriceMin, row.SellPriceMinDate) {
		price := row.SellPriceMin
		update.SellMin = &price
	}
	if seen(row.BuyPriceMax, row.BuyPriceMaxDate) {
		price := row.BuyPriceMax
		update.BuyMax = &price
	}
	if update.SellMin == nil && update.BuyMax == nil {
		return cell.Update{}, false
	}
	return update, true
}

func seen(price int, date string) bool {
	if price <= 0 {
		return false
	}
	return !strings.HasPrefix(date, "0001-01-01")
}

func requestURL(base string, items []string, cities []string, qualities []int) string {
	qualityText := make([]string, len(qualities))
	for i, quality := range qualities {
		qualityText[i] = strconv.Itoa(quality)
	}
	escapedCities := make([]string, len(cities))
	for i, city := range cities {
		escapedCities[i] = url.QueryEscape(city)
	}
	return base + "/api/v2/stats/prices/" + strings.Join(items, ",") + ".json?locations=" + strings.Join(escapedCities, ",") + "&qualities=" + strings.Join(qualityText, ",")
}

func splitItems(base string, items []string, cities []string, qualities []int) [][]string {
	if len(items) == 0 {
		return nil
	}
	if len(items) == 1 || len(requestURL(base, items, cities, qualities)) <= maxURLLength {
		return [][]string{items}
	}
	mid := len(items) / 2
	left := splitItems(base, items[:mid], cities, qualities)
	right := splitItems(base, items[mid:], cities, qualities)
	return append(left, right...)
}

type limiter struct {
	limit  int
	clock  Clock
	stamps []time.Time
}

func (limiter *limiter) Wait(ctx context.Context) error {
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		now := limiter.clock.Now()
		cutoff := now.Add(-time.Minute)
		fresh := make([]time.Time, 0, len(limiter.stamps))
		for _, stamp := range limiter.stamps {
			if stamp.After(cutoff) {
				fresh = append(fresh, stamp)
			}
		}
		limiter.stamps = fresh
		if len(limiter.stamps) < limiter.limit {
			limiter.stamps = append(limiter.stamps, now)
			return nil
		}
		wait := limiter.stamps[0].Add(time.Minute).Sub(now)
		if wait <= 0 {
			wait = time.Millisecond
		}
		limiter.clock.Sleep(wait)
	}
}
