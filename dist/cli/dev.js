import { watch } from 'node:fs';
import path from 'node:path';
import { runDbBootstrap } from './db.js';
import { generateAll } from './generate.js';
import { DEFAULT_OUTPUT_DIR, resolveSchemaPath } from './paths.js';
import { startAppServer, stopAppServer, waitForAppServerExit } from './server.js';
const WATCH_DEBOUNCE_MS = 300;
function parseDevArgs(args) {
    let schemaPath = resolveSchemaPath();
    let watchSchema = true;
    for (const arg of args) {
        if (arg === '--no-watch') {
            watchSchema = false;
            continue;
        }
        if (!arg.startsWith('--')) {
            schemaPath = resolveSchemaPath(arg);
        }
    }
    return { schemaPath, watchSchema };
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
export async function runDev(args = []) {
    const { schemaPath, watchSchema } = parseDevArgs(args);
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
            await generateAll(schemaPath);
            await runDbBootstrap(schemaPath);
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
        process.stderr.write('\nSchema changed — regenerating, bootstrapping, and restarting...\n');
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
    watch(schemaPath, scheduleReload);
    await new Promise((resolve) => {
        const interval = setInterval(() => {
            if (shuttingDown) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
}
