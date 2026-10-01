# Hotels — hotel_search and hotel_details

Hotel flow (from the server instructions): `hotel_search` → search by destination, dates and
occupancy, returns hotels with `htl_*` offer tokens → `hotel_details` for rich metadata on a single
hotel after the user picks one to look at more closely → `trip(add_item)` with the `htl_*` `offer_id`
→ add the hotel to the cart (works alongside flights in the same cart) → `upsert_travelers` →
`checkout`. The cart and checkout steps are in [booking.md](booking.md).

## hotel_search

Search live hotel inventory and rates. 10 credits per call.

### Required

- `destination`: object — two distinct modes. Mode A (rate lookup): `{ hotel_name (+ optional
  country_code, city_name) }` or `{ hotel_ids }`. Mode B (hotel search): `{ query }`,
  `{ city_name + country_code }`, `{ latitude + longitude (+ radius_km) }`, or `{ place_id }`.
- `checkin`, `checkout`: YYYY-MM-DD
- occupancy: either `{ occupancies: [{ adults, children_ages? }, ...] }` (one entry per room) OR the
  shorthand `{ adults, children?, rooms? }`

### Two modes — pick deliberately

MODE A (rate lookup — the user named a specific hotel):

- `{ hotel_name }`: free-text hotel name ("Hotel Calimala", "The St. Regis Rome", "Hôtel Costes"). The
  server fuzzy-matches against a 1.74M-hotel catalog. ALWAYS pair with `country_code` AND `city_name`
  when known — lookup precision drops sharply on common names without scope. Returns 422
  `HOTEL_NAME_LOW_CONFIDENCE` if no candidate scores ≥ 0.7; see the error handling below.
- `{ hotel_ids }`: re-shop a known set (from a prior search result).
- In Mode A: filters are ignored (the user named the property), and the response includes
  `nearby_alternatives` — up to 40 hotels within ~3 km of the matched property, in the same response
  shape so the user can compare.

MODE B (hotel search — the user is exploring a destination):

- `{ query }`: unambiguous cities or well-known POIs only ("Paris", "Times Square"). The provider AI
  search returns 0 for islands ("Menorca", "Santorini", "Mykonos"), regions ("Tuscany", "Provence",
  "Bavaria"), countries, archipelagos. Do NOT use `{ query }` for those.
- `{ city_name + country_code }`: when the user named a city, even if ambiguous. Best when the
  destination has a primary city ("Mahón, ES" for Menorca; "Florence, IT" for Tuscany). A misspelt
  city with no exact catalog match returns 422 `DESTINATION_LOW_CONFIDENCE` with candidates — see
  below — not an empty result.
  Spell the city as an English-language booking site would — "Munich"/"Florence"/"Rome"/"Vienna", not
  "München"/"Firenze"/"Roma"/"Wien" — but keep the local form where that **is** the international one
  ("Regensburg", "Nürnberg", "Lyon"), and never an archaic exonym ("Leghorn", "Ratisbon"). Translate
  for this field only; keep the user's own spelling when you talk back to them. The catalog stores one
  group per spelling and folds case, accents and hyphens but **not** translations, so the wrong form
  usually resolves to a near-empty duplicate group rather than failing — see "a small
  `catalog_hotel_count` is a resolution failure" below.
- `{ latitude + longitude + radius_km }`: when the destination is an area, island or region with no
  obvious primary city — **and as the fallback whenever a name-based search comes back empty**, for any
  place including an ordinary city. `radius_km` up to 50.
- `{ place_id }`: when you already have an upstream Place ID.
- If the user names something non-city (an island, region, archipelago, neighborhood), DO NOT pass it
  as `{ query }` — pick `{ city_name + country_code }` or `{ latitude + longitude + radius_km }`.

### Error handling — 422 `HOTEL_NAME_LOW_CONFIDENCE` (Mode A only)

When the `{ hotel_name }` fuzzy lookup finds no candidate ≥ 0.7, the response body is:

```json
{ "error": { "code": "HOTEL_NAME_LOW_CONFIDENCE", "message": "...",
             "top_candidates": [{ "hotel_id": "...", "name": "...", "city": "...", "score": 0.0 }],
             "suggested_retry": { "destination": { } } } }
```

This is ACTIONABLE, not fatal. Pick one:

1. The top candidate matches what the user meant (typo / spelling) → confirm with the user, then
   retry with `{ hotel_ids: ["<top.hotel_id>"] }`.
2. None of the candidates fit → ask the user "I couldn't pin down 'X' — want me to search all hotels
   in <city> instead?", then retry with `suggested_retry.destination`.
3. The user likely meant a different city → ask to clarify, then retry `hotel_name` with a corrected
   `country_code` / `city_name`.

