import { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider, type Node, type Edge } from '@xyflow/react';
import { BookmarkCheck, X } from 'lucide-react';
import { Toolbar } from './components/Toolbar';
import { NodePalette } from './components/NodePalette';
import { FlowCanvas } from './components/FlowCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Dashboard } from './components/Dashboard';
import { Homepage } from './components/Homepage';
import { NewFlowModal } from './components/NewFlowModal';
import { DebugApiPanel } from './components/DebugApiPanel';
import { useOrgStore } from './store/orgStore';
import { useFlowStore, getFlowDraft, type FlowDraft, type FlowMeta } from './store/flowStore';
import { createWebexApi } from './api/webexApi';
import { importAutoAttendant } from './utils/importAutoAttendant';
import { importCallQueue } from './utils/importCallQueue';
import type { CanvasMode, NodeData, NodeKind } from './types';
import type { WebexAutoAttendant, WebexQueue, WebexQueueAnnouncementFile } from './types/webex';

export type ViewMode = 'home' | 'dashboard' | 'canvas';

export default function App() {
  const [dragNodeKind, setDragNodeKind]     = useState<NodeKind | null>(null);
  const [paletteOpen, setPaletteOpen]       = useState(true);
  const [view, setView]                     = useState<ViewMode>('home');
  const [openingId, setOpeningId]           = useState<string | null>(null);
  const [canvasMode, setCanvasMode]         = useState<CanvasMode>(null);
  const [showNewFlowModal, setShowNewFlowModal] = useState(false);
  const [newFlowDefaultMode, setNewFlowDefaultMode] = useState<'aa' | 'cq'>('aa');
  const [pendingDraft, setPendingDraft]     = useState<FlowDraft | null>(null);
  // Set true right after the mount effect runs. Combined with isLoading (which
  // connect() sets synchronously, before its first await, if restoreSession found
  // a saved token) this tells us whether a session restore is genuinely in flight —
  // so the very first paint doesn't briefly show the wrong screen (the demo canvas,
  // or the Homepage) before a returning connected user's session resolves.
  const [mounted, setMounted]               = useState(false);

  const restoreSession  = useOrgStore(s => s.restoreSession);
  const connected       = useOrgStore(s => s.connected);
  const sessionLoading  = useOrgStore(s => s.isLoading);
  const token           = useOrgStore(s => s.token);
  const schedules       = useOrgStore(s => s.schedules);
  const announcements   = useOrgStore(s => s.announcements);

  const { setNodes, setEdges, setFlowName, setFlowMeta, setReadOnly, requestFitView, restoreDraft, discardDraft } = useFlowStore();

  // Restore PAT from sessionStorage on mount; also surface any saved draft
  useEffect(() => {
    restoreSession();
    const draft = getFlowDraft();
    if (draft) setPendingDraft(draft);
    setMounted(true);
  }, [restoreSession]);

  const booting = !mounted || sessionLoading;

  // Auto-switch to Dashboard on connect; back to the Homepage on disconnect
  useEffect(() => {
    if (connected) {
      setView('dashboard');
    } else {
      setView('home');
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
      // Rendering a live Webex Calling resource always starts read-only — editing
      // requires the explicit global switch in the Toolbar, never happens implicitly.
      setReadOnly(true);
      requestFitView();
      setCanvasMode(meta.mode);
      setView('canvas');
    } catch (err) {
      console.error(`[Open ${meta.resourceType}]`, err);
    } finally {
      setOpeningId(null);
    }
  }, [token, openingId, setNodes, setEdges, setFlowName, setReadOnly, requestFitView]);

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
      const [detail, nightService, holidayService, strandedCalls, forcedForward, dnis, callForwarding, dnisSettings, queueAnnouncementFiles] = await Promise.all([
        api.getQueueDetail(queue.locationId, queue.id),
        api.getQueueNightService(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueHolidayService(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueStrandedCalls(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueForcedForward(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueDnis(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueCallForwarding(queue.locationId, queue.id).catch(() => undefined),
        api.getQueueDnisSettings(queue.locationId, queue.id).catch(() => undefined),
        // Confirmed empty for at least one real org (see getAnnouncements'
        // announcementNames below) despite that org's queue policies clearly using
        // custom audio — so also try this queue-scoped listing as a second source.
        api.getQueueAnnouncementFiles(queue.locationId, queue.id).catch(() => [] as WebexQueueAnnouncementFile[]),
      ]);
      // Queue policy responses only give each audio file's system-generated
      // fileName (e.g. "1752096982842.wav" — confirmed via real API capture), not
      // necessarily the human-readable name an admin assigned on upload. Two
      // possible sources for a friendlier name: the org-wide Announcement
      // Repository (announcements, loaded once at connect time in orgStore) and
      // this queue's own announcement file listing — merge both (queue-scoped
      // wins on conflict, since it's more precisely targeted) and fall back to the
      // raw fileName if neither has this specific file's id.
      if (announcements.length === 0 && queueAnnouncementFiles.every(f => !f.name)) {
        console.warn('[Webex] No friendly names available from either the org announcement library or this queue\'s own announcement file listing — audio file names will show their raw system-generated fileName. This may be a genuine Webex API limitation for files uploaded this way, not necessarily a bug.');
      }
      const announcementNames = new Map<string, string>(announcements.map(a => [a.id, a.name]));
      for (const f of queueAnnouncementFiles) {
        if (f.id && f.name) announcementNames.set(f.id, f.name);
      }
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

      // Night Service's businessHoursName has no schedule id on its own response —
      // resolve it against the org's schedule list, then fetch its actual hours so
      // the gate node can show them on canvas instead of only its name.
      const bhSchedule = nightService?.nightServiceEnabled
        ? schedules.find(s => s.type === 'businessHours' && s.name === nightService.businessHoursName)
        : undefined;
      if (nightService?.nightServiceEnabled && !bhSchedule) {
        const candidates = schedules.filter(s => s.type === 'businessHours').map(s => s.name);
        console.warn(
          `[Webex] Could not match Night Service's businessHoursName "${nightService.businessHoursName}" ` +
          `against any of the ${candidates.length} businessHours-type schedule(s) this org loaded: ` +
          `${JSON.stringify(candidates)} — hours will show as unresolved.`,
        );
      }
      // Org-level schedules come back from /telephony/config/schedules with no
      // locationId (WebexSchedule.locationId is optional — only location-scoped
      // schedules carry one). Previously requiring bhSchedule.locationId here meant
      // org-level Business Hours schedules silently never resolved their hours
      // (schedule name/timezone still showed fine, since those come straight from
      // the Night Service response, independent of this lookup) — fall back to the
      // queue's own location, which Webex accepts for fetching an org-level schedule.
      const businessHoursScheduleDetail = bhSchedule?.id
        ? await api.getScheduleDetail(bhSchedule.locationId ?? queue.locationId, 'businessHours', bhSchedule.id).catch(() => undefined)
        : undefined;

      const mergedDetail = {
        ...detail,
        locationName: detail.locationName ?? queue.locationName,
        locationId:   detail.locationId   ?? queue.locationId,
      };
      const { nodes, edges } = importCallQueue({ detail: mergedDetail, nightService, holidayService, strandedCalls, forcedForward, dnis, dnisAnnouncements, callForwarding, dnisSettings, schedules, businessHoursScheduleDetail, announcementNames });
      return { name: `${mergedDetail.name} (${suffix})`, nodes, edges };
    },
    { locationId: queue.locationId, resourceId: queue.id, resourceType: mode, mode },
  ), [openResource, token, schedules, announcements]);

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

  if (booting) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white gap-3 fade-in">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-base font-bold animate-pulse"
          style={{ background: 'linear-gradient(135deg, #00BCF2, #0050A0)' }}
        >
          W
        </div>
        <div className="text-xs text-slate-400">Loading CX Flow Designer…</div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen overflow-hidden">

        {view !== 'home' && (
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
        )}

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

        {view === 'home' ? (
          <Homepage
            key="home"
            onStartFromScratch={() => setView('canvas')}
          />
        ) : view === 'dashboard' ? (
          <Dashboard
            key="dashboard"
            onOpenAA={handleOpenAA}
            onOpenQueue={handleOpenQueue}
            onOpenCxQueue={handleOpenCxQueue}
            openingId={openingId}
            onNewAA={handleNewAA}
            onNewCQ={handleNewCQ}
          />
        ) : (
          <div key="canvas" className="flex flex-1 overflow-hidden view-fade-in">
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
