import { useState } from 'react';
import {
  X, Clock, Calendar, Plus, Trash2,
  Loader2, CheckCircle, XCircle,
} from 'lucide-react';
import { useOrgStore } from '../store/orgStore';
import { createWebexApi } from '../api/webexApi';
import { WebexApiError, type WebexScheduleWriteBody, type WebexScheduleEventWriteBody } from '../types/webex';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScheduleEditorModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (schedule: {
    id: string;
    name: string;
    locationId: string;
    type: 'businessHours' | 'holidays';
  }) => void;
  locationId?: string;
  defaultType?: 'businessHours' | 'holidays';
}

type ScheduleType = 'businessHours' | 'holidays';

// Days of the week in display + API form
interface DayRow {
  label: string;
  apiDay: string;
  open: boolean;
  startTime: string;
  endTime: string;
}

interface HolidayRow {
  id: number;
  name: string;
  date: string;        // "YYYY-MM-DD"
  recurring: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_DAYS: DayRow[] = [
  { label: 'Monday',    apiDay: 'MONDAY',    open: true,  startTime: '08:00', endTime: '18:00' },
  { label: 'Tuesday',   apiDay: 'TUESDAY',   open: true,  startTime: '08:00', endTime: '18:00' },
  { label: 'Wednesday', apiDay: 'WEDNESDAY', open: true,  startTime: '08:00', endTime: '18:00' },
  { label: 'Thursday',  apiDay: 'THURSDAY',  open: true,  startTime: '08:00', endTime: '18:00' },
  { label: 'Friday',    apiDay: 'FRIDAY',    open: true,  startTime: '08:00', endTime: '18:00' },
  { label: 'Saturday',  apiDay: 'SATURDAY',  open: false, startTime: '08:00', endTime: '18:00' },
  { label: 'Sunday',    apiDay: 'SUNDAY',    open: false, startTime: '08:00', endTime: '18:00' },
];

// Build time options: 07:00 → 22:00 in 15-minute increments
function buildTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 7; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 22 && m > 0) break;
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
}

const TIME_OPTIONS = buildTimeOptions();

let holidayIdCounter = 1;

// ── Helper ────────────────────────────────────────────────────────────────────

function parseDateParts(dateStr: string): { day: number; month: number } | null {
  // dateStr = "YYYY-MM-DD"
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[1], 10);
  const day   = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day)) return null;
  return { day, month };
}

// ── Sub-component: compact time select ───────────────────────────────────────

