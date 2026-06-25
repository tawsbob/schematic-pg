export function shapeResponse(row, modelName, omitByModel, relationTargets) {
    const omitted = omitByModel[modelName] ?? [];
    const relations = relationTargets[modelName] ?? {};
    const result = { ...row };
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
            result[relationName] = value.map((entry) => shapeResponse(entry, targetModel, omitByModel, relationTargets));
            continue;
        }
        if (typeof value === 'object') {
            result[relationName] = shapeResponse(value, targetModel, omitByModel, relationTargets);
        }
    }
    return result;
}
export function shapeResponseMany(rows, modelName, omitByModel, relationTargets) {
    return rows.map((row) => shapeResponse(row, modelName, omitByModel, relationTargets));
}
