package average

import "testing"

func TestNext(t *testing.T) {
	cases := []struct {
		name     string
		previous int
		price    int
		alpha    float64
		want     int
	}{
		{name: "first sample", previous: 0, price: 5000, alpha: 0.2, want: 5000},
		{name: "alpha 0.2 drop", previous: 5000, price: 4000, alpha: 0.2, want: 4800},
		{name: "same price stays", previous: 5000, price: 5000, alpha: 0.2, want: 5000},
		{name: "alpha 0.5 drop", previous: 5000, price: 4000, alpha: 0.5, want: 4500},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Next(tc.previous, tc.price, tc.alpha)
			if got != tc.want {
				t.Fatalf("got %d want %d", got, tc.want)
			}
		})
	}
}
