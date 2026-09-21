import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { X, Plus, Trash2, Settings, ChevronDown, Search, Plug, Eye } from 'lucide-react';
import { useFlowStore } from '../store/flowStore';
import { NODE_DEFINITIONS, type NodeData, type MenuOption, type BusinessHoursSchedule } from '../types';
import { useOrgData } from '../hooks/useOrgData';
import { useOrgStore } from '../store/orgStore';
import { createWebexApi } from '../api/webexApi';
import type { WebexScheduleEvent } from '../types/webex';

// Set once by PropertiesPanel from the global readOnly switch (flowStore) and read
// by every shared field primitive below (TextInput, Checkbox, OrgSelect, etc). This
// lets every existing Fields function (QueueFields, BusinessHoursFields, ...) get
// the read-only treatment for free, without threading a readOnly prop through ~20
// call sites — only the shared primitives need to know about it.
const ReadOnlyContext = createContext(false);

// Plain-text substitute for an input/select when the canvas is read-only — matches
// the visual language QueueStartFields already used for its "existing queue" summary
// view (plain value, muted when empty), not a greyed-out disabled control.
function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full px-2.5 py-1.5 text-xs text-slate-700 rounded-lg bg-slate-50 border border-slate-100 min-h-[30px] flex items-center">
      {children}
    </div>
  );
}

// ── Shared option lists ───────────────────────────────────────────────────────

const LANGUAGE_CODE_OPTIONS = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'en_GB', label: 'English (UK)' },
  { value: 'de_DE', label: 'German' },
  { value: 'fr_FR', label: 'French' },
  { value: 'es_ES', label: 'Spanish' },
  { value: 'it_IT', label: 'Italian' },
  { value: 'nl_NL', label: 'Dutch' },
  { value: 'pt_BR', label: 'Portuguese (BR)' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
];

// Confirmed via the OpenAPI spec: routing MODE and routing PATTERN are two
// independent settings (Control Hub screenshots confirm this split). Skill Based
// mode only offers Circular/Top Down/Longest Idle — no Weighted/Simultaneous cards
// shown under it.
const CQ_ROUTING_TYPE_OPTIONS = [
  { value: 'PRIORITY_BASED', label: 'Priority Based' },
  { value: 'SKILL_BASED', label: 'Skill Based' },
];

const CQ_ROUTING_POLICY_OPTIONS_ALL = [
  { value: 'CIRCULAR', label: 'Circular' },
  { value: 'REGULAR', label: 'Top Down' },
  { value: 'UNIFORM', label: 'Longest Idle' },
  { value: 'WEIGHTED', label: 'Weighted' },
  { value: 'SIMULTANEOUS', label: 'Simultaneous' },
];
const CQ_SKILL_BASED_POLICY_VALUES = new Set(['CIRCULAR', 'REGULAR', 'UNIFORM']);

export function PropertiesPanel() {
  const { nodes, selectedNodeId, selectNode, updateNodeData, readOnly } = useFlowStore();
  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return (
      <div className="w-72 h-full bg-white border-l border-slate-200 flex flex-col items-center justify-center p-8 text-center">
        <Settings size={32} className="text-slate-200 mb-3" />
        <div className="text-sm font-medium text-slate-400">No node selected</div>
        <div className="text-xs text-slate-300 mt-1">Click a node on the canvas to configure it</div>
      </div>
    );
  }

  const def = NODE_DEFINITIONS.find((d) => d.kind === node.data.kind);
  const update = (patch: Partial<NodeData>) => updateNodeData(node.id, patch);

  return (
    <ReadOnlyContext.Provider value={readOnly}>
    <div className="w-72 h-full bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {readOnly && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 font-medium">
          <Eye size={12} className="flex-shrink-0" />
          Viewing — switch to Editing in the toolbar to change values
        </div>
      )}
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200"
        style={{ background: def?.bgColor || '#F8FAFC' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: def?.borderColor || '#64748B' }}
        >
          <span style={{ color: 'white', fontSize: 12 }}>⚙</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800 truncate">
            {def?.label || node.data.kind}
          </div>
          <div className="text-xs text-slate-500 truncate" title={node.id}>
            ID: {node.id}
          </div>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Common: Label */}
        <Field label="Node Label">
          <TextInput
            value={node.data.label || ''}
            onChange={(v) => update({ label: v })}
            placeholder="Node display name"
          />
        </Field>

        {/* Node-specific fields */}
        <NodeFields data={node.data} update={update} nodeId={node.id} />
      </div>
    </div>
    </ReadOnlyContext.Provider>
  );
}

function NodeFields({ data, update, nodeId }: { data: NodeData; update: (p: Partial<NodeData>) => void; nodeId: string }) {
  switch (data.kind) {
    case 'start': return <StartFields data={data} update={update} />;
    case 'menu': return <MenuFields data={data} update={update} />;
    case 'playMessage': return <PlayMessageFields data={data} update={update} />;
    case 'collectDigits': return <CollectDigitsFields data={data} update={update} />;
    case 'queue': return <QueueFields data={data} update={update} />;
    case 'agentDirect': return <AgentDirectFields data={data} update={update} />;
    case 'businessHours': return <BusinessHoursFields data={data} update={update} />;
    case 'transfer': return <TransferFields data={data} update={update} />;
    case 'voicemail': return <VoicemailFields data={data} update={update} />;
    case 'huntGroup': return <HuntGroupFields data={data} update={update} />;
    case 'subAutoAttendant': return <SubAutoAttendantFields data={data} update={update} />;
    case 'repeatMenu': return <RepeatMenuFields />;
    case 'branch': return <BranchFields data={data} update={update} />;
    case 'httpRequest': return <HttpRequestFields data={data} update={update} />;
    case 'callback': return <CallbackFields data={data} update={update} />;
    case 'setVariable': return <SetVariableFields data={data} update={update} />;
    default: return null;
  }
}

// Map raw Webex enum values to Control Hub display labels
// 'ENTERPRISE' = org-wide scope; Webex Control Hub calls this "Organization"
function dialingScopeLabel(v: string | undefined): string | null {
  if (!v) return null;
  switch (v.toUpperCase()) {
    case 'ENTERPRISE': return 'Organization';
    case 'GROUP':      return 'Group';
    case 'NONE':       return 'None';
    default:           return v;
  }
}

// ── Call Queue / CX Essentials Start node ────────────────────────────────────

const CQ_ROUTING_TYPE_LABELS: Record<string, string> = {
  PRIORITY_BASED: 'Priority Based',
  SKILL_BASED:    'Skill Based',
};

// UNIFORM and REGULAR intentionally don't match their API enum name — confirmed via
// the OpenAPI spec's own description text (UNIFORM = "Longest Idle", REGULAR = "Top
// Down" in Control Hub's UI).
const CQ_ROUTING_POLICY_LABELS: Record<string, string> = {
  CIRCULAR:     'Circular',
  REGULAR:      'Top Down',
  SIMULTANEOUS: 'Simultaneous',
  UNIFORM:      'Longest Idle',
  WEIGHTED:     'Weighted',
};

