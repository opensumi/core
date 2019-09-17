import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { FileTree } from '@ali/ide-file-tree/lib/browser/file-tree.view';
import { ExplorerResourceService } from './explorer-resource.service';
import { ViewState } from '@ali/ide-activity-panel';
import { ThemeProvider, useInjectable } from '@ali/ide-core-browser';

export const ExplorerResourcePanel = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>) => {
  const explorerResourceService = useInjectable(ExplorerResourceService) as ExplorerResourceService;
  console.log('update resoruce panel', viewState.height);
  return <FileTree
    width={ viewState.width }
    height={ viewState.height }
    files={ explorerResourceService.getFiles() }
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
    fileDecorationProvider = { explorerResourceService.overrideFileDecorationService }
    themeProvider = { explorerResourceService.themeService as ThemeProvider }
    notifyFileDecorationsChange = { explorerResourceService.decorationChangeEvent }
    notifyThemeChange = { explorerResourceService.themeChangeEvent }
  ></FileTree>;
});
