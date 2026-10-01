---
name: jinko-travel
description: "Search, price, book and service travel through Jinko's Builder MCP: flights (find_destination, flight_calendar, price_monitoring, flight_search), hotels (hotel_search, hotel_details), car rental (car_search), the booking flow (trip → checkout → submit_agent_payment → get_trip / get_booking) and post-booking servicing (flight_refund, flight_exchange, hotel_cancel, car_cancel, car_exchange). Use whenever a user wants to find, compare, monitor, book, pay for, refund, exchange or cancel flights, hotels or rental cars with the Jinko MCP tools: it says which tool to call first, how to go from cached discovery to live pricing, how to build a trip and check out, and the rules that must never be broken (real traveler data only, preview before commit, no retry loops)."
compatibility: "Requires the Jinko Builder / DevPlatform MCP server connected as a tool source (streamable HTTP; Authorization: Bearer with a jnk_* API key or an OAuth JWT)."
metadata:
  author: jinkoso
  version: "0.1.0"
  surface: builder-mcp
---

# Jinko Travel (Builder MCP)

Jinko Travel API — flight and hotel search, pricing and booking, plus car rental, exposed as MCP
tools. Authenticate with an `Authorization: Bearer <token>` header (OAuth JWT or a `jnk_*` API key). Do NOT use an `X-API-Key` header.

Tool descriptions remain the reference for parameters and response shapes. This skill carries the
way-of-use: which tool first, how the steps chain, and the rules that always apply. Details per domain
are in the three references linked at the end.

## Tool map

Flights — cached discovery (1 credit per call) and live search (10 credits per call):

- `find_destination` — discover destinations reachable from your departure airports, globally or filtered to regions, sorted by cheapest available flight.
- `flight_calendar` — flights between a known origin and destination using cached pricing; loose / flexible dates (single dates, date arrays, ranges, stay days).
- `price_monitoring` — cache-only price snapshot for a fixed route + dates; for scheduled polling, NOT one-shot shopping or booking.
- `flight_search` — live flight pricing and fare options: `search` (route + exact dates) or `price_check` (an `offer_token` from a discovery tool). Returns the `trip_item_token` per fare.

Hotels:

- `hotel_search` — live hotel inventory and rates; Mode A (the user named a hotel) or Mode B (the user is exploring a destination). Returns `htl_*` offer tokens (10 credits per call).
- `hotel_details` — rich metadata (gallery, facilities, policies, per-room details) for one hotel after `hotel_search`; read-only.

Trip, checkout, payment, inspection:

- `trip` — create and manage a trip: `add_item`, `remove_item`, `upsert_travelers`, `select_ancillaries`. Flights, hotels and cars share one cart.
- `checkout` — finalize a trip: returns the `checkout_url` a human opens to pay plus `agent_spt_params` for programmatic agent payment.
- `submit_agent_payment` — submit a Shared Payment Token (SPT) to authorize the booking server-side; the agent-pay alternative to the checkout page.
- `get_trip` — full lifecycle state of a trip: cart, travelers, quote, fulfillment, `booking_ref`. Read-only.
- `get_booking` — retrieve a booking by Jinko `booking_ref` + traveler last name. No login required.

Post-booking (no login required — `booking_ref` + `last_name`):

- `flight_refund` — cancel a booked flight: refund the tickets, or void them inside the airline's void window. Preview first.
- `flight_exchange` — exchange a booked flight for a different itinerary: shop → price → commit → status.
- `hotel_cancel` — cancel a hotel booking. Preview first.

Ground transport (Distribusion) — ONLY when these tools appear in your tool list; they are not available on every deployment. If they are absent, do not offer trains, buses or ferries:

- `find_ground` — bus/coach, rail or ferry connections between two cities or stations on a date. Each connection carries a `trip_item_token`.
- `ground_cancel` — cancel a ground booking: preview → commit → status.
- `ground_exchange` — exchange a ground booking for a new date and/or stations: preview → commit → status.

