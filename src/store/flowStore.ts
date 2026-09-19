import { create } from 'zustand';
import { type Node, type Edge, addEdge, type Connection, type NodeChange, type EdgeChange, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import type { NodeData, NodeKind, CanvasMode } from '../types';
import { autoLayout } from '../utils/autoLayout';

const DRAFT_KEY = 'webex_flow_draft';

export interface FlowDraft {
  flowName: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  flowMeta: FlowMeta;
  canvasMode: CanvasMode;
  savedAt: string;
}

export function getFlowDraft(): FlowDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as FlowDraft) : null;
  } catch {
    return null;
  }
}

// ── Flow metadata — tracks which Webex resource this canvas represents ────────

export interface FlowMeta {
  locationId: string | null;
  resourceId: string | null;
  resourceType: 'aa' | 'cq' | 'cxe' | null;
  isNew: boolean;               // true = POST (create), false = PUT (update)
  lastPublishedAt: string | null;
}

// ── Publish state — tracks the in-progress publish operation ─────────────────

export interface PublishState {
  status: 'idle' | 'validating' | 'publishing' | 'done' | 'error';
  progress: string[];   // ordered log of steps completed
  errors: string[];     // API error messages
}

const defaultFlowMeta: FlowMeta = {
  locationId: null,
  resourceId: null,
  resourceType: null,
  isNew: true,
  lastPublishedAt: null,
};

const defaultPublishState: PublishState = {
  status: 'idle',
  progress: [],
  errors: [],
};

interface FlowStore {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  flowName: string;
  isDirty: boolean;
  fitViewTrigger: number;
  flowMeta: FlowMeta;
  publishState: PublishState;

  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  selectNode: (id: string | null) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  setFlowName: (name: string) => void;
  setFlowMeta: (meta: Partial<FlowMeta>) => void;
  resetPublish: () => void;
  appendPublishProgress: (msg: string) => void;
  setPublishStatus: (status: PublishState['status'], errors?: string[]) => void;
  exportFlow: () => string;
  importFlow: (json: string) => void;
  clearFlow: () => void;
  newBlankFlow: () => void;
  validateFlow: () => { valid: boolean; errors: string[] };
  requestFitView: () => void;
  autoLayout: () => void;

  // Draft (localStorage)
  draftSavedAt: string | null;
  saveDraft: (canvasMode: CanvasMode) => void;
  discardDraft: () => void;
  restoreDraft: (draft: FlowDraft) => void;
}

let nodeIdCounter = 100;

const defaultNodeData = (kind: NodeKind): NodeData => {
  const base: NodeData = { label: '', kind };
  switch (kind) {
    case 'start':
      return { ...base, label: 'Entry Point', phoneNumber: '', extensionNumber: '' };
    case 'end':
      return { ...base, label: 'Disconnect' };
    case 'menu':
      return {
        ...base, label: 'IVR Menu',
        menuPrompt: 'Press 1 for Sales, Press 2 for Support.',
        menuOptions: [
          { digit: '1', label: 'Sales', description: 'Route to Sales' },
          { digit: '2', label: 'Support', description: 'Route to Support' },
          { digit: '0', label: 'Operator', description: 'Route to Operator' },
        ],
        timeoutSeconds: 5,
        maxRetries: 3,
        invalidInputAction: 'repeat',
      };
    case 'playMessage':
      return {
        ...base, label: 'Play Message',
        messageType: 'tts',
        messageText: 'Thank you for calling. Please hold.',
        language: 'en-US',
        voice: 'female',
      };
    case 'collectDigits':
      return {
        ...base, label: 'Collect Digits',
        collectPrompt: 'Please enter your account number followed by the hash key.',
        minDigits: 1,
        maxDigits: 10,
        terminationDigit: '#',
        interDigitTimeout: 3,
      };
    case 'queue':
      return {
        ...base, label: 'Call Queue',
        queueName: '',
        maxWaitTime: 300,
        mohEnabled: true,
        holdMusicType: 'default',
        estimatedWaitEnabled: true,
        callbackEnabled: false,
      };
    case 'agentDirect':
      return { ...base, label: 'Direct to Agent', agentName: '', agentExtension: '' };
    case 'huntGroup':
      return { ...base, label: 'Hunt Group', huntGroupName: '', huntGroupId: '' };
    case 'subAutoAttendant':
      return { ...base, label: 'Sub Auto-Attendant', targetAutoAttendantName: '', targetAutoAttendantId: '' };
    case 'repeatMenu':
      return { ...base, label: 'Repeat Menu' };
    case 'businessHours':
      return {
        ...base, label: 'Business Hours',
        scheduleName: 'Main Office Hours',
        timezone: 'Europe/Berlin',
        businessHours: [
          { day: 'Monday', open: true, start: '08:00', end: '18:00' },
          { day: 'Tuesday', open: true, start: '08:00', end: '18:00' },
          { day: 'Wednesday', open: true, start: '08:00', end: '18:00' },
          { day: 'Thursday', open: true, start: '08:00', end: '18:00' },
          { day: 'Friday', open: true, start: '08:00', end: '17:00' },
          { day: 'Saturday', open: false, start: '09:00', end: '13:00' },
          { day: 'Sunday', open: false, start: '09:00', end: '13:00' },
        ],
      };
    case 'transfer':
      return {
        ...base, label: 'Transfer',
        transferType: 'blind',
        transferTarget: '',
        transferNumber: '',
      };
    case 'voicemail':
      return {
        ...base, label: 'Voicemail',
        voicemailTarget: 'group',
        voicemailExtension: '',
        greetingType: 'default',
      };
    case 'branch':
      return {
        ...base, label: 'Branch',
        variable: 'callerInput',
        operator: 'equals',
        compareValue: '',
      };
    case 'httpRequest':
      return {
        ...base, label: 'HTTP Request',
        url: '',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"ani": "{{callerANI}}"}',
      };
    case 'callback':
      return {
        ...base, label: 'Schedule Callback',
        callbackType: 'immediate',
        callbackNumber: '{{callerANI}}',
        callbackMessage: 'We will call you back shortly.',
      };
    case 'setVariable':
      return { ...base, label: 'Set Variable', variableName: '', variableValue: '' };
    default:
      return base;
  }
};

