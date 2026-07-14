import { DEFAULT_CUSTOM_ROUTES_DIR, DEFAULT_HOOKS_DIR } from '../cli/paths.js';
import { generateAppFile } from './app-generator.js';
import { discoverCustomRoutes } from './custom-route-scanner.js';
import { discoverHooks } from './hook-scanner.js';
import { generateHooksFile } from './hooks-generator.js';
import { generateOpenApiFiles } from './openapi-generator.js';
import { generatePoliciesFile } from './policy-generator.js';
import { generateRouteFiles } from './route-generator.js';
import { generateValidationSchemas } from './zod-schema-generator.js';
export function generateApiFiles(schema, options) {
    const customRoutesDir = options?.customRoutesDir ?? DEFAULT_CUSTOM_ROUTES_DIR;
    const appOptions = { customRoutesDir };
    const hooksDir = options?.hooksDir ?? DEFAULT_HOOKS_DIR;
    const { entries: hookEntries, modelsWithHooks } = discoverHooks(hooksDir, schema);
    const includeAuthPaths = discoverCustomRoutes(customRoutesDir).some((entry) => entry.basePath === 'auth');
    const openapi = generateOpenApiFiles(schema, { includeAuthPaths });
    return {
        app: generateAppFile(schema, appOptions),
        policies: generatePoliciesFile(schema),
        validation: generateValidationSchemas(schema),
        hooks: generateHooksFile(hookEntries),
        routes: generateRouteFiles(schema, modelsWithHooks),
        openapiTs: openapi.openapiTs,
        openapiJson: openapi.openapiJson,
    };
}
