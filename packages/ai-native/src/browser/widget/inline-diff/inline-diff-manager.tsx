import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Icon, Popover } from '@opensumi/ide-components';
import { AppConfig, IDisposable, URI, localize, path, useInjectable } from '@opensumi/ide-core-browser';
import { IResource, WorkbenchEditorService } from '@opensumi/ide-editor';
import { Path } from '@opensumi/ide-utils/lib/path';

import { BaseApplyService } from '../../mcp/base-apply.service';

import styles from './inline-diff-widget.module.less';

const IconWithPopover = (props: {
  icon: string;
  content: string;
  id: string;
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <Popover content={props.content} id={props.id} onClick={props.onClick}>
    <Icon iconClass={props.icon} className={props.disabled ? styles.disabled : ''} />
  </Popover>
);

export const InlineDiffManager: React.FC<{ resource: IResource }> = (props) => {
  const { resource } = props;
  const applyService = useInjectable<BaseApplyService>(BaseApplyService);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const [show, setShow] = useState(true);
  const [changesCount, setChangesCount] = useState(0);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [filePaths, setFilePaths] = useState<string[]>(applyService.getPendingPaths());

  const currentFilePath = useMemo(
    () => path.relative(appConfig.workspaceDir, resource.uri.path.toString()),
    [resource],
  );

  useEffect(() => {
    const toDispose = applyService.onCodeBlockUpdate((codeBlock) => {
      if (path.relative(appConfig.workspaceDir, props.resource.uri.path.toString()) === codeBlock.relativePath) {
        setShow(codeBlock.status === 'pending');
      }
      const pendingPaths = applyService.getPendingPaths();
      setFilePaths(pendingPaths);
    });
    return () => {
      toDispose.dispose();
    };
  }, []);

  // 不同编辑器是不同实例，所以不需要监听
  const decorationModelService = applyService.currentPreviewer?.getNode()?.livePreviewDiffDecorationModel;

  useEffect(() => {
    let toDispose: IDisposable | undefined;
    if (decorationModelService) {
      setChangesCount(decorationModelService.partialEditWidgetCount);
      toDispose = decorationModelService.onPartialEditWidgetListChange((e) => {
        setChangesCount(e.filter((item) => item.status === 'pending').length);
      });
    }
    return () => {
      toDispose?.dispose();
    };
  }, [decorationModelService]);

  const handleSiblingChange = useCallback(
    (direction: 'up' | 'down') => {
      const index = decorationModelService?.revealSiblingChange(direction);
      if (index !== undefined) {
        setCurrentChangeIndex(index);
      }
    },
    [decorationModelService],
  );

  const handleSiblingFile = useCallback(
    (direction: 'up' | 'down') => {
      const index = filePaths.indexOf(currentFilePath!);
      if (index === -1) {
        return;
      }
      const uri = URI.file(path.join(appConfig.workspaceDir, filePaths[index + (direction === 'up' ? -1 : 1)]));
      editorService.open(uri);
    },
    [currentFilePath, filePaths],
  );

  const changeTip = useMemo(() => {
    if (changesCount === 0) {
      return '';
    }
    return ` ${currentChangeIndex + 1} of ${changesCount}`;
  }, [changesCount, currentChangeIndex]);

  const fileTip = useMemo(() => {
    if (!currentFilePath) {
      return '';
    }
    return ` ${filePaths.indexOf(currentFilePath) + 1} of ${filePaths.length}`;
  }, [currentFilePath, filePaths]);

  return (
    <div className={styles.inlineDiffManager} style={{ display: show ? 'flex' : 'none' }}>
      {/* <div className={styles.left}>
        <IconWithPopover
          icon='codicon codicon-issues'
          content={localize('aiNative.inlineDiff.reveal')}
          id='inline-diff-manager-reveal'
          onClick={handleReveal}
        />
      </div> */}
      <div className={styles.mid}>
        <IconWithPopover
          icon='codicon codicon-check'
          onClick={() => applyService.processAll(props.resource.uri, 'accept')}
          content={localize('aiNative.inlineDiff.acceptAll')}
          id='inline-diff-manager-accept-all'
        />
        <IconWithPopover
          icon='codicon codicon-close'
          onClick={() => applyService.processAll(props.resource.uri, 'reject')}
          content={localize('aiNative.inlineDiff.rejectAll')}
          id='inline-diff-manager-reject-all'
        />
        <IconWithPopover
          icon='codicon codicon-arrow-up'
          content={localize('aiNative.inlineDiff.up') + changeTip}
          id='inline-diff-manager-up'
          disabled={currentChangeIndex === 0}
          onClick={() => handleSiblingChange('up')}
        />
        <IconWithPopover
          icon='codicon codicon-arrow-down'
          content={localize('aiNative.inlineDiff.down') + changeTip}
          id='inline-diff-manager-down'
          disabled={currentChangeIndex === changesCount - 1}
          onClick={() => handleSiblingChange('down')}
        />
      </div>
      <div className={styles.right}>
        <IconWithPopover
          icon='codicon codicon-arrow-left'
          onClick={() => handleSiblingFile('up')}
          disabled={filePaths.length === 0 || filePaths[0] === currentFilePath}
          content={localize('aiNative.inlineDiff.left') + fileTip}
          id='inline-diff-manager-left'
        />
        <IconWithPopover
          icon='codicon codicon-arrow-right'
          onClick={() => handleSiblingFile('down')}
          disabled={filePaths.length === 0 || filePaths[filePaths.length - 1] === currentFilePath}
          content={localize('aiNative.inlineDiff.right') + fileTip}
          id='inline-diff-manager-right'
        />
      </div>
    </div>
  );
};
