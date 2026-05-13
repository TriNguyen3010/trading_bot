import type {
  ConditionGroup,
  ConditionGroupNode,
  ConditionRow,
  ConditionRule,
  ConditionTree,
} from '@/types/builder.types';
import type {
  ConditionListItem,
  SignalGroup,
} from '@/schemas/strategy.schema';

// ────────────────────────────────────────────────────────────────────────────
// BE list items can be plain conditions OR nested `{type:'group', ...}` groups.
// Helpers below let us serialize FE tree → BE format, parse BE → FE tree, and
// migrate the legacy flat `ConditionGroup` to the new tree shape.
// ────────────────────────────────────────────────────────────────────────────

type BEGroupItem = Extract<ConditionListItem, { type: 'group' }>;
type BEPlainItem = Exclude<ConditionListItem, { type: 'group' }>;

function isBEGroupItem(item: ConditionListItem): item is BEGroupItem {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'group';
}

let idSeq = 0;
function newId(prefix: 'g' | 'r'): string {
  idSeq += 1;
  return `${prefix}-${idSeq}-${Date.now().toString(36)}`;
}

// Test seam: reset the counter so id snapshots are stable.
export function __resetIdSeq(): void {
  idSeq = 0;
}

function ruleToBE(rule: ConditionRule): BEPlainItem {
  const out: BEPlainItem = {
    left: rule.left,
    op: rule.op,
    right_type: rule.right_type,
    right_number: rule.right_type === 'number' ? rule.right_number : null,
    right_indicator:
      rule.right_type === 'indicator' ? rule.right_indicator : null,
    lookback: rule.lookback,
  };
  if (rule.percentage !== undefined) out.percentage = rule.percentage;
  return out;
}

function beItemToRule(item: BEPlainItem): ConditionRule {
  return {
    id: newId('r'),
    left: item.left,
    op: item.op,
    right_type: item.right_type,
    right_number: item.right_number,
    right_indicator: item.right_indicator,
    lookback: item.lookback ?? 0,
    ...(item.percentage !== undefined ? { percentage: item.percentage } : {}),
  };
}

/**
 * FE `ConditionTree` → BE `SignalGroup`.
 *
 * - Single-rule groups flatten to plain conditions (no `{type:'group'}` wrap).
 * - Multi-rule groups wrap as `{type:'group', conditions:[...], operator?}`.
 * - First item in any list has NO `operator`; subsequent items carry the
 *   relevant intra-group / inter-group connector.
 */
export function serializeTreeToBE(tree: ConditionTree): SignalGroup {
  const items: ConditionListItem[] = tree.groups.map((group, gi) => {
    const groupOperator: 'AND' | 'OR' | undefined =
      gi === 0 ? undefined : tree.groupConnector;

    if (group.rules.length === 1) {
      const item: BEPlainItem = ruleToBE(group.rules[0]);
      if (groupOperator) item.operator = groupOperator;
      return item;
    }

    const wrappedRules: BEPlainItem[] = group.rules.map((rule, ri) => {
      const item = ruleToBE(rule);
      if (ri > 0) item.operator = group.intraConnector;
      return item;
    });
    const wrap: BEGroupItem = { type: 'group', conditions: wrappedRules };
    if (groupOperator) wrap.operator = groupOperator;
    return wrap;
  });

  return {
    logic: { type: tree.groupConnector, threshold: null },
    conditions: items,
  };
}

function flattenBENested(items: ConditionListItem[]): ConditionRule[] {
  const rules: ConditionRule[] = [];
  for (const item of items) {
    if (isBEGroupItem(item)) {
      rules.push(...flattenBENested(item.conditions));
    } else {
      rules.push(beItemToRule(item));
    }
  }
  return rules;
}

function detectIntraConnector(items: ConditionListItem[]): 'AND' | 'OR' {
  for (const item of items) {
    if (!isBEGroupItem(item) && item.operator) return item.operator;
  }
  return 'AND';
}

/**
 * BE `SignalGroup` → FE `ConditionTree` (1-level UI projection).
 *
 * Strategy for the flat case (`[A, B op=AND, C op=OR, D op=OR, E op=AND]`):
 *   group1 = (AND: A, B)
 *   group2 = (OR: C, D)
 *   group3 = (AND: E)        ← single rule, default intra='AND'
 *   tree.groupConnector  = operator at the FIRST group boundary ('OR' here)
 *
 * For nested groups (`{type:'group', conditions:[...]}`): the group becomes
 * one FE group; deeper nesting is flattened by concatenating rules with the
 * outermost-detected intra-connector. This is lossy by design — the mockup
 * exposes only one level.
 */
