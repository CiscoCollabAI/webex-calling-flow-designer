import { useEffect, useRef, useState } from 'react';
import {
  CloudUpload, CheckCircle, XCircle, Loader2, X, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useFlowStore } from '../store/flowStore';

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  onPublish: () => Promise<void>;
  resourceName: string;
  isNew: boolean;
}

const RESOURCE_TYPE_BADGE: Record<'aa' | 'cq' | 'cxe', { label: string; className: string }> = {
  aa:  { label: 'Auto Attendant', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  cq:  { label: 'Call Queue',     className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  cxe: { label: 'CX Experience',  className: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export function PublishModal({ open, onClose, onPublish, resourceName, isNew }: PublishModalProps) {
  const { publishState, flowMeta, resetPublish } = useFlowStore();
  const { status, progress, errors } = publishState;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the progress log to bottom whenever new steps arrive
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [progress]);

  if (!open) return null;

  const isBusy = status === 'validating' || status === 'publishing';

  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  const handleConfirmPublish = async () => {
    setIsSubmitting(true);
    try {
      await onPublish();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTryAgain = () => {
    resetPublish();
  };

  const handleDoneClose = () => {
    resetPublish();
    onClose();
  };

  const resourceTypeBadge = flowMeta.resourceType
    ? RESOURCE_TYPE_BADGE[flowMeta.resourceType]
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #00BCF2 0%, #0050A0 100%)' }}
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <CloudUpload size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm">Publish to Webex</div>
            <div className="text-white/70 text-xs truncate">
              {isNew ? 'Creating' : 'Updating'} — {resourceName}
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isBusy}
            className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* ── Confirm view (idle) ────────────────────────────── */}
          {status === 'idle' && (
            <>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CloudUpload size={15} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">
                      {isNew ? 'Create new resource' : 'Update existing resource'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {resourceName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {resourceTypeBadge && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${resourceTypeBadge.className}`}>
                      {resourceTypeBadge.label}
                    </span>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
                    isNew
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {isNew ? 'POST — Create' : 'PUT — Update'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {isNew
                    ? 'This will create a new resource in your Webex organisation using the current flow configuration.'
                    : 'This will overwrite the existing resource configuration in your Webex organisation. This action cannot be undone.'}
                </p>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPublish}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #00BCF2 0%, #0050A0 100%)' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    <>
                      <CloudUpload size={14} />
                      Publish
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* ── Progress view (validating | publishing) ─────────── */}
          {(status === 'validating' || status === 'publishing') && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <Loader2 size={15} className="animate-spin text-blue-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-slate-700">
                  {status === 'validating' ? 'Validating flow…' : 'Publishing to Webex…'}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-52 overflow-y-auto space-y-2">
                {progress.length === 0 ? (
                  <div className="text-xs text-slate-400 italic">Starting…</div>
                ) : (
                  progress.map((step, i) => {
                    const isCurrentStep = i === progress.length - 1;
                    return (
                      <div key={i} className="flex items-start gap-2">
                        {isCurrentStep ? (
                          <Loader2 size={13} className="animate-spin text-blue-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-xs leading-relaxed ${isCurrentStep ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                          {step}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={logEndRef} />
              </div>

              <p className="text-xs text-slate-400 text-center">
                Please wait — do not close this window
              </p>
            </>
          )}

          {/* ── Result view — done ───────────────────────────────── */}
          {status === 'done' && (
            <>
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-green-800">Published successfully</div>
                  <div className="text-xs text-green-700 mt-0.5 leading-relaxed">
                    <span className="font-medium">{resourceName}</span> has been{' '}
                    {isNew ? 'created' : 'updated'} in your Webex organisation.
                  </div>
                </div>
              </div>

              {progress.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-40 overflow-y-auto space-y-2">
                  {progress.map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-500 leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleDoneClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #00BCF2 0%, #0050A0 100%)' }}
              >
                Close
              </button>
            </>
          )}

          {/* ── Result view — error ──────────────────────────────── */}
          {status === 'error' && (
            <>
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-red-800">Publish failed</div>
                  <div className="text-xs text-red-700 mt-0.5">
                    The following error{errors.length !== 1 ? 's' : ''} occurred:
                  </div>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 p-3 space-y-1.5 max-h-40 overflow-y-auto">
                  {errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-red-700 leading-relaxed">{err}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={handleTryAgain}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <RefreshCw size={14} />
                  Try Again
                </button>
                <button
                  onClick={handleDoneClose}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
