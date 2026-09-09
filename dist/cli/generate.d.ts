export declare function generateSql(schemaPath?: string): Promise<string>;
export declare function generateClient(schemaPath?: string): Promise<void>;
export declare function generateApi(schemaPath?: string): Promise<void>;
export declare function syncGeneratedRouteFiles(routesDir: string, routes: Map<string, string>): Promise<void>;
export declare function generateAll(schemaPath?: string): Promise<void>;
