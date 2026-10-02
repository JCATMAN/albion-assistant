package location

import (
	"regexp"
	"strings"
)

// Canonical Americas cities, in the same order the API returns when no city filter is set.
func All() []string {
	return []string{
		"Thetford",
		"Lymhurst",
		"Bridgewatch",
		"Black Market",
		"Caerleon",
		"Martlock",
		"Fort Sterling",
		"Brecilien",
	}
}

var markets = map[int]string{
	7:    "Thetford",
	1002: "Lymhurst",
	2004: "Bridgewatch",
	3003: "Black Market",
	3005: "Caerleon",
	3008: "Martlock",
	4002: "Fort Sterling",
	5003: "Brecilien",
}

var portals = map[int]int{
	301:  7,
	1301: 1002,
	2301: 2004,
	3301: 3008,
	4301: 4002,
}

// City maps a market or portal id to the canonical city name. ok is false for every other location.
func City(id int) (string, bool) {
	if target, isPortal := portals[id]; isPortal {
		id = target
	}
	city, ok := markets[id]
	return city, ok
}

// CityPattern is the alternation used to parse a Redis key back into a city name.
func CityPattern() string {
	quoted := make([]string, len(All()))
	for i, city := range All() {
		quoted[i] = regexp.QuoteMeta(city)
	}
	return strings.Join(quoted, "|")
}
