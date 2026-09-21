import { useState } from 'react';
import { PhoneIncoming, Users, Headphones, ArrowRight, GitBranch } from 'lucide-react';
import { ConnectOrgModal } from './ConnectOrgModal';

interface HomepageProps {
  onStartFromScratch: () => void;
}

const FEATURES: { Icon: React.ElementType; title: string; body: string }[] = [
  {
    Icon: PhoneIncoming,
    title: 'Render real configs',
    body: 'Open any Auto Attendant or Call Queue from your org and see its actual call flow as a diagram, not a settings form.',
  },
  {
    Icon: GitBranch,
    title: 'Build from scratch',
    body: 'Drag nodes onto a blank canvas to design a new flow before it exists in Webex at all.',
  },
  {
    Icon: Headphones,
    title: 'Publish back to Webex',
    body: 'Edit a rendered flow — explicitly, via a global switch — and publish the changes to your live org.',
  },
];

// Shown when disconnected, replacing what used to be a demo canvas by default.
// Two ways in, both real capabilities this app already has: connect to browse a
// real org's flows, or start building one locally without connecting at all.
export function Homepage({ onStartFromScratch }: HomepageProps) {
  const [showConnectModal, setShowConnectModal] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto bg-white view-fade-in">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-base font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #00BCF2, #0050A0)' }}
          >
            W
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 leading-tight">Webex Calling</div>
            <div className="text-xs text-slate-400 leading-tight">CX Flow Designer</div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-3 text-balance">
          See your Webex Calling flows, not just their settings
        </h1>
        <p className="text-base text-slate-500 leading-relaxed mb-10 max-w-xl">
          CX Flow Designer turns Auto Attendant and Call Queue configuration into a visual
          diagram — Night Service, Holiday Service, Overflow, and every branch a caller can
          take, laid out the way it actually runs.
        </p>

        <div className="flex items-center gap-3 mb-14">
          <button
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow transition-shadow"
            style={{ background: 'linear-gradient(135deg, #00BCF2, #0050A0)' }}
          >
            Connect your Webex org
            <ArrowRight size={15} />
          </button>
          <button
            onClick={onStartFromScratch}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            Start building from scratch
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title}>
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center mb-3">
                <Icon size={16} className="text-sky-600" />
              </div>
              <div className="text-sm font-semibold text-slate-800 mb-1">{title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{body}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-14 pt-6 border-t border-slate-100 text-xs text-slate-400">
          <Users size={12} />
          Needs a Webex admin token with the telephony config read scope — nothing is sent
          anywhere except Webex's own API.
        </div>
      </div>

      <ConnectOrgModal open={showConnectModal} onClose={() => setShowConnectModal(false)} />
    </div>
  );
}
