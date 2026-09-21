import type { Schema } from '../schema-dsl/ast.js';
import { parse } from '../schema-dsl/index.js';
import { generateCronJobs } from './generators/cron-jobs.js';
import { generateDropTables } from './generators/drop-tables.js';
import { generateEnums } from './generators/enums.js';
import { generateExtensions } from './generators/extensions.js';
import { generateForeignKeys } from './generators/foreign-keys.js';
import { generateFunctions } from './generators/functions.js';
import { generateIndexes } from './generators/indexes.js';
import { generateTables } from './generators/tables.js';
import { generateTriggers } from './generators/triggers.js';
import { generateViews } from './generators/views.js';

export class SqlGenerator {
  generate(schema: Schema): string {
    const sections = [
      generateExtensions(schema),
      generateEnums(schema),
      generateDropTables(schema),
      generateTables(schema),
      generateIndexes(schema),
      generateForeignKeys(schema),
      generateViews(schema),
      generateFunctions(schema),
      generateTriggers(schema),
      generateCronJobs(schema),
    ].filter((section) => section.length > 0);

    return `${sections.join('\n')}\n`;
  }

  generateFromSource(source: string): string {
    return this.generate(parse(source));
  }
}

export { toSnakeCase, toTableName } from './utils/snake-case.js';
