# API sample responses

Real (PII-redacted) Webex Calling API responses captured via the app's debug panel
(`?debugApi=1`), kept here so future debugging can check assumed field names/shapes
against ground truth instead of guessing — the same discipline already used in the
"confirmed via live capture" comments throughout `src/types/webex.ts`.

## call-queue-detail.sample.json

`GET /telephony/config/locations/{locationId}/queues/{queueId}` for a Skill-Based
routing queue ("Call-Queue-Support") with Overflow set to Transfer to Phone Number.

Confirmed by this sample:

- `queueSettings.overflow.action` is genuinely `"TRANSFER_TO_PHONE_NUMBER"`, and the
  destination field is `transferNumber` — not `transferToPhoneNumber` or
  `transferPhoneNumber` (both were prior guesses). This was the root cause of
  Overflow's Transfer setting never rendering on canvas; see
  `src/utils/importCallQueue.ts`'s Overflow action block and
  `src/types/webex.ts`'s `WebexQueueOverflow`.
- `queueSettings.overflow.audioAnnouncementFiles` — Overflow's announcement audio
  uses the same field name as Welcome/Comfort messages, not the `audioFiles` shape
  used by Night Service/Holiday/Stranded Calls/Forced Forward.
- `agents[].location` — each agent carries a `{ name, id }` location, not currently
  read into any node (see the audit note in the PR/commit that added this file).
- `alternateNumberSettings` — a legacy, still-present structure distinct from DNIS
  (`alternateNumbers` is empty in this sample, but the field exists on the API).
