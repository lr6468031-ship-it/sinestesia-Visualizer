// Port of CalendarHeatmap.generate_calendar_days in beaverhabits/frontend/components.py.
// daya0576/beaverhabits commit 332a453. Copyright (c) 2024 Henry Zhu.
// BSD-3-Clause; see beaverhabits-LICENSE.txt. Uses UTC date arithmetic, Monday first.
export function calendarDays(today, totalWeeks = 12) {
  const date = new Date(today + 'T12:00:00Z');
  const weekday = (date.getUTCDay() + 6) % 7;
  const last = new Date(date); last.setUTCDate(last.getUTCDate() + (6 - weekday));
  return Array.from({length: 7}, (_, row) => Array.from({length: totalWeeks}, (_, col) => {
    const day = new Date(last); day.setUTCDate(day.getUTCDate() - (6-row) - 7*(totalWeeks-1-col));
    return day.toISOString().slice(0,10);
  }));
}
