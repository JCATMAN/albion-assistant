package cell

import (
	"fmt"
	"regexp"
	"strconv"
	"time"

	"albion-assistant/nats/internal/location"
	"albion-assistant/nats/internal/order"
)

const (
	// SourceNATS marks a cell written from a live order.
	SourceNATS = "nats"
	// SourceAPI marks a cell written from the West prices API.
	SourceAPI = "api"
)

// Key identifies one Americas market cell.
type Key struct {
	Item        string
	City        string
	Quality     int
	Enchantment int
}

// String returns the Redis key west:{item}:{city}:q{quality}:e{enchantment}.
func (key Key) String() string {
	return fmt.Sprintf("west:%s:%s:q%d:e%d", key.Item, key.City, key.Quality, key.Enchantment)
}

var keyPattern = regexp.MustCompile(`^west:(.+):(` + location.CityPattern() + `):q(\d+):e(\d+)$`)

// ParseKey reads a Redis key produced by Key.String. ok is false when the text is not one of ours.
func ParseKey(raw string) (Key, bool) {
	match := keyPattern.FindStringSubmatch(raw)
	if match == nil {
		return Key{}, false
	}
	quality, qualityErr := strconv.Atoi(match[3])
	enchantment, enchantErr := strconv.Atoi(match[4])
	if qualityErr != nil || enchantErr != nil {
		return Key{}, false
	}
	return Key{
		Item:        match[1],
		City:        match[2],
		Quality:     quality,
		Enchantment: enchantment,
	}, true
}

// Snapshot is the stored book for one cell.
type Snapshot struct {
	SellMin       int
	SellAmount    int
	SellAvg       int
	BuyMax        int
	BuyAmount     int
	BuyAvg        int
	UpdatedAt     time.Time
	Source        string
	HasSell       bool
	HasBuy        bool
	HasSellAmount bool
	HasBuyAmount  bool
}

// Update is a write request. Nil amounts keep the amount already stored.
type Update struct {
	Key        Key
	SellMin    *int
	SellAmount *int
	BuyMax     *int
	BuyAmount  *int
	UpdatedAt  time.Time
	Source     string
}

// Decision says whether a fold should be persisted and which averages move.
type Decision struct {
	Write       bool
	SellChanged bool
	BuyChanged  bool
}

// Apply folds one NATS order into the previous snapshot.
// The bool is true only when the best price on that side changes.
func Apply(previous Snapshot, side order.Side, price int, amount int, at time.Time) (Snapshot, bool) {
	switch side {
	case order.SideSell:
		if previous.HasSell && price > previous.SellMin {
			return previous, false
		}
		next := previous
		next.UpdatedAt = at
		next.Source = SourceNATS
		next.HasSell = true
		next.SellMin = price
		next.HasSellAmount = true
		next.SellAmount = amount
		changed := !previous.HasSell || price != previous.SellMin
		return next, changed
	case order.SideBuy:
		if previous.HasBuy && price < previous.BuyMax {
			return previous, false
		}
		next := previous
		next.UpdatedAt = at
		next.Source = SourceNATS
		next.HasBuy = true
		next.BuyMax = price
		next.HasBuyAmount = true
		next.BuyAmount = amount
		changed := !previous.HasBuy || price != previous.BuyMax
		return next, changed
	default:
		return previous, false
	}
}

// Fold merges an update into the previous snapshot.
// NATS orders only improve the best price. API updates replace the side they carry, unless Redis is newer.
func Fold(previous Snapshot, update Update) (Snapshot, Decision) {
	if update.Source == SourceAPI {
		return foldAPI(previous, update)
	}
	return foldNATS(previous, update)
}

func foldNATS(previous Snapshot, update Update) (Snapshot, Decision) {
	next := previous
	decision := Decision{}
	if update.SellMin != nil && *update.SellMin > 0 {
		amount := 0
		if update.SellAmount != nil {
			amount = *update.SellAmount
		}
		updated, changed := Apply(next, order.SideSell, *update.SellMin, amount, update.UpdatedAt)
		if changed || updated != next {
			decision.Write = true
			decision.SellChanged = changed
			next = updated
		}
	}
	if update.BuyMax != nil && *update.BuyMax > 0 {
		amount := 0
		if update.BuyAmount != nil {
			amount = *update.BuyAmount
		}
		updated, changed := Apply(next, order.SideBuy, *update.BuyMax, amount, update.UpdatedAt)
		if changed || updated != next {
			decision.Write = true
			decision.BuyChanged = changed
			next = updated
		}
	}
	return next, decision
}

func foldAPI(previous Snapshot, update Update) (Snapshot, Decision) {
	if !previous.UpdatedAt.IsZero() && !update.UpdatedAt.After(previous.UpdatedAt) {
		return previous, Decision{}
	}
	next := previous
	decision := Decision{}
	if update.SellMin != nil && *update.SellMin > 0 {
		decision.SellChanged = !previous.HasSell || previous.SellMin != *update.SellMin
		next.HasSell = true
		next.SellMin = *update.SellMin
		decision.Write = true
	}
	if update.SellAmount != nil {
		next.HasSellAmount = true
		next.SellAmount = *update.SellAmount
	}
	if update.BuyMax != nil && *update.BuyMax > 0 {
		decision.BuyChanged = !previous.HasBuy || previous.BuyMax != *update.BuyMax
		next.HasBuy = true
		next.BuyMax = *update.BuyMax
		decision.Write = true
	}
	if update.BuyAmount != nil {
		next.HasBuyAmount = true
		next.BuyAmount = *update.BuyAmount
	}
	if !decision.Write {
		return previous, Decision{}
	}
	next.UpdatedAt = update.UpdatedAt
	next.Source = SourceAPI
	return next, decision
}

// SplitItemID separates T4_BAG@1 into the base id and enchantment 1.
func SplitItemID(itemID string) (string, int) {
	for i := len(itemID) - 1; i >= 0; i-- {
		if itemID[i] != '@' {
			continue
		}
		enchant, err := strconv.Atoi(itemID[i+1:])
		if err != nil || i == 0 {
			return itemID, 0
		}
		return itemID[:i], enchant
	}
	return itemID, 0
}
