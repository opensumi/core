import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { useInjectable, IContextKeyService, IContextKey, useDisposable } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import { URI, CommandService, DisposableStore, Event } from '@ali/ide-core-common';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/base';
import { splitMenuItems } from '@ali/ide-core-browser/lib/menu/next/menu-util';
import { WorkbenchEditorService } from '@ali/ide-editor';

import { ISCMRepository, scmItemLineHeight } from '../../common';
import { ViewModelContext, ResourceGroupSplicer, ISCMDataItem } from '../scm.store';
import { getIcon } from '@ali/ide-core-browser';
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

  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);

  const injector = useInjectable<Injector>(INJECTOR_TOKEN);

  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);
  const [ selectedNodeId, setSelectedNodeId ] = React.useState<string | number>();

  const _selectTimer = React.useRef<NodeJS.Timer>();
  const _selectTimes = React.useRef<number>(0);

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
