package average

import "math"

// Next returns the next integer moving average in silver.
// A previous value of 0 is the first sample, so the average starts at price.
func Next(previous int, price int, alpha float64) int {
	if previous == 0 {
		return price
	}
	updated := float64(previous) + alpha*(float64(price)-float64(previous))
	return int(math.Round(updated))
}
