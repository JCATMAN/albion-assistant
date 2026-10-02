package store

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"albion-assistant/nats/internal/average"
	"albion-assistant/nats/internal/cell"
)

// RedisStore is the only writer of west: market hashes.
type RedisStore struct {
	client *redis.Client
	ttl    time.Duration
	alpha  float64
}

// New builds a store. ttl is renewed on every write. alpha feeds the moving average.
func New(client *redis.Client, ttl time.Duration, alpha float64) *RedisStore {
	return &RedisStore{client: client, ttl: ttl, alpha: alpha}
}

// Apply loads the cell, folds the update, and writes the hash when the book changes.
func (store *RedisStore) Apply(ctx context.Context, update cell.Update) error {
	if !hasPositive(update.SellMin) && !hasPositive(update.BuyMax) {
		return nil
	}
	previous, err := store.load(ctx, update.Key)
	if err != nil {
		return err
	}
	next, decision := cell.Fold(previous, update)
	if !decision.Write {
		return nil
	}
	if decision.SellChanged {
		base := 0
		if previous.HasSell {
			base = previous.SellAvg
		}
		next.SellAvg = average.Next(base, next.SellMin, store.alpha)
	}
	if decision.BuyChanged {
		base := 0
		if previous.HasBuy {
			base = previous.BuyAvg
		}
		next.BuyAvg = average.Next(base, next.BuyMax, store.alpha)
	}
	return store.save(ctx, update.Key, next, decision)
}

// Stale returns at most limit west cells whose updated_at is older than olderThan.
func (store *RedisStore) Stale(ctx context.Context, olderThan time.Time, limit int) ([]cell.Key, error) {
	if limit <= 0 {
		return nil, nil
	}
	found := make([]cell.Key, 0, limit)
	var cursor uint64
	for {
		keys, next, err := store.client.Scan(ctx, cursor, "west:*", 100).Result()
		if err != nil {
			return nil, err
		}
		for _, redisKey := range keys {
			parsed, ok := cell.ParseKey(redisKey)
			if !ok {
				continue
			}
			raw, err := store.client.HGet(ctx, redisKey, "updated_at").Result()
			if err == redis.Nil {
				found = append(found, parsed)
			} else if err != nil {
				return nil, err
			} else {
				seconds, convErr := strconv.ParseInt(raw, 10, 64)
				if convErr != nil {
					return nil, fmt.Errorf("updated_at: %w", convErr)
				}
				if time.Unix(seconds, 0).Before(olderThan) {
					found = append(found, parsed)
				}
			}
			if len(found) >= limit {
				return found, nil
			}
		}
		if next == 0 {
			break
		}
		cursor = next
	}
	return found, nil
}

func (store *RedisStore) load(ctx context.Context, key cell.Key) (cell.Snapshot, error) {
	values, err := store.client.HGetAll(ctx, key.String()).Result()
	if err != nil {
		return cell.Snapshot{}, err
	}
	if len(values) == 0 {
		return cell.Snapshot{}, nil
	}
	return snapshotFromHash(values)
}

func (store *RedisStore) save(ctx context.Context, key cell.Key, next cell.Snapshot, decision cell.Decision) error {
	fields := hashFields(next, decision)
	redisKey := key.String()
	args := make([]any, 0, len(fields)*2)
	for field, value := range fields {
		args = append(args, field, value)
	}
	pipe := store.client.TxPipeline()
	pipe.HSet(ctx, redisKey, args...)
	pipe.Expire(ctx, redisKey, store.ttl)
	_, err := pipe.Exec(ctx)
	return err
}

func hashFields(next cell.Snapshot, decision cell.Decision) map[string]string {
	fields := map[string]string{
		"updated_at": strconv.FormatInt(next.UpdatedAt.Unix(), 10),
		"source":     next.Source,
	}
	if next.HasSell {
		fields["sell_min"] = strconv.Itoa(next.SellMin)
	}
	if next.HasSellAmount {
		fields["sell_amount"] = strconv.Itoa(next.SellAmount)
	}
	if decision.SellChanged {
		fields["sell_avg"] = strconv.Itoa(next.SellAvg)
	}
	if next.HasBuy {
		fields["buy_max"] = strconv.Itoa(next.BuyMax)
	}
	if next.HasBuyAmount {
		fields["buy_amount"] = strconv.Itoa(next.BuyAmount)
	}
	if decision.BuyChanged {
		fields["buy_avg"] = strconv.Itoa(next.BuyAvg)
	}
	return fields
}

func snapshotFromHash(values map[string]string) (cell.Snapshot, error) {
	var snapshot cell.Snapshot
	var err error
	snapshot.HasSell, snapshot.SellMin, err = readInt(values, "sell_min")
	if err != nil {
		return cell.Snapshot{}, err
	}
	snapshot.HasSellAmount, snapshot.SellAmount, err = readInt(values, "sell_amount")
	if err != nil {
		return cell.Snapshot{}, err
	}
	if _, avg, avgErr := readInt(values, "sell_avg"); avgErr != nil {
		return cell.Snapshot{}, avgErr
	} else {
		snapshot.SellAvg = avg
	}
	snapshot.HasBuy, snapshot.BuyMax, err = readInt(values, "buy_max")
	if err != nil {
		return cell.Snapshot{}, err
	}
	snapshot.HasBuyAmount, snapshot.BuyAmount, err = readInt(values, "buy_amount")
	if err != nil {
		return cell.Snapshot{}, err
	}
	if _, avg, avgErr := readInt(values, "buy_avg"); avgErr != nil {
		return cell.Snapshot{}, avgErr
	} else {
		snapshot.BuyAvg = avg
	}
	if raw, ok := values["updated_at"]; ok {
		seconds, convErr := strconv.ParseInt(raw, 10, 64)
		if convErr != nil {
			return cell.Snapshot{}, fmt.Errorf("updated_at: %w", convErr)
		}
		snapshot.UpdatedAt = time.Unix(seconds, 0).UTC()
	}
	snapshot.Source = values["source"]
	return snapshot, nil
}

func readInt(values map[string]string, field string) (bool, int, error) {
	raw, ok := values[field]
	if !ok || raw == "" {
		return false, 0, nil
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return false, 0, fmt.Errorf("%s: %w", field, err)
	}
	return true, parsed, nil
}

func hasPositive(value *int) bool {
	return value != nil && *value > 0
}
