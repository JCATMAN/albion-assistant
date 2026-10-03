package alert

import (
	"context"
	"strconv"

	"github.com/redis/go-redis/v9"
)

// Book reads alerts the API stored and deletes one after Discord accepts it.
type Book struct {
	client *redis.Client
}

// NewBook uses the same Redis client as the price store.
func NewBook(client *redis.Client) *Book {
	return &Book{client: client}
}

// Due returns alerts on this cell whose target the price has crossed.
func (book *Book) Due(ctx context.Context, cellKey, side string, price int) ([]Alert, error) {
	ids, err := book.client.SMembers(ctx, IndexKey(cellKey)).Result()
	if err != nil {
		return nil, err
	}
	due := make([]Alert, 0)
	for _, id := range ids {
		values, err := book.client.HGetAll(ctx, RecordKey(id)).Result()
		if err != nil {
			return nil, err
		}
		if len(values) == 0 {
			_ = book.client.SRem(ctx, IndexKey(cellKey), id).Err()
			continue
		}
		item, ok := decode(id, values)
		if !ok || item.Side != side || !Crossed(side, item.Target, price) {
			continue
		}
		due = append(due, item)
	}
	return due, nil
}

// Remove deletes the hash, the cell index entry, and the per-user pointer.
func (book *Book) Remove(ctx context.Context, item Alert) error {
	cellKey := item.CellKey()
	pipe := book.client.TxPipeline()
	pipe.Del(ctx, RecordKey(item.ID))
	pipe.SRem(ctx, IndexKey(cellKey), item.ID)
	pipe.Del(ctx, OwnerKey(item.UserID, cellKey, item.Side))
	_, err := pipe.Exec(ctx)
	return err
}

func decode(id string, values map[string]string) (Alert, bool) {
	quality, qualityErr := strconv.Atoi(values["quality"])
	enchantment, enchantErr := strconv.Atoi(values["enchantment"])
	target, targetErr := strconv.Atoi(values["target"])
	if qualityErr != nil || enchantErr != nil || targetErr != nil {
		return Alert{}, false
	}
	if values["channel_id"] == "" || values["user_id"] == "" || values["item"] == "" || values["city"] == "" {
		return Alert{}, false
	}
	return Alert{
		ID:          id,
		Item:        values["item"],
		Name:        values["name"],
		City:        values["city"],
		Quality:     quality,
		Enchantment: enchantment,
		Side:        values["side"],
		Target:      target,
		ChannelID:   values["channel_id"],
		UserID:      values["user_id"],
	}, true
}
