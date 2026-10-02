package config

import (
	"strings"
	"testing"
	"time"
)

func validEnv() map[string]string {
	return map[string]string{
		"NATS_URL":        "nats://public:thenewalbiondata@nats.albion-online-data.com:4222",
		"ALBION_API_BASE": "https://west.albion-online-data.com",
		"REDIS_URL":       "redis://:clave@host.docker.internal:6379/0",
	}
}

func getenvFrom(values map[string]string) func(string) string {
	return func(key string) string {
		return values[key]
	}
}

func TestLoadMinimalSetsDefaults(t *testing.T) {
	cfg, err := Load(getenvFrom(validEnv()))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.NatsSubject != "marketorders.deduped" {
		t.Fatalf("subject %q", cfg.NatsSubject)
	}
	if cfg.CellTTL != 2*time.Hour {
		t.Fatalf("ttl %s", cfg.CellTTL)
	}
	if cfg.StaleAfter != 30*time.Minute {
		t.Fatalf("stale %s", cfg.StaleAfter)
	}
	if cfg.AvgAlpha != 0.2 {
		t.Fatalf("alpha %v", cfg.AvgAlpha)
	}
	if cfg.APIRatePerMin != 150 {
		t.Fatalf("rate %d", cfg.APIRatePerMin)
	}
	if len(cfg.WatchItems) != 0 {
		t.Fatalf("watch %#v", cfg.WatchItems)
	}
}

func TestLoadMissingRequired(t *testing.T) {
	for _, name := range []string{"NATS_URL", "ALBION_API_BASE", "REDIS_URL"} {
		t.Run(name, func(t *testing.T) {
			env := validEnv()
			delete(env, name)
			cfg, err := Load(getenvFrom(env))
			if err == nil || !strings.Contains(err.Error(), name) {
				t.Fatalf("err %v", err)
			}
			if cfg.NatsURL != "" || cfg.RedisURL != "" || cfg.AlbionAPIBase != "" {
				t.Fatalf("partial config %#v", cfg)
			}
		})
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	cases := []struct {
		name  string
		key   string
		value string
	}{
		{name: "cell ttl", key: "CELL_TTL", value: "nope"},
		{name: "rate above cap", key: "API_RATE_PER_MIN", value: "181"},
		{name: "alpha zero", key: "AVG_ALPHA", value: "0"},
		{name: "alpha above one", key: "AVG_ALPHA", value: "1.5"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			env := validEnv()
			env[tc.key] = tc.value
			cfg, err := Load(getenvFrom(env))
			if err == nil {
				t.Fatal("expected error")
			}
			if cfg.NatsURL != "" || cfg.RedisURL != "" || cfg.AlbionAPIBase != "" {
				t.Fatalf("partial config %#v", cfg)
			}
		})
	}
}

func TestLoadTrimsWatchItems(t *testing.T) {
	env := validEnv()
	env["WATCH_ITEMS"] = " T4_BAG , T5_BAG "
	cfg, err := Load(getenvFrom(env))
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.WatchItems) != 2 || cfg.WatchItems[0] != "T4_BAG" || cfg.WatchItems[1] != "T5_BAG" {
		t.Fatalf("%#v", cfg.WatchItems)
	}
}
