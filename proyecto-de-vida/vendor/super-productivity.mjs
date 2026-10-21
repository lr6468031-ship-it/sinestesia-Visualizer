// From super-productivity/super-productivity, src/app/ui/duration/ms-to-clock-string.pipe.ts.
// Commit 7183763. Copyright (c) 2018 Johannes Millan. MIT.
// Type annotations and Angular wrapper removed. See super-productivity-LICENSE.txt.
export const msToClockString = (value, showSeconds, isHideEmptyPlaceholder) => {
  const totalMs = Number(value) || 0;
  const totalSeconds = Math.floor(Math.abs(totalMs) / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours, minutes = totalMinutes % 60, seconds = totalSeconds % 60;
  const sign = totalMs < 0 ? '-' : '';
  const parsed = sign + hours + ':' + ('00' + minutes).slice(-2) + (showSeconds ? ':' + ('00' + seconds).slice(-2) : '');
  if (!isHideEmptyPlaceholder && parsed.trim() === '0:00') return '-';
  return parsed.trim();
};
