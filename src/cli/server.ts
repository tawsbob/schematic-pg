import { spawn, type ChildProcess } from 'node:child_process';

const SERVER_STOP_TIMEOUT_MS = 5000;

export function startAppServer(appPath: string, env?: NodeJS.ProcessEnv): ChildProcess {
  return spawn(process.execPath, ['--import', 'tsx', appPath], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: env ? { ...process.env, ...env } : process.env,
  });
}

export function stopAppServer(serverProcess: ChildProcess | null): Promise<void> {
  if (!serverProcess || serverProcess.exitCode !== null || serverProcess.killed) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    serverProcess.once('exit', () => resolve());

    if (process.platform === 'win32') {
      serverProcess.kill();
    } else {
      serverProcess.kill('SIGTERM');
    }

    setTimeout(() => {
      if (serverProcess.exitCode === null && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }, SERVER_STOP_TIMEOUT_MS);
  });
}

export function waitForAppServerExit(serverProcess: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    serverProcess.once('exit', () => resolve());
  });
}

export async function runAppServerUntilExit(
  appPath: string,
  env?: NodeJS.ProcessEnv,
): Promise<number | null> {
  let serverProcess: ChildProcess | null = null;
  let shuttingDown = false;

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

  serverProcess = startAppServer(appPath, env);

  return new Promise((resolve) => {
    serverProcess!.once('exit', (code) => {
      resolve(code);
    });
  });
}
