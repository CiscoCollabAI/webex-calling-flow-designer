import { useState, useEffect } from 'react';
import {
  X, PhoneIncoming, Users, MapPin, FileText,
  ChevronRight, ChevronLeft, Check,
} from 'lucide-react';
import { useFlowStore } from '../store/flowStore';
import { useOrgStore } from '../store/orgStore';

interface NewFlowModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (mode: 'aa' | 'cq') => void;
  defaultMode?: 'aa' | 'cq';
}

const TOTAL_STEPS = 3;

export function NewFlowModal({ open, onClose, onCreated, defaultMode }: NewFlowModalProps) {
  const locations = useOrgStore((s) => s.locations);
  const { newBlankFlow, setFlowMeta, setFlowName } = useFlowStore();

  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState<'aa' | 'cq' | null>(defaultMode ?? null);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [name, setName] = useState(
    defaultMode === 'cq' ? 'New Call Queue' : 'New Auto-Attendant'
  );

  // Reset wizard state every time the modal opens fresh
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedMode(defaultMode ?? null);
      setSelectedLocationId('');
      setName(defaultMode === 'cq' ? 'New Call Queue' : 'New Auto-Attendant');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const handleModeSelect = (mode: 'aa' | 'cq') => {
    setSelectedMode(mode);
    if (name === 'New Auto-Attendant' || name === 'New Call Queue') {
      setName(mode === 'cq' ? 'New Call Queue' : 'New Auto-Attendant');
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleCreate = () => {
    if (!selectedMode || !selectedLocationId || !name.trim()) return;
    newBlankFlow();
    setFlowMeta({
      locationId: selectedLocationId,
      resourceType: selectedMode,
      isNew: true,
      resourceId: null,
      lastPublishedAt: null,
    });
    setFlowName(name.trim());
    onCreated(selectedMode);
    onClose();
  };

  const handleOverlayClick = () => onClose();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const typeName = selectedMode === 'cq' ? 'Call Queue' : 'Auto-Attendant';
  const accentBlue = selectedMode === 'cq' ? false : true;
  const accentClass = accentBlue
    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400'
    : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400';

  const nextDisabled =
    (step === 1 && !selectedMode) ||
    (step === 2 && !selectedLocationId);

  const createDisabled = !name.trim();

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #00BCF2 0%, #0050A0 100%)' }}
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <FileText size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold text-sm">New Flow</div>
            <div className="text-white/70 text-xs">Set up a blank canvas for your call flow</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const n = i + 1;
            const isActive = n === step;
            const isDone = n < step;
            return (
              <div
                key={n}
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? 'w-6 h-2.5 bg-blue-500'
                    : isDone
                    ? 'w-2.5 h-2.5 bg-blue-300'
                    : 'w-2.5 h-2.5 bg-slate-200'
                }`}
              />
            );
          })}
        </div>

        {/* Body */}
        <div className="px-6 pt-4 pb-6 space-y-5">

          {/* ── Step 1: Flow Type ──────────────────────────────────── */}
          {step === 1 && (
            <>
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-3">
                  Choose a flow type
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Auto-Attendant card */}
                  <button
                    type="button"
                    onClick={() => handleModeSelect('aa')}
                    className={`relative text-left p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      selectedMode === 'aa'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-200'
                    }`}
                  >
                    {selectedMode === 'aa' && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check size={11} className="text-white" strokeWidth={3} />
                      </span>
                    )}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                      selectedMode === 'aa' ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                      <PhoneIncoming size={18} className={selectedMode === 'aa' ? 'text-blue-600' : 'text-slate-500'} />
                    </div>
                    <div className={`text-xs font-bold mb-1 ${selectedMode === 'aa' ? 'text-blue-800' : 'text-slate-700'}`}>
                      Auto-Attendant
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      Multi-level IVR with menus, business hours and routing options
                    </div>
                  </button>

                  {/* Call Queue card */}
                  <button
                    type="button"
                    onClick={() => handleModeSelect('cq')}
                    className={`relative text-left p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                      selectedMode === 'cq'
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 bg-white hover:border-indigo-200'
                    }`}
                  >
                    {selectedMode === 'cq' && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <Check size={11} className="text-white" strokeWidth={3} />
                      </span>
                    )}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${
                      selectedMode === 'cq' ? 'bg-indigo-100' : 'bg-slate-100'
                    }`}>
                      <Users size={18} className={selectedMode === 'cq' ? 'text-indigo-600' : 'text-slate-500'} />
                    </div>
                    <div className={`text-xs font-bold mb-1 ${selectedMode === 'cq' ? 'text-indigo-800' : 'text-slate-700'}`}>
                      Call Queue
                    </div>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      Queue callers with routing policies, agent assignment and overflow handling
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Location ───────────────────────────────────── */}
          {step === 2 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={15} className="text-slate-400" />
                  <span className="text-sm font-semibold text-slate-700">
                    Select a Webex Calling location
                  </span>
                </div>

                {locations.length === 0 ? (
                  <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                    <MapPin size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      No locations found — connect your Webex org first
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 cursor-pointer"
                  >
                    <option value="">— Choose a location —</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          {/* ── Step 3: Name ───────────────────────────────────────── */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Name your {typeName}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!createDisabled) handleCreate();
                    }
                    // Stop Escape from bubbling to the overlay (which would close the modal
                    // mid-wizard without navigating to canvas)
                    if (e.key === 'Escape') e.stopPropagation();
                  }}
                  autoFocus
                  className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:border-transparent text-slate-700 placeholder:text-slate-300 ${
                    selectedMode === 'cq' ? 'focus:ring-indigo-400' : 'focus:ring-blue-400'
                  }`}
                  placeholder={`e.g. Main ${typeName}`}
                />
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  This becomes the resource name and the canvas flow name.
                </p>
              </div>
            </>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-1">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <ChevronLeft size={15} />
                  Back
                </button>
              )}
            </div>

            <div>
              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={nextDisabled}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${accentClass}`}
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createDisabled}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${accentClass}`}
                >
                  <Check size={15} />
                  Create {typeName}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
