import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { observer } from 'mobx-react-lite';
import { CollapsePanelContainer, CollapsePanel, ISize } from '@ali/ide-core-browser/lib/components';
import * as styles from './explorer.module.less';
import { FileTree } from '@ali/ide-file-tree/lib/browser/file-tree.view';
import ExplorerService from './explorer.service';
import { FileTreeService } from '@ali/ide-file-tree/lib/browser/file-tree.service';
import { IFileTreeItem, IFileTreeItemStatus } from '@ali/ide-file-tree';
import { ExplorerResourceService } from './explorer.resource.service';

export const Explorer = observer(() => {

  const explorerService = useInjectable(ExplorerService);
  const explorerResourceService = useInjectable(ExplorerResourceService);

  const layout = explorerService.layout;

  const defaultActiveKey = ['2'];

  return <CollapsePanelContainer defaultActiveKey={ defaultActiveKey }>
    <CollapsePanel header='OPEN EDITORS' key='1' priority={1}></CollapsePanel>
    <CollapsePanel header='WORKSPACE' key='2' priority={2}>
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
        key={ explorerResourceService.key }
      ></FileTree>
    </CollapsePanel>
    <CollapsePanel header='OUTLINE' key='3' priority={1}></CollapsePanel>
  </CollapsePanelContainer>;
});
