import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { useInjectable } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import { ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';
import { URI, CommandService, DisposableStore, Event } from '@ali/ide-core-common';
import { WorkbenchEditorService } from '@ali/ide-editor';

import { ISCMRepository, scmItemLineHeight } from '../../common';
import { ViewModelContext, ResourceGroupSplicer, ISCMDataItem } from '../scm-model';
import { SCMResourceGroupTreeNode, SCMResourceTreeNode } from '../scm-resource';
import { isSCMResource } from '../scm-util';

export const SCMResouceList: React.FC<{
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

    if (_selectTimes) {
      _selectTimes.current = _selectTimes.current + 1;
    }
    // 控制选中状态
    setSelectedNodeId(file.id);

    const item: ISCMDataItem = file.item;

    if (!isSCMResource(item)) {
      return;
    }

    // 单击打开/双击 pin
    if (_selectTimes && _selectTimes.current === 1) {
      item.open();
    }

    if (_selectTimer && _selectTimer.current) {
      clearTimeout(_selectTimer.current);
    }

    // FIXME: RecycleTree 支持双击事件
    _selectTimer.current = setTimeout(() => {
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
