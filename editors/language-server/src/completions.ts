import type { Schema } from 'schematic-pg/schema-dsl';
import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver';
import {
  CRON_JOB_KEYS,
  DEFAULT_FUNCTIONS,
  FIELD_ATTRIBUTES,
  FUNCTION_KEYS,
  FUNCTION_LANGUAGES,
  FUNCTION_RETURN_TYPES,
  FUNCTION_SECURITIES,
  FUNCTION_VOLATILITIES,
  MODEL_ATTRIBUTES,
  INDEX_KEYS,
  INDEX_TYPES,
  MODEL_DIRECTIVES,
  PARTITION_BOUNDS,
  PARTITION_KEYS,
  PARTITION_STRATEGIES,
  PG_TYPES,
  POLICY_KEYS,
  POLICY_OPERATIONS,
  REFERENCE_ACTIONS,
  RELATION_KEYS,
  REST_KEYS,
  REST_OPERATIONS,
  TOP_LEVEL_KEYWORDS,
  TRIGGER_EVENTS,
  TRIGGER_KEYS,
  TRIGGER_LEVELS,
  TRIGGER_TIMINGS,
} from './catalog.js';
import {
  findContainingFunction,
  findContainingJob,
  findContainingModel,
  getEnumNames,
  getEnumValues,
  getModelFields,
  getModelNames,
} from './schema-index.js';
import { getLinePrefix } from './utils.js';

function item(label: string, kind: CompletionItemKind, detail?: string): CompletionItem {
  return { label, kind, detail };
}

export function getCompletions(
  text: string,
  position: Position,
  schema?: Schema,
): CompletionItem[] {
  const prefix = getLinePrefix(text, position);
  const trimmed = prefix.trimStart();

  if (/@@[\w]*$/.test(prefix)) {
    return MODEL_DIRECTIVES.map((name) =>
      item(`@@${name}`, CompletionItemKind.Snippet, 'model directive'),
    );
  }

  if (/(?<![@])@[\w]*$/.test(prefix)) {
    return [
      ...FIELD_ATTRIBUTES.map((name) =>
        item(`@${name}`, CompletionItemKind.Property, 'field attribute'),
      ),
      ...MODEL_ATTRIBUTES.map((name) =>
        item(`@${name}`, CompletionItemKind.Property, 'model attribute'),
      ),
    ];
  }

  if (/@relation\s*\([^)]*$/.test(prefix)) {
    return relationCompletions(schema, position, prefix);
  }

  if (/@policy\s*\([^)]*$/.test(prefix)) {
    return policyCompletions(schema, prefix);
  }

  if (/@rest\s*\([^)]*$/.test(prefix)) {
    return restCompletions(prefix);
  }

  if (/@@index\s*\{[^}]*$/.test(prefix)) {
    return [
      ...INDEX_KEYS.map((key) => item(key, CompletionItemKind.Property)),
      ...INDEX_TYPES.map((type) => item(type, CompletionItemKind.Enum)),
    ];
  }

  if (/@@trigger\s*\{[^}]*$/.test(prefix)) {
    return [
      ...TRIGGER_KEYS.map((key) => item(key, CompletionItemKind.Property)),
      ...TRIGGER_TIMINGS.map((value) => item(value, CompletionItemKind.Enum)),
      ...TRIGGER_EVENTS.map((value) => item(value, CompletionItemKind.Enum)),
      ...TRIGGER_LEVELS.map((value) => item(value, CompletionItemKind.Enum)),
    ];
  }

  if (/@@partition\s*\{[^}]*$/.test(prefix) || /partition\s+\w+\s*\{[^}]*$/.test(prefix)) {
    return [
      ...PARTITION_KEYS.map((key) => item(key, CompletionItemKind.Property)),
      ...PARTITION_STRATEGIES.map((value) => item(value, CompletionItemKind.Enum, 'partition strategy')),
      ...PARTITION_BOUNDS.map((value) => item(value, CompletionItemKind.Enum, 'range bound')),
      item('partition', CompletionItemKind.Keyword, 'child partition'),
    ];
  }

  if (/function\s+\w+\s*\([^)]*\)\s*(?::\s*[\w?[\]]*(?:\([^)]*\))?)?\s*\{[^}]*$/.test(prefix)) {
    return [
      ...FUNCTION_KEYS.map((key) => item(key, CompletionItemKind.Property)),
      ...FUNCTION_LANGUAGES.map((value) => item(value, CompletionItemKind.Enum, 'function language')),
      ...FUNCTION_VOLATILITIES.map((value) => item(value, CompletionItemKind.Enum, 'function volatility')),
      ...FUNCTION_SECURITIES.map((value) => item(value, CompletionItemKind.Enum, 'function security')),
    ];
  }

  if (/job\s+\w+\s*\{[^}]*$/.test(prefix)) {
    return cronJobCompletions(schema, prefix);
  }

  if (/call:\s*[\w]*$/.test(prefix) && schema) {
    return cronJobCompletions(schema, prefix);
  }

  if (/@default\s*\([^)]*$/.test(prefix)) {
    return DEFAULT_FUNCTIONS.map((fn) =>
      item(`${fn}()`, CompletionItemKind.Function, 'default expression'),
    );
  }

  if (/onDelete:\s*[\w]*$/.test(prefix) || /onUpdate:\s*[\w]*$/.test(prefix)) {
    return REFERENCE_ACTIONS.map((action) => item(action, CompletionItemKind.Enum));
  }

  if (/:\s*[\w?[\]]*$/.test(prefix) && schema) {
    return typeCompletions(schema);
  }

  if (/^model\s+[\w]*$/.test(trimmed) || /\bmodel\s+[\w]*$/.test(prefix)) {
    return [];
  }

  if (/^\s*[\w]*$/.test(trimmed) && isTopLevelContext(text, position)) {
    return TOP_LEVEL_KEYWORDS.map((keyword) =>
      item(keyword, CompletionItemKind.Keyword, 'top-level section'),
    );
  }

  if (schema) {
    const job = findContainingJob(schema, position.line);
    if (job && (/^\s+[\w]*$/.test(trimmed) || /call:\s*[\w]*$/.test(prefix))) {
      return cronJobCompletions(schema, prefix);
    }

    const sqlFunction = findContainingFunction(schema, position.line);
    if (sqlFunction && /^\s+[\w]*$/.test(trimmed)) {
      return [
        ...FUNCTION_KEYS.map((key) => item(key, CompletionItemKind.Property)),
        ...FUNCTION_LANGUAGES.map((value) => item(value, CompletionItemKind.Enum, 'function language')),
        ...FUNCTION_VOLATILITIES.map((value) => item(value, CompletionItemKind.Enum, 'function volatility')),
        ...FUNCTION_SECURITIES.map((value) => item(value, CompletionItemKind.Enum, 'function security')),
      ];
    }

    const model = findContainingModel(schema, position.line);
    if (model && /^\s+[\w]*$/.test(trimmed)) {
      return PG_TYPES.map((type) => item(type, CompletionItemKind.TypeParameter, 'PostgreSQL type'));
    }
  }

  return [];
}

