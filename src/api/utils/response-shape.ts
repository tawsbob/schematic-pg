export function shapeResponse<T extends Record<string, unknown>>(
  row: T,
  modelName: string,
  omitByModel: Readonly<Record<string, readonly string[]>>,
  relationTargets: Readonly<Record<string, Readonly<Record<string, string>>>>,
): T {
  const omitted = omitByModel[modelName] ?? [];
  const relations = relationTargets[modelName] ?? {};
  const result = { ...row } as Record<string, unknown>;

  for (const field of omitted) {
    delete result[field];
  }

  for (const [relationName, targetModel] of Object.entries(relations)) {
    if (!(relationName in result)) {
      continue;
    }

    const value = result[relationName];
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      result[relationName] = value.map((entry) =>
        shapeResponse(entry as Record<string, unknown>, targetModel, omitByModel, relationTargets),
      );
      continue;
    }

    if (typeof value === 'object') {
      result[relationName] = shapeResponse(
        value as Record<string, unknown>,
        targetModel,
        omitByModel,
        relationTargets,
      );
    }
  }

  return result as T;
}

export function shapeResponseMany<T extends Record<string, unknown>>(
  rows: T[],
  modelName: string,
  omitByModel: Readonly<Record<string, readonly string[]>>,
  relationTargets: Readonly<Record<string, Readonly<Record<string, string>>>>,
): T[] {
  return rows.map((row) => shapeResponse(row, modelName, omitByModel, relationTargets));
}
