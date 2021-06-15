import { Domain, CommandContribution, CommandRegistry, URI, Event, IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { Position } from '@ali/monaco-editor-core/esm/vs/editor/common/core/position';
import { Autowired } from '@ali/common-di';
import { ICallHierarchyService, CallHierarchyProviderRegistry } from './callHierarchy.service';
import { CallHierarchyItem } from '../../common';
import { BrowserEditorContribution, IEditorFeatureRegistry, IEditor } from '@ali/ide-editor/lib/browser';
import { RawContextKey } from '@ali/ide-core-browser/lib/raw-context-key';

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
      execute: (resource: URI, position: Position) => {
        return this.callHierarchyService.prepareCallHierarchyProvider(resource, position);
      },
    });

    commands.registerCommand(executeProvideIncomingCallsCommand, {
      execute: (item: CallHierarchyItem) => {
        return this.callHierarchyService.provideIncomingCalls(item);
      },
    });

    commands.registerCommand(executeProvideOutgoingCallsCommand, {
      execute: (item: CallHierarchyItem) => {
        return this.callHierarchyService.provideOutgoingCalls(item);
      },
    });
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    this.ctxHasProvider = _ctxHasCallHierarchyProvider.bind(this.contextKeyService);
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        const monacoEditor = editor.monacoEditor;
        return Event.any<any>(monacoEditor.onDidChangeModel, monacoEditor.onDidChangeModelLanguage, CallHierarchyProviderRegistry.onDidChange)(() => {
          this.ctxHasProvider.set(monacoEditor.hasModel() && CallHierarchyProviderRegistry.has(monacoEditor.getModel()));
        });
      },
    });
  }
}
