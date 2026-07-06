import { type ChildProcess } from 'node:child_process';
export declare function startAppServer(appPath: string, env?: NodeJS.ProcessEnv): ChildProcess;
export declare function stopAppServer(serverProcess: ChildProcess | null): Promise<void>;
export declare function waitForAppServerExit(serverProcess: ChildProcess): Promise<void>;
export declare function runAppServerUntilExit(appPath: string, env?: NodeJS.ProcessEnv): Promise<number | null>;
