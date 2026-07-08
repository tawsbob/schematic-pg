export interface RunHooksAddOptions {
    schemaPath?: string;
    modelName?: string;
    hooksDir?: string;
}
export declare function runHooksAdd(args: string[], options?: RunHooksAddOptions): Promise<string>;
