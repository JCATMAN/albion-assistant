package alert

import (
	"context"
	"strconv"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestDueReturnsOnlyTheSideThatCrossed(t *testing.T) {
	book, client := newBook(t)
	cellKey := "west:T4_BAG:Martlock:q1:e0"
	seed(t, client, Alert{
		ID: "sell-hit", Item: "T4_BAG", Name: "Bolsa", City: "Martlock",
		Quality: 1, Enchantment: 0, Side: "sell", Target: 13000,
		ChannelID: "100", UserID: "42",
	})
	seed(t, client, Alert{
		ID: "sell-wait", Item: "T4_BAG", Name: "Bolsa", City: "Martlock",
		Quality: 1, Enchantment: 0, Side: "sell", Target: 10000,
		ChannelID: "100", UserID: "43",
	})
	seed(t, client, Alert{
		ID: "buy-wait", Item: "T4_BAG", Name: "Bolsa", City: "Martlock",
		Quality: 1, Enchantment: 0, Side: "buy", Target: 20000,
		ChannelID: "100", UserID: "44",
	})

	due, err := book.Due(context.Background(), cellKey, "sell", 12000)
	if err != nil {
		t.Fatal(err)
	}
	if len(due) != 1 || due[0].ID != "sell-hit" {
		t.Fatalf("%+v", due)
	}
}

func TestRemoveDropsTheHashIndexAndOwner(t *testing.T) {
	book, client := newBook(t)
	item := Alert{
		ID: "abc", Item: "T4_BAG", Name: "Bolsa", City: "Martlock",
		Quality: 1, Enchantment: 0, Side: "sell", Target: 13000,
		ChannelID: "100", UserID: "42",
	}
	seed(t, client, item)
	if err := book.Remove(context.Background(), item); err != nil {
		t.Fatal(err)
	}
	if client.Exists(context.Background(), RecordKey(item.ID)).Val() != 0 {
		t.Fatal("hash remains")
	}
	if client.SCard(context.Background(), IndexKey(item.CellKey())).Val() != 0 {
		t.Fatal("index remains")
	}
	if client.Exists(context.Background(), OwnerKey(item.UserID, item.CellKey(), item.Side)).Val() != 0 {
		t.Fatal("owner remains")
	}
}

func newBook(t *testing.T) (*Book, *redis.Client) {
	t.Helper()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	return NewBook(client), client
}

func seed(t *testing.T, client *redis.Client, item Alert) {
	t.Helper()
	ctx := context.Background()
	if err := client.HSet(ctx, RecordKey(item.ID), map[string]string{
		"item":        item.Item,
		"name":        item.Name,
		"city":        item.City,
		"quality":     strconv.Itoa(item.Quality),
		"enchantment": strconv.Itoa(item.Enchantment),
		"side":        item.Side,
		"target":      strconv.Itoa(item.Target),
		"channel_id":  item.ChannelID,
		"user_id":     item.UserID,
	}).Err(); err != nil {
		t.Fatal(err)
	}
	if err := client.SAdd(ctx, IndexKey(item.CellKey()), item.ID).Err(); err != nil {
		t.Fatal(err)
	}
	if err := client.Set(ctx, OwnerKey(item.UserID, item.CellKey(), item.Side), item.ID, 0).Err(); err != nil {
		t.Fatal(err)
	}
}
