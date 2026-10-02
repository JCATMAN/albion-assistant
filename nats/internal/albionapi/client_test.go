package albionapi

import (
	"bytes"
	"compress/gzip"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"albion-assistant/nats/internal/cell"
)

func TestCurrentBothSides(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Accept-Encoding") != "gzip" {
			t.Errorf("accept-encoding %q", r.Header.Get("Accept-Encoding"))
		}
		_, _ = w.Write([]byte(`[{
			"item_id":"T4_BAG@1",
			"city":"Caerleon",
			"quality":1,
			"sell_price_min":4978,
			"sell_price_min_date":"2026-10-02T00:00:00",
			"buy_price_max":3000,
			"buy_price_max_date":"2026-10-02T00:00:00"
		}]`))
	}))
	defer server.Close()

	client := New(server.URL, 150, &fakeClock{current: time.Unix(100, 0)}, server.Client())
	updates, err := client.Current(context.Background(), []string{"T4_BAG"}, []string{"Caerleon"}, []int{1})
	if err != nil {
		t.Fatal(err)
	}
	if len(updates) != 1 {
		t.Fatalf("%d updates", len(updates))
	}
	got := updates[0]
	if got.Source != cell.SourceAPI || got.SellAmount != nil || got.BuyAmount != nil {
		t.Fatalf("%+v", got)
	}
	if got.SellMin == nil || *got.SellMin != 4978 || got.BuyMax == nil || *got.BuyMax != 3000 {
		t.Fatalf("%+v", got)
	}
	if got.Key.Item != "T4_BAG" || got.Key.Enchantment != 1 {
		t.Fatalf("%+v", got.Key)
	}
}

func TestCurrentOmitsUnseenSide(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`[{
			"item_id":"T4_BAG",
			"city":"Caerleon",
			"quality":1,
			"sell_price_min":0,
			"sell_price_min_date":"0001-01-01T00:00:00",
			"buy_price_max":3000,
			"buy_price_max_date":"2026-10-02T00:00:00"
		}]`))
	}))
	defer server.Close()

	client := New(server.URL, 150, nil, server.Client())
	updates, err := client.Current(context.Background(), []string{"T4_BAG"}, []string{"Caerleon"}, []int{1})
	if err != nil {
		t.Fatal(err)
	}
	if len(updates) != 1 || updates[0].SellMin != nil || updates[0].BuyMax == nil || *updates[0].BuyMax != 3000 {
		t.Fatalf("%+v", updates)
	}
}

func TestCurrentOneRequestForTwoItems(t *testing.T) {
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if !strings.Contains(r.URL.Path, "T4_BAG") || !strings.Contains(r.URL.Path, "T5_BAG") {
			t.Errorf("path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`[]`))
	}))
	defer server.Close()

	client := New(server.URL, 150, nil, server.Client())
	if _, err := client.Current(context.Background(), []string{"T4_BAG", "T5_BAG"}, []string{"Caerleon"}, []int{1}); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("calls %d", calls)
	}
}

func TestCurrentSplitsLongURL(t *testing.T) {
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte(`[]`))
	}))
	defer server.Close()

	first := strings.Repeat("A", 3000)
	second := strings.Repeat("B", 3000)
	client := New(server.URL, 150, nil, server.Client())
	if _, err := client.Current(context.Background(), []string{first, second}, []string{"Caerleon"}, []int{1}); err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatalf("calls %d", calls)
	}
}

func TestCurrentRateLimitWaits(t *testing.T) {
	clock := &fakeClock{current: time.Unix(1_700_000_000, 0)}
	start := clock.Now()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`[]`))
	}))
	defer server.Close()

	client := New(server.URL, 150, clock, server.Client())
	for i := 0; i < 151; i++ {
		if _, err := client.Current(context.Background(), []string{"T4_BAG"}, []string{"Caerleon"}, []int{1}); err != nil {
			t.Fatal(err)
		}
	}
	if clock.Now().Sub(start) < time.Minute {
		t.Fatalf("clock advanced %s", clock.Now().Sub(start))
	}
}

func TestCurrentTooManyRequests(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	client := New(server.URL, 150, nil, server.Client())
	updates, err := client.Current(context.Background(), []string{"T4_BAG"}, []string{"Caerleon"}, []int{1})
	if err == nil || !strings.Contains(err.Error(), "429") {
		t.Fatalf("updates %v err %v", updates, err)
	}
	if len(updates) != 0 {
		t.Fatalf("wrote %d", len(updates))
	}
}

func TestCurrentGzipBody(t *testing.T) {
	var body bytes.Buffer
	writer := gzip.NewWriter(&body)
	_, _ = writer.Write([]byte(`[]`))
	_ = writer.Close()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		_, _ = w.Write(body.Bytes())
	}))
	defer server.Close()

	client := New(server.URL, 150, nil, server.Client())
	updates, err := client.Current(context.Background(), []string{"T4_BAG"}, []string{"Caerleon"}, []int{1})
	if err != nil {
		t.Fatal(err)
	}
	if len(updates) != 0 {
		t.Fatalf("%d", len(updates))
	}
}

type fakeClock struct {
	mu      sync.Mutex
	current time.Time
}

func (clock *fakeClock) Now() time.Time {
	clock.mu.Lock()
	defer clock.mu.Unlock()
	return clock.current
}

func (clock *fakeClock) Sleep(delay time.Duration) {
	clock.mu.Lock()
	clock.current = clock.current.Add(delay)
	clock.mu.Unlock()
}
