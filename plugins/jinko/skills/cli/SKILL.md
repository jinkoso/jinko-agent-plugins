---
name: cli
description: Use the `jinko` CLI (npm `@gojinko/cli`) to search flights, hotels and rental cars, build trips, book, refund, cancel, and look up bookings from the terminal. Use when the user wants to run travel operations in a shell, script, CI, or agent loop — or explicitly asks for the "jinko CLI", "jinko command", or running something as a command-line.
---

# Jinko CLI

Command-line tool for the Jinko Travel platform. Same capabilities as the MCP tools, exposed as a shell binary. Built on Commander.js, calls the BFF (`api.gojinko.com`) directly — not via the MCP server.

## Install + auth

```bash
npm install -g @gojinko/cli          # one-time install
jinko auth login --key jnk_xxx        # store your API key (from dashboard.gojinko.com → Developers → API keys)
jinko auth status                     # verify
```

Auth alternatives:
- **API key** (recommended): `jinko auth login --key jnk_xxx`, or per-command `jinko --api-key jnk_xxx <command>`, or `export JINKO_API_KEY=jnk_xxx`. `jinko auth login` with no flag prompts for the key interactively and stores it in `~/.jinko/config.yaml`. `jinko auth logout` to clear.
- **OAuth**: deprecated and no longer supported — use an API key.

## Environments (prod / sandbox)

Defaults to **production**. Target **sandbox** (isolated data, **separate API keys**) with `--env sandbox`:

```bash
jinko auth login --env sandbox --key jnk_your_sandbox_key   # store the sandbox key
jinko config set environment sandbox                        # make sandbox the default
jinko --env prod <command>                                  # one-off prod override
```

Prod and sandbox keys are stored separately in `~/.jinko/config.yaml`. Precedence: `--env` → `JINKO_ENV` → config `environment` → `prod`. `JINKO_API_BASE` still overrides the mapped URL (dev/staging).

## Global flags

- `--format json` (default) or `--format table` — output shape
- `--api-key <jnk_...>` — override stored creds
- `--env <prod|sandbox>` — target environment (default `prod`)
- `-V` / `--version`

## Command surface

