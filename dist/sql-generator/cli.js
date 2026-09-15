import { SqlGenerator } from './sql-generator.js';
import { loadSchemaFromArg } from '../schema-source/index.js';
const { schema } = loadSchemaFromArg(process.argv[2]);
const sql = new SqlGenerator().generate(schema);
process.stdout.write(sql);
