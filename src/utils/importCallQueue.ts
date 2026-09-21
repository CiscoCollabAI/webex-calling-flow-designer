/**
 * Converts Webex Call Queue detail + sub-service API responses into React Flow nodes + edges.
 *
 * Canvas layout (top-down):
 *   Row 0  — Start node (queue entry point + metadata)
 *   Row 1  — Night Service gate  (BusinessHours, if nightService.nightServiceEnabled)
 *             OR Holiday-only gate (if holidayService.holidayServiceEnabled and no night service)
 *   Row +1 — Intro Announcement (PlayMessage, if queueSettings.welcomeMessage.enabled)
 *   Row +1 — Call Router (Branch, always — shows routing type + pattern for every queue)
 *   Queue row — [Night Service Action]  [Queue Node]  [Holiday Action]
 *               [MOH dashed node, far-left] [Comfort Msg dashed node, far-left]
 *   Action row — [Overflow → End]  [Wrap-Up? → Survey? → Answered End]  [Stranded]
 *                [Callback]  [Priority Escalation]  [Digital Handoff]
 */

import type { Node, Edge } from '@xyflow/react';
import type {
  WebexQueueDetail,
  WebexQueueNightService,
  WebexQueueHolidayService,
  WebexQueueStrandedCalls,
  WebexQueueForcedForward,
  WebexQueueDnis,
  WebexQueueDnisAnnouncements,
  WebexQueueCallForwarding,
  WebexQueueDnisSettings,
  WebexSchedule,
  WebexScheduleDetail,
} from '../types/webex';
import type { NodeData } from '../types';
import { scheduleEventsToBusinessHours } from './businessHoursSummary';

const CENTER_X   = 420;
const COL_GAP    = 300;
const ROW_GAP    = 200;
const BASE_Y     = 60;
const SIDE_STACK = 140; // vertical gap between stacked side-decoration nodes

let _seq = 0;
function uid(pfx: string) { return `${pfx}-${++_seq}-${Date.now()}`; }

