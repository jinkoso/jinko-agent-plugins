---
name: jinko-travel
description: Search and book live flights, hotels, and enabled car rentals, manage Jinko trips, and service bookings with the connected anonymous Jinko Grok MCP tools.
compatibility: Grok Bot with access to the jinko-grok MCP server
metadata:
  author: Jinko
  version: "1.0"
  surface: grok-bot
---

# Jinko Travel for Grok Bot

Use the connected `jinko-grok` MCP tools for Jinko travel work. The server is anonymous and supplies its tenant internally. Do not ask for an API key or add authorization headers. Tool descriptions and input schemas returned by the connected server are authoritative when they differ from this guide.

Use the current runtime `tools/list` result to determine which car workflows are enabled on this connection. Car search requires `car_search`. Car cancellation requires all three of `car_cancel_preview`, `car_cancel_commit`, and `car_cancel_status`. If the tools for one workflow are absent, say that specific function is currently not enabled for this connection. Do not describe its absence as a permanent limitation.

## Tool routing

- Destination and flexible-date discovery: `find_destination`, `flight_calendar`, and `find_dates`.
- Scheduled cache polling: `price_monitoring`. It creates no persistent alert; the caller must schedule later calls and notifications.
- Live flight shopping and fare context: `flight_search` and `flight_price_advice`.
- Live hotel shopping and property details: `hotel_search` and `hotel_details`.
- Live car-rental shopping, when listed: `car_search`.
- Cart, traveler, quote, checkout, payment, and lifecycle: `trip`, `checkout`, `submit_agent_payment`, and `get_trip`.
- Booking lookup: `get_booking`.
- Flight cancellation: `flight_refund_check`, `flight_refund_preview`, `flight_refund_commit`, and `flight_refund_status`.
- Flight exchange: `flight_exchange_shop`, `flight_exchange_price`, `flight_exchange_commit`, and `flight_exchange_status`.
- Hotel cancellation: `hotel_cancel_preview`, `hotel_cancel_commit`, and `hotel_cancel_status`.
- Car cancellation, when listed: `car_cancel_preview`, `car_cancel_commit`, and `car_cancel_status`.

## Places and dates

Read [references/places.md](references/places.md) when a place name needs an IATA city or airport code. Preserve whether the traveler named a city or a specific airport. Ask a short clarification when the match is ambiguous. Use exact future dates for live searches; resolve relative dates with the user's locale and current date.

## Flight shopping

Keep the user's actual party, cabin, airports, date limits, stop limits, carrier preferences, baggage needs, refundability, changeability, and budget throughout the workflow.

- When the destination is open, use `find_destination`. Its cached fare is for one adult and is indicative. Continue with `flight_calendar` and then live pricing for the real party.
- When the route is known but dates are flexible, use `flight_calendar` for the complete date view or `find_dates` for a compact shortlist. Cached prices are indicative and priced for one adult.
- When the route and dates are exact, use `flight_search` for live pricing. Pass the user's real passenger counts and all applicable filters. If they named an airport such as LAX, set the matching airport type so the search does not expand to a city.
- Before booking a cached result, follow its current `next` guidance or price-check its offer token with `flight_search`. A cached miss is not proof that no live flight exists.
- Use `flight_price_advice` only to explain a supplied fare; it does not search, quote, monitor, or book.
- Use `price_monitoring` only for a scheduled cache snapshot. Its amount is one adult, and a stale result should not trigger a tight retry loop.

Show the best relevant options with total price, currency, itinerary, stops, fare conditions, and which constraints each option satisfies. Never claim availability beyond the live response.

## Hotel shopping

Use `hotel_search` with the actual check-in, checkout, party, room count, child ages, destination, and budget. A search without a party defaults on the server; disclose that default and confirm the real party before adding an item. Re-search when the confirmed party differs.

Use the continuation handle by itself when requesting the next page. Use `hotel_details` after a search when the user wants gallery, facility, policy, or room metadata. Treat property policies as separate from the selected rate's cancellation terms. Show nightly and total price, taxes or fees, room and occupancy, cancellation terms, and important constraints from the live result.

## Car-rental shopping

Use `car_search` only when it appears in the current tool list. Collect the exact pick-up and return places and branch-local date-times, plus the real `driver_age` at pick-up and `residence_country`; both fields affect price and are required, so never guess them. Send branch-local date-times as `YYYY-MM-DDTHH:MM:SS` without `Z` or a UTC offset. Prefer an IATA `airport_code` when the traveler named an airport. For a round trip, omit `drop_off` and supply `drop_off_date_time`. For a one-way rental, supply `drop_off` with its place and `date_time`. If a free-text place is ambiguous, show the returned candidates and let the user choose.

Present the rental company, vehicle or-similar status, rate package, pick-up and drop-off branches, `price.pay_now`, desk charges, deposit, coverage, mileage, fuel policy, cancellation terms, `on_request`, and important restrictions from the selected offer. Keep amounts in their stated roles and currencies; do not sum `due_at_desk`, a deposit, or an estimated supplier total into Jinko's `pay_now` amount. An empty cancellation-fee schedule or an absent amount is unknown and must never be presented as zero or free cancellation.

Follow each branch's `requires_flight_number` value. The current `car_search` schema has no field that can carry a flight number. A branch marked `always` therefore cannot be booked through this connection; explain the limitation and ask the user to select a bookable branch or offer. Report `out_of_hours_pickup` as a supplier policy only. The response has no opening hours with which to decide whether it applies, so do not claim that the condition has been met.

