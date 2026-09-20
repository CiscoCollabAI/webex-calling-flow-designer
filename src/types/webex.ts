// Webex REST API response types used by the read-only org integration

export interface WebexMe {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  emails: string[];
  orgId: string;
  avatar?: string;
}

export interface WebexOrg {
  id: string;
  displayName: string;
}

export interface WebexLocation {
  id: string;
  name: string;
  address?: {
    address1?: string;
    city?: string;
    country?: string;
  };
  timeZone?: string;
}

export interface WebexQueue {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  phoneNumber?: string;
  extension?: string;
  enabled?: boolean;
  language?: string;
  languageCode?: string;
}

export interface WebexUser {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  emails: string[];
  extension?: string;
  locationId?: string;
  locationName?: string;
  phoneNumbers?: { type: string; value: string }[];
}

export interface WebexSchedule {
  id: string;
  name: string;
  type: 'businessHours' | 'holidays';
  locationId?: string;
  locationName?: string;
}

export interface WebexNumber {
  phoneNumber: string;
  extension?: string;
  location?: {
    id: string;
    name: string;
  };
  state?: string;
  mainNumber?: boolean;
  tollFreeNumber?: boolean;
}

export interface WebexAnnouncement {
  id: string;
  name: string;
  fileName?: string;
  mediaFileType?: string;
  locationId?: string;
  locationName?: string;
}

export interface WebexAutoAttendant {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  phoneNumber?: string;
  extension?: string;
  enabled?: boolean;
}

// ── Auto-Attendant detail types ───────────────────────────────────────────────

export type WebexAAAction =
  | 'TRANSFER_WITH_PROMPT'
  | 'TRANSFER_WITHOUT_PROMPT'
  | 'TRANSFER_TO_OPERATOR'
  | 'CALL_QUEUE'
  | 'HUNT_GROUP'
  | 'AUTO_ATTENDANT'
  | 'PLAY_ANNOUNCEMENT'
  | 'DISCONNECT'
  | 'EXIT'
  | 'REPEAT_MENU'
  | 'VOICEMAIL'
  | 'EXTENSION_DIALING'
  | 'NAME_DIALING'
  | 'OPERATOR';

export interface WebexAAKeyConfig {
  // Actual API format: array item with explicit key field
  key?: string;               // DTMF digit: "0"–"9", "*", "#"
  action: WebexAAAction;
  description?: string;
  // New API format: phone number / extension in generic "value" field
  value?: string;
  // Legacy field names (kept for forward-compat)
  transferPhoneNumber?: string;
  callQueueId?: string;
  huntGroupId?: string;
  autoAttendantId?: string;
  // Audio file — new API format
  audioAnnouncementFile?: {
    id?: string;
    fileName?: string;
    mediaFileType?: string;
    level?: string;
  } | null;
  // Legacy audio file format
  audioFile?: { name?: string; mediaFileId?: string } | null;
}

export interface WebexAACallTreatment {
  // Seconds to wait for DTMF input before treating silence as no-input
  noInputTimer?: number;
  // "ONE_TIME" | "TWO_TIMES" | "THREE_TIMES" | "FOUR_TIMES" | "FIVE_TIMES"
  retryAttemptForNoInput?: string;
  actionToBePerformed?: {
    // "PLAY_MESSAGE_AND_DISCONNECT" | "REPEAT_MENU" | "TRANSFER_TO_OPERATOR" | "DISCONNECT"
    action?: string;
    greeting?: 'DEFAULT' | 'CUSTOM';
  };
}

export interface WebexAAMenuConfig {
  greeting?: 'DEFAULT' | 'CUSTOM';
  greetingFile?: { name?: string } | null;
  extensionEnabled?: boolean;
  nameDialing?: boolean;
  transferToOperatorEnabled?: boolean;
  // Timing & retry live inside callTreatment in the actual API response
  callTreatment?: WebexAACallTreatment;
  // Fallback fields used by some older org firmware versions
  noInputTimeout?: number;
  maxMenuRepeat?: number;
  invalidKeyHandledBy?: string;
  // Actual API returns an array; legacy format was Record<digit, config>
  keyConfigurations?: WebexAAKeyConfig[] | Record<string, Omit<WebexAAKeyConfig, 'key'>>;
  // Legacy: separate operator-transfer field (not present in current API)
  zeroTransferAction?: WebexAAKeyConfig | null;
}