| Command | Purpose |
|---|---|
| `auth login / logout / status` | Credentials |
| `find-destination` | Discover destinations from origin(s) — inspiration |
| `flight-calendar` | Cheapest prices across a date range for a specific route |
| `flight-search` | Live pricing — direct search by route + dates, or `--offer-token` price-check (returns bookable `trip_item_token`). Full shop filter set: `--max-stops`, `--departure-time-range`, `--connection-time-*-minutes`, `--refundable-only`, `--checked-bag-included`, `--via-airports`, `--origin-alternate-airports`, … |
| `hotel-search` | Live hotel search by city/query/geo/hotel-ids |
| `hotel-details` | Rich metadata (gallery, facilities, policies, per-room details) for a single hotel |
| `best-price-guarantee claim / get` | Match a lower price found for the same hotel stay on another site: `claim --trip-item-token <htl_*> --reference-url <url> --screenshot-url <url> --total <decimal> --currency <ISO>`; the answer is `pending` (read it with `get --id`), `offered` (`offer.trip_item_token` as the only item of its trip, with `trip`) or `declined` (`decline.reason`) |
| `car-search` | Live car-rental offers — pick-up by `--pick-up-airport` / `--pick-up-place` / `--pick-up-geo lat,lng,range` (exactly one), branch-local `--pick-up-date-time` / `--drop-off-date-time` (no timezone), `--driver-age`, `--residence-country`. Each offer's `offer_id` (`car_*`) is the `trip_item_token`. |
| `trip` | Create / update a trip: add items, remove items, set travelers + contact (a car rental needs `contact.title`, the honorific) |
| `select-ancillaries` | Add baggage / seats / meals to a trip item |
| `checkout` | Finalize a trip → returns `checkout_url` (human pays in browser) + `agent_spt_params` (agent pays programmatically). `book` is a deprecated alias. |
| `agent-pay submit` | Pay programmatically with a Shared Payment Token (`--trip-id` + `--token`); returns the Jinko `booking_ref` once authorized; on 3-D Secure it returns `payment_status: "requires_authentication"` and an `authentication_url` (no `checkout_url`); only a declined card falls back to `checkout_url` |
| `trip-status` | Full status: cart, quote, fulfillment, bookings, and the Jinko `booking_ref` once payment starts (the Pay button or `agent-pay submit`; `checkout` alone books nothing) — it can be present before payment is authorized, so read `payment_attempt.payment_status` and `fulfillment.status` for paid (the `--booking-ref` for `get-booking` / `hotel-cancel` / `car-cancel` / `refund`) |
| `get-booking` | Retrieve a booking by `JNK-*` ref + last name (guest access). Carries `calendar` — the `.ics` files for the booking's flights and stays; `--format json` carries their contents. |
| `refund check / commit / status` | Voluntary refund flow |
| `car-cancel preview / commit / status` | Car-rental cancellation: `preview` quotes the fee and mints the `quote_id` the commit is bound to (`commit --quote-id`); `commit` cancels (`--manual-ok` hands a `manual_required` quote to a Jinko agent, only with the customer's consent); `status` re-reads the latest attempt. No `car-exchange` exists — modifying a rental is not offered. |
| `schema <command>` | Print request/response schema for a command |
| `config` | Read/write CLI config |

Run `jinko <command> --help` for flags on any command.

Ancillaries: use `--select bag_20kg@pax_1,bag_20kg@pax_2` for per-traveler bags; bare IDs use `--traveler-ref` and `--quantity`.

## Canonical booking flow

```bash
# 1. Find a flight (live pricing, gives trip_item_token)
jinko flight-search --origin PAR --destination NYC \
  --departure-date 2026-06-15 --return-date 2026-06-22 --adults 2

# 2. Create a trip with that item
jinko trip --trip-item-token "offer_xxx:fare_yyy"
# → response includes trip_id (tr_...)

# 3. Add travelers + contact to the trip
# contact.phone is in international format: a leading + and country code, e.g. +12025550147.
# Spaces, hyphens, dots and parentheses are accepted and removed. A number without the leading + is rejected with INVALID_PHONE_NUMBER.
jinko trip --trip-id tr_ABC \
  --travelers '[{"type":"ADT","first_name":"John","last_name":"Doe","date_of_birth":"1990-01-15"}]' \
  --contact '{"email":"john@example.com","phone":"+33612345678"}'

# 4. Checkout — returns canonical Jinko-hosted URL + agent payment params
jinko checkout --trip-id tr_ABC
# → { checkout_url: "https://app.gojinko.com/checkout?sid=12345",
#     agent_spt_params: { max_amount_money: { value: 259449, currency: "EUR",
#       decimal_places: 2, display: "EUR 2594.49" }, ... } }
# The /checkout page renders the cart, collects any remaining info,
# and triggers the right Stripe flow (embedded Elements or Hosted
# Checkout) on Pay-button click.

# 5a. Human path: user pays in browser (or open the URL programmatically)
# 5b. Agent path: mint a Shared Payment Token scoped to agent_spt_params,
#     then pay programmatically (no browser):
jinko agent-pay submit --trip-id tr_ABC --token spt_xxx
# → { status: "processing", payment_verified: true, booking_ref: "JNK-XEVGW5" }
#   On 3-D Secure: { payment_status: "requires_authentication", authentication_url: "…" } and no
#   checkout_url. Send the traveller to authentication_url + "#hv=" + the token's
#   next_action.use_stripe_sdk.value, then poll trip-status. Only a declined card
#   returns a checkout_url fallback (no booking_ref).

# 6. Poll status
jinko trip-status --trip-id tr_ABC
# → booking_ref (JNK-…) is the Jinko reference — pass it as --booking-ref to
#   get-booking / hotel-cancel / refund. bookings[].supplier_references are the
#   supplier's own confirmations, not that handle.
```

## Hotel flow

```bash
# Search by city + dates + occupancy
jinko hotel-search --city "Paris" --checkin 2026-07-15 --checkout 2026-07-18 --adults 2 --nationality FR

# Add to trip (hotel items use htl_ prefixed tokens)
jinko trip --trip-item-token "htl_xxx:rate_yyy"
# Mixed carts work: add both flight and hotel items to the same trip_id → single Stripe checkout
```

## Car rental flow

```bash
# Search — times are BRANCH-LOCAL with no timezone; driver age + residence change the price (ask, never guess)
jinko car-search --pick-up-airport LYS --pick-up-date-time 2026-10-25T10:00:00 \
  --drop-off-date-time 2026-10-28T10:00:00 --driver-age 30 --residence-country FR --currency EUR
# One-way: give the drop-off its own place
jinko car-search --pick-up-airport LYS --pick-up-date-time 2026-10-25T10:00:00 \
  --drop-off-airport CDG --drop-off-date-time 2026-10-28T10:00:00 --driver-age 30 --residence-country FR
# An ambiguous --pick-up-place answers with `candidates` instead of offers: show them and retry with one
jinko car-search --pick-up-place "Lyon Part-Dieu" …

# Book: the offer_id (car_*) is the trip item token; a car cart needs the contact's honorific (title)
jinko trip --trip-item-token car_9f3b2a17c4e8d501 \
  --travelers '[{"first_name":"Jane","last_name":"Doe","traveler_type":"adult"}]' \
  --contact '{"email":"jane@example.com","phone":"+33612345678","title":"ms"}'
jinko checkout --trip-id tr_ABC

# Cancel: preview first (quotes the fee, mints the quote_id), confirm with the user, then commit
jinko get-booking --booking-ref JNK-A7B3X9 --last-name Doe          # find the car booked_item_id
jinko car-cancel preview --booking-ref JNK-A7B3X9 --booked-item-id itm_… --last-name Doe
jinko car-cancel commit  --booking-ref JNK-A7B3X9 --booked-item-id itm_… --last-name Doe --quote-id ccl_…
jinko car-cancel status  --booking-ref JNK-A7B3X9 --booked-item-id itm_… --last-name Doe
```

Reading a car search result: `price.pay_now` is the ONLY amount Jinko charges (`due_at_desk` is paid at the counter, `deposit` is a card hold — never sum them); `package.supplier_name` is the rental company the customer collects from; an EMPTY `cancellation_fees` list means the fee is UNKNOWN, never "free cancellation". On a cancel preview, `fee_known: false` means the same, and `manual_required: true` means a person has to complete it — `car-cancel commit --manual-ok` hands it to a Jinko agent, only once the customer has agreed. Changing a rental (dates, vehicle, extras) is not available: the options are keeping the booking or cancelling it and searching again.

## Multi-item / mixed carts

`jinko trip --trip-id <existing>` reuses the existing cart. Flight + hotel in one cart ships as ONE Stripe checkout.

```bash
# Start with a flight
jinko trip --trip-item-token "offer_abc:fare_1"   # returns trip_id
# Add a hotel to the same trip
jinko trip --trip-id tr_ABC --trip-item-token "htl_xyz:rate_2"
```

## Remove / swap items

```bash
# Remove
jinko trip --trip-id tr_ABC --remove-item-id it_123

# Swap in one call
jinko trip --trip-id tr_ABC --remove-item-id it_123 --trip-item-token "offer_new:fare_new"
```

## Post-booking

```bash
# Retrieve a booking (guest access — no auth needed beyond ref + last name)
jinko get-booking --booking-ref JNK-A7B3X9 --last-name Doe

# Refund: preview, show the refund to the customer, commit what they agreed to, then poll
jinko refund preview --booked-item-id itm_… --booking-ref JNK-A7B3X9 --last-name Doe
jinko refund commit --booked-item-id itm_… --booking-ref JNK-A7B3X9 --last-name Doe --quote-id svq_… --acknowledged '<preview refund JSON>'
jinko refund status --booked-item-id itm_… --booking-ref JNK-A7B3X9 --last-name Doe --operation svc_…
```

## Output tips

- Default is JSON — pipe to `jq` for filtering: `jinko find-destination --from PAR | jq '.destinations[0]'`
- `--format table` gives a compact human view for browsing
- Every command has a `--help` flag and `jinko schema <command>` dumps the full request/response shape

## Common pitfalls

- **Use an API key everywhere.** A tenant API key (`jnk_*`) works across the CLI, the SDK, and MCP Bearer headers — it's the one credential to carry. (OAuth sign-in is deprecated; any legacy WorkOS CLI token in `~/.jinko/config.yaml` is NOT interchangeable with an MCP OAuth token and will fail with an issuer mismatch if pasted into an MCP Bearer header.)
- **IATA codes**: `--origin PAR` uses a CITY code (matches CDG + ORY + BVA); `--origin CDG` uses an airport. Omit `--origin-type` / `--destination-type` and the platform applies one rule: a code that names a multi-airport city is searched as the city, every other code as the airport. LAX, MIA and LAS are both a city code and that city's main airport, so `--destination LAX` alone is the Los Angeles CITY and a live search returns Ontario (ONT) fares too, often cheapest. When the user named the airport, pass `--destination-type airport`.
- **Narrowing filters are applied exactly as sent**: no returned offer violates a filter, and the search never widens (`--include-carriers` returns those carriers only). Empty offers come with an instruction — relay it: it asks which filter to relax when a narrowing filter was sent, and otherwise whether to try other dates or airports.
- **Alternate airports widen the anchor**: `--origin-alternate-airports EWR LGA` adds airports beside `--origin`, never removes results, and the anchor decides ranking — so put the airport that matters most in `--origin`. They work beside a city anchor too: `--origin NYC --origin-alternate-airports BOS` covers New York and Boston.
- **trip_item_token format**: `offer_xxx:fare_yyy` (flight), `htl_xxx:rate_yyy` (hotel) or `car_xxx` (car rental) — pass every token verbatim, never truncated.
- **Token expiry**: offers cached ~30 min (a car offer carries its own `expires_at`). If `checkout` returns a quote failure, re-run `flight-search` / `hotel-search` / `car-search` to get a fresh token.
- **Car date-times carry no timezone**: `2026-10-25T10:00:00` is the rental desk's own local time. A `Z` or an offset is rejected rather than silently shifting the pick-up.
- **Script use**: set `JINKO_API_KEY` env var and use `--format json` so output parses cleanly.

## See also

- MCP-tool equivalents: sibling skill `jinko-travel` (flights, hotels, booking and servicing) and `search-cars` (car rental)
- API docs: `https://docs.gojinko.com`
- Source: `packages/cli/src/commands/` in the `jinko-dev-tools` repo

## Servicing a selected booked item

Run `get-booking --booking-ref <ref>` first (guests add `--last-name`). Select the intended `items[].booked_item_id` and inspect its `servicing` eligibility. Pass `--booking-ref` and the same `--booked-item-id` to refund, exchange, hotel-cancel and car-cancel actions, including status polls. The ID remains stable after an exchange. Owning credentials may omit the surname; guests supply it. When a 409 `item_selection_required` lists several items, choose one from `items[]` before retrying.

## Select seats before checkout

Run `jinko select-ancillaries --trip-id <id> --item-id <id> --seat seat_2202_0:pax_1:14A --seat seat_2202_0:pax_2:14B`.
Get offers and seat numbers from `get-ancillaries` (`seat_map` per segment), and
`traveler_ref` from trip travelers via `trip-status`. Read `price_money` for the exact
price. Choose one available seat per traveler per segment and ask before adding
paid seats. Selections replace the previous set: combine `--select` and `--seat`
to retain both.
