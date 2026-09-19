import { useState, useCallback } from 'react';
import { NODE_DEFINITIONS, CATEGORY_LABELS, CATEGORY_COLORS, type NodeCategory, type NodeKind, type CanvasMode } from '../types';
import { ChevronDown, ChevronRight, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

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
      e.dataTransfer.setData('application/flow-node', kind);
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart(kind);
    },
    [onDragStart]
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
      {canvasMode ? (
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
                <NodeItem key={n.kind} def={n} onDragStart={handleDragStart} />
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
                      <NodeItem key={n.kind} def={n} onDragStart={handleDragStart} />
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
}: {
  def: (typeof NODE_DEFINITIONS)[0];
  onDragStart: (e: React.DragEvent, kind: NodeKind) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, def.kind)}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all select-none group"
      title={def.description}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
        style={{ background: def.bgColor, border: `1.5px solid ${def.borderColor}` }}
      >
        <span style={{ color: def.borderColor }}>
          {getSmallIcon(def.icon)}
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

function getSmallIcon(name: string) {
  const icons: Record<string, React.ReactNode> = {
    PhoneIncoming: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1.09h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.19-1.19a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/><polyline points="9 11 12 8 15 11"/><line x1="12" y1="8" x2="12" y2="16"/></svg>,
    PhoneOff: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c1.12.45 2.3.75 3.53.75a2 2 0 012 2v3.5a2 2 0 01-2 2A18.5 18.5 0 012 4.5a2 2 0 012-2H7.5a2 2 0 012 2c0 1.23.3 2.41.75 3.53a2 2 0 01-.45 2.11L8.59 11.3a16 16 0 002.09 2.01z"/><line x1="23" y1="1" x2="1" y2="23"/></svg>,
    LayoutGrid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    Volume2: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>,
    Hash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
    Users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    UserCheck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
    Clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    PhoneForwarded: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="19 1 23 5 19 9"/><line x1="15" y1="5" x2="23" y2="5"/><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1.09h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.19-1.19a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
    Voicemail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="5.5" cy="11.5" r="4.5"/><circle cx="18.5" cy="11.5" r="4.5"/><line x1="5.5" y1="16" x2="18.5" y2="16"/></svg>,
    GitBranch: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/></svg>,
    Globe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
    PhoneCall: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 12a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1.09h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.19-1.19a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/><path d="M15 7a3 3 0 11-6 0"/></svg>,
    Variable: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5a2 2 0 002 2h1"/><path d="M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1"/></svg>,
  };
  return icons[name] || <span>●</span>;
}
