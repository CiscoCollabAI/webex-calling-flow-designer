import { useFlowStore } from '../store/flowStore';
import type { NodeData } from '../types';

// Webex evaluates call queue policies in this fixed order — each one silences
// everything below it when active. Shown only in View mode for imported Call
// Queue / CX Essentials flows, since a hand-built flow (generic Business Hours
// node) has no equivalent Forced Forward / Stranded Calls concept to report on.
//
// Each step's plain-language "what" and "where" is spelled out in its tooltip —
// the four steps live in three different places on canvas (the Business Hours
// gate node, a path off the Start node, and a path off the Queue node), so a
// single line/arrow pointing at "the" node would be misleading. The tooltip
// text is the accurate way to answer "where do I find this."
const STEPS: { key: keyof NodeData; label: string; short: string; what: string; where: string }[] = [
  {
    key: 'cqHasHolidayService', label: 'Holiday', short: 'Holiday Service',
    what: 'Routes calls differently during holidays — highest priority, overrides everything else below.',
    where: 'Shown on the Business Hours gate node (the "Holiday" branch).',
  },
  {
    key: 'cqHasNightService', label: 'Night', short: 'Night Service',
    what: 'Routes calls differently outside business hours — 2nd priority, after Holiday.',
    where: 'Shown on the Business Hours gate node (the "Open"/"Closed" branches).',
  },
  {
    key: 'cqHasForcedForward', label: 'Forced Forward', short: 'Forced Forwarding',
    what: 'An emergency override that redirects every incoming call elsewhere, ignoring all other settings below, until it’s turned off again.',
    where: 'When on: a red path leads from the Start node, and everything else on canvas is dimmed and tagged "Bypassed."',
  },
  {
    key: 'cqHasStrandedPolicy', label: 'Stranded', short: 'Stranded Calls',
    what: 'What happens to a call when no agents are actually reachable — lowest priority, used only as a last resort.',
    where: 'Shown as the "No Agents Available" path leading out of the Queue node.',
  },
];

export function PrecedenceRail() {
  const readOnly = useFlowStore((s) => s.readOnly);
  const resourceType = useFlowStore((s) => s.flowMeta.resourceType);
  const startNode = useFlowStore((s) => s.nodes.find((n) => n.data.kind === 'start'));

  const isImportedQueue = resourceType === 'cq' || resourceType === 'cxe';
  const anyConfigured = STEPS.some((s) => !!startNode?.data[s.key]);

  if (!readOnly || !isImportedQueue || !startNode || !anyConfigured) return null;

  return (
    <div className="absolute top-4 right-4 z-10 bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 max-w-xs">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
        Priority order (highest wins)
      </div>
      <div className="text-[10px] text-slate-400 mb-1.5">
        Hover a step to see what it is and where it is on this canvas.
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {STEPS.map((step, i) => {
          const configured = !!startNode.data[step.key];
          return (
            <div key={step.key} className="flex items-center gap-1.5">
              <div
                className={[
                  'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold cursor-help',
                  configured ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-slate-50 text-slate-400 border border-slate-200',
                ].join(' ')}
                title={`${step.short} — ${configured ? 'configured on this queue' : 'not configured on this queue'}.\n${step.what}\n${step.where}`}
              >
                <span
                  className={[
                    'w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                    configured ? 'bg-violet-600 text-white' : 'bg-slate-300 text-white',
                  ].join(' ')}
                >
                  {i + 1}
                </span>
                {step.label}
              </div>
              {i < STEPS.length - 1 && <span className="text-slate-300 text-xs">›</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
