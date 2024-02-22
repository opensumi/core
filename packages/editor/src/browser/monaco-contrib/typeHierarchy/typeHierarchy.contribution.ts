import { Autowired } from '@opensumi/di';
import {
  CommandContribution,
  CommandRegistry,
  Domain,
  Event,
  IContextKey,
  IContextKeyService,
  Uri,
} from '@opensumi/ide-core-browser';
import { RawContextKey } from '@opensumi/ide-core-browser/lib/raw-context-key';
import {
  ITypeHierarchyService,
  TypeHierarchyItem,
  TypeHierarchyProviderRegistry,
} from '@opensumi/ide-monaco/lib/browser/contrib/typeHierarchy';
import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';

import { BrowserEditorContribution, IEditor, IEditorFeatureRegistry } from '../../types';

export const executePrepareTypeHierarchyCommand = {
  id: '_executePrepareTypeHierarchy',
};

export const executeProvideSupertypesCommand = {
  id: '_executeProvideSupertypes',
};

export const executeProvideSubtypesCommand = {
  id: '_executeProvideSubtypes',
};

const _ctxHasCallHierarchyProvider = new RawContextKey<boolean>('editorHasCallHierarchyProvider', false);

@Domain(CommandContribution, BrowserEditorContribution)
export class TypeHierarchyContribution implements CommandContribution, BrowserEditorContribution {
  private ctxHasProvider: IContextKey<boolean>;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(ITypeHierarchyService)
  protected readonly typeHierarchyService: ITypeHierarchyService;

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(executePrepareTypeHierarchyCommand, {
      execute: (resource: Uri, position: Position) =>
        this.typeHierarchyService.prepareTypeHierarchyProvider(resource, position),
    });

    commands.registerCommand(executeProvideSupertypesCommand, {
      execute: (item: TypeHierarchyItem) => this.typeHierarchyService.provideSupertypes(item),
    });

    commands.registerCommand(executeProvideSubtypesCommand, {
      execute: (item: TypeHierarchyItem) => this.typeHierarchyService.provideSubtypes(item),
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
          TypeHierarchyProviderRegistry.onDidChange,
        )(() => {
          if (monacoEditor.hasModel()) {
            this.ctxHasProvider.set(TypeHierarchyProviderRegistry.has(monacoEditor.getModel()));
          }
        });
      },
    });
  }
}
