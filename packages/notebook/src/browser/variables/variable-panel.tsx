import { Container, ViewManager, ViewRender } from '@difizen/mana-app';
import { Empty } from 'antd';
import { PropsWithChildren, memo, useEffect, useState } from 'react';
import React from 'react';

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

  useEffect(() => {
    if (editorService.currentResource?.uri.path.ext === `.${LIBRO_COMPONENTS_SCHEME_ID}`) {
      libroOpensumiService.getOrCreateLibroView(editorService.currentResource.uri).then((libro) => {
        const viewManager = manaContainer.get(ViewManager);
        viewManager
          .getOrCreateView<LibroVariablePanelView>(LibroVariablePanelView, {
            id: (editorService.currentResource?.uri as URI).toString(),
          })
          .then((libroVariablePanelView) => {
            libroVariablePanelView?.pause();
            libroVariablePanelView.parent = libro;
            libroVariablePanelView.update();
            setLibroVariablePanelView(libroVariablePanelView);
            return;
          });
      });
    }
    editorService.onActiveResourceChange((e) => {
      if (e?.uri.path.ext === `.${LIBRO_COMPONENTS_SCHEME_ID}`) {
        libroOpensumiService.getOrCreateLibroView(e.uri).then((libro) => {
          const viewManager = manaContainer.get(ViewManager);
          viewManager
            .getOrCreateView<LibroVariablePanelView>(LibroVariablePanelView, {
              id: e.uri.toString(),
            })
            .then((libroVariablePanelView) => {
              libroVariablePanelView?.pause();
              libroVariablePanelView.parent = libro;
              libroVariablePanelView.update();
              setLibroVariablePanelView(libroVariablePanelView);
              return;
            });
        });
      } else {
        setLibroVariablePanelView(undefined);
      }
    });
  });
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