const initialNodes: Node<NodeData>[] = [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 360, y: 60 },
    data: { ...defaultNodeData('start'), phoneNumber: '+49891234567', extensionNumber: '1000' },
  },
  {
    id: 'biz-1',
    type: 'businessHours',
    position: { x: 280, y: 220 },
    data: defaultNodeData('businessHours'),
  },
  {
    id: 'menu-1',
    type: 'menu',
    position: { x: 120, y: 400 },
    data: defaultNodeData('menu'),
  },
  {
    id: 'msg-closed',
    type: 'playMessage',
    position: { x: 560, y: 400 },
    data: {
      ...defaultNodeData('playMessage'),
      label: 'Closed Message',
      messageText: 'We are currently closed. Our business hours are Monday to Friday, 8 AM to 6 PM. Please call back during business hours.',
    },
  },
  {
    id: 'queue-sales',
    type: 'queue',
    position: { x: 20, y: 600 },
    data: {
      ...defaultNodeData('queue'),
      label: 'Sales Queue',
      queueName: 'Sales',
    },
  },
  {
    id: 'queue-support',
    type: 'queue',
    position: { x: 240, y: 600 },
    data: {
      ...defaultNodeData('queue'),
      label: 'Support Queue',
      queueName: 'Technical Support',
    },
  },
  {
    id: 'vm-after-hours',
    type: 'voicemail',
    position: { x: 560, y: 580 },
    data: {
      ...defaultNodeData('voicemail'),
      label: 'After-Hours VM',
      voicemailTarget: 'group',
      voicemailExtension: 'afterhours',
    },
  },
  {
    id: 'end-1',
    type: 'end',
    position: { x: 180, y: 800 },
    data: defaultNodeData('end'),
  },
  {
    id: 'end-2',
    type: 'end',
    position: { x: 560, y: 760 },
    data: defaultNodeData('end'),
  },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'start-1', sourceHandle: 'output-0', target: 'biz-1', type: 'smoothstep', style: { stroke: '#94A3B8', strokeWidth: 2 } },
  { id: 'e2', source: 'biz-1', sourceHandle: 'output-0', target: 'menu-1', label: 'Open', type: 'smoothstep', style: { stroke: '#16A34A', strokeWidth: 2 } },
  { id: 'e3', source: 'biz-1', sourceHandle: 'output-1', target: 'msg-closed', label: 'Closed', type: 'smoothstep', style: { stroke: '#DC2626', strokeWidth: 2 } },
  { id: 'e4', source: 'biz-1', sourceHandle: 'output-2', target: 'vm-after-hours', label: 'Holiday', type: 'smoothstep', style: { stroke: '#F59E0B', strokeWidth: 2 } },
  { id: 'e5', source: 'menu-1', sourceHandle: 'output-0', target: 'queue-sales', label: '1: Sales', type: 'smoothstep', style: { stroke: '#0284C7', strokeWidth: 2 } },
  { id: 'e6', source: 'menu-1', sourceHandle: 'output-1', target: 'queue-support', label: '2: Support', type: 'smoothstep', style: { stroke: '#0284C7', strokeWidth: 2 } },
  { id: 'e7', source: 'msg-closed', sourceHandle: 'output-0', target: 'end-2', type: 'smoothstep', style: { stroke: '#94A3B8', strokeWidth: 2 } },
  { id: 'e8', source: 'vm-after-hours', sourceHandle: 'output-0', target: 'end-2', type: 'smoothstep', style: { stroke: '#94A3B8', strokeWidth: 2 } },
  { id: 'e9', source: 'queue-sales', sourceHandle: 'output-0', target: 'end-1', type: 'smoothstep', style: { stroke: '#94A3B8', strokeWidth: 2 } },
  { id: 'e10', source: 'queue-support', sourceHandle: 'output-0', target: 'end-1', type: 'smoothstep', style: { stroke: '#94A3B8', strokeWidth: 2 } },
];

