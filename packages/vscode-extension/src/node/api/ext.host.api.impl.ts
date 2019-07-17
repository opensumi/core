import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService, ExtHostAPIIdentifier } from '../../common';
import { createCommandsApiFactory } from './ext.commands.host.api.impl';
import { createWindowApiFactory } from './ext.window.host.api.impl';
import { createDocumentModelApiFactory } from './ext.doc.host.api.impl';
import { createLanguagesApiFactory } from './ext.languages.host.api.impl';
import { ExtensionDocumentDataManagerImpl } from '../doc';
import { Hover, CompletionItem, SnippetString, MarkdownString, CompletionItemKind, Location } from '../../common/ext-types';
import { ExtHostCommandsRegistry } from './ext.command.host';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionProcessService,
) {
  const extHostDocs = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostDocuments, new ExtensionDocumentDataManagerImpl(rpcProtocol));
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);

  createDocumentModelApiFactory(rpcProtocol);
  const extHostCommandsRegistry = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCommandsRegistry, new ExtHostCommandsRegistry(rpcProtocol));

  return (extension) => {
    return {
      commands: createCommandsApiFactory(extHostCommandsRegistry),
      window: createWindowApiFactory(rpcProtocol),
      languages: createLanguagesApiFactory(rpcProtocol, extHostDocs),
      Hover,
      CompletionItem,
      CompletionItemKind,
      SnippetString,
      MarkdownString,
      Location,
    };
  };
}
