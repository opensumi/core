import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { FileTree } from '@ali/ide-file-tree/lib/browser/file-tree.view';
import { ExplorerResourceService } from './explorer-resource.service';
import { ViewState } from '@ali/ide-activity-panel';
import { ThemeProvider, useInjectable } from '@ali/ide-core-browser';

export const ExplorerResourcePanel = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>) => {
  const {
    getFiles,
    onSelect,
    onTwistieClick,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onChange,
    onDrop,
    draggable,
    editable,
    multiSelectable,
    onContextMenu,
    position,
    overrideFileDecorationService,
    themeService,
    decorationChangeEvent,
    themeChangeEvent,
    validateFileName,
  }: ExplorerResourceService = useInjectable(ExplorerResourceService) as ExplorerResourceService;

  return <FileTree
    width={ viewState.width }
    height={ viewState.height }
    files={ getFiles() }
    onSelect={ onSelect }
    onTwistieClick={ onTwistieClick }
    onDragStart={ onDragStart }
    onDragOver={ onDragOver }
    onDragEnter={ onDragEnter }
    onDragLeave={ onDragLeave }
    onChange = { onChange }
    onDrop={ onDrop }
    draggable={ draggable }
    editable={ editable }
    multiSelectable={ multiSelectable }
    onContextMenu={ onContextMenu }
    position = { position }
    fileDecorationProvider = { overrideFileDecorationService }
    themeProvider = { themeService as ThemeProvider }
    notifyFileDecorationsChange = { decorationChangeEvent }
    notifyThemeChange = { themeChangeEvent }
    validate={ validateFileName }
  ></FileTree>;
});
