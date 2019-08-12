import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { observer } from 'mobx-react-lite';
import { CollapsePanelContainer, CollapsePanel, IExplorerAction } from '@ali/ide-core-browser/lib/components';
import * as styles from './explorer.module.less';
import { FileTree } from '@ali/ide-file-tree/lib/browser/file-tree.view';
import { OpenedEditorTree } from '@ali/ide-opened-editor/lib/browser/opened-editor.view';
import { ExplorerResourceService } from './explorer-resource.service';
import { ExplorerService } from './explorer.service';
import { localize } from '@ali/ide-core-browser';
import { ExplorerOpenedEditorService } from './explorer-opened-editor.service';
import { KAITIAN_MUTI_WORKSPACE_EXT } from '@ali/ide-workspace';
export const Explorer = observer(() => {
  const explorerResourceService = useInjectable(ExplorerResourceService);
  const explorerOpenedEditorService = useInjectable(ExplorerOpenedEditorService);
  const explorerService = useInjectable(ExplorerService);

  const activeKey = explorerService.activeKey;
  const openEditorNodes = explorerOpenedEditorService.nodes;
  const keymap = explorerService.keymap;
  console.log(explorerResourceService.files);
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
  const panelContainerChangeHandler = (change: string[]) => {
    explorerService.updateActiveKey(change);
  };

  let resourceTitle = explorerResourceService.root.displayName;
  if (!explorerResourceService.root.isDirectory &&
    (resourceTitle.endsWith(`.${KAITIAN_MUTI_WORKSPACE_EXT}`))) {
    resourceTitle = resourceTitle.slice(0, resourceTitle.lastIndexOf('.'));
  }
  return <CollapsePanelContainer className={ styles.kt_explorer } activeKey={ activeKey } style={collapsePanelContainerStyle} onChange={ panelContainerChangeHandler }>
    <CollapsePanel header='OPEN EDITORS' key={ keymap.openeditor.key } priority={keymap.openeditor.priority}>
      <OpenedEditorTree
        nodes = { openEditorNodes }
        onSelect = {explorerOpenedEditorService.openFile}
        actions = { explorerOpenedEditorService.actions }
        commandActuator = { explorerOpenedEditorService.commandActuator }
      ></OpenedEditorTree>
    </CollapsePanel>
    <CollapsePanel
      header = { resourceTitle }
      key = { keymap.resource.key }
      priority = {keymap.resource.priority}
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
      ></FileTree>
    </CollapsePanel>
    <CollapsePanel header='OUTLINE' key={keymap.outline.key} priority={keymap.outline.priority}></CollapsePanel>
  </CollapsePanelContainer>;
});