export interface WebexScheduleEvent {
  name?: string;
  startTime?: string;   // "HH:MM"
  endTime?: string;     // "HH:MM"
  allDayEnabled?: boolean;
  recurrence?: {
    recurForEver?: boolean;
    recurWeekly?: {
      scheduleDay?: string; // "MONDAY" | "TUESDAY" | ...
    };
    recurAnnuallyByDay?: {
      day?: number;
      month?: number;
    };
  };
}
export interface WebexScheduleDetail {
  id: string;
  name: string;
  type: 'businessHours' | 'holidays';
  locationId?: string;
  events?: WebexScheduleEvent[];
}

export interface WebexAACallForwarding {
  // Webex returns call forwarding either as a flat boolean or nested object
  enabled?: boolean;
  // "always" forward sub-object (present in some API versions)
  always?: { enabled?: boolean; destination?: string; destinationVoicemailEnabled?: boolean };
}

export interface WebexAutoAttendantDetail extends WebexAutoAttendant {
  firstName?: string;
  lastName?: string;
  timeZone?: string;   // capital Z — matches actual API field name
  languageCode?: string;
  businessSchedule?: string;
  holidaySchedule?: string;
  // Caller ID name policy: 'DIRECT_LINE' uses firstName+lastName; 'OTHER_EXTERNAL_NUMBER' uses customExternalCallerIdName
  externalCallerIdNamePolicy?: 'DIRECT_LINE' | 'OTHER_EXTERNAL_NUMBER' | 'LOCATION_NUMBER';
  customExternalCallerIdName?: string;
  // Dial-by-name at AA level (distinct from per-menu nameDialing)
  nameDialingEnabled?: boolean;
  // Call forwarding configuration
  callForwarding?: WebexAACallForwarding;
  businessHoursMenu?: WebexAAMenuConfig;
  afterHoursMenu?: WebexAAMenuConfig;
}

// ── Call Queue detail types ───────────────────────────────────────────────────

export interface WebexQueueAgent {
  id?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
  extension?: string;
  // Confirmed via OpenAPI spec — not previously mapped (only extension was captured).
  phoneNumber?: string;
  weight?: number;
  skillLevel?: number;
  joinEnabled?: boolean;
  // Confirmed via OpenAPI spec: VIRTUAL_LINE was missing from the prior enum.
  type?: 'PEOPLE' | 'PLACE' | 'VIRTUAL_LINE';
}

// Confirmed via the official Webex Cloud Calling OpenAPI spec
// (GetCallQueueEssentialsObject.callPolicies.routingType) — this is the call-routing
// MODE toggle shown in Control Hub ("Priority Based" / "Skill Based"), not the
// routing pattern. The prior flat enum here (CIRCULAR/SIMULTANEOUS/UNIFORM/
// SKILL_BASED/LONGEST_IDLE_TIME/WEIGHTED) incorrectly conflated mode and pattern into
// one field — Control Hub screenshots confirmed these are two independent settings.
// The `hasSkillsRouting` check elsewhere (=== 'SKILL_BASED') was already comparing
// against the correct real value and needed no change.
export type WebexQueueRoutingType = 'PRIORITY_BASED' | 'SKILL_BASED';

// The routing pattern — confirmed via the OpenAPI spec (callPolicies.policy).
// IMPORTANT: two of these enum values do not match their Control Hub UI label —
// per the spec's own description text: REGULAR = "Top Down", UNIFORM = "Longest
// Idle" (not "Uniform" as previously guessed/displayed). CIRCULAR, SIMULTANEOUS,
// and WEIGHTED do match their UI labels. Priority Based mode offers all 5 values;
// Skill Based mode is restricted to CIRCULAR/REGULAR/UNIFORM per Control Hub
// screenshots (no Weighted/Simultaneous card shown under Skill Based).
export type WebexQueueRoutingPolicy = 'CIRCULAR' | 'REGULAR' | 'SIMULTANEOUS' | 'UNIFORM' | 'WEIGHTED';

