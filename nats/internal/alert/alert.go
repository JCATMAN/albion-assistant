package alert

import (
	"fmt"
	"strconv"
	"strings"

	"albion-assistant/nats/internal/cell"
)

// Alert is one Discord watch stored by the API and consumed by the writer.
type Alert struct {
	ID          string
	Item        string
	Name        string
	City        string
	Quality     int
	Enchantment int
	Side        string
	Target      int
	ChannelID   string
	UserID      string
}

// CellKey is the market hash this alert watches, prefixed for the alert index.
func (item Alert) CellKey() string {
	return cell.Key{
		Item:        item.Item,
		City:        item.City,
		Quality:     item.Quality,
		Enchantment: item.Enchantment,
	}.String()
}

// IndexKey is the set of alert ids for one market cell.
func IndexKey(cellKey string) string {
	return "alerts:" + cellKey
}

// RecordKey is the hash of one alert.
func RecordKey(id string) string {
	return "alert:" + id
}

// OwnerKey points at the single alert a user holds for one cell and side.
func OwnerKey(userID, cellKey, side string) string {
	return "alert-owner:" + userID + ":" + cellKey + ":" + side
}

// Crossed reports whether price meets the saved target. Sell fires at or below. Buy fires at or above.
func Crossed(side string, target, price int) bool {
	if target <= 0 || price <= 0 {
		return false
	}
	switch side {
	case "sell":
		return price <= target
	case "buy":
		return price >= target
	default:
		return false
	}
}

// Content is the channel message. The mention is only the stored user id.
func Content(item Alert, price int) string {
	name := safeName(item.Name)
	if name == "" {
		name = item.Item
	}
	switch item.Side {
	case "buy":
		return fmt.Sprintf(
			"<@%s> **%s** en %s: la compra subió a %s. Pediste %s o más.",
			item.UserID, name, item.City, silver(price), silver(item.Target),
		)
	default:
		return fmt.Sprintf(
			"<@%s> **%s** en %s: la venta bajó a %s. Pediste %s o menos.",
			item.UserID, name, item.City, silver(price), silver(item.Target),
		)
	}
}

func safeName(name string) string {
	return strings.TrimSpace(strings.NewReplacer("<", "", ">", "", "@", "").Replace(name))
}

func silver(value int) string {
	raw := strconv.Itoa(value)
	if len(raw) <= 3 {
		return raw
	}
	var grouped strings.Builder
	lead := len(raw) % 3
	if lead == 0 {
		lead = 3
	}
	grouped.WriteString(raw[:lead])
	for index := lead; index < len(raw); index += 3 {
		grouped.WriteByte('.')
		grouped.WriteString(raw[index : index+3])
	}
	return grouped.String()
}