export const useFlowStore = create<FlowStore>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  flowName: 'My Call Flow',
  isDirty: false,
  fitViewTrigger: 0,
  flowMeta: { ...defaultFlowMeta },
  publishState: { ...defaultPublishState },
  draftSavedAt: null,

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) => {
    set((state) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodes: applyNodeChanges(changes, state.nodes as any) as Node<NodeData>[],
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#64748B', strokeWidth: 2 },
        },
        state.edges
      ),
      isDirty: true,
    }));
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodeData: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
      isDirty: true,
    }));
  },

  addNode: (kind, position) => {
    const id = `${kind}-${++nodeIdCounter}`;
    const newNode: Node<NodeData> = {
      id,
      type: kind,
      position,
      data: defaultNodeData(kind),
    };
    set((state) => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: id,
      isDirty: true,
    }));
  },

  deleteNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      isDirty: true,
    }));
  },

  setFlowName: (name) => set({ flowName: name, isDirty: true }),

  setFlowMeta: (meta) => set((s) => ({ flowMeta: { ...s.flowMeta, ...meta } })),

  resetPublish: () => set({ publishState: { ...defaultPublishState } }),

  appendPublishProgress: (msg) =>
    set((s) => ({
      publishState: { ...s.publishState, progress: [...s.publishState.progress, msg] },
    })),

  setPublishStatus: (status, errors = []) =>
    set((s) => ({
      publishState: {
        ...s.publishState,
        status,
        ...(errors.length ? { errors } : {}),
      },
    })),

  requestFitView: () => set((s) => ({ fitViewTrigger: s.fitViewTrigger + 1 })),

  autoLayout: () => {
    const { nodes, edges, fitViewTrigger } = get();
    const laid = autoLayout(nodes, edges);
    set({ nodes: laid, isDirty: true, fitViewTrigger: fitViewTrigger + 1 });
  },

  saveDraft: (canvasMode) => {
    const { nodes, edges, flowName, flowMeta } = get();
    const draft: FlowDraft = {
      flowName,
      nodes,
      edges,
      flowMeta,
      canvasMode,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    set({ isDirty: false, draftSavedAt: draft.savedAt });
  },

  discardDraft: () => {
    localStorage.removeItem(DRAFT_KEY);
    set({ draftSavedAt: null });
  },

  restoreDraft: (draft) => {
    set({
      nodes: draft.nodes,
      edges: draft.edges,
      flowName: draft.flowName,
      flowMeta: draft.flowMeta,
      isDirty: false,
      draftSavedAt: draft.savedAt,
      publishState: { ...defaultPublishState },
      selectedNodeId: null,
    });
  },

  exportFlow: () => {
    const { nodes, edges, flowName } = get();
    return JSON.stringify({ flowName, nodes, edges, exportedAt: new Date().toISOString() }, null, 2);
  },

  importFlow: (json) => {
    try {
      const parsed = JSON.parse(json);
      set({
        nodes: (parsed.nodes || []) as Node<NodeData>[],
        edges: parsed.edges || [],
        flowName: parsed.flowName || 'Imported Flow',
        selectedNodeId: null,
        isDirty: false,
        // flowMeta is set by App.tsx after a Webex org import; reset publish state only
        publishState: { ...defaultPublishState },
      });
    } catch {
      alert('Invalid flow JSON file.');
    }
  },

  clearFlow: () => {
    set({
      nodes: initialNodes,
      edges: initialEdges,
      selectedNodeId: null,
      isDirty: false,
      flowMeta: { ...defaultFlowMeta, isNew: true },
      publishState: { ...defaultPublishState },
    });
  },

  newBlankFlow: () => {
    set((s) => ({
      nodes: [{
        id: 'start-1',
        type: 'start',
        position: { x: 300, y: 150 },
        data: defaultNodeData('start'),
      }],
      edges: [],
      selectedNodeId: null,
      isDirty: false,
      publishState: { ...defaultPublishState },
      fitViewTrigger: s.fitViewTrigger + 1,
    }));
  },

  validateFlow: () => {
    const { nodes, edges } = get();
    const errors: string[] = [];
    const startNodes = nodes.filter((n) => n.type === 'start');
    if (startNodes.length === 0) errors.push('Flow must have at least one Entry Point node.');
    if (startNodes.length > 1) errors.push('Flow should have only one Entry Point.');

    const endNodes = nodes.filter((n) => n.type === 'end');
    if (endNodes.length === 0) errors.push('Flow must have at least one Disconnect node.');

    const connectedIds = new Set(edges.flatMap((e) => [e.source, e.target]));
    const isolated = nodes.filter((n) => n.type !== 'start' && !connectedIds.has(n.id));
    if (isolated.length > 0) {
      errors.push(`${isolated.length} node(s) are not connected to the flow.`);
    }

    nodes.forEach((n) => {
      if (n.type === 'queue' && !n.data.queueName) {
        errors.push(`Node "${n.data.label}" (Queue) has no queue name configured.`);
      }
      if (n.type === 'httpRequest' && !n.data.url) {
        errors.push(`Node "${n.data.label}" (HTTP Request) has no URL configured.`);
      }
    });

    return { valid: errors.length === 0, errors };
  },
}));
