import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
export function parseFragment(source, filePath = '') {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenizeAll();
    const parser = new Parser(tokens, filePath || undefined);
    return parser.parseSchema();
}
function byName(left, right) {
    return left.name.localeCompare(right.name);
}
function sliceDeclaration(source, loc) {
    return source.slice(loc.start, loc.end);
}
function indentBlock(text, indent = '  ') {
    return text
        .split('\n')
        .map((line) => (line.length === 0 ? line : `${indent}${line}`))
        .join('\n');
}
function formatSection(name, bodies) {
    if (bodies.length === 0) {
        return null;
    }
    return `${name} {\n\n${bodies.map((body) => indentBlock(body)).join('\n\n')}\n\n}`;
}
export function mergeFragments(fragments) {
    const extensionEntries = [];
    const enumEntries = [];
    const modelEntries = [];
    const functionEntries = [];
    for (const fragment of fragments) {
        for (const item of fragment.schema.extensions) {
            extensionEntries.push({ item, source: fragment.source });
        }
        for (const item of fragment.schema.enums) {
            enumEntries.push({ item, source: fragment.source });
        }
        for (const item of fragment.schema.models) {
            modelEntries.push({ item, source: fragment.source });
        }
        for (const item of fragment.schema.functions) {
            functionEntries.push({ item, source: fragment.source });
        }
    }
    extensionEntries.sort((left, right) => byName(left.item, right.item));
    enumEntries.sort((left, right) => byName(left.item, right.item));
    modelEntries.sort((left, right) => byName(left.item, right.item));
    functionEntries.sort((left, right) => byName(left.item, right.item));
    const extensions = extensionEntries.map((entry) => entry.item);
    const enums = enumEntries.map((entry) => entry.item);
    const models = modelEntries.map((entry) => entry.item);
    const functions = functionEntries.map((entry) => entry.item);
    const schema = {
        kind: 'Schema',
        extensions,
        enums,
        models,
        functions,
        loc: {
            line: 1,
            col: 1,
            start: 0,
            end: 0,
        },
    };
    const sections = [
        formatSection('extensions', extensionEntries.map((entry) => sliceDeclaration(entry.source, entry.item.loc))),
        formatSection('enums', enumEntries.map((entry) => sliceDeclaration(entry.source, entry.item.loc))),
        formatSection('models', modelEntries.map((entry) => sliceDeclaration(entry.source, entry.item.loc))),
        formatSection('functions', functionEntries.map((entry) => sliceDeclaration(entry.source, entry.item.loc))),
    ].filter((section) => section !== null);
    const canonicalSource = sections.length > 0 ? `${sections.join('\n\n')}\n` : '';
    return { schema, canonicalSource };
}
