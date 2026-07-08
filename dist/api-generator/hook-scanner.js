import { existsSync, readdirSync } from 'node:fs';
function isHookFile(filename) {
    return (filename.endsWith('.ts') &&
        !filename.endsWith('.test.ts') &&
        !filename.endsWith('.d.ts') &&
        !filename.startsWith('_'));
}
function toHookImportName(modelName) {
    return `${modelName.charAt(0).toLowerCase()}${modelName.slice(1)}Hooks`;
}
export function discoverHooks(hooksDir, schema) {
    if (!existsSync(hooksDir)) {
        return { entries: [], modelsWithHooks: new Set() };
    }
    const modelNames = new Set(schema.models.map((model) => model.name));
    const entries = [];
    const modelsWithHooks = new Set();
    for (const filename of readdirSync(hooksDir)) {
        if (!isHookFile(filename)) {
            continue;
        }
        const modelName = filename.replace(/\.ts$/, '');
        if (!modelNames.has(modelName)) {
            console.warn(`Skipping hook file "${filename}": no matching model in schema`);
            continue;
        }
        entries.push({
            modelName,
            importName: toHookImportName(modelName),
            importPath: `../src/hooks/${modelName}.js`,
        });
        modelsWithHooks.add(modelName);
    }
    entries.sort((left, right) => left.modelName.localeCompare(right.modelName));
    return { entries, modelsWithHooks };
}
