# Flagged Items — Call Queue API Mapping

Open questions surfaced while auditing the Call Queue → Flow Designer mapping against
the [Webex Cloud Calling OpenAPI spec](https://raw.githubusercontent.com/webex/webex-openapi-specs/refs/heads/main/public-spec/webex-cloud-calling.json)
and this project's own live API captures. Each item below was intentionally **not**
silently resolved — either the two sources disagree, or the spec doesn't cover a
field this project currently models. Resolving any of these requires a fresh live
capture (via the in-app `?debugApi=1` debug panel) of a queue configured to exercise
the specific setting in question.

## 1. ~~`audioFiles` field name: `name` vs. `fileName`~~ — RESOLVED

- **Where:** `WebexQueueNightService.audioFiles`/`.manualAudioFiles`,
  `WebexQueueHolidayService.audioFiles`, `WebexQueueStrandedCalls.audioFiles`,
  `WebexQueueForcedForward.audioFiles` — all in `src/types/webex.ts`.
- **Resolution:** Confirmed via five separate live captures (queue-level DNIS
  announcements, Forced Forward, Night Service, Holiday Service, Stranded Calls'
  `ANNOUNCEMENT` action) — every sample shows `fileName`, none show `name`. All five
  interfaces now use the shared `WebexAudioAnnouncementFile` type (already correct
  for DNIS announcements) instead of a separate unconfirmed inline shape. Updated the
  four read sites in `importCallQueue.ts` (Night/Holiday/ForcedForward/Stranded
  announcement nodes) from `.name` to `.fileName`.
- **Note:** `WebexQueueOverflow` does not currently model an `audioFiles` field at
  all (only `greeting`), so there was nothing to fix there.

## 2. ~~`callPolicies` fields not present in the spec's schema~~ — RESOLVED

- **Where:** `WebexQueueCallPolicies.waitingTreatmentEnabled`, `.callTimeoutHandlingEnabled`,
  `.transferToAgentEnabled`, `.transferToAgentAfterN` — `src/types/webex.ts`. Used for
  Priority Escalation and Call Timeout Handling (`src/utils/importCallQueue.ts`:
  `hasPriorityEsc`, `callTimeoutHandlingEnabled` on the Queue node).
- **Resolution:** Confirmed absent from the **entire** public Webex Cloud Calling
  OpenAPI spec — not just `callPolicies`. Searched the whole spec file for
  `transferToAgent`, `waitingTreatment`, `callTimeoutHandling`, and escalation-related
  terms: zero matches anywhere. Also confirmed `GetCallQueueEssentialsObject` (the
  Get-details-for-a-Call-Queue-or-Customer-Assist-Queue response) has no `allOf`
  composition to hide an extra branch, and `ModifyCallQueueObject` (the write schema)
  has an identical, equally bare `callPolicies` shape. These fields are not
  API-exposed at all, in either direction.
- **Flow Designer fix:** Since the value can never be anything but a guessed `false`
  default on import, added `priorityEscalationSourceUnknown` /
  `callTimeoutHandlingSourceUnknown` flags — set `true` only by the importer (never
  set for manually-built flows). `PropertiesPanel.tsx`'s `QueueFields` now shows an
  explicit "Not available via API — configure manually if used" note whenever a flag
  is set, instead of silently presenting an unchecked checkbox / omitted section as if
  it were confirmed Webex state. The underlying toggles remain fully editable in both
  imported and manually-built flows.

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
