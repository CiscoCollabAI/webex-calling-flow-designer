import { useState } from 'react';
import { X, Building2, PhoneIncoming, Loader2, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { useOrgStore } from '../store/orgStore';
import { useFlowStore } from '../store/flowStore';
import { createWebexApi } from '../api/webexApi';
import { importAutoAttendant } from '../utils/importAutoAttendant';
import { WebexApiError } from '../types/webex';

interface Props {
  open: boolean;
  onClose: () => void;
}

type ImportState = 'idle' | 'loading' | 'success' | 'error';

export function ImportOrgModal({ open, onClose }: Props) {
  const { autoAttendants, token, orgName, schedules } = useOrgStore();
  const { setNodes, setEdges, setFlowName, requestFitView } = useFlowStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);

  if (!open) return null;

  const handleImport = async () => {
    if (!selectedId || !token) return;

    const aa = autoAttendants.find((a) => a.id === selectedId);
    if (!aa) return;

    setImportState('loading');
    setErrorMsg(null);

    try {
      const api = createWebexApi(token);
      const rawDetail = await api.getAutoAttendantDetail(aa.locationId, aa.id);

      // The detail endpoint doesn't return locationName (location is implicit in URL path).
      // Merge it from the list item so the canvas Start node can display it.
      const detail = {
        ...rawDetail,
        locationName: rawDetail.locationName ?? aa.locationName,
        locationId:   rawDetail.locationId   ?? aa.locationId,
      };

      const { nodes, edges } = importAutoAttendant(detail, schedules);

      setFlowName(`${detail.name} (Imported)`);
      setNodes(nodes);
      setEdges(edges);
      requestFitView();

      setImportedName(detail.name);
      setImportState('success');
    } catch (err) {
      console.error('[Import AA] Error:', err);
      let msg = 'Failed to fetch Auto-Attendant details.';
      if (err instanceof WebexApiError) msg = err.message;
      else if (err instanceof Error) msg = err.message;
      setErrorMsg(msg);
      setImportState('error');
    }
  };

  const handleClose = () => {
    setSelectedId(null);
    setImportState('idle');
    setErrorMsg(null);
    setImportedName(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 size={16} className="text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">Import from Org</div>
              {orgName && (
                <div className="text-xs text-slate-400">{orgName}</div>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {importState === 'success' ? (
            <SuccessView name={importedName!} onClose={handleClose} />
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-4">
                Select an Auto-Attendant to render its IVR menus, routing rules, and schedule
                as a visual flow on the canvas.
              </p>

              {autoAttendants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <PhoneIncoming size={28} className="text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">No Auto-Attendants found in this org.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Ensure your token has the <code className="bg-slate-100 px-1 rounded">spark-admin:telephony_config_read</code> scope.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {autoAttendants.map((aa) => (
                    <button
                      key={aa.id}
                      onClick={() => setSelectedId(aa.id)}
                      className={[
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                        selectedId === aa.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className={[
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        selectedId === aa.id ? 'bg-blue-100' : 'bg-slate-100',
                      ].join(' ')}>
                        <PhoneIncoming size={14} className={selectedId === aa.id ? 'text-blue-600' : 'text-slate-500'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800 truncate">{aa.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{aa.locationName}</span>
                          {aa.extension && (
                            <span className="text-xs text-slate-400">Ext: {aa.extension}</span>
                          )}
                          {aa.phoneNumber && (
                            <span className="text-xs text-slate-400">{aa.phoneNumber}</span>
                          )}
                          {aa.enabled === false && (
                            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              Disabled
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedId === aa.id && (
                        <CheckCircle size={16} className="text-blue-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {importState === 'error' && errorMsg && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{errorMsg}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {importState !== 'success' && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedId || importState === 'loading'}
              className={[
                'flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all',
                selectedId && importState !== 'loading'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed',
              ].join(' ')}
            >
              {importState === 'loading' ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <ArrowRight size={13} />
                  Import to Canvas
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessView({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
        <CheckCircle size={24} className="text-green-500" />
      </div>
      <p className="text-sm font-semibold text-slate-800">Flow Imported!</p>
      <p className="text-xs text-slate-500 mt-1 max-w-xs">
        <strong>{name}</strong> has been rendered as a visual flow on the canvas.
      </p>
      <button
        onClick={onClose}
        className="mt-5 px-5 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        View Flow
      </button>
    </div>
  );
}
