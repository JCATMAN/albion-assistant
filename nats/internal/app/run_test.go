package app

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"albion-assistant/nats/internal/cell"
	"albion-assistant/nats/internal/order"
)

type fakeStore struct {
	mu      sync.Mutex
	updates []cell.Update
	stale   []cell.Key
	applied chan cell.Update
}

func (store *fakeStore) Apply(ctx context.Context, update cell.Update) error {
	store.mu.Lock()
	store.updates = append(store.updates, update)
	store.mu.Unlock()
	if store.applied != nil {
		store.applied <- update
	}
	return nil
}

func (store *fakeStore) Stale(ctx context.Context, olderThan time.Time, limit int) ([]cell.Key, error) {
	store.mu.Lock()
	defer store.mu.Unlock()
	if limit > 0 && len(store.stale) > limit {
		return append([]cell.Key(nil), store.stale[:limit]...), nil
	}
	return append([]cell.Key(nil), store.stale...), nil
}

func (store *fakeStore) count() int {
	store.mu.Lock()
	defer store.mu.Unlock()
	return len(store.updates)
}

type fakePrices struct {
	mu      sync.Mutex
	calls   int
	updates []cell.Update
	err     error
	onCall  func()
}

func (prices *fakePrices) Current(ctx context.Context, items []string, cities []string, qualities []int) ([]cell.Update, error) {
	prices.mu.Lock()
	prices.calls++
	err := prices.err
	updates := append([]cell.Update(nil), prices.updates...)
	onCall := prices.onCall
	prices.mu.Unlock()
	if onCall != nil {
		onCall()
	}
	if err != nil {
		return nil, err
	}
	return updates, nil
}

func (prices *fakePrices) callCount() int {
	prices.mu.Lock()
	defer prices.mu.Unlock()
	return prices.calls
}

func TestRunCaerleonOffer(t *testing.T) {
	orders := make(chan order.Order, 1)
	market := &fakeStore{applied: make(chan cell.Update, 1)}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- Run(ctx, Deps{
			Orders: orders,
			Store:  market,
			Prices: &fakePrices{},
			Now:    func() time.Time { return time.Unix(100, 0) },
		})
	}()

	orders <- order.Order{
		Item: "T4_BAG", Location: 3005, Side: order.SideSell, Price: 4978, Amount: 15, Quality: 1,
	}
	select {
	case update := <-market.applied:
		if update.Source != cell.SourceNATS || update.Key.City != "Caerleon" || update.SellMin == nil || *update.SellMin != 4978 {
			t.Fatalf("%+v", update)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for apply")
	}
	cancel()
	waitDone(t, done)
}

func TestRunIgnoresUnknownLocation(t *testing.T) {
	orders := make(chan order.Order, 2)
	market := &fakeStore{applied: make(chan cell.Update, 1)}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- Run(ctx, Deps{Orders: orders, Store: market, Prices: &fakePrices{}, Now: time.Now})
	}()

	orders <- order.Order{Item: "T4_BAG", Location: 4, Side: order.SideSell, Price: 10, Amount: 1, Quality: 1}
	orders <- order.Order{Item: "T5_BAG", Location: 3005, Side: order.SideSell, Price: 11, Amount: 1, Quality: 1}
	select {
	case update := <-market.applied:
		if update.Key.Item != "T5_BAG" {
			t.Fatalf("%+v", update)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out")
	}
	if market.count() != 1 {
		t.Fatalf("applies %d", market.count())
	}
	cancel()
	waitDone(t, done)
}

func TestRunSkipsBackupWhenCellIsFresh(t *testing.T) {
	tick := make(chan time.Time, 1)
	tickDone := make(chan struct{}, 1)
	prices := &fakePrices{}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- Run(ctx, Deps{
			Store:    &fakeStore{},
			Prices:   prices,
			Alive:    func() bool { return true },
			Tick:     tick,
			TickDone: tickDone,
			Now:      time.Now,
		})
	}()
	tick <- time.Now()
	select {
	case <-tickDone:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out")
	}
	if prices.callCount() != 0 {
		t.Fatalf("api calls %d", prices.callCount())
	}
	cancel()
	waitDone(t, done)
}

func TestRunBackupWhenNATSIsDown(t *testing.T) {
	tick := make(chan time.Time, 1)
	tickDone := make(chan struct{}, 1)
	staleKey := cell.Key{Item: "T4_BAG", City: "Caerleon", Quality: 1, Enchantment: 0}
	price := 4978
	prices := &fakePrices{updates: []cell.Update{{
		Key: staleKey, SellMin: &price, UpdatedAt: time.Unix(50, 0), Source: cell.SourceAPI,
	}}}
	market := &fakeStore{stale: []cell.Key{staleKey}, applied: make(chan cell.Update, 1)}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- Run(ctx, Deps{
			Store:    market,
			Prices:   prices,
			Alive:    func() bool { return false },
			Tick:     tick,
			TickDone: tickDone,
			Now:      func() time.Time { return time.Unix(100, 0) },
		})
	}()
	tick <- time.Unix(100, 0)
	select {
	case update := <-market.applied:
		if update.Source != cell.SourceAPI || update.SellMin == nil || *update.SellMin != 4978 {
			t.Fatalf("%+v", update)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out")
	}
	select {
	case <-tickDone:
	case <-time.After(2 * time.Second):
		t.Fatal("tick did not finish")
	}
	if prices.callCount() != 1 {
		t.Fatalf("api calls %d", prices.callCount())
	}
	cancel()
	waitDone(t, done)
}

func TestRunBackupErrorDoesNotWrite(t *testing.T) {
	tick := make(chan time.Time, 1)
	tickDone := make(chan struct{}, 1)
	prices := &fakePrices{err: errors.New("albion api returned 429")}
	market := &fakeStore{stale: []cell.Key{{Item: "T4_BAG", City: "Caerleon", Quality: 1}}}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- Run(ctx, Deps{
			Store:    market,
			Prices:   prices,
			Alive:    func() bool { return false },
			Tick:     tick,
			TickDone: tickDone,
			Now:      time.Now,
		})
	}()
	tick <- time.Now()
	select {
	case <-tickDone:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out")
	}
	if market.count() != 0 {
		t.Fatalf("writes %d", market.count())
	}
	cancel()
	waitDone(t, done)
}

func TestRunWatchItemsOnStartup(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	prices := &fakePrices{onCall: cancel}
	done := make(chan error, 1)
	go func() {
		done <- Run(ctx, Deps{
			Store:      &fakeStore{},
			Prices:     prices,
			WatchItems: []string{"T4_BAG"},
			Now:        time.Now,
		})
	}()
	waitDone(t, done)
	if prices.callCount() != 1 {
		t.Fatalf("api calls %d", prices.callCount())
	}
}

func TestRunCancelReturnsNil(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := Run(ctx, Deps{Store: &fakeStore{}, Prices: &fakePrices{}}); err != nil {
		t.Fatal(err)
	}
}

func waitDone(t *testing.T, done <-chan error) {
	t.Helper()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("run did not return")
	}
}
