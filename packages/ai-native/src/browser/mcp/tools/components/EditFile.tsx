import cls from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';

import { Icon, Popover } from '@opensumi/ide-components';
import {
  AppConfig,
  LabelService,
  MarkerSeverity,
  URI,
  Uri,
  detectModeId,
  path,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { Loading } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { ILanguageService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { CodeBlockData } from '../../../../common/types';
import { ChatMarkdown } from '../../../components/ChatMarkdown';
import { IMCPServerToolComponentProps } from '../../../types';
import { BaseApplyService } from '../../base-apply.service';

import styles from './index.module.less';

export const EditFileToolComponent = (props: IMCPServerToolComponentProps) => {
  const { args, messageId, toolCallId } = props;
  const [mode, setMode] = useState<'code' | 'diff'>('code');
  const labelService = useInjectable(LabelService);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const applyService = useInjectable<BaseApplyService>(BaseApplyService);
  const editorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  const { target_file = '', code_edit, instructions } = args || {};
  const absolutePath = path.join(appConfig.workspaceDir, target_file);
  const [codeBlockData, setCodeBlockData] = useState<CodeBlockData | undefined>(
    applyService.getCodeBlock(toolCallId, messageId),
  );

  const icon = useMemo(() => {
    if (!target_file) {
      return;
    }
    const icon = `file-icon ${labelService.getIcon(URI.file(absolutePath))}`;
    return icon;
  }, [target_file, absolutePath]);
  const languageId = useMemo(() => {
    if (!target_file) {
      return;
    }
    const modelService = StandaloneServices.get(IModelService);
    const languageService = StandaloneServices.get(ILanguageService);
    const detectedModeId = detectModeId(modelService, languageService, Uri.file(absolutePath));
    return detectedModeId;
  }, [target_file, absolutePath]);

  useEffect(() => {
    const disposable = applyService.onCodeBlockUpdate((codeBlockData) => {
      if (codeBlockData.toolCallId === toolCallId) {
        setCodeBlockData({ ...codeBlockData });
      }
    });
    return () => {
      disposable.dispose();
    };
  }, []);

  const handleToggleMode = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setMode(mode === 'code' ? 'diff' : 'code');
  };

  if (!args || !codeBlockData) {
    return null;
  }

  return [
    instructions && <p>{instructions}</p>,
    <div className={styles['edit-file-tool']} key={'edit-file-tool'}>
      <div
        className={cls(styles['edit-file-tool-header'], {
          clickable: codeBlockData.status === 'pending' || codeBlockData.status === 'success',
        })}
        onClick={() => {
          if (codeBlockData.status === 'pending') {
            editorService.open(URI.file(absolutePath));
          } else if (codeBlockData.status === 'success') {
            applyService.revealApplyPosition(codeBlockData);
          }
        }}
      >
        <div className={styles.left}>
          {icon && <span className={icon}></span>}
          <span className={styles['edit-file-tool-file-name']}>{target_file}</span>
          {codeBlockData.iterationCount > 1 && (
            <span className={styles['edit-file-tool-iteration-count']}>{codeBlockData.iterationCount}/3</span>
          )}
          {renderStatus(codeBlockData, props.result)}
        </div>
        <div className={styles.right}>
          <Popover title={'Show Code'} id={'edit-file-tool-show-code'}>
            <Icon iconClass='codicon codicon-file-code' onClick={handleToggleMode} />
          </Popover>
          {codeBlockData.applyResult?.diff && (
            <Popover title={'Show Diff'} id={'edit-file-tool-show-diff'}>
              <Icon iconClass='codicon codicon-diff-multiple' onClick={handleToggleMode} />
            </Popover>
          )}
        </div>
      </div>
      <ChatMarkdown
        markdown={
          mode === 'code'
            ? `\`\`\`${languageId || ''}\n${code_edit}\n\`\`\``
            : `\`\`\`diff\n${codeBlockData.applyResult?.diff}\n\`\`\``
        }
        hideInsert={true}
      />
    </div>,
    codeBlockData.applyResult && codeBlockData.applyResult.diagnosticInfos.length > 0 && (
      <div className={styles['edit-file-tool-diagnostic-errors']} key={'edit-file-tool-diagnostic-errors'}>
        <div className={styles['title']}>Found Lints:</div>
        {codeBlockData.applyResult?.diagnosticInfos.map((info) => (
          <div
            key={info.message}
            className={cls({
              [styles['error']]: info.severity === MarkerSeverity.Error,
              [styles['warning']]: info.severity === MarkerSeverity.Warning,
            })}
          >
            <Icon className={`codicon codicon-${info.severity === MarkerSeverity.Error ? 'error' : 'warning'}`} />
            {info.message.split('\n')[0]}
          </div>
        ))}
      </div>
    ),
  ];
};

const renderStatus = (codeBlockData: CodeBlockData, error?: string) => {
  const status = codeBlockData.status;
  switch (status) {
    case 'generating':
      return <Loading />;
    case 'pending':
      return (
        <Popover title='Pending' id={'edit-file-tool-status-pending'}>
          <Icon iconClass='codicon codicon-circle-large' />
        </Popover>
      );
    case 'success':
      return (
        <Popover title='Success' id={'edit-file-tool-status-success'}>
          <Icon iconClass='codicon codicon-check-all' />
        </Popover>
      );
    case 'failed':
      return (
        <Popover title={`Failed (${error})`} id={'edit-file-tool-status-failed'}>
          <Icon iconClass='codicon codicon-error' style={{ color: 'var(--debugConsole-errorForeground)' }} />
        </Popover>
      );
    case 'cancelled':
      return (
        <Popover title='Cancelled' id={'edit-file-tool-status-cancelled'}>
          <Icon iconClass='codicon codicon-close' style={{ color: 'var(--input-placeholderForeground)' }} />
        </Popover>
      );
    default:
      return null;
  }
};
