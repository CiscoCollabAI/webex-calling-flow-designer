import { useState } from 'react';
import {
  X, Link, CheckCircle, XCircle, RefreshCw, LogOut,
  Users, Phone, Clock, MapPin, Loader2, ExternalLink, Eye, EyeOff,
} from 'lucide-react';
import { useOrgData } from '../hooks/useOrgData';

interface ConnectOrgModalProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectOrgModal({ open, onClose }: ConnectOrgModalProps) {
  const {
    connected, isLoading, loadError,
    orgName, userName, userEmail, userAvatar,
    lastSyncedAt, hasWriteScope, counts,
    connect, disconnect, refresh,
  } = useOrgData();

  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  if (!open) return null;

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    await connect(tokenInput.trim());
    setTokenInput('');
  };

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConnect();
    if (e.key === 'Escape') onClose();
  };

  const syncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #00BCF2 0%, #0050A0 100%)' }}
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Link size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold text-sm">Connect Webex Organisation</div>
            <div className="text-white/70 text-xs">Read your org's call flows — publish requires the write scope below</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Connected state ─────────────────────────────────── */}
          {connected ? (
            <>
              {/* Org info card */}
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName ?? ''} className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-sm">
                    {(userName ?? 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-green-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-green-800">Connected</span>
                    {syncedLabel && (
                      <span className="text-xs text-green-600 ml-1">· synced {syncedLabel}</span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-slate-800 truncate mt-0.5">{orgName}</div>
                  <div className="text-xs text-slate-500 truncate">{userEmail}</div>
                </div>
              </div>

              {/* Resource counts */}
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Loaded Resources
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ResourceCount icon={<Users size={14} />} label="Call Queues" count={counts.queues} color="blue" />
                  <ResourceCount icon={<Users size={14} />} label="Agents" count={counts.users} color="green" />
                  <ResourceCount icon={<Clock size={14} />} label="Schedules" count={counts.schedules} color="amber" />
                  <ResourceCount icon={<Phone size={14} />} label="Phone Nos." count={counts.phoneNumbers} color="purple" />
                  <ResourceCount icon={<MapPin size={14} />} label="Locations" count={counts.locations} color="teal" />
                  <ResourceCount icon={<Phone size={14} />} label="Auto Attend." count={counts.autoAttendants} color="slate" />
                </div>
              </div>

              {/* Write scope status */}
              <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
                hasWriteScope === false
                  ? 'bg-amber-50 border-amber-200'
                  : hasWriteScope === true
                  ? 'bg-green-50 border-green-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                {hasWriteScope === false ? (
                  <XCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                ) : hasWriteScope === true ? (
                  <CheckCircle size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <span className={`font-semibold ${
                    hasWriteScope === false ? 'text-amber-800' : hasWriteScope === true ? 'text-green-800' : 'text-slate-600'
                  }`}>
                    {hasWriteScope === false
                      ? 'Write scope not detected — Publish to Webex is disabled'
                      : hasWriteScope === true
                      ? 'Write scope confirmed — Publish to Webex is available'
                      : 'Write scope unknown — Publish will attempt and report any errors'}
                  </span>
                  {hasWriteScope === false && (
                    <p className="text-amber-700 mt-0.5 leading-relaxed">
                      Add <span className="font-mono font-semibold">spark-admin:telephony_config_write</span> to your token scopes, then reconnect.
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={refresh}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                  {isLoading ? 'Refreshing…' : 'Refresh Data'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                >
                  <LogOut size={14} />
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              {/* ── Disconnected state ──────────────────────────── */}

              {/* Instructions */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="text-xs font-semibold text-blue-800 mb-1.5 flex items-center gap-1.5">
                  <span>How to get your Personal Access Token</span>
                </div>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Go to <span className="font-mono font-semibold">developer.webex.com</span></li>
                  <li>Sign in with your Webex admin account</li>
                  <li>Click your avatar → <strong>My Profile</strong></li>
                  <li>Scroll to <strong>Personal Access Token</strong> and copy it</li>
                </ol>
                <a
                  href="https://developer.webex.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Open developer.webex.com <ExternalLink size={11} />
                </a>
              </div>

              {/* Required scopes */}
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Token Scopes
                </div>
                <div className="space-y-1.5">
                  {[
                    { scope: 'spark:people_read',                    desc: 'Read your identity and org ID',                     kind: 'read'  },
                    { scope: 'spark-admin:telephony_config_read',     desc: 'Read queues, auto-attendants, schedules',           kind: 'read'  },
                    { scope: 'spark-admin:telephony_config_write',    desc: 'Create and update queues and auto-attendants',      kind: 'write' },
                    { scope: 'spark-admin:people_read',               desc: 'Resolve agent identities for queue assignment',     kind: 'write' },
                  ].map(({ scope, desc, kind }) => (
                    <div key={scope} className="flex items-start gap-2">
                      <CheckCircle size={13} className={`flex-shrink-0 mt-0.5 ${kind === 'write' ? 'text-amber-500' : 'text-green-500'}`} />
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-slate-700">{scope}</span>
                        <span className={`text-xs font-semibold px-1.5 py-0 rounded ${kind === 'write' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                          {kind}
                        </span>
                        <span className="text-xs text-slate-400 w-full">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  PATs from <span className="font-mono">developer.webex.com</span> include all scopes. Write scopes are needed only when publishing flows back to Webex.
                </p>
              </div>

              {/* Token input */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Personal Access Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste your token here…"
                    autoFocus
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 font-mono text-slate-700 placeholder:text-slate-300 placeholder:font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Token is stored in <strong>session storage only</strong> — cleared when you close the tab.
                </p>
              </div>

              {/* Error message */}
              {loadError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 rounded-xl border border-red-200">
                  <XCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 leading-relaxed">{loadError}</p>
                </div>
              )}

              {/* Connect button */}
              <button
                onClick={handleConnect}
                disabled={isLoading || !tokenInput.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #00BCF2 0%, #0050A0 100%)' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Connecting to Webex…
                  </>
                ) : (
                  <>
                    <Link size={15} />
                    Connect Organisation
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceCount({
  icon, label, count, color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: 'blue' | 'green' | 'amber' | 'purple' | 'teal' | 'slate';
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${colors[color]}`}>
      <span className="opacity-70">{icon}</span>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none">{count}</div>
        <div className="text-xs opacity-70 truncate leading-tight mt-0.5">{label}</div>
      </div>
    </div>
  );
}
