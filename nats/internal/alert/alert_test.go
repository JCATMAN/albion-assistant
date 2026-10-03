package alert

import "testing"

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
	text := Content(item, 12855)
	if text != "<@42> **Bolsa script** en Martlock: la venta bajó a 12.855. Pediste 13.000 o menos." {
		t.Fatalf("%s", text)
	}
	item.Side = "buy"
	item.Target = 14000
	buy := Content(item, 15133)
	if buy != "<@42> **Bolsa script** en Martlock: la compra subió a 15.133. Pediste 14.000 o más." {
		t.Fatalf("%s", buy)
	}
}

func TestKeysMatchTheAPIContract(t *testing.T) {
	item := Alert{ID: "abc", Item: "T4_BAG", City: "Fort Sterling", Quality: 1, Enchantment: 0, Side: "sell", UserID: "42"}
	if item.CellKey() != "west:T4_BAG:Fort Sterling:q1:e0" {
		t.Fatalf("cell %s", item.CellKey())
	}
	if IndexKey(item.CellKey()) != "alerts:west:T4_BAG:Fort Sterling:q1:e0" {
		t.Fatalf("index %s", IndexKey(item.CellKey()))
	}
	if RecordKey("abc") != "alert:abc" {
		t.Fatalf("record %s", RecordKey("abc"))
	}
	if OwnerKey("42", item.CellKey(), "sell") != "alert-owner:42:west:T4_BAG:Fort Sterling:q1:e0:sell" {
		t.Fatalf("owner %s", OwnerKey("42", item.CellKey(), "sell"))
	}
}
