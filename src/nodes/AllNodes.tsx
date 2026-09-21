import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import {
  PhoneOff, PhoneForwarded, Users, PhoneCall, GitBranch,
  RotateCcw, Volume2, Voicemail, Hash,
} from 'lucide-react';
import { NODE_DEFINITIONS } from '../types';
import type { NodeData, NodeKind } from '../types';
import { BaseNode } from './BaseNode';
import { summarizeBusinessHours } from '../utils/businessHoursSummary';
import { useFlowStore } from '../store/flowStore';

// Icon + accent color per node kind — used in both MenuNode rows and MenuKeyBanner
const KIND_META: Partial<Record<NodeKind, { Icon: React.ComponentType<{ size?: number; className?: string; color?: string }>; color: string }>> = {
  end:              { Icon: PhoneOff,       color: '#dc2626' },
  transfer:         { Icon: PhoneForwarded, color: '#0d9488' },
  huntGroup:        { Icon: Users,          color: '#4F46E5' },
  queue:            { Icon: PhoneCall,      color: '#d97706' },
  subAutoAttendant: { Icon: GitBranch,      color: '#EA580C' },
  repeatMenu:       { Icon: RotateCcw,      color: '#A21CAF' },
  playMessage:      { Icon: Volume2,        color: '#7c3aed' },
  voicemail:        { Icon: Voicemail,      color: '#78716c' },
  collectDigits:    { Icon: Hash,           color: '#0369a1' },
};


// Banner shown inside action nodes that are direct branches from a menu key
function MenuKeyBanner({ digit, kind, label }: { digit: string; kind: NodeKind; label: string }) {
  const meta = KIND_META[kind];
  const Icon = meta?.Icon;
  const isTimeout = digit === '∅';
  return (
    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-slate-100 min-w-0">
      <span
        className="flex-shrink-0 h-5 min-w-[20px] px-1.5 rounded text-xs font-bold flex items-center justify-center"
        style={isTimeout
          ? { background: '#f1f5f9', color: '#64748b' }
          : { background: '#dbeafe', color: '#1d4ed8' }}
      >
        {digit}
      </span>
      {Icon && <Icon size={12} color={meta!.color} className="flex-shrink-0" />}
      <span className="text-xs font-semibold text-slate-700 truncate">{label}</span>
    </div>
  );
}

const getDef = (kind: string) => NODE_DEFINITIONS.find((d) => d.kind === kind)!;

export const StartNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('start');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def} showInput={false} outputCount={1}>
      {nd.phoneNumber && (
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="text-slate-400 text-xs">DID:</span>
          <span className="font-mono text-xs font-medium text-slate-700">{nd.phoneNumber}</span>
        </div>
      )}
      {nd.extensionNumber && (
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="text-slate-400 text-xs">Ext:</span>
          <span className="font-mono text-xs font-medium text-slate-700">{nd.extensionNumber}</span>
        </div>
      )}
      {!nd.phoneNumber && !nd.extensionNumber && (
        <div className="text-xs text-slate-400 italic">Configure phone number...</div>
      )}
      {nd.aaEnabled === false && (
        <div className="flex items-center gap-1 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-600 font-medium">Disabled</span>
        </div>
      )}
      {nd.aaLocationName && (
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="text-slate-400 text-xs">Location:</span>
          <span className="text-xs text-slate-600 truncate">{nd.aaLocationName}</span>
        </div>
      )}
      {(nd.aaLanguage || nd.timezone) && (
        <div className="flex items-center gap-2 py-0.5 text-xs text-slate-400">
          {nd.aaLanguage && <span>{nd.aaLanguage}</span>}
          {nd.timezone && <span>· {nd.timezone}</span>}
        </div>
      )}
    </BaseNode>
  );
});

export const EndNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('end');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def} outputCount={0} showInput={true}>
      {nd.menuKey && <MenuKeyBanner digit={nd.menuKey} kind="end" label={nd.label} />}
      <div className="text-xs text-slate-500">Call ends here</div>
    </BaseNode>
  );
});