Car rental (Auto Europe) — optional tool group, not registered on every deployment:

- `car_search` — live car rental offers; each `offer_id` IS the trip item token (there is no car-specific booking tool).
- `car_cancel` — cancel a rental and refund less the fee: preview → commit → status.
- `car_exchange` — change a rental in place (dates, vehicle, extras). This is the tool for "modify", "change my dates", "amend", "upgrade": preview → commit → status.

## Which tool first

Pick by what the user already knows. This is the only place the routing is stated.

Flights are routed on two things: what the user knows about the DATES, and whether they asked for a filter that only the live search can apply.

**Live-only filters.** `flight_calendar` filters on the dates, `cabin_class`, `direct_only`, the four time-of-day windows (`departure_time_range`, `arrival_time_range`, `return_departure_time_range`, `return_arrival_time_range`) and `max_total` (a per-person cap — see rule 3) — nothing else. Every other constraint exists on `flight_search` alone: `max_stops` of 1 or more ("at most one stop"; `max_stops: 0` is `direct_only`), `include_carriers` / `exclude_carriers` / `single_carrier_only`, `refundable_only`, `changeable_only`, `checked_bag_included`, `max_total_duration_minutes`, `connection_time_min_minutes` / `connection_time_max_minutes`, `via_airports` / `exclude_via_airports`, `aircraft_types`, the alternate / nearby airport lists, `same_connection_airport_only` / `same_origin_airport_only` / `same_turnaround_airport_only`. The passenger count is live-only too: `flight_calendar` takes none and prices one adult.

**Cabin intent on live search.** Send `flight_search.search.cabin_class` only when the user explicitly chose `economy`, `premium_economy`, `business` or `first`; otherwise omit it or send `null`. An explicit cabin is an exact filter on the fare's longest flight segment. See [references/flights.md › flight_search](references/flights.md#flight_search) for the result and empty-search contracts.

