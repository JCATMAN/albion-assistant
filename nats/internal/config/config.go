package config

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

const (
	defaultSubject       = "marketorders.deduped"
	defaultCellTTL       = 2 * time.Hour
	defaultStaleAfter    = 30 * time.Minute
	defaultAverageAlpha  = 0.2
	defaultAPIRatePerMin = 150
	maxAPIRatePerMin     = 180
)

// Config is everything the writer needs from the environment.
type Config struct {
	NatsURL       string
	NatsSubject   string
	AlbionAPIBase string
	RedisURL      string
	CellTTL       time.Duration
	StaleAfter    time.Duration
	AvgAlpha      float64
	WatchItems    []string
	APIRatePerMin int
	DiscordToken  string
}

// Load reads configuration through getenv. A missing required variable returns an error and a zero Config.
func Load(getenv func(string) string) (Config, error) {
	loaded, err := parse(getenv)
	if err != nil {
		return Config{}, err
	}
	return loaded, nil
}

func parse(getenv func(string) string) (Config, error) {
	natsURL, err := required(getenv, "NATS_URL")
	if err != nil {
		return Config{}, err
	}
	apiBase, err := required(getenv, "ALBION_API_BASE")
	if err != nil {
		return Config{}, err
	}
	redisURL, err := required(getenv, "REDIS_URL")
	if err != nil {
		return Config{}, err
	}

	subject := strings.TrimSpace(getenv("NATS_SUBJECT"))
	if subject == "" {
		subject = defaultSubject
	}
	cellTTL, err := durationOr(getenv, "CELL_TTL", defaultCellTTL)
	if err != nil {
		return Config{}, err
	}
	staleAfter, err := durationOr(getenv, "STALE_AFTER", defaultStaleAfter)
	if err != nil {
		return Config{}, err
	}
	alpha, err := alphaOr(getenv("AVG_ALPHA"))
	if err != nil {
		return Config{}, err
	}
	rate, err := rateOr(getenv("API_RATE_PER_MIN"))
	if err != nil {
		return Config{}, err
	}

	return Config{
		NatsURL:       natsURL,
		NatsSubject:   subject,
		AlbionAPIBase: apiBase,
		RedisURL:      redisURL,
		CellTTL:       cellTTL,
		StaleAfter:    staleAfter,
		AvgAlpha:      alpha,
		WatchItems:    splitList(getenv("WATCH_ITEMS")),
		APIRatePerMin: rate,
		DiscordToken:  strings.TrimSpace(getenv("DISCORD_TOKEN")),
	}, nil
}

func required(getenv func(string) string, name string) (string, error) {
	value := strings.TrimSpace(getenv(name))
	if value == "" {
		return "", fmt.Errorf("%s is required", name)
	}
	return value, nil
}

func durationOr(getenv func(string) string, name string, fallback time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(getenv(name))
	if raw == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(raw)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("%s is invalid", name)
	}
	return parsed, nil
}

func alphaOr(raw string) (float64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return defaultAverageAlpha, nil
	}
	parsed, err := strconv.ParseFloat(raw, 64)
	if err != nil || parsed <= 0 || parsed > 1 {
		return 0, fmt.Errorf("AVG_ALPHA is invalid")
	}
	return parsed, nil
}

func rateOr(raw string) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return defaultAPIRatePerMin, nil
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 1 || parsed > maxAPIRatePerMin {
		return 0, fmt.Errorf("API_RATE_PER_MIN is invalid")
	}
	return parsed, nil
}

func splitList(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}
