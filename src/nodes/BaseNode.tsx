import { memo, type ReactNode } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, AlertCircle } from 'lucide-react';
import type { NodeData, NodeDefinition } from '../types';
import { useFlowStore } from '../store/flowStore';

interface BaseNodeProps {
  id: string;
  data: NodeData;
  selected: boolean;
  def: NodeDefinition;
  children?: ReactNode;
  outputCount?: number;
  outputLabels?: string[];
  showInput?: boolean;
}

export const BaseNode = memo(({
  id,
  data,
  selected,
  def,
  children,
  outputCount = 1,
  outputLabels = [],
  showInput = true,
}: BaseNodeProps) => {
  const { deleteNode, selectNode } = useFlowStore();
  const { getNode } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'start-1') return;
    deleteNode(id);
  };

  const handleClick = () => {
    selectNode(id);
  };

  const outputs = Math.max(1, outputCount);
  const nodeHeight = Math.max(72, 48 + outputs * 24);

  return (
    <div
      onClick={handleClick}
      className="relative group"
      style={{ minWidth: 200, opacity: data.bypassed ? 0.4 : 1 }}
      title={data.bypassed ? 'Bypassed — Forced Forward is overriding this queue\'s normal routing, but this configuration still exists' : undefined}
    >
      {data.bypassed && (
        <div
          className="absolute -top-2 -right-2 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-500 text-white shadow"
          style={{ pointerEvents: 'none' }}
        >
          Bypassed
        </div>
      )}
      {/* Input handle */}
      {showInput && (
        <Handle
          type="target"
          position={Position.Top}
          id="input"
          style={{
            background: selected ? '#00BCF2' : '#94A3B8',
            width: 12,
            height: 12,
            top: -6,
            border: '2px solid white',
          }}
        />
      )}

      {/* Node card */}
      <div
        className="rounded-lg overflow-hidden transition-all duration-150"
        style={{
          background: 'white',
          border: `2px solid ${selected ? '#00BCF2' : def.borderColor}`,
          boxShadow: selected
            ? '0 0 0 3px rgba(0,188,242,0.25), 0 4px 12px rgba(0,0,0,0.12)'
            : '0 2px 8px rgba(0,0,0,0.08)',
          minWidth: 200,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ background: def.bgColor }}
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: def.borderColor }}
          >
            <span style={{ color: 'white', fontSize: 14 }}>
              {getIconComponent(def.icon)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-semibold truncate"
              style={{ color: def.color }}
            >
              {data.label || def.label}
            </div>
            <div className="text-xs opacity-60 truncate" style={{ color: def.color }}>
              {def.label}
            </div>
          </div>

          {/* Delete button */}
          {id !== 'start-1' && (
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded flex items-center justify-center hover:bg-red-100 flex-shrink-0"
              title="Delete node"
            >
              <Trash2 size={12} className="text-red-500" />
            </button>
          )}
        </div>

        {/* Body */}
        {children && (
          <div className="px-3 py-2 bg-white text-xs text-slate-600">
            {children}
          </div>
        )}

        {/* Error indicator */}
        {data.hasError && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border-t border-red-100">
            <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-600 truncate">{data.errorMessage || 'Configuration required'}</span>
          </div>
        )}
      </div>

      {/* Output handles */}
      {Array.from({ length: outputs }).map((_, i) => {
        const totalOutputs = outputs;
        const spacing = totalOutputs > 1 ? 200 / (totalOutputs + 1) : 100;
        const leftPercent = totalOutputs > 1
          ? ((i + 1) * spacing / 200) * 100
          : 50;

        return (
          <div key={i}>
            <Handle
              type="source"
              position={Position.Bottom}
              id={`output-${i}`}
              style={{
                background: def.borderColor,
                width: 10,
                height: 10,
                bottom: -5,
                left: `${leftPercent}%`,
                transform: 'translateX(-50%)',
                border: '2px solid white',
              }}
            />
            {outputLabels[i] && (
              <div
                style={{
                  position: 'absolute',
                  bottom: -20,
                  left: `${leftPercent}%`,
                  transform: 'translateX(-50%)',
                  fontSize: 9,
                  color: '#64748B',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  fontWeight: 500,
                }}
              >
                {outputLabels[i]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// Inline SVG icon renderer for the nodes (avoids dynamic imports)
function getIconComponent(name: string): ReactNode {
  const iconMap: Record<string, ReactNode> = {
    PhoneIncoming: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1.09h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.19-1.19a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/><polyline points="9 11 12 8 15 11"/><line x1="12" y1="8" x2="12" y2="16"/></svg>,
    PhoneOff: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c1.12.45 2.3.75 3.53.75a2 2 0 012 2v3.5a2 2 0 01-2 2A18.5 18.5 0 012 4.5a2 2 0 012-2H7.5a2 2 0 012 2c0 1.23.3 2.41.75 3.53a2 2 0 01-.45 2.11L8.59 11.3a16 16 0 002.09 2.01z"/><line x1="23" y1="1" x2="1" y2="23"/></svg>,
    LayoutGrid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    Volume2: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>,
    Hash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
    Users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    UserCheck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
    Clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    PhoneForwarded: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="19 1 23 5 19 9"/><line x1="15" y1="5" x2="23" y2="5"/><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1.09h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.19-1.19a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
    Voicemail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="5.5" cy="11.5" r="4.5"/><circle cx="18.5" cy="11.5" r="4.5"/><line x1="5.5" y1="16" x2="18.5" y2="16"/></svg>,
    GitBranch: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/></svg>,
    Globe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
    PhoneCall: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1.09h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.19-1.19a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/><path d="M15 7a3 3 0 11-6 0"/></svg>,
    Variable: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5a2 2 0 002 2h1"/><path d="M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1"/></svg>,
  };
  return iconMap[name] || <span>●</span>;
}
