package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"albion-assistant/nats/internal/albionapi"
	"albion-assistant/nats/internal/alert"
	"albion-assistant/nats/internal/app"
	"albion-assistant/nats/internal/config"
	"albion-assistant/nats/internal/conn"
	"albion-assistant/nats/internal/discord"
	"albion-assistant/nats/internal/order"
	"albion-assistant/nats/internal/store"
)

func main() {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	options, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis url: %v", err)
	}
	redisClient := redis.NewClient(options)
	defer func() { _ = redisClient.Close() }()
	pingCtx, cancelPing := context.WithTimeout(ctx, 5*time.Second)
	pingErr := redisClient.Ping(pingCtx).Err()
	cancelPing()
	if pingErr != nil {
		log.Printf("redis ping failed: %v", pingErr)
	} else {
		log.Printf("redis ping ok")
	}

	subscriber, err := conn.Dial(cfg.NatsURL)
	if err != nil {
		log.Fatalf("nats: %v", err)
	}
	defer subscriber.Close()
	subscriber.SetLog(log.Printf)

	orders := make(chan order.Order, 1024)
	if err := subscriber.Subscribe(cfg.NatsSubject, orders); err != nil {
		log.Fatalf("subscribe: %v", err)
	}

	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	var sender app.AlertSender
	if cfg.DiscordToken == "" {
		log.Printf("discord alerts disabled: DISCORD_TOKEN is empty")
	} else {
		sender = discord.New(cfg.DiscordToken)
	}

	err = app.Run(ctx, app.Deps{
		Orders:     orders,
		Store:      store.New(redisClient, cfg.CellTTL, cfg.AvgAlpha),
		Prices:     albionapi.New(cfg.AlbionAPIBase, cfg.APIRatePerMin, nil, nil),
		Alive:      subscriber.Alive,
		Tick:       ticker.C,
		StaleAfter: cfg.StaleAfter,
		WatchItems: cfg.WatchItems,
		Now:        time.Now,
		Logf:       log.Printf,
		Alerts:     alert.NewBook(redisClient),
		Sender:     sender,
	})
	if err != nil {
		log.Fatalf("writer stopped: %v", err)
	}
}