function cronJobCompletions(schema: Schema | undefined, prefix: string): CompletionItem[] {
  if (/call:\s*[\w]*$/.test(prefix) && schema) {
    return schema.functions
      .filter((fn) => fn.params.length === 0)
      .map((fn) => item(fn.name, CompletionItemKind.Function, 'zero-arg function'));
  }

  return CRON_JOB_KEYS.map((key) => item(key, CompletionItemKind.Property, 'cron job key'));
}

function isTopLevelContext(text: string, position: Position): boolean {
  const before = text.slice(0, offsetAt(text, position));
  let depth = 0;
  for (const char of before) {
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    }
  }
  return depth === 0;
}

function offsetAt(text: string, position: Position): number {
  const lines = text.split('\n');
  let offset = 0;
  for (let line = 0; line < position.line; line += 1) {
    offset += (lines[line]?.length ?? 0) + 1;
  }
  return offset + position.character;
}

function typeCompletions(schema: Schema): CompletionItem[] {
  const enumNames = getEnumNames(schema).map((name) =>
    item(name, CompletionItemKind.Enum, 'enum type'),
  );
  const modelNames = getModelNames(schema).map((name) =>
    item(name, CompletionItemKind.Class, 'model type'),
  );
  const pgTypes = PG_TYPES.map((type) => item(type, CompletionItemKind.TypeParameter, 'PostgreSQL type'));
  const functionReturnTypes = FUNCTION_RETURN_TYPES.map((type) =>
    item(type, CompletionItemKind.TypeParameter, 'function return type'),
  );
  return [...pgTypes, ...functionReturnTypes, ...enumNames, ...modelNames];
}

function relationCompletions(
  schema: Schema | undefined,
  position: Position,
  prefix: string,
): CompletionItem[] {
  const keys = RELATION_KEYS.map((key) => item(key, CompletionItemKind.Property));
  if (!schema) {
    return keys;
  }

  const model = findContainingModel(schema, position.line);
  if (!model) {
    return keys;
  }

  const fieldNames = getModelFields(schema, model.name).map((field) =>
    item(field.name, CompletionItemKind.Field, `${model.name}.${field.name}`),
  );

  const referencesMatch = prefix.match(/references:\s*\[([^\]]*)$/);
  if (referencesMatch) {
    const targetModel = inferRelationTarget(schema, model.name, prefix);
    if (targetModel) {
      return getModelFields(schema, targetModel).map((field) =>
        item(field.name, CompletionItemKind.Field, `${targetModel}.${field.name}`),
      );
    }
  }

  return [...keys, ...fieldNames];
}

function policyCompletions(schema: Schema | undefined, prefix: string): CompletionItem[] {
  const keys = POLICY_KEYS.map((key) => item(key, CompletionItemKind.Property));
  if (/allow:\s*\[?[\w,\s]*$/.test(prefix)) {
    return POLICY_OPERATIONS.map((operation) =>
      item(operation, CompletionItemKind.Enum, 'policy operation'),
    );
  }

  if (/role:\s*[\w]*$/.test(prefix) && schema) {
  const roleEnum = schema.enums.find((enumDef) => enumDef.name === 'UserRole');
    if (roleEnum) {
      return roleEnum.values.map((value) => item(value, CompletionItemKind.EnumMember));
    }
  }

  return keys;
}

function restCompletions(prefix: string): CompletionItem[] {
  if (/(?:only|except):\s*\[?[\w,\s]*$/.test(prefix)) {
    return REST_OPERATIONS.map((operation) =>
      item(operation, CompletionItemKind.Enum, 'rest operation'),
    );
  }

  return [
    ...REST_KEYS.map((key) => item(key, CompletionItemKind.Property)),
    item('false', CompletionItemKind.Value, 'disable all generated routes'),
  ];
}

function inferRelationTarget(
  schema: Schema,
  currentModel: string,
  prefix: string,
): string | undefined {
  const line = prefix.match(/:\s*([A-Z][A-Za-z0-9]*)/);
  if (line) {
    return line[1];
  }

  const fieldLine = schema.models
    .find((model) => model.name === currentModel)
    ?.fields.find((field) => prefix.includes(`${field.name}:`));

  return fieldLine?.type.name;
}
