import { Autowired } from '@opensumi/di';
import {
  Domain,
  CommandContribution,
  CommandRegistry,
  Event,
  IContextKeyService,
  IContextKey,
  Uri,
} from '@opensumi/ide-core-browser';
import { RawContextKey } from '@opensumi/ide-core-browser/lib/raw-context-key';
import {
  CallHierarchyItem,
  CallHierarchyProviderRegistry,
  ICallHierarchyService,
} from '@opensumi/ide-monaco/lib/browser/contrib/callHierarchy';
import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';

import { BrowserEditorContribution, IEditor, IEditorFeatureRegistry } from '../../types';

export const executePrepareCallHierarchyCommand = {
  id: '_executePrepareCallHierarchy',
};

export const executeProvideIncomingCallsCommand = {
  id: '_executeProvideIncomingCalls',
};

export const executeProvideOutgoingCallsCommand = {
  id: '_executeProvideOutgoingCalls',
};

const _ctxHasCallHierarchyProvider = new RawContextKey<boolean>('editorHasCallHierarchyProvider', false);

@Domain(CommandContribution, BrowserEditorContribution)
export class CallHierarchyContribution implements CommandContribution, BrowserEditorContribution {
  private ctxHasProvider: IContextKey<boolean>;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(ICallHierarchyService)
  protected readonly callHierarchyService: ICallHierarchyService;

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(executePrepareCallHierarchyCommand, {
      execute: (resource: Uri, position: Position) =>
        this.callHierarchyService.prepareCallHierarchyProvider(resource, position),
    });

    commands.registerCommand(executeProvideIncomingCallsCommand, {
      execute: (item: CallHierarchyItem) => this.callHierarchyService.provideIncomingCalls(item),
    });

    commands.registerCommand(executeProvideOutgoingCallsCommand, {
      execute: (item: CallHierarchyItem) => this.callHierarchyService.provideOutgoingCalls(item),
    });
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    this.ctxHasProvider = _ctxHasCallHierarchyProvider.bind(this.contextKeyService);

    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        const monacoEditor = editor.monacoEditor;
        return Event.any<any>(
          monacoEditor.onDidChangeModel,
          monacoEditor.onDidChangeModelLanguage,
          CallHierarchyProviderRegistry.onDidChange,
        )(() => {
          if (monacoEditor.hasModel()) {
            this.ctxHasProvider.set(CallHierarchyProviderRegistry.has(monacoEditor.getModel()));
          }
        });
      },
    });
  }
}
