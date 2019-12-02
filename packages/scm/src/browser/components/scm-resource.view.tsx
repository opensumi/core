import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { useInjectable } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import { CommandService, DisposableStore, Event } from '@ali/ide-core-common';
import { ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';

import { ISCMRepository, scmItemLineHeight } from '../../common';
import { ViewModelContext, ResourceGroupSplicer, ISCMDataItem } from '../scm-model';
import { SCMResourceGroupTreeNode, SCMResourceTreeNode } from '../scm-resource';
import { isSCMResource } from '../scm-util';

enum GitActionList {
  gitOpenResource = 'git.openResource',
}

export const SCMResouceList: React.FC<{
  width: number;
  height: number;
  repository: ISCMRepository;
}> = observer(({ height, repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
  const injector = useInjectable<Injector>(INJECTOR_TOKEN);
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);

  const [ selectedNodeId, setSelectedNodeId ] = React.useState<string | number>();

  React.useEffect(() => {
    const disposables = new DisposableStore();
    const resourceGroup = new ResourceGroupSplicer(repository);

    // 只处理当前 repository 的事件
    const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repository);
    disposables.add(repoOnDidSplice(({ index, deleteCount, elements }) => {
      viewModel.spliceSCMList(index, deleteCount, ...elements);
    }));

    resourceGroup.run();

    return () => {
      resourceGroup.dispose();
      disposables.dispose();
    };
  }, [ repository ]);

  const nodes = useComputed(() => {
    const scmMenuService = viewModel.getSCMMenuService(repository);

    return viewModel.scmList.map((item) => {
      let resourceItem: SCMResourceTreeNode | SCMResourceGroupTreeNode;
      if (isSCMResource(item)) {
        const inlineMenu = scmMenuService && scmMenuService.getResourceInlineActions(item.resourceGroup);
        resourceItem = injector.get(SCMResourceTreeNode, [item, inlineMenu]);
      } else {
        const inlineMenu = scmMenuService && scmMenuService.getResourceGroupInlineActions(item);
        resourceItem =  new SCMResourceGroupTreeNode(item, inlineMenu);
      }

      resourceItem.selected = selectedNodeId === resourceItem.id;
      return resourceItem;
    });
  }, [ viewModel.scmList, selectedNodeId, repository ]);

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

    const scmMenuService = viewModel.getSCMMenuService(repository);
    if (!scmMenuService) {
      return;
    }
    const item: ISCMDataItem = file.item;

    if (isSCMResource(item)) {
      ctxMenuRenderer.show({
        anchor: { x, y },
        menuNodes: scmMenuService.getResourceContextActions(item),
        context: [ file.resourceState ],
      });
    } else {
      ctxMenuRenderer.show({
        anchor: { x, y },
        menuNodes: scmMenuService.getResourceGroupContextActions(item),
        context: [ repository.provider.toJSON() ],
      });
    }
  }, [ repository ]);

  return (
    <RecycleTree
      nodes={nodes}
      onSelect={handleFileSelect}
      onContextMenu={onContextMenu}
      scrollContainerStyle={{ width: '100%', height }}
      containerHeight={height}
      itemLineHeight={scmItemLineHeight}
      commandActuator={commandActuator}
    />
  );
});

SCMResouceList.displayName = 'SCMRepoTree';
