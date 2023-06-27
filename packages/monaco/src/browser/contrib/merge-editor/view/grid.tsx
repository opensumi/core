import React, { useCallback, useEffect, useState } from 'react';

import { localize, useInjectable } from '@opensumi/ide-core-browser';
import { Button, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import {
  IMergeEditorInputData,
  IOpenMergeEditorArgs,
  MergeEditorInputData,
} from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';

import { MergeEditorService } from '../merge-editor.service';
import { EditorViewType } from '../types';

import styles from './merge-editor.module.less';
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
    <div className={styles.title_head_container}>
      {head && (
        <div className={styles.content}>
          <span className={styles.title} title={head.title}>
            {head.title}
          </span>
          <span className={styles.description} title={head.description}>
            {head.description}
          </span>
          <span className={styles.detail} title={head.detail}>
            {head.detail}
          </span>
        </div>
      )}
      {/* more actions */}
    </div>
  );
};

const MergeActions: React.FC = () => {
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);

  const handleApply = useCallback(() => {
    mergeEditorService.accept();
  }, [mergeEditorService]);

  const handleAcceptLeft = useCallback(() => {
    mergeEditorService.acceptLeft();
  }, [mergeEditorService]);

  const handleAcceptRight = useCallback(() => {
    mergeEditorService.acceptRight();
  }, [mergeEditorService]);

  return (
    <div className={styles.merge_actions_container}>
      <div className={styles.actions}>
        <div className={styles.left_side}>
          <Button size='large' type='default' onClick={handleAcceptLeft}>
            {localize('mergeEditor.action.button.accept.left')}
          </Button>
          <Button size='large' type='default' onClick={handleAcceptRight}>
            {localize('mergeEditor.action.button.accept.right')}
          </Button>
        </div>
        <div className={styles.right_side}>
          <Button size='large' onClick={handleApply}>
            {localize('mergeEditor.action.button.apply')}
          </Button>
        </div>
      </div>
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

  return (
    <div className={styles.merge_editor_container}>
      <SplitPanel overflow='hidden' id='merge_editor_container' flex={2}>
        <div className={styles.editor_container_arrange}>
          <TitleHead contrastType={EditorViewType.CURRENT}></TitleHead>
          <div className={styles.editor_container} ref={currentEditorContainer}></div>
        </div>
        <div className={styles.editor_container_arrange}>
          <TitleHead contrastType={EditorViewType.RESULT}></TitleHead>
          <div className={styles.editor_container}>
            <WithViewStickinessConnectComponent
              contrastType={EditorViewType.CURRENT}
            ></WithViewStickinessConnectComponent>
            <div className={styles.editor_container} ref={resultEditorContainer}></div>
            <WithViewStickinessConnectComponent
              contrastType={EditorViewType.INCOMING}
            ></WithViewStickinessConnectComponent>
          </div>
        </div>
        <div className={styles.editor_container_arrange}>
          <TitleHead contrastType={EditorViewType.INCOMING}></TitleHead>
          <div className={styles.editor_container} ref={incomingEditorContainer}></div>
        </div>
      </SplitPanel>
      <MergeActions />
    </div>
  );
};
