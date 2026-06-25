export function omitFields(row, omitted) {
    if (omitted.length === 0) {
        return row;
    }
    const result = { ...row };
    for (const field of omitted) {
        delete result[field];
    }
    return result;
}
export function omitFieldsMany(rows, omitted) {
    if (omitted.length === 0) {
        return rows;
    }
    return rows.map((row) => omitFields(row, omitted));
}
