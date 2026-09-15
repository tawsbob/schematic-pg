import { watch } from 'node:fs';
import path from 'node:path';
import { describeSchemaSource, resolveSchemaSource, } from '../schema-source/index.js';
import { runDbBootstrap } from './db.js';
import { generateAll } from './generate.js';
import { DEFAULT_OUTPUT_DIR } from './paths.js';
import { startAppServer, stopAppServer, waitForAppServerExit } from './server.js';
const WATCH_DEBOUNCE_MS = 300;
const SCHEMA_EXTENSION = '.schema';
function parseDevArgs(args) {
    let schemaArg;
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
function createDebouncer(fn, ms) {
    let timer;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            void fn();
        }, ms);
    };
}
function isSchemaFileChange(filename) {
    return filename === null || filename.endsWith(SCHEMA_EXTENSION);
}
function watchSchemaSource(source, onChange) {
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
export async function runDev(args = []) {
    const { schemaArg, watchSchema } = parseDevArgs(args);
    const schemaSource = resolveSchemaSource(schemaArg);
    const schemaLabel = describeSchemaSource(schemaSource);
    const appPath = path.resolve(DEFAULT_OUTPUT_DIR, 'app.ts');
    let serverProcess = null;
    let syncInProgress = false;
    let restarting = false;
    let shuttingDown = false;
    async function syncAndServe() {
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
                }
                else if (signal) {
                    process.stderr.write(`Dev server terminated by signal ${signal}\n`);
                }
            });
        }
        finally {
            syncInProgress = false;
        }
    }
    async function reload() {
        if (shuttingDown || syncInProgress) {
            return;
        }
        process.stderr.write(`\nSchema changed (${schemaLabel}) — regenerating, bootstrapping, and restarting...\n`);
        restarting = true;
        try {
            await syncAndServe();
        }
        finally {
            restarting = false;
        }
    }
    const scheduleReload = createDebouncer(reload, WATCH_DEBOUNCE_MS);
    async function shutdown() {
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
    await new Promise((resolve) => {
        const interval = setInterval(() => {
            if (shuttingDown) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
}
