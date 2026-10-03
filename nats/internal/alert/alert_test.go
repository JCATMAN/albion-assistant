package alert

import (
	"testing"

	"albion-assistant/nats/internal/cell"
)

func TestCrossedSellFiresAtOrBelowTarget(t *testing.T) {
	if !Crossed("sell", 13000, 12000) || !Crossed("sell", 13000, 13000) {
		t.Fatal("sell at or below should fire")
	}
	if Crossed("sell", 13000, 13001) || Crossed("sell", 0, 10) || Crossed("sell", 10, 0) {
		t.Fatal("sell above target or a zero price should stay quiet")
	}
}

func TestCrossedBuyFiresAtOrAboveTarget(t *testing.T) {
	if !Crossed("buy", 14000, 15000) || !Crossed("buy", 14000, 14000) {
		t.Fatal("buy at or above should fire")
	}
	if Crossed("buy", 14000, 13999) || Crossed("other", 1, 1) {
		t.Fatal("buy below target or an unknown side should stay quiet")
	}
}

func TestContentMentionsTheUserAndGroupsSilver(t *testing.T) {
	item := Alert{
		UserID: "42",
		Name:   "Bolsa <script>",
		City:   "Martlock",
		Item:   "T4_BAG",
		Side:   "sell",
		Target: 13000,
	}
	text := Content(item, "Martlock", 2, 0, 12855)
	if text != "<@42> **Bolsa script** en Martlock · Buena · encantamiento 0: la venta bajó a 12.855. Pediste 13.000 o menos." {
		t.Fatalf("%s", text)
	}
	item.Side = "buy"
	item.Target = 14000
	buy := Content(item, "Martlock", 2, 0, 15133)
	if buy != "<@42> **Bolsa script** en Martlock · Buena · encantamiento 0: la compra subió a 15.133. Pediste 14.000 o más." {
		t.Fatalf("%s", buy)
	}
}

func TestOpenAlertMatchesAnyCityQualityAndEnchantment(t *testing.T) {
	item := Alert{Item: "T4_BAG", City: "*", AnyQuality: true, AnyEnchantment: true, Side: "sell", Target: 13000}
	hit := cell.Key{Item: "T4_BAG", City: "Martlock", Quality: 3, Enchantment: 2}
	if !item.Matches(hit, "sell", 12000) {
		t.Fatal("open sell watch should match")
	}
	if item.Matches(hit, "sell", 14000) || item.Matches(hit, "buy", 12000) {
		t.Fatal("a higher sell or the other side should stay quiet")
	}
	item.City = "Caerleon"
	item.AnyQuality = false
	item.Quality = 1
	if item.Matches(hit, "sell", 12000) {
		t.Fatal("a different city and quality should stay quiet")
	}
}

func TestKeysMatchTheAPIContract(t *testing.T) {
	if ItemIndex("T4_BAG") != "alerts:item:T4_BAG" {
		t.Fatalf("index %s", ItemIndex("T4_BAG"))
	}
	if RecordKey("abc") != "alert:abc" {
		t.Fatalf("record %s", RecordKey("abc"))
	}
	if OwnerKey("42", "T4_BAG", "sell") != "alert-owner:42:T4_BAG:sell" {
		t.Fatalf("owner %s", OwnerKey("42", "T4_BAG", "sell"))
	}
}
