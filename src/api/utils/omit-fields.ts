export function omitFields<T extends Record<string, unknown>>(
  row: T,
  omitted: readonly string[],
): Omit<T, (typeof omitted)[number]> {
  if (omitted.length === 0) {
    return row;
  }

  const result = { ...row };
  for (const field of omitted) {
    delete result[field];
  }

  return result as Omit<T, (typeof omitted)[number]>;
}

export function omitFieldsMany<T extends Record<string, unknown>>(
  rows: T[],
  omitted: readonly string[],
): Array<Omit<T, (typeof omitted)[number]>> {
  if (omitted.length === 0) {
    return rows;
  }

  return rows.map((row) => omitFields(row, omitted));
}