export interface WebexQueueCallPolicies {
  // Confirmed field name from a full live queue-detail response (routingType, not
  // policyType — the prior name never appeared in any real response, meaning Skills
  // Router detection was silently broken). waitingTreatmentEnabled/
  // callTimeoutHandlingEnabled/transferToAgentEnabled/transferToAgentAfterN are left
  // as-is — out of scope for this General Settings pass, not contradicted by this
  // response (they may still apply; this queue's response just doesn't include them).
  routingType?: WebexQueueRoutingType;
  policy?: WebexQueueRoutingPolicy;
  waitingTreatmentEnabled?: boolean;
  callTimeoutHandlingEnabled?: boolean;
  transferToAgentEnabled?: boolean;
  transferToAgentAfterN?: number;
  // Queue-level distinctive ring — confirmed present, distinct from
  // alternateNumberSettings.distinctiveRingEnabled (legacy Alternate Numbers) and
  // from per-DNIS ringPattern (already modeled on WebexQueueDnisEntry).
  distinctiveRing?: {
    enabled?: boolean;
    ringPattern?: 'NORMAL' | string;
  };
  // Bounced Calls — confirmed present in a full live queue-detail response.
  // callBounceMaxRings: ring count on agent's phone before bouncing back to queue.
  // agentUnavailableEnabled: also bounce if agent sets themselves unavailable
  // while the call rings. alertAgentEnabled/alertAgentMaxSeconds: desktop/agent
  // "still on call" alert after N seconds, independent of the bounce itself.
  // callBounceOnHoldEnabled/-MaxSeconds: bounce a call an agent leaves on hold
  // too long. All field names confirmed; no unconfirmed siblings in this group.
  callBounce?: {
    callBounceEnabled?: boolean;
    callBounceMaxRings?: number;
    agentUnavailableEnabled?: boolean;
    alertAgentEnabled?: boolean;
    alertAgentMaxSeconds?: number;
    callBounceOnHoldEnabled?: boolean;
    callBounceOnHoldMaxSeconds?: number;
  };
}

// Confirmed against a full live queue-detail response. Only 'PERFORM_BUSY_TREATMENT'
// is directly confirmed for `action` — 'TRANSFER_TO_PHONE_NUMBER' and
// 'PLAY_ANNOUNCEMENT_THEN_DISCONNECT' are prior guesses, kept but not asserted as
// fact (hence the loose | string). transferToPhoneNumber is likewise unconfirmed —
// the naming convention confirmed everywhere else (Night/Holiday Service, Stranded
// Calls, Forced Forward) is transferPhoneNumber (no "To"), so this field name is
// suspect; don't rename without a live transfer-configured example.
export interface WebexQueueOverflow {
  action?: 'PERFORM_BUSY_TREATMENT' | 'TRANSFER_TO_PHONE_NUMBER' | 'PLAY_ANNOUNCEMENT_THEN_DISCONNECT' | string;
  sendToVoicemail?: boolean;
  transferToPhoneNumber?: string;
  // Confirmed field names — the prior waitTimeEnabled/waitTimeValue never appeared
  // in any real response.
  overflowAfterWaitEnabled?: boolean;
  overflowAfterWaitTime?: number;
  playOverflowGreetingEnabled?: boolean;
  greeting?: 'DEFAULT' | 'CUSTOM' | string;
  // Deprecated per Webex's changelog (removal scheduled ~March 2027) and redundant
  // with checking transferToPhoneNumber directly — modeled for completeness, not
  // used in any logic.
  isTransferNumberSet?: boolean;
}

export interface WebexQueueSettings {
  // Confirmed field name — queueSize, not maxSize (the prior name never appeared in
  // any real response, so "Max Queue Size" was always blank/wrong).
  queueSize?: number;
  overflow?: WebexQueueOverflow;
  // Notification tones for agents — confirmed present.
  useEnterprisePlayToneToAgentSettingsEnabled?: boolean;
  playToneToAgentForBargeInEnabled?: boolean;
  playToneToAgentForSilentMonitoringEnabled?: boolean;
  playToneToAgentForSupervisorCoachingEnabled?: boolean;
  callOfferToneEnabled?: boolean;
  resetCallStatisticsEnabled?: boolean;
  // Queue-level Welcome/Comfort/Comfort-Bypass/MOH/Wait/Whisper messages — confirmed
  // via the OpenAPI spec (GetCallQueueEssentialsObject.queueSettings). This replaces
  // an entirely incorrect prior guess (flat waitAudioEnabled/waitAudio/
  // introMessageEnabled/greetingEnabled/comfortMessageEnabled/callBacks fields, none
  // of which exist in the real API — no live-capture comment ever confirmed them).
  // The real shape is identical to the DNIS per-entry announcement override schema,
  // so it reuses those same types (Webex uses one message-settings shape for both
  // the queue-wide default and the per-DNIS override).
  welcomeMessage?: WebexDnisWelcomeMessage;
  comfortMessage?: WebexDnisComfortMessage;
  comfortMessageBypass?: WebexDnisComfortMessageBypass;
  mohMessage?: WebexDnisMohMessage;
  // waitMessage.callbackOptionEnabled is the confirmed real "Offer Callback" toggle —
  // the prior queueSettings.callBacks{enabled,dnis,announcement} object does not
  // exist in the spec; no DNIS/announcement sub-fields are modeled since the spec
  // doesn't confirm any exist for wait-message callback.
  waitMessage?: WebexDnisWaitMessage;
  whisperMessage?: WebexDnisMessageSetting;
  // CX Essentials features
  postCallSurveyEnabled?: boolean;
  wrapUpTimerEnabled?: boolean;
  wrapUpTimer?: number;             // seconds
  digitalChannelHandoffEnabled?: boolean;
  digitalChannelHandoffDestinationId?: string;
}

