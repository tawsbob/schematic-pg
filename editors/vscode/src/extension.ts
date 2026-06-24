import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node.js';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.IPC,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.IPC,
      options: {
        execArgv: ['--nolazy', '--inspect=6010'],
      },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'schema-dsl' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.schema'),
    },
  };

  client = new LanguageClient('schemaDsl', 'Schema DSL Language Server', serverOptions, clientOptions);
  context.subscriptions.push(client.start());
}

export async function deactivate(): Promise<void> {
  if (!client) {
    return;
  }
  await client.stop();
}
