#!/usr/bin/env node
import { runDbBootstrap, runDbDiff, runDbMigrate, runDbPing } from './cli/db.js';
import { runDev } from './cli/dev.js';
import { runStart } from './cli/start.js';
import { generateAll, generateApi, generateClient, generateSql } from './cli/generate.js';
import { runHooksAdd } from './cli/hooks.js';
import { runInit } from './cli/init.js';

import { PACKAGE_NAME } from './constants.js';

const USAGE = `Usage: ${PACKAGE_NAME} <command> [options]

Commands:
  init [dir] [--skip-install] Scaffold a new project
  generate [schema]          Generate schema.sql, db client, and API
  generate:sql [schema]      Generate SQL DDL to stdout
  generate:client [schema]   Generate db client files
  generate:api [schema]      Generate API files
  hooks:add [schema] [--model ModelName]  Scaffold lifecycle hooks for a model
  dev [schema] [--no-watch]  Generate, bootstrap DB, start server, watch schema
  start [schema] [--no-migrate]  Run production server (migrate DB, no generate/watch)
  db:ping                    Test database connection
  db:bootstrap [schema]      Apply DDL and snapshot schema state
  db:diff [schema]           Show schema diff (--name <name> to write migration)
  db:migrate [schema]        Apply pending migrations
  db:migrate:status [schema] Show migration status
`;

function getPositionalArgs(args: string[]): string[] {
  return args.filter((arg) => !arg.startsWith('--'));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return;
  }

  const positionalArgs = getPositionalArgs(args);
  const schemaPath = positionalArgs[0];

  try {
    switch (command) {
      case 'init':
        await runInit(args);
        break;
      case 'generate':
        await generateAll(schemaPath);
        break;
      case 'generate:sql': {
        const sql = await generateSql(schemaPath);
        process.stdout.write(sql);
        break;
      }
      case 'generate:client':
        await generateClient(schemaPath);
        break;
      case 'generate:api':
        await generateApi(schemaPath);
        break;
      case 'hooks:add':
        await runHooksAdd(args);
        break;
      case 'dev':
        await runDev(args);
        break;
      case 'start':
        await runStart(args);
        break;
      case 'db:ping':
        await runDbPing();
        break;
      case 'db:bootstrap':
        await runDbBootstrap(schemaPath);
        break;
      case 'db:diff':
        await runDbDiff(args);
        break;
      case 'db:migrate':
        await runDbMigrate(args);
        break;
      case 'db:migrate:status':
        await runDbMigrate(['status', ...args]);
        break;
      default:
        process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
        process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

main();
