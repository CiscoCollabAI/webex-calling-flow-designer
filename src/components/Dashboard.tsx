import { useState, useMemo } from 'react';
import {
  PhoneIncoming, Users, Headphones, RefreshCw, Building2, Clock,
  Search, ExternalLink, Loader2, Info, ScanLine, Plus,
} from 'lucide-react';
import { useOrgData } from '../hooks/useOrgData';
import type { WebexAutoAttendant, WebexQueue } from '../types/webex';

type Tab = 'aa' | 'cq' | 'cxe';

const TAB_CONFIG: Record<Tab, {
  label: string;
  Icon: React.ElementType;
  activeColor: string;
  activeBg: string;
  description: string;
}> = {
  aa: {
    label: 'Auto Attendants',
    Icon: PhoneIncoming,
    activeColor: 'text-blue-600 border-blue-600',
    activeBg: 'text-blue-600',
    description: 'IVR menus and greeting flows — routes callers with DTMF keypresses and business-hours schedules.',
  },
  cq: {
    label: 'Call Queues',
    Icon: Users,
    activeColor: 'text-indigo-600 border-indigo-600',
    activeBg: 'text-indigo-600',
    description: 'Agent queues — holds callers until an agent is available, with overflow and holiday handling.',
  },
  cxe: {
    label: 'CX Essentials',
    Icon: Headphones,
    activeColor: 'text-violet-600 border-violet-600',
    activeBg: 'text-violet-600',
    description: 'Webex Customer Experience Essentials — opens queues with enhanced CX canvas: skills routing, wrap-up, post-call survey and digital handoff nodes available.',
  },
};

interface Props {
  onOpenAA:       (aa: WebexAutoAttendant) => void;
  onOpenQueue:    (queue: WebexQueue) => void;
  onOpenCxQueue:  (queue: WebexQueue) => void;
  openingId: string | null;
  onNewAA?: () => void;
  onNewCQ?: () => void;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export function Dashboard({ onOpenAA, onOpenQueue, onOpenCxQueue, openingId, onNewAA, onNewCQ }: Props) {
  const {
    orgName, userName, userAvatar, lastSyncedAt,
    autoAttendants, queues, refresh, isLoading, counts, hasWriteScope,
    cxQueues, cxScanStatus, cxScanned, cxTotal, scanCxQueues,
  } = useOrgData();

  const [activeTab, setActiveTab] = useState<Tab>('aa');
  const [search, setSearch] = useState('');

  // Reset search when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearch('');
  };

  const filteredAAs = useMemo(
    () => autoAttendants.filter(a =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.locationName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (a.extension ?? '').includes(search) ||
      (a.phoneNumber ?? '').includes(search),
    ),
    [autoAttendants, search],
  );

