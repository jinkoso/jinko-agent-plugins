# Flights — discovery and live search

Five tools. Four read Jinko's price cache (`find_destination`, `flight_calendar`, `find_dates`,
`price_monitoring`); one hits live pricing (`flight_search`). `find_dates` takes `flight_calendar`'s inputs and answers like it; the calendar rules here
apply to it. Which one to call first is decided in
[SKILL.md › Which tool first](../SKILL.md#which-tool-first) and is not repeated here.

## Cached prices are indicative — confirm live before presenting a bookable fare

`flight_calendar`, `find_dates` and `price_monitoring` return fares from Jinko's price cache. Even at the
highest-confidence cache age their price accuracy is roughly 80%. Use them to identify good candidate
dates and routes, then ALWAYS re-run live shopping to confirm the price before you present a fare as
bookable or add it to a trip:

- `flight_search` with `price_check` and the `offer_token` the cached result carried, or
- `flight_search` with `search` on the exact dates the user picked.

Present cached figures to the user as indicative ("from about …"), never as the bookable price, and
`flight_calendar` / `find_dates` / `find_destination` / `price_monitoring` figures as a price for one
adult ("from about … per adult"), never as the confirmed party total.
For a cached fare from any of these four tools, multiply by the number of adults before quoting a
total, and label it an estimate until `flight_search` prices the real party.

For these cached tools' `max_total` / `max_price`, divide a whole-trip budget by the number of
adults only and treat it as a loose pre-filter: children and lap infants usually cost less than an
adult. The exact whole-trip check is `flight_search`'s `max_price`, which covers all passengers;
send the user's whole-trip budget there unchanged. For a per-person budget, send it as-is to the
cached tools and multiply it by the number of travellers for `flight_search`'s `max_price`.

## Dates and airport codes (flight_calendar)

- All dates in query parameters (`departure_dates`, `departure_date_ranges`, `return_dates`,
  `return_date_ranges`) must be today or in the future; never use past dates.
- Origin and destination: the IATA city code when the user named a city (PAR, NYC, LON), the IATA
  airport code when they named an airport (CDG, JFK, LHR). An untyped code follows one platform
  rule: a code that names a multi-airport city is searched as the city; every other code is
  searched as the airport. `LAX`, `MIA` and `LAS` are both a city code and that city's main
  airport, so untyped they are the city — see [places.md › Codes on the discovery
  tools](places.md#codes-on-the-discovery-tools).
- `flight_calendar`: `trip_type` is REQUIRED — always send it; a call without it is rejected. Send
  `trip_type="roundtrip"` unless the user explicitly asked for a one-way trip, and `"oneway"` only
  then. This does NOT apply to `flight_search` — there `trip_type` is optional and no return date
  means a one-way search; see its section.
- Relative windows ("4–6 weeks out", "next month", "in the next few months") become a
  `departure_date_ranges` window computed from today's date, never a date a year ahead.
- With a known route and loose or absent dates, call `flight_calendar` without asking for dates:
  map a loose window ("late December", "Christmas", "June–July school holidays") to covering
  `departure_date_ranges`; with a stay length but no dates, send `stay_days` (or `stay_days_range`)
  AND `departure_date_ranges` from today through today + 90 days; with neither dates nor a stay
  length, send that same 90-day window and tell the user the window searched.
- When nearby dates are requested ("±2 days", "flexible by a few days"), send a `flight_calendar`
  window around the date, then run the live stage under SKILL.md's `next` / rule 3 guidance;
  never ask which exact day.
  "Around X" or "flexible" with no number means ±3 days; for ±N days around X, the
  window is X−N to X+N, never the anchor date alone (keep dates today or later).
  For a price monitor on a flexible window, explain that `price_monitoring` takes one exact
  date and offer `flight_calendar` for the window.
- A region with two paired airports ("Puglia": BRI and BDS) means search both, using two calls or
  a city code covering both, without asking which airport.
- Send `departure_date_ranges` as `[{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }]`, with keys
  `start` / `end`, not `start_date` / `from`.
- `stay_days` is an integer; a range uses `stay_days_range: { "min": n, "max": m }`.
  When the user explicitly asked for a round trip but gave neither a return date nor a stay
  length, ask for the stay length, or search one-way and say so — never price a next-day
  return / 1-day round trip the user did not ask for.
- Fill as many search parameters as possible from the user's intent to get the best results.

Worked example: if today is 2026-09-26, "Paris to Rome, 4–6 weeks out, for 5–7 nights" becomes:

```json
{
  "origin": "PAR",
  "destination": "ROM",
  "trip_type": "roundtrip",
  "departure_date_ranges": [{ "start": "2026-10-24", "end": "2026-11-07" }],
  "stay_days_range": { "min": 5, "max": 7 }
}
```

Per-tool differences: `find_destination` takes airport or city codes (see below);
`price_monitoring` prefers city codes and pins to an airport only when the user committed to one.

## find_destination

Discover travel destinations accessible from your departure airports. Search globally or filter to
specific regions. Returns destinations sorted by cheapest available flight.

- Airport or city codes. A code that names a multi-airport city (`NYC`, `LON`, `PAR` — and `LAX`,
  `MIA`, `LAS`, which a city shares with its main airport) covers every airport of that city; any other
  code is that one airport. Include all nearby airports (e.g. `["JFK", "LGA", "EWR"]` for New York).
- Next step: `next` supplies the `flight_calendar` calls for the best destinations to get specific
  flights with `offer_token`s for pricing.

## flight_calendar

Search flights between a known origin and destination using cached pricing. Use it whenever the user
specifies BOTH where they are flying FROM and where they are flying TO.

- Supports loose / flexible dates: single dates, date arrays, date ranges, `stay_days`.
- Also the right tool for "cheapest flight", "best flight", "find me a flight", "cheapest date"
  phrasings — it returns the cheapest cached itineraries.
- A short list of the best dates: set `limit`. The cheapest options on one given date: send
  `departure_dates` with that one date.
- Its filter set is small. When the user also asked for a filter it does not take, the calendar only
  picks the dates — see [SKILL.md › Which tool first](../SKILL.md#which-tool-first), rule 3; follow the calendar's `next` exactly as [SKILL.md › Which tool first](../SKILL.md#which-tool-first) (**Follow `next`**) says.

Route search:

- Use exact 3-letter IATA airport codes or an IATA city code for both origin and destination.
- Date ranges OR a stay duration for flexible trip planning.
- Natural trip duration (`stay_days`) instead of exact return dates.

Use cases:

- "Find flights from JFK to CDG next month" — specific route with a date range
- "Fly from Los Angeles to Tokyo for a week in December" — uses `departure_date` + `stay_days`
- "Paris to Barcelona for a weekend in April" — specific route
- "Cheapest flight from ORD to LHR under $600" — specific route with a budget
- "Direct flight in business class from New York to London" — specific route with preferences

Flow: `flight_calendar` → `flight_search` (the calendar's `next` supplies the `price_check` / `search` hand-off) → `trip` → `checkout`.

## price_monitoring

Cache-only flight price snapshot for a fixed origin/destination + dates pair. Intended for scheduled
polling — NOT for one-shot shopping or booking.

When to use:

- Track the price of a specific route + dates over time and react when it drops (cron / scheduled
  job).
- Recommended cadence: poll no faster than the cache refresh interval. Polling faster is wasted work.
- It requires an exact `departure_date` (+ optional exact `return_date`); flexible dates or ranges
  belong to `flight_calendar` / `find_destination`, and a user who has not committed to a specific
  route is still exploring. A user ready to book NOW, or one-shot exploration you will not come back
  to, belongs to `flight_search`.

What it returns:

- The single cheapest cached itinerary matching the request filters (lowest WITHIN the filter
  constraints — filters constrain the candidate set, not the win condition).
- An `offer_token` that remains re-shoppable via `flight_search` (`price_check` mode) when the user
  decides to book.
- `status`: `"ok"` (offer present) or `"stale"` (cache had no matching itinerary — retry later, or
  call `flight_search` for a live quote).

Cache-only contract: this tool NEVER triggers a live connector call. `status: "stale"` is the correct
response when the cache is cold — do not retry in a tight loop and do not silently fall back to
`flight_search`. A stale answer's `next` is the live search to offer, never to run silently.

Explicit exception to the silent-fallback prohibition: when the user states a constraint monitoring
cannot apply (such as `max_stops` above 0, a time-of-day window or a party larger than one adult), run
monitoring AND one `flight_search` on the same dates with the full filter set, and say which result
honours the constraint; this companion search applies whether monitoring returns `"ok"` or `"stale"`.

Input notes:

- Monitoring supports only exact dates, `cabin_class`, `direct_only`, carriers and a one-adult
  `max_price` cap.
- Origin / destination: the city code when the user named a city (PAR, NYC, LON); `origin_type` /
  `destination_type` `"airport"` when they named an airport. Untyped, a multi-airport city code is
  the city and any other code is the airport; `LAX`, `MIA` and `LAS` count as cities.
- Use the SAME filter set the user has been monitoring against between polls.
- `max_price` caps a ONE-ADULT fare, and the price returned is one adult's too: divide a whole-trip
  budget by the number of adults only as a loose pre-filter, or send a per-person budget as-is.
  Confirm the whole-trip budget with `flight_search`'s `max_price` as described above.
  `traveler_counts` does not change the price, the `max_price` cap, or anything in the response;
  price and cap are for one adult. The response carries no booking link.

Result hints (attached to every result): on `"stale"` — "Cache had no matching itinerary for this
poll. Retry later, or call flight_search if a live quote is needed right now."; on `"ok"` — "Cheapest
cached itinerary matching the request filters. offer_token is re-shoppable via flight_search
(price_check mode) when ready to book."

## flight_search

Get live flight pricing and fare options. Provide exactly one of the `search` or `price_check` nested
objects. IMPORTANT: they are nested objects, not string values — do NOT pass them as strings.

### 1. `search` — live flight search by route and dates

Example: `{ "search": { "origin": "PAR", "destination": "NYC", "departure_date": "2027-06-01" } }`

Required fields: `origin`, `destination`, `departure_date`.

`trip_type` is optional and is derived from `return_date` when omitted: a departure date with no return
date is a one-way search — run it; do not ask whether the trip is round trip. Send `return_date` (with
`trip_type="roundtrip"`) only when the user gave a return date or asked for a round trip.

Optional filters: `return_date`, `trip_type`, `cabin_class`, `max_stops`, `multi_fare`, `max_price`,
`limit`, `include_carriers`, `exclude_carriers`, `single_carrier_only`, `departure_time_range`,
`arrival_time_range`, `return_departure_time_range`, `return_arrival_time_range`,
`connection_time_min_minutes`, `connection_time_max_minutes`, `max_total_duration_minutes`,
`refundable_only`, `changeable_only`, `checked_bag_included`, `via_airports`, `exclude_via_airports`,
`aircraft_types`, `origin_alternate_airports`, `destination_alternate_airports`, `nearby_airports`,
`same_connection_airport_only`, `same_origin_airport_only`, `same_turnaround_airport_only`,
`origin_type`, `destination_type`.

- `origin` / `destination`: the city code when the user named a city, the airport code when they
  named an airport. Untyped, a code that names a multi-airport city is searched as the city and any
  other code as the airport. `LAX`, `MIA` and `LAS` are both a city code and that city's main
  airport, so untyped they are the CITY, and the provider returns other airports of that city —
  untyped `LAX` returns Ontario (`ONT`) fares, often as the cheapest offers. When the user said
  "LAX", send `destination_type: "airport"`; when they said "Los Angeles", send `LAX` untyped.
  Read each offer's legs for the airports actually flown; the offer-level city code does not change.
- Always send `passengers` for the real party, on both `search` and `price_check` calls.
  It is one object of counts, never an array: `"passengers": { "adults": 2, "children": 1, "infants": 0 }`
  (children 2–11, infants under 2 on a lap; omitted keys default to 1 adult and 0).
  Travellers aged 12 or over count as `adults` (teenagers are adults for airfare).
  For "a family" or "N seats" without a breakdown, ask who travels (adults / children 2–11 /
  infants) before searching.
  When the user states a traveller count, carry exactly that count into the `flight_search`
  party on both `search` and `price_check` calls. A seat count covers adults and children
  only: lap infants under 2 have no seat and are added on top ("two seats for two adults and
  a lap infant" is `{ "adults": 2, "children": 0, "infants": 1 }`).
- When the user caps stops, send `max_stops` (0–2); `direct_only` is deprecated on `flight_search`,
  so send `max_stops: 0` for nonstop flights.
- When the user specifies a time-of-day window, send the corresponding `departure_time_range`,
  `arrival_time_range`, `return_departure_time_range` or `return_arrival_time_range` as
  `{ "earliest": "HH:MM", "latest": "HH:MM" }` in 24-hour time, with either key optional
  ("after 21h" → `{ "earliest": "21:00" }`).
- **A window belongs to the date it is attached to.** "4 August after 21:00 or 5 August" is two searches: 4 August with `departure_time_range: { "earliest": "21:00" }`, 5 August with no window. Never copy one date's window onto another date.
- **Time words map to fixed windows** (local time at the departure airport): early / early morning → `latest 09:00`; morning → `05:00–12:00`; midday / around noon → `11:00–14:00`; afternoon → `12:00–18:00`; evening / late / tonight / ce soir → `earliest 18:00` (tonight also means today's date); "no red-eye" → departure `05:00–22:00`; "arrive before X" → `arrival_time_range.latest X`.
  Apply the leg the user names ("early outbound" → outbound; "evening return" → `return_departure_time_range`).
- **A window stated for the trip applies to both legs** ("departures after 8 AM" on a round trip → `departure_time_range` and `return_departure_time_range`) unless the user names one leg.
- When the user gives a budget, send `max_price` as the whole-trip total for all passengers,
  together with `currency`.

Cabin intent applies only to this live `search` mode:

- When the user did not explicitly choose a cabin, omit `cabin_class` or send `null`. The upstream
  search defaults to economy, and the response keeps fares in every recognized
  cabin it returns; omission / `null` is not a hard economy filter.
- Only send `economy`, `premium_economy`, `business` or `first` when the user explicitly chose that
  cabin. This is an exact response filter: every returned fare's representative cabin matches the
  requested value. The representative cabin is the cabin on the longest flight segment, so a shorter
  feeder or connection may use another cabin. Fares with an empty or unrecognized representative
  cabin are dropped.
- This does not change `flight_calendar`, `price_monitoring` or `price_check` behavior.

Date flexibility: this call prices ONE exact date pair. "Give or take a day", open windows and date
ranges go to `flight_calendar` first; when the user also gave a filter that only this tool has, the
calendar picks the dates and this call answers — the sequence is
[SKILL.md › Which tool first](../SKILL.md#which-tool-first), rule 3; follow the calendar's `next` exactly as [SKILL.md › Which tool first](../SKILL.md#which-tool-first) (**Follow `next`**) says.

Use cached discovery to narrow to at most three live `flight_search` confirmations per request, following the live-search budget and its explicit-date and single-retry exceptions in [SKILL.md › Which tool first](../SKILL.md#which-tool-first).

### 2. `price_check` — live pricing for a specific deal from a discovery tool

Example: `{ "price_check": { "offer_token": "token_from_discovery" } }`

`price_check` may return status `"offer_unavailable"` when the selected offer no longer matches,
including its cabin; the same flight may still have other fares. Show any returned alternatives and
ask the user to choose. Do NOT book the original offer on `"offer_unavailable"`. A `price_check`
taken from a cached answer's `next` is the exception: run `flight_search` with `search` on that
entry's dates, as the non-empty calendar answer paragraph above says, without asking the user first.

### Response

- Each flight includes detailed segments, fare options with baggage / refund / change rules, and a
  `trip_item_token` per fare. Every fare also carries `refundable`, `changeable` and
  `checked_bag_included` booleans.
- Every filter that narrows the results (cabin, stops, price, airlines, times, connections, fare
  conditions, aircraft) is applied exactly as sent: no returned flight violates it, and the search is never
  widened (an `include_carriers` search returns those carriers only). Options that widen a search
  (alternate or nearby airports) are searched where the source supports them, and sources search at
  most 9 `via_airports` per leg. The result says nothing else about the filters.
- `origin_alternate_airports` / `destination_alternate_airports` are searched beside an airport or a
  city anchor: `origin` NYC with `["BOS"]` covers New York's airports and Boston. An alternate inside
  the city is redundant and harmless.
- A completed live `search` with no offers is successful. The public API returns HTTP `200` with
  `offers: []`, `result: "no_matches"` and an `instruction` in the body. Builder MCP returns
  successful structured content with `status: "empty"`, `reason: "no_matches"`, the same
  `instruction`, and `data.flights: []`. When the request sent a narrowing filter the instruction is
  "Search completed successfully, but no offers satisfied every filter sent: the filter combination is
  too restrictive for this route and dates. Ask the user which filter to relax before searching
  again." Otherwise it is "Search completed successfully, but no flights were found for this route
  and dates. Ask the user whether to try other dates or airports before searching again." Follow the
  instruction. Do not silently relax the cabin or any other filter, and do not treat this outcome as a
  system failure.
- If the live search cannot complete and has no eligible offers, HTTP `503` / MCP
  `error_code: "UPSTREAM_UNAVAILABLE"` means retry later with the same filters (respect
  `Retry-After` when supplied); HTTP `504` / MCP `error_code: "UPSTREAM_TIMEOUT"` means the provider
  timed out. Do not retry in a tight loop or change filters without the user's request.

The successful-empty contract above applies only to live `search`. It does not apply to cached
`flight_calendar`, `price_monitoring`, or `price_check`.

### Before you answer (flights)

1. Compare every live result of the session; name as cheapest the lowest fare that meets the user's stated filters across ALL dates and options searched, never only the last search.
2. A live `flight_search` or `price_check` result replaces the cached fare for that itinerary: never quote a cached price after a live check changed it or said it is unavailable.
3. When several dates or options were compared, report each one searched with its best live fare meeting the user's filters, or say it had none, distinguishing an empty live result from a failed or unperformed live check.
4. Quote only times, dates, durations and prices that appear in the tool results, except a cached one-adult fare multiplied for the party, which is quoted only when labelled as an estimate.

### Next step

Use the `trip` tool with `add_item` and the `trip_item_token` from the fare the user selects.

Flow: discovery (`flight_calendar` / `find_destination`) or direct search → `flight_search` → `trip` → `checkout`

Passengers: if a search fails, surface the error — never retry with a changed passenger list (e.g.
dropping an infant); that silently changes the user's request.
