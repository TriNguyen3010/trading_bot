import type { ConditionRow } from '@/types/builder.types';

/**
 * Bundle a flat list of conditions into visual groups based on the
 * `operator` field of each row (the join with the PREVIOUS row).
 *
 * - The first row always starts a new group.
 * - Each subsequent row with `operator === 'OR'` appends to the current
 *   group (continuing the OR chain).
 * - Each subsequent row with `operator === 'AND'` (or missing) starts a
 *   new group.
 *
 * The data model stays flat — this is a render-time view computation
 * used by `ConditionBuilder` to decide which rows share a sub-container
 * border (OR-group emphasis) and which stand alone.
 */
export function groupConsecutiveOr(rows: ConditionRow[]): ConditionRow[][] {
  if (rows.length === 0) return [];
  const groups: ConditionRow[][] = [[rows[0]]];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].operator === 'OR') {
      groups[groups.length - 1].push(rows[i]);
    } else {
      groups.push([rows[i]]);
    }
  }
  return groups;
}
