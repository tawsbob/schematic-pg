type StartOptions = {
    schemaPath: string;
    migrate: boolean;
};
export declare function parseStartArgs(args: string[]): StartOptions;
export declare function runStart(args?: string[]): Promise<void>;
export {};
