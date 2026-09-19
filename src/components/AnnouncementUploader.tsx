import { useRef, useState, useCallback } from 'react';
import {
  Upload, FileAudio, CheckCircle, XCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { createWebexApi } from '../api/webexApi';
import { useOrgStore } from '../store/orgStore';
import { WebexApiError } from '../types/webex';

// ── Types ────────────────────────────────────────────────────────────────────

interface AnnouncementUploaderProps {
  locationId: string;
  onUploaded: (announcement: { id: string; name: string }) => void;
  onCancel?: () => void;
}

type UploaderState =
  | { phase: 'idle' }
  | { phase: 'selected'; file: File; name: string }
  | { phase: 'uploading'; file: File; name: string }
  | { phase: 'success'; id: string; name: string }
  | { phase: 'error'; file: File; name: string; message: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AnnouncementUploader({
  locationId,
  onUploaded,
  onCancel,
}: AnnouncementUploaderProps) {
  const { token } = useOrgStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploaderState>({ phase: 'idle' });
  const [dragOver, setDragOver] = useState(false);

  // ── File selection helpers ────────────────────────────────────────────────

  const applyFile = useCallback((file: File) => {
    setState({ phase: 'selected', file, name: stripExtension(file.name) });
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) applyFile(file);
      // Reset input so the same file can be re-selected if the user clicks "choose different"
      e.target.value = '';
    },
    [applyFile],
  );

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) applyFile(file);
    },
    [applyFile],
  );

  // ── Keyboard support for drag zone ────────────────────────────────────────

  const handleDropZoneKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFilePicker();
      }
    },
    [openFilePicker],
  );

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (state.phase !== 'selected') return;
    const { file, name } = state;

    setState({ phase: 'uploading', file, name });

    try {
      const api = createWebexApi(token!);
      const result = await api.uploadAnnouncement(locationId, file, name);
      setState({ phase: 'success', id: result.id, name });
    } catch (err) {
      let message = 'Upload failed. Please try again.';
      if (err instanceof WebexApiError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setState({ phase: 'error', file, name, message });
    }
  }, [state, token, locationId]);

  // ── Reset helpers ─────────────────────────────────────────────────────────

  const resetToIdle = useCallback(() => {
    setState({ phase: 'idle' });
  }, []);

  const resetToSelected = useCallback(() => {
    if (state.phase === 'error') {
      setState({ phase: 'selected', file: state.file, name: state.name });
    }
  }, [state]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-3">

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.wma,audio/wav,audio/x-ms-wma"
        className="sr-only"
        tabIndex={-1}
        onChange={handleFileInputChange}
        aria-hidden="true"
      />

      {/* ── Idle: drag-and-drop zone ── */}
      {state.phase === 'idle' && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload announcement file — drop a WAV or WMA file here or press Enter to browse"
          onClick={openFilePicker}
          onKeyDown={handleDropZoneKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400',
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50',
          ].join(' ')}
        >
          <Upload
            size={28}
            className={`mx-auto mb-3 ${dragOver ? 'text-blue-500' : 'text-slate-400'}`}
          />
          <p className="text-sm font-medium text-slate-700">
            Drop a WAV or WMA file here
          </p>
          <p className="text-xs text-slate-400 mt-1">or click to browse</p>
        </div>
      )}

      {/* ── Selected: file info + name input + upload button ── */}
      {(state.phase === 'selected' || state.phase === 'uploading') && (
        <>
          {/* File info card */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <FileAudio size={16} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {state.file.name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatBytes(state.file.size)}
              </p>
            </div>
          </div>

          {/* Announcement name input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Announcement Name
            </label>
            <input
              type="text"
              value={state.name}
              onChange={(e) =>
                state.phase === 'selected' &&
                setState({ phase: 'selected', file: state.file, name: e.target.value })
              }
              disabled={state.phase === 'uploading'}
              placeholder="Enter a name for this announcement…"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-slate-700 placeholder:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Upload / uploading button */}
          <button
            onClick={handleUpload}
            disabled={state.phase === 'uploading' || !state.name.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #00BCF2 0%, #0050A0 100%)' }}
          >
            {state.phase === 'uploading' ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload size={15} />
                Upload Announcement
              </>
            )}
          </button>

          {/* Choose different file link */}
          {state.phase === 'selected' && (
            <button
              type="button"
              onClick={openFilePicker}
              className="block w-full text-center text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              Choose different file
            </button>
          )}
        </>
      )}

      {/* ── Success ── */}
      {state.phase === 'success' && (
        <>
          <div className="flex items-start gap-3 p-3.5 bg-green-50 rounded-xl border border-green-200">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800">
                Uploaded: {state.name}
              </p>
              <p className="text-xs font-mono text-green-700 mt-0.5 truncate">
                {state.id}
              </p>
            </div>
          </div>

          <button
            onClick={() => onUploaded({ id: state.id, name: state.name })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #00BCF2 0%, #0050A0 100%)' }}
          >
            <CheckCircle size={15} />
            Use this announcement
          </button>

          <button
            type="button"
            onClick={resetToIdle}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={14} />
            Upload another
          </button>
        </>
      )}

      {/* ── Error ── */}
      {state.phase === 'error' && (
        <>
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 rounded-xl border border-red-200">
            <XCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed">{state.message}</p>
          </div>

          <button
            type="button"
            onClick={resetToSelected}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </>
      )}

      {/* Optional cancel link shown in idle and selected states */}
      {onCancel && (state.phase === 'idle' || state.phase === 'selected') && (
        <button
          type="button"
          onClick={onCancel}
          className="block w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
