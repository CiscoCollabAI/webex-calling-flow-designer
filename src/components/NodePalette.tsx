import { useState, useCallback } from 'react';
import { NODE_DEFINITIONS, CATEGORY_LABELS, CATEGORY_COLORS, type NodeCategory, type NodeKind, type CanvasMode } from '../types';
import { ChevronDown, ChevronRight, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { getNodeIcon } from '../nodes/nodeIcons';
import { useFlowStore } from '../store/flowStore';

// Nodes excluded from the palette per canvas mode
const MODE_EXCLUDES: Partial<Record<NonNullable<CanvasMode>, Set<NodeKind>>> = {
  aa:  new Set<NodeKind>(['queue', 'callback']),
  cq:  new Set<NodeKind>(['menu', 'repeatMenu']),
  // cxe: no exclusions — full node set available
};

const MODE_LABEL: Record<NonNullable<CanvasMode>, { text: string; style: string }> = {
  aa:  { text: 'Auto Attendant', style: 'bg-blue-50 text-blue-700 border-blue-200' },
  cq:  { text: 'Call Queue',     style: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  cxe: { text: 'CX Essentials',  style: 'bg-violet-50 text-violet-700 border-violet-200' },
};

interface NodePaletteProps {
  onDragStart: (kind: NodeKind) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  canvasMode?: CanvasMode;
}

const CATEGORY_ORDER: NodeCategory[] = ['control', 'voice', 'routing', 'time', 'transfer', 'integration'];

export function NodePalette({ onDragStart, collapsed, onToggleCollapse, canvasMode }: NodePaletteProps) {
  const readOnly = useFlowStore((s) => s.readOnly);
  const [collapsedCats, setCollapsedCats] = useState<Set<NodeCategory>>(new Set());
  const [search, setSearch] = useState('');

  const toggle = (cat: NodeCategory) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Apply mode exclusions first, then text search
  const excludes = canvasMode ? (MODE_EXCLUDES[canvasMode] ?? new Set<NodeKind>()) : new Set<NodeKind>();
  const visibleDefs = NODE_DEFINITIONS.filter(n => !excludes.has(n.kind));

  const filtered = search.trim()
    ? visibleDefs.filter(
        (n) =>
          n.label.toLowerCase().includes(search.toLowerCase()) ||
          n.description.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const grouped = CATEGORY_ORDER.reduce<Record<NodeCategory, typeof NODE_DEFINITIONS>>((acc, cat) => {
    acc[cat] = visibleDefs.filter((n) => n.category === cat);
    return acc;
  }, {} as Record<NodeCategory, typeof NODE_DEFINITIONS>);

  const handleDragStart = useCallback(
    (e: React.DragEvent, kind: NodeKind) => {
      if (readOnly) { e.preventDefault(); return; }
      e.dataTransfer.setData('application/flow-node', kind);
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart(kind);
    },
    [onDragStart, readOnly]
  );

  // Collapsed panel: show only a narrow column with a toggle button
  if (collapsed) {
    return (
      <div className="flex flex-col h-full bg-white border-r border-slate-200 items-center pt-3">
        <button
          onClick={onToggleCollapse}
          title="Expand node library"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <PanelLeftOpen size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-slate-700">Node Library</div>
          <button
            onClick={onToggleCollapse}
            title="Collapse node library"
            className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors flex-shrink-0"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
      </div>

      {/* Canvas mode indicator */}
      {readOnly ? (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-700">Viewing mode — switch to Editing in the toolbar to add nodes</p>
        </div>
      ) : canvasMode ? (
        <div className={`px-4 py-2 border-b text-xs font-medium flex items-center gap-1.5 border ${MODE_LABEL[canvasMode].style}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
          {MODE_LABEL[canvasMode].text} mode
        </div>
      ) : (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-600">Drag nodes onto the canvas to build your flow</p>
        </div>
      )}

      {/* Node list */}
      <div className="flex-1 overflow-y-auto py-2">
        {filtered ? (
          <div className="px-3 space-y-1">
            {filtered.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-8">No nodes found</div>
            ) : (
              filtered.map((n) => (
                <NodeItem key={n.kind} def={n} onDragStart={handleDragStart} readOnly={readOnly} />
              ))
            )}
          </div>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const nodes = grouped[cat];
            if (!nodes || nodes.length === 0) return null;
            const isCatCollapsed = collapsedCats.has(cat);
            const color = CATEGORY_COLORS[cat];
            return (
              <div key={cat} className="mb-1">
                <button
                  onClick={() => toggle(cat)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  {isCatCollapsed ? (
                    <ChevronRight size={13} className="text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />
                  )}
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">{nodes.length}</span>
                </button>
                {!isCatCollapsed && (
                  <div className="px-3 pb-2 space-y-1">
                    {nodes.map((n) => (
                      <NodeItem key={n.kind} def={n} onDragStart={handleDragStart} readOnly={readOnly} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer tip */}
      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
        <p className="text-xs text-slate-400 leading-relaxed">
          Connect nodes by dragging from the bottom handle of one node to the top handle of another.
        </p>
      </div>
    </div>
  );
}

function NodeItem({
  def,
  onDragStart,
  readOnly,
}: {
  def: (typeof NODE_DEFINITIONS)[0];
  onDragStart: (e: React.DragEvent, kind: NodeKind) => void;
  readOnly?: boolean;
}) {
  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => onDragStart(e, def.kind)}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-transparent transition-all select-none group ${
        readOnly ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:border-slate-200'
      }`}
      title={readOnly ? 'Switch to Editing to add nodes' : def.description}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
        style={{ background: def.bgColor, border: `1.5px solid ${def.borderColor}` }}
      >
        <span style={{ color: def.borderColor }}>
          {getNodeIcon(def.icon, 16)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-700 truncate">{def.label}</div>
        <div className="text-xs text-slate-400 truncate leading-tight">{def.description}</div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>
          <circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
        </svg>
      </div>
    </div>
  );
}
