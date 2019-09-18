import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { useInjectable, IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeViewAction } from '@ali/ide-core-browser/lib/components';
import { URI, CommandService, SelectableTreeNode, DisposableStore, Event } from '@ali/ide-core-common';
import * as paths from '@ali/ide-core-common/lib/path';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IThemeService } from '@ali/ide-theme';
import { IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next/base';
import { MenuService } from '@ali/ide-core-browser/lib/menu/next/menu-service';
import { splitMenuItems, isInlineGroup } from '@ali/ide-core-browser/lib/menu/next/menu-util';

import { ISCMRepository, SCMMenuId, scmItemLineHeight } from '../../common';
import { ViewModelContext, ResourceGroupSplicer, ISCMDataItem } from '../scm.store';
import { isSCMResource, getSCMResourceContextKey } from '../scm-util';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { SCMMenus } from '../scm-menu';
import { SCMResourceGroupTreeNode, SCMResourceTreeNode } from '../scm-resource';

enum GitActionList {
  gitOpenFile = 'git.openFile2',
  gitCommit = 'git.commit',
  gitRefresh = 'git.refresh',
  gitClean = 'git.clean',
  gitCleanAll = 'git.cleanAll',
  gitStage = 'git.stage',
  gitStageAll = 'git.stageAll',
  gitUnstage = 'git.unstage',
  gitUnstageAll = 'git.unstageAll',
  gitOpenResource = 'git.openResource',
}

const repoTreeActionConfig = {
  [GitActionList.gitOpenFile]: {
    icon: 'volans_icon open',
    title: 'Open file',
    command: 'git.openFile2',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitClean]: {
    icon: 'volans_icon withdraw',
    title: 'Discard changes',
    command: 'git.clean',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitCleanAll]: {
    icon: 'volans_icon withdraw',
    title: 'Discard all changes',
    command: 'git.cleanAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitStage]: {
    icon: 'volans_icon plus',
    title: 'Stage changes',
    command: 'git.stage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitStageAll]: {
    icon: 'volans_icon plus',
    title: 'Stage all changes',
    command: 'git.stageAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitUnstage]: {
    icon: 'volans_icon line',
    title: 'Unstage changes',
    command: 'git.unstage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitUnstageAll]: {
    icon: 'volans_icon line',
    title: 'Unstage all changes',
    command: 'git.unstageAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
};

function getRepoGroupActions(groupId: string) {
  if (groupId === 'merge') {
    return [{
      ...repoTreeActionConfig[GitActionList.gitStageAll],
      paramsKey: 'resourceState',
    }];
  }

  if (groupId === 'index') {
    return [{
      ...repoTreeActionConfig[GitActionList.gitUnstageAll],
      paramsKey: 'resourceState',
    }];
  }

  if (groupId === 'workingTree') {
    return [{
      ...repoTreeActionConfig[GitActionList.gitCleanAll],
      paramsKey: 'resourceState',
    }, {
      ...repoTreeActionConfig[GitActionList.gitStageAll],
      paramsKey: 'resourceState',
    }];
  }
}

function getRepoFileActions(groupId: string) {
  const actionList: TreeViewAction[] = [{
    ...repoTreeActionConfig[GitActionList.gitOpenFile],
    paramsKey: 'resourceState',
  }];

  if (groupId === 'merge') {
    return actionList.concat({
      ...repoTreeActionConfig[GitActionList.gitStage],
      paramsKey: 'resourceState',
    });
  }

  if (groupId === 'index') {
    return actionList.concat({
      ...repoTreeActionConfig[GitActionList.gitUnstage],
      paramsKey: 'resourceState',
    });
  }

  if (groupId === 'workingTree') {
    return actionList.concat({
      ...repoTreeActionConfig[GitActionList.gitClean],
      paramsKey: 'resourceState',
    }, {
      ...repoTreeActionConfig[GitActionList.gitStage],
      paramsKey: 'resourceState',
    });
  }

  return actionList;
}

export const SCMResouceList: React.FC<{
  width: number;
  height: number;
  repository: ISCMRepository;
}> = observer(({ width, height, repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const labelService = useInjectable<LabelService>(LabelService);
  const contextMenuRenderer = useInjectable<ContextMenuRenderer>(ContextMenuRenderer);
  const themeService = useInjectable<IThemeService>(IThemeService);
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);
  const menuService = useInjectable<MenuService>(MenuService);
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

  console.log(nodes, 'xxxxx');

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
