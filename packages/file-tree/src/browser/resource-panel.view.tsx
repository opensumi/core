import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { FileTree } from './file-tree.view';
import { ExplorerResourceService } from './explorer-resource.service';
import { ViewState } from '@ali/ide-activity-panel';
import { ThemeProvider, useInjectable } from '@ali/ide-core-browser';
import { EmptyView } from './empty.view';

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
    onBlur,
    onFocus,
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
  const files = getFiles();
  if (files.length > 0) {
    return <FileTree
      width={ viewState.width }
      height={ viewState.height }
      files={ files }
      onSelect={ onSelect }
      onTwistieClick={ onTwistieClick }
      onDragStart={ onDragStart }
      onDragOver={ onDragOver }
      onDragEnter={ onDragEnter }
      onDragLeave={ onDragLeave }
      onChange = { onChange }
      onDrop={ onDrop }
      onBlur={ onBlur }
      onFocus={ onFocus }
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
  } else {
    return <EmptyView />;
  }
});
