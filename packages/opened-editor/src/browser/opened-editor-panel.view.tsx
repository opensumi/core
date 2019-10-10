import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { observer } from 'mobx-react-lite';
import { ExplorerOpenedEditorService } from './explorer-opened-editor.service';
import { ViewState } from '@ali/ide-activity-panel';
import { ThemeProvider, FileDecorationsProvider } from '@ali/ide-core-browser';
import * as styles from './index.module.less';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';

export const ExplorerOpenEditorPanel = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>) => {
  const OPEN_EDIROT_NODE_HEIGHT = 22;
  const {
    onSelect,
    actions,
    commandActuator,
    nodes,
    overrideFileDecorationService,
    themeService,
    decorationChangeEvent,
    themeChangeEvent,
  }: ExplorerOpenedEditorService = useInjectable(ExplorerOpenedEditorService);
  const containerHeight = viewState.height || 0;

  const scrollContainerStyle = {
    width: '100%',
    height: containerHeight,
  };
  return <div className={styles.kt_openeditor_container} >
    <RecycleTree
      nodes={ nodes }
      scrollContainerStyle={ scrollContainerStyle }
      onSelect={ onSelect }
      containerHeight={ containerHeight }
      itemLineHeight={ OPEN_EDIROT_NODE_HEIGHT }
      leftPadding = { 15 }
      foldable = { false }
      actions = { actions }
      commandActuator = { commandActuator }
      fileDecorationProvider = { overrideFileDecorationService }
      themeProvider = { themeService as ThemeProvider }
      notifyFileDecorationsChange = { decorationChangeEvent }
      notifyThemeChange = { themeChangeEvent }
    ></RecycleTree>
  </div>;
});
