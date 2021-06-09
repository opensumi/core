import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { useInjectable } from '@ali/ide-core-browser';
import { DeprecatedRecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import { ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';
import { URI, CommandService, DisposableStore, Event } from '@ali/ide-core-common';
import { WorkbenchEditorService } from '@ali/ide-editor';

import { ISCMRepository, scmItemLineHeight } from '../../common';
import { ViewModelContext, ResourceGroupSplicer, ISCMDataItem } from '../scm-model';
import { SCMResourceGroupTreeNode, SCMResourceTreeNode } from '../scm-resource';
import { isSCMResource } from '../scm-util';

export const SCMResourceList: React.FC<{
  width: number;
  height: number;
  repository: ISCMRepository;
}> = observer(({ height, repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);

  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);

  const injector = useInjectable<Injector>(INJECTOR_TOKEN);
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);

  const [ selectedNodeId, setSelectedNodeId ] = React.useState<string | number>();
  const [ isScmPanelFocused, setIsScmPanelFocused] = React.useState<boolean>(false);
  const _selectTimer = React.useRef<NodeJS.Timer>();
  const _selectTimes = React.useRef<number>(0);

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
    return viewModel.scmList.map((item) => {
      let resourceItem: SCMResourceTreeNode | SCMResourceGroupTreeNode;
      const repoMenus = viewModel.menus.getRepositoryMenus(repository.provider);
      if (isSCMResource(item)) {
        resourceItem = injector.get(
          SCMResourceTreeNode,
          [ item, repoMenus.getResourceMenu(item) ]);
      } else {
        resourceItem = new SCMResourceGroupTreeNode(
          item,
          repoMenus.getResourceGroupMenu(item),
        );
      }

      resourceItem.selected = selectedNodeId === resourceItem.id;
      resourceItem.focused = resourceItem.selected && isScmPanelFocused;
      return resourceItem;
    });
  }, [ viewModel.scmList, selectedNodeId, repository, isScmPanelFocused ]);

  const commandActuator = React.useCallback((command: string, params?) => {
    return commandService.executeCommand(command, params);
  }, []);

  const handleFileSelect = React.useCallback((files: TreeNode[]) => {
    const file: TreeNode = files[0];
    if (!file) {
      return;
    }

    if (_selectTimes) {
      _selectTimes.current = _selectTimes.current + 1;
    }

    const item: ISCMDataItem = file.item;

    // 只有 scm resource 有选中态
    if (isSCMResource(item)) {
      // 控制选中状态
      setSelectedNodeId(file.id);
    }

    if (!isSCMResource(item)) {
      return;
    }

    // 单击打开/双击 pin
    if (_selectTimes && _selectTimes.current === 1) {
      item.open(true);
    }

    if (_selectTimer && _selectTimer.current) {
      clearTimeout(_selectTimer.current);
    }

    // FIXME: RecycleTree 支持双击事件
    _selectTimer.current = global.setTimeout(() => {
      // 单击事件
      // 200ms内多次点击默认为双击事件
      if (_selectTimes.current > 1) {
        // 双击 pin 住当前文件对应的 editor
        const { currentEditorGroup, currentEditor } = workbenchEditorService;
        if (currentEditorGroup && currentEditor && currentEditor.currentUri) {
          // uri 一致的情况下将当前 editor pin 住
          if (URI.from(item.sourceUri).isEqual(currentEditor.currentUri)) {
            currentEditorGroup.pin(currentEditor.currentUri);
          }
        }
      }
      _selectTimes.current = 0;
    }, 200);
  }, []);

  const handlePanelBlur = () => {
    setIsScmPanelFocused(false);
  };

  const handlePanelFocus = () => {
    setIsScmPanelFocused(true);
  };

  const onContextMenu = React.useCallback((files, event: React.MouseEvent<HTMLElement>) => {
    const { x, y } = event.nativeEvent;
    const file: TreeNode = files[0];
    if (!file) {
      return;
    }

    const repoMenus = viewModel.menus.getRepositoryMenus(repository.provider);
    if (!repoMenus) {
      return;
    }
    const item: ISCMDataItem = file.item;

    if (isSCMResource(item)) {
      ctxMenuRenderer.show({
        anchor: { x, y },
        menuNodes: repoMenus.getResourceMenu(item).getGroupedMenuNodes()[1],
        args: [ file.resourceState ],
      });
    } else {
      ctxMenuRenderer.show({
        anchor: { x, y },
        menuNodes: repoMenus.getResourceGroupMenu(item).getGroupedMenuNodes()[1],
        args: [ repository.provider.toJSON() ],
      });
    }
  }, [ repository ]);

  return (
    <DeprecatedRecycleTree
      alwaysShowActions={viewModel.alwaysShowActions}
      nodes={nodes}
      defaultLeftPadding={8}
      prerenderNumber={50}
      onSelect={handleFileSelect}
      onContextMenu={onContextMenu}
      scrollContainerStyle={{ width: '100%', height }}
      containerHeight={height}
      itemLineHeight={scmItemLineHeight}
      commandActuator={commandActuator}
      onBlur={handlePanelBlur}
      onFocus={handlePanelFocus}
    />
  );
});

SCMResourceList.displayName = 'SCMRepoTree';