function QueueStartFields({ data, update, isNew, isCxe }: {
  data: NodeData;
  update: (p: Partial<NodeData>) => void;
  isNew: boolean;
  isCxe: boolean;
}) {
  // Webex splits caller ID into two distinct settings — don't conflate them.
  const externalCallerIdLabel =
    data.cqCallingLineIdPolicy === 'LOCATION_NUMBER' ? 'Location number'
    : data.cqCallingLineIdPolicy || null;
  const directLineCallerIdLabel =
    data.cqDirectLineCallerIdSelection === 'DISPLAY_NAME' ? 'Display name'
    : data.cqDirectLineCallerIdSelection || null;

  return (
    <>
      {isNew ? (
        <>
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
            Configure your {isCxe ? 'CX Essentials' : 'Call Queue'} below, add agents, then build your routing flow before publishing.
          </div>
          <Field label="Queue Name">
            <TextInput value={data.label || ''} onChange={(v) => update({ label: v })} placeholder="Sales Queue" />
          </Field>
          <Field label="Phone Number" hint="E.164 format (optional)">
            <TextInput value={data.phoneNumber || ''} onChange={(v) => update({ phoneNumber: v })} placeholder="+49891234567" />
          </Field>
          <Field label="Extension" hint="Internal extension (optional)">
            <TextInput value={data.extensionNumber || ''} onChange={(v) => update({ extensionNumber: v })} placeholder="2000" />
          </Field>
          <Field label="Routing Type">
            <SelectInput
              value={data.cqRoutingType || 'PRIORITY_BASED'}
              onChange={(v) => {
                // Skill Based restricts the pattern to Circular/Top Down/Longest Idle —
                // clear an incompatible pattern selection rather than leaving a stale
                // Weighted/Simultaneous value that Skill Based mode doesn't support.
                const patch: Partial<NodeData> = { cqRoutingType: v };
                if (v === 'SKILL_BASED' && data.cqRoutingPolicy && !CQ_SKILL_BASED_POLICY_VALUES.has(data.cqRoutingPolicy)) {
                  patch.cqRoutingPolicy = 'CIRCULAR';
                }
                update(patch);
              }}
              options={CQ_ROUTING_TYPE_OPTIONS}
            />
          </Field>
          <Field label="Routing Pattern">
            <SelectInput
              value={data.cqRoutingPolicy || 'CIRCULAR'}
              onChange={(v) => update({ cqRoutingPolicy: v })}
              options={
                data.cqRoutingType === 'SKILL_BASED'
                  ? CQ_ROUTING_POLICY_OPTIONS_ALL.filter(o => CQ_SKILL_BASED_POLICY_VALUES.has(o.value))
                  : CQ_ROUTING_POLICY_OPTIONS_ALL
              }
            />
          </Field>
          <Field label="Max Queue Size">
            <NumberInput value={data.cqMaxSize ?? 50} onChange={(v) => update({ cqMaxSize: v })} min={1} max={250} />
          </Field>
          <Field label="Language Code">
            <SelectInput
              value={data.cqLanguageCode || 'en_US'}
              onChange={(v) => update({ cqLanguageCode: v })}
              options={LANGUAGE_CODE_OPTIONS}
            />
          </Field>
          <Field label="Timezone">
            <SelectInput
              value={data.cqTimezone || 'Europe/Berlin'}
              onChange={(v) => update({ cqTimezone: v })}
              options={TIMEZONE_OPTIONS}
            />
          </Field>
        </>
      ) : (
        <>
          {/* Overview */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Overview</span>
            </div>
            <div className="divide-y divide-slate-100">

              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-slate-500">Enable Queue</span>
                <StatusDot enabled={!!data.cqEnabled} onLabel="Enabled" warnWhenOff />
              </div>

              {(data.phoneNumber || data.extensionNumber) && (
                <div className="px-3 py-2">
                  <div className="text-xs text-slate-500 mb-1">Phone Numbers</div>
                  {data.phoneNumber    && <div className="text-xs font-mono text-slate-700">{data.phoneNumber}</div>}
                  {data.extensionNumber && <div className="text-xs font-mono text-slate-700">{data.extensionNumber}</div>}
                </div>
              )}

              {data.cqRoutingType && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-slate-500">Routing Type</span>
                  <span className="text-xs font-medium text-slate-700">
                    {CQ_ROUTING_TYPE_LABELS[data.cqRoutingType] ?? data.cqRoutingType}
                  </span>
                </div>
              )}

              {data.cqRoutingPolicy && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-slate-500">Routing Pattern</span>
                  <span className="text-xs font-medium text-slate-700">
                    {CQ_ROUTING_POLICY_LABELS[data.cqRoutingPolicy] ?? data.cqRoutingPolicy}
                  </span>
                </div>
              )}

              {data.cqCallbackEnabled !== undefined && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-slate-500">Callback</span>
                  <StatusDot enabled={!!data.cqCallbackEnabled} onLabel="Enabled" />
                </div>
              )}

              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-slate-500">Call forwarding</span>
                <StatusDot
                  enabled={!!data.cqCallForwardingEnabled}
                  onLabel={data.cqCallForwardingDestination || 'Enabled'}
                />
              </div>
              {data.cqCallForwardingEnabled && data.cqCallForwardingToVoicemail && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-slate-500">Forward to Voicemail</span>
                  <StatusDot enabled onLabel="Enabled" />
                </div>
              )}

            </div>
          </div>

          {/* Selective Call Forwarding + Business Continuity */}
          {(data.cqSelectiveForwardingEnabled || (data.cqSelectiveForwardingRules?.length ?? 0) > 0 || data.cqOperatingModesEnabled) && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Call Forwarding — Advanced</span>
              </div>
              <div className="divide-y divide-slate-100">
                {data.cqSelectiveForwardingEnabled && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Selective Forwarding</span>
                    <StatusDot enabled onLabel={data.cqSelectiveForwardingDestination || 'Enabled'} />
                  </div>
                )}
                {(data.cqSelectiveForwardingRules?.length ?? 0) > 0 && (
                  <div className="px-3 py-2">
                    <div className="text-xs text-slate-500 mb-1.5">Selective Rules ({data.cqSelectiveForwardingRules!.length})</div>
                    <div className="space-y-1">
                      {data.cqSelectiveForwardingRules!.map((r, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs text-slate-700 truncate">{r.name}</span>
                          <span className="text-xs text-slate-400 font-mono flex-shrink-0 ml-2">
                            {r.enabled ? (r.forwardTo || 'Enabled') : 'Disabled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.cqOperatingModesEnabled && (
                  <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50">
                    <span className="font-medium text-slate-600">Business Continuity operating modes enabled</span>
                    {' '}({data.cqOperatingModesCount ?? 0} mode{data.cqOperatingModesCount === 1 ? '' : 's'} configured) — manage in Control Hub.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DNIS Numbers & Custom Announcements */}
          {data.cqDnisNumbers && data.cqDnisNumbers.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span
                  className="text-xs font-semibold text-slate-600 uppercase tracking-wide"
                  title="DNIS = Dialed Number Identification Service — which of this queue's phone numbers the caller actually dialed. Lets each number ring or announce differently even though they all reach the same queue."
                >
                  DNIS Numbers
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {(data.cqDnisDistinctiveRingingEnabled !== undefined || data.cqDnisDisplayNameAndNumberEnabled !== undefined) && (
                  <>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-slate-500">Distinctive Ringing</span>
                      <StatusDot enabled={!!data.cqDnisDistinctiveRingingEnabled} onLabel="Enabled" />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-slate-500">Display Name &amp; Number to Agent</span>
                      <StatusDot enabled={!!data.cqDnisDisplayNameAndNumberEnabled} onLabel="Enabled" />
                    </div>
                  </>
                )}
                {data.cqDnisNumbers.map((d, i) => <DnisEntryRow key={i} entry={d} />)}
              </div>
            </div>
          )}

          {/* General Settings */}
          {(data.cqLocationName || externalCallerIdLabel || directLineCallerIdLabel || data.cqDialByName
            || data.cqLanguage || data.cqLanguageCode || data.cqTimezone
            || data.cqNotificationTonesUseOrgDefault !== undefined || data.cqDistinctiveRingEnabled !== undefined
            || data.cqBusinessTextingEnabled !== undefined || data.cqPhoneNumberForOutgoingCallsEnabled !== undefined
            || data.cqAllowCallWaitingForAgentsEnabled !== undefined || data.cqDigitalInboxEnabled !== undefined) && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">General Settings</span>
              </div>
              <div className="divide-y divide-slate-100">

                {data.cqLocationName && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Location</span>
                    <span className="text-xs font-medium text-slate-700">{data.cqLocationName}</span>
                  </div>
                )}

                {externalCallerIdLabel && (
                  <div className="px-3 py-2">
                    <div className="text-xs text-slate-500 mb-1">External caller ID phone number</div>
                    <div className="text-xs font-medium text-slate-700">
                      {externalCallerIdLabel}
                      {data.cqCallingLineIdPhoneNumber && `: ${data.cqCallingLineIdPhoneNumber}`}
                    </div>
                  </div>
                )}

                {directLineCallerIdLabel && (
                  <div className="px-3 py-2">
                    <div className="text-xs text-slate-500 mb-1.5">Direct line caller ID name</div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 w-3 h-3 rounded-full border-2 border-blue-500 flex-shrink-0 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      </span>
                      <div>
                        <div className="text-xs font-medium text-slate-700">{directLineCallerIdLabel}</div>
                        {data.cqCallerIdDisplayName && <div className="text-xs text-slate-500 mt-0.5">{data.cqCallerIdDisplayName}</div>}
                      </div>
                    </div>
                  </div>
                )}

                {data.cqDialByName && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Dial by Name</span>
                    <span className="text-xs font-medium text-slate-700">{data.cqDialByName}</span>
                  </div>
                )}

                {(data.cqLanguage || data.cqLanguageCode) && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Language</span>
                    <span className="text-xs font-medium text-slate-700">{data.cqLanguage || data.cqLanguageCode}</span>
                  </div>
                )}

                {data.cqTimezone && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Time zone</span>
                    <span className="text-xs font-medium text-slate-700">{data.cqTimezone}</span>
                  </div>
                )}

                {data.cqNotificationTonesUseOrgDefault !== undefined && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Notification Tones</span>
                    <span className="text-xs font-medium text-slate-700">
                      {data.cqNotificationTonesUseOrgDefault ? "Organization's default" : 'Custom'}
                    </span>
                  </div>
                )}

                {data.cqDistinctiveRingEnabled !== undefined && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Distinctive Ringing</span>
                    <StatusDot enabled={!!data.cqDistinctiveRingEnabled} onLabel={data.cqDistinctiveRingPattern || 'Enabled'} />
                  </div>
                )}

                {data.cqBusinessTextingEnabled !== undefined && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Business Texting</span>
                    <StatusDot enabled={!!data.cqBusinessTextingEnabled} onLabel="Enabled" />
                  </div>
                )}

                {data.cqPhoneNumberForOutgoingCallsEnabled !== undefined && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Use Queue Number for Outgoing Calls</span>
                    <StatusDot enabled={!!data.cqPhoneNumberForOutgoingCallsEnabled} onLabel="Enabled" />
                  </div>
                )}

                {data.cqAllowCallWaitingForAgentsEnabled !== undefined && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Call Waiting for Agents</span>
                    <StatusDot enabled={!!data.cqAllowCallWaitingForAgentsEnabled} onLabel="Enabled" />
                  </div>
                )}

                {data.cqDigitalInboxEnabled !== undefined && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Digital Inbox</span>
                    <StatusDot enabled={!!data.cqDigitalInboxEnabled} onLabel="Enabled" />
                  </div>
                )}

              </div>
            </div>
          )}
        </>
      )}

      {/* Agents — shown for both new and existing queues */}
      <AgentEditor data={data} update={update} isCxe={isCxe} />
    </>
  );
}

