import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  CompletionItem,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getCompletions } from './completions.js';
import { parseDocument } from './diagnostics.js';
import { getDefinition } from './definitions.js';
import { getHover } from './hover.js';
import { getReferences } from './references.js';
import { buildSchemaIndex } from './schema-index.js';
import { getDocumentSymbols } from './symbols.js';
import { simpleHash } from './utils.js';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

interface CachedDocument {
  hash: string;
  parseResult: ReturnType<typeof parseDocument>;
  index?: ReturnType<typeof buildSchemaIndex>;
}

const cache = new Map<string, CachedDocument>();

function analyzeDocument(document: TextDocument): CachedDocument {
  const text = document.getText();
  const hash = simpleHash(text);
  const cached = cache.get(document.uri);
  if (cached?.hash === hash) {
    return cached;
  }

  const parseResult = parseDocument(text);
  const analyzed: CachedDocument = { hash, parseResult };
  if (parseResult.schema) {
    analyzed.index = buildSchemaIndex(parseResult.schema);
  }
  cache.set(document.uri, analyzed);
  return analyzed;
}

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: {
      resolveProvider: false,
      triggerCharacters: ['@', ':', ' ', '[', ','],
    },
    definitionProvider: true,
    referencesProvider: true,
    hoverProvider: true,
    documentSymbolProvider: true,
  },
}));

documents.onDidChangeContent((event) => {
  const analyzed = analyzeDocument(event.document);
  connection.sendDiagnostics({
    uri: event.document.uri,
    diagnostics: analyzed.parseResult.diagnostics,
  });
});

connection.onCompletion((params): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const analyzed = analyzeDocument(document);
  return getCompletions(document.getText(), params.position, analyzed.parseResult.schema);
});

connection.onDefinition((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const analyzed = analyzeDocument(document);
  if (!analyzed.index) {
    return null;
  }

  return getDefinition(document.uri, document.getText(), params.position, analyzed.index);
});

connection.onReferences((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const analyzed = analyzeDocument(document);
  if (!analyzed.index) {
    return [];
  }

  return getReferences(document.uri, document.getText(), params.position, analyzed.index);
});

connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const analyzed = analyzeDocument(document);
  if (!analyzed.index) {
    return null;
  }

  const hover = getHover(
    document.getText(),
    params.position,
    analyzed.parseResult.schema,
    analyzed.index,
  );
  return hover ? { contents: { kind: 'markdown', value: hover.contents } } : null;
});

connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const analyzed = analyzeDocument(document);
  if (!analyzed.parseResult.schema) {
    return [];
  }

  return getDocumentSymbols(analyzed.parseResult.schema);
});

documents.listen(connection);
connection.listen();
