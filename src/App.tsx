import { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import { BookmarkCheck, X } from 'lucide-react';
import { Toolbar } from './components/Toolbar';
import { NodePalette } from './components/NodePalette';
import { FlowCanvas } from './components/FlowCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Dashboard } from './components/Dashboard';
import { NewFlowModal } from './components/NewFlowModal';
import { DebugApiPanel } from './components/DebugApiPanel';
import { useOrgStore } from './store/orgStore';
import { useFlowStore, getFlowDraft, type FlowDraft, type FlowMeta } from './store/flowStore';
import { createWebexApi } from './api/webexApi';
import { importAutoAttendant } from './utils/importAutoAttendant';
import { importCallQueue } from './utils/importCallQueue';
import type { CanvasMode, NodeData, NodeKind } from './types';
import type { WebexAutoAttendant, WebexQueue } from './types/webex';

export type ViewMode = 'dashboard' | 'canvas';

export default function App() {
  const [dragNodeKind, setDragNodeKind]     = useState<NodeKind | null>(null);
  const [paletteOpen, setPaletteOpen]       = useState(true);
  const [view, setView]                     = useState<ViewMode>('canvas');
  const [openingId, setOpeningId]           = useState<string | null>(null);
  const [canvasMode, setCanvasMode]         = useState<CanvasMode>(null);
  const [showNewFlowModal, setShowNewFlowModal] = useState(false);
  const [newFlowDefaultMode, setNewFlowDefaultMode] = useState<'aa' | 'cq'>('aa');
  const [pendingDraft, setPendingDraft]     = useState<FlowDraft | null>(null);

  const restoreSession = useOrgStore(s => s.restoreSession);
  const connected      = useOrgStore(s => s.connected);
  const token          = useOrgStore(s => s.token);
  const schedules      = useOrgStore(s => s.schedules);

  const { setNodes, setEdges, setFlowName, setFlowMeta, requestFitView, restoreDraft, discardDraft } = useFlowStore();

  // Restore PAT from sessionStorage on mount; also surface any saved draft
  useEffect(() => {
    restoreSession();
    const draft = getFlowDraft();
    if (draft) setPendingDraft(draft);
  }, [restoreSession]);

  // Auto-switch to Dashboard on connect; back to canvas on disconnect
  useEffect(() => {
    if (connected) {
      setView('dashboard');
    } else {
      setView('canvas');
      setCanvasMode(null);
    }
  }, [connected]);

  // ── Draft restore ───────────────────────────────────────────────────────
  const handleRestoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    restoreDraft(pendingDraft);
    setCanvasMode(pendingDraft.canvasMode);
    setView('canvas');
    requestFitView();
    setPendingDraft(null);
  }, [pendingDraft, restoreDraft, requestFitView]);

  const handleDiscardDraft = useCallback(() => {
    discardDraft();
    setPendingDraft(null);
  }, [discardDraft]);

  // ── Shared resource loader ───────────────────────────────────────────────
  // handleOpenAA/handleOpenQueue/handleOpenCxQueue only differ in how they
  // fetch + import a flow; this captures the common open/fit/canvas-switch shell.
  const openResource = useCallback(async (
    id: string,
    loadFlow: () => Promise<{ name: string; nodes: Node<NodeData>[]; edges: Edge[] }>,
    meta: { locationId: string; resourceId: string; resourceType: FlowMeta['resourceType']; mode: CanvasMode },
  ) => {
    if (!token || openingId) return;
    setOpeningId(id);
    try {
      const { name, nodes, edges } = await loadFlow();
      setFlowName(name);
      setNodes(nodes);
      setEdges(edges);
      setFlowMeta({ locationId: meta.locationId, resourceId: meta.resourceId, resourceType: meta.resourceType, isNew: false, lastPublishedAt: null });
      requestFitView();
      setCanvasMode(meta.mode);
      setView('canvas');
    } catch (err) {
      console.error(`[Open ${meta.resourceType}]`, err);
    } finally {
      setOpeningId(null);
    }
  }, [token, openingId, setNodes, setEdges, setFlowName, requestFitView]);

  // ── Open Auto Attendant ──────────────────────────────────────────────────
  const handleOpenAA = useCallback((aa: WebexAutoAttendant) => openResource(
    aa.id,
    async () => {
      const api = createWebexApi(token!);
      const rawDetail = await api.getAutoAttendantDetail(aa.locationId, aa.id);
      const detail = {
        ...rawDetail,
        locationName: rawDetail.locationName ?? aa.locationName,
        locationId:   rawDetail.locationId   ?? aa.locationId,
      };
      const { nodes, edges } = importAutoAttendant(detail, schedules);
      return { name: `${detail.name} (AA)`, nodes, edges };
    },
    { locationId: aa.locationId, resourceId: aa.id, resourceType: 'aa', mode: 'aa' },
  ), [openResource, token, schedules]);

  // ── Open Call Queue / CX Essentials Queue ────────────────────────────────
  const handleOpenQueueLike = useCallback((queue: WebexQueue, suffix: string, mode: 'cq' | 'cxe') => openResource(
    queue.id,
    async () => {
      const api = createWebexApi(token!);
      const [detail, nightService, holidayService, strandedCalls, forcedForward, dnis, callForwarding, dnisSettings] = await Promise.all([
        api.getQueueDetail(queue.locationId, queue.id),
        api.getQueueNightService(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueHolidayService(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueStrandedCalls(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueForcedForward(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueDnis(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueCallForwarding(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueDnisSettings(queue.locationId, queue.id).catch(() => undefined),
      ]);
      // Dependent second round: DNIS announcements only exist per-entry, and only
      // need fetching where customDnisAnnouncementSettingsEnabled is true.
      const dnisWithAnnouncements = (dnis?.dnisList ?? []).filter(d => d.customDnisAnnouncementSettingsEnabled && d.id);
      const dnisAnnouncementPairs = await Promise.all(
        dnisWithAnnouncements.map(d =>
          api.getQueueDnisAnnouncements(queue.locationId, queue.id, d.id!)
            .then(ann => [d.id!, ann] as const)
            .catch(() => [d.id!, undefined] as const),
        ),
      );
      const dnisAnnouncements = Object.fromEntries(dnisAnnouncementPairs);
      const mergedDetail = {
        ...detail,
        locationName: detail.locationName ?? queue.locationName,
        locationId:   detail.locationId   ?? queue.locationId,
      };
      const { nodes, edges } = importCallQueue({ detail: mergedDetail, nightService, holidayService, strandedCalls, forcedForward, dnis, dnisAnnouncements, callForwarding, dnisSettings });
      return { name: `${mergedDetail.name} (${suffix})`, nodes, edges };
    },
    { locationId: queue.locationId, resourceId: queue.id, resourceType: mode, mode },
  ), [openResource, token]);

  const handleOpenQueue = useCallback((queue: WebexQueue) =>
    handleOpenQueueLike(queue, 'CQ', 'cq'), [handleOpenQueueLike]);

  // ── New Flow (from Dashboard "New AA" / "New CQ" buttons) ───────────────
  const handleNewAA = useCallback(() => {
    setNewFlowDefaultMode('aa');
    setShowNewFlowModal(true);
  }, []);

  const handleNewCQ = useCallback(() => {
    setNewFlowDefaultMode('cq');
    setShowNewFlowModal(true);
  }, []);

  const handleNewFlowCreated = useCallback((mode: 'aa' | 'cq') => {
    setCanvasMode(mode);
    setView('canvas');
    setShowNewFlowModal(false);
  }, []);

  // ── Open CX Essentials Queue ─────────────────────────────────────────────
  const handleOpenCxQueue = useCallback((queue: WebexQueue) =>
    handleOpenQueueLike(queue, 'CXE', 'cxe'), [handleOpenQueueLike]);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen overflow-hidden">

        <Toolbar
          view={view}
          onViewChange={setView}
          canvasMode={canvasMode}
          onClearMode={() => setCanvasMode(null)}
          onOpenNewFlow={(defaultMode) => {
            setNewFlowDefaultMode(defaultMode ?? 'aa');
            setShowNewFlowModal(true);
          }}
        />

        {/* ── Draft restore banner ──────────────────────────────────────── */}
        {pendingDraft && (
          <div className="flex items-center justify-between px-6 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0 z-10">
            <div className="flex items-center gap-2 text-xs text-amber-800">
              <BookmarkCheck size={13} className="flex-shrink-0" />
              <span>
                Unsaved draft found —{' '}
                <strong>{pendingDraft.flowName}</strong>
                {' '}saved at{' '}
                {new Date(pendingDraft.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRestoreDraft}
                className="px-3 py-1 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
              >
                Restore Draft
              </button>
              <button
                onClick={handleDiscardDraft}
                title="Dismiss — draft remains in storage until overwritten"
                className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:text-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <X size={12} /> Dismiss
              </button>
            </div>
          </div>
        )}

        {view === 'dashboard' ? (
          <Dashboard
            onOpenAA={handleOpenAA}
            onOpenQueue={handleOpenQueue}
            onOpenCxQueue={handleOpenCxQueue}
            openingId={openingId}
            onNewAA={handleNewAA}
            onNewCQ={handleNewCQ}
          />
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: node palette */}
            <div className={`flex-shrink-0 overflow-hidden transition-all duration-200 ${paletteOpen ? 'w-64' : 'w-10'}`}>
              <NodePalette
                onDragStart={(kind) => setDragNodeKind(kind)}
                collapsed={!paletteOpen}
                onToggleCollapse={() => setPaletteOpen(o => !o)}
                canvasMode={canvasMode}
              />
            </div>

            {/* Center: canvas */}
            <FlowCanvas
              dragNodeKind={dragNodeKind}
              onDragEnd={() => setDragNodeKind(null)}
            />

            {/* Right: properties panel */}
            <div className="flex-shrink-0 overflow-hidden">
              <PropertiesPanel />
            </div>
          </div>
        )}

      </div>

      {/* New Flow modal — opened from Dashboard New AA/CQ buttons */}
      <NewFlowModal
        open={showNewFlowModal}
        onClose={() => setShowNewFlowModal(false)}
        onCreated={handleNewFlowCreated}
        defaultMode={newFlowDefaultMode}
      />

      <DebugApiPanel />
    </ReactFlowProvider>
  );
}