  const filteredQueues = useMemo(
    () => queues.filter(q =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      (q.locationName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (q.extension ?? '').includes(search) ||
      (q.phoneNumber ?? '').includes(search),
    ),
    [queues, search],
  );

  const filteredCxQueues = useMemo(
    () => cxQueues.filter(q =>
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      (q.locationName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (q.extension ?? '').includes(search) ||
      (q.phoneNumber ?? '').includes(search),
    ),
    [cxQueues, search],
  );

  const tab = TAB_CONFIG[activeTab];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 flex flex-col">

      {/* ── Org header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {userAvatar ? (
              <img src={userAvatar} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={16} className="text-blue-600" />
              </div>
            )}
            <div>
              <div className="font-semibold text-slate-800 text-sm">{orgName ?? 'Webex Org'}</div>
              <div className="text-xs text-slate-400">{userName}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock size={12} />
              <span>Synced {timeAgo(lastSyncedAt)}</span>
            </div>
            <button
              onClick={() => refresh()}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-8 py-2.5 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-6 flex-wrap">
          {[
            { label: 'Auto Attendants', value: counts.autoAttendants, color: 'text-blue-600' },
            { label: 'Call Queues',     value: counts.queues,         color: 'text-indigo-600' },
            { label: 'CX Essentials',   value: cxScanStatus === 'done' ? cxQueues.length : '—', color: 'text-violet-600' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature tabs ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-8">
          <div className="flex gap-0">
            {(['aa', 'cq', 'cxe'] as Tab[]).map((t) => {
              const cfg = TAB_CONFIG[t];
              const isActive = activeTab === t;
              return (
                <button
                  key={t}
                  onClick={() => handleTabChange(t)}
                  className={[
                    'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all',
                    isActive
                      ? cfg.activeColor
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  <cfg.Icon size={14} />
                  {cfg.label}
                  <span className={[
                    'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                    isActive ? `bg-current/10 ${cfg.activeBg}` : 'bg-slate-100 text-slate-500',
                  ].join(' ')}>
                    {t === 'aa' ? counts.autoAttendants : counts.queues}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-8 py-5">

        {/* Feature description banner */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-white border border-slate-200 mb-4 shadow-sm">
          <Info size={14} className="flex-shrink-0 mt-0.5 text-slate-400" />
          <p className="text-xs text-slate-500 leading-relaxed">{tab.description}</p>
        </div>

        {/* Search + New button */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${tab.label.toLowerCase()}…`}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white shadow-sm"
            />
          </div>
          {activeTab === 'aa' && onNewAA && hasWriteScope !== false && (
            <button
              onClick={onNewAA}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors flex-shrink-0"
              title="Create a new Auto-Attendant"
            >
              <Plus size={13} />
              <span>New AA</span>
            </button>
          )}
          {activeTab === 'cq' && onNewCQ && hasWriteScope !== false && (
            <button
              onClick={onNewCQ}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-colors flex-shrink-0"
              title="Create a new Call Queue"
            >
              <Plus size={13} />
              <span>New CQ</span>
            </button>
          )}
        </div>

        {/* Resource list */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50 max-h-[calc(100vh-380px)] overflow-y-auto">
            {activeTab === 'aa' && (
              filteredAAs.length === 0
                ? <EmptyRow message={search ? 'No results match your search.' : 'No Auto Attendants found in this org.'} />
                : filteredAAs.map(aa => (
                    <ResourceRow
                      key={aa.id}
                      name={aa.name}
                      location={aa.locationName}
                      phone={aa.phoneNumber}
                      extension={aa.extension}
                      enabled={aa.enabled !== false}
                      opening={openingId === aa.id}
                      mode="aa"
                      onOpen={() => onOpenAA(aa)}
                    />
                  ))
            )}

            {activeTab === 'cq' && (
              filteredQueues.length === 0
                ? <EmptyRow message={search ? 'No results match your search.' : 'No Call Queues found in this org.'} />
                : filteredQueues.map(q => (
                    <ResourceRow
                      key={q.id}
                      name={q.name}
                      location={q.locationName}
                      phone={q.phoneNumber}
                      extension={q.extension}
                      enabled={q.enabled !== false}
                      opening={openingId === q.id}
                      mode="cq"
                      onOpen={() => onOpenQueue(q)}
                    />
                  ))
            )}

            {activeTab === 'cxe' && (
              cxScanStatus === 'idle' ? (
                <CxScanPrompt onScan={scanCxQueues} total={cxTotal} />
              ) : cxScanStatus === 'scanning' ? (
                <CxScanProgress scanned={cxScanned} total={cxTotal} />
              ) : filteredCxQueues.length === 0 ? (
                <EmptyRow message={search ? 'No CX queues match your search.' : 'No CX Essentials queues found. All queues use standard features only.'} />
              ) : (
                filteredCxQueues.map(q => (
                  <ResourceRow
                    key={q.id}
                    name={q.name}
                    location={q.locationName}
                    phone={q.phoneNumber}
                    extension={q.extension}
                    enabled={q.enabled !== false}
                    opening={openingId === q.id}
                    mode="cxe"
                    onOpen={() => onOpenCxQueue(q)}
                  />
                ))
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── ResourceRow ───────────────────────────────────────────────────────────────

const OPEN_BTN_STYLES: Record<Tab, string> = {
  aa:  'bg-blue-600   hover:bg-blue-700',
  cq:  'bg-indigo-600 hover:bg-indigo-700',
  cxe: 'bg-violet-600 hover:bg-violet-700',
};

interface RowProps {
  name: string;
  location?: string;
  phone?: string;
  extension?: string;
  enabled: boolean;
  opening: boolean;
  mode: Tab;
  onOpen: () => void;
}

function ResourceRow({ name, location, phone, extension, enabled, opening, mode, onOpen }: RowProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${enabled ? 'bg-green-400' : 'bg-amber-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {location  && <span className="text-xs text-slate-400">{location}</span>}
          {phone     && <span className="text-xs text-slate-400 font-mono">{phone}</span>}
          {extension && <span className="text-xs text-slate-400 font-mono">Ext: {extension}</span>}
          {!enabled  && (
            <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full">
              Disabled
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onOpen}
        disabled={opening}
        className={[
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all flex-shrink-0',
          opening
            ? 'bg-slate-300 cursor-wait'
            : `${OPEN_BTN_STYLES[mode]} opacity-0 group-hover:opacity-100 focus:opacity-100`,
        ].join(' ')}
      >
        {opening
          ? <><Loader2 size={11} className="animate-spin" /> Opening…</>
          : <><ExternalLink size={11} /> Open</>}
      </button>
    </div>
  );
}

function CxScanPrompt({ onScan, total }: { onScan: () => void; total: number }) {
  return (
    <div className="px-5 py-10 flex flex-col items-center gap-4 text-center">
      <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center">
        <ScanLine size={22} className="text-violet-500" />
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-700 mb-1">Scan for CX Essentials queues</div>
        <div className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Checks each of the {total} queue{total !== 1 ? 's' : ''} for advanced features like skills routing, wrap-up timer, post-call survey and digital handoff.
        </div>
      </div>
      <button
        onClick={onScan}
        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors"
      >
        <ScanLine size={13} />
        Scan Queues
      </button>
    </div>
  );
}

function CxScanProgress({ scanned, total }: { scanned: number; total: number }) {
  const pct = total > 0 ? Math.round((scanned / total) * 100) : 0;
  return (
    <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
      <Loader2 size={22} className="text-violet-500 animate-spin" />
      <div className="text-sm font-medium text-slate-700">Scanning queues…</div>
      <div className="w-48">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-slate-400 mt-1.5">{scanned} / {total} checked</div>
      </div>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-5 py-10 text-center text-xs text-slate-400">{message}</div>
  );
}
