import { memo, type ReactNode } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Trash2, AlertCircle } from 'lucide-react';
import type { NodeData, NodeDefinition } from '../types';
import { useFlowStore } from '../store/flowStore';
import { getNodeIcon } from './nodeIcons';

interface BaseNodeProps {
  id: string;
  data: NodeData;
  selected: boolean;
  def: NodeDefinition;
  children?: ReactNode;
  outputCount?: number;
  outputLabels?: string[];
  showInput?: boolean;
  // Small corner pill for reinforcing where a node sits in the Holiday/Night/
  // Forced-Forward/Stranded precedence chain — same visual slot as "Bypassed",
  // shown only when the node isn't already bypassed.
  badge?: { text: string; color: string; title?: string };
  // Explicit per-instance header subtitle (e.g. a policy name under a generic
  // "Announcement" label). Overrides the automatic def.label-vs-data.label
  // subtitle below — used when one shared node kind needs a different subtitle
  // per instance rather than the same generic type name for every instance.
  subtitle?: string;
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
  badge,
  subtitle,
}: BaseNodeProps) => {
  const { deleteNode, selectNode, readOnly } = useFlowStore();
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
      {data.bypassed ? (
        <div
          className="absolute -top-2 -right-2 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-500 text-white shadow"
          style={{ pointerEvents: 'none' }}
        >
          Bypassed
        </div>
      ) : badge && (
        <div
          className="absolute -top-2 -right-2 z-10 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white shadow border-2 border-white"
          style={{ pointerEvents: 'none', background: badge.color }}
          title={badge.title}
        >
          {badge.text}
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
              {getNodeIcon(def.icon, 14)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-semibold truncate"
              style={{ color: def.color }}
            >
              {data.label || def.label}
            </div>
            {/* An explicit subtitle (e.g. a policy name under a shared generic
                label) always wins. Otherwise, only show the generic type name
                when the instance label doesn't already convey it — otherwise
                the two nearly-identical-looking lines read as two separate
                facts instead of one. */}
            {subtitle ? (
              <div className="text-xs opacity-60 truncate" style={{ color: def.color }}>
                {subtitle}
              </div>
            ) : data.label && data.label !== def.label && (
              <div className="text-xs opacity-60 truncate" style={{ color: def.color }}>
                {def.label}
              </div>
            )}
          </div>

          {/* Delete button */}
          {id !== 'start-1' && !readOnly && (
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
