package alert

import (
	"fmt"
	"strconv"
	"strings"

	"albion-assistant/nats/internal/cell"
)

// Alert is one Discord watch stored by the API and consumed by the writer.
// A star city, or AnyQuality / AnyEnchantment, matches every value of that field.
type Alert struct {
	ID             string
	Item           string
	Name           string
	City           string
	Quality        int
	AnyQuality     bool
	Enchantment    int
	AnyEnchantment bool
	Side           string
	Target         int
	ChannelID      string
	UserID         string
}

// ItemIndex is the set of alert ids watching one base item, in any city.
func ItemIndex(item string) string {
	return "alerts:item:" + item
}

// RecordKey is the hash of one alert.
func RecordKey(id string) string {
	return "alert:" + id
}

// OwnerKey points at the single alert a user holds for one item and side.
func OwnerKey(userID, item, side string) string {
	return "alert-owner:" + userID + ":" + item + ":" + side
}

// Matches reports whether this watch applies to the cell whose price just changed.
func (item Alert) Matches(key cell.Key, side string, price int) bool {
	if item.Item != key.Item || item.Side != side || !Crossed(side, item.Target, price) {
		return false
	}
	if item.City != "*" && item.City != key.City {
		return false
	}
	if !item.AnyQuality && item.Quality != key.Quality {
		return false
	}
	if !item.AnyEnchantment && item.Enchantment != key.Enchantment {
		return false
	}
	return true
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

// Content is the channel message. City, quality, and enchantment are the cell that crossed.
func Content(item Alert, city string, quality, enchantment, price int) string {
	name := safeName(item.Name)
	if name == "" {
		name = item.Item
	}
	where := fmt.Sprintf("%s · %s · encantamiento %d", city, qualityName(quality), enchantment)
	switch item.Side {
	case "buy":
		return fmt.Sprintf(
			"<@%s> **%s** en %s: la compra subió a %s. Pediste %s o más.",
			item.UserID, name, where, silver(price), silver(item.Target),
		)
	default:
		return fmt.Sprintf(
			"<@%s> **%s** en %s: la venta bajó a %s. Pediste %s o menos.",
			item.UserID, name, where, silver(price), silver(item.Target),
		)
	}
}

func qualityName(quality int) string {
	names := []string{"", "Normal", "Buena", "Destacada", "Excelente", "Obra maestra"}
	if quality < 1 || quality >= len(names) {
		return "Normal"
	}
	return names[quality]
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
