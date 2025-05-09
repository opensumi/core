import { Autowired } from '@opensumi/di';
import {
  CommandContribution,
  CommandRegistry,
  Domain,
  IDisposable,
  MULTI_DIFF_EDITOR_COMMANDS,
  URI,
  localize,
} from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import { ResourceService, WorkbenchEditorService } from '../../common';
import { IMultiDiffSourceResolverService } from '../../common/multi-diff';
import {
  BrowserEditorContribution,
  EditorComponentRegistry,
  EditorOpenType,
  MultiDiffSourceContribution,
} from '../types';

import { MultiDiffResolver } from './multi-diff-resolver';
import { MultiDiffResourceProvider } from './multi-diff-resource';

@Domain(BrowserEditorContribution, MultiDiffSourceContribution, MenuContribution, CommandContribution)
export class MultiDiffEditorContribution
  implements BrowserEditorContribution, MultiDiffSourceContribution, MenuContribution, CommandContribution
{
  @Autowired(IMultiDiffSourceResolverService)
  private readonly multiDiffSourceResolverService: IMultiDiffSourceResolverService;

  @Autowired(MultiDiffResolver)
  private readonly multiDiffResolver: MultiDiffResolver;

  @Autowired()
  private readonly multiDiffResourceProvider: MultiDiffResourceProvider;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  registerMultiDiffSourceResolver(resolverService: IMultiDiffSourceResolverService): IDisposable {
    // 内置实现，通过 command 使用
    return resolverService.registerResolver(this.multiDiffResolver);
  }

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider(this.multiDiffResourceProvider);
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponentResolver(
      (scheme) => {
        const resolvers = this.multiDiffSourceResolverService.getResolvers();
        for (const resolver of resolvers) {
          if (
            resolver.canHandleUri(
              URI.from({
                scheme,
                path: 'empty',
              }),
            )
          ) {
            return 10;
          }
        }
        return -1;
      },
      (resource, results) => {
        results.push({
          type: EditorOpenType.multiDiff,
        });
      },
    );
  }

  registerCommands(commandsRegistry: CommandRegistry) {
    commandsRegistry.registerCommand(MULTI_DIFF_EDITOR_COMMANDS.COLLAPSE_FILES, {
      execute: () => {
        const group = this.workbenchEditorService.currentEditorGroup;
        if (group.currentOpenType?.type === EditorOpenType.multiDiff) {
          group.multiDiffEditor.collapseAll();
        }
      },
    });
    commandsRegistry.registerCommand(MULTI_DIFF_EDITOR_COMMANDS.EXPAND_FILES, {
      execute: () => {
        const group = this.workbenchEditorService.currentEditorGroup;
        if (group.currentOpenType?.type === EditorOpenType.multiDiff) {
          group.multiDiffEditor.expandAll();
        }
      },
    });
  }

  registerMenus(menu: IMenuRegistry) {
    menu.registerMenuItems(MenuId.EditorTitle, [
      {
        command: {
          id: MULTI_DIFF_EDITOR_COMMANDS.COLLAPSE_FILES.id,
          label: localize('multiDiffEditor.action.collapseFiles'),
        },
        iconClass: 'codicon codicon-collapse-all',
        group: 'navigation',
        // TODO: 通过更精细的事件判断当前viewState是否已经全部折叠
        when: 'isInMultiDiffEditor',
      },
    ]);
    menu.registerMenuItems(MenuId.EditorTitle, [
      {
        command: {
          id: MULTI_DIFF_EDITOR_COMMANDS.EXPAND_FILES.id,
          label: localize('multiDiffEditor.action.expandFiles'),
        },
        iconClass: 'codicon codicon-expand-all',
        group: 'navigation',
        when: 'isInMultiDiffEditor',
      },
    ]);
  }
}
