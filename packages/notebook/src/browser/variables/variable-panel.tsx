import { Container, ViewManager, ViewRender } from '@difizen/libro-common/app';
import { Empty } from 'antd';
import React, { PropsWithChildren, memo, useEffect, useState } from 'react';

import { URI, ViewState, localize, useInjectable } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

import { LIBRO_COMPONENTS_SCHEME_ID } from '../libro.protocol';
import { ILibroOpensumiService } from '../libro.service';
import { ManaContainer } from '../mana';

import { LibroVariablePanelView } from './variable-view';

export const VariablePanel = memo(({ viewState }: PropsWithChildren<{ viewState: ViewState }>) => {
  const collapsePanelContainerStyle = {
    width: viewState.width || '100%',
    height: viewState.height,
  };
  const editorService = useInjectable<WorkbenchEditorServiceImpl>(WorkbenchEditorService);
  const libroOpensumiService = useInjectable<ILibroOpensumiService>(ILibroOpensumiService);
  const manaContainer = useInjectable<Container>(ManaContainer);

  const [libroVariablePanelView, setLibroVariablePanelView] = useState<LibroVariablePanelView | undefined>(undefined);

  const createVariablePanelView = async (uri: URI, libro: any) => {
    const viewManager = manaContainer.get(ViewManager);
    const view = await viewManager.getOrCreateView<LibroVariablePanelView>(LibroVariablePanelView, {
      id: uri.toString(),
    });
    view?.pause();
    view.parent = libro;
    view.update();
    setLibroVariablePanelView(view);
  };

  useEffect(() => {
    if (editorService.currentResource?.uri.path.ext === `.${LIBRO_COMPONENTS_SCHEME_ID}`) {
      libroOpensumiService
        .getOrCreateLibroView(editorService.currentResource.uri)
        .then((libro) => createVariablePanelView(editorService.currentResource!.uri, libro));
    }

    const toDispose = editorService.onActiveResourceChange((e) => {
      if (e?.uri.path.ext === `.${LIBRO_COMPONENTS_SCHEME_ID}`) {
        libroOpensumiService.getOrCreateLibroView(e.uri).then((libro) => createVariablePanelView(e.uri, libro));
      } else {
        setLibroVariablePanelView(undefined);
      }
    });

    return () => {
      toDispose.dispose();
    };
  }, []);
  if (libroVariablePanelView) {
    return (
      <>
        <div style={collapsePanelContainerStyle}>{<ViewRender view={libroVariablePanelView}></ViewRender>}</div>
      </>
    );
  } else {
    return (
      <>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={localize('notebook.variable.panel.unsupported')}
          className='libro-variable-empty'
        />
      </>
    );
  }
});
