export function inspect(node: unknown): string {
  return JSON.stringify(node, replacer, 2);
}

function replacer(_key: string, value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  return value;
}
