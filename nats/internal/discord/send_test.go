package discord

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"albion-assistant/nats/internal/alert"
)

func TestSendPostsTheMentionWithTheBotToken(t *testing.T) {
	var gotAuth string
	var gotBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		payload, _ := io.ReadAll(r.Body)
		gotBody = string(payload)
		if r.URL.Path != "/channels/100/messages" {
			t.Errorf("path %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)

	sender := &Sender{Token: "secret-token", HTTP: server.Client(), Base: server.URL}
	err := sender.Send(context.Background(), alert.Alert{
		ID: "abc", Item: "T4_BAG", Name: "Bolsa", City: "*",
		AnyQuality: true, AnyEnchantment: true, Side: "sell", Target: 13000,
		ChannelID: "100", UserID: "42",
	}, "Martlock", 1, 0, 12000)
	if err != nil {
		t.Fatal(err)
	}
	if gotAuth != "Bot secret-token" {
		t.Fatalf("auth %s", gotAuth)
	}
	var decoded struct {
		Content string `json:"content"`
	}
	if err := json.Unmarshal([]byte(gotBody), &decoded); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(decoded.Content, "<@42>") || !strings.Contains(decoded.Content, "12.000") {
		t.Fatalf("content %s", decoded.Content)
	}
}

func TestSendKeepsTheErrorWhenDiscordRejects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "missing access", http.StatusForbidden)
	}))
	t.Cleanup(server.Close)
	sender := &Sender{Token: "secret-token", HTTP: server.Client(), Base: server.URL}
	err := sender.Send(context.Background(), alert.Alert{
		ID: "abc", ChannelID: "100", UserID: "42", Side: "sell", Target: 1, City: "Martlock", Item: "T4_BAG",
	}, "Martlock", 1, 0, 1)
	if err == nil || !strings.Contains(err.Error(), "403") {
		t.Fatalf("%v", err)
	}
}
