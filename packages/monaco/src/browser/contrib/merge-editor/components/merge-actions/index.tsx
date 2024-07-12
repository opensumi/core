import cls from 'classnames';
import React, { useCallback } from 'react';

import { AINativeConfigService, URI, localize, useInjectable } from '@opensumi/ide-core-browser';
import { Button, Icon } from '@opensumi/ide-core-browser/lib/components';
import { useInMergeChanges } from '@opensumi/ide-core-browser/lib/react-hooks/git/use-in-merge-changes';

import styles from './merge-actions.module.less';

export interface IMergeActionsProps {
  uri?: URI;
  summary: string;
  editorType: '3way' | 'text';
  containerClassName?: string;

  isAIResolving: boolean;
  onAIResolve: () => void;

  canNavigate: boolean;
  handlePrev: () => void;
  handleNext: () => void;

  onReset: () => void;
  onSwitchEditor: () => void;

  beforeAddons?: React.ReactNode;
  afterAddons?: React.ReactNode;
}

export const MergeActions = ({
  uri,
  summary,
  editorType,
  containerClassName,
  onReset,
  onSwitchEditor,
  canNavigate,
  handleNext,
  handlePrev,
  beforeAddons,
  afterAddons,
  isAIResolving,
  onAIResolve,
}: IMergeActionsProps) => {
  const inMergeChanges = useInMergeChanges(uri?.toString() || '');

  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);

  const isSupportAIResolve = useCallback(
    () => aiNativeConfigService.capabilities.supportsConflictResolve,
    [aiNativeConfigService],
  );

  const onClickPrev = useCallback(() => {
    if (!canNavigate) {
      return;
    }
    handlePrev();
  }, [handlePrev, canNavigate]);

  const onClickNext = useCallback(() => {
    if (!canNavigate) {
      return;
    }
    handleNext();
  }, [handleNext, canNavigate]);

  return (
    <div className={cls(styles.merge_editor_float_container, containerClassName)}>
      <div className={styles.merge_editor_float_container_info}>
        <div className={styles.merge_editor_nav_operator}>
          <div
            className={cls(styles.merge_editor_nav_operator_btn, {
              [styles.disabled]: !canNavigate,
            })}
            onClick={onClickPrev}
          >
            {localize('mergeEditor.conflict.prev')}
          </div>
          <div className={styles['vertical-divider']} />
          <div
            className={cls(styles.merge_editor_nav_operator_btn, {
              [styles.disabled]: !canNavigate,
            })}
            onClick={onClickNext}
          >
            {localize('mergeEditor.conflict.next')}
          </div>
        </div>
        <div className={styles['vertical-divider']} />
        <div>{summary}</div>
      </div>
      <div className={styles['horizontal-divider']} />
      <div className={styles.merge_editor_float_container_operation_bar}>
        {editorType === 'text' && inMergeChanges && (
          <Button
            id='merge.editor.open.3way'
            className={styles.merge_conflict_bottom_btn}
            size='default'
            onClick={onSwitchEditor}
            style={{
              alignSelf: 'flex-start',
            }}
          >
            <Icon icon={'swap'} />
            <span>{localize('mergeEditor.open.3way')}</span>
          </Button>
        )}
        {editorType === '3way' && (
          <Button
            id='merge.editor.open.tradition'
            className={styles.merge_conflict_bottom_btn}
            size='default'
            onClick={onSwitchEditor}
          >
            <Icon icon={'swap'} />
            <span>{localize('mergeEditor.open.tradition')}</span>
          </Button>
        )}
        <div
          style={{
            flex: 1,
          }}
        />
        {beforeAddons ? (
          <>
            {beforeAddons}
            <span className={styles.line_vertical}></span>
          </>
        ) : null}
        <Button id='merge.editor.rest' className={styles.merge_conflict_bottom_btn} size='default' onClick={onReset}>
          <Icon icon={'discard'} />
          <span>{localize('mergeEditor.reset')}</span>
        </Button>
        {isSupportAIResolve() && (
          <Button
            id='merge.editor.conflict.resolve.all'
            size='default'
            className={`${styles.merge_conflict_bottom_btn} ${styles.magic_btn}`}
            onClick={onAIResolve}
          >
            {isAIResolving ? (
              <>
                <Icon icon={'circle-pause'} />
                <span>{localize('mergeEditor.conflict.ai.resolve.all.stop')}</span>
              </>
            ) : (
              <>
                <Icon icon={'magic-wand'} />
                <span>{localize('mergeEditor.conflict.ai.resolve.all')}</span>
              </>
            )}
          </Button>
        )}
        {afterAddons ? (
          <>
            <span className={styles.line_vertical}></span>
            {afterAddons}
          </>
        ) : null}
      </div>
    </div>
  );
};