export interface WebexQueueDetail extends WebexQueue {
  firstName?: string;
  lastName?: string;
  timeZone?: string;
  language?: string;       // friendly name, e.g. "English" — confirmed present alongside languageCode
  languageCode?: string;
  // Confirmed real shape — externalCallerIdNamePolicy/customExternalCallerIdName never
  // appeared in any real Call Queue response (that shape is only real for Auto
  // Attendant). Webex Calling actually splits this into two distinct settings:
  // "External caller ID phone number" (callingLineIdPolicy/-PhoneNumber) and
  // "Direct line caller ID name" (directLineCallerIdName). Only 'LOCATION_NUMBER' and
  // 'DISPLAY_NAME' are confirmed values — other options (e.g. an assigned org number,
  // or "Other" custom name) are visible in Control Hub's UI but unconfirmed here, so
  // no custom-name field is modeled until a live example selects that option.
  callingLineIdPolicy?: 'LOCATION_NUMBER' | string;
  callingLineIdPhoneNumber?: string;
  directLineCallerIdName?: {
    selection?: 'DISPLAY_NAME' | string;
  };
  dialByName?: string;
  callPolicies?: WebexQueueCallPolicies;
  queueSettings?: WebexQueueSettings;
  agents?: WebexQueueAgent[];
  allowAgentJoinEnabled?: boolean;
  // Confirmed via OpenAPI spec — previously unmodeled top-level toggles.
  businessTextingEnabled?: boolean;
  phoneNumberForOutgoingCallsEnabled?: boolean;
  allowCallWaitingForAgentsEnabled?: boolean;
  digitalInboxEnabled?: boolean;
  // alternateNumberSettings (distinctiveRingEnabled + alternateNumbers[]) is
  // intentionally NOT modeled — Alternate Numbers is deprecated in favor of DNIS
  // per Webex's own Control Hub deprecation notice (already confirmed earlier this
  // session), so a legacy queue could still return this, but it's superseded.
}

// Call Forwarding — confirmed via the OpenAPI spec NOT to be part of the main queue
// detail response at all; it's a dedicated endpoint
// (GET .../queues/{queueId}/callForwarding -> CallForwardSettingsGet). The prior
// code read `detail.callForwarding` (never fetched, never present) using the Auto
// Attendant's call-forwarding shape (WebexAACallForwarding) — both the source and
// the shape were wrong, so Call Forwarding was silently always blank for Call
// Queues. Real shape below, confirmed field-for-field against the spec.
export interface WebexQueueCallForwardingRule {
  id?: string;
  name?: string;
  callFrom?: string;
  callsTo?: string;
  forwardTo?: string;
  enabled?: boolean;
}

export interface WebexQueueCallForwardingMode {
  id?: string;
  name?: string;
  normalOperationEnabled?: boolean;
  type?: 'NONE' | 'SAME_HOURS_DAILY' | 'DIFFERENT_HOURS_DAILY' | 'HOLIDAY' | string;
  level?: 'LOCATION' | 'ORGANIZATION' | string;
  forwardTo?: {
    selection?: 'FORWARD_TO_DEFAULT_NUMBER' | 'FORWARD_TO_SPECIFIED_NUMBER' | 'DO_NOT_FORWARD' | string;
    destination?: string;
    destinationVoicemailEnabled?: boolean;
  };
}

