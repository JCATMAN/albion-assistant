package order

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// Side is the book side of one market order.
type Side string

const (
	SideSell Side = "sell"
	SideBuy  Side = "buy"
)

// Order is one deduped market order, already scaled to silver.
type Order struct {
	Item     string
	Enchant  int
	Location int
	Side     Side
	Price    int
	Amount   int
	Quality  int
	Expires  time.Time
}

type payload struct {
	ItemTypeID       string          `json:"ItemTypeId"`
	LocationID       json.RawMessage `json:"LocationId"`
	QualityLevel     int             `json:"QualityLevel"`
	EnchantmentLevel int             `json:"EnchantmentLevel"`
	UnitPriceSilver  float64         `json:"UnitPriceSilver"`
	Amount           float64         `json:"Amount"`
	AuctionType      string          `json:"AuctionType"`
	Expires          string          `json:"Expires"`
}

// Parse decodes a marketorders.deduped payload.
// ok is false when the order is discarded. err is set only when the JSON itself is unreadable.
func Parse(raw []byte, now time.Time) (Order, bool, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return Order{}, false, fmt.Errorf("empty order payload")
	}
	var body payload
	if err := json.Unmarshal(raw, &body); err != nil {
		return Order{}, false, fmt.Errorf("parse order: %w", err)
	}

	base, enchant, itemOK := splitItem(body.ItemTypeID, body.EnchantmentLevel)
	location, locationOK := parseLocation(body.LocationID)
	side, sideOK := parseSide(body.AuctionType)
	price := int(math.Round(body.UnitPriceSilver))
	amount := int(math.Round(body.Amount))
	if !itemOK || !locationOK || !sideOK || price <= 0 || amount <= 0 {
		return Order{}, false, nil
	}
	if body.QualityLevel < 1 || body.QualityLevel > 5 || enchant < 0 || enchant > 4 {
		return Order{}, false, nil
	}

	expires, expiresOK := parseExpires(body.Expires)
	if !expiresOK {
		return Order{}, false, nil
	}
	if !expires.IsZero() && expires.Before(now) {
		return Order{}, false, nil
	}

	return Order{
		Item:     base,
		Enchant:  enchant,
		Location: location,
		Side:     side,
		Price:    price,
		Amount:   amount,
		Quality:  body.QualityLevel,
		Expires:  expires,
	}, true, nil
}

func splitItem(itemTypeID string, enchantmentLevel int) (string, int, bool) {
	if strings.TrimSpace(itemTypeID) == "" {
		return "", 0, false
	}
	base := itemTypeID
	enchant := enchantmentLevel
	if at := strings.LastIndex(itemTypeID, "@"); at >= 0 {
		parsed, err := strconv.Atoi(itemTypeID[at+1:])
		if err != nil || at == 0 {
			return "", 0, false
		}
		base = itemTypeID[:at]
		enchant = parsed
	}
	return base, enchant, true
}

func parseLocation(raw json.RawMessage) (int, bool) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return 0, false
	}
	var asNumber int
	if err := json.Unmarshal(trimmed, &asNumber); err == nil {
		return asNumber, true
	}
	var asText string
	if err := json.Unmarshal(trimmed, &asText); err != nil {
		return 0, false
	}
	parsed, err := strconv.Atoi(strings.TrimSpace(asText))
	if err != nil {
		return 0, false
	}
	return parsed, true
}

func parseSide(auctionType string) (Side, bool) {
	switch auctionType {
	case "offer":
		return SideSell, true
	case "request":
		return SideBuy, true
	default:
		return "", false
	}
}

func parseExpires(raw string) (time.Time, bool) {
	if strings.TrimSpace(raw) == "" {
		return time.Time{}, true
	}
	layouts := []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02T15:04:05.0000000"}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, raw)
		if err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}