function TimeSelect({
  value, onChange, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`text-xs py-1 px-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 transition-colors ${
        disabled ? 'opacity-40 pointer-events-none' : 'text-slate-700'
      }`}
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScheduleEditorModal({
  open,
  onClose,
  onCreated,
  locationId: locationIdProp,
  defaultType = 'businessHours',
}: ScheduleEditorModalProps) {
  const token     = useOrgStore((s) => s.token);
  const locations = useOrgStore((s) => s.locations);

  // ── Form state ─────────────────────────────────────────────────────────────

  const [activeTab, setActiveTab]         = useState<ScheduleType>(defaultType);
  const [scheduleName, setScheduleName]   = useState('');
  const [selectedLocation, setSelectedLocation] = useState(locationIdProp ?? locations[0]?.id ?? '');
  const [days, setDays]                   = useState<DayRow[]>(DEFAULT_DAYS.map((d) => ({ ...d })));
  const [holidays, setHolidays]           = useState<HolidayRow[]>([]);

  // ── Async / error state ────────────────────────────────────────────────────

  const [isSaving, setIsSaving]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  // ── Derived validation ─────────────────────────────────────────────────────

  const nameIsEmpty  = scheduleName.trim() === '';
  const locationId   = locationIdProp ?? selectedLocation;

  const atLeastOneDayOpen = days.some((d) => d.open);
  const atLeastOneHoliday = holidays.length > 0 && holidays.every((h) => h.name.trim() !== '' && h.date !== '');

  const canSave =
    !nameIsEmpty &&
    !!locationId &&
    !isSaving &&
    (activeTab === 'businessHours' ? atLeastOneDayOpen : atLeastOneHoliday);

  // ── Validation messages ────────────────────────────────────────────────────

  const validationMessage = (() => {
    if (nameIsEmpty) return 'Schedule name is required.';
    if (!locationId) return 'Please select a location.';
    if (activeTab === 'businessHours' && !atLeastOneDayOpen)
      return 'At least one day must be open.';
    if (activeTab === 'holidays') {
      if (holidays.length === 0) return 'Add at least one holiday.';
      const incomplete = holidays.find((h) => h.name.trim() === '' || h.date === '');
      if (incomplete) return 'All holidays need a name and date.';
    }
    return null;
  })();

  // ── Day row helpers ────────────────────────────────────────────────────────

  const updateDay = (idx: number, patch: Partial<DayRow>) => {
    setDays((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // ── Holiday helpers ────────────────────────────────────────────────────────

  const addHoliday = () => {
    setHolidays((prev) => [
      ...prev,
      { id: holidayIdCounter++, name: '', date: '', recurring: true },
    ]);
  };

  const updateHoliday = (id: number, patch: Partial<HolidayRow>) => {
    setHolidays((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    );
  };

  const removeHoliday = (id: number) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!canSave || !token) return;

    setError(null);
    setIsSaving(true);

    try {
      let events: WebexScheduleEventWriteBody[] = [];

      if (activeTab === 'businessHours') {
        events = days
          .filter((d) => d.open)
          .map((d): WebexScheduleEventWriteBody => ({
            name: d.label,
            startTime: d.startTime,
            endTime: d.endTime,
            allDayEnabled: false,
            recurrence: {
              recurForEver: true,
              recurWeekly: { scheduleDay: d.apiDay },
            },
          }));
      } else {
        events = holidays.map((h): WebexScheduleEventWriteBody => {
          const parts = parseDateParts(h.date);
          return {
            name: h.name.trim(),
            allDayEnabled: true,
            recurrence: h.recurring && parts
              ? {
                  recurForEver: true,
                  recurAnnuallyByDay: { day: parts.day, month: parts.month },
                }
              : { recurForEver: false },
          };
        });
      }

      const body: WebexScheduleWriteBody = {
        name: scheduleName.trim(),
        type: activeTab,
        events,
      };

      const api = createWebexApi(token);
      const result = await api.createSchedule(locationId, body);
      await useOrgStore.getState().refresh();

      setSuccess(true);

      // Brief success flash then close
      setTimeout(() => {
        onCreated({
          id: result.id,
          name: scheduleName.trim(),
          locationId,
          type: activeTab,
        });
        onClose();
      }, 800);
    } catch (err) {
      setError(
        err instanceof WebexApiError
          ? err.message
          : 'Failed to create schedule. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Tab switch: reset per-tab state ───────────────────────────────────────

  const handleTabSwitch = (tab: ScheduleType) => {
    setActiveTab(tab);
    setError(null);
  };

  // ── Keyboard dismiss ──────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            {activeTab === 'businessHours'
              ? <Clock size={18} className="text-white" />
              : <Calendar size={18} className="text-white" />
            }
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold text-sm">Create Schedule</div>
            <div className="text-white/70 text-xs">Define business hours or holidays for this location</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-white" />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {/* Location selector — only when locationId not provided as prop */}
          {!locationIdProp && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Location
              </label>
              {locations.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No locations loaded. Connect your Webex org first.
                </p>
              ) : (
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-slate-700"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Type tabs */}
          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
            {(['businessHours', 'holidays'] as ScheduleType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabSwitch(tab)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-white text-amber-700 shadow-sm border border-amber-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'businessHours'
                  ? <><Clock size={13} />Business Hours</>
                  : <><Calendar size={13} />Holidays</>
                }
              </button>
            ))}
          </div>

          {/* Schedule name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Schedule Name
            </label>
            <input
              type="text"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              placeholder={
                activeTab === 'businessHours'
                  ? 'e.g. Standard Business Hours'
                  : 'e.g. Public Holidays 2025'
              }
              autoFocus
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-slate-700 placeholder:text-slate-300"
            />
          </div>

          {/* ── Business Hours tab content ───────────────────────────────────── */}
          {activeTab === 'businessHours' && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Opening Hours
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                {days.map((day, idx) => (
                  <div
                    key={day.apiDay}
                    className={`flex items-center gap-3 px-3 py-2.5 ${
                      idx < days.length - 1 ? 'border-b border-slate-100' : ''
                    } ${day.open ? 'bg-white' : 'bg-slate-50'}`}
                  >
                    {/* Open / closed toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none min-w-0">
                      <input
                        type="checkbox"
                        checked={day.open}
                        onChange={(e) => updateDay(idx, { open: e.target.checked })}
                        className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                      />
                    </label>

                    {/* Day label */}
                    <span
                      className={`text-sm w-24 flex-shrink-0 ${
                        day.open ? 'font-medium text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {day.label}
                    </span>

                    {/* Time range */}
                    {day.open ? (
                      <div className="flex items-center gap-1.5 flex-1 justify-end">
                        <TimeSelect
                          value={day.startTime}
                          onChange={(v) => updateDay(idx, { startTime: v })}
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <TimeSelect
                          value={day.endTime}
                          onChange={(v) => updateDay(idx, { endTime: v })}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 text-right">
                        <span className="text-xs text-slate-400 italic">Closed</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Holidays tab content ─────────────────────────────────────────── */}
          {activeTab === 'holidays' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Holiday Entries
                </span>
                <button
                  onClick={addHoliday}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Plus size={12} />
                  Add Holiday
                </button>
              </div>

              {holidays.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 flex flex-col items-center gap-2 text-slate-400">
                  <Calendar size={22} className="opacity-50" />
                  <span className="text-xs">No holidays added yet — click Add Holiday to start</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {holidays.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-xl bg-white"
                    >
                      {/* Holiday name */}
                      <input
                        type="text"
                        value={h.name}
                        onChange={(e) => updateHoliday(h.id, { name: e.target.value })}
                        placeholder="Holiday name"
                        className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 text-slate-700 placeholder:text-slate-300 min-w-0"
                      />

                      {/* Date */}
                      <input
                        type="date"
                        value={h.date}
                        onChange={(e) => updateHoliday(h.id, { date: e.target.value })}
                        className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 text-slate-700 flex-shrink-0"
                      />

                      {/* Recurring checkbox */}
                      <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer flex-shrink-0 select-none">
                        <input
                          type="checkbox"
                          checked={h.recurring}
                          onChange={(e) => updateHoliday(h.id, { recurring: e.target.checked })}
                          className="w-3 h-3 accent-amber-500 cursor-pointer"
                        />
                        Yearly
                      </label>

                      {/* Remove */}
                      <button
                        onClick={() => removeHoliday(h.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                        title="Remove holiday"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Error / success messages ─────────────────────────────────────── */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 rounded-xl border border-red-200">
              <XCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 p-3.5 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-700 font-medium">Schedule created successfully!</p>
            </div>
          )}

          {/* Inline validation hint — shown only when form is dirty but invalid */}
          {!canSave && !success && validationMessage && scheduleName !== '' && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {validationMessage}
            </p>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="flex gap-2.5 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <CheckCircle size={14} />
                Create Schedule
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
