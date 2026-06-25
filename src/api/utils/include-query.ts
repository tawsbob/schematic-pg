import { MAX_INCLUDE_DEPTH, MAX_INCLUDE_PATHS } from '../../constants.js';
import type { IncludeInput } from '../../db/include/types.js';

export interface IncludableRelationTree {
  [relationName: string]: IncludableRelationTree;
}

interface IncludeTreeNode {
  include?: Record<string, IncludeTreeNode>;
}

export function validateIncludePaths(
  raw: string,
  tree: IncludableRelationTree,
): string | undefined {
  const segments = splitIncludePaths(raw);
  if (segments.some((segment) => segment.length === 0)) {
    return 'Include paths cannot contain empty relation segments';
  }

  if (segments.length === 0) {
    return 'Include parameter must contain at least one relation path';
  }

  if (segments.length > MAX_INCLUDE_PATHS) {
    return `Include parameter exceeds maximum of ${MAX_INCLUDE_PATHS} paths`;
  }

  for (const segment of segments) {
    const parts = segment.split('.');
    if (parts.length > MAX_INCLUDE_DEPTH) {
      return `Include path "${segment}" exceeds maximum depth of ${MAX_INCLUDE_DEPTH}`;
    }

    let currentTree = tree;
    for (const part of parts) {
      if (!part) {
        return 'Include paths cannot contain empty relation segments';
      }

      const nextTree = currentTree[part];
      if (!nextTree) {
        return `Unknown include relation "${part}" in path "${segment}"`;
      }

      currentTree = nextTree;
    }
  }

  return undefined;
}

export function parseIncludeQuery(raw: string, tree: IncludableRelationTree): IncludeInput {
  const error = validateIncludePaths(raw, tree);
  if (error) {
    throw new Error(error);
  }

  const root: Record<string, IncludeTreeNode> = {};

  for (const segment of splitIncludePaths(raw)) {
    mergeIncludePath(root, segment.split('.'));
  }

  return toIncludeInput(root);
}

function splitIncludePaths(raw: string): string[] {
  return raw.split(',').map((segment) => segment.trim());
}

function mergeIncludePath(root: Record<string, IncludeTreeNode>, parts: string[]): void {
  let current = root;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const isLeaf = index === parts.length - 1;

    if (!current[part]) {
      current[part] = {};
    }

    if (isLeaf) {
      continue;
    }

    if (!current[part]!.include) {
      current[part]!.include = {};
    }

    current = current[part]!.include!;
  }
}

function toIncludeInput(nodes: Record<string, IncludeTreeNode>): IncludeInput {
  const include: IncludeInput = {};

  for (const [relationName, node] of Object.entries(nodes)) {
    if (node.include && Object.keys(node.include).length > 0) {
      include[relationName] = {
        include: toIncludeInput(node.include),
      };
      continue;
    }

    include[relationName] = true;
  }

  return include;
}
