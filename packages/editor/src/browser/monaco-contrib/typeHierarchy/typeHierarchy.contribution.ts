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
import { ITypeHierarchyService, TypeHierarchyItem } from '@opensumi/ide-monaco/lib/browser/contrib/typeHierarchy';
import { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';

export const executePrepareTypeHierarchyCommand = {
  id: '_executePrepareTypeHierarchy',
};

export const executeProvideSupertypesCommand = {
  id: '_executeProvideSupertypes',
};

export const executeProvideSubtypesCommand = {
  id: '_executeProvideSubtypes',
};

@Domain(CommandContribution)
export class TypeHierarchyContribution implements CommandContribution {
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
}
