---
name: search-cars
description: Search live car-rental availability by pick-up airport, place or coordinates, a date-time window and the driver's age and residence, using the Jinko Travel API. Use when the user wants to rent or hire a car, compare rental offers, or book a car.
---

# Car Rental Search

Search live car-rental inventory with the `car_search` Jinko MCP tool. Returns priced, bookable offers whose `offer_id` (`car_*`) is a trip item token — booking rides the shared cart, exactly like a flight or a hotel. There is **no car-specific booking tool**, and there is **no car exchange**: changing a rental's dates, vehicle or extras is not available — the options are keeping the booking or cancelling it (`car_cancel`, in the `manage-booking` skill) and searching again.

## car_search

Live search — each call reaches the rental supplier.

**Required params:**

- `pick_up`: where and when the car is collected
  - `date_time`: **branch-local, zone-less** `"YYYY-MM-DDTHH:MM:SS"` (e.g. `"2026-10-25T10:00:00"`). A `Z` or a UTC offset is rejected — the rental desk works in its own local time.
  - **exactly one** place shape:
    - `airport_code`: 3-letter IATA (e.g. `"LYS"`). Prefer it whenever the user named an airport — it needs no resolution step.
    - `place`: free text (`"lyon part dieu"`, `"Lyon city centre"`), resolved server-side. When it matches several genuinely different rental locations the response carries `candidates` **instead of** offers.
    - `geo`: `{ latitude, longitude, range }` for "near me" (range in metres, minimum 50). **Round-trip only.**
- A drop-off time, one of:
  - `drop_off_date_time`: branch-local return time — round trip, the car goes back to the pick-up branch.
  - `drop_off`: `{ date_time, airport_code | place | geo }` — a **one-way** rental returned somewhere else.
- `driver_age`: 18–99. **Price-affecting — ask the user, never guess.**
- `residence_country`: ISO 3166-1 alpha-2 (e.g. `"FR"`). **Price-affecting**, and decides which suppliers will rent at all.

**Optional params:**

- `currency`: ISO 4217 display currency (default USD)
- `lang`: BCP-47 tag for provider text (package names, fuel policy), e.g. `"en-gb"`

Provider ids (location, city, branch, supplier) are never accepted on this surface.

**Examples:**

Round trip from an airport:
```json
{
  "pick_up": { "airport_code": "LYS", "date_time": "2026-10-25T10:00:00" },
  "drop_off_date_time": "2026-10-28T10:00:00",
  "driver_age": 30,
  "residence_country": "FR",
  "currency": "EUR"
}
```

One-way, free-text pick-up:
```json
{
  "pick_up": { "place": "Lyon Part-Dieu", "date_time": "2026-10-25T10:00:00" },
  "drop_off": { "airport_code": "CDG", "date_time": "2026-10-28T18:00:00" },
  "driver_age": 42,
  "residence_country": "GB"
}
```

**Response:** a top-level `status` — `success`, `ambiguous_place` (candidates instead of offers, see below), `no_results` or `error` — with the result under `data`. `data.offers[]` flattens one vehicle × rate package × branch pair per entry:

- `offer_id`: the `car_*` trip item token — pass it **verbatim** to `trip(add_item)`
- `expires_at`: about 30 minutes — search again after it
- `on_request`: the supplier confirms by hand, so the booking settles asynchronously
- `vehicle`: `name` (the model, "or similar" unless `model_guaranteed`), `acriss_code`, `category`, `transmission`, `fuel_type`, `seats`, `doors`, suitcase counts, `air_conditioned`, `images[]`
- `package`: `name` (the rate plan), **`supplier_name` (the rental company the customer physically collects the car from — Avis, Hertz, Europcar, Sixt — show it with every offer)**, `fuel_policy`, `mileage_unlimited` / `mileage_allowance`, `inclusions`, `coverages`, `fees`
- `pick_up` / `drop_off`: the branch — `name`, `address`, `city`, `country`, `phone`, `date_time` (branch-local), `time_zone` (IANA — the only way to turn a local time into an instant), `opening_hours`, `out_of_hours`, `requires_flight_number`, `terminals`, `is_meet_and_greet`
- `price`: see money below
- `cancellation_fees[]`: `{ type, fee, non_refundable, applicable_from, applicable_to, applicable_now }`
- `driver_age_range`: `{ min, max }`

Plus `data.resolved_place` (what an unambiguous free-text place matched), `data.currency`, `data.warnings`, and the truncation counters `data.total_found` / `data.offers_shown` / `data.offers_omitted`: when `offers_omitted` is above zero, `data.notice` says so — **narrow the search** (dates, place, a smaller radius) rather than treating the list as complete; there is no paging.

### Ambiguous place — `candidates`

When `place` is ambiguous the response is `status: "ambiguous_place"` with `data.candidates[]` (`{ name, kind, city, country }`) and **no offers**. That is a retry signal, not an empty result: put the candidates to the user and search again with the chosen candidate's `name` as `place` (qualify it with the city — "City Centre, Lyon" — when two share a name). **Never auto-pick a candidate**: "Lyon" is an airport, a rail station and a downtown office that book three different counters.

## Reading the money

- `price.pay_now` is the **only** amount Jinko charges at checkout.
- `price.due_at_desk` is collected by the rental desk in local currency — display only.
- `price.deposit` is a card hold; `price.estimated_total` is the supplier's FX-movable estimate.
- **Never sum them into a total.**
- Amounts are `{ value, currency, decimal_places, display? }` — `value` is an integer in minor units; divide by `10^decimal_places`, or print `display` as sent.
- **An empty `cancellation_fees` list means the supplier published no schedule: the fee is UNKNOWN. Never present that as free cancellation.** A coverage's `excess` of `null` means "not stated", not "no excess".

## Booking flow

Cars use the same cart as flights and hotels:

```
car_search → trip(add_item, trip_item_token=<car_* offer_id>) → trip(upsert_travelers, contact.title!) → book
```

Two things differ from a flight or hotel booking:

- **`contact.title` is required.** The booking contact's honorific (`"mr"`, `"ms"`, `"mx"`, …) goes in `upsert_travelers.contact.title`. The readiness gate refuses a car cart without it, before any card is charged. It is matched against the rental provider's own title vocabulary, so keep to the common forms.
- **`driver_age` is baked into the rate** and is never asked again at booking.

See the `book-trip` skill for steps 2–5; they are otherwise identical. To cancel a booked rental, use `car_cancel` in the `manage-booking` skill.

## Important notes

- **Date-times**: `YYYY-MM-DDTHH:MM:SS`, branch-local, no timezone; drop-off must be after pick-up.
- **Places**: exactly one of `airport_code`, `place`, `geo` per end; `geo` is round-trip only.
- **Offers expire** (`expires_at`): if `trip(add_item)` fails, search again.
- **`requires_flight_number` on a branch** is the supplier's policy and cannot be satisfied today (Jinko carries no flight number): `"always"` means that branch cannot be booked at all — prefer an offer from another branch.
- **No modifications.** Do not promise a date change, an upgrade or a different vehicle on an existing rental; offer to cancel (fee shown first) and book again.
