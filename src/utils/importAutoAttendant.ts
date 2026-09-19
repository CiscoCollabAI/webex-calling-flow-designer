/**
 * Converts a Webex Auto-Attendant detail API response into React Flow nodes + edges.
 *
 * Actual API format (confirmed from live org):
 *   - keyConfigurations: ARRAY of {key, action, value?, description?, audioAnnouncementFile?}
 *   - Timing lives in menu.callTreatment.{noInputTimer, retryAttemptForNoInput, actionToBePerformed}
 *   - Transfer phone number is in item.value (not transferPhoneNumber)
 *   - Action names include EXIT (= disconnect) and TRANSFER_TO_OPERATOR
 *
 * Layout (top-down tree):
 *   Row 0: Start node
 *   Row 1: Business Hours gate (when schedule names present)
 *   Row 2: BH IVR menu  |  AH IVR menu  (side by side)
 *   Row 3: Per-key action nodes
 */

import type { Node, Edge } from '@xyflow/react';
import type { WebexAutoAttendantDetail, WebexAAMenuConfig, WebexAAKeyConfig, WebexAAAction, WebexSchedule } from '../types/webex';
import type { NodeData, NodeKind } from '../types';

const COLUMN_GAP = 220;
const ROW_GAP = 160;
const BASE_X = 100;
const BASE_Y = 60;

