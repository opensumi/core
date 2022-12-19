import React, { useEffect, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Button, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import {
  IMergeEditorInputData,
  IOpenMergeEditorArgs,
  MergeEditorInputData,
} from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';

import { MergeEditorService } from '../merge-editor.service';
import { EditorViewType } from '../types';

import { WithViewStickinessConnectComponent } from './stickiness-connect-manager';

const TitleHead: React.FC<{ contrastType: EditorViewType }> = ({ contrastType }) => {
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);
  const [head, setHead] = useState<IMergeEditorInputData>();

  React.useEffect(() => {
    const disposable = mergeEditorService.onDidInputNutrition((nutrition: IOpenMergeEditorArgs) => {
      /**
       * input1: current
       * input2: incoming
       * output: result
       */
      const { input1, input2, output } = nutrition;
      if (contrastType === EditorViewType.CURRENT) {
        setHead(input1.getRaw());
      } else if (contrastType === EditorViewType.INCOMING) {
        setHead(input2.getRaw());
      } else if (contrastType === EditorViewType.RESULT) {
        setHead(new MergeEditorInputData(output.uri, 'Result', output.uri.toString(), '').getRaw());
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [mergeEditorService]);

  return (
    <div className='title-head-container'>
      {head && (
        <div className='content'>
          <span className='title' title={head.title}>
            {head.title}
          </span>
          <span className='description' title={head.description}>
            {head.description}
          </span>
          <span className='detail' title={head.detail}>
            {head.detail}
          </span>
        </div>
      )}
      {/* more actions */}
    </div>
  );
};

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

    return () => {
      mergeEditorService.dispose();
    };
  }, [
    incomingEditorContainer.current,
    currentEditorContainer.current,
    resultEditorContainer.current,
    mergeEditorService,
  ]);

  const handleApply = () => {
    mergeEditorService.accept();
  };

  return (
    <div className={'merge-editor-container'}>
      <SplitPanel overflow='hidden' id='merge-editor-container' flex={2}>
        <div className={'editor-container-arrange'}>
          <TitleHead contrastType={EditorViewType.CURRENT}></TitleHead>
          <div className={'editorContainer'} ref={currentEditorContainer}></div>
        </div>
        <div className={'editor-container-arrange'}>
          <TitleHead contrastType={EditorViewType.RESULT}></TitleHead>
          <div className={'editorContainer'}>
            <WithViewStickinessConnectComponent
              contrastType={EditorViewType.CURRENT}
            ></WithViewStickinessConnectComponent>
            <div className={'editorContainer'} ref={resultEditorContainer}></div>
            <WithViewStickinessConnectComponent
              contrastType={EditorViewType.INCOMING}
            ></WithViewStickinessConnectComponent>
          </div>
        </div>
        <div className={'editor-container-arrange'}>
          <TitleHead contrastType={EditorViewType.INCOMING}></TitleHead>
          <div className={'editorContainer'} ref={incomingEditorContainer}></div>
        </div>
      </SplitPanel>
      <div className={'merge-actions'}>
        <Button size='large' onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>
  );
};
