import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { observer } from 'mobx-react-lite';
import { FileTree } from '@ali/ide-file-tree/lib/browser/file-tree.view';
import { ExplorerResourceService } from './explorer-resource.service';
import { ViewState } from '@ali/ide-activity-panel';

export const ExplorerResourcePanel = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>) => {
  const explorerResourceService = useInjectable(ExplorerResourceService);

  return <FileTree
    width={ viewState.width }
    height={ viewState.height }
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
  ></FileTree>;
});
