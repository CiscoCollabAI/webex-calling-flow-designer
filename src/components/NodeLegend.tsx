import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { NODE_DEFINITIONS, CATEGORY_LABELS } from '../types';
import type { NodeCategory } from '../types';
import { getNodeIcon } from '../nodes/nodeIcons';

const CATEGORY_ORDER: NodeCategory[] = ['control', 'voice', 'routing', 'time', 'transfer', 'integration'];

// Read-mode legend for the canvas: decodes what each node's color/icon means
// without requiring the viewer to open the (build-oriented) Node Palette or
// click into individual nodes first.
export function NodeLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-4 left-4 z-10">
      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? 'Hide node legend' : 'Show node legend — what each color/icon means'}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
      >
        <Info size={14} />
        Legend
      </button>

      {open && (
        <div className="mt-2 w-72 max-h-[calc(100vh-180px)] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 sticky top-0 bg-white">
            <span className="text-xs font-semibold text-slate-700">Node Legend</span>
            <button
              onClick={() => setOpen(false)}
              className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X size={12} />
            </button>
          </div>
          <div className="py-1">
            {CATEGORY_ORDER.map((cat) => {
              const defs = NODE_DEFINITIONS.filter((d) => d.category === cat);
              if (defs.length === 0) return null;
              return (
                <div key={cat} className="px-3 py-1.5">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    {CATEGORY_LABELS[cat]}
                  </div>
                  <div className="space-y-1 mb-1">
                    {defs.map((def) => {
                      return (
                        <div key={def.kind} className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: def.bgColor, border: `1.5px solid ${def.borderColor}` }}
                          >
                            {getNodeIcon(def.icon, 12)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-700 truncate">{def.label}</div>
                            <div className="text-xs text-slate-400 truncate leading-tight">{def.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
