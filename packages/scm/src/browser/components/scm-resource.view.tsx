import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { useInjectable, IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeViewAction } from '@ali/ide-core-browser/lib/components';
import { URI, CommandService, SelectableTreeNode, DisposableStore, Event } from '@ali/ide-core-common';
import * as paths from '@ali/ide-core-common/lib/path';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IThemeService } from '@ali/ide-theme';

import { ISCMRepository, SCMMenuId, scmItemLineHeight } from '../../common';
import { ViewModelContext, ResourceGroupSplicer, ISCMDataItem } from '../scm.store';
import { isSCMResource, getSCMResourceContextKey } from '../scm-util';
import { getIcon } from '@ali/ide-theme/lib/browser';

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
    icon: getIcon('open'),
    title: 'Open file',
    command: 'git.openFile2',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitClean]: {
    icon: getIcon('withdraw'),
    title: 'Discard changes',
    command: 'git.clean',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitCleanAll]: {
    icon: getIcon('withdraw'),
    title: 'Discard all changes',
    command: 'git.cleanAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitStage]: {
    icon: getIcon('plus'),
    title: 'Stage changes',
    command: 'git.stage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitStageAll]: {
    icon: getIcon('plus'),
    title: 'Stage all changes',
    command: 'git.stageAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitUnstage]: {
    icon: getIcon('line'),
    title: 'Unstage changes',
    command: 'git.unstage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitUnstageAll]: {
    icon: getIcon('line'),
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

  const viewModel = React.useContext(ViewModelContext);
  const [ selectedNodeId, setSelectedNodeId ] = React.useState<string | number>();

  const ref = React.useRef<{
    [key: string]: IContextKey<any>;
  }>({});

  React.useEffect(() => {
    // 挂在 ctx service
    ref.current.scmProviderCtx = contextKeyService.createKey<string | undefined>('scmProvider', undefined);
    ref.current.scmResourceGroupCtx = contextKeyService.createKey<string | undefined>('scmResourceGroup', undefined);
  }, []);

  React.useEffect(() => {
    const disposables = new DisposableStore();

    const resourceGroup = new ResourceGroupSplicer(repository);
    ref.current.scmProviderCtx.set(repository.provider ? repository.provider.contextValue : '');

    // 只处理当前 repository 的事件
    const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repository);
    disposables.add(repoOnDidSplice(({ index, deleteCount, elements }) => {
      viewModel.spliceSCMList(index, deleteCount, ...elements);
    }));

    resourceGroup.run();

    return () => {
      ref.current.scmProviderCtx.set(undefined);
      resourceGroup.dispose();
      disposables.dispose();
    };
  }, [ repository ]);

  const nodes = useComputed(() => {
    return viewModel.scmList.map((item) => {
      if (!isSCMResource(item)) {
        // SCMResourceGroup
        const nodeId = item.id;
        return {
          origin: item,
          resourceState: item.toJSON(),
          isFile: false,
          id: nodeId,
          name: item.label,
          depth: 0,
          parent: undefined,
          actions: getRepoGroupActions(item.id),
          badge: item.elements.length,
          selected: selectedNodeId === nodeId,
          style: { fontWeight: 'bold' },
        } as SelectableTreeNode;
      }

      const color = item.decorations.color ? themeService.getColor({
        id: item.decorations.color,
      }) : null;

      // SCMResource
      const nodeId = item.resourceGroup.id + item.sourceUri;
      return {
        origin: item,
        resourceState: item.toJSON(),
        id: item.resourceGroup.id + item.sourceUri,
        name: paths.basename(item.sourceUri.toString()),
        depth: 0,
        parent: undefined,
        actions: getRepoFileActions(item.resourceGroup.id),
        badge: item.decorations.letter,
        icon: labelService.getIcon(URI.from(item.sourceUri)),
        badgeStyle: color ?  { color } : null,
        tooltip: item.decorations.tooltip,
        selected: selectedNodeId === nodeId,
      } as SelectableTreeNode;
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

    const item: ISCMDataItem = file.origin;

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

    const item: ISCMDataItem = file.origin;
    ref.current.scmResourceGroupCtx.set(getSCMResourceContextKey(item));

    // scm resource group/item 的参数不同
    // @fixme 参数混杂 x,y 问题待 ctxkey/menu 问题更新后一并解决
    const data = isSCMResource(item)
      ? { x, y, ...file.resourceState }
      : { x, y, ...repository.provider.toJSON() };

    contextMenuRenderer.render(
      [ isSCMResource(item) ? SCMMenuId.SCM_RESOURCE_STATE_CTX : SCMMenuId.SCM_RESOURCE_GROUP_CTX ],
      data,
      () => { ref.current.scmResourceGroupCtx.set(undefined); },
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