Treat `expires_at` as the offer deadline. If a selected quote expires or becomes unavailable, repeat the live search with the confirmed criteria, show the replacement options, and let the user choose again before adding an item. Do not substitute an offer automatically.

## Trip and checkout

Follow `flight_search`, `hotel_search`, or enabled `car_search` with `trip` `add_item`. Pass the selected car offer's `car_*` `offer_id` verbatim as `trip_item_token`. Flights, hotels, and cars can share a trip. For multiple rooms at the same hotel, follow the current `trip` schema for one multi-room item instead of adding separate bookings.

Before `trip` `upsert_travelers`, collect every required value from the traveler. At minimum, follow the live schema for each traveler's real `first_name`, `last_name`, and `passenger_type`, and for the contact's real `email` and international `phone`. A car cart also requires the booking contact's real `contact.title` honorific; ask for it and do not infer one. Never invent names, birth dates, gender, email, phone, title, or document data. Do not ask for or send passport, visa, known-traveler-number, or redress numbers because these tools do not collect them.

Call `checkout` only after the selected items and real traveler details are present. Checkout prices the trip and returns a `checkout_url`; it does not itself charge or book. If travelers or selected ancillaries change, call checkout again and use only the newest quote and payment artifacts. Use `get_trip` to read quote, payment, fulfillment, and booking status. A `booking_ref` can exist before payment completes, so verify payment and fulfillment fields.

For a car offer with `on_request: true`, successful payment starts asynchronous supplier fulfillment. Treat `pending` or `on_request` as awaiting supplier confirmation and keep checking `get_trip`; do not tell the user the rental is confirmed until fulfillment reaches a confirmed terminal state.

Payment has two supported paths:

1. Give the traveler the returned `checkout_url` for web payment.
2. Use `submit_agent_payment` only when `checkout` returns `agent_spt_params` and the active environment can mint a Shared Payment Token scoped to them. If customer authentication is required, combine `authentication_url` with the issued token's `next_action.use_stripe_sdk.value` as the unchanged `#hv=` fragment, hand the complete URL to the traveler, and poll `get_trip`. That value does not come from `submit_agent_payment`.

If the connected environment lacks the agent-payment integration, use the web checkout path. Never collect card details in chat.

## Booking service

Begin post-booking service with `get_booking` using the Jinko `booking_ref` and the primary traveler's `last_name`. Choose the intended `items[]` entry and keep its `item_id` through every later call. The airline locator or hotel confirmation number is not the Jinko booking reference.

### Flight cancellation

- `flight_refund_check` is a read-only eligibility probe. It produces no customer amount or committable quote.
- Call `flight_refund_preview` for the penalty, customer refund, covered documents, support level, and quote handle.
- Show the exact preview figures and obtain explicit approval before `flight_refund_commit`. Copy acknowledged amounts from the preview; do not recompute them. If the amount changes, show the replacement quote and ask again.
- Poll `flight_refund_status` with the returned operation until it reaches a terminal state. Describe manual-required results as pending Jinko handling.

### Flight exchange

- Call `flight_exchange_shop` with the exact booked segments being changed and the requested new dates.
- Call `flight_exchange_price` for the chosen offer. Show the amount due or refund, fee, ticket values when present, and the new fare's refund, change, and baggage terms.
- Obtain explicit approval before `flight_exchange_commit`. Use the returned session reference when present; follow the current tool description for a manual path when it is absent.
- Poll `flight_exchange_status` until the operation reaches a terminal state. Continue using the same booking reference and item ID.

### Hotel cancellation

- Call `hotel_cancel_preview` for the penalty, refund, cancellation policy, and quote handle. An unknown fee is not free cancellation.
- Show the exact figures and obtain explicit approval before `hotel_cancel_commit`. Copy the acknowledged refund from the preview. If the amount changes, show the new quote and ask again.
- Poll `hotel_cancel_status` with the returned operation until cancellation and refund reach terminal states.

### Car cancellation

Use these steps only when all three `car_cancel_*` tools appear in the current tool list. Do not look for a car exchange tool; changing a rental requires keeping the booking or cancelling it with approval and searching again.

- Begin with `get_booking` using `booking_ref` and the primary traveler's `last_name`. Choose the intended car entry from `items[]` and keep its `item_id` for each later step.
- Call `car_cancel_preview` with the same `booking_ref`, `last_name`, and selected `item_id`. It changes nothing and returns the current fee, refund information, and a `ccl_` `cancellation_id`.
- Show the fee and refund exactly as returned and obtain explicit user approval before `car_cancel_commit`. If `fee_known` is false or an amount is absent, describe it as unknown; never substitute zero. Pass the preview's unchanged `cancellation_id`.
- Send `manual_ok: true` only when the result says manual handling is required and the user explicitly agrees to a Jinko agent completing the cancellation. It is customer consent, not a retry flag.
- Poll `car_cancel_status` with `booking_ref`, `last_name`, and `item_id`. It takes no `operation` handle. A pending result is unfinished, so do not commit again or poll in a tight loop; follow the server's timing guidance or wait a reasonable interval before checking again.

## Errors and user control

Explain the server's original error and the next useful action. Do not repeat an unchanged failing call. Never substitute a different itinerary, property, or car offer when an offer becomes unavailable; return to live search and ask the user to choose again. Require explicit approval immediately before any payment, refund commit, exchange commit, hotel cancellation commit, or car cancellation commit.