export function deserializeBEToTree(group: SignalGroup): ConditionTree {
  const items = group.conditions ?? [];
  if (items.length === 0) {
    return { groupConnector: group.logic?.type ?? 'AND', groups: [] };
  }

  const groups: ConditionGroupNode[] = [];
  let buffer: ConditionRule[] = [];
  let bufferOperator: 'AND' | 'OR' = 'AND';
  let interOperator: 'AND' | 'OR' = group.logic?.type ?? 'AND';
  let interSet = false;

  const flushBuffer = (): void => {
    if (buffer.length === 0) return;
    groups.push({
      id: newId('g'),
      intraConnector: bufferOperator,
      rules: buffer,
    });
    buffer = [];
    bufferOperator = 'AND';
  };

  const recordInterBoundary = (op: 'AND' | 'OR' | undefined): void => {
    if (!interSet && op) {
      interOperator = op;
      interSet = true;
    }
  };

  items.forEach((item, idx) => {
    const itemOp: 'AND' | 'OR' | undefined =
      idx === 0 ? undefined : (item as BEPlainItem).operator ?? 'AND';

    if (isBEGroupItem(item)) {
      flushBuffer();
      const innerRules = flattenBENested(item.conditions);
      const intra = detectIntraConnector(item.conditions);
      groups.push({
        id: newId('g'),
        intraConnector: intra,
        rules: innerRules,
      });
      if (idx > 0) recordInterBoundary(item.operator);
      return;
    }

    // Plain item path.
    if (buffer.length === 0) {
      buffer.push(beItemToRule(item));
      return;
    }
    if (buffer.length === 1) {
      // The 2nd item's operator defines the group's intra connector.
      bufferOperator = itemOp ?? 'AND';
      buffer.push(beItemToRule(item));
      return;
    }
    if (itemOp === bufferOperator) {
      buffer.push(beItemToRule(item));
    } else {
      flushBuffer();
      recordInterBoundary(itemOp);
      buffer.push(beItemToRule(item));
    }
  });
  flushBuffer();

  return { groupConnector: interOperator, groups };
}

/**
 * Migrate the legacy FE `ConditionGroup` (flat list with per-row operators)
 * to the new `ConditionTree`. The legacy shape mirrors the BE flat shape, so
 * we delegate to `deserializeBEToTree` — rows become plain BE items first,
 * then the deserializer splits them into groups using consecutive-run logic.
 */
export function migrateLegacyGroup(legacy: ConditionGroup): ConditionTree {
  const items: BEPlainItem[] = legacy.conditions.map(
    (row: ConditionRow): BEPlainItem => {
      const item: BEPlainItem = {
        left: row.left,
        op: row.op,
        right_type: row.right_type,
        right_number: row.right_number,
        right_indicator: row.right_indicator,
        lookback: row.lookback,
      };
      if (row.percentage !== undefined) item.percentage = row.percentage;
      if (row.operator) item.operator = row.operator;
      return item;
    },
  );
  return deserializeBEToTree({
    logic: { type: legacy.logic.type, threshold: legacy.logic.threshold },
    conditions: items,
  });
}

/** Convenience: build an empty tree (used by store defaults). */
export function emptyConditionTree(): ConditionTree {
  return { groupConnector: 'AND', groups: [] };
}

/** Flatten every rule from every group into a single ordered list. */
export function allRules(tree: ConditionTree): ConditionRule[] {
  return tree.groups.flatMap((g) => g.rules);
}

/** Convenience: total rule count across all groups. */
export function ruleCount(tree: ConditionTree): number {
  return tree.groups.reduce((sum, g) => sum + g.rules.length, 0);
}

/**
 * Lossy projection back to the legacy `ConditionGroup` shape: emits all
 * rules in order with per-row operators that reflect the tree's
 * intra/inter connectors. Useful for code paths that still expect the
 * flat list (templates, narrative summaries) until Phase 5 sweeps them.
 *
 * NOTE: this collapses multi-group structure if reparsed — round-trip
 * through `migrateLegacyGroup` will NOT necessarily reproduce the
 * original group boundaries.
 */
export function flattenTreeToLegacy(tree: ConditionTree): ConditionGroup {
  const conditions: ConditionRow[] = [];
  tree.groups.forEach((group, gi) => {
    group.rules.forEach((rule, ri) => {
      const operator: 'AND' | 'OR' | undefined =
        gi === 0 && ri === 0
          ? undefined
          : ri === 0
            ? tree.groupConnector
            : group.intraConnector;
      const row: ConditionRow = {
        id: rule.id,
        left: rule.left,
        op: rule.op,
        right_type: rule.right_type,
        right_number: rule.right_number,
        right_indicator: rule.right_indicator,
        lookback: rule.lookback,
      };
      if (rule.percentage !== undefined) row.percentage = rule.percentage;
      if (operator) row.operator = operator;
      conditions.push(row);
    });
  });
  return {
    logic: { type: tree.groupConnector, threshold: null },
    conditions,
  };
}