function AgentEditor({ data, update, isCxe }: { data: NodeData; update: (p: Partial<NodeData>) => void; isCxe: boolean }) {
  const readOnly = useContext(ReadOnlyContext);
  const { connected, userOptions } = useOrgData();
  const [adding, setAdding] = useState(false);
  const agents = (data.cqAgents ?? []) as Array<{ name: string; extension?: string; phoneNumber?: string; agentType?: string; skillLevel?: number; joinEnabled?: boolean; weight?: number }>;
  const showWeight = data.cqRoutingPolicy === 'WEIGHTED';

  const handleAddAgent = (userId: string, label: string, opt?: { value: string; label: string; meta?: string; extension?: string }) => {
    if (!userId) return;
    const ext = opt?.extension || opt?.meta;
    if (ext && agents.some(a => a.extension === ext)) return;
    update({
      cqAgents: [...agents, {
        name: label,
        extension: ext,
        joinEnabled: true,
        ...(isCxe ? { skillLevel: 5 } : {}),
      }],
    });
    setAdding(false);
  };

  const removeAgent = (i: number) => {
    update({ cqAgents: agents.filter((_, idx) => idx !== i) });
  };

  const updateSkill = (i: number, v: number) => {
    update({ cqAgents: agents.map((a, idx) => idx === i ? { ...a, skillLevel: Math.min(20, Math.max(1, v)) } : a) });
  };

  const updateWeight = (i: number, v: number) => {
    update({ cqAgents: agents.map((a, idx) => idx === i ? { ...a, weight: Math.max(1, v) } : a) });
  };

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Agents</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded-full">{agents.length}</span>
          {connected && !readOnly && (
            <button
              onClick={() => setAdding(v => !v)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Plus size={12} /> {adding ? 'Cancel' : 'Add'}
            </button>
          )}
        </div>
      </div>

      {adding && connected && !readOnly && (
        <div className="px-3 py-2 border-b border-slate-100">
          <OrgSelect
            value=""
            displayValue=""
            options={userOptions}
            onSelect={handleAddAgent}
            placeholder="Search for an agent…"
            offlinePlaceholder="Agent name"
            connected={connected}
          />
        </div>
      )}

      <div>
        {agents.length === 0 ? (
          <div className="px-3 py-4 text-xs text-slate-400 text-center">
            {data.cqAgentsUnavailable
              ? 'Agent data unavailable for this import — reconnect and re-import to view.'
              : <>No agents assigned.{connected ? ' Click Add to assign agents.' : ' Connect your org to add agents.'}</>}
          </div>
        ) : (
          <div className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
            {agents.map((agent, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${agent.joinEnabled ? 'bg-green-500' : 'bg-slate-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 truncate">{agent.name}</div>
                  {(agent.extension || agent.phoneNumber) && (
                    <div className="text-xs text-slate-400 font-mono">
                      {agent.extension && `Ext: ${agent.extension}`}
                      {agent.extension && agent.phoneNumber && ' · '}
                      {agent.phoneNumber}
                    </div>
                  )}
                </div>
                {isCxe && (
                  <div className="flex items-center gap-1 flex-shrink-0" title="Skill level (1–20)">
                    <span className="text-xs text-slate-400">L</span>
                    {readOnly ? (
                      <span className="w-9 text-xs text-center text-slate-600 font-medium">{agent.skillLevel ?? 5}</span>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={agent.skillLevel ?? 5}
                        onChange={(e) => updateSkill(i, Number(e.target.value))}
                        className="w-9 text-xs text-center border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    )}
                  </div>
                )}
                {showWeight && (
                  <div className="flex items-center gap-1 flex-shrink-0" title="Weight (used for Weighted routing)">
                    <span className="text-xs text-slate-400">W</span>
                    {readOnly ? (
                      <span className="w-9 text-xs text-center text-slate-600 font-medium">{agent.weight ?? 1}</span>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        value={agent.weight ?? 1}
                        onChange={(e) => updateWeight(i, Number(e.target.value))}
                        className="w-9 text-xs text-center border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    )}
                  </div>
                )}
                {!readOnly && (
                  <button
                    onClick={() => removeAgent(i)}
                    className="text-slate-300 hover:text-red-500 flex-shrink-0 transition-colors"
                    title="Remove agent"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewAAFields({ data, update }: FieldProps) {
  return (
    <>
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
        Configure your Auto Attendant below, then add a business hours node and menu nodes before publishing.
      </div>
      <Field label="Display Name">
        <TextInput value={data.label || ''} onChange={(v) => update({ label: v })} placeholder="Main Auto Attendant" />
      </Field>
      <Field label="Phone Number" hint="E.164 format (optional)">
        <TextInput value={data.phoneNumber || ''} onChange={(v) => update({ phoneNumber: v })} placeholder="+49891234567" />
      </Field>
      <Field label="Extension" hint="Internal extension (optional)">
        <TextInput value={data.extensionNumber || ''} onChange={(v) => update({ extensionNumber: v })} placeholder="1000" />
      </Field>
      <Field label="Language Code">
        <SelectInput
          value={data.aaLanguageCode || 'en_US'}
          onChange={(v) => update({ aaLanguageCode: v })}
          options={LANGUAGE_CODE_OPTIONS}
        />
      </Field>
      <Field label="Timezone">
        <SelectInput
          value={data.timezone || 'Europe/Berlin'}
          onChange={(v) => update({ timezone: v })}
          options={TIMEZONE_OPTIONS}
        />
      </Field>
    </>
  );
}

function StartFields({ data, update }: FieldProps) {
  const { flowMeta } = useFlowStore();
  const isNew = flowMeta.isNew;
  const resourceType = flowMeta.resourceType;

  // Determine canvas mode: prefer explicit flowMeta, fall back to node data signals from import
  const isCq = resourceType === 'cq' || resourceType === 'cxe' || data.cqEnabled !== undefined;
  const isCxe = resourceType === 'cxe';

  if (isCq) {
    return <QueueStartFields data={data} update={update} isNew={isNew} isCxe={isCxe} />;
  }

  // ── Auto Attendant (new or existing) ─────────────────────────────────────
  if (isNew) {
    return <NewAAFields data={data} update={update} />;
  }

  // Existing AA — read-only summary
  const effectivePolicy =
    data.aaCallerIdPolicy ||
    (data.aaCallerIdDisplayName ? 'DIRECT_LINE' : '');

  const callerIdLabel =
    effectivePolicy === 'DIRECT_LINE'             ? 'Display name'
    : effectivePolicy === 'OTHER_EXTERNAL_NUMBER' ? 'Other direct line caller ID name'
    : effectivePolicy === 'LOCATION_NUMBER'       ? 'Location number'
    : null;

  const callerIdName =
    effectivePolicy === 'DIRECT_LINE'             ? data.aaCallerIdDisplayName
    : effectivePolicy === 'OTHER_EXTERNAL_NUMBER' ? data.aaCustomCallerIdName
    : null;

  const hasAaConfig = !!(
    data.aaLocationName || callerIdLabel ||
    data.aaDialByNameEnabled !== undefined ||
    data.aaLanguage || data.aaLanguageCode || data.timezone ||
    data.aaExtensionDialing || data.aaNameDialing
  );

  return (
    <>
      {/* ── AA Overview ─────────────────────────────────────────── */}
      {data.aaEnabled !== undefined && (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Overview</span>
          </div>
          <div className="divide-y divide-slate-100">

            {/* Enable Auto Attendant */}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-slate-500">Enable Auto Attendant</span>
              <span className={`flex items-center gap-1 text-xs font-medium ${data.aaEnabled ? 'text-green-700' : 'text-amber-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${data.aaEnabled ? 'bg-green-500' : 'bg-amber-400'}`} />
                {data.aaEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* Phone Numbers */}
            {(data.phoneNumber || data.extensionNumber) && (
              <div className="px-3 py-2">
                <div className="text-xs text-slate-500 mb-1">Phone Numbers</div>
                {data.phoneNumber && (
                  <div className="text-xs font-mono text-slate-700">{data.phoneNumber}</div>
                )}
                {data.extensionNumber && (
                  <div className="text-xs font-mono text-slate-700">{data.extensionNumber}</div>
                )}
              </div>
            )}

            {/* Call Forwarding */}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-slate-500">Call forwarding</span>
              <span className={`text-xs font-medium ${data.aaCallForwardingEnabled ? 'text-blue-700' : 'text-slate-500'}`}>
                {data.aaCallForwardingEnabled
                  ? (data.aaCallForwardingDestination || 'Enabled')
                  : 'Disabled'}
              </span>
            </div>
            {data.aaCallForwardingEnabled && data.aaCallForwardingToVoicemail && (
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-slate-500">Forward to Voicemail</span>
                <span className="text-xs font-medium text-blue-700">Enabled</span>
              </div>
            )}

            {/* Dialing Options */}
            {data.aaDialingOptions && dialingScopeLabel(data.aaDialingOptions) && (
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-slate-500">Dialing Options</span>
                <span className="text-xs font-medium text-slate-700">{dialingScopeLabel(data.aaDialingOptions)}</span>
              </div>
            )}

          </div>
        </div>
      )}

      {hasAaConfig && (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AA General Settings</span>
          </div>
          <div className="divide-y divide-slate-100">

            {/* Location */}
            {data.aaLocationName && (
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-slate-500">Location</span>
                <span className="text-xs font-medium text-slate-700">{data.aaLocationName}</span>
              </div>
            )}

            {/* Direct line caller ID name */}
            {callerIdLabel && (
              <div className="px-3 py-2">
                <div className="text-xs text-slate-500 mb-1.5">Direct line caller ID name</div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 w-3 h-3 rounded-full border-2 border-blue-500 flex-shrink-0 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </span>
                  <div>
                    <div className="text-xs font-medium text-slate-700">{callerIdLabel}</div>
                    {callerIdName && (
                      <div className="text-xs text-slate-500 mt-0.5">{callerIdName}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Dial by name */}
            {data.aaDialByNameEnabled !== undefined && (
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-slate-700">Dial by name</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${data.aaDialByNameEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {data.aaDialByNameEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="text-xs text-slate-400">Dial by name is used for auto attendant name dialing.</div>
              </div>
            )}

            {/* Language / Timezone */}
            {(data.aaLanguage || data.aaLanguageCode || data.timezone) && (
              <div className="px-3 py-2 space-y-1">
                {data.aaLanguage && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Language</span>
                    <span className="text-xs font-medium text-slate-700">{data.aaLanguage}</span>
                  </div>
                )}
                {data.aaLanguageCode && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Language code</span>
                    <span className="text-xs font-mono text-slate-700">{data.aaLanguageCode}</span>
                  </div>
                )}
                {data.timezone && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Time zone</span>
                    <span className="text-xs font-medium text-slate-700">{data.timezone}</span>
                  </div>
                )}
              </div>
            )}

            {/* Name dialing scope */}
            {dialingScopeLabel(data.aaNameDialing) && (
              <div className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Name dialing scope</span>
                  <span className="text-xs font-medium text-slate-700">{dialingScopeLabel(data.aaNameDialing)}</span>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}

function MenuFields({ data, update }: FieldProps) {
  const readOnly = useContext(ReadOnlyContext);
  const options = data.menuOptions || [];
  // Derive prompt type: explicit field wins, fall back to 'audio' if a file is already set
  const promptType = data.menuPromptType || (data.menuGreetingFile ? 'audio' : 'tts');

  const addOption = () => {
    const next = String(options.length + 1);
    update({ menuOptions: [...options, { digit: next, label: `Option ${next}`, description: '' }] });
  };
  const removeOption = (i: number) => update({ menuOptions: options.filter((_, idx) => idx !== i) });
  const updateOption = (i: number, patch: Partial<MenuOption>) => {
    const updated = options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    update({ menuOptions: updated });
  };

  return (
    <>
      <Field label="Prompt Type">
        <ToggleGroup
          value={promptType}
          onChange={(v) => update({ menuPromptType: v as 'tts' | 'audio' })}
          options={[{ value: 'tts', label: 'Text-to-Speech' }, { value: 'audio', label: 'Audio File' }]}
        />
      </Field>
      {promptType === 'audio' ? (
        <Field label="Greeting Audio File" hint="Select from your org's uploaded announcements">
          <AnnouncementPicker
            value={data.menuGreetingFile || ''}
            onChange={(v) => update({ menuGreetingFile: v })}
          />
        </Field>
      ) : (
        <Field label="Menu Prompt">
          <TextArea value={data.menuPrompt || ''} onChange={(v) => update({ menuPrompt: v })} placeholder="Press 1 for Sales..." />
        </Field>
      )}
      <Field label="No-Input Timer (seconds)" hint="Webex: No Input Timer">
        <NumberInput value={data.timeoutSeconds ?? 5} onChange={(v) => update({ timeoutSeconds: v })} min={1} max={20} />
      </Field>
      <Field label="Max Retries" hint="Webex: Maximum Retries">
        <NumberInput value={data.maxRetries ?? 3} onChange={(v) => update({ maxRetries: v })} min={1} max={10} />
      </Field>
      <Field label="Invalid Input Action">
        <SelectInput
          value={data.invalidInputAction || 'repeat'}
          onChange={(v) => update({ invalidInputAction: v as 'repeat' | 'disconnect' | 'transfer' })}
          options={[
            { value: 'repeat', label: 'Repeat menu' },
            { value: 'disconnect', label: 'Disconnect call' },
            { value: 'transfer', label: 'Transfer to operator' },
          ]}
        />
      </Field>
      <Checkbox
        label="Allow Extension Dialing"
        checked={data.menuExtensionEnabled ?? false}
        onChange={(v) => update({ menuExtensionEnabled: v })}
      />
      <Checkbox
        label="Allow Name Dialing"
        checked={data.menuNameDialingEnabled ?? false}
        onChange={(v) => update({ menuNameDialingEnabled: v })}
      />
      <Checkbox
        label="Allow Transfer to Operator"
        checked={data.menuTransferToOperatorEnabled ?? false}
        onChange={(v) => update({ menuTransferToOperatorEnabled: v })}
      />

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Menu Options</label>
          {!readOnly && (
            <button
              onClick={addOption}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={12} /> Add
            </button>
          )}
        </div>
        <div className="space-y-2">
          {options.map((opt, i) => {
            const actionLabel = opt.actionKind
              ? NODE_DEFINITIONS.find((d) => d.kind === opt.actionKind)?.label ?? opt.actionKind
              : undefined;
            return (
              <div key={i} className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {opt.digit}
                  </div>
                  {readOnly ? (
                    <span className="flex-1 text-xs text-slate-700 font-medium">{opt.label}</span>
                  ) : (
                    <>
                      <input
                        value={opt.digit}
                        onChange={(e) => updateOption(i, { digit: e.target.value })}
                        className="w-10 text-xs font-mono text-center border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        maxLength={1}
                        placeholder="0-9"
                      />
                      <input
                        value={opt.label}
                        onChange={(e) => updateOption(i, { label: e.target.value })}
                        className="flex-1 text-xs border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="Option label"
                      />
                      <button onClick={() => removeOption(i)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 pl-9">
                  {readOnly ? (
                    opt.description && <span className="flex-1 text-xs text-slate-500">{opt.description}</span>
                  ) : (
                    <input
                      value={opt.description || ''}
                      onChange={(e) => updateOption(i, { description: e.target.value })}
                      className="flex-1 text-xs border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-600"
                      placeholder="Description (optional)"
                    />
                  )}
                  {actionLabel && (
                    <span
                      className="flex-shrink-0 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5"
                      title="Routes to this node type on the canvas"
                    >
                      → {actionLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {options.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">
              No options yet. Add one above.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── AnnouncementPicker ────────────────────────────────────────────────────────
// Shared by Menu (greeting) and PlayMessage (audio file).
// When connected: fetches org announcements for the flow's locationId and shows
// an OrgSelect picker + a free-text fallback input below.
// When not connected: just the free-text input.

function AnnouncementPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Announcements are org-wide and already loaded once at connect time (orgStore) —
  // no per-node fetch needed. Previously fetched per-location here, which 404'd
  // (announcements aren't location-scoped in the path) and always showed empty.
  const { connected, announcementOptions } = useOrgData();

  if (!connected) {
    return <TextInput value={value} onChange={onChange} placeholder="greeting.wav" />;
  }

  return (
    <div className="space-y-1.5">
      <OrgSelect
        value={value}
        displayValue={value}
        options={announcementOptions}
        onSelect={(val) => onChange(val)}
        placeholder="Select from org announcements…"
        offlinePlaceholder="greeting.wav"
        connected={connected}
      />
      <TextInput value={value} onChange={onChange} placeholder="or type filename, e.g. welcome.wav" />
    </div>
  );
}

function PlayMessageFields({ data, update }: FieldProps) {
  return (
    <>
      <Field label="Message Type">
        <ToggleGroup
          value={data.messageType || 'tts'}
          onChange={(v) => update({ messageType: v as 'tts' | 'audio' })}
          options={[{ value: 'tts', label: 'Text-to-Speech' }, { value: 'audio', label: 'Audio File' }]}
        />
      </Field>
      {data.messageType === 'audio' ? (
        <Field label="Audio File" hint="Select from your org's uploaded announcements">
          <AnnouncementPicker value={data.audioFile || ''} onChange={(v) => update({ audioFile: v })} />
        </Field>
      ) : (
        <>
          <Field label="Message Text">
            <TextArea value={data.messageText || ''} onChange={(v) => update({ messageText: v })} placeholder="Enter the spoken message..." rows={4} />
          </Field>
          <Field label="Language">
            <SelectInput
              value={data.language || 'en-US'}
              onChange={(v) => update({ language: v })}
              options={[
                { value: 'en-US', label: 'English (US)' },
                { value: 'en-GB', label: 'English (UK)' },
                { value: 'de-DE', label: 'German' },
                { value: 'fr-FR', label: 'French' },
                { value: 'es-ES', label: 'Spanish' },
                { value: 'it-IT', label: 'Italian' },
                { value: 'nl-NL', label: 'Dutch' },
                { value: 'pt-BR', label: 'Portuguese (BR)' },
                { value: 'ja-JP', label: 'Japanese' },
                { value: 'zh-CN', label: 'Chinese (Simplified)' },
              ]}
            />
          </Field>
          <Field label="Voice Gender">
            <ToggleGroup
              value={data.voice || 'female'}
              onChange={(v) => update({ voice: v })}
              options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]}
            />
          </Field>
        </>
      )}
    </>
  );
}

function CollectDigitsFields({ data, update }: FieldProps) {
  return (
    <>
      <Field label="Collection Prompt">
        <TextArea value={data.collectPrompt || ''} onChange={(v) => update({ collectPrompt: v })} placeholder="Please enter your account number..." />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min Digits">
          <NumberInput value={data.minDigits ?? 1} onChange={(v) => update({ minDigits: v })} min={1} max={20} />
        </Field>
        <Field label="Max Digits">
          <NumberInput value={data.maxDigits ?? 10} onChange={(v) => update({ maxDigits: v })} min={1} max={20} />
        </Field>
      </div>
      <Field label="Termination Digit">
        <TextInput value={data.terminationDigit || ''} onChange={(v) => update({ terminationDigit: v })} placeholder="# (blank = none)" maxLength={1} />
      </Field>
      <Field label="Inter-digit Timeout (s)">
        <NumberInput value={data.interDigitTimeout ?? 3} onChange={(v) => update({ interDigitTimeout: v })} min={1} max={15} />
      </Field>
    </>
  );
}

// Auto-generated plain-English read of the Bounced Calls settings — turns four
// independent toggles into the one sentence a Level 1 viewer actually needs
// ("what happens to a call that's stuck with an agent?"), shown in View mode.
function bouncedCallsNarration(data: NodeData): string {
  const sentences: string[] = [];
  if (data.callBounceEnabled) {
    let s = `An agent's phone rings ${data.callBounceMaxRings ?? 3} times — if unanswered, the call goes back to the queue.`;
    if (data.callBounceOnAgentUnavailableEnabled) {
      s += ' It also bounces back right away if the agent becomes unreachable.';
    }
    sentences.push(s);
  }
  if (data.callBounceOnHoldEnabled) {
    sentences.push(`If a call sits with an agent for over ${data.callBounceOnHoldMaxSeconds ?? 60} seconds, it bounces back to the queue.`);
  }
  if (data.callBounceAlertAgentEnabled) {
    sentences.push(`The agent gets an alert after ${data.callBounceAlertAgentMaxSeconds ?? 60} seconds if a call is on hold too long.`);
  }
  if (sentences.length === 0) {
    return 'Bounced-call handling is turned off — unanswered or held calls stay with the agent.';
  }
  return sentences.join(' ');
}

function QueueFields({ data, update }: FieldProps) {
  const readOnly = useContext(ReadOnlyContext);
  const [showBounceDetails, setShowBounceDetails] = useState(false);
  const { connected, queueOptions } = useOrgData();
  return (
    <FieldCard title="Queue Settings">
      <FieldGroup label="Queue Setup">
        <Field label="Call Queue" hint={connected ? 'From your Webex org' : 'Connect org to see live queues'}>
          <OrgSelect
            value={data.queueId || ''}
            displayValue={data.queueName || ''}
            options={queueOptions}
            onSelect={(id, label) => update({ queueId: id, queueName: label })}
            placeholder="Select a queue…"
            offlinePlaceholder="Sales Queue"
            connected={connected}
          />
        </Field>
        <Field label="Max Wait Time (s)">
          <NumberInput value={data.maxWaitTime ?? 300} onChange={(v) => update({ maxWaitTime: v })} min={30} max={3600} />
        </Field>
        {data.queueMaxSize !== undefined && (
          <Field label="Max Queue Size">
            <NumberInput value={data.queueMaxSize} onChange={(v) => update({ queueMaxSize: v })} min={1} max={250} />
          </Field>
        )}
        <Field label="Hold Music">
          <SelectInput
            value={data.holdMusicType || 'default'}
            onChange={(v) => update({ holdMusicType: v as 'default' | 'custom' })}
            options={[{ value: 'default', label: 'Default Music' }, { value: 'custom', label: 'Custom Audio' }]}
          />
        </Field>
      </FieldGroup>

      <FieldGroup label="Behavior">
        <Checkbox label="Music on Hold" checked={data.mohEnabled ?? true} onChange={(v) => update({ mohEnabled: v })} />
        <Checkbox label="Show Estimated Wait Time" checked={data.estimatedWaitEnabled ?? true} onChange={(v) => update({ estimatedWaitEnabled: v })} />
        <Checkbox label="Offer Callback" checked={data.callbackEnabled ?? false} onChange={(v) => update({ callbackEnabled: v })} />
        <Checkbox label="Allow Agents to Join/Unjoin" checked={data.agentJoinEnabled ?? true} onChange={(v) => update({ agentJoinEnabled: v })} />
        <Checkbox label="Enable Call Timeout Handling" checked={data.callTimeoutHandlingEnabled ?? false} onChange={(v) => update({ callTimeoutHandlingEnabled: v })} />
        {data.callTimeoutHandlingSourceUnknown && (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            Webex doesn't expose whether this is actually on or off — the checkbox above is a default,
            not a confirmed value. Check Control Hub directly to see the real setting, or toggle it here if you know it should be enabled.
          </div>
        )}
        <Checkbox label="Comfort Message" checked={data.comfortMessageEnabled ?? false} onChange={(v) => update({ comfortMessageEnabled: v })} />
        {data.comfortMessageEnabled && (
          <Field label="Time Between Messages (s)">
            <NumberInput value={data.comfortMessageTimeBetween ?? 30} onChange={(v) => update({ comfortMessageTimeBetween: v })} min={5} max={600} />
          </Field>
        )}
        <Checkbox
          label="Skip Comfort Message if Wait Time Is Short"
          checked={data.comfortMessageBypassEnabled ?? false}
          onChange={(v) => update({ comfortMessageBypassEnabled: v })}
        />
        {data.comfortMessageBypassEnabled && (
          <Field label="Bypass Threshold (s)">
            <NumberInput value={data.comfortMessageBypassThreshold ?? 30} onChange={(v) => update({ comfortMessageBypassThreshold: v })} min={5} max={600} />
          </Field>
        )}
        <Checkbox label="Whisper Message to Agent" checked={data.whisperMessageEnabled ?? false} onChange={(v) => update({ whisperMessageEnabled: v })} />
      </FieldGroup>

      <FieldGroup label="Bounced Calls">
        {readOnly && (
          <>
            <div className="rounded-lg bg-gradient-to-br from-sky-50 to-cyan-50 border border-sky-200 px-3 py-2.5 text-xs text-sky-800 leading-relaxed">
              {bouncedCallsNarration(data)}
            </div>
            <button
              onClick={() => setShowBounceDetails((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium"
            >
              <ChevronDown size={11} className={`transition-transform ${showBounceDetails ? 'rotate-180' : ''}`} />
              {showBounceDetails ? 'Hide individual settings' : 'Show individual settings'}
            </button>
          </>
        )}
        {(!readOnly || showBounceDetails) && (
          <>
            <Checkbox label="Bounce Unanswered Calls" checked={data.callBounceEnabled ?? false} onChange={(v) => update({ callBounceEnabled: v })} />
            {data.callBounceEnabled && (
              <>
                <Field label="Rings Before Bounce">
                  <NumberInput value={data.callBounceMaxRings ?? 3} onChange={(v) => update({ callBounceMaxRings: v })} min={1} max={20} />
                </Field>
                <Checkbox
                  label="Also Bounce if Agent Becomes Unavailable"
                  checked={data.callBounceOnAgentUnavailableEnabled ?? false}
                  onChange={(v) => update({ callBounceOnAgentUnavailableEnabled: v })}
                />
              </>
            )}
            <Checkbox
              label="Alert Agent on Long Call"
              checked={data.callBounceAlertAgentEnabled ?? false}
              onChange={(v) => update({ callBounceAlertAgentEnabled: v })}
            />
            {data.callBounceAlertAgentEnabled && (
              <Field label="Alert After (s)">
                <NumberInput value={data.callBounceAlertAgentMaxSeconds ?? 60} onChange={(v) => update({ callBounceAlertAgentMaxSeconds: v })} min={10} max={600} />
              </Field>
            )}
            <Checkbox
              label="Bounce Calls Left on Hold Too Long"
              checked={data.callBounceOnHoldEnabled ?? false}
              onChange={(v) => update({ callBounceOnHoldEnabled: v })}
            />
            {data.callBounceOnHoldEnabled && (
              <Field label="Hold Timeout (s)">
                <NumberInput value={data.callBounceOnHoldMaxSeconds ?? 60} onChange={(v) => update({ callBounceOnHoldMaxSeconds: v })} min={10} max={600} />
              </Field>
            )}
          </>
        )}
      </FieldGroup>

      {(data.priorityEscalationEnabled || data.digitalHandoffEnabled || data.priorityEscalationSourceUnknown) && (
        <FieldGroup label="Escalation & Handoff">
          {data.priorityEscalationEnabled ? (
            <>
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <span className="font-medium text-slate-600">Priority Escalation enabled</span> — configured via the
                separate "Priority Escalation" node on the canvas.
              </div>
              <Field label="Escalation Threshold" hint="Webex: escalate after this many calls waiting">
                <NumberInput
                  value={data.priorityEscalationThreshold ?? 1}
                  onChange={(v) => update({ priorityEscalationThreshold: v })}
                  min={1}
                  max={50}
                />
              </Field>
            </>
          ) : data.priorityEscalationSourceUnknown ? (
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
              <span className="font-medium text-slate-600">Priority Escalation</span> — Webex doesn't expose whether
              this is on or off via the API, so it isn't shown here. Check Control Hub directly, or add a
              "Priority Escalation" transfer node to the canvas if you know it should be configured.
            </div>
          ) : null}
          {data.digitalHandoffEnabled && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
              <span className="font-medium">Digital Handoff enabled</span> — configured via the separate
              "Digital Handoff" node on the canvas; its destination may be unverified.
            </div>
          )}
        </FieldGroup>
      )}
    </FieldCard>
  );
}

// Collapsed by default — the full per-message-type breakdown is dense (up to 6 rows),
// so only a compact "N customized" indicator shows until expanded.
function DnisEntryRow({ entry }: { entry: NonNullable<NodeData['cqDnisNumbers']>[number] }) {
  const [expanded, setExpanded] = useState(false);
  const enabledMessages = entry.announcementSummary?.filter(s => s.enabled) ?? [];

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700 truncate">{entry.name}</span>
        <span className="text-xs text-slate-500 font-mono flex-shrink-0 ml-2">
          {entry.extension && `Ext: ${entry.extension}`}
          {entry.ringPattern && ` · ${entry.ringPattern}`}
        </span>
      </div>
      {entry.customAnnouncementEnabled && enabledMessages.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {enabledMessages.length} message type{enabledMessages.length === 1 ? '' : 's'} customized
        </button>
      )}
      {expanded && (
        <div className="mt-2 rounded-md bg-slate-50 border border-slate-100 divide-y divide-slate-100">
          {enabledMessages.map((s, j) => (
            <div key={j} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
              <span className="text-slate-500 flex-shrink-0">{s.label}</span>
              <span className="text-right truncate">
                {s.fileLabel && <div className="text-slate-700 font-medium truncate">{s.fileLabel}</div>}
                <div className={`font-mono truncate ${s.fileLabel ? 'text-slate-400' : 'text-slate-700'}`}>
                  {[s.fileName || s.greeting, s.extra].filter(Boolean).join(' · ')}
                </div>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentDirectFields({ data, update }: FieldProps) {
  const { connected, userOptions } = useOrgData();
  return (
    <>
      <Field label="Agent" hint={connected ? 'Calling-enabled users from your org' : 'Connect org to see live agents'}>
        <OrgSelect
          value={data.agentId || ''}
          displayValue={data.agentName || ''}
          options={userOptions}
          onSelect={(id, label, opt) => update({ agentId: id, agentName: label, agentExtension: opt?.extension || data.agentExtension })}
          placeholder="Select an agent…"
          offlinePlaceholder="John Smith"
          connected={connected}
        />
      </Field>
      {!connected && (
        <Field label="Agent Extension">
          <TextInput value={data.agentExtension || ''} onChange={(v) => update({ agentExtension: v })} placeholder="1234" />
        </Field>
      )}
      {connected && data.agentExtension && (
        <div className="text-xs text-slate-500 font-mono bg-slate-50 rounded px-2 py-1">
          Ext: {data.agentExtension}
        </div>
      )}
    </>
  );
}

function BusinessHoursFields({ data, update }: FieldProps) {
  const readOnly = useContext(ReadOnlyContext);
  const hours = data.businessHours || [];
  const { connected, businessHoursOptions, holidayOptions } = useOrgData();
  const schedules = useOrgStore((s) => s.schedules);

  const updateDay = (i: number, patch: Partial<BusinessHoursSchedule>) => {
    const updated = hours.map((h, idx) => (idx === i ? { ...h, ...patch } : h));
    update({ businessHours: updated });
  };

  const bhLocationId = schedules.find((s) => s.id === data.scheduleId)?.locationId;
  const holidayLocationId = schedules.find((s) => s.id === data.holidayScheduleId)?.locationId;

  return (
    <FieldCard title="Business Hours">
      <Field label="Business Hours Schedule" hint={connected ? 'From your Webex org' : 'Connect org to see schedules'}>
        <OrgSelect
          value={data.scheduleId || ''}
          displayValue={data.scheduleName || ''}
          options={businessHoursOptions}
          onSelect={(id, label) => update({ scheduleId: id, scheduleName: label })}
          placeholder="Select a schedule…"
          offlinePlaceholder="Main Office Hours"
          connected={connected}
        />
        {data.scheduleLevel && (
          <span className="inline-block mt-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
            {data.scheduleLevel === 'ORGANIZATION' ? 'Organization-level schedule' : 'Location-level schedule'}
          </span>
        )}
        <ScheduleDetailView
          scheduleId={data.scheduleId}
          locationId={bhLocationId}
          type="businessHours"
        />
      </Field>
      <Field label="Timezone">
        <SelectInput
          value={data.timezone || 'Europe/Berlin'}
          onChange={(v) => update({ timezone: v })}
          options={[
            { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
            { value: 'Europe/London', label: 'Europe/London (GMT)' },
            { value: 'America/New_York', label: 'America/New_York (EST)' },
            { value: 'America/Chicago', label: 'America/Chicago (CST)' },
            { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
            { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
            { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
            { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
          ]}
        />
      </Field>
      {!connected && (
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Weekly Schedule</label>
          <div className="space-y-1.5">
            {hours.map((h, i) => (
              <div key={h.day} className="flex items-center gap-2 text-xs">
                {readOnly ? (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${h.open ? 'bg-green-500' : 'bg-slate-300'}`} />
                ) : (
                  <input
                    type="checkbox"
                    checked={h.open}
                    onChange={(e) => updateDay(i, { open: e.target.checked })}
                    className="rounded accent-blue-500 w-3.5 h-3.5 flex-shrink-0"
                  />
                )}
                <span className="w-8 text-slate-600 font-medium flex-shrink-0">{h.day.slice(0, 3)}</span>
                {readOnly ? (
                  <span className="text-slate-600">{h.open ? `${h.start} – ${h.end}` : 'Closed'}</span>
                ) : (
                  <>
                    <input
                      type="time"
                      value={h.start}
                      disabled={!h.open}
                      onChange={(e) => updateDay(i, { start: e.target.value })}
                      className="border border-slate-200 rounded px-1 py-0.5 text-xs w-20 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="time"
                      value={h.end}
                      disabled={!h.open}
                      onChange={(e) => updateDay(i, { end: e.target.value })}
                      className="border border-slate-200 rounded px-1 py-0.5 text-xs w-20 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <Field label="Holiday Schedule" hint={connected ? 'From your Webex org' : undefined}>
        <OrgSelect
          value={data.holidayScheduleId || ''}
          displayValue={data.holidaySchedule || ''}
          options={holidayOptions}
          onSelect={(id, label) => update({ holidayScheduleId: id, holidaySchedule: label })}
          placeholder="Select holiday schedule…"
          offlinePlaceholder="German Public Holidays"
          connected={connected}
        />
        {data.holidayScheduleLevel && (
          <span className="inline-block mt-1.5 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
            {data.holidayScheduleLevel === 'ORGANIZATION' ? 'Organization-level schedule' : 'Location-level schedule'}
          </span>
        )}
        <ScheduleDetailView
          scheduleId={data.holidayScheduleId}
          locationId={holidayLocationId}
          type="holidays"
        />
      </Field>
    </FieldCard>
  );
}

function ScheduleDetailView({
  scheduleId,
  locationId,
  type,
}: {
  scheduleId: string | undefined;
  locationId: string | undefined;
  type: 'businessHours' | 'holidays';
}) {
  const token = useOrgStore((s) => s.token);
  const [events, setEvents] = useState<WebexScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const fetchedRef = useRef(false);

  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !fetchedRef.current && scheduleId && locationId && token) {
      fetchedRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const detail = await createWebexApi(token).getScheduleDetail(locationId, type, scheduleId);
        setEvents(detail.events ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schedule');
        fetchedRef.current = false;
      } finally {
        setLoading(false);
      }
    }
  };

  if (!scheduleId || !locationId || !token) return null;

  const capitalize = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleToggle}
        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
      >
        {expanded ? 'Hide Schedule ▴' : 'Show Schedule ▾'}
      </button>
      {expanded && (
        <div className="mt-2">
          {loading && <div className="text-xs text-slate-400">Loading…</div>}
          {error && <div className="text-xs text-red-500">{error}</div>}
          {!loading && !error && events.length === 0 && (
            <div className="text-xs text-slate-400">No events found.</div>
          )}
          {!loading && !error && events.length > 0 && (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-1 pr-2 font-medium">Day / Name</th>
                  <th className="pb-1 pr-2 font-medium">Hours</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => {
                  const isAlt = i % 2 === 1;
                  const week = ev.recurrence?.recurWeekly;
                  const flaggedDays = week
                    ? (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const)
                        .filter((d) => week[d])
                        .map((d) => capitalize(d))
                    : [];
                  const day = flaggedDays.length > 0
                    ? flaggedDays.join(', ')
                    : week?.scheduleDay
                    ? capitalize(week.scheduleDay)
                    : ev.name ?? '—';
                  const hours = ev.allDayEnabled
                    ? 'All day'
                    : ev.startTime && ev.endTime
                    ? `${ev.startTime}–${ev.endTime}`
                    : '—';
                  return (
                    <tr
                      key={i}
                      className={`border-b border-slate-100 ${isAlt ? 'bg-slate-50' : ''}`}
                    >
                      <td className="py-0.5 pr-2 text-slate-700">{day}</td>
                      <td className="py-0.5 text-slate-500">{hours}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function TransferFields({ data, update }: FieldProps) {
  const { connected, queueOptions, userOptions } = useOrgData();
  const isQueue = data.transferType === 'queue';

  return (
    <FieldCard title="Transfer Settings">
      <Field label="Transfer Type">
        <ToggleGroup
          value={data.transferType || 'blind'}
          onChange={(v) => update({ transferType: v as 'blind' | 'consultative' | 'queue' })}
          options={[
            { value: 'blind', label: 'Blind' },
            { value: 'consultative', label: 'Consult' },
            { value: 'queue', label: 'Queue' },
          ]}
        />
      </Field>
      {isQueue ? (
        <Field label="Target Queue" hint={connected ? 'From your Webex org' : undefined}>
          <OrgSelect
            value={data.queueId || ''}
            displayValue={data.queueName || ''}
            options={queueOptions}
            onSelect={(id, label) => update({ queueId: id, queueName: label, transferNumber: label })}
            placeholder="Select a queue…"
            offlinePlaceholder="Sales Queue"
            connected={connected}
          />
        </Field>
      ) : (
        <Field label="Transfer Number / Extension" hint="PSTN number or internal extension">
          {connected ? (
            <OrgSelect
              value={data.transferNumber || ''}
              displayValue={data.transferNumber || ''}
              options={userOptions.map((u) => ({ value: u.extension || '', label: u.label, meta: u.meta }))}
              onSelect={(val) => update({ transferNumber: val })}
              placeholder="Select user or type number…"
              offlinePlaceholder="+49891234567 or ext 2000"
              connected={connected}
            />
          ) : (
            <TextInput value={data.transferNumber || ''} onChange={(v) => update({ transferNumber: v })} placeholder="+49891234567 or ext 2000" />
          )}
        </Field>
      )}
    </FieldCard>
  );
}

function VoicemailFields({ data, update }: FieldProps) {
  const { connected, userOptions, huntGroupOptions } = useOrgData();
  const isGroup = (data.voicemailTarget || 'group') === 'group';
  const options = isGroup ? huntGroupOptions : userOptions;

  return (
    <>
      <Field label="Voicemail Target">
        <ToggleGroup
          value={data.voicemailTarget || 'group'}
          onChange={(v) => update({ voicemailTarget: v as 'user' | 'group', voicemailUserId: undefined, voicemailExtension: undefined })}
          options={[{ value: 'user', label: 'User' }, { value: 'group', label: 'Group' }]}
        />
      </Field>
      <Field label={isGroup ? 'Hunt Group' : 'User'} hint={connected ? 'From your Webex org' : undefined}>
        <OrgSelect
          value={data.voicemailUserId || ''}
          displayValue={data.voicemailExtension || ''}
          options={options}
          onSelect={(id, label, opt) => update({ voicemailUserId: id, voicemailExtension: opt?.extension || label })}
          placeholder={isGroup ? 'Select a hunt group…' : 'Select a user…'}
          offlinePlaceholder="1234 or user@domain"
          connected={connected}
        />
      </Field>
      <Field label="Greeting Type">
        <ToggleGroup
          value={data.greetingType || 'default'}
          onChange={(v) => update({ greetingType: v as 'default' | 'custom' })}
          options={[{ value: 'default', label: 'Default' }, { value: 'custom', label: 'Custom' }]}
        />
      </Field>
    </>
  );
}

function BranchFields({ data, update }: FieldProps) {
  return (
    <>
      <Field label="Variable" hint="Flow variable to evaluate">
        <TextInput value={data.variable || ''} onChange={(v) => update({ variable: v })} placeholder="e.g. callerInput" />
      </Field>
      <Field label="Operator">
        <SelectInput
          value={data.operator || 'equals'}
          onChange={(v) => update({ operator: v })}
          options={[
            { value: 'equals', label: 'Equals (==)' },
            { value: 'not_equals', label: 'Not Equals (!=)' },
            { value: 'contains', label: 'Contains' },
            { value: 'starts_with', label: 'Starts With' },
            { value: 'greater_than', label: 'Greater Than (>)' },
            { value: 'less_than', label: 'Less Than (<)' },
            { value: 'is_empty', label: 'Is Empty' },
            { value: 'is_not_empty', label: 'Is Not Empty' },
          ]}
        />
      </Field>
      {!['is_empty', 'is_not_empty'].includes(data.operator || '') && (
        <Field label="Compare Value">
          <TextInput value={data.compareValue || ''} onChange={(v) => update({ compareValue: v })} placeholder="Value to compare" />
        </Field>
      )}
    </>
  );
}

function HttpRequestFields({ data, update }: FieldProps) {
  return (
    <>
      <Field label="Method">
        <ToggleGroup
          value={data.method || 'POST'}
          onChange={(v) => update({ method: v as 'GET' | 'POST' | 'PUT' | 'DELETE' })}
          options={[
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST' },
            { value: 'PUT', label: 'PUT' },
            { value: 'DELETE', label: 'DEL' },
          ]}
        />
      </Field>
      <Field label="Endpoint URL">
        <TextInput value={data.url || ''} onChange={(v) => update({ url: v })} placeholder="https://api.example.com/lookup" />
      </Field>
      <Field label="Request Body (JSON)">
        <TextArea value={data.body || ''} onChange={(v) => update({ body: v })} placeholder='{"ani": "{{callerANI}}"}' rows={4} mono />
      </Field>
    </>
  );
}

function CallbackFields({ data, update }: FieldProps) {
  return (
    <FieldCard title="Callback Settings">
      <Field label="Callback Type">
        <ToggleGroup
          value={data.callbackType || 'immediate'}
          onChange={(v) => update({ callbackType: v as 'immediate' | 'scheduled' })}
          options={[{ value: 'immediate', label: 'Immediate' }, { value: 'scheduled', label: 'Scheduled' }]}
        />
      </Field>
      <Field label="Callback Number" hint="Use {{callerANI}} for auto-detect">
        <TextInput value={data.callbackNumber || ''} onChange={(v) => update({ callbackNumber: v })} placeholder="{{callerANI}}" />
      </Field>
      <Field label="Confirmation Message">
        <TextArea value={data.callbackMessage || ''} onChange={(v) => update({ callbackMessage: v })} placeholder="We will call you back shortly." />
      </Field>
      <Field label="Announcement" hint="Select from your org's uploaded announcements">
        <AnnouncementPicker
          value={data.callbackAnnouncement || ''}
          onChange={(v) => update({ callbackAnnouncement: v })}
        />
      </Field>
    </FieldCard>
  );
}

function SetVariableFields({ data, update }: FieldProps) {
  return (
    <>
      <Field label="Variable Name">
        <TextInput value={data.variableName || ''} onChange={(v) => update({ variableName: v })} placeholder="myVariable" />
      </Field>
      <Field label="Value" hint="Use {{expression}} for dynamic values">
        <TextInput value={data.variableValue || ''} onChange={(v) => update({ variableValue: v })} placeholder="static or {{dynamic}}" />
      </Field>
    </>
  );
}

function HuntGroupFields({ data, update }: FieldProps) {
  const { connected, huntGroupOptions, huntGroups } = useOrgData();
  const selected = huntGroups.find((h) => h.id === data.huntGroupId);

  return (
    <>
      <Field label="Hunt Group" hint={connected ? 'From your Webex org' : 'Connect org to see hunt groups'}>
        <OrgSelect
          value={data.huntGroupId || ''}
          displayValue={data.huntGroupName || ''}
          options={huntGroupOptions}
          onSelect={(id, label, opt) => update({ huntGroupId: id, huntGroupName: label, huntGroupExtension: opt?.extension })}
          placeholder="Select a hunt group…"
          offlinePlaceholder="Support Hunt Group"
          connected={connected}
        />
      </Field>
      {connected && selected && (
        <div className="grid grid-cols-2 gap-2">
          {selected.extension && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
              <div className="text-xs text-slate-400 mb-0.5">Extension</div>
              <div className="text-xs font-semibold text-slate-700">{selected.extension}</div>
            </div>
          )}
          {selected.phoneNumber && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
              <div className="text-xs text-slate-400 mb-0.5">Phone</div>
              <div className="text-xs font-semibold text-slate-700">{selected.phoneNumber}</div>
            </div>
          )}
          <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
            <div className="text-xs text-slate-400 mb-0.5">Location</div>
            <div className="text-xs font-semibold text-slate-700">{selected.locationName}</div>
          </div>
        </div>
      )}
      {!connected && data.huntGroupName && (
        <div className="text-xs text-slate-500 italic">Connect org to see hunt group details</div>
      )}
    </>
  );
}

function SubAutoAttendantFields({ data, update }: FieldProps) {
  const { connected, autoAttendantOptions } = useOrgData();
  const isUnresolved = connected
    && !!data.targetAutoAttendantId
    && !autoAttendantOptions.some((o) => o.value === data.targetAutoAttendantId);
  return (
    <>
      <Field label="Target Auto-Attendant" hint={connected ? 'From your Webex org' : 'Connect org to see AAs'}>
        <OrgSelect
          value={data.targetAutoAttendantId || ''}
          displayValue={data.targetAutoAttendantName || ''}
          options={autoAttendantOptions}
          onSelect={(id, label) => update({ targetAutoAttendantId: id, targetAutoAttendantName: label })}
          placeholder="Select an Auto-Attendant…"
          offlinePlaceholder="Main Menu AA"
          connected={connected}
        />
      </Field>
      {isUnresolved && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
          This id doesn't match any Auto-Attendant in your org — Webex only exposes a raw
          destination id for digital handoffs, so it may point to a different resource type.
          Verify and re-select the correct target manually.
        </div>
      )}
    </>
  );
}

function RepeatMenuFields() {
  return (
    <div className="rounded-lg bg-fuchsia-50 border border-fuchsia-100 px-3 py-2.5 text-xs text-fuchsia-700 leading-relaxed">
      This node replays the current IVR menu prompt for the caller. Connect its output handle back
      to the IVR Menu node to complete the loop on the canvas.
    </div>
  );
}

// ─── Reusable field components ───────────────────────────────────────────────

type FieldProps = { data: NodeData; update: (p: Partial<NodeData>) => void };

// Shared card shell — same header-bar pattern used by the Start node's Overview/DNIS
// Numbers/General Settings sections, so editable field groups (Queue, Business Hours,
// Callback, Transfer) match the read-only summary sections visually.
function FieldCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{title}</span>
      </div>
      <div className="p-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

// Visually separates unrelated settings within a FieldCard (e.g. queue setup vs.
// behavior toggles vs. escalation notes) instead of one undifferentiated flat list.
function FieldGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pt-3 border-t border-slate-100 first:pt-0 first:border-t-0">
      {label && <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>}
      {children}
    </div>
  );
}

// Single consistent "is this feature on?" visual language, used wherever a boolean
// Webex setting is shown read-only (Enable Queue, Callback, Call Forwarding, etc.).
// warnWhenOff switches the off-state to amber for settings where "off" is worth
// flagging (e.g. a disabled queue won't take calls) rather than just neutral.
function StatusDot({ enabled, onLabel, offLabel = 'Disabled', warnWhenOff = false }: {
  enabled: boolean; onLabel: React.ReactNode; offLabel?: string; warnWhenOff?: boolean;
}) {
  const offTextClass = warnWhenOff ? 'text-amber-600' : 'text-slate-400';
  const offDotClass = warnWhenOff ? 'bg-amber-400' : 'bg-slate-300';
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${enabled ? 'text-green-700' : offTextClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-green-500' : offDotClass}`} />
      {enabled ? onLabel : offLabel}
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
        {hint && <span className="text-xs text-slate-400 normal-case tracking-normal font-normal">— {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, maxLength,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  if (useContext(ReadOnlyContext)) {
    return <ReadOnlyValue>{value || <span className="text-slate-300 italic">{placeholder || '—'}</span>}</ReadOnlyValue>;
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-slate-700 placeholder:text-slate-300"
    />
  );
}

function TextArea({
  value, onChange, placeholder, rows = 3, mono,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; mono?: boolean;
}) {
  if (useContext(ReadOnlyContext)) {
    return (
      <div className={`w-full px-2.5 py-1.5 text-xs text-slate-700 rounded-lg bg-slate-50 border border-slate-100 whitespace-pre-wrap ${mono ? 'font-mono' : ''}`}>
        {value || <span className="text-slate-300 italic">{placeholder || '—'}</span>}
      </div>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-slate-700 placeholder:text-slate-300 resize-y ${mono ? 'font-mono' : ''}`}
    />
  );
}

function NumberInput({
  value, onChange, min = 0, max = 9999,
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  if (useContext(ReadOnlyContext)) {
    return <ReadOnlyValue>{value}</ReadOnlyValue>;
  }
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-slate-700"
    />
  );
}

function SelectInput({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  if (useContext(ReadOnlyContext)) {
    return <ReadOnlyValue>{options.find((o) => o.value === value)?.label ?? value}</ReadOnlyValue>;
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-slate-700"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function ToggleGroup({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  if (useContext(ReadOnlyContext)) {
    return <ReadOnlyValue>{options.find((o) => o.value === value)?.label ?? value}</ReadOnlyValue>;
  }
  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 px-2 py-1.5 text-xs font-medium transition-all ${
            value === o.value
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  if (useContext(ReadOnlyContext)) {
    return <StatusDot enabled={checked} onLabel={label} offLabel={label} />;
  }
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <div
        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors border ${
          checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-400'
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-xs text-slate-700 select-none">{label}</span>
    </label>
  );
}

// ─── OrgSelect ────────────────────────────────────────────────────────────────
// Searchable dropdown populated from live Webex org data.
// Falls back to a plain TextInput when org is not connected.

interface OrgSelectOption {
  value: string;
  label: string;
  meta?: string;
  extension?: string;
}

interface OrgSelectProps {
  value: string;
  displayValue: string;
  options: OrgSelectOption[];
  onSelect: (value: string, label: string, option?: OrgSelectOption) => void;
  placeholder: string;
  offlinePlaceholder: string;
  connected: boolean;
}

function OrgSelect({
  value, displayValue, options, onSelect, placeholder, offlinePlaceholder, connected,
}: OrgSelectProps) {
  const readOnly = useContext(ReadOnlyContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          (o.meta ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const selectedLabel = options.find((o) => o.value === value)?.label || displayValue;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (readOnly) {
    return <ReadOnlyValue>{selectedLabel || <span className="text-slate-300 italic">{placeholder}</span>}</ReadOnlyValue>;
  }

  // Offline fallback
  if (!connected) {
    return (
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onSelect('', e.target.value)}
          placeholder={offlinePlaceholder}
          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 placeholder:text-slate-300"
        />
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-300 cursor-pointer hover:text-slate-400"
          title="Connect org to see live options"
        >
          <Plug size={11} />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 transition-colors"
      >
        {selectedLabel ? (
          <span className="flex-1 text-left truncate font-medium">{selectedLabel}</span>
        ) : (
          <span className="flex-1 text-left truncate text-slate-300">{placeholder}</span>
        )}
        <ChevronDown size={13} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <Search size={12} className="text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 text-xs bg-transparent focus:outline-none text-slate-700 placeholder:text-slate-300"
            />
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">
                {query.trim()
                  ? 'No results match your search'
                  : options.length === 0
                  ? 'No items loaded from org — try refreshing'
                  : 'No results found'}
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onSelect(opt.value, opt.label, opt); setOpen(false); setQuery(''); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 transition-colors ${
                    opt.value === value ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700 truncate">{opt.label}</div>
                    {opt.meta && <div className="text-xs text-slate-400 truncate">{opt.meta}</div>}
                  </div>
                  {opt.value === value && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer: count */}
          <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
            {options.length === 0 ? 'No items loaded' : `${filtered.length} of ${options.length} items`}
          </div>
        </div>
      )}
    </div>
  );
}
