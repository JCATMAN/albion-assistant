package conn

import (
	"sync/atomic"
	"time"

	"github.com/nats-io/nats.go"

	"albion-assistant/nats/internal/order"
)

// Subscriber keeps a reconnecting NATS connection and a liveness flag.
type Subscriber struct {
	connection *nats.Conn
	alive      atomic.Bool
	invalid    atomic.Int64
	logf       func(string, ...any)
}

// Dial opens the Americas NATS server and keeps retrying if it is down.
func Dial(url string) (*Subscriber, error) {
	subscriber := &Subscriber{logf: func(string, ...any) {}}
	connection, err := nats.Connect(
		url,
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2*time.Second),
		nats.ConnectHandler(func(*nats.Conn) { subscriber.alive.Store(true) }),
		nats.DisconnectErrHandler(func(*nats.Conn, error) { subscriber.alive.Store(false) }),
		nats.ReconnectHandler(func(*nats.Conn) { subscriber.alive.Store(true) }),
	)
	if err != nil {
		return nil, err
	}
	subscriber.connection = connection
	return subscriber, nil
}

// SetLog receives one line per discarded payload.
func (subscriber *Subscriber) SetLog(logf func(string, ...any)) {
	if logf != nil {
		subscriber.logf = logf
	}
}

// Alive reports whether the client currently has a NATS connection.
func (subscriber *Subscriber) Alive() bool {
	return subscriber.alive.Load()
}

// Subscribe pushes parsed orders to out. A bad payload is counted and does not close the subscription.
func (subscriber *Subscriber) Subscribe(subject string, out chan<- order.Order) error {
	_, err := subscriber.connection.Subscribe(subject, func(msg *nats.Msg) {
		if handleErr := Handle(msg.Data, out, time.Now()); handleErr != nil {
			subscriber.invalid.Add(1)
			subscriber.logf("invalid market order: %v", handleErr)
		}
	})
	return err
}

// Close drains the client.
func (subscriber *Subscriber) Close() {
	if subscriber.connection != nil {
		_ = subscriber.connection.Drain()
	}
}

// Handle parses one payload and pushes it when the order is usable.
func Handle(body []byte, out chan<- order.Order, now time.Time) error {
	parsed, ok, err := order.Parse(body, now)
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}
	out <- parsed
	return nil
}
