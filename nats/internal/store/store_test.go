package store

import (
	"context"
	"reflect"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"albion-assistant/nats/internal/cell"
)

func newStore(t *testing.T) (*RedisStore, *redis.Client, *miniredis.Miniredis) {
	t.Helper()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	return New(client, 2*time.Hour, 0.2), client, server
}

func readHash(t *testing.T, client *redis.Client, key string) map[string]string {
	t.Helper()
	values, err := client.HGetAll(context.Background(), key).Result()
	if err != nil {
		t.Fatal(err)
	}
	return values
}

func intPtr(value int) *int {
	return &value
}

func TestApplyFirstOffer(t *testing.T) {
	store, client, server := newStore(t)
	key := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	err := store.Apply(context.Background(), cell.Update{
		Key:        key,
		SellMin:    intPtr(4978),
		SellAmount: intPtr(15),
		UpdatedAt:  time.Unix(1_700_000_000, 0),
		Source:     cell.SourceNATS,
	})
	if err != nil {
		t.Fatal(err)
	}
	hash := readHash(t, client, key.String())
	if hash["sell_min"] != "4978" || hash["sell_amount"] != "15" || hash["sell_avg"] != "4978" || hash["source"] != "nats" {
		t.Fatalf("%v", hash)
	}
	if _, ok := hash["buy_max"]; ok {
		t.Fatalf("buy side present %v", hash)
	}
	ttl := server.TTL(key.String())
	if ttl <= 0 || ttl > 2*time.Hour {
		t.Fatalf("ttl %s", ttl)
	}
}

func TestApplyCheaperOfferMovesAverage(t *testing.T) {
	store, client, _ := newStore(t)
	key := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	at := time.Unix(1_700_000_000, 0)
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(5000), SellAmount: intPtr(10), UpdatedAt: at, Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(4000), SellAmount: intPtr(4), UpdatedAt: at.Add(time.Minute), Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	hash := readHash(t, client, key.String())
	if hash["sell_min"] != "4000" || hash["sell_avg"] != "4800" {
		t.Fatalf("%v", hash)
	}
}

func TestApplyMoreExpensiveOfferLeavesHash(t *testing.T) {
	store, client, _ := newStore(t)
	key := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	at := time.Unix(1_700_000_000, 0)
	first := cell.Update{Key: key, SellMin: intPtr(5000), SellAmount: intPtr(10), UpdatedAt: at, Source: cell.SourceNATS}
	if err := store.Apply(context.Background(), first); err != nil {
		t.Fatal(err)
	}
	before := readHash(t, client, key.String())
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(6000), SellAmount: intPtr(3), UpdatedAt: at.Add(time.Minute), Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	after := readHash(t, client, key.String())
	if !reflect.DeepEqual(before, after) {
		t.Fatalf("before %v after %v", before, after)
	}
}

func TestApplySamePriceUpdatesAmountOnce(t *testing.T) {
	store, client, _ := newStore(t)
	key := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	at := time.Unix(1_700_000_000, 0)
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(4978), SellAmount: intPtr(15), UpdatedAt: at, Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(4978), SellAmount: intPtr(40), UpdatedAt: at.Add(time.Minute), Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	hash := readHash(t, client, key.String())
	if hash["sell_amount"] != "40" || hash["sell_avg"] != "4978" {
		t.Fatalf("%v", hash)
	}
}

func TestApplyAPIWithoutAmount(t *testing.T) {
	store, client, _ := newStore(t)
	key := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(4978), UpdatedAt: time.Unix(1_700_000_000, 0), Source: cell.SourceAPI,
	})
	if err != nil {
		t.Fatal(err)
	}
	hash := readHash(t, client, key.String())
	if hash["sell_min"] != "4978" {
		t.Fatalf("%v", hash)
	}
	if _, ok := hash["sell_amount"]; ok {
		t.Fatalf("amount was created %v", hash)
	}
}

func TestApplyAPIKeepsExistingAmount(t *testing.T) {
	store, client, _ := newStore(t)
	key := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	at := time.Unix(1_700_000_000, 0)
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(4978), SellAmount: intPtr(15), UpdatedAt: at, Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(4500), UpdatedAt: at.Add(time.Minute), Source: cell.SourceAPI,
	}); err != nil {
		t.Fatal(err)
	}
	hash := readHash(t, client, key.String())
	if hash["sell_amount"] != "15" || hash["sell_min"] != "4500" || hash["source"] != "api" {
		t.Fatalf("%v", hash)
	}
}

func TestApplyOlderAPIDoesNotOverwrite(t *testing.T) {
	store, client, _ := newStore(t)
	key := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	newer := time.Unix(5_000, 0)
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(4978), SellAmount: intPtr(15), UpdatedAt: newer, Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	before := readHash(t, client, key.String())
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(1000), UpdatedAt: time.Unix(1_000, 0), Source: cell.SourceAPI,
	}); err != nil {
		t.Fatal(err)
	}
	after := readHash(t, client, key.String())
	if !reflect.DeepEqual(before, after) {
		t.Fatalf("before %v after %v", before, after)
	}
}

func TestApplyZeroPriceDoesNotCreateKey(t *testing.T) {
	store, _, server := newStore(t)
	key := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	if err := store.Apply(context.Background(), cell.Update{
		Key: key, SellMin: intPtr(0), UpdatedAt: time.Unix(1_700_000_000, 0), Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	if server.Exists(key.String()) {
		t.Fatal("key was created")
	}
}

func TestStaleReturnsOnlyOldCellsAndRespectsLimit(t *testing.T) {
	store, _, _ := newStore(t)
	oldKey := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	newKey := cell.Key{Item: "T5_BAG", City: "Martlock", Quality: 1, Enchantment: 0}
	if err := store.Apply(context.Background(), cell.Update{
		Key: oldKey, SellMin: intPtr(10), SellAmount: intPtr(1), UpdatedAt: time.Unix(1_000, 0), Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.Apply(context.Background(), cell.Update{
		Key: newKey, SellMin: intPtr(20), SellAmount: intPtr(1), UpdatedAt: time.Unix(5_000, 0), Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	found, err := store.Stale(context.Background(), time.Unix(3_000, 0), 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(found) != 1 || found[0] != oldKey {
		t.Fatalf("%+v", found)
	}

	otherOld := cell.Key{Item: "T6_BAG", City: "Thetford", Quality: 1, Enchantment: 0}
	if err := store.Apply(context.Background(), cell.Update{
		Key: otherOld, SellMin: intPtr(30), SellAmount: intPtr(1), UpdatedAt: time.Unix(1_100, 0), Source: cell.SourceNATS,
	}); err != nil {
		t.Fatal(err)
	}
	limited, err := store.Stale(context.Background(), time.Unix(3_000, 0), 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(limited) != 1 {
		t.Fatalf("%+v", limited)
	}
}
