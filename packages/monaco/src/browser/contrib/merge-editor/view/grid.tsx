import React, { useEffect } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { SplitPanel } from '@opensumi/ide-core-browser/lib/components';

import { ICodeEditor } from '../../../monaco-api/editor';
import { MergeEditorService } from '../merge-editor.service';

export const Grid = () => {
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);

  const incomingEditorContainer = React.useRef<HTMLDivElement | null>(null);
  const currentEditorContainer = React.useRef<HTMLDivElement | null>(null);
  const resultEditorContainer = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let incomingView: ICodeEditor;
    let currentView: ICodeEditor;
    let resultView: ICodeEditor;

    if (currentEditorContainer.current) {
      currentView = mergeEditorService.createCurrentEditor(currentEditorContainer.current);
    }
    if (resultEditorContainer.current) {
      resultView = mergeEditorService.createResultEditor(resultEditorContainer.current);
    }
    if (incomingEditorContainer.current) {
      incomingView = mergeEditorService.createIncomingEditor(incomingEditorContainer.current);
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
        <div style={{ height: '100%' }} className={'currentEditorContainer'} ref={currentEditorContainer}></div>
        <div style={{ height: '100%' }} className={'resultEditorContainer'} ref={resultEditorContainer}></div>
        <div style={{ height: '100%' }} className={'incomingEditorContainer'} ref={incomingEditorContainer}></div>
      </SplitPanel>
    </div>
  );
};