Don't silently auto-pick a low-confidence candidate — booking the wrong hotel is worse than asking one
clarifying question. (The error body also carries a `next_step` field restating these three options.)

### Error handling — 422 `DESTINATION_LOW_CONFIDENCE` (Mode B `city_name`)

When `{ city_name + country_code }` has no exact catalog group but has close trigram candidates and
none is a clear winner, the response body is:

```json
{ "error": { "code": "DESTINATION_LOW_CONFIDENCE", "message": "...",
             "top_candidates": [{ "city": "...", "country_code": "...", "hotel_count": 0,
                                   "score": 0.0 }],
             "suggested_retry": { "destination": { "city_name": "...", "country_code": "..." },
                                   "rationale": "..." } } }
```

`top_candidates` is ordered by score desc, at most 5, score in `[0, 1]`. Retrying with a candidate's
`city_name` + `country_code` resolves EXACTLY — the candidate city is the group's canonical label.

Pick one, same three-way shape as `HOTEL_NAME_LOW_CONFIDENCE`:

1. The top candidate is the user's typo → confirm with the user, then retry with
   `{ city_name: top.city, country_code: top.country_code }`.
2. Several candidates fit → ask the user which.
3. None fit → ask the user to confirm the place, or search by
   `{ latitude + longitude + radius_km }`.

Don't silently auto-pick a candidate, and never say the city has no hotels — that's what an unknown
city with no candidates looks like (still 200, `hotels: []`, `empty_reason`, unchanged from JIN-2245).
Replaces the old workaround of retrying spelling variants by hand (JIN-2310).

### Error handling — an empty Mode B result is NOT an answer

A destination search that returns `hotels: []` with `status: "success"` is a signal to retry, never a
fact to relay. **Never tell a user "there are no hotels in X"** on the strength of one empty Mode B
response — the catalog splits some cities across spellings, and a sold-out night looks identical to a
destination that never resolved.

The response says which it is. Read `empty_reason`, and `destination_resolution` for what was actually
searched (`resolved_city`, `catalog_hotel_count`, `radius_km`):

