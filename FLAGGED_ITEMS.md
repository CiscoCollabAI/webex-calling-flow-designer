# Flagged Items — Call Queue API Mapping

Open questions surfaced while auditing the Call Queue → Flow Designer mapping against
the [Webex Cloud Calling OpenAPI spec](https://raw.githubusercontent.com/webex/webex-openapi-specs/refs/heads/main/public-spec/webex-cloud-calling.json)
and this project's own live API captures. Each item below was intentionally **not**
silently resolved — either the two sources disagree, or the spec doesn't cover a
field this project currently models. Resolving any of these requires a fresh live
capture (via the in-app `?debugApi=1` debug panel) of a queue configured to exercise
the specific setting in question.

## 1. `audioFiles` field name: `name` vs. `fileName`

- **Where:** `WebexQueueNightService.audioFiles`, `WebexQueueHolidayService.audioFiles`,
  `WebexQueueStrandedCalls.audioFiles`, `WebexQueueForcedForward.audioFiles`,
  `WebexQueueOverflow` (Overflow's own `audioFiles`) — all in `src/types/webex.ts`.
- **Conflict:** Existing code comments state each of these shapes was "confirmed
  against a live org response" using `{ id, name }`. The OpenAPI spec's
  `WebexAudioAnnouncementFile` (used correctly elsewhere, e.g. DNIS announcements)
  says the field is `{ id, fileName, level, mediaFileType, isTextToSpeech }`.
- **Why not resolved:** The live captures that produced the `{ id, name }` comment
  may not have had a populated `audioFiles` array (i.e., the queue was still on the
  default greeting, so no custom file was ever present in the sample to check the
  field name against). Changing this without evidence risks trading a possibly-correct
  live-confirmed name for a guess.
- **To resolve:** Capture a live response for a Night/Holiday/Stranded/ForcedForward/
  Overflow config with a **custom audio file actually uploaded**, and check the real
  key name in `audioFiles[0]`.

## 2. `callPolicies` fields not present in the spec's schema

- **Where:** `WebexQueueCallPolicies.waitingTreatmentEnabled`, `.callTimeoutHandlingEnabled`,
  `.transferToAgentEnabled`, `.transferToAgentAfterN` — `src/types/webex.ts`. Used for
  Priority Escalation and Call Timeout Handling (`src/utils/importCallQueue.ts`:
  `hasPriorityEsc`, `callTimeoutHandlingEnabled` on the Queue node).
- **Conflict:** The spec's `GetCallQueueEssentialsObject.callPolicies` schema only
  documents four properties: `policy`, `callBounce`, `distinctiveRing`, `routingType`.
  These four fields aren't part of it at all.
- **Why not resolved:** Unclear whether these fields (a) don't really exist and were
  always a guess that happened not to break anything, (b) live under a different
  parent object not yet located, or (c) are present in a real response but omitted
  from this particular spec schema. No live capture has specifically checked for
  Priority Escalation or Call Timeout Handling being enabled.
- **To resolve:** Capture a live response for a queue with Priority Escalation and/or
  Call Timeout Handling enabled in Control Hub, and check whether these fields appear
  under `callPolicies` or elsewhere.

## 3. CX Essentials `queueSettings` fields not found in the base spec dump

- **Where:** `WebexQueueSettings.wrapUpTimerEnabled`, `.wrapUpTimer`,
  `.postCallSurveyEnabled`, `.digitalChannelHandoffEnabled`,
  `.digitalChannelHandoffDestinationId` — `src/types/webex.ts`.
- **Conflict:** Not listed among `GetCallQueueEssentialsObject.queueSettings`'s
  documented properties, which stop after the `playToneToAgentFor*` tone settings.
- **Why not resolved:** These are CX Essentials–specific features (comment in code:
  "CX Essentials features"), and the endpoint used (`getCallQueueWithCustomerAssist`)
  may expose additional fields via a CX-Essentials-specific schema variant that
  wasn't crawled during this audit.
- **To resolve:** Either locate the CX Essentials–specific schema in the spec, or
  capture a live response from a queue with `hasCxEssentials: true` and wrap-up/survey/
  digital-handoff features enabled.

## 4. `alternateNumberSettings` — intentionally not modeled

- **Where:** Would live on `WebexQueueDetail` (top-level, per spec).
- **Status:** Not a conflict — a deliberate exclusion. Alternate Numbers is confirmed
  deprecated in favor of DNIS per Webex's own in-product Control Hub deprecation
  notice (verified earlier in this project's history). Noted here only so it isn't
  mistaken for an oversight.

## 5. Callback `dnis` / `announcement` fields — removed, not replaced

- **Where:** `src/utils/importCallQueue.ts`, the Callback node's data block
  (`callbackNumber`, `callbackAnnouncement`).
- **Status:** The old source (`queueSettings.callBacks.dnis` /
  `.announcement.greetingFile.name`) doesn't exist in the spec — the real callback
  toggle is `queueSettings.waitMessage.callbackOptionEnabled`, which has no DNIS or
  announcement sub-fields. `callbackNumber`/`callbackAnnouncement` are now left
  unpopulated for Call Queue imports rather than fed from a guessed path.
- **To resolve:** If Control Hub's Callback option does expose a configurable number/
  announcement somewhere, capture a live response with it configured to find the real
  field — spec's `waitMessage` only additionally documents
  `minimumEstimatedCallbackTime` and `internationalCallbackEnabled`, neither of which
  is a number or announcement.
