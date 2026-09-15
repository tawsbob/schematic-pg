import { type ChildProcess } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import {
  describeSchemaSource,
  resolveSchemaSource,
  type SchemaSource,
} from '../schema-source/index.js';
import { runDbBootstrap } from './db.js';
import { generateAll } from './generate.js';
import { DEFAULT_OUTPUT_DIR } from './paths.js';
import { startAppServer, stopAppServer, waitForAppServerExit } from './server.js';

const WATCH_DEBOUNCE_MS = 300;
const SCHEMA_EXTENSION = '.schema';

type DevOptions = {
  schemaArg?: string;
  watchSchema: boolean;
};

function parseDevArgs(args: string[]): DevOptions {
  let schemaArg: string | undefined;
  let watchSchema = true;

  for (const arg of args) {
    if (arg === '--no-watch') {
      watchSchema = false;
      continue;
    }

    if (!arg.startsWith('--')) {
      schemaArg = arg;
    }
  }

  return { schemaArg, watchSchema };
}

function createDebouncer(fn: () => Promise<void>, ms: number): () => void {
  let timer: NodeJS.Timeout | undefined;

  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void fn();
    }, ms);
  };
}

function isSchemaFileChange(filename: string | null): boolean {
  return filename === null || filename.endsWith(SCHEMA_EXTENSION);
}

function watchSchemaSource(source: SchemaSource, onChange: () => void): void {
  if (source.kind === 'file') {
    watch(source.path, onChange);
    return;
  }

  watch(source.dir, { recursive: true }, (_eventType, filename) => {
    if (isSchemaFileChange(filename)) {
      onChange();
    }
  });
}

export async function runDev(args: string[] = []): Promise<void> {
  const { schemaArg, watchSchema } = parseDevArgs(args);
  const schemaSource = resolveSchemaSource(schemaArg);
  const schemaLabel = describeSchemaSource(schemaSource);
  const appPath = path.resolve(DEFAULT_OUTPUT_DIR, 'app.ts');

  let serverProcess: ChildProcess | null = null;
  let syncInProgress = false;
  let restarting = false;
  let shuttingDown = false;

  async function syncAndServe(): Promise<void> {
    if (syncInProgress) {
      return;
    }

    syncInProgress = true;

    try {
      await generateAll(schemaArg);
      await runDbBootstrap(schemaArg);
      await stopAppServer(serverProcess);
      serverProcess = startAppServer(appPath);

      serverProcess.on('exit', (code, signal) => {
        if (restarting || shuttingDown) {
          return;
        }

        if (!watchSchema) {
          if (code !== 0 && code !== null) {
            process.exitCode = code;
          }
          return;
        }

        if (code !== 0 && code !== null) {
          process.stderr.write(`Dev server exited with code ${code}\n`);
          process.exitCode = code;
          shuttingDown = true;
        } else if (signal) {
          process.stderr.write(`Dev server terminated by signal ${signal}\n`);
        }
      });
    } finally {
      syncInProgress = false;
    }
  }

  async function reload(): Promise<void> {
    if (shuttingDown || syncInProgress) {
      return;
    }

    process.stderr.write(
      `\nSchema changed (${schemaLabel}) — regenerating, bootstrapping, and restarting...\n`,
    );
    restarting = true;

    try {
      await syncAndServe();
    } finally {
      restarting = false;
    }
  }

  const scheduleReload = createDebouncer(reload, WATCH_DEBOUNCE_MS);

  async function shutdown(): Promise<void> {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await stopAppServer(serverProcess);
  }

  process.once('SIGINT', () => {
    void shutdown().finally(() => {
      process.exit(process.exitCode ?? 0);
    });
  });

  process.once('SIGTERM', () => {
    void shutdown().finally(() => {
      process.exit(process.exitCode ?? 0);
    });
  });

  await syncAndServe();

  if (!watchSchema) {
    if (serverProcess) {
      await waitForAppServerExit(serverProcess);
    }
    return;
  }

  watchSchemaSource(schemaSource, scheduleReload);

  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (shuttingDown) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}
