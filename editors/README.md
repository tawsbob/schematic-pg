# Editor Tooling

This folder contains IDE support for the PostgREST Schema DSL (`.schema` files).

## Packages

| Package | Path | Purpose |
|---------|------|---------|
| Language Server | [`language-server/`](language-server/) | Diagnostics, completions, navigation, outline |
| VS Code / Cursor Extension | [`vscode/`](vscode/) | Syntax highlighting + LSP client |

Shared assets live at the repo root:

- [`../syntaxes/schema-dsl.tmLanguage.json`](../syntaxes/schema-dsl.tmLanguage.json)
- [`../language-configuration/schema-dsl.language-configuration.json`](../language-configuration/schema-dsl.language-configuration.json)

## Development

Install dependencies from the repo root:

```bash
npm install
```

Build the language server and extension:

```bash
npm run build:lsp
npm run build:extension
```

Or from the extension package:

```bash
npm run compile --workspace=postgrest-schema-dsl-vscode
```

### Run in Extension Development Host

1. Open this repository in VS Code or Cursor.
2. Run the **Run Extension** launch config from [`vscode/.vscode/launch.json`](vscode/.vscode/launch.json).
3. Open `app.schema` in the Extension Development Host window.

## Local install

After `npm run build:extension`, install the generated VSIX:

```bash
code --install-extension editors/vscode/*.vsix
```

Cursor uses the same VSIX install flow.

## Features

- Syntax highlighting for keywords, PostgreSQL types, decorators, enums, and SQL trigger bodies
- Parse diagnostics from the shared `src/schema-dsl` parser
- Document outline for enums, models, fields, and model directives
- Completions for decorators, PostgreSQL types, enums, models, and relation/policy/trigger keys
- Go to definition for enums and models
- Find references for type usages
- Hover for models, enums, and fields

## Tests

```bash
npm test
```

Editor-specific tests live in [`language-server/__tests__/`](language-server/__tests__/).
