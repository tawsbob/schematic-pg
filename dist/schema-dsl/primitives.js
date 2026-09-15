/**
 * Built-in column types accepted by the schema DSL.
 * Keep in sync with editors/language-server/src/catalog.ts `PG_TYPES`
 * and the README "Field types" list.
 */
export const PRIMITIVE_TYPES = new Set([
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
    'BIGSERIAL',
    'REAL',
    'DOUBLE',
    'NUMERIC',
    'BYTEA',
    'DATE',
    'TIME',
    'INTERVAL',
]);
