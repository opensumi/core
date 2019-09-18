import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { useInjectable, IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import { CommandService, DisposableStore, Event } from '@ali/ide-core-common';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';

import { ISCMRepository, SCMMenuId, scmItemLineHeight } from '../../common';
import { ViewModelContext, ResourceGroupSplicer, ISCMDataItem } from '../scm.store';
import { isSCMResource, getSCMResourceContextKey } from '../scm-util';
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
  const contextMenuRenderer = useInjectable<ContextMenuRenderer>(ContextMenuRenderer);
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);
  const injector = useInjectable<Injector>(INJECTOR_TOKEN);

  const viewModel = React.useContext(ViewModelContext);
  const [ selectedNodeId, setSelectedNodeId ] = React.useState<string | number>();

  const $that = React.useRef<{
    scmMenuService?: SCMMenus;
    scmProviderCtx?: IContextKey<string | undefined>;
    scmResourceGroupCtx?: IContextKey<string | undefined>;
  }>({});

  React.useEffect(() => {
    // 挂在 scm menu service
    const disposables = new DisposableStore();
    $that.current.scmMenuService = injector.get(SCMMenus, [repository.provider]);
    disposables.add($that.current.scmMenuService);
    return () => {
      disposables.dispose();
    };
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
      return isSCMResource(item)
        ? injector.get(SCMResourceTreeNode, [item, $that.current.scmMenuService!])
        : new SCMResourceGroupTreeNode(item, $that.current.scmMenuService!);
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
    if ($that.current.scmResourceGroupCtx) {
      $that.current.scmResourceGroupCtx.set(getSCMResourceContextKey(item));
    }
    // scm resource group/item 的参数不同
    // @fixme 参数混杂 x,y 问题待 ctxkey/menu 问题更新后一并解决
    const data = isSCMResource(item)
      ? { x, y, ...file.resourceState }
      : { x, y, ...repository.provider.toJSON() };

    contextMenuRenderer.render(
      [ isSCMResource(item) ? SCMMenuId.SCM_RESOURCE_STATE_CTX : SCMMenuId.SCM_RESOURCE_GROUP_CTX ],
      data,
      () => {
        if ($that.current.scmResourceGroupCtx) {
          $that.current.scmResourceGroupCtx.set(undefined);
        }
      },
    );
  }, []);

  return (
    <RecycleTree
      nodes={nodes}
      onSelect={handleFileSelect}
      onContextMenu={onContextMenu}
      scrollContainerStyle={{ width, height }}
      containerHeight={ height }
      itemLineHeight={ scmItemLineHeight }
      commandActuator={commandActuator}
    />
  );
});

SCMResouceList.displayName = 'SCMRepoTree';
