import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { select } from '@inquirer/prompts';
import { discoverHooks } from '../api-generator/hook-scanner.js';
import { PACKAGE_NAME } from '../constants.js';
import { parse } from '../schema-dsl/index.js';
import { DEFAULT_HOOKS_DIR, resolveSchemaPath } from './paths.js';
import { createHookFileTemplate } from './templates.js';
function parseModelFlag(args) {
    const modelIndex = args.indexOf('--model');
    if (modelIndex === -1) {
        return undefined;
    }
    const modelName = args[modelIndex + 1];
    if (!modelName || modelName.startsWith('--')) {
        throw new Error('Missing value for --model');
    }
    return modelName;
}
function resolveSchemaArg(args) {
    const positional = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--model') {
            index += 1;
            continue;
        }
        if (!arg.startsWith('--')) {
            positional.push(arg);
        }
    }
    return positional[0];
}
function getHookFilePath(hooksDir, modelName) {
    return path.join(hooksDir, `${modelName}.ts`);
}
function assertModelExists(schema, modelName) {
    const model = schema.models.find((entry) => entry.name === modelName);
    if (!model) {
        throw new Error(`Model "${modelName}" was not found in schema`);
    }
    return model;
}
function assertHookFileDoesNotExist(hooksDir, modelName) {
    const hookFilePath = getHookFilePath(hooksDir, modelName);
    if (existsSync(hookFilePath)) {
        throw new Error(`Hook file already exists: ${hookFilePath}`);
    }
}
async function promptForModel(models, hooksDir, schema) {
    const { modelsWithHooks } = discoverHooks(hooksDir, schema);
    const availableModels = models
        .map((model) => model.name)
        .filter((modelName) => !modelsWithHooks.has(modelName))
        .sort((left, right) => left.localeCompare(right));
    if (availableModels.length === 0) {
        throw new Error('All schema models already have hook files in src/hooks/');
    }
    return select({
        message: 'Select a model to scaffold lifecycle hooks',
        choices: availableModels.map((modelName) => ({
            name: modelName,
            value: modelName,
        })),
    });
}
export async function runHooksAdd(args, options = {}) {
    const schemaPath = resolveSchemaPath(options.schemaPath ?? resolveSchemaArg(args));
    const hooksDir = options.hooksDir ?? DEFAULT_HOOKS_DIR;
    const source = await readFile(schemaPath, 'utf8');
    const schema = parse(source);
    if (schema.models.length === 0) {
        throw new Error('Schema has no models');
    }
    const modelName = options.modelName ?? parseModelFlag(args) ?? (await promptForModel(schema.models, hooksDir, schema));
    assertModelExists(schema, modelName);
    assertHookFileDoesNotExist(hooksDir, modelName);
    await mkdir(hooksDir, { recursive: true });
    const hookFilePath = getHookFilePath(hooksDir, modelName);
    await writeFile(hookFilePath, createHookFileTemplate(modelName), 'utf8');
    console.log(`Created ${path.relative(process.cwd(), hookFilePath)}`);
    console.log(`\nNext step: run \`${PACKAGE_NAME} generate:api\` to wire hooks into generated routes.`);
    return hookFilePath;
}
