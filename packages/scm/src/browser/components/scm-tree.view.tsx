import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { useInjectable, IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeViewAction } from '@ali/ide-core-browser/lib/components';
import { URI, CommandService, SelectableTreeNode } from '@ali/ide-core-common';
import * as paths from '@ali/ide-core-common/lib/path';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IThemeService } from '@ali/ide-theme';

import { ISCMRepository, SCMMenuId } from '../../common';
import { ViewModelContext, ResourceGroupSplicer, ISCMDataItem } from '../scm.store';
import { isSCMResource, getSCMResourceContextKey } from '../scm-util';

const itemLineHeight = 22; // copied from vscode

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

export const SCMRepoTree: React.FC<{
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
    const ins = new ResourceGroupSplicer(repository.provider.groups);
    ref.current.scmProviderCtx.set(repository.provider ? repository.provider.contextValue : '');

    ins.onDidSplice(({ index, deleteCount, elements }) => {
      viewModel.spliceSCMList(index, deleteCount, ...elements);
    });

    return () => {
      ref.current.scmProviderCtx.set(undefined);
      ins.dispose();
    };
  }, []);

  const nodes = useComputed(() => {
    return viewModel.scmList.map((item) => {
      if (!isSCMResource(item)) {
        // SCMResourceGroup
        const nodeId = item.id;
        return {
          origin: item,
          resourceState: (item as any).toJSON(),
          isFile: false,
          id: nodeId,
          name: item.label,
          depth: 0,
          parent: undefined,
          actions: getRepoGroupActions(item.id),
          badge: item.elements.length,
          selected: selectedNodeId === nodeId,
        } as SelectableTreeNode;
      }

      const color = item.decorations.color ? themeService.getColor({
        id: item.decorations.color,
      }) : null;

      // SCMResource
      const nodeId = item.resourceGroup.id + item.sourceUri;
      return {
        origin: item,
        resourceState: (item as any).toJSON(),
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

    const data = { x, y };
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
      itemLineHeight={ itemLineHeight }
      commandActuator={commandActuator}
    />
  );
});

SCMRepoTree.displayName = 'SCMRepoTree';
