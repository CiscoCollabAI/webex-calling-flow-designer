import { useEffect, useState } from 'react';
import { Bug, X, Trash2 } from 'lucide-react';
import {
  isDebugCaptureEnabled,
  getApiCaptures,
  clearApiCaptures,
  subscribeApiCaptures,
  type ApiCaptureEntry,
} from '../utils/apiDebugCapture';

// Dev-only: shows every raw Webex API response captured this session, so field
// names/shapes can be verified against live data instead of guessing.
// Disabled by default — enable by loading the app with ?debugApi=1 once.
export function DebugApiPanel() {
  const [enabled] = useState(isDebugCaptureEnabled);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ApiCaptureEntry[]>(getApiCaptures());
  const [selected, setSelected] = useState<ApiCaptureEntry | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    return subscribeApiCaptures(() => setEntries(getApiCaptures()));
  }, [enabled]);

  if (!enabled) return null;

  const handleCopy = (json: string) => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleDownload = (entry: ApiCaptureEntry) => {
    const blob = new Blob([JSON.stringify(entry.body, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entry.path.replace(/[^\w.-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Raw Webex API response inspector (dev only)"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-800 text-white text-xs font-medium shadow-lg hover:bg-slate-700 transition-colors"
      >
        <Bug size={14} />
        API {entries.length > 0 && <span className="bg-white/20 rounded-full px-1.5">{entries.length}</span>}
      </button>

      {open && (
        <div className="fixed bottom-16 right-4 z-40 w-96 max-h-[70vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-700">Raw API Responses (dev)</span>
            <div className="flex items-center gap-1">
              <button onClick={clearApiCaptures} title="Clear" className="text-slate-400 hover:text-slate-600">
                <Trash2 size={13} />
              </button>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {entries.length === 0 ? (
              <div className="px-3 py-6 text-xs text-slate-400 text-center">
                No API calls captured yet — open an AA, Call Queue, or CX flow.
              </div>
            ) : (
              entries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="text-xs font-mono text-slate-700 truncate">{e.path}</div>
                  <div className="text-[10px] text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-700 font-mono truncate">{selected.path}</span>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                <X size={16} />
              </button>
            </div>
            <textarea
              readOnly
              value={JSON.stringify(selected.body, null, 2)}
              className="flex-1 min-h-[300px] w-full p-3 text-xs font-mono text-slate-700 bg-slate-50 focus:outline-none resize-none"
            />
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200">
              <button
                onClick={() => handleDownload(selected)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg transition-colors"
              >
                Download .json
              </button>
              <button
                onClick={() => handleCopy(JSON.stringify(selected.body, null, 2))}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
