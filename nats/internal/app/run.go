package app

import (
	"context"
	"time"

	"albion-assistant/nats/internal/alert"
	"albion-assistant/nats/internal/cell"
	"albion-assistant/nats/internal/location"
	"albion-assistant/nats/internal/order"
)

const (
	staleBatchLimit = 100
	writeAttempts   = 3
)

// Store is the Redis writer used by the loop.
type Store interface {
	Apply(ctx context.Context, update cell.Update) (cell.Applied, error)
	Stale(ctx context.Context, olderThan time.Time, limit int) ([]cell.Key, error)
}

// AlertBook finds watches whose target a new price has crossed.
type AlertBook interface {
	Due(ctx context.Context, key cell.Key, side string, price int) ([]alert.Alert, error)
	Remove(ctx context.Context, item alert.Alert) error
}

// AlertSender publishes one watch to its Discord channel.
type AlertSender interface {
	Send(ctx context.Context, item alert.Alert, city string, quality int, enchantment int, price int) error
}

// Prices is the West API backup.
type Prices interface {
	Current(ctx context.Context, items []string, cities []string, qualities []int) ([]cell.Update, error)
}

// Deps wires the loop. TickDone is optional and is signaled after each backup pass.
type Deps struct {
	Orders     <-chan order.Order
	Store      Store
	Prices     Prices
	Alive      func() bool
	Tick       <-chan time.Time
	StaleAfter time.Duration
	WatchItems []string
	Now        func() time.Time
	Logf       func(format string, args ...any)
	TickDone   chan struct{}
	Alerts     AlertBook
	Sender     AlertSender
}

// Run blocks until ctx is cancelled. It returns nil after a short drain of the order queue.
func Run(ctx context.Context, deps Deps) error {
	if deps.Now == nil {
		deps.Now = time.Now
	}
	if deps.Logf == nil {
		deps.Logf = func(string, ...any) {}
	}
	if deps.Alive == nil {
		deps.Alive = func() bool { return true }
	}
	refreshWatch(ctx, deps)
	for {
		select {
		case <-ctx.Done():
			drain(deps)
			return nil
		case incoming, ok := <-deps.Orders:
			if !ok {
				continue
			}
			handleOrder(ctx, deps, incoming)
		case <-deps.Tick:
			refreshStale(ctx, deps)
			signal(deps.TickDone)
		}
	}
}

func handleOrder(ctx context.Context, deps Deps, incoming order.Order) {
	city, ok := location.City(incoming.Location)
	if !ok {
		deps.Logf("unknown city location %d", incoming.Location)
		return
	}
	price := incoming.Price
	amount := incoming.Amount
	update := cell.Update{
		Key: cell.Key{
			Item:        incoming.Item,
			City:        city,
			Quality:     incoming.Quality,
			Enchantment: incoming.Enchant,
		},
		UpdatedAt: deps.Now(),
		Source:    cell.SourceNATS,
	}
	if incoming.Side == order.SideBuy {
		update.BuyMax = &price
		update.BuyAmount = &amount
	} else {
		update.SellMin = &price
		update.SellAmount = &amount
	}
	write(ctx, deps, update)
}

func refreshWatch(ctx context.Context, deps Deps) {
	if len(deps.WatchItems) == 0 || deps.Prices == nil {
		return
	}
	updates, err := deps.Prices.Current(ctx, deps.WatchItems, location.All(), []int{1, 2, 3, 4, 5})
	if err != nil {
		deps.Logf("watch backup failed: %v", err)
		return
	}
	applyAPI(ctx, deps, updates)
}

func refreshStale(ctx context.Context, deps Deps) {
	if !deps.Alive() {
		deps.Logf("nats is down; refreshing stale cells")
	}
	if deps.Store == nil || deps.Prices == nil {
		return
	}
	keys, err := deps.Store.Stale(ctx, deps.Now().Add(-deps.StaleAfter), staleBatchLimit)
	if err != nil {
		deps.Logf("stale scan failed: %v", err)
		return
	}
	if len(keys) == 0 {
		deps.Logf("stale scan found nothing alive=%t", deps.Alive())
		return
	}
	deps.Logf("stale scan refreshing %d cells", len(keys))
	items, cities, qualities := dimensions(keys)
	updates, err := deps.Prices.Current(ctx, items, cities, qualities)
	if err != nil {
		deps.Logf("albion api backup failed: %v", err)
		return
	}
	applyAPI(ctx, deps, updates)
}

func applyAPI(ctx context.Context, deps Deps, updates []cell.Update) {
	observedAt := deps.Now()
	for _, update := range updates {
		update.Source = cell.SourceAPI
		if update.UpdatedAt.IsZero() {
			update.UpdatedAt = observedAt
		}
		write(ctx, deps, update)
	}
}

func write(ctx context.Context, deps Deps, update cell.Update) {
	var err error
	var applied cell.Applied
	for attempt := 1; attempt <= writeAttempts; attempt++ {
		applied, err = deps.Store.Apply(ctx, update)
		if err == nil {
			deps.Logf("stored %s source=%s", update.Key.String(), update.Source)
			notify(ctx, deps, update.Key, applied)
			return
		}
	}
	deps.Logf("redis apply failed for %s: %v", update.Key.String(), err)
}

func notify(ctx context.Context, deps Deps, key cell.Key, applied cell.Applied) {
	if deps.Alerts == nil || deps.Sender == nil || !applied.Written {
		return
	}
	if applied.SellChanged && applied.HasSell {
		deliver(ctx, deps, key, "sell", applied.SellMin)
	}
	if applied.BuyChanged && applied.HasBuy {
		deliver(ctx, deps, key, "buy", applied.BuyMax)
	}
}

func deliver(ctx context.Context, deps Deps, key cell.Key, side string, price int) {
	hits, err := deps.Alerts.Due(ctx, key, side, price)
	if err != nil {
		deps.Logf("alert lookup failed for %s: %v", key.String(), err)
		return
	}
	for _, hit := range hits {
		if err := deps.Sender.Send(ctx, hit, key.City, key.Quality, key.Enchantment, price); err != nil {
			deps.Logf("alert send failed for %s: %v", hit.ID, err)
			continue
		}
		if err := deps.Alerts.Remove(ctx, hit); err != nil {
			deps.Logf("alert remove failed for %s: %v", hit.ID, err)
		}
	}
}

func drain(deps Deps) {
	if deps.Orders == nil {
		return
	}
	for {
		select {
		case incoming, ok := <-deps.Orders:
			if !ok {
				return
			}
			handleOrder(context.Background(), deps, incoming)
		default:
			return
		}
	}
}

func dimensions(keys []cell.Key) (items []string, cities []string, qualities []int) {
	seenItem := map[string]bool{}
	seenCity := map[string]bool{}
	seenQuality := map[int]bool{}
	for _, key := range keys {
		if !seenItem[key.Item] {
			seenItem[key.Item] = true
			items = append(items, key.Item)
		}
		if !seenCity[key.City] {
			seenCity[key.City] = true
			cities = append(cities, key.City)
		}
		if !seenQuality[key.Quality] {
			seenQuality[key.Quality] = true
			qualities = append(qualities, key.Quality)
		}
	}
	return items, cities, qualities
}

func signal(done chan struct{}) {
	if done == nil {
		return
	}
	done <- struct{}{}
}
