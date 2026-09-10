import { parse } from '../schema-dsl/index.js';
import { generateDropTables } from './generators/drop-tables.js';
import { generateEnums } from './generators/enums.js';
import { generateExtensions } from './generators/extensions.js';
import { generateForeignKeys } from './generators/foreign-keys.js';
import { generateFunctions } from './generators/functions.js';
import { generateIndexes } from './generators/indexes.js';
import { generateTables } from './generators/tables.js';
import { generateTriggers } from './generators/triggers.js';
export class SqlGenerator {
    generate(schema) {
        const sections = [
            generateExtensions(schema),
            generateEnums(schema),
            generateDropTables(schema),
            generateTables(schema),
            generateForeignKeys(schema),
            generateIndexes(schema),
            generateFunctions(schema),
            generateTriggers(schema),
        ];
        return `${sections.join('\n')}\n`;
    }
    generateFromSource(source) {
        return this.generate(parse(source));
    }
}
export { toSnakeCase, toTableName } from './utils/snake-case.js';
