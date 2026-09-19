import { Plug, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useOrgData } from '../hooks/useOrgData';

interface OrgBadgeProps {
  onClick: () => void;
}

export function OrgBadge({ onClick }: OrgBadgeProps) {
  const { connected, isLoading, loadError, orgName, refresh } = useOrgData();

  if (isLoading) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-xs font-medium transition-colors"
      >
        <Loader2 size={13} className="animate-spin" />
        <span className="hidden sm:inline">Connecting…</span>
      </button>
    );
  }

  if (loadError && !connected) {
    return (
      <button
        onClick={onClick}
        title={loadError}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
      >
        <AlertCircle size={13} />
        <span className="hidden sm:inline">Connection Error</span>
      </button>
    );
  }

  if (connected && orgName) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={onClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors group max-w-40"
          title={`Connected to ${orgName} — click to manage`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
          <span className="truncate hidden sm:block">{orgName}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); refresh(); }}
          title="Refresh org data"
          className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center transition-colors"
        >
          <RefreshCw size={12} />
        </button>
      </div>
    );
  }

  // Disconnected default state
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all"
    >
      <Plug size={13} />
      <span className="hidden sm:inline">Connect Org</span>
    </button>
  );
}
