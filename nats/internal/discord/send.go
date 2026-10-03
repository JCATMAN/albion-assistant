package discord

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"albion-assistant/nats/internal/alert"
)

// Sender posts one channel message with the bot token.
type Sender struct {
	Token string
	HTTP  *http.Client
	Base  string
}

// New posts to the public Discord API.
func New(token string) *Sender {
	return &Sender{
		Token: strings.TrimSpace(token),
		HTTP:  &http.Client{Timeout: 5 * time.Second},
		Base:  "https://discord.com/api/v10",
	}
}

// Send publishes the alert. A non-2xx response leaves the alert in Redis for a later price change.
func (sender *Sender) Send(ctx context.Context, item alert.Alert, city string, quality, enchantment, price int) error {
	if sender.Token == "" {
		return fmt.Errorf("DISCORD_TOKEN is empty")
	}
	if !digits(item.ChannelID) || !digits(item.UserID) {
		return fmt.Errorf("alert %s has a channel or user that is not a snowflake", item.ID)
	}
	payload, err := json.Marshal(map[string]string{
		"content": alert.Content(item, city, quality, enchantment, price),
	})
	if err != nil {
		return err
	}
	endpoint := strings.TrimRight(sender.Base, "/") + "/channels/" + url.PathEscape(item.ChannelID) + "/messages"
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bot "+sender.Token)
	request.Header.Set("Content-Type", "application/json")
	response, err := sender.HTTP.Do(request)
	if err != nil {
		return err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 300))
		return fmt.Errorf("discord message HTTP %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func digits(value string) bool {
	if value == "" {
		return false
	}
	for _, char := range value {
		if char < '0' || char > '9' {
			return false
		}
	}
	return true
}