function mkEdge(
  id: string,
  source: string,
  target: string,
  opts?: { handle?: string; label?: string; color?: string; dashed?: boolean },
): Edge {
  return {
    id,
    source,
    target,
    ...(opts?.handle ? { sourceHandle: opts.handle } : {}),
    ...(opts?.label  ? { label: opts.label } : {}),
    animated: false,
    style: {
      stroke: opts?.color ?? '#94a3b8',
      strokeWidth: 1.5,
      ...(opts?.dashed ? { strokeDasharray: '4 2' } : {}),
    },
    ...(opts?.label ? {
      labelStyle: { fontSize: 11, fill: opts.color ?? '#64748b' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
    } : {}),
  };
}

// Queue policy responses only give each audio file's system-generated fileName
// (e.g. "1752096982842.wav" — confirmed via real API capture), not the human-
// readable name an admin assigned on upload. The org's announcement library
// (fetched separately, keyed by id -> name) has the real name — resolve by
// matching the file's id against it, falling back to the raw fileName if the
// id isn't found there (e.g. announcements fetch failed, or a stale/deleted file).
// Returns both the raw system filename (always shown, unchanged from before) and,
// separately, the resolved friendly label when one is actually available from
// either announcement source — never invents one, and never replaces the filename.
function resolveAudioFileName(
  files: { id?: string; fileName?: string }[] | undefined,
  announcementNames?: Map<string, string>,
): { fileName: string; label?: string } {
  const first = files?.[0];
  if (!first) return { fileName: '' };
  const label = first.id ? announcementNames?.get(first.id) : undefined;
  if (!label && first.id && announcementNames && announcementNames.size > 0) {
    console.warn(`[Webex] Audio file id "${first.id}" (fileName "${first.fileName}") has no matching label among ${announcementNames.size} announcement(s) — showing filename only.`);
  }
  return { fileName: first.fileName ?? '', label };
}

// Spreadable NodeData-shaped wrapper around resolveAudioFileName, so each node's
// data object can just do `...audioFields(...)` alongside its other fields.
function audioFields(
  files: { id?: string; fileName?: string }[] | undefined,
  announcementNames?: Map<string, string>,
): { audioFile: string; audioFileLabel?: string } {
  const { fileName, label } = resolveAudioFileName(files, announcementNames);
  return { audioFile: fileName, audioFileLabel: label };
}

// Reduces the large DNIS-per-entry announcement schema down to one summary line per
// message type, matching how every other complex nested object in this app is shown
// (compact read-only display, not a full editable sub-form).
function summarizeDnisAnnouncements(ann?: WebexQueueDnisAnnouncements, announcementNames?: Map<string, string>) {
  if (!ann) return [];
  const rows: { label: string; enabled: boolean; greeting?: string; fileName?: string; fileLabel?: string; extra?: string }[] = [];
  const push = (label: string, m?: { enabled?: boolean; greeting?: string; audioAnnouncementFiles?: { id?: string; fileName?: string }[] }, extra?: string) => {
    if (!m) return;
    const resolved = resolveAudioFileName(m.audioAnnouncementFiles, announcementNames);
    rows.push({ label, enabled: !!m.enabled, greeting: m.greeting, fileName: resolved.fileName, fileLabel: resolved.label, extra });
  };
  push('Welcome', ann.welcomeMessage);
  push('Comfort', ann.comfortMessage);
  push('Comfort Bypass', ann.comfortMessageBypass,
    ann.comfortMessageBypass?.playAnnouncementAfterRinging
      ? `after ${ann.comfortMessageBypass.ringTimeBeforePlayingAnnouncement ?? 0}s ringing`
      : undefined);
  push('Hold Music (Normal)', ann.mohMessage?.normalSource);
  push('Hold Music (Alternate)', ann.mohMessage?.alternateSource);
  if (ann.waitMessage) {
    const w = ann.waitMessage;
    const extra = w.waitMode === 'POSITION' ? `Position ≤ ${w.queuePosition ?? '—'}` : `${w.handlingTime ?? '—'} min`;
    rows.push({ label: 'Wait', enabled: !!w.enabled, extra });
  }
  push('Whisper', ann.whisperMessage);
  return rows;
}

// Small local labels for the Call Router node's subtitle — kept here rather than
// imported from PropertiesPanel.tsx to avoid a data-layer -> UI-layer dependency;
// PropertiesPanel.tsx has its own copy for editing, this one is just for display.
const ROUTING_TYPE_LABELS: Record<string, string> = {
  PRIORITY_BASED: 'Priority-Based',
  SKILL_BASED: 'Skill-Based',
};
const ROUTING_PATTERN_LABELS: Record<string, string> = {
  CIRCULAR: 'Circular',
  REGULAR: 'Top Down',
  UNIFORM: 'Longest Idle',
  WEIGHTED: 'Weighted',
  SIMULTANEOUS: 'Simultaneous',
};
function describeRouting(routingType: string, routingPolicy: string): string {
  const type = ROUTING_TYPE_LABELS[routingType] ?? routingType;
  const pattern = ROUTING_PATTERN_LABELS[routingPolicy] ?? routingPolicy;
  return [type, pattern].filter(Boolean).join(' · ');
}

export interface CQImportInput {
  detail: WebexQueueDetail;
  nightService?: WebexQueueNightService;
  holidayService?: WebexQueueHolidayService;
  strandedCalls?: WebexQueueStrandedCalls;
  forcedForward?: WebexQueueForcedForward;
  dnis?: WebexQueueDnis;
  dnisAnnouncements?: Record<string, WebexQueueDnisAnnouncements | undefined>;
  callForwarding?: WebexQueueCallForwarding;
  dnisSettings?: WebexQueueDnisSettings;
  // Org-wide schedule list — used to resolve Night Service's businessHoursName (a
  // flat name string; the Night Service API response has no schedule id) to a real
  // Webex schedule id, the same way importAutoAttendant resolves AA schedule names.
  schedules?: WebexSchedule[];
  // Pre-fetched hours for the resolved Business Hours schedule above, so the gate
  // node can show actual hours on canvas instead of requiring a manual API call.
  businessHoursScheduleDetail?: WebexScheduleDetail;
  // Org announcement library (id -> human-readable name), used to resolve audio
  // file names — see resolveAudioFileName above for why this is needed.
  announcementNames?: Map<string, string>;
}

export function importCallQueue(input: CQImportInput): { nodes: Node<NodeData>[]; edges: Edge[] } {
  _seq = 0;
  const { detail, nightService, holidayService, strandedCalls, forcedForward, dnis, dnisAnnouncements, callForwarding, dnisSettings, schedules, businessHoursScheduleDetail, announcementNames } = input;

  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  // ── Feature flags ─────────────────────────────────────────────────────────
  const hasForcedForward = !!forcedForward?.forcedForwardEnabled;
  const hasNightService = !!nightService?.nightServiceEnabled;
  // Whether a Holiday action node will be wired to the gate at all — this is the
  // standalone Holiday Service feature, independent of whether Night Service also
  // references its own holidayScheduleId (a separate, unrelated field). This flag
  // is the single source of truth for both the gate's rendered output-handle count
  // (AllNodes.tsx) and which handle the Holiday edge attaches to, below — they used
  // to be decided by two different conditions, which could point a "Closed" edge
  // and a "Holiday" edge at the same handle when Night Service had no schedule of
  // its own.
  const hasHolidayAction = !!holidayService?.holidayServiceEnabled;
  const hasHolidayOnly  = !hasNightService && hasHolidayAction;

  const qs = detail.queueSettings;
  const cf = callForwarding?.callForwarding;
  const callbackEnabled   = !!(qs?.waitMessage?.callbackOptionEnabled);
  const hasIntroMsg       = !!(qs?.welcomeMessage?.enabled);
  const hasComfortMsg     = !!(qs?.comfortMessage?.enabled);
  const hasCustomMoh      = qs?.mohMessage?.normalSource?.greeting === 'CUSTOM';
  const hasPriorityEsc    = !!(detail.callPolicies?.transferToAgentEnabled);
  const hasWrapUp         = !!(qs?.wrapUpTimerEnabled);
  const hasPostCallSurvey = !!(qs?.postCallSurveyEnabled);
  const hasDigitalHandoff = !!(qs?.digitalChannelHandoffEnabled);

  let row = 0;

  // ── Row 0: Start node ─────────────────────────────────────────────────────
  const startId = uid('cq-start');
  nodes.push({
    id: startId,
    type: 'start',
    position: { x: CENTER_X, y: BASE_Y + row * ROW_GAP },
    data: {
      kind: 'start',
      label: detail.name,
      phoneNumber:     detail.phoneNumber  ?? '',
      extensionNumber: detail.extension    ?? '',
      cqEnabled:           detail.enabled ?? true,
      cqLocationName:      detail.locationName ?? '',
      cqCallingLineIdPolicy:      detail.callingLineIdPolicy ?? '',
      cqCallingLineIdPhoneNumber: detail.callingLineIdPhoneNumber ?? '',
      cqDirectLineCallerIdSelection: detail.directLineCallerIdName?.selection ?? '',
      cqCallerIdDisplayName:
        [detail.firstName, detail.lastName].filter(Boolean).join(' ') || detail.name,
      cqDialByName:    detail.dialByName ?? '',
      cqRoutingType:   detail.callPolicies?.routingType ?? '',
      cqRoutingPolicy: detail.callPolicies?.policy ?? '',
      cqMaxSize:       detail.queueSettings?.queueSize,
      cqLanguage:      detail.language ?? '',
      cqLanguageCode:  detail.languageCode ?? '',
      cqTimezone:      detail.timeZone     ?? '',
      cqNotificationTonesUseOrgDefault: detail.queueSettings?.useEnterprisePlayToneToAgentSettingsEnabled ?? true,
      cqToneBargeInEnabled:            detail.queueSettings?.playToneToAgentForBargeInEnabled ?? false,
      cqToneSilentMonitoringEnabled:   detail.queueSettings?.playToneToAgentForSilentMonitoringEnabled ?? false,
      cqToneSupervisorCoachingEnabled: detail.queueSettings?.playToneToAgentForSupervisorCoachingEnabled ?? false,
      cqDistinctiveRingEnabled: detail.callPolicies?.distinctiveRing?.enabled ?? false,
      cqDistinctiveRingPattern: detail.callPolicies?.distinctiveRing?.ringPattern ?? '',
      cqBusinessTextingEnabled: detail.businessTextingEnabled ?? false,
      cqPhoneNumberForOutgoingCallsEnabled: detail.phoneNumberForOutgoingCallsEnabled ?? false,
      cqAllowCallWaitingForAgentsEnabled: detail.allowCallWaitingForAgentsEnabled ?? false,
      cqDigitalInboxEnabled: detail.digitalInboxEnabled ?? false,
      // detail.agents === undefined means the API response omitted this field
      // (data unavailable for this import); [] means it was returned and confirmed
      // empty. Both would otherwise collapse to the same empty array below, so the
      // distinction is captured here before that happens.
      cqAgentsUnavailable: detail.agents === undefined,
      cqAgents: (detail.agents ?? []).map(a => ({
        name:        [a.firstName, a.lastName].filter(Boolean).join(' ') || a.userName || '',
        extension:   a.extension  ?? '',
        phoneNumber: a.phoneNumber ?? '',
        agentType:   a.type ?? '',
        skillLevel:  a.skillLevel,
        joinEnabled: a.joinEnabled ?? true,
        weight:      a.weight,
      })),
      cqCallbackEnabled: callbackEnabled,
      // Confirmed via OpenAPI spec: call forwarding is a dedicated endpoint
      // (queues/{queueId}/callForwarding), not part of the queue detail response —
      // the prior detail.callForwarding source was never populated, so Call
      // Forwarding always silently read as disabled/blank.
      cqCallForwardingEnabled: cf?.always?.enabled ?? false,
      cqCallForwardingDestination: cf?.always?.destination ?? '',
      cqCallForwardingToVoicemail: cf?.always?.destinationVoicemailEnabled ?? false,
      cqCallForwardingRingReminder: cf?.always?.ringReminderEnabled ?? false,
      // Selective Call Forwarding — previously deferred, now schema-confirmed.
      cqSelectiveForwardingEnabled: cf?.selective?.enabled ?? false,
      cqSelectiveForwardingDestination: cf?.selective?.destination ?? '',
      cqSelectiveForwardingRules: (cf?.rules ?? []).map(r => ({
        name: r.name ?? '',
        enabled: r.enabled ?? false,
        forwardTo: r.forwardTo ?? '',
      })),
      // Business Continuity "operating modes" — previously undiscovered, now
      // schema-confirmed. Summary only (enabled + how many modes configured);
      // full per-mode editing is out of scope for this pass.
      cqOperatingModesEnabled: cf?.operatingModes?.enabled ?? false,
      cqOperatingModesCount: cf?.operatingModes?.modes?.length ?? 0,
      // DNIS queue-wide settings — confirmed via OpenAPI spec, previously never fetched.
      cqDnisDistinctiveRingingEnabled: dnisSettings?.distinctiveRingingEnabled ?? false,
      cqDnisDisplayNameAndNumberEnabled: dnisSettings?.displayDnisNameAndNumberEnabled ?? false,
      cqDnisNumbers: (dnis?.dnisList ?? []).map(d => ({
        name: d.name ?? '',
        extension: d.extension,
        ringPattern: d.ringPattern,
        customAnnouncementEnabled: d.customDnisAnnouncementSettingsEnabled,
        announcementSummary: d.id ? summarizeDnisAnnouncements(dnisAnnouncements?.[d.id], announcementNames) : [],
      })),
      cqHasHolidayService: hasHolidayAction,
      cqHasNightService: hasNightService,
      cqHasForcedForward: hasForcedForward,
      cqHasStrandedPolicy: !!strandedCalls?.action && strandedCalls.action !== 'NONE',
    } as NodeData,
  });
  row++;

  // ── Forced Forward bypass (overrides all routing below when enabled) ──────
  // Per Webex docs, when enabled this forwards ALL incoming calls immediately —
  // the rest of the flow below still exists but doesn't execute, so its nodes
  // get marked bypassed (dimmed in the UI) at the end of this function.
  const ffNodeIds = new Set<string>([startId]);
  if (hasForcedForward) {
    let ffSourceId: string = startId;
    if (forcedForward!.playAnnouncementBeforeEnabled) {
      const ffAnnId = uid('cq-ff-announcement');
      nodes.push({
        id: ffAnnId,
        type: 'playMessage',
        position: { x: CENTER_X - 2 * COL_GAP, y: BASE_Y + ROW_GAP },
        data: {
          kind: 'playMessage',
          label: 'Forced Forward Announcement',
          messageType: forcedForward!.audioMessageSelection === 'CUSTOM' ? 'audio' : 'tts',
          ...audioFields(forcedForward!.audioFiles, announcementNames),
          cqAnnouncementSource: true,
        } as NodeData,
      });
      edges.push(mkEdge(`e-${startId}-ff-ann`, startId, ffAnnId, { label: 'Forced Forward', color: '#dc2626' }));
      ffNodeIds.add(ffAnnId);
      ffSourceId = ffAnnId;
    }
    const ffTransferId = uid('cq-ff-transfer');
    nodes.push({
      id: ffTransferId,
      type: 'transfer',
      position: { x: CENTER_X - 2 * COL_GAP, y: BASE_Y + 2 * ROW_GAP },
      data: {
        kind: 'transfer',
        label: 'Forced Forward: Transfer',
        transferType: 'blind',
        transferNumber: forcedForward!.transferPhoneNumber ?? '',
      } as NodeData,
    });
    edges.push(mkEdge(`e-${ffSourceId}-ff-transfer`, ffSourceId, ffTransferId,
      ffSourceId === startId ? { label: 'Forced Forward', color: '#dc2626' } : undefined,
    ));
    ffNodeIds.add(ffTransferId);
  }

  // ── Row 1: Gate (Night Service or Holiday-only) ───────────────────────────
  let gateId: string | null = null;

  if (hasNightService) {
    gateId = uid('cq-ns-gate');
    const ns0 = nightService!;
    // businessHoursName/-Level are flat fields on the real API response — no
    // scheduleId is returned there, so resolve it by name against the org's
    // schedule list (same approach importAutoAttendant uses for AA schedules).
    const bhSchedule = schedules?.find(
      (s) => s.type === 'businessHours' && s.name === ns0.businessHoursName,
    );
    nodes.push({
      id: gateId,
      type: 'businessHours',
      position: { x: CENTER_X, y: BASE_Y + row * ROW_GAP },
      data: {
        kind: 'businessHours',
        // Primary label is the action ("Business Hours"), matching the def.label
        // used elsewhere — this also suppresses BaseNode's normally-shown secondary
        // subtitle (only rendered when data.label !== def.label), since "Night
        // Service" already lives correctly on the downstream action node's own
        // label ("Night Service: Transfer") and repeating it here was redundant.
        label: 'Business Hours',
        scheduleName:      ns0.businessHoursName ?? '',
        scheduleId:        bhSchedule?.id ?? '',
        scheduleLevel:     ns0.businessHoursLevel,
        businessHours:     scheduleEventsToBusinessHours(businessHoursScheduleDetail?.events),
        holidaySchedule:   ns0.holidayScheduleName ?? '',
        holidayScheduleId: ns0.holidayScheduleId  ?? '',
        holidayScheduleLevel: ns0.holidayScheduleLevel,
        timezone:          detail.timeZone ?? '',
        hasHolidayBranch:  hasHolidayAction,
        gateMode:          'nightService',
      } as NodeData,
    });
    edges.push(mkEdge(`e-${startId}-${gateId}`, startId, gateId));
    row++;
  } else if (hasHolidayOnly) {
    gateId = uid('cq-hol-gate');
    nodes.push({
      id: gateId,
      type: 'businessHours',
      position: { x: CENTER_X, y: BASE_Y + row * ROW_GAP },
      data: {
        kind: 'businessHours',
        label: 'Holiday Service',
        scheduleName:      '',
        scheduleId:        '',
        holidaySchedule:   holidayService!.holidayScheduleName ?? '',
        holidayScheduleId: holidayService!.holidayScheduleId  ?? '',
        holidayScheduleLevel: holidayService!.holidayScheduleLevel,
        timezone:          detail.timeZone ?? '',
        gateMode:          'holidayOnly',
      } as NodeData,
    });
    edges.push(mkEdge(`e-${startId}-${gateId}`, startId, gateId));
    row++;
  }

  // ── Pre-queue chain: Intro Announcement → Call Router ─────────────────────
  // Track the "last" node before the Queue for edge connections.
  let preId: string              = gateId ?? startId;
  let preHandle: string | undefined = gateId ? 'output-0' : undefined;
  let preLabel:  string | undefined = gateId ? (hasNightService ? 'Open' : 'Not a Holiday') : undefined;
  let preColor:  string | undefined = gateId ? '#22c55e' : undefined;

  if (hasIntroMsg) {
    const introId = uid('cq-intro');
    nodes.push({
      id: introId,
      type: 'playMessage',
      position: { x: CENTER_X, y: BASE_Y + row * ROW_GAP },
      data: {
        kind: 'playMessage',
        label: 'Announcement',
        nodeSubtitle: 'Welcome Greeting',
        messageType: qs?.welcomeMessage?.greeting === 'CUSTOM' ? 'audio' : 'tts',
        // Welcome/Comfort messages use a different field name (audioAnnouncementFiles)
        // than Night Service/Holiday/Forced Forward/Stranded (audioFiles) — this was
        // previously never read at all for this node, leaving Audio File blank even
        // when messageType was 'audio'.
        ...audioFields(qs?.welcomeMessage?.audioAnnouncementFiles, announcementNames),
        cqAnnouncementSource: true,
      } as NodeData,
    });
    edges.push(mkEdge(`e-${preId}-intro`, preId, introId, {
      handle: preHandle, label: preLabel, color: preColor,
    }));
    preId = introId; preHandle = 'output-0'; preLabel = undefined; preColor = undefined;
    row++;
  }

  // Always shown — routing pattern applies to every queue (Priority-Based routing
  // has no other visible representation on canvas at all today; it otherwise only
  // lives in the Start node's properties panel).
  {
    const routingType = detail.callPolicies?.routingType ?? '';
    const routingPolicy = detail.callPolicies?.policy ?? '';
    const routerId = uid('cq-router');
    nodes.push({
      id: routerId,
      type: 'branch',
      position: { x: CENTER_X, y: BASE_Y + row * ROW_GAP },
      data: {
        kind: 'branch',
        label: 'Call Router',
        nodeSubtitle: describeRouting(routingType, routingPolicy),
        variable: 'skill',
        operator: 'equals',
        compareValue: routingType,
      } as NodeData,
    });
    edges.push(mkEdge(`e-${preId}-router`, preId, routerId, {
      handle: preHandle, label: preLabel, color: preColor,
    }));
    preId = routerId; preHandle = 'output-0'; preLabel = undefined; preColor = undefined;
    row++;
  }

  const queueRowY = BASE_Y + row * ROW_GAP;

  // ── Queue node (center) ───────────────────────────────────────────────────
  const queueNodeId = uid('cq-queue');
  nodes.push({
    id: queueNodeId,
    type: 'queue',
    position: { x: CENTER_X, y: queueRowY },
    data: {
      kind: 'queue',
      label: detail.name,
      queueId:         detail.id,
      queueName:       detail.name,
      maxWaitTime:     qs?.overflow?.overflowAfterWaitTime ?? 300,
      queueMaxSize:    qs?.queueSize,
      mohEnabled:      qs?.mohMessage?.normalSource?.enabled ?? true,
      holdMusicType:   qs?.mohMessage?.normalSource?.greeting === 'CUSTOM' ? 'custom' : 'default',
      // Confirmed via OpenAPI spec: queueSettings.waitMessage.enabled — replaces the
      // prior callPolicies.waitingTreatmentEnabled guess, which the spec doesn't show
      // as a real field on callPolicies at all (see Small Leftovers flag).
      estimatedWaitEnabled: qs?.waitMessage?.enabled ?? true,
      agentJoinEnabled: detail.allowAgentJoinEnabled ?? true,
      // Confirmed absent from the entire public OpenAPI spec (read + write schemas
      // both checked, not just callPolicies) — see FLAGGED_ITEMS.md #2, resolved.
      // The value below can never be anything but the false default; the
      // *SourceUnknown flag tells the UI not to present that default as fact.
      callTimeoutHandlingEnabled: detail.callPolicies?.callTimeoutHandlingEnabled ?? false,
      callTimeoutHandlingSourceUnknown: true,
      callBounceEnabled: detail.callPolicies?.callBounce?.callBounceEnabled ?? false,
      callBounceMaxRings: detail.callPolicies?.callBounce?.callBounceMaxRings,
      callBounceOnAgentUnavailableEnabled: detail.callPolicies?.callBounce?.agentUnavailableEnabled ?? false,
      callBounceAlertAgentEnabled: detail.callPolicies?.callBounce?.alertAgentEnabled ?? false,
      callBounceAlertAgentMaxSeconds: detail.callPolicies?.callBounce?.alertAgentMaxSeconds,
      callBounceOnHoldEnabled: detail.callPolicies?.callBounce?.callBounceOnHoldEnabled ?? false,
      callBounceOnHoldMaxSeconds: detail.callPolicies?.callBounce?.callBounceOnHoldMaxSeconds,
      callbackEnabled,
      comfortMessageEnabled: hasComfortMsg,
      comfortMessageTimeBetween: qs?.comfortMessage?.timeBetweenMessages,
      comfortMessageBypassEnabled: qs?.comfortMessageBypass?.enabled ?? false,
      comfortMessageBypassThreshold: qs?.comfortMessageBypass?.callWaitingAgeThreshold,
      whisperMessageEnabled: qs?.whisperMessage?.enabled ?? false,
      // Confirmed absent from the entire public OpenAPI spec — see FLAGGED_ITEMS.md
      // #2, resolved. Same rationale as callTimeoutHandlingSourceUnknown above.
      priorityEscalationEnabled: hasPriorityEsc,
      priorityEscalationThreshold: detail.callPolicies?.transferToAgentAfterN,
      priorityEscalationSourceUnknown: true,
      digitalHandoffEnabled: hasDigitalHandoff,
    } as NodeData,
  });

  // Connect pre-queue last node → Queue
  if (preHandle) {
    edges.push(mkEdge(`e-${preId}-queue`, preId, queueNodeId, {
      handle: preHandle, label: preLabel, color: preColor,
    }));
  } else {
    edges.push(mkEdge(`e-${preId}-queue`, preId, queueNodeId));
  }

  // ── Night Service action (left of queue) ──────────────────────────────────
  if (hasNightService && gateId) {
    const ns = nightService!;
    // action is the confirmed real field (no separate "enabled" flag exists for it).
    const nsKind: NodeData['kind'] =
      ns.action === 'TRANSFER' ? 'transfer'
      : ns.action === 'VOICEMAIL' ? 'voicemail'
      : 'end';
    const nsData: Partial<NodeData> =
      nsKind === 'transfer'
        ? { label: 'Night Service: Transfer', transferType: 'blind', transferNumber: ns.transferPhoneNumber ?? '' }
        : nsKind === 'voicemail'
        ? { label: 'Night Service: Voicemail' }
        : ns.action === 'BUSY'
        ? { label: 'Night Service: Busy Treatment' }
        : { label: 'Night Service: Disconnect' };

    let nsSourceId     = gateId;
    let nsSourceHandle: string | undefined = 'output-1';
    let nsSourceLabel:  string | undefined = 'Outside Business Hours';
    let nsSourceColor:  string | undefined = '#f97316';

    if (ns.playAnnouncementBeforeEnabled) {
      const nsAnnId = uid('cq-ns-announcement');
      nodes.push({
        id: nsAnnId,
        type: 'playMessage',
        position: { x: CENTER_X - COL_GAP, y: queueRowY - ROW_GAP / 2 },
        data: {
          kind: 'playMessage',
          label: 'Announcement',
          nodeSubtitle: 'Night Service',
          messageType: ns.audioMessageSelection === 'CUSTOM' ? 'audio' : 'tts',
          ...audioFields(ns.audioFiles, announcementNames),
          cqAnnouncementSource: true,
        } as NodeData,
      });
      edges.push(mkEdge(`e-${gateId}-ns-ann`, gateId, nsAnnId, {
        handle: nsSourceHandle, label: nsSourceLabel, color: nsSourceColor,
      }));
      nsSourceId = nsAnnId; nsSourceHandle = 'output-0'; nsSourceLabel = undefined; nsSourceColor = undefined;
    }

    const nsActionId = uid('cq-ns-action');
    nodes.push({
      id: nsActionId,
      type: nsKind,
      position: { x: CENTER_X - COL_GAP, y: queueRowY },
      data: { kind: nsKind, ...nsData } as NodeData,
    });
    edges.push(mkEdge(`e-${nsSourceId}-ns-action`, nsSourceId, nsActionId, {
      handle: nsSourceHandle, label: nsSourceLabel, color: nsSourceColor,
    }));
  }

  // ── Holiday Service action (right of queue) ───────────────────────────────
  const holService = hasHolidayAction ? holidayService : undefined;
  if (holService && gateId) {
    let holKind: NodeData['kind'];
    let holData: Partial<NodeData>;

    if (holService.action === 'TRANSFER') {
      holKind = 'transfer';
      holData = { label: 'Holiday: Transfer', transferType: 'blind', transferNumber: holService.transferPhoneNumber ?? '' };
    } else if (holService.action === 'BUSY') {
      holKind = 'end';
      holData = { label: 'Holiday: Busy Treatment' };
    } else {
      holKind = 'end';
      holData = { label: 'Holiday: Disconnect' };
    }

    let holSourceId     = gateId;
    // This branch only runs when hasHolidayAction is true, so the Night-Service gate
    // above was built with hasHolidayBranch: true and therefore always renders a 3rd
    // handle (output-2) — regardless of whether Night Service also has its own,
    // unrelated holidayScheduleId. The Holiday-only gate never has this ambiguity:
    // it always has exactly 2 handles, so output-1 is its real Holiday handle.
    const holHandle = hasNightService ? 'output-2' : 'output-1';
    let holSourceHandle: string | undefined = holHandle;
    let holSourceLabel:  string | undefined = 'Holiday';
    let holSourceColor:  string | undefined = '#8b5cf6';

    if (holService.playAnnouncementBeforeEnabled) {
      const holAnnId = uid('cq-hol-announcement');
      nodes.push({
        id: holAnnId,
        type: 'playMessage',
        position: { x: CENTER_X + COL_GAP, y: queueRowY - ROW_GAP / 2 },
        data: {
          kind: 'playMessage',
          label: 'Announcement',
          nodeSubtitle: 'Holiday',
          messageType: holService.audioMessageSelection === 'CUSTOM' ? 'audio' : 'tts',
          ...audioFields(holService.audioFiles, announcementNames),
          cqAnnouncementSource: true,
        } as NodeData,
      });
      edges.push(mkEdge(`e-${gateId}-hol-ann`, gateId, holAnnId, {
        handle: holSourceHandle, label: holSourceLabel, color: holSourceColor,
      }));
      holSourceId = holAnnId; holSourceHandle = 'output-0'; holSourceLabel = undefined; holSourceColor = undefined;
    }

    const holActionId = uid('cq-hol-action');
    nodes.push({
      id: holActionId,
      type: holKind,
      position: { x: CENTER_X + COL_GAP, y: queueRowY },
      data: { kind: holKind, ...holData } as NodeData,
    });
    edges.push(mkEdge(`e-${holSourceId}-hol-action`, holSourceId, holActionId, {
      handle: holSourceHandle, label: holSourceLabel, color: holSourceColor,
    }));
  }

  // ── Decorative side nodes: MOH + Comfort Message (dashed, far-left) ───────
  const sideX = CENTER_X - 2 * COL_GAP;

  if (hasCustomMoh) {
    const mohId = uid('cq-moh');
    nodes.push({
      id: mohId,
      type: 'playMessage',
      position: { x: sideX, y: queueRowY },
      data: {
        kind: 'playMessage',
        label: 'Music on Hold',
        messageType: 'audio',
        holdMusicType: 'custom',
      } as NodeData,
    });
    edges.push(mkEdge(`e-${queueNodeId}-moh`, queueNodeId, mohId, {
      label: 'While Waiting', color: '#94a3b8', dashed: true,
    }));
  }

  if (hasComfortMsg) {
    const comfortId = uid('cq-comfort');
    nodes.push({
      id: comfortId,
      type: 'playMessage',
      position: { x: sideX, y: queueRowY + (hasCustomMoh ? SIDE_STACK : 0) },
      data: {
        kind: 'playMessage',
        label: 'Comfort Message',
        messageType: qs?.comfortMessage?.greeting === 'CUSTOM' ? 'audio' : 'tts',
        // Same missing-field fix as the Welcome/Intro node above — Comfort Message
        // also uses audioAnnouncementFiles, not audioFiles, and was never read.
        ...audioFields(qs?.comfortMessage?.audioAnnouncementFiles, announcementNames),
        cqAnnouncementSource: true,
      } as NodeData,
    });
    edges.push(mkEdge(`e-${queueNodeId}-comfort`, queueNodeId, comfortId, {
      label: 'Periodic', color: '#94a3b8', dashed: true,
    }));
  }

  row++;
  const actionRowY = BASE_Y + row * ROW_GAP;

  // ── Overflow action (left) ────────────────────────────────────────────────
  const overflow = qs?.overflow;

  {
    let ovSourceId      = queueNodeId;
    let ovSourceHandle: string | undefined = 'output-1';
    let ovSourceLabel:  string | undefined = 'Overflow';
    let ovSourceColor:  string | undefined = '#f97316';

    if (overflow?.playOverflowGreetingEnabled) {
      const ovAnnId = uid('cq-overflow-announcement');
      nodes.push({
        id: ovAnnId,
        type: 'playMessage',
        position: { x: CENTER_X - COL_GAP, y: actionRowY - ROW_GAP / 2 },
        data: {
          kind: 'playMessage',
          label: 'Announcement',
          nodeSubtitle: 'Overflow',
          messageType: overflow.greeting === 'CUSTOM' ? 'audio' : 'tts',
          // Confirmed via live capture — Overflow uses audioAnnouncementFiles (same
          // as Welcome/Comfort), not audioFiles (Night/Holiday/Stranded/Forced
          // Forward) — this was never read at all before, same gap as those two.
          ...audioFields(overflow.audioAnnouncementFiles, announcementNames),
          cqAnnouncementSource: true,
        } as NodeData,
      });
      edges.push(mkEdge(`e-${queueNodeId}-overflow-ann`, queueNodeId, ovAnnId, {
        handle: ovSourceHandle, label: ovSourceLabel, color: ovSourceColor,
      }));
      ovSourceId = ovAnnId; ovSourceHandle = 'output-0'; ovSourceLabel = undefined; ovSourceColor = undefined;
    }

    // Confirmed via live capture: action really is 'TRANSFER_TO_PHONE_NUMBER', and
    // the destination field is transferNumber — not transferToPhoneNumber (an
    // earlier session's own guess) or transferPhoneNumber (the naming pattern used
    // by every sibling policy). Neither guess was right; this was the actual bug —
    // the action check was always correct, but transferToPhoneNumber was always
    // undefined, so the condition never passed regardless of the real config.
    if (overflow?.action === 'TRANSFER_TO_PHONE_NUMBER' && overflow.transferNumber) {
      const ovTransferId = uid('cq-overflow-transfer');
      nodes.push({
        id: ovTransferId,
        type: 'transfer',
        position: { x: CENTER_X - COL_GAP, y: actionRowY },
        data: {
          kind: 'transfer',
          label: 'Overflow',
          transferType: 'blind',
          transferNumber: overflow.transferNumber,
        } as NodeData,
      });
      edges.push(mkEdge(`e-${ovSourceId}-overflow`, ovSourceId, ovTransferId, {
        handle: ovSourceHandle, label: ovSourceLabel, color: ovSourceColor,
      }));
      const ovEndId = uid('cq-overflow-end');
      nodes.push({
        id: ovEndId,
        type: 'end',
        position: { x: CENTER_X - COL_GAP, y: actionRowY + ROW_GAP },
        data: { kind: 'end', label: 'Disconnect' } as NodeData,
      });
      edges.push(mkEdge(`e-${ovTransferId}-end`, ovTransferId, ovEndId, {
        handle: 'output-0', color: '#94a3b8',
      }));
    } else if (overflow?.sendToVoicemail) {
      const ovVmId = uid('cq-overflow-vm');
      nodes.push({
        id: ovVmId,
        type: 'voicemail',
        position: { x: CENTER_X - COL_GAP, y: actionRowY },
        data: { kind: 'voicemail', label: 'Overflow: Voicemail' } as NodeData,
      });
      edges.push(mkEdge(`e-${ovSourceId}-overflow`, ovSourceId, ovVmId, {
        handle: ovSourceHandle, label: ovSourceLabel, color: ovSourceColor,
      }));
    } else if (overflow?.action === 'PERFORM_BUSY_TREATMENT') {
      const ovEndId = uid('cq-overflow-end');
      nodes.push({
        id: ovEndId,
        type: 'end',
        position: { x: CENTER_X - COL_GAP, y: actionRowY },
        data: { kind: 'end', label: 'Overflow: Busy Treatment' } as NodeData,
      });
      edges.push(mkEdge(`e-${ovSourceId}-overflow`, ovSourceId, ovEndId, {
        handle: ovSourceHandle, label: ovSourceLabel, color: ovSourceColor,
      }));
    } else {
      const ovEndId = uid('cq-overflow-end');
      nodes.push({
        id: ovEndId,
        type: 'end',
        position: { x: CENTER_X - COL_GAP, y: actionRowY },
        data: { kind: 'end', label: 'Overflow: Disconnect' } as NodeData,
      });
      edges.push(mkEdge(`e-${ovSourceId}-overflow`, ovSourceId, ovEndId, {
        handle: ovSourceHandle, label: ovSourceLabel, color: ovSourceColor,
      }));
    }
  }

  // ── Answered path (center): Wrap-Up? → Post-Call Survey? → Answered End ──
  let chainId     = queueNodeId;
  let chainHandle = 'output-0';
  let chainY      = actionRowY;
  let isFirstHop  = true;

  function connectNext(targetId: string) {
    edges.push(mkEdge(`e-${chainId}-${targetId}`, chainId, targetId, {
      handle: chainHandle,
      ...(isFirstHop ? { label: 'Answered', color: '#22c55e' } : {}),
    }));
    chainId     = targetId;
    chainHandle = 'output-0';
    isFirstHop  = false;
    chainY     += ROW_GAP;
  }

  if (hasWrapUp) {
    const wrapUpId = uid('cq-wrapup');
    nodes.push({
      id: wrapUpId,
      type: 'setVariable',
      position: { x: CENTER_X, y: chainY },
      data: {
        kind: 'setVariable',
        label: 'Wrap-Up',
        variableName: 'dispositionCode',
        variableValue: '',
      } as NodeData,
    });
    connectNext(wrapUpId);
  }

  if (hasPostCallSurvey) {
    const surveyMsgId = uid('cq-survey-msg');
    nodes.push({
      id: surveyMsgId,
      type: 'playMessage',
      position: { x: CENTER_X, y: chainY },
      data: {
        kind: 'playMessage',
        label: 'Post-Call Survey',
        messageType: 'tts',
        messageText: 'Please rate your experience.',
      } as NodeData,
    });
    connectNext(surveyMsgId);

    const surveyDigitsId = uid('cq-survey-digits');
    nodes.push({
      id: surveyDigitsId,
      type: 'collectDigits',
      position: { x: CENTER_X, y: chainY },
      data: {
        kind: 'collectDigits',
        label: 'Survey Response',
        collectPrompt: 'Press 1–5 to rate your experience',
        minDigits: 1,
        maxDigits: 1,
      } as NodeData,
    });
    connectNext(surveyDigitsId);
  }

  const answeredId = uid('cq-answered');
  nodes.push({
    id: answeredId,
    type: 'end',
    position: { x: CENTER_X, y: chainY },
    data: { kind: 'end', label: 'Answered' } as NodeData,
  });
  edges.push(mkEdge(`e-${chainId}-answered`, chainId, answeredId, {
    handle: chainHandle,
    ...(isFirstHop ? { label: 'Answered', color: '#22c55e' } : {}),
  }));

  // ── Stranded calls action (right) ─────────────────────────────────────────
  const strAction = strandedCalls?.action;
  if (strAction && strAction !== 'NONE') {
    let strKind: NodeData['kind'];
    let strData: Partial<NodeData>;

    if (strAction === 'TRANSFER') {
      strKind = 'transfer';
      strData = { label: 'Forwards the call (Stranded Calls)', transferType: 'blind', transferNumber: strandedCalls?.transferPhoneNumber ?? '' };
    } else if (strAction === 'BUSY') {
      strKind = 'end';
      strData = { label: 'Plays a busy tone, caller disconnects' };
    } else if (strAction === 'RINGING') {
      strKind = 'end';
      strData = { label: 'Keeps ringing until the caller hangs up' };
    } else if (strAction === 'NIGHT_SERVICE') {
      strKind = 'end';
      strData = { label: 'Follows the Night Service setting' };
    } else {
      // ANNOUNCEMENT
      strKind = 'playMessage';
      strData = {
        label: 'Announcement',
        nodeSubtitle: 'Stranded Calls',
        messageType: strandedCalls?.audioMessageSelection === 'CUSTOM' ? 'audio' : 'tts',
        ...audioFields(strandedCalls?.audioFiles, announcementNames),
        cqAnnouncementSource: true,
      };
    }

    const strandedId = uid('cq-stranded');
    nodes.push({
      id: strandedId,
      type: strKind,
      position: { x: CENTER_X + COL_GAP, y: actionRowY },
      data: { kind: strKind, ...strData } as NodeData,
    });
    // Plain description leads on the edge label too, with the Webex policy name
    // kept in parentheses so it's still searchable against Webex's own docs.
    edges.push(mkEdge(`e-${queueNodeId}-stranded`, queueNodeId, strandedId, {
      handle: 'output-2', label: 'No Agents Available (Stranded Calls)', color: '#ef4444',
    }));
  }

  // ── Dynamic extra outputs: compute handle indices ─────────────────────────
  let nextHandle = 3;
  const cbHandle  = callbackEnabled  ? nextHandle++ : -1;
  const escHandle = hasPriorityEsc   ? nextHandle++ : -1;
  const digHandle = hasDigitalHandoff ? nextHandle++ : -1;

  // ── Callback node ─────────────────────────────────────────────────────────
  if (callbackEnabled && cbHandle >= 0) {
    const cbNodeId = uid('cq-callback');
    nodes.push({
      id: cbNodeId,
      type: 'callback',
      position: { x: CENTER_X + 2 * COL_GAP, y: actionRowY },
      data: {
        kind: 'callback',
        label: 'Callback',
        callbackType: 'immediate',
        // callbackNumber/callbackAnnouncement previously read from queueSettings.callBacks
        // — that object doesn't exist in the OpenAPI spec. The confirmed real toggle is
        // waitMessage.callbackOptionEnabled (used for callbackEnabled above); the spec
        // shows no DNIS/announcement sub-fields for it, so left unpopulated rather than
        // guessed. minimumEstimatedCallbackTime/internationalCallbackEnabled also exist
        // on waitMessage but aren't modeled here — flagged as a Small Leftovers item.
      } as NodeData,
    });
    edges.push(mkEdge(`e-${queueNodeId}-callback`, queueNodeId, cbNodeId, {
      handle: `output-${cbHandle}`, label: 'Callback', color: '#0ea5e9',
    }));
    const cbAcceptId = uid('cq-cb-accepted');
    nodes.push({
      id: cbAcceptId,
      type: 'end',
      position: { x: CENTER_X + 2 * COL_GAP, y: actionRowY + ROW_GAP },
      data: { kind: 'end', label: 'Callback Queued' } as NodeData,
    });
    edges.push(mkEdge(`e-${cbNodeId}-accepted`, cbNodeId, cbAcceptId, {
      handle: 'output-0', label: 'Accepted', color: '#22c55e',
    }));
    const cbDeclineId = uid('cq-cb-declined');
    nodes.push({
      id: cbDeclineId,
      type: 'end',
      position: { x: CENTER_X + 3 * COL_GAP, y: actionRowY + ROW_GAP },
      data: { kind: 'end', label: 'Back to Queue' } as NodeData,
    });
    edges.push(mkEdge(`e-${cbNodeId}-declined`, cbNodeId, cbDeclineId, {
      handle: 'output-1', label: 'Declined', color: '#94a3b8',
    }));
  }

  // ── Priority Escalation (CX Essentials: transferToAgentEnabled) ───────────
  if (hasPriorityEsc && escHandle >= 0) {
    const escId = uid('cq-escalate');
    nodes.push({
      id: escId,
      type: 'transfer',
      position: { x: CENTER_X + 3 * COL_GAP, y: actionRowY },
      data: {
        kind: 'transfer',
        label: 'Priority Escalation',
        transferType: 'blind',
        transferNumber: '',
      } as NodeData,
    });
    edges.push(mkEdge(`e-${queueNodeId}-escalate`, queueNodeId, escId, {
      handle: `output-${escHandle}`, label: 'Escalate', color: '#f59e0b',
    }));
    const escEndId = uid('cq-escalate-end');
    nodes.push({
      id: escEndId,
      type: 'end',
      position: { x: CENTER_X + 3 * COL_GAP, y: actionRowY + ROW_GAP },
      data: { kind: 'end', label: 'Escalated' } as NodeData,
    });
    edges.push(mkEdge(`e-${escId}-end`, escId, escEndId, {
      handle: 'output-0', color: '#94a3b8',
    }));
  }

  // ── Digital Channel Handoff (CX Essentials) ───────────────────────────────
  if (hasDigitalHandoff && digHandle >= 0) {
    const digitalId = uid('cq-digital');
    nodes.push({
      id: digitalId,
      type: 'subAutoAttendant',
      position: { x: CENTER_X + 4 * COL_GAP, y: actionRowY },
      data: {
        kind: 'subAutoAttendant',
        label: 'Digital Handoff',
        // Webex's API only exposes a raw destination id here — no type discriminator,
        // so we can't confirm it's actually an Auto-Attendant. Keep the raw id in
        // targetAutoAttendantId (PropertiesPanel uses it to detect/flag the mismatch),
        // but never surface it as-is in the displayed name — a bare GUID on canvas
        // reads as "the tool is broken" to a non-technical viewer.
        targetAutoAttendantId:   qs?.digitalChannelHandoffDestinationId ?? '',
        targetAutoAttendantName: qs?.digitalChannelHandoffDestinationId
          ? 'Digital Handoff — destination not resolved (connect org to verify)'
          : '',
      } as NodeData,
    });
    edges.push(mkEdge(`e-${queueNodeId}-digital`, queueNodeId, digitalId, {
      handle: `output-${digHandle}`, label: 'Digital', color: '#6366f1',
    }));
  }

  // ── Forced Forward bypass dimming ─────────────────────────────────────────
  // Everything except Start and the Forced Forward path itself is still real
  // config but doesn't currently execute — mark it bypassed and dim its edges.
  if (hasForcedForward) {
    for (const n of nodes) {
      if (!ffNodeIds.has(n.id)) {
        (n.data as NodeData).bypassed = true;
      }
    }
    for (const e of edges) {
      if (!(ffNodeIds.has(e.source) && ffNodeIds.has(e.target))) {
        e.style = { ...(e.style ?? {}), opacity: 0.35, strokeDasharray: e.style?.strokeDasharray ?? '4 2' };
      }
    }
  }

  return { nodes, edges };
}
