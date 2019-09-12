import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { observer } from 'mobx-react-lite';
import { OpenedEditorTree } from '@ali/ide-opened-editor/lib/browser/opened-editor.view';
import { ExplorerOpenedEditorService } from './explorer-opened-editor.service';
import { ViewState } from '@ali/ide-activity-panel';

export const ExplorerOpenEditorPanel = observer(({
  viewState,
}: React.PropsWithChildren<{viewState: ViewState}>) => {
  const explorerOpenedEditorService = useInjectable(ExplorerOpenedEditorService);
  const openEditorNodes = explorerOpenedEditorService.nodes;
  return <OpenedEditorTree
    width={ viewState.width }
    height={ viewState.height }
    nodes = { openEditorNodes }
    onSelect = {explorerOpenedEditorService.openFile}
    actions = { explorerOpenedEditorService.actions }
    commandActuator = { explorerOpenedEditorService.commandActuator }
  ></OpenedEditorTree>;
});