export const MenuNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('menu');
  const options = nd.menuOptions || [];
  const visible = options.slice(0, 5);
  const overflow = options.length - visible.length;
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={options.length || 1}
      outputLabels={options.map((o) => `${o.digit}: ${o.label}`)}
    >
      {nd.menuPrompt && (
        <div className="text-xs text-slate-500 line-clamp-1 mb-1.5 italic">"{nd.menuGreetingFile || nd.menuPrompt}"</div>
      )}
      <div className="space-y-0.5 mb-1.5">
        {visible.map((opt) => (
          <div key={opt.digit} className="flex items-center gap-1.5 min-w-0 py-0.5">
            <span className="flex-shrink-0 font-mono text-xs text-slate-400 w-4 text-right">{opt.digit}</span>
            <span className="text-xs text-slate-700 truncate">{opt.label}</span>
          </div>
        ))}
        {overflow > 0 && (
          <div className="text-xs text-slate-400 pl-5">+{overflow} more</div>
        )}
      </div>
      <div className="flex gap-3 text-xs text-slate-400 border-t border-slate-100 pt-1.5">
        <span>No-input: {nd.timeoutSeconds ?? 5}s</span>
        <span>Retries: {nd.maxRetries ?? 3}</span>
        {nd.invalidInputAction && nd.invalidInputAction !== 'repeat' && (
          <span className="text-xs text-slate-400">Invalid: {nd.invalidInputAction}</span>
        )}
      </div>
      {(nd.menuExtensionEnabled || nd.menuNameDialingEnabled) && (
        <div className="flex gap-1.5 pt-1 mt-0.5 border-t border-slate-100 flex-wrap">
          {nd.menuExtensionEnabled && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-sky-50 text-sky-600 border border-sky-100">Ext Dial</span>
          )}
          {nd.menuNameDialingEnabled && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-sky-50 text-sky-600 border border-sky-100">Name Dial</span>
          )}
        </div>
      )}
    </BaseNode>
  );
});

export const PlayMessageNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('playMessage');
  // Webex Calling Call Queue announcements only offer "Default" or "Custom" audio —
  // there's no live Text-to-Speech option, so nodes generated from real Call Queue
  // import data (cqAnnouncementSource) say "Webex Default" here instead of "TTS".
  // Hand-built/generic playMessage nodes (e.g. Post-Call Survey, palette-dragged
  // prompts) keep "Text-to-Speech" since that hasn't been verified as inaccurate
  // for those cases.
  const nonAudioLabel = nd.cqAnnouncementSource ? 'Webex Default' : 'TTS';
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def} outputCount={1} subtitle={nd.nodeSubtitle}>
      {nd.menuKey && <MenuKeyBanner digit={nd.menuKey} kind="playMessage" label={nd.label} />}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
          {nd.messageType === 'audio' ? 'Audio File' : nonAudioLabel}
        </span>
        {nd.language && <span className="text-xs text-slate-400">{nd.language}</span>}
      </div>
      {nd.messageText && (
        <div className="text-xs text-slate-600 line-clamp-2 italic">"{nd.messageText}"</div>
      )}
      {nd.audioFile && (
        <>
          {/* The resolved friendly label (when available) leads, matching this
              app's plain-language-first convention; the raw system filename is
              always shown too, never replaced — label is an addition, not a
              substitute, since it's not guaranteed to be available. */}
          {nd.audioFileLabel && (
            <div className="text-xs font-medium text-slate-700 truncate">{nd.audioFileLabel}</div>
          )}
          <div className={`text-xs font-mono truncate ${nd.audioFileLabel ? 'text-slate-400' : 'text-slate-600'}`}>
            {nd.audioFile}
          </div>
        </>
      )}
    </BaseNode>
  );
});

export const CollectDigitsNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('collectDigits');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={2}
      outputLabels={['Success', 'Timeout/Error']}
    >
      {nd.collectPrompt && (
        <div className="text-xs text-slate-600 line-clamp-2 mb-1 italic">"{nd.collectPrompt}"</div>
      )}
      <div className="flex gap-2 text-xs text-slate-500">
        <span>Min: {nd.minDigits || 1}</span>
        <span>Max: {nd.maxDigits || 10}</span>
        {nd.terminationDigit && <span>Term: {nd.terminationDigit}</span>}
      </div>
    </BaseNode>
  );
});

