import type { NetboxModelConfig } from './netbox-config.models';

export type NetboxRootKey = string;

export type CategoryAnalysis = {
  rootKey: NetboxRootKey;
  nodes: string[];
  ordered: string[];
  // dependent -> sorted list of dependencies (subset of `nodes`)
  dependencies: Record<string, string[]>;
};

export function titleCaseCategory(rootKey: string): string {
  // Minimal, stable formatting for API categories.
  const words = rootKey
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1));
  return words.join(' ');
}

export function normalizeCategoryInput(input: string): string {
  return input.trim().toLowerCase();
}

export function computeEntityRoots(model: NetboxModelConfig): Record<string, Set<string>> {
  const entities = model.entities ?? {};

  const rootsByEntity: Record<string, Set<string>> = {};
  for (const entity of Object.keys(entities)) {
    rootsByEntity[entity] = new Set<string>();
    const allowed = entities[entity]?.parent?.allowed ?? [];
    for (const a of allowed) {
      if (a && typeof (a as any).root === 'string') {
        rootsByEntity[entity].add(String((a as any).root));
      }
    }
  }

  // Propagate roots through parent-entity links until fixpoint.
  // If A can be under parent entity P, then A can also be under any root that P can.
  let changed = true;
  const maxPasses = Math.max(1, Object.keys(entities).length + 5);
  let passes = 0;

  while (changed) {
    if (passes++ > maxPasses) {
      // Should never happen, but prevents infinite loops in malformed configs.
      throw new Error('NetBox model root propagation exceeded safety limit (possible cycle)');
    }

    changed = false;
    for (const entity of Object.keys(entities)) {
      const allowed = entities[entity]?.parent?.allowed ?? [];
      for (const a of allowed) {
        const parentEntity = (a as any)?.entity;
        if (typeof parentEntity !== 'string' || !parentEntity) continue;
        const parentRoots = rootsByEntity[parentEntity];
        if (!parentRoots) continue;
        const childRoots = rootsByEntity[entity];
        const before = childRoots.size;
        for (const r of parentRoots) childRoots.add(r);
        if (childRoots.size !== before) changed = true;
      }
    }
  }

  return rootsByEntity;
}

export type DependencyEdge = { from: string; to: string };

export function buildCategoryDependencyEdges(model: NetboxModelConfig, nodes: Set<string>): DependencyEdge[] {
  const entities = model.entities ?? {};
  const edges: DependencyEdge[] = [];

  // Parent dependencies: parent entity must exist before child.
  for (const [entity, cfg] of Object.entries(entities)) {
    if (!nodes.has(entity)) continue;
    const allowed = cfg?.parent?.allowed ?? [];
    for (const a of allowed) {
      const parentEntity = (a as any)?.entity;
      if (typeof parentEntity !== 'string' || !parentEntity) continue;
      if (parentEntity === entity) continue;
      if (!nodes.has(parentEntity)) continue;
      edges.push({ from: parentEntity, to: entity });
    }
  }

  // Link dependencies: link target entity should exist before current entity.
  for (const [entity, cfg] of Object.entries(entities)) {
    if (!nodes.has(entity)) continue;
    const links = cfg?.links ?? {};
    for (const link of Object.values(links)) {
      const dep = (link as any)?.entity;
      if (typeof dep !== 'string' || !dep) continue;
      if (dep === entity) continue;
      if (!nodes.has(dep)) continue;
      edges.push({ from: dep, to: entity });
    }
  }

  // De-duplicate edges for deterministic behavior.
  const dedup = new Map<string, DependencyEdge>();
  for (const e of edges) {
    dedup.set(`${e.from}→${e.to}`, e);
  }

  return Array.from(dedup.values()).sort((a, b) => {
    const f = a.from.localeCompare(b.from);
    if (f) return f;
    return a.to.localeCompare(b.to);
  });
}

export function topoSortDeterministic(nodes: string[], edges: DependencyEdge[]): { ordered: string[]; cycleNodes: string[] } {
  const nodeSet = new Set(nodes);
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, Set<string>>();

  for (const n of nodes) {
    indegree.set(n, 0);
    outgoing.set(n, new Set());
  }

  for (const e of edges) {
    if (!nodeSet.has(e.from) || !nodeSet.has(e.to)) continue;
    const out = outgoing.get(e.from)!;
    if (out.has(e.to)) continue;
    out.add(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }

  const ready: string[] = nodes.filter((n) => (indegree.get(n) ?? 0) === 0).sort((a, b) => a.localeCompare(b));

  const ordered: string[] = [];
  while (ready.length) {
    // Always pick the lexicographically smallest available node.
    const n = ready.shift()!;
    ordered.push(n);

    const outs = Array.from(outgoing.get(n) ?? []).sort((a, b) => a.localeCompare(b));
    for (const m of outs) {
      indegree.set(m, (indegree.get(m) ?? 0) - 1);
      if ((indegree.get(m) ?? 0) === 0) {
        // Insert while keeping `ready` sorted for deterministic output.
        const idx = lowerBound(ready, m);
        ready.splice(idx, 0, m);
      }
    }
  }

  if (ordered.length !== nodes.length) {
    const cycleNodes = nodes.filter((n) => (indegree.get(n) ?? 0) > 0).sort((a, b) => a.localeCompare(b));
    return { ordered: [], cycleNodes };
  }

  return { ordered, cycleNodes: [] };
}

function lowerBound(sorted: string[], value: string): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].localeCompare(value) < 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function analyzeModelByRoot(model: NetboxModelConfig): Record<string, CategoryAnalysis> {
  const rootsByEntity = computeEntityRoots(model);
  const rootKeys = Object.keys(model.roots ?? {}).sort((a, b) => a.localeCompare(b));

  const result: Record<string, CategoryAnalysis> = {};

  for (const rootKey of rootKeys) {
    const nodes = Object.keys(model.entities ?? {})
      .filter((entity) => rootsByEntity[entity]?.has(rootKey))
      .sort((a, b) => a.localeCompare(b));

    const nodeSet = new Set(nodes);
    const edges = buildCategoryDependencyEdges(model, nodeSet);

    const { ordered, cycleNodes } = topoSortDeterministic(nodes, edges);
    if (cycleNodes.length) {
      throw new Error(
        `NetBox model dependency cycle detected for root '${rootKey}': ${cycleNodes.join(', ')}`,
      );
    }

    const deps: Record<string, Set<string>> = {};
    for (const n of nodes) deps[n] = new Set<string>();
    for (const e of edges) {
      deps[e.to]?.add(e.from);
    }

    result[rootKey] = {
      rootKey,
      nodes,
      ordered,
      dependencies: Object.fromEntries(
        Object.entries(deps)
          .map(([k, v]) => [k, Array.from(v).sort((a, b) => a.localeCompare(b))]),
      ),
    };
  }

  return result;
}

export function closureWithDependencies(analysis: CategoryAnalysis, seedTypes: Iterable<string>): Set<string> {
  const needed = new Set<string>();
  const stack: string[] = [];

  for (const t of seedTypes) {
    if (!t) continue;
    if (!analysis.dependencies[t] && !analysis.nodes.includes(t)) continue;
    if (!needed.has(t)) {
      needed.add(t);
      stack.push(t);
    }
  }

  while (stack.length) {
    const cur = stack.pop()!;
    const deps = analysis.dependencies[cur] ?? [];
    for (const d of deps) {
      if (!needed.has(d)) {
        needed.add(d);
        stack.push(d);
      }
    }
  }

  return needed;
}
