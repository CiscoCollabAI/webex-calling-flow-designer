/**
 * Converts React Flow canvas nodes + edges into a Webex Auto-Attendant write body.
 *
 * Mirror of importAutoAttendant.ts:
 *   Start → BusinessHours gate? → BH/AH menus → per-key action nodes
 *
 * Edge labels produced by importAutoAttendant:
 *   "Key {digit}"  — DTMF keypress action
 *   "No Input"     — no-input / timeout treatment
 *   "Open"         — business-hours gate open branch
 *   "Closed"       — business-hours gate closed branch
 */

import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../types';
import type {
  WebexAAWriteBody,
  WebexAAMenuWriteConfig,
  WebexAAMenuKeyWriteConfig,
  WebexAACallTreatment,
  WebexAAAction,
} from '../types/webex';

export interface AAExportResult {
  body: WebexAAWriteBody;
  errors: string[];    // fatal — block publish
  warnings: string[];  // non-fatal — logged in progress
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeById(nodes: Node<NodeData>[], id: string): Node<NodeData> | undefined {
  return nodes.find(n => n.id === id);
}

function outEdges(edges: Edge[], sourceId: string): Edge[] {
  return edges.filter(e => e.source === sourceId);
}

const RETRY_NUM_MAP: Record<number, string> = {
  1: 'ONE_TIME', 2: 'TWO_TIMES', 3: 'THREE_TIMES', 4: 'FOUR_TIMES', 5: 'FIVE_TIMES',
};

function toRetryString(n: number): string {
  return RETRY_NUM_MAP[Math.max(1, Math.min(5, n ?? 3))] ?? 'THREE_TIMES';
}

function kindToAAAction(data: NodeData): WebexAAAction {
  switch (data.kind) {
    case 'end':              return 'EXIT';
    case 'transfer':         return data.transferType === 'consultative' ? 'TRANSFER_WITH_PROMPT' : 'TRANSFER_WITHOUT_PROMPT';
    case 'queue':            return 'CALL_QUEUE';
    case 'huntGroup':        return 'HUNT_GROUP';
    case 'subAutoAttendant': return 'AUTO_ATTENDANT';
    case 'repeatMenu':       return 'REPEAT_MENU';
    case 'voicemail':        return 'VOICEMAIL';
    case 'playMessage':      return 'PLAY_ANNOUNCEMENT';
    case 'collectDigits':    return 'EXTENSION_DIALING';
    default:                 return 'EXIT';
  }
}

function buildKeyConfig(node: Node<NodeData>): WebexAAMenuKeyWriteConfig {
  const d = node.data;
  const cfg: WebexAAMenuKeyWriteConfig = {
    action: kindToAAAction(d),
    description: d.label || undefined,
  };
  if (d.kind === 'transfer' && d.transferNumber) cfg.value = d.transferNumber;
  if (d.kind === 'queue' && d.queueId) cfg.callQueueId = d.queueId;
  if (d.kind === 'huntGroup' && d.huntGroupId) cfg.huntGroupId = d.huntGroupId;
  if (d.kind === 'subAutoAttendant' && d.targetAutoAttendantId) cfg.autoAttendantId = d.targetAutoAttendantId;
  return cfg;
}

function buildMenuConfig(
  menuNode: Node<NodeData>,
  nodes: Node<NodeData>[],
  edges: Edge[],
): WebexAAMenuWriteConfig {
  const d = menuNode.data;
  const keyConfigs: Record<string, WebexAAMenuKeyWriteConfig> = {};
  let noInputNode: Node<NodeData> | undefined;

  for (const edge of outEdges(edges, menuNode.id)) {
    const labelStr = String(edge.label ?? '');
    const target = nodeById(nodes, edge.target);
    if (!target) continue;

    if (labelStr === 'No Input') {
      noInputNode = target;
    } else if (labelStr.startsWith('Key ')) {
      const digit = labelStr.slice(4).trim();
      if (digit && digit !== '∅') {
        keyConfigs[digit] = buildKeyConfig(target);
      }
    }
  }

  const menuConfig: WebexAAMenuWriteConfig = {
    greeting: d.menuPrompt === 'Custom greeting' ? 'CUSTOM' : 'DEFAULT',
    extensionEnabled: d.menuExtensionEnabled ?? false,
    nameDialing: d.menuNameDialingEnabled ?? false,
    keyConfigurations: keyConfigs,
  };

  if (noInputNode) {
    const rawAction = kindToAAAction(noInputNode.data);
    // Webex uses PLAY_MESSAGE_AND_DISCONNECT for the play-then-hangup no-input path
    const treatmentAction = rawAction === 'PLAY_ANNOUNCEMENT' ? 'PLAY_MESSAGE_AND_DISCONNECT' : rawAction as string;
    const callTreatment: WebexAACallTreatment = {
      noInputTimer: d.timeoutSeconds ?? 5,
      retryAttemptForNoInput: toRetryString(d.maxRetries ?? 3),
      actionToBePerformed: { action: treatmentAction },
    };
    menuConfig.callTreatment = callTreatment;
  }

  return menuConfig;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function exportAutoAttendant(
  nodes: Node<NodeData>[],
  edges: Edge[],
  flowName: string,
): AAExportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const startNode = nodes.find(n => n.data.kind === 'start');
  if (!startNode) {
    return { body: {}, errors: ['Flow has no Entry Point node'], warnings };
  }

  const d = startNode.data;

  const body: WebexAAWriteBody = {
    name: (flowName || d.label || '').replace(/\s*\(AA\)\s*$/, '').trim() || 'New Auto-Attendant',
    ...(d.aaLanguageCode ? { languageCode: d.aaLanguageCode } : {}),
    ...(d.timezone      ? { timeZone: d.timezone }             : {}),
    ...(d.phoneNumber   ? { phoneNumber: d.phoneNumber }        : {}),
    ...(d.extensionNumber ? { extension: d.extensionNumber }   : {}),
  };

  if (!body.name?.trim()) errors.push('Auto-Attendant name is required');

  // Walk from start
  const startEdges = outEdges(edges, startNode.id);
  let bhGateNode: Node<NodeData> | undefined;
  let directMenuNode: Node<NodeData> | undefined;

  for (const edge of startEdges) {
    const t = nodeById(nodes, edge.target);
    if (!t) continue;
    if (t.data.kind === 'businessHours') bhGateNode = t;
    else if (t.data.kind === 'menu') directMenuNode = t;
  }

  if (bhGateNode) {
    const bhd = bhGateNode.data;
    if (bhd.scheduleName)   body.businessSchedule = bhd.scheduleName;
    if (bhd.holidaySchedule) body.holidaySchedule = bhd.holidaySchedule;

    let bhMenuNode: Node<NodeData> | undefined;
    let ahMenuNode: Node<NodeData> | undefined;

    for (const edge of outEdges(edges, bhGateNode.id)) {
      const t = nodeById(nodes, edge.target);
      if (!t || t.data.kind !== 'menu') continue;
      const lbl = String(edge.label ?? '');
      if (lbl === 'Open' || edge.sourceHandle === 'output-0') bhMenuNode = t;
      else if (lbl === 'Closed' || edge.sourceHandle === 'output-1') ahMenuNode = t;
    }

    if (bhMenuNode) body.businessHoursMenu = buildMenuConfig(bhMenuNode, nodes, edges);
    else warnings.push('No Business Hours IVR menu connected');

    if (ahMenuNode) body.afterHoursMenu = buildMenuConfig(ahMenuNode, nodes, edges);

  } else if (directMenuNode) {
    body.businessHoursMenu = buildMenuConfig(directMenuNode, nodes, edges);
    warnings.push('No Business Hours gate found — same menu used for all hours');
  } else {
    warnings.push('No IVR menu found — Auto-Attendant will have no DTMF options');
  }

  return { body, errors, warnings };
}
