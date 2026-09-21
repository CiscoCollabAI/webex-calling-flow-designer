import { useState, useRef } from 'react';
import {
  Upload, Download, Trash2, CheckCircle, XCircle,
  ZoomIn, ZoomOut, Maximize2, Play, FileText, AlertTriangle, Building2, LayoutGrid,
  LayoutDashboard, GitBranch, X, PhoneIncoming, Users, Headphones, CloudUpload, Plus,
  Bookmark, BookmarkCheck, Eye, Pencil,
} from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useFlowStore } from '../store/flowStore';
import { useOrgStore } from '../store/orgStore';
import { usePublish } from '../hooks/usePublish';
import { OrgBadge } from './OrgBadge';
import { ConnectOrgModal } from './ConnectOrgModal';
import { ImportOrgModal } from './ImportOrgModal';
import { PublishModal } from './PublishModal';
import type { ViewMode } from '../App';
import type { CanvasMode } from '../types';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const MODE_CONFIG: Record<NonNullable<CanvasMode>, { label: string; description: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  aa:  { label: 'Auto Attendant', description: 'IVR menu flow — routes callers with keypresses and business-hours schedules', icon: <PhoneIncoming size={12} />, bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  cq:  { label: 'Call Queue',     description: 'Agent queue flow — holds callers until an agent is available', icon: <Users size={12} />,         bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  cxe: { label: 'CX Essentials',  description: 'Webex Customer Experience Essentials — a Call Queue with extra features: skills routing, wrap-up, post-call survey, digital handoff', icon: <Headphones size={12} />,   bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
};

interface ToolbarProps {
  view?: ViewMode;
  onViewChange?: (v: ViewMode) => void;
  canvasMode?: CanvasMode;
  onClearMode?: () => void;
  onOpenNewFlow?: (defaultMode?: 'aa' | 'cq') => void;
}

export function Toolbar({ view, onViewChange, canvasMode, onClearMode, onOpenNewFlow }: ToolbarProps) {
  const {
    flowName, setFlowName, exportFlow, importFlow, clearFlow, validateFlow, isDirty, autoLayout,
    flowMeta, resetPublish, saveDraft, draftSavedAt, readOnly, setReadOnly,
  } = useFlowStore();

  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(flowName);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const connected = useOrgStore((s) => s.connected);
  const hasWriteScope = useOrgStore((s) => s.hasWriteScope);
  const fileRef = useRef<HTMLInputElement>(null);

  const { publish } = usePublish(canvasMode ?? null);

  const handleOpenPublish = () => {
    resetPublish();
    setShowPublishModal(true);
  };

  const handleSave = () => {
    const json = exportFlow();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${flowName.replace(/\s+/g, '-').toLowerCase()}.flow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => fileRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => importFlow(ev.target?.result as string);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleValidate = () => {
    const result = validateFlow();
    setValidation(result);
    setShowValidation(true);
  };

  const handleNameCommit = () => {
    setFlowName(nameVal);
    setEditingName(false);
  };

  return (
    <div className="flex items-center h-14 px-4 gap-3 bg-white border-b border-slate-200 shadow-sm z-10">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mr-2 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #00BCF2, #0050A0)' }}
        >
          W
        </div>
        <div className="hidden sm:block">
          <div className="text-xs font-bold text-slate-800 leading-tight">Webex Calling</div>
          <div className="text-xs text-slate-400 leading-tight">CX Flow Designer</div>
        </div>
      </div>

      <div className="w-px h-8 bg-slate-200 flex-shrink-0" />

      {/* Flow name */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <FileText size={14} className="text-slate-400 flex-shrink-0" />
        {editingName ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={handleNameCommit}
            onKeyDown={(e) => e.key === 'Enter' && handleNameCommit()}
            className="text-sm font-semibold text-slate-800 bg-slate-100 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-56"
          />
        ) : readOnly ? (
          <span
            className="text-sm font-semibold text-slate-800 truncate max-w-56"
            title="Switch to Editing to rename"
          >
            {flowName}
          </span>
        ) : (
          <button
            onClick={() => { setEditingName(true); setNameVal(flowName); }}
            className="text-sm font-semibold text-slate-800 hover:text-blue-600 truncate max-w-56 text-left"
            title="Click to rename"
          >
            {flowName}
          </button>
        )}
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
        )}
        {!isDirty && draftSavedAt && (
          <span
            className="flex items-center gap-1 text-xs text-emerald-600 flex-shrink-0"
            title={`Draft saved at ${new Date(draftSavedAt).toLocaleTimeString()}`}
          >
            <BookmarkCheck size={12} />
            <span className="hidden sm:inline">Draft saved</span>
          </span>
        )}
      </div>

      {/* Canvas mode badge */}
      {canvasMode && view === 'canvas' && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 border"
          title={MODE_CONFIG[canvasMode].description}
          style={{
            background: MODE_CONFIG[canvasMode].bg,
            color:      MODE_CONFIG[canvasMode].text,
            borderColor: MODE_CONFIG[canvasMode].border,
          }}
        >
          {MODE_CONFIG[canvasMode].icon}
          <span>{MODE_CONFIG[canvasMode].label}</span>
          {onClearMode && (
            <button
              onClick={onClearMode}
              title="Clear canvas mode"
              className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={11} />
            </button>
          )}
        </div>
      )}

      {/* Read-only / Edit mode switch — the single explicit, global control that
          gates every change to a rendered Webex Calling flow. Deliberately a
          labeled two-state switch, not an icon toggle, so flipping it is a
          conscious action rather than an easy-to-miss click. */}
      {canvasMode && view === 'canvas' && (
        <div
          className="flex items-center bg-slate-100 rounded-lg p-0.5 flex-shrink-0"
          title={readOnly ? 'Viewing — switch to Editing to change this flow' : 'Editing — changes can be published back to Webex'}
        >
          <button
            onClick={() => setReadOnly(true)}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
              readOnly ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <Eye size={13} />
            <span className="hidden sm:inline">Viewing</span>
          </button>
          <button
            onClick={() => setReadOnly(false)}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
              !readOnly ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <Pencil size={13} />
            <span className="hidden sm:inline">Editing</span>
          </button>
        </div>
      )}

      {/* Org connection badge */}
      <div className="flex-shrink-0">
        <OrgBadge onClick={() => setShowConnectModal(true)} />
      </div>

      {/* Dashboard / Canvas toggle — only when connected */}
      {connected && onViewChange && (
        <>
          <div className="w-px h-8 bg-slate-200 flex-shrink-0" />
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => onViewChange('dashboard')}
              title="Show org dashboard"
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                view === 'dashboard'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <LayoutDashboard size={13} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              onClick={() => onViewChange('canvas')}
              title="Show flow canvas"
              className={[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                view === 'canvas'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <GitBranch size={13} />
              <span className="hidden sm:inline">Canvas</span>
            </button>
          </div>
        </>
      )}

      <div className="w-px h-8 bg-slate-200 flex-shrink-0" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <ToolbarBtn onClick={() => zoomOut()} title="Zoom out" icon={<ZoomOut size={15} />} label="Zoom Out" />
        <ToolbarBtn onClick={() => zoomIn()} title="Zoom in" icon={<ZoomIn size={15} />} label="Zoom In" />
        <ToolbarBtn onClick={() => fitView({ padding: 0.15, duration: 300 })} title="Fit to view" icon={<Maximize2 size={15} />} label="Fit View" />
        <ToolbarBtn
          onClick={() => autoLayout()}
          title="Auto arrange nodes — repositioning is allowed even while Viewing"
          icon={<LayoutGrid size={15} />}
          label="Auto Arrange"
        />
      </div>

      <div className="w-px h-8 bg-slate-200 flex-shrink-0" />

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Publish to Webex — visible when a Webex resource is loaded in canvas */}
        {connected && canvasMode && view === 'canvas' && (
          <ToolbarBtn
            onClick={handleOpenPublish}
            title={
              readOnly
                ? 'Switch to Editing before publishing changes'
                : hasWriteScope === false
                ? 'Write scope missing — add spark-admin:telephony_config_write to your token'
                : `Publish ${flowMeta.isNew ? '(create)' : '(update)'} to Webex`
            }
            icon={<CloudUpload size={14} />}
            label="Publish"
            publish
            disabled={hasWriteScope === false || readOnly}
          />
        )}
        <ToolbarBtn
          onClick={handleValidate}
          title="Validate flow"
          icon={<Play size={14} />}
          label="Validate"
          accent
        />
        <ToolbarBtn
          onClick={() => saveDraft(canvasMode ?? null)}
          title="Save draft to browser storage — works even with incomplete inputs"
          icon={isDirty ? <Bookmark size={14} /> : <BookmarkCheck size={14} />}
          label="Save Draft"
        />
        {connected && (
          <>
            <ToolbarBtn
              onClick={() => onOpenNewFlow?.()}
              title="Create a new Auto-Attendant or Call Queue"
              icon={<Plus size={14} />}
              label="New Flow"
            />
            <ToolbarBtn
              onClick={() => setShowImportModal(true)}
              title="Import Auto-Attendant from connected Webex org"
              icon={<Building2 size={14} />}
              label="Import from Org"
            />
          </>
        )}
        <ToolbarBtn
          onClick={handleImport}
          title="Import flow from JSON file"
          icon={<Upload size={15} />}
          label="Import"
        />
        <ToolbarBtn
          onClick={handleSave}
          title="Export flow as JSON"
          icon={<Download size={15} />}
          label="Export"
        />
        <ToolbarBtn
          onClick={() => {
            if (confirm('Clear the canvas and start fresh?')) clearFlow();
          }}
          title="Clear canvas"
          icon={<Trash2 size={14} />}
          label="Clear"
          danger
        />
      </div>

      <input type="file" accept=".json" ref={fileRef} onChange={handleFileChange} className="hidden" />

      {/* Connect org modal */}
      <ConnectOrgModal open={showConnectModal} onClose={() => setShowConnectModal(false)} />

      {/* Import from org modal */}
      <ImportOrgModal open={showImportModal} onClose={() => setShowImportModal(false)} />

      {/* Publish to Webex modal */}
      <PublishModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onPublish={publish}
        resourceName={flowName}
        isNew={flowMeta.isNew}
      />


      {/* Validation modal */}
      {showValidation && validation && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowValidation(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center gap-3 px-5 py-4 ${validation.valid ? 'bg-green-50' : 'bg-red-50'}`}>
              {validation.valid ? (
                <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              ) : (
                <XCircle size={20} className="text-red-600 flex-shrink-0" />
              )}
              <div>
                <div className={`font-semibold text-sm ${validation.valid ? 'text-green-800' : 'text-red-800'}`}>
                  {validation.valid ? 'Flow is Valid' : 'Validation Failed'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {validation.valid
                    ? 'Your call flow passed all checks.'
                    : `${validation.errors.length} issue${validation.errors.length !== 1 ? 's' : ''} found`}
                </div>
              </div>
            </div>
            {validation.errors.length > 0 && (
              <div className="px-5 py-3 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {validation.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-700">{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowValidation(false)}
                className="px-4 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  onClick,
  title,
  icon,
  label,
  accent,
  publish,
  danger,
  disabled,
}: {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  label?: string;
  accent?: boolean;
  publish?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const base = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border';
  const style = publish
    ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
    : accent
    ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
    : danger
    ? 'bg-white text-red-500 border-slate-200 hover:bg-red-50 hover:border-red-200'
    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800';

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`${base} ${style} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {icon}
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
