# Booking — trip, checkout, payment, inspection, servicing

The step order is in [SKILL.md › End-to-end booking flow](../SKILL.md#end-to-end-booking-flow). This
file carries the detail of each tool. All five tools below cost 1 credit per call.

## trip

Create and manage a trip: add flight or hotel items, remove items, set traveler details, and select
ancillaries. Returns `trip_id` for use with the `checkout` tool. Flights and hotels can coexist in the
same trip (single Stripe checkout).

Operations:

- `add_item`: add a flight or hotel to the trip. Pass `trip_item_token` from `flight_search`
  (`offer__*` tokens) or `offer_id` from `hotel_search` (`htl_*` tokens). Omit `trip_id` to create a
  new trip.
  - MULTI-ROOM HOTEL: to book several rooms of the SAME hotel and stay as ONE booking with ONE
    reference, make ONE `add_item` call with `rooms: [{trip_item_token: "htl_..."}, ...]` (2–8
    entries, one `htl_*` rate token per room, mutually exclusive with `trip_item_token`;
    HotelBeds-inventory tenants only) — do NOT add the same hotel twice as separate items.
- `remove_item`: remove an existing item from the trip by `item_id` (from the trip response
  `items[].item_id`). Requires an existing `trip_id`. Can be combined with `add_item` in a single call
  to swap an item — remove runs first, then add.
- `upsert_travelers`: set traveler details and contact info on an existing `trip_id`.
- `select_ancillaries`: select bags, seats, meals for a quoted trip item. Requires `trip_id` and
  `item_id`.

Traveler data — IMPORTANT: NEVER invent or fabricate traveler data. Before calling
`upsert_travelers`, you MUST ask the user for the required fields:

- Always: `first_name`, `last_name`, `passenger_type`
- Flights only: `date_of_birth` (YYYY-MM-DD), `gender` (male/female) — required when the trip contains
  a flight, optional for hotel-only trips
- Contact: `email`, `phone` (with country code)

If a required field is missing, ASK the user. Do not use placeholder or default values.

Ancillary flow: add the item and set travelers, then quote/price before selecting ancillaries.
On Builder MCP, call `checkout` to quote (do not pay yet), then `get_trip` to read each item's
`available_ancillaries`. Offer them before payment. Use `trip(select_ancillaries)` with the returned
`offer_id`s, then call `checkout` again for the updated total. Full replacement — send all desired
selections, including bags and seats, in each call.

### Seat selection

Each seat offer (`type: "seat"`) covers one segment and carries `seat_map.seats[]`. Show only
`available: true` seats, their `seat_number`, whether `chargeable`, and the price per passenger for
that segment. Free seats cost 0 (their price may be absent); show the returned price for paid seats
and ask before choosing one. REST's exact seat price is `price_money`.

Take `pax_ref_id` from the trip's `travelers[].pax_ref_id`. Send one selection per passenger per
segment: `{offer_id, pax_ref_id, segment_ref_ids: [that offer's segment], seat_number}`. Each
passenger gets at most one seat per segment; two passengers cannot share a seat.

- Builder MCP: `checkout` → `get_trip` → `trip(select_ancillaries)` → `checkout` → payment.
- REST: `GET /v1/trip/{trip_id}/ancillaries` quotes automatically; wait for `status: "ready"`
  (`202` / `status: "pricing"`: poll the same URL using `Retry-After`), then
  `POST /v1/select_ancillaries` with `trip_id`, `item_id`, and `selections`, then checkout.
- CLI (`@gojinko/cli`): `jinko get-ancillaries --trip-id <id>` quotes and lists the map; then
  `jinko select-ancillaries --trip-id <id> --item-id <item> --seat <offer_id>:<pax_ref_id>:<seat_number>`.
  Repeat `--seat` for each passenger/segment; check the listing is ready before selecting.

The checkout total includes selected seat prices. Paid seats are issued after ticketing; a seat
refused by the airline is refunded automatically without failing the flight booking. Read
`booked_ancillaries` for the actual seat outcome, including `seat_number`, `pax_ref_id`,
`segment_ref_ids`, `status` and `failure_reason`; selection alone is not confirmation.
Changing seats after booking/fulfillment is refused: HTTP 409,
"trip is fulfilled and can no longer be modified".

Flows:

- Flights: `flight_calendar` → `flight_search` → `trip(add_item)` → `trip(upsert_travelers)` →
  [`checkout` → `get_trip` → `trip(select_ancillaries)`] → `checkout`
- Hotels: `hotel_search` → `trip(add_item)` → `trip(upsert_travelers)` → `checkout`
- Mixed: both in the same trip — one cart, one checkout

## checkout

Checkout a trip — returns the web `checkout_url` a human opens to pay, plus the `agent_spt_params` an
agent can use to pay programmatically (no browser).

Prepare the trip before payment:

- `trip(add_item)` → add the chosen flight or hotel to the trip
- `trip(upsert_travelers)` → set traveler details + contact info
- `trip(select_ancillaries)` [optional] → select bags / seats / meals after quoting, before payment (flights only; see [seat selection](#seat-selection))

Usage: `checkout({ trip_id })`

The BFF schedules a quote, polls until it completes, schedules fulfillment, and returns a Stripe
checkout URL — all in one synchronous call.

- Human path: open the returned `checkout_url` in a browser to pay. Stripe webhooks finalize the
  booking after payment succeeds; no client-side confirm step is required.
- Agent path: mint a Shared Payment Token scoped to `agent_spt_params`, then call
  `submit_agent_payment({ trip_id, shared_payment_token })`.

IMPORTANT: never fabricate traveler data. Always make sure `trip(add_item)` and
`trip(upsert_travelers)` have been called with real user-provided data first.

## submit_agent_payment

Submit a Shared Payment Token (SPT) to schedule the agent fulfillment and authorize the booking
server-side in one call. This is the agent-pay alternative to sending the user to a checkout page.

Prerequisite: call `checkout` first to get `agent_spt_params`, then mint an SPT scoped to those
params.

Usage: `submit_agent_payment({ trip_id, shared_payment_token })`

On success the booking proceeds to fulfillment (`{ status, payment_verified: true, booking_ref }`).
`booking_ref` (JNK-XXXXXX) is the Jinko booking reference — keep it (see the section on references
below). It is the direct way an agent paying by SPT obtains that reference (no confirmation email);
`get_trip(trip_id)` returns the same `booking_ref` if this reply is lost. If the issuer requires
customer action (3DS) or declines, the response carries a `checkout_url` instead of `booking_ref` —
open it in a browser to complete payment manually.

## get_trip

Fetch the full lifecycle state of a trip — cart contents, travelers, quote status, fulfillment status,
and any booking references already produced.

Usage: `get_trip({ trip_id })`

This is a read-only call. Use it to inspect a trip after `trip(add_item)`, `trip(upsert_travelers)`,
or `checkout` — for example to confirm what items / travelers are currently on the cart, or to check
whether a booking has been finalized post-checkout.

## get_booking

Retrieve a booking using the Jinko booking reference and the traveler's last name. No login required.

Usage: `get_booking({ booking_ref: "JNK-A7B3X9", last_name: "Doe" })`

Returns booking details: status, travelers, itinerary items with confirmation numbers (PNR for
flights, confirmation number for hotels).

## `booking_ref` vs `bookings[].booking_reference`

- `booking_ref` is the Jinko booking reference. Format: `JNK-XXXXXX` (6 uppercase alphanumeric
  characters). It is found in the confirmation email sent after booking and returned as `booking_ref`
  by `get_trip` and `submit_agent_payment`. It is what `get_booking`, `hotel_cancel` and
  `flight_refund` take as `booking_ref`.
- In `get_trip`, `booking_ref` is present as soon as a fulfillment cart exists (fulfillment
  scheduled), which can be before payment completes — do not treat its presence as paid; check
  `fulfillment.status`. The value never changes afterwards.
- `bookings[].booking_reference` is the SUPPLIER confirmation (airline PNR / hotel confirmation
  number). Do not pass it to `get_booking` — supplier references are rejected.

## Multi-domain cart

Flights and hotels can be added to the same trip. One cart, one Stripe checkout. Use `trip(add_item)`
with either a flight `trip_item_token` (`offer__*`) or a hotel `offer_id` (`htl_*`). Car
offers (`car_search`) go through the same `trip(add_item)` → `upsert_travelers` → `checkout` path
(summary below). So do ground connections (`find_ground`), only where that tool is listed.

## After booking: refunds, exchanges, cancellations

No login required — authenticate with `booking_ref` + `last_name`. Before cancelling, you can call
`get_booking` to inspect the booking and confirm what you are about to cancel.

The shared contract for every servicing tool:

1. Preview first (`action: "preview"`, or `shop` → `price` for `flight_exchange`). The preview costs
   nothing and cancels / changes nothing. It returns the figures and the handle that a later commit
   requires.
2. Show the customer the amount and get their explicit confirmation — especially when money moves.
3. `action: "commit"` with the handle from the preview. Never commit without a preview.
4. `action: "status"` to read the outcome / poll progress.

`fee_known: false` means the fee or penalty is UNKNOWN — tell the customer we will confirm the amount.
That is NOT free cancellation. (`car_search`: an EMPTY `cancellation_fees` list means the same —
unknown, never "free cancellation".)

Per tool (the flow line only; the rest of each tool's rules stays in its description — read it before
calling):

- `flight_refund` — cancel a booked flight, refunding the tickets or voiding them while they are still
  inside the airline's void window: preview → (user confirms the amount) → commit → status.
  The fare refund is immediate; a paid seat settled by the airline is separate, in `seat_refunds`
  with `status: "pending_airline_refund"`. Show each pending seat line from the preview and tell the
  traveller: "Your seat will be refunded once the airline refunds us." Never promise that seat
  refund immediately or include it in the immediate fare refund. A second cancellation of an
  already-cancelled booking is refused with `reason_code: "already_cancelled"` (also at preview).
- `flight_exchange` — exchange a booked flight for a different itinerary: shop → price → (user
  confirms) → commit → status. Pass the `session_reference` from pricing to commit. A price refused
  because the exchange can't be refunded automatically returns no `session_reference`: if the traveller
  confirms, commit the same `offer_id` without one, which sends the request to Jinko support. That commit
  answers with `manual_handling: { status: "pending" }`; tell the traveller Jinko support will complete
  the exchange and the refund; until then `get_booking` shows the exchange as with Jinko support.
- `hotel_cancel` — cancel a hotel booking: preview → (user confirms) → commit → status.
- `ground_cancel` / `ground_exchange` (only when listed in your tools; not on every deployment) —
  cancel, or exchange for a new date and/or stations: preview → (user confirms) → commit → status.
  Refunds may be split between the original card and a carrier voucher; positive `delta_amount` = the
  user owes more, negative = refund. The carrier may reject either — surface `rejected_reason`.
- `car_cancel` — cancel a rental and refund less the fee: preview → (user confirms) → commit →
  status. To change a rental instead, use `car_exchange`.
- `car_exchange` — change a rental in place (dates, vehicle, rate extras): preview → (user confirms)
  → commit → status. This is the tool for "change my dates", "modify", "amend", "upgrade" and for
  changing extras (child seat, GPS). There is no `"price"` action — a preview is already priced.

## Ground and car bookings (summary)

Search and booking detail for these tools stays in their descriptions and in the server instructions;
this is the shape of the flow only.

- Ground (Distribusion; only when `find_ground` is in your tool list, never offer it otherwise):
  `find_ground(departure_city + arrival_city + departure_date)` — 5-character Distribusion CITY CODES
  ("FRPAR", "GBLON"), never names and never IATA → `trip(add_item)` with the connection's
  `trip_item_token` passed VERBATIM (optionally `fare_class`; never `fares[].offer_id`) →
  `trip(upsert_travelers)` with travellers AND contact (email and phone required; many carriers also
  require title, street_and_number, city, zip_code, country_code) → `checkout(trip_id)`, same as flights.
- Car (Auto Europe): `car_search(pick_up + drop_off_date_time + driver_age + residence_country)` →
  `trip(add_item)` with the offer's `car_` `offer_id` as `trip_item_token` (cart-add re-prices at the
  supplier, so an expired offer surfaces here) → `trip(upsert_travelers)` with travellers AND contact,
  including `contact.title` (an honorific: "mr", "ms", "dr", …; without it checkout refuses the cart
  before any card is charged) → `checkout(trip_id)` (only `price.pay_now` is charged; `due_at_desk`
  and `deposit` are collected at the rental desk) → fulfillment is asynchronous: watch
  `get_trip(trip_id)`; offers marked `on_request` legitimately sit pending while the supplier confirms.