export interface WebexQueueCallForwarding {
  callForwarding?: {
    always?: {
      enabled?: boolean;
      destination?: string;
      ringReminderEnabled?: boolean;
      destinationVoicemailEnabled?: boolean;
    };
    selective?: {
      enabled?: boolean;
      destination?: string;
      ringReminderEnabled?: boolean;
      destinationVoicemailEnabled?: boolean;
    };
    // Selective Call Forwarding Rules — previously a fully deferred feature, now
    // schema-confirmed.
    rules?: WebexQueueCallForwardingRule[];
    // "Business Continuity" operating modes — previously undiscovered, now
    // schema-confirmed. Only a summary is modeled here (enabled + mode count);
    // full per-mode editing is a larger feature left for a future pass.
    operatingModes?: {
      enabled?: boolean;
      currentOperatingModeId?: string;
      exceptionType?: 'MANUAL_SWITCH_BACK' | 'AUTOMATIC_SWITCH_BACK_EARLY_START' | 'AUTOMATIC_SWITCH_BACK_EXTENSION' | 'AUTOMATIC_SWITCH_BACK_STANDARD' | string;
      modes?: WebexQueueCallForwardingMode[];
    };
  };
}

// Night Service — after-hours routing (schedule-based)
// Shape confirmed against a live org response — flatter and differently named than
// originally assumed (no businessHoursConfig nesting, no offHoursTransferType/announcement).
export interface WebexQueueNightService {
  nightServiceEnabled?: boolean;
  // Confirmed: 'BUSY', 'TRANSFER'. 'VOICEMAIL' is plausible by analogy with Holiday
  // Service/Overflow but not yet confirmed against real data — kept loose rather than
  // asserting a full enum.
  action?: 'BUSY' | 'TRANSFER' | 'VOICEMAIL' | string;
  transferPhoneNumber?: string;   // confirmed field name for a 'TRANSFER' action
  playAnnouncementBeforeEnabled?: boolean;
  announcementMode?: 'NORMAL' | string;
  audioMessageSelection?: 'DEFAULT' | 'CUSTOM' | string;
  // Confirmed via live capture (see FLAGGED_ITEMS.md #1, resolved): the real field is
  // fileName, not name — WebexAudioAnnouncementFile is the confirmed shape everywhere.
  audioFiles?: WebexAudioAnnouncementFile[];
  businessHoursLevel?: 'LOCATION' | 'ORGANIZATION';
  businessHoursName?: string;
  // Not present in the confirmed sample (this queue has no holiday routing tied to night
  // service) — kept for forward-compat, not deleted, but not extended further either.
  holidayScheduleId?: string;
  holidayScheduleName?: string;
  holidayScheduleLevel?: 'LOCATION' | 'ORGANIZATION';
  forceNightServiceEnabled?: boolean;
  manualAudioMessageSelection?: 'DEFAULT' | 'CUSTOM' | string;
  manualAudioFiles?: WebexAudioAnnouncementFile[];
  businessHourSchedules?: Array<{ scheduleName?: string; scheduleLevel?: 'LOCATION' | 'ORGANIZATION' }>;
}

// Holiday Service — holiday override (runs regardless of night service)
// Confirmed against a live org response — same flat shape as Night Service (no
// schedule id, flat announcement fields instead of a nested `announcement` object).
export interface WebexQueueHolidayService {
  holidayServiceEnabled?: boolean;
  // No id is returned in the confirmed real response (same as Night Service's gate).
  holidayScheduleId?: string;
  holidayScheduleName?: string;
  holidayScheduleLevel?: 'LOCATION' | 'ORGANIZATION';
  holidaySchedules?: Array<{ scheduleName?: string; scheduleLevel?: 'LOCATION' | 'ORGANIZATION' }>;
  // Confirmed complete: Holiday Service only has two real Control Hub options, BUSY and
  // TRANSFER. sendToVoicemail and PLAY_GREETING_AND_DISCONNECT were prior guesses that
  // don't exist as real options and have been removed (same precedent as Stranded Calls'
  // disproven LEAVE_MESSAGE). 'NONE' kept only as a defensive fallback, not a real value.
  action?: 'NONE' | 'BUSY' | 'TRANSFER';
  transferPhoneNumber?: string;
  playAnnouncementBeforeEnabled?: boolean;
  audioMessageSelection?: 'DEFAULT' | 'CUSTOM' | string;
  // Confirmed via live capture (see FLAGGED_ITEMS.md #1, resolved): fileName, not name.
  audioFiles?: WebexAudioAnnouncementFile[];
}

