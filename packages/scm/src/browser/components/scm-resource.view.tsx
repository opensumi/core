import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { useInjectable, IContextKeyService, IContextKey, useDisposable } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import { CommandService, DisposableStore, Event } from '@ali/ide-core-common';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';
import { splitMenuItems } from '@ali/ide-core-browser/lib/menu/next/menu-util';

import { ISCMRepository, scmItemLineHeight } from '../../common';
import { ViewModelContext, ResourceGroupSplicer, ISCMDataItem } from '../scm.store';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { isSCMResource } from '../scm-util';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { SCMMenus } from '../scm-menu';
import { SCMResourceGroupTreeNode, SCMResourceTreeNode } from '../scm-resource';

enum GitActionList {
  gitOpenResource = 'git.openResource',
}

export const SCMResouceList: React.FC<{
  width: number;
  height: number;
  repository: ISCMRepository;
}> = observer(({ width, height, repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
  const injector = useInjectable<Injector>(INJECTOR_TOKEN);

  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);
  const [ selectedNodeId, setSelectedNodeId ] = React.useState<string | number>();

  const $that = React.useRef<{
    scmMenuService?: SCMMenus;
    scmProviderCtx?: IContextKey<string | undefined>;
    scmResourceGroupCtx?: IContextKey<string | undefined>;
  }>({});

  useDisposable(() => {
    // 挂在 scm menu service
    $that.current.scmMenuService = injector.get(SCMMenus, [repository.provider]);
    return [$that.current.scmMenuService];
  }, [ repository ]);

  React.useEffect(() => {
    // 挂在 ctx key service
    $that.current.scmProviderCtx = contextKeyService.createKey<string | undefined>('scmProvider', undefined);
    $that.current.scmResourceGroupCtx = contextKeyService.createKey<string | undefined>('scmResourceGroup', undefined);
  }, []);

  React.useEffect(() => {
    const disposables = new DisposableStore();

    const resourceGroup = new ResourceGroupSplicer(repository);
    if ($that.current.scmProviderCtx) {
      $that.current.scmProviderCtx.set(repository.provider ? repository.provider.contextValue : '');
    }

    // 只处理当前 repository 的事件
    const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repository);
    disposables.add(repoOnDidSplice(({ index, deleteCount, elements }) => {
      viewModel.spliceSCMList(index, deleteCount, ...elements);
    }));

    resourceGroup.run();

    return () => {
      if ($that.current.scmProviderCtx) {
        $that.current.scmProviderCtx.set(undefined);
      }
      resourceGroup.dispose();
      disposables.dispose();
    };
  }, [ repository ]);

  const nodes = useComputed(() => {
    return viewModel.scmList.map((item) => {
      const resourceItem = isSCMResource(item)
        ? injector.get(SCMResourceTreeNode, [item, $that.current.scmMenuService!])
        : new SCMResourceGroupTreeNode(item, $that.current.scmMenuService!);

      resourceItem.selected = selectedNodeId === resourceItem.id;
      return resourceItem;
    });
  }, [ viewModel.scmList, selectedNodeId ]);

  const commandActuator = React.useCallback((command: string, params?) => {
    return commandService.executeCommand(command, params);
  }, []);

  const handleFileSelect = React.useCallback((files: TreeNode[]) => {
    const file: TreeNode = files[0];
    if (!file) {
      return;
    }

    // 控制选中状态
    setSelectedNodeId(file.id);

    const item: ISCMDataItem = file.item;

    if (!isSCMResource(item)) {
      return;
    }

    return commandService.executeCommand(GitActionList.gitOpenResource, file.resourceState);
  }, []);

  const onContextMenu = React.useCallback((files, event: React.MouseEvent<HTMLElement>) => {
    const { x, y } = event.nativeEvent;
    const file: TreeNode = files[0];
    if (!file) {
      return;
    }

    const item: ISCMDataItem = file.item;

    const ctxmenuActions = isSCMResource(item)
      ? $that.current.scmMenuService!.getResourceContextActions(item)
      : $that.current.scmMenuService!.getResourceGroupContextActions(item);

    ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes: ctxmenuActions,
      context: [ isSCMResource(item) ? file.resourceState : repository.provider.toJSON() ],
    });
  }, []);

  return (
    <RecycleTree
      nodes={nodes}
      onSelect={handleFileSelect}
      onContextMenu={onContextMenu}
      scrollContainerStyle={{ width: '100%', height }}
      containerHeight={ height }
      itemLineHeight={ scmItemLineHeight }
      commandActuator={commandActuator}
    />
  );
});

SCMResouceList.displayName = 'SCMRepoTree';
