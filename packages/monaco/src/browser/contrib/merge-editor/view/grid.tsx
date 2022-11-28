import React, { useEffect } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { SplitPanel } from '@opensumi/ide-core-browser/lib/components';

import { MergeEditorService } from '../merge-editor.service';
import { EditorViewType } from '../types';

import { WithViewStickinessConnectComponent } from './stickiness-connect-manager';

export const Grid = () => {
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);

  const incomingEditorContainer = React.useRef<HTMLDivElement | null>(null);
  const currentEditorContainer = React.useRef<HTMLDivElement | null>(null);
  const resultEditorContainer = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const [current, result, incoming] = [
      currentEditorContainer.current,
      resultEditorContainer.current,
      incomingEditorContainer.current,
    ];
    if (current && result && incoming) {
      mergeEditorService.instantiationCodeEditor(current, result, incoming);
    }
    return () => mergeEditorService.dispose();
  }, [
    incomingEditorContainer.current,
    currentEditorContainer.current,
    resultEditorContainer.current,
    mergeEditorService,
  ]);

  return (
    <div className={'merge-editor-container'}>
      <SplitPanel overflow='hidden' id='merge-editor-container' flex={2}>
        <div className={'editor-container-arrange'}>
          <div className={'currentEditorContainer'} ref={currentEditorContainer}></div>
        </div>
        <div className={'editor-container-arrange'}>
          <WithViewStickinessConnectComponent
            contrastType={EditorViewType.CURRENT}
          ></WithViewStickinessConnectComponent>
          <div className={'resultEditorContainer'} ref={resultEditorContainer}></div>
          <WithViewStickinessConnectComponent
            contrastType={EditorViewType.INCOMING}
          ></WithViewStickinessConnectComponent>
        </div>
        <div className={'editor-container-arrange'}>
          <div className={'incomingEditorContainer'} ref={incomingEditorContainer}></div>
        </div>
      </SplitPanel>
    </div>
  );
};