// Forced Forward — confirmed against a live org response. Always transfers to
// transferPhoneNumber when enabled — no action variants exist (unlike Night/Holiday
// Service), so no action field is modeled.
export interface WebexQueueForcedForward {
  forcedForwardEnabled?: boolean;
  transferPhoneNumber?: string;
  playAnnouncementBeforeEnabled?: boolean;
  audioMessageSelection?: 'DEFAULT' | 'CUSTOM' | string;
  // Confirmed via live capture (see FLAGGED_ITEMS.md #1, resolved): fileName, not name.
  audioFiles?: WebexAudioAnnouncementFile[];
}

// DNIS — the endorsed replacement for the legacy Alternate Numbers feature (per
// Webex's own Control Hub deprecation notice; existing Alternate Numbers are
// auto-converted). Confirmed against a live response (GET .../queues/{queueId}/dnis).
// No phoneNumber field observed — only extension. ringPattern only has 'LONG_LONG'
// confirmed; kept loose since other values (e.g. NORMAL) are likely but unseen.
export interface WebexQueueDnisEntry {
  id?: string;
  name?: string;
  extension?: string;
  esn?: string;
  ringPattern?: 'LONG_LONG' | string;
  customDnisAnnouncementSettingsEnabled?: boolean;
}

export interface WebexQueueDnis {
  dnisList?: WebexQueueDnisEntry[];
}

// DNIS queue-wide settings — confirmed via OpenAPI spec
// (GET .../queues/{queueId}/dnis/settings). Previously never fetched or modeled;
// a distinct endpoint from the per-DNIS entry list above.
export interface WebexQueueDnisSettings {
  distinctiveRingingEnabled?: boolean;
  displayDnisNameAndNumberEnabled?: boolean;
}

// Custom Announcements for a DNIS entry — confirmed against the official Webex API
// schema (GET .../queues/{queueId}/dnis/{dnisId}/announcements) plus a real example
// body. Full schema, not a guess.
export interface WebexAudioAnnouncementFile {
  id?: string;
  fileName?: string;
  level?: 'ORGANIZATION' | 'LOCATION' | 'ENTITY';
  mediaFileType?: 'WAV' | string;
  isTextToSpeech?: boolean;
}

export interface WebexDnisMessageSetting {
  enabled?: boolean;
  greeting?: 'DEFAULT' | 'CUSTOM';
  audioAnnouncementFiles?: WebexAudioAnnouncementFile[];
}

export interface WebexDnisWelcomeMessage extends WebexDnisMessageSetting {
  alwaysEnabled?: boolean;
}

export interface WebexDnisComfortMessage extends WebexDnisMessageSetting {
  timeBetweenMessages?: number;
}

export interface WebexDnisComfortMessageBypass extends WebexDnisMessageSetting {
  callWaitingAgeThreshold?: number;
  // Confirmed present in a live response despite being absent from the original
  // schema dump (also referenced in Webex's changelog as slated for removal
  // in March 2027 — real fields, just deprecated).
  playAnnouncementAfterRinging?: boolean;
  ringTimeBeforePlayingAnnouncement?: number;
}

export interface WebexMohMessageSource {
  enabled?: boolean;
  greeting?: 'DEFAULT' | 'CUSTOM' | 'PLAYLIST';
  audioAnnouncementFiles?: WebexAudioAnnouncementFile[];
  audioPlaylistId?: string;
  audioPlaylistName?: string;
}

export interface WebexDnisMohMessage {
  normalSource?: WebexMohMessageSource;
  alternateSource?: WebexMohMessageSource;
}

export interface WebexDnisWaitMessage {
  enabled?: boolean;
  waitMode?: 'TIME' | 'POSITION';
  handlingTime?: number;
  defaultHandlingTime?: number;
  queuePosition?: number;
  highVolumeMessageEnabled?: boolean;
  estimatedWaitingTime?: number;
  callbackOptionEnabled?: boolean;
  minimumEstimatedCallbackTime?: number;
  internationalCallbackEnabled?: boolean;
  playUpdatedEstimatedWaitMessage?: boolean;
}

