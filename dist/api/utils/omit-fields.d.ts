export declare function omitFields<T extends Record<string, unknown>>(row: T, omitted: readonly string[]): Omit<T, (typeof omitted)[number]>;
export declare function omitFieldsMany<T extends Record<string, unknown>>(rows: T[], omitted: readonly string[]): Array<Omit<T, (typeof omitted)[number]>>;