**Constraint fall-through.** ANY stated live-only constraint means the answer comes from `flight_search` with that constraint applied, never from a cached tool alone; the cached tool may only pick the dates. For live passengers, stop caps, time windows and budgets, read [references/flights.md › flight_search](references/flights.md#flight_search). For date-attached windows, time words and windows applying to both legs, use the time-of-day filter rules in [references/flights.md › flight_search](references/flights.md#flight_search).

**What a cached result is for.** A `flight_calendar` row is a date suggestion with an indicative price. It was never narrowed by a live-only filter, so it does not answer a request that carried one: the cheapest cached date may be two stops, non-refundable and without a bag.

**Live-search budget.** At most three live `flight_search` calls per request once discovery is done. Cached tools (`flight_calendar`, `find_destination`) do the discovery; live search confirms. If more than three candidate dates remain, narrow them with the cache (a tighter `flight_calendar` window, sorted by price) before any further live call — never test dates one by one live. Exception: the user explicitly names more than three dates to compare, or a live call failed and is retried once. An exact-date request (origin, destination and specific days) may go straight to `flight_search` — that is confirmation, not discovery. The three calls are one budget for the whole request, shared with Follow-`next`: when several cached answers each suggest searches (two routes or windows being compared), take the suggestions in turns — each option's first `next.args` entry, in the order the user gave the options, then each option's second entry, and so on — until the three calls are used; within one answer keep the order `next.args` lists (empty answers suggest unpriced dates, so never re-rank them by price). Name every option and suggested date not checked live, and offer to check them. Rule 4 still governs whether monitoring permits a live call.

**Booking horizon.** Airlines usually open sales about a year before departure, so a live search further out is very likely to come back empty. Never run `flight_search`, on any path (exact dates, Follow-`next`, a monitoring fall-through, a retry), for a departure or return more than one year after today. Tell the user the fares are likely not on sale yet and give the expected opening date as an estimate ("expected around …; the exact date varies by airline"): `next.opens_on` when a cached answer gives it, otherwise the later of the departure and return dates minus one year. Offer a price monitor or the nearest date that is on sale.

**Follow `next`.** `flight_calendar`, `find_destination` and `price_monitoring` answers carry `search_criteria` (what was actually searched: the window, `defaulted: true` when the server chose it, and `priced_for`: `"one_adult"` on every cached tool; on `price_monitoring` it also echoes `passengers_requested`, which does not change the fare) and, when there is a next step, `next` (`tool`, `note`, `args`). Run it before answering, subject to the destination choice and monitoring exception below; this applies to rules 1–4:

- For an **empty** calendar answer (`status: "empty"`), read `next.reason` first. With `beyond_booking_horizon`, run nothing live and apply the **Booking horizon** rule above. With `no_cached_fares_in_window`, run `flight_search` on the entries of `next.args` in the order listed — all of them (at most three) when this is the only cached answer, otherwise only as many as the shared live-search budget has left, naming the suggested dates not searched, each with the user's live-only filters and real party (`passengers`), and answer with the cheapest result that meets the filters, naming the dates searched; if every suggestion is empty, say so and name the dates; if `next.args` is empty, the window is in the past — say so.
- For a **non-empty** calendar answer, call `flight_search` with `{ price_check: <the entry's price_check>, passengers: <real party> }` only, using the chosen `next.args` entry; its `departure_date`, `return_date` and `total_amount` are context, not arguments, and no `search` is sent with `price_check`; when the user asked for a live-only filter, rule 3 still decides the candidates and the filters. If `price_check` answers "Offer not found", or its price-check status is `offer_unavailable` ("the selected offer is no longer available"),, run `flight_search` with `search` on that entry's `departure_date` / `return_date`, the same route, and the user's filters and real party (`passengers`) — do not report the offer as unavailable to the user.
- a `find_destination` answer → `next`, when present, lists the `flight_calendar` calls for the best destinations; continue with the one the user picks (or the cheapest when they asked for the cheapest);
- a `price_monitoring` `stale` answer → report stale as rule 4 says; `next` is the live search to OFFER, never to run silently.

Never tell the user there are no flights from a cached empty alone; for every cached answer shown to the user, name what was searched from the fields `search_criteria` carries — the route; the window (`departure_window`, saying when `defaulted: true` means the server chose it) or the exact dates (`departure_date` / `return_date`); any filter it lists, such as `direct_only` or a price cap; and that the fare is for one adult.

1. No destination yet — "Where should I go from Paris?", "Beach destinations from London", "Cheap flights from SF" → `find_destination` (inspiration from an origin), then continue at 2 or 3 with the destination the user picks.
2. Origin + destination, dates absent, flexible or loose, and NO live-only filter — "Paris to Barcelona for a weekend in April", "Find flights from JFK to CDG next month" → `flight_calendar` picks the dates: follow its `next` before answering — on a non-empty answer, `price_check` on the entry that fits; on an empty answer, the `search` entries as the Follow-`next` rule says; only when there is no `next` (or the live call fails) may calendar rows be shown, as indicative one-adult “from about …” figures. Naming a future live step is not a substitute for running it. Also the right tool for "cheapest flight", "best flight", "find me a flight", "cheapest date" phrasings; for a short list of the best dates (set `limit`); and for the cheapest options on one given date (`departure_dates` with that one date).
3. Origin + destination, dates absent, flexible or loose, WITH a live-only filter — "Lyon to Montreal any time in May, at most one stop", "Rome to Oslo, a weekend next month, on SAS only, with a checked bag" → two stages, in this order; do not stop after the calendar, and do not hand the calendar's dates to the user to choose from:
   1. `flight_calendar` with the dates and the filters it does take → pick one to three candidate date pairs from it yourself, cheapest first. Its budget, `max_total`, caps a ONE-ADULT fare: when the user gave a budget for the whole party, divide it by the number of adults only and treat it as a loose pre-filter; children and lap infants usually cost less than an adult. Send a per-person budget as-is.
   2. `flight_search` with `search` on EVERY candidate date pair, one call per pair and at most three `flight_search` calls in all, each with the user's FULL filter set, the live-only filters included. The budget changes meaning as well as name: on `flight_search` it is `max_price` and caps the WHOLE trip for ALL passengers, so send the user's whole-trip figure unchanged (or a per-person figure times the number of travellers) for the exact whole-trip budget check. Name it `max_price` there, and never carry the calendar's `max_total` across under its own name: the same word means a per-adult cap on the calendar and must not be mistaken for the whole-trip budget on `flight_search`. Search all candidates even if an earlier one meets every filter: cached price order does not predict live price order.
   3. Answer with the cheapest fare meeting every filter across the `flight_search` results. If none of the searched dates had a fare meeting all the filters, say so, name the dates searched, and ask whether the user wants to adjust the filters before searching again. Do not silently relax a filter or go further down the calendar list.
4. Track the price of a specific route + exact dates over time (cron / scheduled job / price-drop alert) → `price_monitoring` (cached, cache-only, poll-friendly — never triggers a live call). It returns the single cheapest cached itinerary, or `status: "stale"` when the cache is cold; do NOT silently fall back to `flight_search` — that is a different intent. Monitoring supports only exact dates, cabin, `direct_only`, carriers and a one-adult price cap. Explicit exception: when the user also states a constraint monitoring cannot apply (such as `max_stops` above 0, a time-of-day window or a party larger than one adult), run monitoring AND one `flight_search` on the same dates with the full filter set, and say which result honours the constraint; this is an explicit companion search, not a silent fallback. See [references/flights.md › price_monitoring](references/flights.md#price_monitoring).
5. Origin + destination + EXACT departure date (plus the return date when it is a round trip), ready to see bookable fares — "Paris → NYC, June 17 → June 26", "Toronto → Cape Town on January 25" → `flight_search` with `search` (live pricing; each call has a cost). A departure date with no return date is a one-way search — run it, do not ask.
6. Holding an `offer_token` from any discovery tool → `flight_search` with `price_check` (live re-price → `trip_item_token`).

For relative, loose, absent or nearby dates, paired airports and calendar input shapes, read [references/flights.md › Dates and airport codes](references/flights.md#dates-and-airport-codes-flight_calendar) before calling.

**Dates stated as a rule.** When the user describes dates by a rule instead of naming them, turn the rule into dates yourself, before the call, and send them as `departure_dates` / `return_dates` (or `departure_date_ranges` / `return_date_ranges`) — not a whole-month range the user then has to sift:

- Weekdays — "midweek", "Tuesdays", "weekends": list the qualifying dates in the window, and say which reading you used (e.g. midweek = Tuesday to Thursday).
- Nights that must be included — "a long weekend covering the Saturday and Sunday nights": depart on or before the Saturday, return on or after the Monday; with a stay length ("3–5 nights"), keep only the pairs that fit it.
- Excluded dates — "not the week of the 10th": split the window into ranges that skip them.
- Arrival deadlines — "in Lisbon by May 8" or "home in Dublin by May 19": first identify which leg arrives at the named place (outbound or return). That leg must LAND by the deadline, and no input constrains the arrival date. Send dates up to the deadline for that leg (`departure_dates` for outbound, `return_dates` for return), then drop any result where that leg lands after it and say so.
- Same-day arrival: no input enforces it. Send the exact dates, then drop any result that lands on a later day and say so.

A departure list and a return list can still pair into combinations the rule excludes — check each returned pair against the rule before presenting it.

**One budget for flights and hotel.** When one figure covers the flights AND the stay ("3 adults, 5 nights, 2,400 USD all in"), split it yourself — do not ask the user to split it — in this order:

1. Price the flights FIRST with a cached tool (`flight_calendar`; `find_destination` when there is no destination yet), in the budget's `currency`. The cheapest fare for the whole itinerary is the floor. Do not use `flight_search`'s `max_price` for this: a cap is not a price, and the floor comes from a priced result.
2. That cached fare is for ONE ADULT: multiply it by the number of travellers to get the party's flight floor.
3. Subtract the party's flight floor from the budget.
4. Divide what is left by the number of nights AND by the number of rooms, and send the result as `hotel_search`'s `filters.max_budget_per_night` (a per-night, per-room cap), with `currency` set to the budget's currency.
5. In the answer, keep a running total against the budget: flights, hotel, sum, what is left.
6. If the party's flight floor already meets or exceeds the budget, that is the finding: say so, with the figures, and do NOT search hotels. Do not retry flight searches hoping to squeeze under.

The arithmetic, a worked example and the running total: [references/hotels.md › One budget across flights and hotel](references/hotels.md#one-budget-across-flights-and-hotel).

Hotels: exploring a destination → `hotel_search` Mode B; the user named a specific hotel → `hotel_search` Mode A; the user wants a closer look at one result → `hotel_details`.

Cars: rent / hire a car between two date-times → `car_search`. Ground (only if `find_ground` is in your tool list): train, bus/coach or ferry between two places → `find_ground`.

Existing booking: inspect → `get_booking` (`booking_ref` + `last_name`) or `get_trip` (`trip_id`). Cancel a flight → `flight_refund`; change a flight → `flight_exchange`; cancel a hotel → `hotel_cancel`; ground (if listed) → `ground_cancel` / `ground_exchange`; end a rental → `car_cancel`; change a rental → `car_exchange`.

## End-to-end booking flow

Each step depends on the previous one — do not skip steps.

1. Get flights, either via discovery (`find_destination` / `flight_calendar` → `offer_token` → `flight_search` with `price_check`) or via direct search (`flight_search` with `search`, when the user has route + exact dates). For hotels: `hotel_search` (then `hotel_details` if the user wants a closer look).
2. `flight_search` returns flights with fare options and a `trip_item_token` per fare; `hotel_search` returns rates with an `htl_*` `offer_id`. If `flight_search` status is `"flight_unavailable"`: show the alternatives and let the user choose.
3. `trip` with `add_item` and the token of the fare / rate the user chose → creates the trip, returns `trip_id`. Flights and hotels (and cars) can be added to the same trip: one cart, one Stripe checkout.
4. `trip` with `upsert_travelers` (`trip_id`) → set real passenger info and contact (MUST be provided by the user).
5. Optional: `trip` with `select_ancillaries` → bags, seats, meals (check `available_ancillaries` in the trip response; flights only).
6. `checkout(trip_id)` → one synchronous call: the quote is scheduled and polled until ready, fulfillment is scheduled, and a Stripe `checkout_url` PLUS `agent_spt_params` come back.
7. Pay — human path: the user completes payment in the browser at `checkout_url`; Stripe webhooks finalize the booking, no client-side confirm step. Agent path: mint a Shared Payment Token scoped to `agent_spt_params`, then `submit_agent_payment(trip_id, shared_payment_token)`; on success it returns `booking_ref` (JNK-XXXXXX) — keep it. A 3DS step-up or decline falls back to `checkout_url`.
8. Any time after step 3: `get_trip(trip_id)` → cart, quote, fulfillment and booking state. It carries `booking_ref` as soon as fulfillment is scheduled — possibly before payment completes — so read `fulfillment.status` instead of treating its presence as paid.

Full detail for each step: [references/booking.md](references/booking.md).

## Rules that always apply

- Cached prices are indicative. `flight_calendar` and `price_monitoring` return cached fares whose price accuracy is roughly 80% even at the highest-confidence cache age, and which no live-only filter has narrowed (see Which tool first). A `flight_calendar`, `find_destination` or `price_monitoring` fare is the price for ONE ADULT: never present it as the confirmed price for the party; for more than one traveller, the confirmed party price comes from `flight_search`. For estimated party totals, use the adult multiplier and estimate label in [references/flights.md › Cached prices](references/flights.md#cached-prices-are-indicative--confirm-live-before-presenting-a-bookable-fare). For these cached tools' `max_total` / `max_price`, divide a whole-trip budget by the number of adults only and treat it as a loose pre-filter; send a per-person budget as-is. The exact whole-trip check is `flight_search`'s `max_price`: send the user's whole-trip budget unchanged, or multiply a per-person budget by the number of travellers. On `price_monitoring`, `traveler_counts` does not change the price, the `max_price` cap, or anything in the response; price and cap are for one adult. Use them to identify good candidate dates and routes, then ALWAYS re-run live shopping — `flight_search` with `price_check` and the `offer_token`, or `flight_search` with `search` on the exact dates — to confirm the price before presenting a fare as bookable or adding it to a trip.
- Never fabricate traveler data. Always ask the user for real passenger details; never use placeholder or default values.
- If `flight_search` returns status `"flight_unavailable"`, do NOT proceed to booking.
- Refunds, exchanges and cancellations: always preview (or shop and price) before committing, show the customer the amount, and get explicit user confirmation. `fee_known: false` means the fee is UNKNOWN — never present it as free.
- Do not retry in loops on errors. Rate limit: 1000 requests / 30 days per API key. `status: "stale"` from `price_monitoring` is a correct answer, not a reason to loop.
- If a search fails, surface the error — never retry with a changed passenger list (e.g. dropping an infant); that silently changes the user's request.
- Sessions expire after inactivity. If you receive a 404, re-initialize.
- Money: search, calendar, monitoring, trip, checkout and `get_trip` results carry a `display` string beside each price (`display` inside a money object, `<field>_display` beside a bare number, e.g. `min_price_display`, `price_display`, `total_amount_display`): the ISO currency code and the amount at the currency's decimals, e.g. `"EUR 484.40"` (`flight_search` prints its prices in the same form). Quote `display` verbatim; never compute a price from `value`, `amount` or `decimal_places`. Refund, exchange and cancellation tools state their own money rules.
- Authenticate with `Authorization: Bearer <token>`; not `X-API-Key`.

<!-- BEGIN jinko overlay — generated from hosts/jinko/overlay.md -->

## Using this plugin in Claude Code or Codex

The MCP server is named `jinko`. In Claude Code, tools appear as `mcp__plugin_jinko_jinko__<tool>`; in Codex, they appear under the `jinko` server.
Both hosts need `JINKO_API_KEY` exported in the environment the host starts from. Get a `jnk_` key from dashboard.gojinko.com → Developers → API keys.
Claude Code honours `JINKO_MCP_URL` to point at another Builder MCP endpoint.
If no Jinko tool is listed, the key is missing or rejected: tell the user to set it and restart the host.

<!-- END jinko overlay -->

## Read next

- [references/flights.md](references/flights.md) — the four flight tools: inputs, date and airport-code rules, `flight_search` filters and response fields.
  Before answering with flight results, apply [Before you answer (flights)](references/flights.md#before-you-answer-flights) to all results already fetched in the session.
- [references/places.md](references/places.md) — turning what the traveller said into IATA codes: when to resolve rather than recall, ambiguity, country-level transit exclusions and the 9-airport provider cap, a radius around a city.
- [references/hotels.md](references/hotels.md) — `hotel_search` (two modes, the 422 low-confidence recovery, one budget across flights and hotel, examples) and `hotel_details`.
- [references/booking.md](references/booking.md) — `trip`, `checkout`, `submit_agent_payment`, `get_trip`, `get_booking`, `booking_ref` vs `booking_reference`, the multi-domain cart, and the post-booking / ground / car contracts.