export interface WebexQueueDnisAnnouncements {
  customDnisAnnouncementSettingsEnabled?: boolean;
  welcomeMessage?: WebexDnisWelcomeMessage;
  comfortMessage?: WebexDnisComfortMessage;
  comfortMessageBypass?: WebexDnisComfortMessageBypass;
  mohMessage?: WebexDnisMohMessage;
  waitMessage?: WebexDnisWaitMessage;
  whisperMessage?: WebexDnisMessageSetting;
}

// Stranded Calls — when no agents are logged in / staffed
// Confirmed against live org responses covering every selectable Control Hub option
// (path: .../queues/{queueId}/strandedCalls) — full enum, not a guess. Note there is
// no "leave a voicemail" option in the real API despite earlier assumptions.
export interface WebexQueueStrandedCalls {
  action?: 'NONE' | 'BUSY' | 'TRANSFER' | 'NIGHT_SERVICE' | 'RINGING' | 'ANNOUNCEMENT';
  transferPhoneNumber?: string;   // only meaningful when action === 'TRANSFER'; present-but-unused in other samples
  audioMessageSelection?: 'DEFAULT' | 'CUSTOM' | string;
  // Confirmed via live capture (see FLAGGED_ITEMS.md #1, resolved): fileName, not name.
  audioFiles?: WebexAudioAnnouncementFile[];
  triggerPolicyWhenAllAgentsAreUnreachableEnabled?: boolean;
}

export interface WebexHuntGroup {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  phoneNumber?: string;
  extension?: string;
  enabled?: boolean;
}

// ── Token introspection ──────────────────────────────────────────────────────

export interface WebexTokenInfo {
  clientId: string;
  expiresIn?: number;
  scopes: string;  // space-separated list of granted scopes
}

// ── Write request body types ─────────────────────────────────────────────────
// Used by the canvas → Webex API export transformers (Phase 2B / 2C).

export interface WebexAAMenuKeyWriteConfig {
  action: WebexAAAction;
  description?: string;
  value?: string;            // phone number for TRANSFER_* actions
  callQueueId?: string;      // for CALL_QUEUE action
  autoAttendantId?: string;  // for AUTO_ATTENDANT action
  huntGroupId?: string;      // for HUNT_GROUP action
}

export interface WebexAAMenuWriteConfig {
  greeting?: 'DEFAULT' | 'CUSTOM';
  extensionEnabled?: boolean;
  nameDialing?: boolean;
  keyConfigurations?: Record<string, WebexAAMenuKeyWriteConfig>;
  callTreatment?: WebexAACallTreatment;
}

export interface WebexAAWriteBody {
  name?: string;
  phoneNumber?: string;
  extension?: string;
  languageCode?: string;
  firstName?: string;
  lastName?: string;
  timeZone?: string;
  businessSchedule?: string;
  holidaySchedule?: string;
  businessHoursMenu?: WebexAAMenuWriteConfig;
  afterHoursMenu?: WebexAAMenuWriteConfig;
}

export interface WebexQueueAgentWriteBody {
  personId: string;
  weight?: number;
  skillLevel?: number;
}

export interface WebexQueueWriteBody {
  name?: string;
  phoneNumber?: string;
  extension?: string;
  languageCode?: string;
  timeZone?: string;
  enabled?: boolean;
  callPolicies?: {
    policy: WebexQueueRoutingType;
  };
  queueSettings?: {
    maxSize?: number;
    overflow?: WebexQueueOverflow;
  };
  agents?: WebexQueueAgentWriteBody[];
}

export interface WebexScheduleEventWriteBody {
  name: string;
  startTime?: string;    // "HH:MM"
  endTime?: string;      // "HH:MM"
  allDayEnabled?: boolean;
  recurrence?: WebexScheduleEvent['recurrence'];
}

export interface WebexScheduleWriteBody {
  name: string;
  type: 'businessHours' | 'holidays';
  events?: WebexScheduleEventWriteBody[];
}

// Error thrown by WebexApiService for non-2xx responses
export class WebexApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly trackingId?: string,
  ) {
    super(message);
    this.name = 'WebexApiError';
    // Required when extending built-in classes (Error) in TypeScript/transpiled JS
    // so that `instanceof WebexApiError` works correctly at runtime.
    Object.setPrototypeOf(this, WebexApiError.prototype);
  }
}
