package order

import (
	"testing"
	"time"
)

func TestParseExampleOffer(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	raw := []byte(`{
		"Id": 12226808117,
		"ItemTypeId": "T4_BAG@1",
		"ItemGroupTypeId": "T4_BAG",
		"LocationId": 3005,
		"QualityLevel": 1,
		"EnchantmentLevel": 1,
		"UnitPriceSilver": 4978,
		"Amount": 15,
		"AuctionType": "offer",
		"Expires": "2026-10-15T00:24:27"
	}`)

	got, ok, err := Parse(raw, now)
	if err != nil || !ok {
		t.Fatalf("ok %v err %v", ok, err)
	}
	if got.Item != "T4_BAG" || got.Enchant != 1 || got.Location != 3005 || got.Side != SideSell || got.Price != 4978 || got.Amount != 15 || got.Quality != 1 {
		t.Fatalf("%+v", got)
	}
}

func TestParseLocationAsString(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	raw := []byte(`{"ItemTypeId":"T4_BAG","LocationId":"3008","QualityLevel":1,"EnchantmentLevel":0,"UnitPriceSilver":100,"Amount":1,"AuctionType":"offer","Expires":"2026-10-15T00:24:27"}`)
	got, ok, err := Parse(raw, now)
	if err != nil || !ok {
		t.Fatalf("ok %v err %v", ok, err)
	}
	if got.Location != 3008 {
		t.Fatalf("location %d", got.Location)
	}
}

func TestParseRequestIsBuy(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	raw := []byte(`{"ItemTypeId":"T4_BAG","LocationId":3005,"QualityLevel":1,"EnchantmentLevel":0,"UnitPriceSilver":100,"Amount":1,"AuctionType":"request","Expires":"2026-10-15T00:24:27"}`)
	got, ok, err := Parse(raw, now)
	if err != nil || !ok {
		t.Fatalf("ok %v err %v", ok, err)
	}
	if got.Side != SideBuy {
		t.Fatalf("side %s", got.Side)
	}
}

func TestParseDiscardsInvalidOrders(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	cases := []string{
		`{"ItemTypeId":"T4_BAG","LocationId":3005,"QualityLevel":1,"EnchantmentLevel":0,"UnitPriceSilver":0,"Amount":1,"AuctionType":"offer","Expires":"2026-10-15T00:24:27"}`,
		`{"ItemTypeId":"T4_BAG","LocationId":3005,"QualityLevel":1,"EnchantmentLevel":0,"UnitPriceSilver":100,"Amount":0,"AuctionType":"offer","Expires":"2026-10-15T00:24:27"}`,
		`{"ItemTypeId":"T4_BAG","LocationId":3005,"QualityLevel":6,"EnchantmentLevel":0,"UnitPriceSilver":100,"Amount":1,"AuctionType":"offer","Expires":"2026-10-15T00:24:27"}`,
		`{"ItemTypeId":"T4_BAG","LocationId":3005,"QualityLevel":1,"EnchantmentLevel":5,"UnitPriceSilver":100,"Amount":1,"AuctionType":"offer","Expires":"2026-10-15T00:24:27"}`,
	}
	for _, raw := range cases {
		_, ok, err := Parse([]byte(raw), now)
		if err != nil || ok {
			t.Fatalf("raw %s ok %v err %v", raw, ok, err)
		}
	}
}

func TestParseEnchantmentFieldWithoutSuffix(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	raw := []byte(`{"ItemTypeId":"T4_BAG","LocationId":3005,"QualityLevel":1,"EnchantmentLevel":2,"UnitPriceSilver":100,"Amount":1,"AuctionType":"offer","Expires":"2026-10-15T00:24:27"}`)
	got, ok, err := Parse(raw, now)
	if err != nil || !ok {
		t.Fatalf("ok %v err %v", ok, err)
	}
	if got.Item != "T4_BAG" || got.Enchant != 2 {
		t.Fatalf("%+v", got)
	}
}

func TestParseSuffixWinsOverEnchantmentField(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	raw := []byte(`{"ItemTypeId":"T4_BAG@1","LocationId":3005,"QualityLevel":1,"EnchantmentLevel":0,"UnitPriceSilver":100,"Amount":1,"AuctionType":"offer","Expires":"2026-10-15T00:24:27"}`)
	got, ok, err := Parse(raw, now)
	if err != nil || !ok {
		t.Fatalf("ok %v err %v", ok, err)
	}
	if got.Item != "T4_BAG" || got.Enchant != 1 {
		t.Fatalf("%+v", got)
	}
}

func TestParseTruncatedJSON(t *testing.T) {
	_, ok, err := Parse([]byte(`{`), time.Now())
	if err == nil || ok {
		t.Fatalf("ok %v err %v", ok, err)
	}
}

func TestParseExpiredOrderIsDiscarded(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	raw := []byte(`{"ItemTypeId":"T4_BAG","LocationId":3005,"QualityLevel":1,"EnchantmentLevel":0,"UnitPriceSilver":100,"Amount":1,"AuctionType":"offer","Expires":"2020-01-01T00:00:00"}`)
	_, ok, err := Parse(raw, now)
	if err != nil || ok {
		t.Fatalf("ok %v err %v", ok, err)
	}
}

func TestParseDoesNotRescaleSilver(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	raw := []byte(`{"UnitPriceSilver":10000}`)
	_, ok, err := Parse(raw, now)
	if err != nil || ok {
		t.Fatalf("ok %v err %v", ok, err)
	}
}
