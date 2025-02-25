import Collapse, { Panel } from 'rc-collapse';
import React, { memo, useCallback, useEffect, useState } from 'react';

import 'rc-collapse/assets/index.css';

import { Icon } from '@opensumi/ide-components/lib/icon/icon';
import { Popover, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { AppConfig } from '@opensumi/ide-core-browser/lib/react-providers/config-provider';
import { LabelService } from '@opensumi/ide-core-browser/lib/services/label-service';
import { localize } from '@opensumi/ide-core-common/lib/localize';
import { Event, URI } from '@opensumi/ide-core-common/lib/utils';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser/types';

import { FileContext, LLMContextService, LLMContextServiceToken } from '../../../common/llm-context';

import { ContextSelector } from './ContextSelector';
import styles from './style.module.less';

const getCollapsedHeight = () => ({ height: 0, opacity: 0 });
const getRealHeight = (node) => ({ height: node.scrollHeight, opacity: 1 });
const getCurrentHeight = (node) => ({ height: node.offsetHeight });
const skipOpacityTransition = (_, event) => (event as TransitionEvent).propertyName === 'height';

export const ChatContext = memo(() => {
  const [addedFiles, updateAddedFiles] = useState<FileContext[]>([]);
  const [contextOverlay, toggleContextOverlay] = useState(false);

  const labelService = useInjectable<LabelService>(LabelService);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const contextService = useInjectable<LLMContextService>(LLMContextServiceToken);

  useEffect(() => {
    const disposable = Event.debounce(
      contextService.onDidContextFilesChangeEvent,
      (_, e) => e!,
      50,
    )((files) => {
      if (files) {
        updateAddedFiles([...files.attached]);
      }
    }, contextService);

    return () => {
      disposable.dispose();
    };
  }, []);

  const openContextOverlay = useCallback(() => {
    toggleContextOverlay(true);
  }, [addedFiles]);

  const onDidSelect = useCallback((uri: URI) => {
    contextService.addFileToContext(uri, undefined, true);
  }, []);

  const onDidDeselect = useCallback((uri: URI) => {
    contextService.removeFileFromContext(uri, true);
  }, []);

  const onDidClickFile = useCallback((uri: URI) => {
    workbenchEditorService.open(uri);
  }, []);

  const onDidCleanFiles = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    contextService.cleanFileContext();
  }, []);

  const onDidRemoveFile = useCallback((e, uri: URI) => {
    e.stopPropagation();
    e.preventDefault();
    onDidDeselect(uri);
  }, []);

  return (
    <div className={styles.chat_context}>
      <Collapse
        // @ts-ignore
        expandIcon={({ isActive }) => (isActive ? <Icon icon='down' /> : <Icon icon='right' />)}
        openMotion={{
          motionName: 'rc-collapse-motion',
          onEnterStart: getCollapsedHeight,
          onEnterActive: getRealHeight,
          onLeaveStart: getCurrentHeight,
          onLeaveActive: getCollapsedHeight,
          onEnterEnd: skipOpacityTransition,
          onLeaveEnd: skipOpacityTransition,
          motionDeadline: 100,
          leavedClassName: styles.collapse_hide,
        }}
      >
        <Panel
          header={
            <div className={styles.context_header}>
              <h3 className={styles.chat_context_title}>
                Context {addedFiles.length > 0 ? ` (${addedFiles.length} files)` : ''}
              </h3>
              <Popover
                overlayClassName={styles.popover_icon}
                id={'ai-context-header-clear'}
                title={localize('aiNative.operate.clear.title')}
              >
                <EnhanceIcon
                  wrapperClassName={styles.action_btn}
                  className={getIcon('clear')}
                  onClick={onDidCleanFiles}
                  tabIndex={0}
                  role='button'
                  ariaLabel={localize('aiNative.operate.clear.title')}
                />
              </Popover>
            </div>
          }
          key='context-panel'
        >
          <div className={styles.file_list}>
            {addedFiles.map((file) => (
              <div className={styles.selected_item} key={file.uri.toString()} onClick={() => onDidClickFile(file.uri)}>
                <Icon iconClass={labelService.getIcon(file.uri)} />
                <span className={styles.basename}>
                  {file.uri.path.base}
                  {file.selection ? ` (${file.selection[0]}-${file.selection[1]})` : ''}
                </span>
                <span className={styles.dir}>
                  {URI.file(appConfig.workspaceDir).relative(file.uri.parent)?.toString()}
                </span>
                <Icon icon='close' className={styles.close_icon} onClick={(e) => onDidRemoveFile(e, file.uri)} />
              </div>
            ))}
          </div>
          <div className={styles.add_context} onClick={openContextOverlay}>
            <Icon icon='add' />
            Add Files
          </div>
        </Panel>
      </Collapse>
      {contextOverlay && (
        <ContextSelector
          onDidClose={() => toggleContextOverlay(false)}
          onDidDeselect={onDidDeselect}
          onDidSelect={onDidSelect}
          addedFiles={addedFiles}
        />
      )}
    </div>
  );
});
