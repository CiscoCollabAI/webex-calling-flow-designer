import type { BusinessHoursSchedule } from '../types';
import type { WebexScheduleEvent } from '../types/webex';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};
const API_DAY_TO_NAME: Record<string, string> = {
  MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday',
  FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday',
};

const DAY_BOOLEAN_KEYS: { key: keyof NonNullable<NonNullable<WebexScheduleEvent['recurrence']>['recurWeekly']>; name: string }[] = [
  { key: 'monday', name: 'Monday' },
  { key: 'tuesday', name: 'Tuesday' },
  { key: 'wednesday', name: 'Wednesday' },
  { key: 'thursday', name: 'Thursday' },
  { key: 'friday', name: 'Friday' },
  { key: 'saturday', name: 'Saturday' },
  { key: 'sunday', name: 'Sunday' },
];

// Converts a live Webex schedule's weekly recurrence events into this app's
// day/open/start/end shape (the same shape manually-built flows already use),
// so imported and manually-built business-hours nodes render identically.
//
// Handles two possible recurWeekly shapes, since the real one wasn't confirmed
// against a live capture: (1) per-day booleans on one event (e.g. a single
// "Mon-Fri" event with monday/tuesday/.../friday all true) — expanded into one
// BusinessHoursSchedule entry per flagged day; (2) a single scheduleDay string
// per event (one event per day) — kept as a fallback for compatibility.
export function scheduleEventsToBusinessHours(events?: WebexScheduleEvent[]): BusinessHoursSchedule[] {
  if (!events?.length) return [];
  const result: BusinessHoursSchedule[] = [];
  for (const ev of events) {
    const week = ev.recurrence?.recurWeekly;
    if (!week) continue;
    const start = ev.allDayEnabled ? '00:00' : ev.startTime ?? '';
    const end = ev.allDayEnabled ? '23:59' : ev.endTime ?? '';

    const flaggedDays = DAY_BOOLEAN_KEYS.filter((d) => week[d.key]);
    if (flaggedDays.length > 0) {
      for (const d of flaggedDays) {
        result.push({ day: d.name, open: true, start, end });
      }
    } else if (week.scheduleDay) {
      const day = API_DAY_TO_NAME[week.scheduleDay] ?? week.scheduleDay;
      result.push({ day, open: true, start, end });
    }
  }
  return result;
}

// Compact one-line summary for on-canvas display, e.g. "Mon–Fri 08:00–17:00, Sat 09:00–13:00".
// Returns null when there's nothing to summarize (caller should show a fallback).
export function summarizeBusinessHours(hours?: BusinessHoursSchedule[]): string | null {
  if (!hours?.length) return null;

  const byDay = new Map(hours.map((h) => [h.day, h]));
  const ordered = DAY_ORDER.map((d) => byDay.get(d) ?? { day: d, open: false, start: '', end: '' });

  const groups: string[] = [];
  let i = 0;
  while (i < ordered.length) {
    const h = ordered[i];
    if (!h.open || !h.start || !h.end) { i++; continue; }
    let j = i;
    while (
      j + 1 < ordered.length &&
      ordered[j + 1].open &&
      ordered[j + 1].start === h.start &&
      ordered[j + 1].end === h.end
    ) {
      j++;
    }
    const dayLabel = j > i ? `${DAY_ABBR[ordered[i].day]}–${DAY_ABBR[ordered[j].day]}` : DAY_ABBR[ordered[i].day];
    groups.push(`${dayLabel} ${h.start}–${h.end}`);
    i = j + 1;
  }

  return groups.length > 0 ? groups.join(', ') : 'Closed all week';
}