let _idSeq = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_idSeq}-${Date.now()}`;
}

// ── Normalize keyConfigurations ───────────────────────────────────────────────
// API returns an array [{key:"1", action:"...", ...}].
// We normalize to Record<digit, config> for uniform downstream use.

function collectKeys(menu: WebexAAMenuConfig): Record<string, WebexAAKeyConfig> {
  const result: Record<string, WebexAAKeyConfig> = {};

  if (Array.isArray(menu.keyConfigurations)) {
    for (const item of menu.keyConfigurations) {
      if (item.key != null) result[item.key] = item;
    }
  } else if (menu.keyConfigurations && typeof menu.keyConfigurations === 'object') {
    // Legacy Record<digit, config> format
    for (const [digit, cfg] of Object.entries(menu.keyConfigurations)) {
      result[digit] = { ...(cfg as WebexAAKeyConfig), key: digit };
    }
  }

  // Legacy: zeroTransferAction overrides key 0 only if not already present
  if (menu.zeroTransferAction && !result['0']) {
    result['0'] = { ...menu.zeroTransferAction, key: '0' };
  }

  return result;
}

function sortedDigits(keys: Record<string, unknown>): string[] {
  const order = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'];
  return Object.keys(keys).sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

// ── Timing resolver ───────────────────────────────────────────────────────────

const RETRY_STRING_MAP: Record<string, number> = {
  ONE_TIME: 1,
  TWO_TIMES: 2,
  THREE_TIMES: 3,
  FOUR_TIMES: 4,
  FIVE_TIMES: 5,
};

const NO_INPUT_ACTION_MAP: Record<string, NodeData['invalidInputAction']> = {
  PLAY_MESSAGE_AND_DISCONNECT: 'disconnect',
  DISCONNECT: 'disconnect',
  EXIT: 'disconnect',
  REPEAT_MENU: 'repeat',
  TRANSFER_TO_OPERATOR: 'transfer',
  TRANSFER_WITH_PROMPT: 'transfer',
};

function resolveMenuTiming(
  menu: WebexAAMenuConfig,
): { timeoutSeconds: number; maxRetries: number; invalidInputAction: NodeData['invalidInputAction'] } {
  const t = menu.callTreatment;

  const timeoutSeconds =
    t?.noInputTimer ??
    menu.noInputTimeout ??
    5;

  const maxRetries =
    RETRY_STRING_MAP[t?.retryAttemptForNoInput ?? ''] ??
    menu.maxMenuRepeat ??
    3;

  const invalidInputAction =
    NO_INPUT_ACTION_MAP[t?.actionToBePerformed?.action ?? ''] ??
    NO_INPUT_ACTION_MAP[menu.invalidKeyHandledBy ?? ''] ??
    'repeat';

  return { timeoutSeconds, maxRetries, invalidInputAction };
}

// ── Action → NodeKind mapping ────────────────────────────────────────────────

function actionToKind(action: WebexAAAction | string | undefined): NodeKind {
  switch (action as string) {
    case 'DISCONNECT': case 'EXIT': return 'end';
    case 'TRANSFER_WITH_PROMPT': case 'TRANSFER_WITHOUT_PROMPT':
    case 'TRANSFER_TO_OPERATOR': case 'OPERATOR': return 'transfer';
    case 'HUNT_GROUP': return 'huntGroup';
    case 'CALL_QUEUE': return 'queue';
    case 'AUTO_ATTENDANT': return 'subAutoAttendant';
    case 'REPEAT_MENU': return 'repeatMenu';
    case 'PLAY_ANNOUNCEMENT': return 'playMessage';
    case 'VOICEMAIL': return 'voicemail';
    case 'EXTENSION_DIALING': case 'NAME_DIALING': return 'collectDigits';
    case 'PLAY_MESSAGE_AND_DISCONNECT': return 'playMessage';
    default: return 'transfer';
  }
}

// ── Action → canvas node mapping ─────────────────────────────────────────────

function actionToNodeData(
  action: WebexAAAction | string,
  cfg: WebexAAKeyConfig,
  digit: string,
): { kind: NodeData['kind']; data: Partial<NodeData> } {
  // Phone number: new format uses cfg.value; legacy used cfg.transferPhoneNumber
  const phoneNumber = cfg.value ?? cfg.transferPhoneNumber ?? '';
  // Audio file: new format uses audioAnnouncementFile; legacy used audioFile
  const audioFileName =
    cfg.audioAnnouncementFile?.fileName ??
    cfg.audioFile?.name ??
    '';
  const label = cfg.description || '';

  switch (action as WebexAAAction) {
    case 'CALL_QUEUE':
      return {
        kind: 'queue',
        data: {
          label: label || `Queue (key ${digit})`,
          queueId: cfg.callQueueId,
          queueName: label,
        },
      };

    case 'HUNT_GROUP':
      return {
        kind: 'huntGroup',
        data: {
          label: label || `Hunt Group (key ${digit})`,
          huntGroupId: cfg.huntGroupId,
          huntGroupName: label,
        },
      };

    case 'AUTO_ATTENDANT':
      return {
        kind: 'subAutoAttendant',
        data: {
          label: label || `Sub-AA (key ${digit})`,
          targetAutoAttendantId: cfg.autoAttendantId,
          targetAutoAttendantName: label,
        },
      };

    case 'TRANSFER_WITH_PROMPT':
      return {
        kind: 'transfer',
        data: {
          label: label || `Transfer (key ${digit})`,
          transferType: 'consultative',
          transferNumber: phoneNumber,
        },
      };

    case 'TRANSFER_WITHOUT_PROMPT':
      return {
        kind: 'transfer',
        data: {
          label: label || `Transfer (key ${digit})`,
          transferType: 'blind',
          transferNumber: phoneNumber,
        },
      };

    case 'TRANSFER_TO_OPERATOR':
    case 'OPERATOR':
      return {
        kind: 'transfer',
        data: {
          label: label || `Operator (key ${digit})`,
          transferType: 'blind',
          transferNumber: phoneNumber,
        },
      };

    case 'VOICEMAIL':
      return {
        kind: 'voicemail',
        data: { label: label || `Voicemail (key ${digit})` },
      };

    case 'EXIT':
    case 'DISCONNECT':
      return {
        kind: 'end',
        data: { label: label || `Exit (key ${digit})` },
      };

    case 'PLAY_ANNOUNCEMENT':
      return {
        kind: 'playMessage',
        data: {
          label: label || `Announcement (key ${digit})`,
          messageType: 'audio' as const,
          audioFile: audioFileName,
        },
      };

    case 'REPEAT_MENU':
      return {
        kind: 'repeatMenu',
        data: { label: label || `Repeat Menu (key ${digit})` },
      };

    case 'EXTENSION_DIALING':
      return {
        kind: 'collectDigits',
        data: { label: label || `Ext Dial (key ${digit})` },
      };

    case 'NAME_DIALING':
      return {
        kind: 'collectDigits',
        data: { label: label || `Name Dial (key ${digit})` },
      };

    default:
      return {
        kind: 'transfer',
        data: { label: label || `Action (key ${digit})`, transferNumber: phoneNumber },
      };
  }
}

// ── Menu action nodes (row 3) ─────────────────────────────────────────────────

function buildMenuNodes(
  menu: WebexAAMenuConfig,
  menuNodeId: string,
  startCol: number,
  rowY: number,
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];
  const keys = collectKeys(menu);

  sortedDigits(keys).forEach((digit, colOffset) => {
    const cfg = keys[digit];
    if (!cfg) return;

    const { kind, data } = actionToNodeData(cfg.action, cfg, digit);
    const nodeId = nextId(`aa-action-${digit}`);

    nodes.push({
      id: nodeId,
      type: kind,
      position: { x: BASE_X + (startCol + colOffset) * COLUMN_GAP, y: rowY },
      data: { kind, label: data.label ?? `Key ${digit}`, menuKey: digit, ...data } as NodeData,
    });

    edges.push({
      id: `e-${menuNodeId}-${nodeId}`,
      source: menuNodeId,
      target: nodeId,
      sourceHandle: `output-${colOffset}`,
      label: `Key ${digit}`,
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      labelStyle: { fontSize: 11, fill: '#64748b' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
    });
  });

  return { nodes, edges };
}

// ── Post-retry treatment node builder ────────────────────────────────────────

function buildTreatmentNodes(
  callTreatment: WebexAAMenuConfig['callTreatment'],
  menuNodeId: string,
  treatmentHandleIndex: number,
  col: number,
  rowY: number,
): { nodes: Node<NodeData>[]; edges: Edge[] } {
  if (!callTreatment?.actionToBePerformed?.action) {
    return { nodes: [], edges: [] };
  }

  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];
  const action = callTreatment.actionToBePerformed.action;
  const greeting = callTreatment.actionToBePerformed.greeting;

  const x = BASE_X + col * COLUMN_GAP;

  let treatmentNodeId: string;

  if (action === 'PLAY_MESSAGE_AND_DISCONNECT') {
    treatmentNodeId = nextId('aa-noinput-play');
    nodes.push({
      id: treatmentNodeId,
      type: 'playMessage',
      position: { x, y: rowY },
      data: {
        kind: 'playMessage',
        label: 'No-Input: Play & Disconnect',
        menuKey: '∅',
        messageType: 'audio',
        audioFile: greeting === 'CUSTOM' ? 'custom-noinput.wav' : '',
      } as NodeData,
    });
    edges.push({
      id: `e-${menuNodeId}-${treatmentNodeId}`,
      source: menuNodeId,
      target: treatmentNodeId,
      sourceHandle: `output-${treatmentHandleIndex}`,
      label: 'No Input',
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 2' },
      labelStyle: { fontSize: 11, fill: '#64748b' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
    });

    // Disconnect node below play message
    const endId = nextId('aa-noinput-end');
    nodes.push({
      id: endId,
      type: 'end',
      position: { x, y: rowY + ROW_GAP },
      data: { kind: 'end', label: 'Disconnect' } as NodeData,
    });
    edges.push({
      id: `e-${treatmentNodeId}-${endId}`,
      source: treatmentNodeId,
      target: endId,
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    });
  } else if (action === 'REPEAT_MENU') {
    treatmentNodeId = nextId('aa-noinput-repeat');
    nodes.push({
      id: treatmentNodeId,
      type: 'repeatMenu',
      position: { x, y: rowY },
      data: { kind: 'repeatMenu', label: 'No-Input: Repeat Menu', menuKey: '∅' } as NodeData,
    });
    edges.push({
      id: `e-${menuNodeId}-${treatmentNodeId}`,
      source: menuNodeId,
      target: treatmentNodeId,
      sourceHandle: `output-${treatmentHandleIndex}`,
      label: 'No Input',
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 2' },
      labelStyle: { fontSize: 11, fill: '#64748b' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
    });
  } else if (action === 'TRANSFER_TO_OPERATOR') {
    treatmentNodeId = nextId('aa-noinput-transfer');
    nodes.push({
      id: treatmentNodeId,
      type: 'transfer',
      position: { x, y: rowY },
      data: {
        kind: 'transfer',
        label: 'No-Input: Transfer to Operator',
        menuKey: '∅',
        transferType: 'blind',
      } as NodeData,
    });
    edges.push({
      id: `e-${menuNodeId}-${treatmentNodeId}`,
      source: menuNodeId,
      target: treatmentNodeId,
      sourceHandle: `output-${treatmentHandleIndex}`,
      label: 'No Input',
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 2' },
      labelStyle: { fontSize: 11, fill: '#64748b' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
    });
  } else {
    treatmentNodeId = nextId('aa-noinput-end');
    nodes.push({
      id: treatmentNodeId,
      type: 'end',
      position: { x, y: rowY },
      data: { kind: 'end', label: 'No-Input: Disconnect', menuKey: '∅' } as NodeData,
    });
    edges.push({
      id: `e-${menuNodeId}-${treatmentNodeId}`,
      source: menuNodeId,
      target: treatmentNodeId,
      sourceHandle: `output-${treatmentHandleIndex}`,
      label: 'No Input',
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 2' },
      labelStyle: { fontSize: 11, fill: '#64748b' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
    });
  }

  return { nodes, edges };
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface ImportResult {
  nodes: Node<NodeData>[];
  edges: Edge[];
}

export function importAutoAttendant(aa: WebexAutoAttendantDetail, schedules: WebexSchedule[] = []): ImportResult {
  _idSeq = 0;

  const findSchedule = (name: string | undefined) =>
    schedules.find(s => s.name === name);

  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  const bhMenu = aa.businessHoursMenu;
  const ahMenu = aa.afterHoursMenu;

  const bhKeys = bhMenu ? collectKeys(bhMenu) : {};
  const ahKeys = ahMenu ? collectKeys(ahMenu) : {};

  const hasBusinessHours = Object.keys(bhKeys).length > 0;
  const hasAfterHours    = Object.keys(ahKeys).length > 0;

  // ── Row 0: Start ─────────────────────────────────────────────────────────────
  const startId = nextId('aa-start');
  nodes.push({
    id: startId,
    type: 'start',
    position: { x: BASE_X + 2 * COLUMN_GAP, y: BASE_Y },
    data: {
      kind: 'start',
      label: aa.name,
      phoneNumber: aa.phoneNumber ?? '',
      extensionNumber: aa.extension ?? '',
      aaLanguage: (aa as any).language ?? '',
      aaLanguageCode: aa.languageCode ?? '',
      aaExtensionDialing: (aa as any).extensionDialing ?? '',
      aaNameDialing: (aa as any).nameDialing ?? '',
      timezone: aa.timeZone ?? '',
      // AA Overview
      aaEnabled: aa.enabled ?? true,
      aaCallForwardingEnabled: aa.callForwarding?.enabled ?? aa.callForwarding?.always?.enabled ?? false,
      aaCallForwardingDestination: aa.callForwarding?.always?.destination ?? '',
      aaCallForwardingToVoicemail: aa.callForwarding?.always?.destinationVoicemailEnabled ?? false,
      aaDialingOptions: (aa as any).extensionDialing ?? '',
      // AA General Settings
      aaLocationName: aa.locationName ?? '',
      aaCallerIdPolicy: aa.externalCallerIdNamePolicy ?? '',
      aaCallerIdDisplayName: [aa.firstName, aa.lastName].filter(Boolean).join(' ') || aa.name,
      aaCustomCallerIdName: aa.customExternalCallerIdName ?? '',
      aaDialByNameEnabled: aa.nameDialingEnabled ?? false,
    } as NodeData,
  });

  let prevId = startId;
  let currentRow = 1;

  // ── Row 1: Business Hours gate ────────────────────────────────────────────────
  const hasBhGate = !!(aa.businessSchedule || aa.holidaySchedule);
  const bhGateId = nextId('aa-bh');

  const bhSched = findSchedule(aa.businessSchedule);
  const holSched = findSchedule(aa.holidaySchedule);

  if (hasBhGate) {
    nodes.push({
      id: bhGateId,
      type: 'businessHours',
      position: { x: BASE_X + 2 * COLUMN_GAP, y: BASE_Y + currentRow * ROW_GAP },
      data: {
        kind: 'businessHours',
        label: 'Business Hours Check',
        scheduleName:       aa.businessSchedule ?? '',
        scheduleId:         bhSched?.id ?? '',
        holidaySchedule:    aa.holidaySchedule ?? '',
        holidayScheduleId:  holSched?.id ?? '',
        timezone:           aa.timeZone ?? '',
      } as NodeData,
    });
    edges.push({
      id: `e-${prevId}-${bhGateId}`,
      source: prevId,
      target: bhGateId,
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    });
    prevId = bhGateId;
    currentRow++;
  }

  const menuRow = BASE_Y + currentRow * ROW_GAP;

  // ── Fallback: no menus ────────────────────────────────────────────────────────
  if (!hasBusinessHours && !hasAfterHours) {
    const endId = nextId('aa-end');
    nodes.push({
      id: endId,
      type: 'end',
      position: { x: BASE_X + 2 * COLUMN_GAP, y: menuRow },
      data: { kind: 'end', label: 'Disconnect' } as NodeData,
    });
    edges.push({
      id: `e-${prevId}-${endId}`,
      source: prevId,
      target: endId,
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    });
    return { nodes, edges };
  }

  // ── Row 2: IVR menu nodes ─────────────────────────────────────────────────────
  const bhKeyCount = Object.keys(bhKeys).length;
  const ahKeyCount = Object.keys(ahKeys).length;

  let nextCol = 0;
  let bhMenuId: string | null = null;
  let ahMenuId: string | null = null;

  if (hasBusinessHours && bhMenu) {
    const bhTiming = resolveMenuTiming(bhMenu);
    bhMenuId = nextId('aa-bh-menu');
    const hasBhTreatment = !!(bhMenu.callTreatment?.actionToBePerformed?.action);
    const bhBaseOptions = sortedDigits(bhKeys).map((d) => ({
      digit: d,
      label: bhKeys[d]?.description || `Key ${d}`,
      actionKind: actionToKind(bhKeys[d]?.action),
    }));
    const bhMenuOptions = hasBhTreatment
      ? [...bhBaseOptions, {
          digit: '∅',
          label: 'No Input / Timeout',
          actionKind: actionToKind(bhMenu.callTreatment?.actionToBePerformed?.action),
        }]
      : bhBaseOptions;
    const centerCol = nextCol + Math.floor(Math.max(bhKeyCount - 1, 0) / 2);
    nodes.push({
      id: bhMenuId,
      type: 'menu',
      position: { x: BASE_X + centerCol * COLUMN_GAP, y: menuRow },
      data: {
        kind: 'menu',
        label: 'Business Hours IVR',
        menuPrompt: bhMenu.greeting === 'CUSTOM' ? 'Custom greeting' : 'Default greeting',
        menuGreetingFile: bhMenu.greetingFile?.name ?? '',
        menuOptions: bhMenuOptions,
        menuExtensionEnabled: bhMenu.extensionEnabled ?? false,
        menuNameDialingEnabled: bhMenu.nameDialing ?? false,
        menuTransferToOperatorEnabled: bhMenu.transferToOperatorEnabled ?? false,
        ...bhTiming,
      } as NodeData,
    });

    edges.push(hasBhGate
      ? {
          id: `e-${bhGateId}-${bhMenuId}-open`,
          source: bhGateId, target: bhMenuId, sourceHandle: 'output-0',
          label: 'Open', animated: false,
          style: { stroke: '#22c55e', strokeWidth: 1.5 },
          labelStyle: { fontSize: 11, fill: '#16a34a' },
          labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
        }
      : {
          id: `e-${startId}-${bhMenuId}`,
          source: startId, target: bhMenuId, animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        });

    nextCol += Math.max(bhKeyCount, 1) + 1;
  }

  if (hasAfterHours && ahMenu) {
    const ahTiming = resolveMenuTiming(ahMenu);
    ahMenuId = nextId('aa-ah-menu');
    const hasAhTreatment = !!(ahMenu.callTreatment?.actionToBePerformed?.action);
    const ahBaseOptions = sortedDigits(ahKeys).map((d) => ({
      digit: d,
      label: ahKeys[d]?.description || `Key ${d}`,
      actionKind: actionToKind(ahKeys[d]?.action),
    }));
    const ahMenuOptions = hasAhTreatment
      ? [...ahBaseOptions, {
          digit: '∅',
          label: 'No Input / Timeout',
          actionKind: actionToKind(ahMenu.callTreatment?.actionToBePerformed?.action),
        }]
      : ahBaseOptions;
    const centerCol = nextCol + Math.floor(Math.max(ahKeyCount - 1, 0) / 2);
    nodes.push({
      id: ahMenuId,
      type: 'menu',
      position: { x: BASE_X + centerCol * COLUMN_GAP, y: menuRow },
      data: {
        kind: 'menu',
        label: 'After Hours IVR',
        menuPrompt: ahMenu.greeting === 'CUSTOM' ? 'Custom greeting' : 'Default greeting',
        menuGreetingFile: ahMenu.greetingFile?.name ?? '',
        menuOptions: ahMenuOptions,
        menuExtensionEnabled: ahMenu.extensionEnabled ?? false,
        menuNameDialingEnabled: ahMenu.nameDialing ?? false,
        menuTransferToOperatorEnabled: ahMenu.transferToOperatorEnabled ?? false,
        ...ahTiming,
      } as NodeData,
    });

    edges.push(hasBhGate
      ? {
          id: `e-${bhGateId}-${ahMenuId}-closed`,
          source: bhGateId, target: ahMenuId, sourceHandle: 'output-1',
          label: 'Closed', animated: false,
          style: { stroke: '#f97316', strokeWidth: 1.5 },
          labelStyle: { fontSize: 11, fill: '#ea580c' },
          labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
        }
      : {
          id: `e-${startId}-${ahMenuId}`,
          source: startId, target: ahMenuId, animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        });

    // Fix 2: add Holiday edge when both a holiday schedule and an AH menu are present
    if (hasBhGate && aa.holidaySchedule) {
      edges.push({
        id: `e-${bhGateId}-${ahMenuId}-holiday`,
        source: bhGateId, target: ahMenuId, sourceHandle: 'output-2',
        label: 'Holiday', animated: false,
        style: { stroke: '#8b5cf6', strokeWidth: 1.5 },
        labelStyle: { fontSize: 11, fill: '#7c3aed' },
        labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
      });
    }
  }

  // Fix 3: fallback when there is a BH gate but no after-hours menu
  if (hasBhGate && !hasAfterHours) {
    const ahFallbackId = nextId('aa-ah-disconnect');
    nodes.push({
      id: ahFallbackId,
      type: 'end',
      position: { x: BASE_X + (nextCol + 1) * COLUMN_GAP, y: menuRow },
      data: { kind: 'end', label: 'Closed: Disconnect' } as NodeData,
    });
    edges.push({
      id: `e-${bhGateId}-${ahFallbackId}-closed`,
      source: bhGateId, target: ahFallbackId, sourceHandle: 'output-1',
      label: 'Closed', animated: false,
      style: { stroke: '#f97316', strokeWidth: 1.5 },
      labelStyle: { fontSize: 11, fill: '#ea580c' },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
    });
    if (aa.holidaySchedule) {
      edges.push({
        id: `e-${bhGateId}-${ahFallbackId}-holiday`,
        source: bhGateId, target: ahFallbackId, sourceHandle: 'output-2',
        label: 'Holiday', animated: false,
        style: { stroke: '#8b5cf6', strokeWidth: 1.5 },
        labelStyle: { fontSize: 11, fill: '#7c3aed' },
        labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
      });
    }
  }

  // ── Row 3: Per-key action nodes ───────────────────────────────────────────────
  const actionRow = BASE_Y + (currentRow + 1) * ROW_GAP;
  let actionCol = 0;

  if (bhMenuId && bhMenu) {
    const r = buildMenuNodes(bhMenu, bhMenuId, actionCol, actionRow);
    nodes.push(...r.nodes);
    edges.push(...r.edges);
    const bhKeyCountActual = Object.keys(collectKeys(bhMenu)).length;
    if (bhMenu.callTreatment?.actionToBePerformed?.action) {
      const treatmentCol = actionCol + bhKeyCountActual;
      const treatmentHandleIndex = bhKeyCountActual;
      const tr = buildTreatmentNodes(bhMenu.callTreatment, bhMenuId, treatmentHandleIndex, treatmentCol, actionRow);
      nodes.push(...tr.nodes);
      edges.push(...tr.edges);
    }
    actionCol += Math.max(bhKeyCount, 1) + 1;
  }

  if (ahMenuId && ahMenu) {
    const r = buildMenuNodes(ahMenu, ahMenuId, actionCol, actionRow);
    nodes.push(...r.nodes);
    edges.push(...r.edges);
    const ahKeyCountActual = Object.keys(collectKeys(ahMenu)).length;
    if (ahMenu.callTreatment?.actionToBePerformed?.action) {
      const treatmentCol = actionCol + ahKeyCountActual;
      const treatmentHandleIndex = ahKeyCountActual;
      const tr = buildTreatmentNodes(ahMenu.callTreatment, ahMenuId, treatmentHandleIndex, treatmentCol, actionRow);
      nodes.push(...tr.nodes);
      edges.push(...tr.edges);
    }
  }

  return { nodes, edges };
}
