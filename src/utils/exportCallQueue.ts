/**
 * Converts React Flow canvas nodes + edges into Webex Call Queue write bodies.
 *
 * Returns up to 4 bodies (main + 3 sub-resource updates):
 *   mainBody         — PUT/POST /queues/{id}
 *   nightServiceBody — PUT /queues/{id}/nightService
 *   holidayServiceBody — PUT /queues/{id}/holidayService
 *   strandedCallsBody  — PUT /queues/{id}/strandedCalls
 *
 * Edge labels produced by importCallQueue:
 *   "Open" / "Closed" / "Holiday" — from businessHours gate
 *   "Overflow"                     — from queue node output-1
 *   "No Agents"                    — from queue node output-2
 *   "Answered"                     — from queue node output-0
 */

import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../types';
import type { WebexUser } from '../types/webex';
import type {
  WebexQueueWriteBody,
  WebexQueueAgentWriteBody,
  WebexQueueNightService,
  WebexQueueHolidayService,
  WebexQueueStrandedCalls,
  WebexQueueRoutingType,
} from '../types/webex';

export interface CQExportResult {
  mainBody: WebexQueueWriteBody;
  nightServiceBody?: WebexQueueNightService;
  holidayServiceBody?: WebexQueueHolidayService;
  strandedCallsBody?: WebexQueueStrandedCalls;
  errors: string[];
  warnings: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeById(nodes: Node<NodeData>[], id: string): Node<NodeData> | undefined {
  return nodes.find(n => n.id === id);
}

function outEdges(edges: Edge[], sourceId: string): Edge[] {
  return edges.filter(e => e.source === sourceId);
}

function resolveAgents(
  cqAgents: NodeData['cqAgents'],
  users: WebexUser[],
  warnings: string[],
): WebexQueueAgentWriteBody[] {
  if (!cqAgents?.length) return [];
  const result: WebexQueueAgentWriteBody[] = [];
  for (const a of cqAgents) {
    const user =
      users.find(u => u.extension && u.extension === a.extension) ??
      users.find(u => u.displayName === a.name);
    if (!user) {
      warnings.push(`Agent "${a.name}" (ext: ${a.extension ?? '—'}) not found in org — skipped`);
      continue;
    }
    const agentBody: WebexQueueAgentWriteBody = { personId: user.id };
    if (a.skillLevel !== undefined) agentBody.skillLevel = a.skillLevel;
    result.push(agentBody);
  }
  return result;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function exportCallQueue(
  nodes: Node<NodeData>[],
  edges: Edge[],
  flowName: string,
  users: WebexUser[],
): CQExportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const startNode = nodes.find(n => n.data.kind === 'start');
  if (!startNode) {
    return { mainBody: {}, errors: ['Flow has no Entry Point node'], warnings };
  }

  const d = startNode.data;
  const agents = resolveAgents(d.cqAgents, users, warnings);
  const routingType = (d.cqRoutingType as WebexQueueRoutingType) || 'CIRCULAR';

  const mainBody: WebexQueueWriteBody = {
    name: (flowName || d.label || '').replace(/\s*\(CQ(E)?\)\s*$/, '').trim() || 'New Call Queue',
    ...(d.phoneNumber    ? { phoneNumber: d.phoneNumber }   : {}),
    ...(d.extensionNumber ? { extension: d.extensionNumber } : {}),
    ...(d.cqLanguageCode ? { languageCode: d.cqLanguageCode } : {}),
    ...(d.cqTimezone     ? { timeZone: d.cqTimezone }        : {}),
    callPolicies: { policy: routingType },
    ...(d.cqMaxSize ? { queueSettings: { maxSize: d.cqMaxSize } } : {}),
    ...(agents.length ? { agents } : {}),
  };

  if (!mainBody.name?.trim()) errors.push('Call Queue name is required');

  // Walk from start to find businessHours gate (Night Service)
  let bhGateNode: Node<NodeData> | undefined;
  for (const edge of outEdges(edges, startNode.id)) {
    const t = nodeById(nodes, edge.target);
    if (t?.data.kind === 'businessHours') { bhGateNode = t; break; }
  }

  let nightServiceBody: WebexQueueNightService | undefined;
  let holidayServiceBody: WebexQueueHolidayService | undefined;

  if (bhGateNode) {
    const bhd = bhGateNode.data;
    let nsActionNode: Node<NodeData> | undefined;
    let holActionNode: Node<NodeData> | undefined;

    for (const edge of outEdges(edges, bhGateNode.id)) {
      const t = nodeById(nodes, edge.target);
      if (!t) continue;
      const lbl = String(edge.label ?? '');
      if (lbl === 'Closed' || edge.sourceHandle === 'output-1') nsActionNode = t;
      else if (lbl === 'Holiday' || edge.sourceHandle === 'output-2') holActionNode = t;
    }

    // Night Service body — flat shape confirmed against a live org response
    // (no businessHoursConfig nesting, action instead of offHoursTransferType).
    nightServiceBody = {
      nightServiceEnabled: true,
      ...(bhd.scheduleName      ? { businessHoursName: bhd.scheduleName }        : {}),
      ...(bhd.scheduleLevel     ? { businessHoursLevel: bhd.scheduleLevel }      : {}),
      ...(bhd.holidaySchedule   ? { holidayScheduleName: bhd.holidaySchedule }   : {}),
      ...(bhd.holidayScheduleId ? { holidayScheduleId: bhd.holidayScheduleId }   : {}),
      ...(nsActionNode?.data.kind === 'transfer' ? {
        action: 'TRANSFER',
        transferPhoneNumber: nsActionNode.data.transferNumber || undefined,
      } : nsActionNode?.data.kind === 'voicemail' ? {
        action: 'VOICEMAIL',
      } : nsActionNode ? {
        // Only 'BUSY' is confirmed for a non-transfer/voicemail action from real data;
        // a distinct "plain disconnect" value may exist but hasn't been observed yet.
        action: 'BUSY',
      } : {}),
    };

    // Holiday Service body — flat shape confirmed against live org responses.
    // Only BUSY and TRANSFER are real Control Hub options (confirmed complete).
    if (holActionNode) {
      let action: WebexQueueHolidayService['action'] = 'NONE';
      let transferPhoneNumber: string | undefined;

      if (holActionNode.data.kind === 'transfer') {
        action = 'TRANSFER';
        transferPhoneNumber = holActionNode.data.transferNumber || undefined;
      } else if (holActionNode.data.kind === 'end' && holActionNode.data.label === 'Holiday: Busy Treatment') {
        action = 'BUSY';
      }

      holidayServiceBody = {
        holidayServiceEnabled: true,
        action,
        ...(transferPhoneNumber ? { transferPhoneNumber }     : {}),
        ...(bhd.holidaySchedule      ? { holidayScheduleName: bhd.holidaySchedule }   : {}),
        ...(bhd.holidayScheduleLevel ? { holidayScheduleLevel: bhd.holidayScheduleLevel } : {}),
      };
    }
  }

  // Find Queue node and its "No Agents" output (output-2 or label "No Agents")
  const queueNode = nodes.find(n => n.data.kind === 'queue');
  let strandedCallsBody: WebexQueueStrandedCalls | undefined;

  if (queueNode) {
    for (const edge of outEdges(edges, queueNode.id)) {
      const lbl = String(edge.label ?? '');
      if (lbl !== 'No Agents' && edge.sourceHandle !== 'output-2') continue;
      const t = nodeById(nodes, edge.target);
      if (!t) continue;
      if (t.data.kind === 'transfer') {
        strandedCallsBody = { action: 'TRANSFER', transferPhoneNumber: t.data.transferNumber || undefined };
      } else if (t.data.kind === 'playMessage') {
        strandedCallsBody = { action: 'ANNOUNCEMENT' };
      } else if (t.data.kind === 'end') {
        // Lower-cased substring match — tolerant of both the current plain-language
        // labels ("Plays a busy tone...") and older exports/drafts saved with the
        // previous technical labels ("No Agents: Busy Treatment"), so relabeling
        // the display text doesn't silently break round-tripping this enum.
        const label = (t.data.label || '').toLowerCase();
        strandedCallsBody = {
          action: label.includes('busy') ? 'BUSY'
            : label.includes('ring') ? 'RINGING'
            : label.includes('night service') ? 'NIGHT_SERVICE'
            : 'NONE',
        };
      } else {
        strandedCallsBody = { action: 'NONE' };
      }
      break;
    }
  }

  return { mainBody, nightServiceBody, holidayServiceBody, strandedCallsBody, errors, warnings };
}
