package conn

import (
	"testing"
	"time"

	"albion-assistant/nats/internal/order"
)

func TestHandle(t *testing.T) {
	now := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	valid := []byte(`{"ItemTypeId":"T4_BAG@1","LocationId":3005,"QualityLevel":1,"EnchantmentLevel":1,"UnitPriceSilver":4978,"Amount":15,"AuctionType":"offer","Expires":"2026-10-15T00:24:27"}`)
	cases := []struct {
		name    string
		body    []byte
		pushed  bool
		wantErr bool
	}{
		{name: "valid", body: valid, pushed: true},
		{name: "empty object", body: []byte(`{}`), pushed: false},
		{name: "empty body", body: nil, pushed: false, wantErr: true},
		{name: "broken", body: []byte(`{`), pushed: false, wantErr: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out := make(chan order.Order, 1)
			err := Handle(tc.body, out, now)
			if tc.wantErr && err == nil {
				t.Fatal("expected error")
			}
			if !tc.wantErr && err != nil {
				t.Fatal(err)
			}
			select {
			case got := <-out:
				if !tc.pushed {
					t.Fatalf("unexpected order %+v", got)
				}
				if got.Item != "T4_BAG" || got.Price != 4978 {
					t.Fatalf("%+v", got)
				}
			default:
				if tc.pushed {
					t.Fatal("expected an order")
				}
			}
		})
	}
}