export const QueueNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('queue');
  const hasCallback = !!nd.callbackEnabled;
  const hasPriorityEsc = !!nd.priorityEscalationEnabled;
  const hasDigital = !!nd.digitalHandoffEnabled;
  const extraLabels = [
    ...(hasCallback ? ['Callback'] : []),
    ...(hasPriorityEsc ? ['Escalate'] : []),
    ...(hasDigital ? ['Digital'] : []),
  ];
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={3 + extraLabels.length}
      outputLabels={['Answered', 'Overflow', 'No Agents', ...extraLabels]}
    >
      {nd.menuKey && <MenuKeyBanner digit={nd.menuKey} kind="queue" label={nd.label} />}
      {nd.queueName ? (
        <div className="font-medium text-xs text-slate-700 mb-1">{nd.queueName}</div>
      ) : (
        <div className="text-xs text-slate-400 italic mb-1">Select a queue...</div>
      )}
      <div className="flex gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${nd.mohEnabled ? 'bg-green-400' : 'bg-slate-300'}`} />
          <span>Music on Hold</span>
        </div>
        {nd.maxWaitTime && (
          <span>Max wait: {nd.maxWaitTime}s</span>
        )}
      </div>
    </BaseNode>
  );
});

export const AgentDirectNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('agentDirect');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={2}
      outputLabels={['Connected', 'No Answer']}
    >
      {nd.agentName ? (
        <div className="font-medium text-xs text-slate-700">{nd.agentName}</div>
      ) : (
        <div className="text-xs text-slate-400 italic">Select agent...</div>
      )}
      {nd.agentExtension && (
        <div className="text-xs text-slate-500 font-mono">Ext: {nd.agentExtension}</div>
      )}
    </BaseNode>
  );
});

export const BusinessHoursNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const readOnly = useFlowStore((s) => s.readOnly);
  const def = getDef('businessHours');
  // A Call Queue's standalone Holiday Service (no Night Service) is a 2-way
  // Not-a-Holiday/Holiday check, not the usual Open/Closed(/Holiday) gate — it needs
  // its own output count and labels rather than the hasHolidayBranch inference below.
  const isHolidayOnly = nd.gateMode === 'holidayOnly';
  // hasHolidayBranch is the authoritative flag when an importer sets it (it knows
  // whether a separate Holiday action is actually wired to this gate). Manually-built
  // gates don't set it, so they fall back to the original behavior: a holiday branch
  // exists exactly when this gate has its own holiday schedule selected.
  const hasHoliday = nd.hasHolidayBranch ?? !!nd.holidaySchedule;
  const hoursSummary = summarizeBusinessHours(nd.businessHours);
  const outputCount = isHolidayOnly ? 2 : hasHoliday ? 3 : 2;
  const outputLabels = isHolidayOnly
    ? ['Not a Holiday', 'Holiday']
    : hasHoliday ? ['Open', 'Closed', 'Holiday'] : ['Open', 'Closed'];
  // Precedence badge (Holiday=1, Night=2) — reinforces the rail shown above the
  // canvas in View mode. Not shown in Edit mode or for manually-built gates.
  const precedenceBadge = !readOnly ? undefined
    : isHolidayOnly ? { text: '1', color: '#8b5cf6', title: 'Holiday Service — highest precedence' }
    : hasHoliday ? { text: '1·2', color: '#8b5cf6', title: 'This gate checks Holiday (1) then Night Service (2)' }
    : { text: '2', color: '#F59E0B', title: 'Night Service — 2nd in precedence, after Holiday Service' };
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={outputCount}
      outputLabels={outputLabels}
      badge={precedenceBadge}
    >
      <div className="font-medium text-xs text-slate-700 mb-1">
        {nd.scheduleName || 'Business Hours Schedule'}
      </div>
      {hoursSummary ? (
        <div className="text-xs text-slate-600">{hoursSummary}</div>
      ) : nd.scheduleName ? (
        <div className="text-xs text-slate-400 italic">Connect org to view hours</div>
      ) : null}
      {nd.timezone && (
        <div className="text-xs text-slate-500">TZ: {nd.timezone}</div>
      )}
    </BaseNode>
  );
});

export const TransferNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('transfer');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={2}
      outputLabels={['Success', 'Failed']}
    >
      {nd.menuKey && <MenuKeyBanner digit={nd.menuKey} kind="transfer" label={nd.label} />}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700 capitalize">
          {nd.transferType || 'blind'}
        </span>
      </div>
      {nd.transferNumber ? (
        <div className="font-mono text-xs text-slate-700">{nd.transferNumber}</div>
      ) : (
        <div className="text-xs text-slate-400 italic">Set transfer target...</div>
      )}
    </BaseNode>
  );
});

export const VoicemailNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('voicemail');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def} outputCount={1}>
      {nd.menuKey && <MenuKeyBanner digit={nd.menuKey} kind="voicemail" label={nd.label} />}
      <div className="flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded text-xs bg-stone-100 text-stone-600 capitalize">
          {nd.voicemailTarget || 'group'}
        </span>
        {nd.voicemailExtension && (
          <span className="font-mono text-xs text-slate-600">{nd.voicemailExtension}</span>
        )}
      </div>
    </BaseNode>
  );
});