- `no_availability_for_dates` — the destination is fine; these dates are the constraint. Say so, naming
  `destination_resolution.resolved_city` and `catalog_hotel_count` ("all 193 properties in Saint-Malo
  are taken that night"). Then offer: other dates, or relax `min_rating` / `min_star_rating` /
  `max_budget_per_night`, or a larger `radius_km`. Sanity-check `catalog_hotel_count` first, though —
  it counts the matched group alone, so a wrong-spelling match reports a sold-out city that in fact has
  thousands of free rooms (see below).
- `destination_not_found` — nothing matched. Other dates cannot help. Retry with
  `{ latitude + longitude + radius_km }` for the place you mean; coordinates are not only for islands
  and regions, they are the reliable fallback for any place a name failed to reach. Ask the user to
  confirm the place before assuming it does not exist.
- `no_catalog_match` — the catalog search came back empty, but it carried **filters as well as** the
  destination, so which of the two emptied it is not knowable. It also sends **no dates**, so it says
  nothing about availability. Relax or drop the filters first — `min_rating` defaults to **7.0** and is
  applied even when you never set it, so a place whose properties are all rated below that answers
  empty. Only then re-aim the destination. Never report this as "no hotels in X".
- `catalog_exhausted` — you paged past the end. Page back, not deeper.
- `all_dropped_by_budget` — `budget_filter` carries the detail; report the cheapest seen and offer to
  raise the budget.
- `all_dropped_by_star_filter` — the destination matched properties and the star filter removed all of
  them. Neither the destination nor the dates are the constraint: offer to widen `min_star_rating` /
  `max_star_rating`. Note the filter also drops properties whose star rating is missing upstream, so a
  strict range can empty a page on a metadata gap rather than a real mismatch.

#### A small `catalog_hotel_count` is a resolution failure, not a small city

`match: "exact"` only means your string equalled some catalog group's label — not that it was the right
group. The catalog keeps a separate group per spelling, so a local-language or variant name usually
lands on a near-empty duplicate sitting on top of the real city:

| you sent | its group | same city, spelled | its group |
| --- | --- | --- | --- |
| `Roma, IT` | 3 | `Rome, IT` | 20,706 |
| `Firenze, IT` | 1 | `Florence, IT` | 6,986 |
| `Wien, AT` | 7 | `Vienna, AT` | 4,580 |
| `Sevilla, ES` | 100 | `Seville, ES` | 4,512 |
| `New York City, US` | 1 | `New York, US` | 1,571 |

Treat a single- or low-double-digit `catalog_hotel_count` for a city you would expect to be large as a
**destination** problem: retry with the English-booking-site spelling, or with
`{ latitude + longitude + radius_km }`. This overrides `empty_reason` — and note the last row is not a
language difference at all, so the rule covers any variant spelling, not only translations.
Cross-language aliases are not folded server-side yet (JIN-2289).

`destination_resolution.status` (present on the city shape only) other than `resolved` means the
search matched your string literally and may have covered only part of the city — a retry with
coordinates is worth doing before reporting anything to the user.

`destination_resolution` is present on every successful search, city or not, carrying `shape` and
`match` — never absent, never a prose summary (JIN-2310):

- `shape`: `city | coordinates | place_id | query | hotel_name | hotel_ids` — which destination form
  was resolved.
- `match: exact` — the destination was found verbatim (city group, coordinates, hotel ids, a hotel
  name scoring 1.0).
- `match: fuzzy` — a close-but-different label was auto-picked (city: a single candidate ≥0.85 with no
  runner-up ≥0.6; hotel_name: a lookup score < 1.0). Both cases also carry `destination_resolution.score`
  (the similarity that drove the auto-pick). The response also carries a warning naming the
  substitution.
- `match: provider_matched` — `query` / `place_id` were forwarded and the supplier chose the place.
- `match: fallback_string` — `city_name` could not be resolved and the raw string was forwarded to the
  supplier; `status` says why.

Say something to the user ONLY when there is something to say: `match` is `fuzzy` or
`fallback_string`, or `resolved_city` differs from `requested_city`. `exact` and `provider_matched`
need no header line.

Shape-specific fields beyond `latitude`/`longitude`/`radius_km`:

- **`hotel_name` shape**: `hotel_id`, `hotel_name`, `hotel_city`, `score`,
  `nearby_alternatives_included`, and `hotel_ids_without_rates` (present when the matched hotel priced
  nothing).
- **`hotel_ids` shape**: `hotel_ids` (the ids rate-shopped) and `hotel_ids_without_rates`.

Retry advice, keyed off `shape` — coordinates and query/place_id are the two shapes worth widening:

- **`coordinates` shape** — retrying with coordinates is the search that just ran. Widen `radius_km`,
  or move the coordinates nearer the centre of the area meant.
- **`query` / `place_id` shape** (always `match: provider_matched`) — these carry no `radius_km` to
  widen. Retry with `{ latitude + longitude + radius_km }` for the place meant. A free-text `query`
  resolves to whatever the provider reads out of it, which may not be the place the user intended, so
  confirm the place before concluding anything.

In both cases an empty result says nothing about whether the wider area has hotels. Do not report
that it has none.

An older server omits `destination_resolution` entirely for non-city shapes, and omits `shape`/`match`
on the city shape — treat a missing `match` as `exact` when `status` is `resolved`, otherwise as
`fallback_string`.

Separately: `city_name` sent **beside** coordinates is dropped, with a warning saying so. The
coordinates anchor the search, and keeping the city string would narrow the area to properties whose
stored city spelling matched exactly — measured on dev 2026-09-21, the same disc returns 170 catalog
matches alone and 22 with `city_name: "Saint-Malo"`. Send one or the other, not both.

No `empty_reason` field at all means an older server: treat the empty result the same way — retry with
coordinates, and still do not report that the city has no hotels.

### Optional

- `currency` (ISO 4217), `guest_nationality` (ISO 3166-1 alpha-2)
- `filters`: `{ min_rating, min_star_rating, max_star_rating, min_reviews, hotel_type_ids, chain_ids,
  facility_ids, max_results, max_budget_per_night }`
- `filters.max_budget_per_night`: per-night per-room price cap (request currency) for "under
  $150/night" asks. Hotels whose CHEAPEST rate fits are kept with ALL their rates; the search scans
  deeper automatically when few fit. Also applies in Mode A. Prefer it over post-filtering results
  yourself.

### One budget across flights and hotel

The order of calls is in [SKILL.md › Which tool first › One budget for flights and
hotel](../SKILL.md#which-tool-first). This is the arithmetic behind it.

Three prices, three units:

- A cached flight fare (`flight_calendar`, `find_destination`, `price_monitoring`) is for ONE ADULT.
- `filters.max_budget_per_night` caps ONE night in ONE room.
- A hotel rate's price is the WHOLE stay — and, when the search asked for 2 or more rooms, for ONE of
  those rooms (the summary then says "per room, for the stay").

So the cap is:

`max_budget_per_night = (budget − one-adult fare × travellers) ÷ nights ÷ rooms`

- nights = `checkout` − `checkin`; rooms = the number of `occupancies` entries, else `rooms`, else 1.
- Both the travellers and the rooms matter. Leave out "× travellers" and the flights are
  under-counted, so the cap is too high; leave out "÷ rooms" and a two-room cap is twice what fits.
- Use the amounts the `display` strings show, and send the budget's currency as `currency` on the
  flight call and on `hotel_search` (both fall back to USD). A floor and a cap in different
  currencies cannot be subtracted.

Worked example — 3 adults, 4 nights, 2 rooms, a budget of 2,000 USD for everything:

1. `flight_calendar` (round trip, `"currency": "USD"`): cheapest fare `USD 260.00` for one adult.
2. Party's flight floor: 260 × 3 = 780.
3. Left for the stay: 2,000 − 780 = 1,220.
4. Per night: 1,220 ÷ 4 = 305; per room: 305 ÷ 2 = 152.50 →
   `{ ..., "occupancies": [{ "adults": 2 }, { "adults": 1 }], "currency": "USD", "filters": { "max_budget_per_night": 152.5 } }`.

The two usual mistakes on the same trip: 217.50 (the one-adult fare not multiplied by 3) and 305 (not
divided by the 2 rooms).

The floor prices the WHOLE itinerary:

- Out and back to the same place: the cheapest `roundtrip` fare.
- A trip that ends somewhere other than where it started, or any set of separate legs: price each leg
  `oneway` and add them. A round trip back to the origin is not the price of that trip, and neither
  is one direction alone.

The running total in the answer — one line per item, then the sum against the budget:

- Flights: the one-adult fare × travellers, labelled indicative ("about USD 260 per adult, about
  USD 780 for the three of you").
- Hotel: the chosen rate's price, × rooms when it was priced per room.
- Total and what is left (or how far over). The sum and the remainder are your own arithmetic —
  say so; quote each item's `display` as it came back.
- The flight figure is still cached: confirm it live with `flight_search` before booking (Rules that
  always apply), and if the live price differs, update the running total with it rather than
  searching again for a cheaper split.

When the flights alone reach the budget (party's flight floor ≥ budget): report the floor, the budget
and the gap, and do NOT call `hotel_search` — a cap of zero or less finds nothing. Do not retry the
flight search on other dates or airports hoping to fit; offer those as options for the user to pick.
When `hotel_search` answers `all_dropped_by_budget`, the remainder fits no hotel: report the cheapest
rate seen and the total it would make (see "Error handling — an empty Mode B result" above), and do not keep raising the cap.

### Examples

1. Free-text city search:
   `{ "destination": { "query": "Paris" }, "checkin": "2026-07-15", "checkout": "2026-07-18", "adults": 2 }`
2. Two-room family with kids:
   `{ "destination": { "city_name": "Barcelona", "country_code": "es" }, "checkin": "2026-08-01", "checkout": "2026-08-05", "occupancies": [{ "adults": 2 }, { "adults": 1, "children_ages": [5, 7] }] }`
3. Island / region (use lat-lng + radius, NOT query):
   `{ "destination": { "latitude": 39.9496, "longitude": 4.1102, "radius_km": 30 }, "checkin": "2026-08-31", "checkout": "2026-09-09", "adults": 1 }`
4. Geo-radius search around a POI:
   `{ "destination": { "latitude": 41.4036, "longitude": 2.1744, "radius_km": 3 }, "checkin": "2026-09-10", "checkout": "2026-09-12", "adults": 2 }`
5. Mode A — the user named a specific hotel:
   `{ "destination": { "hotel_name": "Hotel Calimala", "country_code": "it", "city_name": "Florence" }, "checkin": "2026-07-15", "checkout": "2026-07-18", "adults": 2, "currency": "EUR" }`

### Response

- Each hotel includes basic metadata (`name`, `address`, `star_rating`, `rating`, `main_photo`) and a
  `rooms[]` list.
- Each room has a `rates[]` list. Each rate has an `offer_id` (the `htl_*` token), board type, refund
  policy, and `total_amount` + `currency`.

Next step: use the `trip` tool with `add_item` and the `offer_id` of the rate the user picks. Hotel
items work alongside flight items in the same cart.

Flow: `hotel_search` → `trip(add_item)` → `trip(upsert_travelers)` → `checkout`

## hotel_details

Fetch rich metadata (gallery, facilities, policies, per-room metadata) for a single hotel. 1 credit
per call.

Use this AFTER `hotel_search` returns a list of hotels and the user wants a closer look at one. Pass
the `hotel_id` from a `hotel_search` result.

- Required: `hotel_id` (string, from a `hotel_search` offer).
- Optional: `checkin`, `checkout` (YYYY-MM-DD) — accepted for cache-key alignment; currently ignored.

Response:

- `hotel`: `{ id, name, star_rating, address, images[], facilities[], policies[] }`
- `rooms[]`: per-room metadata, each with `name` + `description` (when available)

Notes:

- Read-only. Does not affect the cart or quote.
- Independent of pricing — call `hotel_search` first to get live rates with offer tokens.
