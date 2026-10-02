package location

import "testing"

func TestCityMarketsAndPortals(t *testing.T) {
	cases := []struct {
		id   int
		city string
	}{
		{id: 7, city: "Thetford"},
		{id: 1002, city: "Lymhurst"},
		{id: 2004, city: "Bridgewatch"},
		{id: 3003, city: "Black Market"},
		{id: 3005, city: "Caerleon"},
		{id: 3008, city: "Martlock"},
		{id: 4002, city: "Fort Sterling"},
		{id: 5003, city: "Brecilien"},
		{id: 301, city: "Thetford"},
		{id: 1301, city: "Lymhurst"},
		{id: 2301, city: "Bridgewatch"},
		{id: 3301, city: "Martlock"},
		{id: 4301, city: "Fort Sterling"},
	}
	for _, tc := range cases {
		got, ok := City(tc.id)
		if !ok || got != tc.city {
			t.Fatalf("id %d got %q ok %v", tc.id, got, ok)
		}
	}
}

func TestCityRejectsUnknownLocations(t *testing.T) {
	for _, id := range []int{4, 0} {
		if _, ok := City(id); ok {
			t.Fatalf("id %d was accepted", id)
		}
	}
}
