const POSTGRES_RESERVED_WORDS = new Set([
  'all',
  'analyse',
  'analyze',
  'and',
  'any',
  'array',
  'as',
  'asc',
  'asymmetric',
  'both',
  'case',
  'cast',
  'check',
  'collate',
  'column',
  'constraint',
  'create',
  'current_catalog',
  'current_date',
  'current_role',
  'current_time',
  'current_timestamp',
  'current_user',
  'default',
  'deferrable',
  'desc',
  'distinct',
  'do',
  'else',
  'end',
  'except',
  'false',
  'fetch',
  'for',
  'foreign',
  'from',
  'grant',
  'group',
  'having',
  'in',
  'initially',
  'intersect',
  'into',
  'leading',
  'limit',
  'localtime',
  'localtimestamp',
  'not',
  'null',
  'offset',
  'on',
  'only',
  'or',
  'order',
  'placing',
  'primary',
  'references',
  'returning',
  'select',
  'session_user',
  'some',
  'symmetric',
  'table',
  'then',
  'to',
  'trailing',
  'true',
  'union',
  'unique',
  'user',
  'using',
  'variadic',
  'when',
  'where',
  'window',
  'with',
]);

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-zA-Z])(\d)/g, '$1_$2')
    .replace(/(\d)([a-zA-Z])/g, '$1_$2')
    .toLowerCase();
}

export function toTableName(modelName: string): string {
  return toSnakeCase(modelName);
}

export function quoteIdentifier(name: string): string {
  if (POSTGRES_RESERVED_WORDS.has(name.toLowerCase())) {
    return `"${name.replace(/"/g, '""')}"`;
  }

  if (/^[a-z_][a-z0-9_]*$/.test(name)) {
    return name;
  }

  return `"${name.replace(/"/g, '""')}"`;
}
