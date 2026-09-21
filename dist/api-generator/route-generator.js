import { PACKAGE_NAME } from '../constants.js';
import { getPrimaryKey } from '../sql-generator/utils/ast-helpers.js';
import { getClientExportName } from '../db/type-generator.js';
import { toRouteBasePath, toRouteFileName, toRouteImportName } from '../api/utils/route-naming.js';
import { toModelConstantPrefix } from './utils/api-fields.js';
import { hasPolicies } from './utils/policy.js';
import { isRestEnabled, normalizeRest } from './utils/rest.js';
import { generateViewRouteFiles, getViewRouteMountEntries } from './view-route-generator.js';
export class RouteGenerator {
    model;
    schema;
    modelsWithHooks;
    overlays;
    constructor(model, schema, options = {}) {
        this.model = model;
        this.schema = schema;
        this.modelsWithHooks = options.modelsWithHooks ?? new Set();
        this.overlays = options.overlays ?? new Map();
    }
    generate() {
        const rest = normalizeRest(this.model);
        const overlay = this.overlays.get(this.model.name);
        const operations = rest.operations;
        if (operations.size === 0 && !overlay) {
            return null;
        }
        if (operations.size === 0 && overlay) {
            return this.generateOverlayOnly(overlay);
        }
        const needsPk = operations.has('get') || operations.has('update') || operations.has('delete');
        const primaryKey = getPrimaryKey(this.model);
        if (needsPk && !primaryKey) {
            throw new Error(`Model ${this.model.name} has no primary key`);
        }
        const clientKey = getClientExportName(this.model.name);
        const pathParams = primaryKey?.fields.map((field) => `:${field}`).join('/') ?? '';
        const whereFromParams = primaryKey?.fields.map((field) => `${field}: params.${field}`).join(', ') ?? '';
        const paramSchemaName = `${this.model.name}ParamSchema`;
        const listQuerySchemaName = `${this.model.name}ListQuerySchema`;
        const getQuerySchemaName = `${this.model.name}GetQuerySchema`;
        const modelHasPolicies = hasPolicies(this.model);
        const hasWriteOps = operations.has('create') || operations.has('update') || operations.has('delete');
        const modelHasHooks = hasWriteOps && this.modelsWithHooks.has(this.model.name);
        const constantPrefix = toModelConstantPrefix(this.model.name);
        const needsValidateJson = operations.has('create') || operations.has('update');
        const needsValidateParam = operations.has('get') || operations.has('update') || operations.has('delete');
        const needsValidateQuery = operations.has('list') || operations.has('get');
        const needsNotFound = operations.has('get');
        const needsBuildReadQuery = operations.has('list');
        const needsParseInclude = operations.has('get');
        const needsOmitFields = hasWriteOps;
        const needsShapeResponse = operations.has('list') || operations.has('get');
        const validateImports = [];
        if (needsValidateJson)
            validateImports.push('validateJson');
        if (needsValidateParam)
            validateImports.push('validateParam');
        if (needsValidateQuery)
            validateImports.push('validateQuery');
        const schemaImports = [];
        if (operations.has('create'))
            schemaImports.push(`  ${this.model.name}CreateSchema,`);
        if (operations.has('update'))
            schemaImports.push(`  ${this.model.name}UpdateSchema,`);
        if (needsValidateParam)
            schemaImports.push(`  ${paramSchemaName},`);
        if (operations.has('list'))
            schemaImports.push(`  ${listQuerySchemaName},`);
        if (operations.has('get'))
            schemaImports.push(`  ${getQuerySchemaName},`);
        if (operations.has('list')) {
            schemaImports.push(`  ${constantPrefix}_LIST_QUERY_FIELDS,`);
            schemaImports.push(`  ${constantPrefix}_SORTABLE_FIELDS,`);
        }
        if (operations.has('list') || operations.has('get')) {
            schemaImports.push(`  ${constantPrefix}_INCLUDABLE_RELATIONS,`);
        }
        if (needsOmitFields)
            schemaImports.push(`  ${constantPrefix}_OMIT_FIELDS,`);
        if (needsShapeResponse) {
            schemaImports.push(`  API_OMIT_FIELDS_BY_MODEL,`);
            schemaImports.push(`  API_RELATION_TARGETS,`);
        }
        const handlerBlocks = [];
        if (operations.has('list')) {
            handlerBlocks.push(this.generateListRoute(clientKey, modelHasPolicies, listQuerySchemaName, constantPrefix));
        }
        if (operations.has('get')) {
            handlerBlocks.push(this.generateGetRoute(clientKey, pathParams, paramSchemaName, getQuerySchemaName, whereFromParams, modelHasPolicies, constantPrefix));
        }
        if (operations.has('create')) {
            handlerBlocks.push(this.generateCreateRoute(clientKey, modelHasPolicies, modelHasHooks, constantPrefix));
        }
        if (operations.has('update')) {
            handlerBlocks.push(this.generateUpdateRoute(clientKey, pathParams, paramSchemaName, whereFromParams, modelHasPolicies, modelHasHooks, constantPrefix));
        }
        if (operations.has('delete')) {
            handlerBlocks.push(this.generateDeleteRoute(clientKey, pathParams, paramSchemaName, whereFromParams, modelHasPolicies, modelHasHooks, constantPrefix));
        }
        const lines = [
            '// Auto-generated by RouteGenerator. Do not edit manually.',
            "import { Hono } from 'hono';",
            `import type { AppEnv } from '${PACKAGE_NAME}/api/types';`,
        ];
        if (validateImports.length > 0) {
            lines.push(`import { ${validateImports.join(', ')} } from '${PACKAGE_NAME}/api/middleware/validate';`);
        }
        if (needsNotFound) {
            lines.push(`import { notFoundResponse } from '${PACKAGE_NAME}/api/middleware/errors';`);
        }
        if (needsBuildReadQuery) {
            lines.push(`import { buildReadQuery } from '${PACKAGE_NAME}/api/utils/read-query';`);
        }
        if (needsParseInclude) {
            lines.push(`import { parseIncludeQuery } from '${PACKAGE_NAME}/api/utils/include-query';`);
        }
        if (needsOmitFields) {
            lines.push(`import { omitFields } from '${PACKAGE_NAME}/api/utils/omit-fields';`);
        }
        if (needsShapeResponse) {
            lines.push(`import { shapeResponse, shapeResponseMany } from '${PACKAGE_NAME}/api/utils/response-shape';`);
        }
        if (modelHasPolicies) {
            lines.push(`import { assertPolicy, mergeWhere, resolvePolicyWhere } from '${PACKAGE_NAME}/api/auth/policy';`);
        }
        if (modelHasHooks) {
            lines.push(`import { cancelledResponse, createHookContext, runAfterHooks, runBeforeHooks } from '${PACKAGE_NAME}/api/hooks';`);
        }
        if (schemaImports.length > 0) {
            lines.push('import {');
            lines.push(...schemaImports);
            lines.push(`} from '../schemas/validation.js';`);
        }
        if (overlay) {
            lines.push(`import ${overlay.importName}Overlay from '${overlay.routeImportPath}';`);
        }
        lines.push('', 'const router = new Hono<AppEnv>();', '');
        for (const block of handlerBlocks) {
            lines.push(...block, '');
        }
        if (overlay) {
            lines.push(`router.route('/', ${overlay.importName}Overlay);`, '');
        }
        lines.push('export default router;', '');
        return lines.join('\n');
    }
    generateOverlayOnly(overlay) {
        return [
            '// Auto-generated by RouteGenerator. Do not edit manually.',
            "import { Hono } from 'hono';",
            `import type { AppEnv } from '${PACKAGE_NAME}/api/types';`,
            `import ${overlay.importName}Overlay from '${overlay.routeImportPath}';`,
            '',
            'const router = new Hono<AppEnv>();',
            `router.route('/', ${overlay.importName}Overlay);`,
            '',
            'export default router;',
            '',
        ].join('\n');
    }
    jsonRow(variableName, modelName, constantPrefix, statusCode) {
        const payload = `shapeResponse(${variableName}, '${modelName}', API_OMIT_FIELDS_BY_MODEL, API_RELATION_TARGETS)`;
        if (statusCode === undefined) {
            return `c.json(${payload})`;
        }
        return `c.json(${payload}, ${statusCode})`;
    }
    jsonRows(variableName, modelName) {
        return `c.json(shapeResponseMany(${variableName}, '${modelName}', API_OMIT_FIELDS_BY_MODEL, API_RELATION_TARGETS))`;
    }
    mutationJsonRow(variableName, constantPrefix, statusCode) {
        const payload = `omitFields(${variableName}, ${constantPrefix}_OMIT_FIELDS)`;
        if (statusCode === undefined) {
            return `c.json(${payload})`;
        }
        return `c.json(${payload}, ${statusCode})`;
    }
    generateListRoute(clientKey, modelHasPolicies, listQuerySchemaName, constantPrefix) {
        const listQueryBlock = [
            `  const query = c.req.valid('query');`,
            `  const { where, orderBy, take, skip, include } = buildReadQuery(`,
            `    query,`,
            `    ${constantPrefix}_LIST_QUERY_FIELDS,`,
            `    ${constantPrefix}_SORTABLE_FIELDS,`,
            `    ${constantPrefix}_INCLUDABLE_RELATIONS,`,
            `  );`,
        ];
        const findManyArgs = ['where', 'orderBy', 'take', 'skip', 'include']
            .map((key) => `    ${key},`)
            .join('\n');
        if (!modelHasPolicies) {
            return [
                `router.get('/', validateQuery(${listQuerySchemaName}), async (c) => {`,
                '  const db = c.get(\'db\');',
                ...listQueryBlock,
                `  const rows = await db.${clientKey}.findMany({`,
                findManyArgs,
                '  });',
                `  return ${this.jsonRows('rows', this.model.name)};`,
                '});',
            ];
        }
        return [
            `router.get('/', validateQuery(${listQuerySchemaName}), async (c) => {`,
            '  const db = c.get(\'db\');',
            '  const auth = c.get(\'auth\');',
            `  const policy = assertPolicy('${this.model.name}', auth.role, 'select');`,
            '  const policyWhere = resolvePolicyWhere(policy, auth);',
            ...listQueryBlock,
            `  const rows = await db.${clientKey}.findMany({`,
            '    where: mergeWhere(where, policyWhere),',
            '    orderBy,',
            '    take,',
            '    skip,',
            '    include,',
            '  });',
            `  return ${this.jsonRows('rows', this.model.name)};`,
            '});',
        ];
    }
    generateGetRoute(clientKey, pathParams, paramSchemaName, getQuerySchemaName, whereFromParams, modelHasPolicies, constantPrefix) {
        const includeBlock = [
            '  const query = c.req.valid(\'query\');',
            `  const include = query.include`,
            `    ? parseIncludeQuery(query.include, ${constantPrefix}_INCLUDABLE_RELATIONS)`,
            '    : undefined;',
        ];
        if (!modelHasPolicies) {
            return [
                `router.get('/${pathParams}', validateParam(${paramSchemaName}), validateQuery(${getQuerySchemaName}), async (c) => {`,
                '  const db = c.get(\'db\');',
                '  const params = c.req.valid(\'param\');',
                ...includeBlock,
                `  const row = await db.${clientKey}.findUnique({ ${whereFromParams} }, { include });`,
                '  if (!row) {',
                '    return notFoundResponse(c);',
                '  }',
                `  return ${this.jsonRow('row', this.model.name, constantPrefix)};`,
                '});',
            ];
        }
        return [
            `router.get('/${pathParams}', validateParam(${paramSchemaName}), validateQuery(${getQuerySchemaName}), async (c) => {`,
            '  const db = c.get(\'db\');',
            '  const auth = c.get(\'auth\');',
            `  const policy = assertPolicy('${this.model.name}', auth.role, 'select');`,
            '  const policyWhere = resolvePolicyWhere(policy, auth);',
            '  const params = c.req.valid(\'param\');',
            ...includeBlock,
            `  const row = await db.${clientKey}.findUnique(mergeWhere({ ${whereFromParams} }, policyWhere), { include });`,
            '  if (!row) {',
            '    return notFoundResponse(c);',
            '  }',
            `  return ${this.jsonRow('row', this.model.name, constantPrefix)};`,
            '});',
        ];
    }
    generateCreateRoute(clientKey, modelHasPolicies, modelHasHooks, constantPrefix) {
        const lines = [
            `router.post('/', validateJson(${this.model.name}CreateSchema), async (c) => {`,
            '  const db = c.get(\'db\');',
        ];
        if (modelHasPolicies || modelHasHooks) {
            lines.push('  const auth = c.get(\'auth\');');
        }
        if (modelHasPolicies) {
            lines.push(`  const policy = assertPolicy('${this.model.name}', auth.role, 'insert');`, '  const policyWhere = resolvePolicyWhere(policy, auth);');
        }
        lines.push('  const body = c.req.valid(\'json\');');
        if (modelHasHooks) {
            lines.push(`  const hookCtx = createHookContext({ c, db, auth, model: '${this.model.name}', operation: 'create', data: body });`, `  const gate = await runBeforeHooks('${this.model.name}', 'create', hookCtx);`, '  if (!gate.proceed) return gate.response ?? cancelledResponse(c);');
            if (modelHasPolicies) {
                lines.push(`  const row = await db.${clientKey}.create(hookCtx.data, { where: policyWhere });`);
            }
            else {
                lines.push(`  const row = await db.${clientKey}.create(hookCtx.data);`);
            }
            lines.push('  hookCtx.result = row;', `  await runAfterHooks('${this.model.name}', 'create', hookCtx);`, `  return ${this.mutationJsonRow('hookCtx.result', constantPrefix, 201)};`);
        }
        else if (modelHasPolicies) {
            lines.push(`  const row = await db.${clientKey}.create(body, { where: policyWhere });`, `  return ${this.mutationJsonRow('row', constantPrefix, 201)};`);
        }
        else {
            lines.push(`  const row = await db.${clientKey}.create(body);`, `  return ${this.mutationJsonRow('row', constantPrefix, 201)};`);
        }
        lines.push('});');
        return lines;
    }
    generateUpdateRoute(clientKey, pathParams, paramSchemaName, whereFromParams, modelHasPolicies, modelHasHooks, constantPrefix) {
        const lines = [
            `router.put('/${pathParams}', validateParam(${paramSchemaName}), validateJson(${this.model.name}UpdateSchema), async (c) => {`,
            '  const db = c.get(\'db\');',
        ];
        if (modelHasPolicies || modelHasHooks) {
            lines.push('  const auth = c.get(\'auth\');');
        }
        if (modelHasPolicies) {
            lines.push(`  const policy = assertPolicy('${this.model.name}', auth.role, 'update');`, '  const policyWhere = resolvePolicyWhere(policy, auth);');
        }
        lines.push('  const params = c.req.valid(\'param\');', '  const body = c.req.valid(\'json\');');
        if (modelHasHooks) {
            lines.push(`  const hookCtx = createHookContext({ c, db, auth, model: '${this.model.name}', operation: 'update', data: body, params });`, `  const gate = await runBeforeHooks('${this.model.name}', 'update', hookCtx);`, '  if (!gate.proceed) return gate.response ?? cancelledResponse(c);');
            if (modelHasPolicies) {
                lines.push(`  const row = await db.${clientKey}.update({ where: mergeWhere({ ${whereFromParams} }, policyWhere), data: hookCtx.data });`);
            }
            else {
                lines.push(`  const row = await db.${clientKey}.update({ where: { ${whereFromParams} }, data: hookCtx.data });`);
            }
            lines.push('  hookCtx.result = row;', `  await runAfterHooks('${this.model.name}', 'update', hookCtx);`, `  return ${this.mutationJsonRow('hookCtx.result', constantPrefix)};`);
        }
        else if (modelHasPolicies) {
            lines.push(`  const row = await db.${clientKey}.update({ where: mergeWhere({ ${whereFromParams} }, policyWhere), data: body });`, `  return ${this.mutationJsonRow('row', constantPrefix)};`);
        }
        else {
            lines.push(`  const row = await db.${clientKey}.update({ where: { ${whereFromParams} }, data: body });`, `  return ${this.mutationJsonRow('row', constantPrefix)};`);
        }
        lines.push('});');
        return lines;
    }
    generateDeleteRoute(clientKey, pathParams, paramSchemaName, whereFromParams, modelHasPolicies, modelHasHooks, constantPrefix) {
        const lines = [
            `router.delete('/${pathParams}', validateParam(${paramSchemaName}), async (c) => {`,
            '  const db = c.get(\'db\');',
        ];
        if (modelHasPolicies || modelHasHooks) {
            lines.push('  const auth = c.get(\'auth\');');
        }
        if (modelHasPolicies) {
            lines.push(`  const policy = assertPolicy('${this.model.name}', auth.role, 'delete');`, '  const policyWhere = resolvePolicyWhere(policy, auth);');
        }
        lines.push('  const params = c.req.valid(\'param\');');
        if (modelHasHooks) {
            lines.push(`  const hookCtx = createHookContext({ c, db, auth, model: '${this.model.name}', operation: 'delete', params });`, `  const gate = await runBeforeHooks('${this.model.name}', 'delete', hookCtx);`, '  if (!gate.proceed) return gate.response ?? cancelledResponse(c);');
            if (modelHasPolicies) {
                lines.push(`  const row = await db.${clientKey}.delete(mergeWhere({ ${whereFromParams} }, policyWhere));`);
            }
            else {
                lines.push(`  const row = await db.${clientKey}.delete({ ${whereFromParams} });`);
            }
            lines.push('  hookCtx.result = row;', `  await runAfterHooks('${this.model.name}', 'delete', hookCtx);`, `  return ${this.mutationJsonRow('hookCtx.result', constantPrefix)};`);
        }
        else if (modelHasPolicies) {
            lines.push(`  const row = await db.${clientKey}.delete(mergeWhere({ ${whereFromParams} }, policyWhere));`, `  return ${this.mutationJsonRow('row', constantPrefix)};`);
        }
        else {
            lines.push(`  const row = await db.${clientKey}.delete({ ${whereFromParams} });`, `  return ${this.mutationJsonRow('row', constantPrefix)};`);
        }
        lines.push('});');
        return lines;
    }
    getRouteFileName() {
        return toRouteFileName(this.model.name);
    }
    getRouteBasePath() {
        return toRouteBasePath(this.model.name);
    }
}
export function generateRouteFiles(schema, modelsWithHooksOrOptions = new Set()) {
    const options = normalizeRouteGeneratorOptions(modelsWithHooksOrOptions);
    const files = new Map();
    for (const model of schema.models) {
        const generator = new RouteGenerator(model, schema, options);
        const content = generator.generate();
        if (content !== null) {
            files.set(generator.getRouteFileName(), content);
        }
    }
    for (const [fileName, content] of generateViewRouteFiles(schema)) {
        files.set(fileName, content);
    }
    return files;
}
function normalizeRouteGeneratorOptions(value) {
    if (value instanceof Set) {
        return { modelsWithHooks: value };
    }
    if (value &&
        typeof value === 'object' &&
        'has' in value &&
        typeof value.has === 'function' &&
        !('overlays' in value) &&
        !('modelsWithHooks' in value)) {
        return { modelsWithHooks: value };
    }
    return value;
}
export function getRouteMountEntries(schema, overlays = new Map()) {
    const modelEntries = schema.models
        .filter((model) => isRestEnabled(model) || overlays.has(model.name))
        .map((model) => {
        const basePath = toRouteBasePath(model.name);
        const fileName = toRouteFileName(model.name);
        const importName = toRouteImportName(basePath);
        return { basePath, fileName, importName };
    });
    return [...modelEntries, ...getViewRouteMountEntries(schema)];
}
