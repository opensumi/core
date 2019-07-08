import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { observer } from 'mobx-react-lite';
import { CollapsePanelContainer, CollapsePanel, IExplorerAction } from '@ali/ide-core-browser/lib/components';
import * as styles from './explorer.module.less';
import { FileTree } from '@ali/ide-file-tree/lib/browser/file-tree.view';
import { ExplorerResourceService } from './explorer.resource.service';
import { ExplorerService } from './explorer.service';
import { localize } from '@ali/ide-core-browser';
export const Explorer = observer(() => {
  const explorerResourceService = useInjectable(ExplorerResourceService);
  const explorerService = useInjectable(ExplorerService);

  const defaultActiveKey = ['2'];

  const actions: IExplorerAction[] = [
    {
      iconClass: 'new_file',
      action: explorerService.newFile,
      title: localize('explorer.action.new.file'),
    },
    {
      iconClass: 'new_folder',
      action: explorerService.newFolder,
      title: localize('explorer.action.new.folder'),
    },
    {
      iconClass: 'refresh_explorer',
      action: explorerService.refresh,
      title: localize('explorer.action.refresh'),
    },
    {
      iconClass: 'collapse_explorer',
      action: explorerService.collapseAll,
      title: localize('explorer.action.collapse'),
    },
  ];

  const layout = explorerService.layout;

  const collapsePanelContainerStyle = {
    width: layout.width,
    height: layout.height,
  };

  return <CollapsePanelContainer className={ styles.kt_explorer } defaultActiveKey={ defaultActiveKey } style={collapsePanelContainerStyle}>
    <CollapsePanel header='OPEN EDITORS' key='1' priority={1}></CollapsePanel>
    <CollapsePanel
      header = { explorerResourceService.root.displayName }
      key = '2'
      priority = {2}
      actions = { actions }
    >
      <FileTree
        files={ explorerResourceService.files }
        onSelect={ explorerResourceService.onSelect }
        onDragStart={ explorerResourceService.onDragStart }
        onDragOver={ explorerResourceService.onDragOver }
        onDragEnter={ explorerResourceService.onDragEnter }
        onDragLeave={ explorerResourceService.onDragLeave }
        onChange = { explorerResourceService.onChange }
        onDrop={ explorerResourceService.onDrop }
        draggable={ explorerResourceService.draggable }
        editable={ explorerResourceService.editable }
        multiSelectable={ explorerResourceService.multiSelectable }
        onContextMenu={ explorerResourceService.onContextMenu }
        position = { explorerResourceService.position }
        key={ explorerResourceService.key }
      ></FileTree>
    </CollapsePanel>
    <CollapsePanel header='OUTLINE' key='3' priority={1}></CollapsePanel>
  </CollapsePanelContainer>;
});
