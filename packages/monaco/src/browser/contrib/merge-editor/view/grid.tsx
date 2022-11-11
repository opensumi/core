import React, { useEffect } from 'react';

import { useInjectable, MonacoService, ServiceNames, IContextKeyService } from '@opensumi/ide-core-browser';
import { SplitPanel } from '@opensumi/ide-core-browser/lib/components';

import { monaco } from '../../../monaco-api';
import { ICodeEditor } from '../../../monaco-api/editor';

export const Grid = () => {
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);

  const incomingEditorContainer = React.useRef<HTMLDivElement | null>(null);
  const currentEditorContainer = React.useRef<HTMLDivElement | null>(null);
  const resultEditorContainer = React.useRef<HTMLDivElement | null>(null);

  let incomingView: ICodeEditor;
  let currentView: ICodeEditor;
  let resultView: ICodeEditor;

  useEffect(() => {
    if (incomingEditorContainer.current) {
      incomingView = monaco.editor.create(
        incomingEditorContainer.current,
        {},
        {
          [ServiceNames.CONTEXT_KEY_SERVICE]: contextKeyService.createScoped(incomingEditorContainer.current),
        },
      );
    }
    if (currentEditorContainer.current) {
      currentView = monaco.editor.create(
        currentEditorContainer.current,
        {},
        {
          [ServiceNames.CONTEXT_KEY_SERVICE]: contextKeyService.createScoped(currentEditorContainer.current),
        },
      );
    }
    if (resultEditorContainer.current) {
      resultView = monaco.editor.create(
        resultEditorContainer.current,
        {},
        {
          [ServiceNames.CONTEXT_KEY_SERVICE]: contextKeyService.createScoped(resultEditorContainer.current),
        },
      );
    }
    return () => {
      if (incomingView) {
        return incomingView.dispose();
      }
      if (currentView) {
        return currentView.dispose();
      }
      if (resultView) {
        return resultView.dispose();
      }
    };
  }, [incomingEditorContainer.current, currentEditorContainer.current, resultEditorContainer.current]);

  return (
    <div style={{ height: '100%' }}>
      <SplitPanel overflow='hidden' id='merge-editor-diff3-container' flex={2}>
        <div style={{ height: '100%' }} className={'incomingEditorContainer'} ref={incomingEditorContainer}></div>
        <div style={{ height: '100%' }} className={'currentEditorContainer'} ref={currentEditorContainer}></div>
        <div style={{ height: '100%' }} className={'resultEditorContainer'} ref={resultEditorContainer}></div>
      </SplitPanel>
    </div>
  );
};
