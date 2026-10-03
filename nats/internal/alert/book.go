package alert

import (
	"context"
	"strconv"

	"github.com/redis/go-redis/v9"

	"albion-assistant/nats/internal/cell"
)

// Book reads alerts the API stored and deletes one after Discord accepts it.
type Book struct {
	client *redis.Client
}

// NewBook uses the same Redis client as the price store.
func NewBook(client *redis.Client) *Book {
	return &Book{client: client}
}

// Due returns alerts on this item whose filters and target the cell has crossed.
func (book *Book) Due(ctx context.Context, key cell.Key, side string, price int) ([]Alert, error) {
	ids, err := book.client.SMembers(ctx, ItemIndex(key.Item)).Result()
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
			_ = book.client.SRem(ctx, ItemIndex(key.Item), id).Err()
			continue
		}
		item, ok := decode(id, values)
		if !ok || !item.Matches(key, side, price) {
			continue
		}
		due = append(due, item)
	}
	return due, nil
}

// Remove deletes the hash, the item index entry, and the per-user pointer.
func (book *Book) Remove(ctx context.Context, item Alert) error {
	pipe := book.client.TxPipeline()
	pipe.Del(ctx, RecordKey(item.ID))
	pipe.SRem(ctx, ItemIndex(item.Item), item.ID)
	pipe.Del(ctx, OwnerKey(item.UserID, item.Item, item.Side))
	_, err := pipe.Exec(ctx)
	return err
}

func decode(id string, values map[string]string) (Alert, bool) {
	quality, anyQuality, qualityOK := optionalInt(values["quality"])
	enchantment, anyEnchantment, enchantOK := optionalInt(values["enchantment"])
	target, targetErr := strconv.Atoi(values["target"])
	if !qualityOK || !enchantOK || targetErr != nil {
		return Alert{}, false
	}
	if values["channel_id"] == "" || values["user_id"] == "" || values["item"] == "" || values["city"] == "" {
		return Alert{}, false
	}
	return Alert{
		ID:             id,
		Item:           values["item"],
		Name:           values["name"],
		City:           values["city"],
		Quality:        quality,
		AnyQuality:     anyQuality,
		Enchantment:    enchantment,
		AnyEnchantment: anyEnchantment,
		Side:           values["side"],
		Target:         target,
		ChannelID:      values["channel_id"],
		UserID:         values["user_id"],
	}, true
}

func optionalInt(raw string) (int, bool, bool) {
	if raw == "*" {
		return 0, true, true
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return 0, false, false
	}
	return parsed, false, true
}