export const BranchNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('branch');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={3}
      outputLabels={['Match', 'No Match', 'Error']}
    >
      {/* Call Router (and any other informational use) shows its plain-English
          nodeSubtitle in the body instead of a raw variable/operator/value
          expression, which reads as source code to a non-technical viewer.
          Genuine conditional-logic branch nodes (hand-built flows) keep the
          expression, since that's their actual configured behavior. */}
      {nd.nodeSubtitle ? (
        <div className="text-xs text-slate-700">{nd.nodeSubtitle}</div>
      ) : (
        <div className="font-mono text-xs text-slate-700 bg-violet-50 rounded px-2 py-1">
          {nd.variable || 'variable'}{' '}
          <span className="text-violet-500">{nd.operator || '=='}</span>{' '}
          {nd.compareValue ? `"${nd.compareValue}"` : '"value"'}
        </div>
      )}
    </BaseNode>
  );
});

export const HttpRequestNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('httpRequest');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={2}
      outputLabels={['Success (2xx)', 'Error']}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-slate-200 text-slate-700">
          {nd.method || 'POST'}
        </span>
      </div>
      {nd.url ? (
        <div className="font-mono text-xs text-slate-600 truncate">{nd.url}</div>
      ) : (
        <div className="text-xs text-slate-400 italic">Set endpoint URL...</div>
      )}
    </BaseNode>
  );
});

export const CallbackNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('callback');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={2}
      outputLabels={['Accepted', 'Declined']}
    >
      <div className="flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 capitalize">
          {nd.callbackType || 'immediate'}
        </span>
      </div>
      {nd.callbackMessage && (
        <div className="text-xs text-slate-500 mt-1 line-clamp-1 italic">"{nd.callbackMessage}"</div>
      )}
    </BaseNode>
  );
});

export const SetVariableNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('setVariable');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def} outputCount={1}>
      <div className="font-mono text-xs bg-sky-50 rounded px-2 py-1 text-slate-700">
        <span className="text-sky-600">{nd.variableName || 'variable'}</span>
        {' = '}
        <span className="text-slate-600">{nd.variableValue ? `"${nd.variableValue}"` : '"value"'}</span>
      </div>
    </BaseNode>
  );
});

export const HuntGroupNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('huntGroup');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def}
      outputCount={2}
      outputLabels={['Answered', 'No Answer']}
    >
      {nd.menuKey && <MenuKeyBanner digit={nd.menuKey} kind="huntGroup" label={nd.label} />}
      {nd.huntGroupName ? (
        <div className="font-medium text-xs text-slate-700 mb-1">{nd.huntGroupName}</div>
      ) : (
        <div className="text-xs text-slate-400 italic mb-1">Select a hunt group...</div>
      )}
      {nd.huntGroupId && (
        <div className="text-xs text-slate-400 font-mono truncate">ID: {nd.huntGroupId.slice(0, 12)}…</div>
      )}
    </BaseNode>
  );
});

export const SubAutoAttendantNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('subAutoAttendant');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def} outputCount={1} outputLabels={['Transferred']}>
      {nd.menuKey && <MenuKeyBanner digit={nd.menuKey} kind="subAutoAttendant" label={nd.label} />}
      {nd.targetAutoAttendantName ? (
        <div className="font-medium text-xs text-slate-700">{nd.targetAutoAttendantName}</div>
      ) : (
        <div className="text-xs text-slate-400 italic">Select target AA...</div>
      )}
      <div className="text-xs text-orange-500 mt-0.5">↪ Nested IVR</div>
    </BaseNode>
  );
});

export const RepeatMenuNode = memo(({ id, data, selected }: NodeProps) => {
  const nd = data as NodeData;
  const def = getDef('repeatMenu');
  return (
    <BaseNode id={id} data={nd} selected={selected} def={def} outputCount={1} outputLabels={['Back to Menu']}>
      {nd.menuKey && <MenuKeyBanner digit={nd.menuKey} kind="repeatMenu" label={nd.label} />}
      <div className="text-xs text-fuchsia-600 font-medium">↩ Replays IVR prompt</div>
      <div className="text-xs text-slate-400 mt-0.5">Connect back to the Menu node</div>
    </BaseNode>
  );
});
