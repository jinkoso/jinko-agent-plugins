# Cars — search, book and cancel

The current connection's `tools/list`, descriptions and input schemas are authoritative. Car search
is available when `car_search` is listed. Cancellation is available when either aggregate
`car_cancel` is listed with `preview`, `commit` and `status` actions, or all three split tools
`car_cancel_preview`, `car_cancel_commit` and `car_cancel_status` are listed. Do not infer capability
from the tool count or deployment name. A partial split set is insufficient for a cancellation
workflow.

## Search

Before `car_search`, collect the actual:

- pick-up place and branch-local pick-up date-time;
- return place and branch-local return date-time;
- driver's age at pick-up (`driver_age`, 18–99); and
- driver's country of residence (`residence_country`, ISO 3166-1 alpha-2).

Age and residence affect the price and eligibility. Never guess either. Date-times use
`YYYY-MM-DDTHH:MM:SS` in the rental branch's local time, without `Z` or a UTC offset.

Each end names exactly one place using the shapes accepted by the current schema:

- `airport_code`: a three-letter IATA code; prefer it when the traveler named an airport;
- `place`: free text resolved by the server; or
- `geo`: `{latitude, longitude, range}` where accepted. The current schema permits this only for a
  round trip.

For a round trip returning to the pick-up branch, omit `drop_off` and send
`drop_off_date_time`. For a one-way rental, send `drop_off` with exactly one place shape and its
`date_time`; do not also send top-level `drop_off_date_time`.

If the result is `ambiguous_place`, show the returned candidates and let the user choose. Search
again with that choice; never auto-pick a branch. If offers were omitted or the tool asks for a
narrower request, narrow the dates, place or radius rather than treating the shown offers as the
complete result.

## Presenting offers

Each offer has a `car_*` `offer_id`, expiry, vehicle, rate package, pick-up and drop-off branches,
price and restrictions. Present the fields a traveler needs to choose:

- rental company (`package.supplier_name`), vehicle and whether the exact model is guaranteed;
- rate package, branches and branch-local date-times;
- `price.pay_now`, any amount due at the desk, deposit and supplier estimate in their stated roles
  and currencies;
- coverage, mileage, fuel policy, cancellation schedule and important restrictions.

`price.pay_now` is the amount Jinko charges through checkout. An amount returned as
`due_at_desk` / `pay_at_desk` is collected at the rental desk; `deposit` is a card hold; an estimated
supplier total may move with foreign exchange. Never add these amounts together. An empty
`cancellation_fees` list means the supplier published no schedule, so the fee is unknown. A missing
coverage excess means it was not stated.

Read readiness restrictions from the current `car_search` description and result. For example, the
current public schema has no input or trip field for a flight number: an offer whose branch always
requires one cannot be booked. Explain the restriction and let the user select another bookable
branch or offer; never invent a field or silently substitute a car. An `out_of_hours_pickup` flag
reports a policy, but the current rate result has no opening hours with which to decide whether it
applies, so do not promise that offer is ready to book.

## Booking

The selected offer uses the shared booking flow:

1. Pass its `car_*` `offer_id` verbatim to `trip(add_item)` as `trip_item_token`. Adding the item
   re-prices it; if it expired or became unavailable, run `car_search` again and let the user choose.
2. Call `trip(upsert_travelers)` with real traveler and contact data. A car cart requires the booking
   contact's real `contact.title`; ask for it and never infer an honorific.
3. Call `checkout`. It prices the trip and returns payment artifacts; it does not charge or book.
4. Complete the web or agent payment path in [booking.md](booking.md#checkout), then inspect
   `get_trip`. `pay_now` is charged through Jinko; desk payment and deposit keep the roles shown in
   the search result.

Cars can share a trip with supported flight and hotel items. The real driver/travelers and contact
still go through `trip(upsert_travelers)`. Do not add fields that the `trip` schema does not define.

An `on_request` offer requires supplier confirmation. Payment or the presence of `booking_ref` does
not turn it into a confirmed rental. Read payment and `fulfillment.status` from `get_trip` and report
pending fulfillment as pending.

## Cancellation

There is no `car_exchange`. A date, vehicle, upgrade or extras change requires keeping the rental,
or cancelling it after approval and searching for a new offer. Cancellation itself requires the
preview and approval below. If the user also wants a replacement, present the new search results and
add only the offer they select to a trip; never substitute one automatically.

Always start with `get_booking` and choose the intended car from `items[]`. On a fixed-tenant guest
surface, send the same valid Jinko `booking_ref`, non-empty primary-traveler `last_name`, and exact
selected `item_id` on preview, commit and status. On Builder, an authenticated owner may omit
`last_name` only when the current schema permits it; follow that schema.

Use the shape the current connection exposes:

- Aggregate: `car_cancel({action: "preview", ...})`, then `action: "commit"`, then
  `action: "status"`.
- Split: `car_cancel_preview(...)`, then `car_cancel_commit(...)`, then
  `car_cancel_status(...)`.

Preview changes nothing. It returns the current fee/refund result and a `ccl_` `cancellation_id`.
Show the figures exactly as returned and get explicit user approval before commit. If `fee_known` is
false or an amount is absent, say the fee or refund is unknown; never substitute zero.

Commit with the unchanged `cancellation_id`. If the preview expired or the amount changed, preview
again or use the replacement quote returned by the tool, show the changed result, and obtain fresh
approval before commit. Do not automatically retry a commit.

When preview returns `manual_required`, send `manual_ok: true` only after the user explicitly agrees
that a Jinko agent may complete the cancellation. This records pending manual handling; it does not
send the cancellation to the rental company in that call, and a final refund may still need review.
`manual_ok` is customer consent, never a retry flag.

Status uses the same `booking_ref`, `last_name` where required, and `item_id`. It takes no operation
handle or `cancellation_id`. A pending result is unfinished: check status later rather than committing
again, but do not run an automatic polling loop. Surface a rejected reason; if status reports no
attempt, begin with preview.
