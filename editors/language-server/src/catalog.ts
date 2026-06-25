export const TOP_LEVEL_KEYWORDS = ['extensions', 'enums', 'models', 'model'] as const;

export const PG_TYPES = [
  'UUID',
  'VARCHAR',
  'TEXT',
  'BOOLEAN',
  'TIMESTAMP',
  'DECIMAL',
  'JSONB',
  'INTEGER',
  'SMALLINT',
  'BIGINT',
  'POINT',
  'SERIAL',
  'REAL',
  'DOUBLE',
  'NUMERIC',
  'BYTEA',
  'DATE',
  'TIME',
  'INTERVAL',
] as const;

export const FIELD_ATTRIBUTES = [
  'id',
  'default',
  'unique',
  'regex',
  'range',
  'relation',
  'policy',
  'unfilterable',
  'omit',
] as const;

export const MODEL_DIRECTIVES = ['index', 'trigger', 'id'] as const;

export const RELATION_KEYS = ['name', 'fields', 'references', 'onDelete', 'onUpdate'] as const;

export const POLICY_KEYS = ['role', 'allow', 'where'] as const;

export const POLICY_OPERATIONS = ['select', 'insert', 'update', 'delete', 'all'] as const;

export const TRIGGER_KEYS = ['timing', 'event', 'level', 'execute'] as const;

export const TRIGGER_TIMINGS = ['BEFORE', 'AFTER'] as const;

export const TRIGGER_EVENTS = ['INSERT', 'UPDATE', 'DELETE'] as const;

export const TRIGGER_LEVELS = ['ROW', 'STATEMENT'] as const;

export const REFERENCE_ACTIONS = ['CASCADE', 'SET_NULL', 'RESTRICT', 'NO_ACTION'] as const;

export const INDEX_TYPES = ['BTREE', 'GIN', 'GIST', 'HASH', 'BRIN'] as const;

export const INDEX_KEYS = ['fields', 'where', 'name', 'type', 'unique'] as const;

export const DEFAULT_FUNCTIONS = ['gen_random_uuid', 'now'] as const;

export const KNOWN_DECORATORS = [...FIELD_ATTRIBUTES, ...MODEL_DIRECTIVES] as const;
