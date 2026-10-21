// Adapted from lifeos-app/lifeos src/lib/progression.ts, commit 3009bf6.
// Copyright (c) 2026 LifeOS Contributors. MIT; see lifeos-LICENSE.txt.
// Pure local adapter: the upstream uses Supabase queries for these aggregates.
export function goalProgress(tasks) {
  if (!tasks.length) return 0;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  return doneCount / tasks.length;
}
export function objectiveProgress(goals) {
  return goals.length ? goals.reduce((sum,g) => sum + (g.progress || 0), 0) / goals.length : 0;
}
