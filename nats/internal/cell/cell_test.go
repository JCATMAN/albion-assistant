package cell

import (
	"testing"
	"time"

	"albion-assistant/nats/internal/order"
)

func TestApply(t *testing.T) {
	at := time.Unix(1_700_000_000, 0).UTC()
	cases := []struct {
		name        string
		previous    Snapshot
		side        order.Side
		price       int
		amount      int
		wantSell    int
		wantSellAmt int
		wantBuy     int
		changed     bool
	}{
		{
			name: "empty offer", side: order.SideSell, price: 4978, amount: 15,
			wantSell: 4978, wantSellAmt: 15, changed: true,
		},
		{
			name:     "more expensive offer ignored",
			previous: Snapshot{HasSell: true, SellMin: 4978, HasSellAmount: true, SellAmount: 15},
			side:     order.SideSell, price: 5200, amount: 3, wantSell: 4978, wantSellAmt: 15, changed: false,
		},
		{
			name:     "cheaper offer",
			previous: Snapshot{HasSell: true, SellMin: 4978, HasSellAmount: true, SellAmount: 15},
			side:     order.SideSell, price: 4800, amount: 4, wantSell: 4800, wantSellAmt: 4, changed: true,
		},
		{
			name:     "same price updates amount",
			previous: Snapshot{HasSell: true, SellMin: 4978, HasSellAmount: true, SellAmount: 15},
			side:     order.SideSell, price: 4978, amount: 40, wantSell: 4978, wantSellAmt: 40, changed: false,
		},
		{
			name:     "request fills buy",
			previous: Snapshot{HasSell: true, SellMin: 4978, HasSellAmount: true, SellAmount: 15},
			side:     order.SideBuy, price: 3000, amount: 2, wantSell: 4978, wantSellAmt: 15, wantBuy: 3000, changed: true,
		},
		{
			name:     "worse request ignored",
			previous: Snapshot{HasBuy: true, BuyMax: 3000, HasBuyAmount: true, BuyAmount: 2},
			side:     order.SideBuy, price: 2500, amount: 9, wantBuy: 3000, changed: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			next, changed := Apply(tc.previous, tc.side, tc.price, tc.amount, at)
			if changed != tc.changed {
				t.Fatalf("changed %v", changed)
			}
			if next.SellMin != tc.wantSell || next.SellAmount != tc.wantSellAmt || next.BuyMax != tc.wantBuy {
				t.Fatalf("%+v", next)
			}
			if tc.name == "more expensive offer ignored" || tc.name == "worse request ignored" {
				if next != tc.previous {
					t.Fatalf("snapshot changed %+v", next)
				}
			}
			if tc.name == "request fills buy" && next.SellMin != 4978 {
				t.Fatalf("sell moved %+v", next)
			}
		})
	}
}

func TestKeyFormat(t *testing.T) {
	plain := (Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}).String()
	if plain != "west:T4_BAG:Caerleon:q1:e0" {
		t.Fatalf("%s", plain)
	}
	market := (Key{Item: "T4_BAG", City: "Black Market", Quality: 1, Enchantment: 0}).String()
	if market != "west:T4_BAG:Black Market:q1:e0" {
		t.Fatalf("%s", market)
	}
	enchanted := (Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 1}).String()
	if enchanted != "west:T4_BAG:Caerleon:q1:e1" {
		t.Fatalf("%s", enchanted)
	}
	parsed, ok := ParseKey(market)
	if !ok || parsed.City != "Black Market" || parsed.Item != "T4_BAG" {
		t.Fatalf("%+v ok %v", parsed, ok)
	}
}
