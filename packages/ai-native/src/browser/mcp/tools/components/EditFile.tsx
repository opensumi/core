import cls from 'classnames';
import React, { useEffect, useMemo } from 'react';

import { Icon, Popover } from '@opensumi/ide-components';
import {
  AppConfig,
  LabelService,
  MarkerSeverity,
  URI,
  Uri,
  detectModeId,
  path,
  useAutorun,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { Loading } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ILanguageService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { ChatMarkdown } from '../../../components/ChatMarkdown';
import { IMCPServerToolComponentProps } from '../../../types';
import { BaseApplyService, CodeBlockData } from '../../base-apply.service';

import styles from './index.module.less';

const renderStatus = (codeBlockData: CodeBlockData) => {
  const status = codeBlockData.status;
  switch (status) {
    case 'generating':
      return <Loading />;
    case 'pending':
      return (
        <Popover title={status} id={'edit-file-tool-status-pending'}>
          <Icon iconClass='codicon codicon-circle-large' />
        </Popover>
      );
    case 'success':
      return (
        <Popover title={status} id={'edit-file-tool-status-success'}>
          <Icon iconClass='codicon codicon-check-all' />
        </Popover>
      );
    case 'failed':
      return (
        <Popover title={status} id={'edit-file-tool-status-failed'}>
          <Icon iconClass='codicon codicon-error' color='var(--vscode-input-errorForeground)' />
        </Popover>
      );
    case 'cancelled':
      return (
        <Popover title={status} id={'edit-file-tool-status-cancelled'}>
          <Icon iconClass='codicon codicon-close' color='var(--vscode-input-placeholderForeground)' />
        </Popover>
      );
    default:
      return null;
  }
};

export const EditFileToolComponent = (props: IMCPServerToolComponentProps) => {
  const { args, messageId, toolCallId } = props;
  const labelService = useInjectable(LabelService);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const applyService = useInjectable<BaseApplyService>(BaseApplyService);
  const { target_file = '', code_edit, instructions } = args || {};
  const absolutePath = path.join(appConfig.workspaceDir, target_file);

  const codeBlockData = applyService.getCodeBlock(absolutePath, messageId);

  useAutorun(applyService.codeBlockMapObservable);

  if (toolCallId && codeBlockData) {
    applyService.initToolCallId(codeBlockData.id, toolCallId);
  }

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

  // 多次迭代时，仅在首处tool组件中展示
  if (!args || !codeBlockData || (toolCallId && toolCallId !== codeBlockData.initToolCallId)) {
    return null;
  }

  return [
    instructions && <p>{instructions}</p>,
    <div className={styles['edit-file-tool']} key={`edit-file-tool-${codeBlockData.id}`}>
      <div
        className={cls(styles['edit-file-tool-header'], {
          clickable: codeBlockData.status === 'pending' || codeBlockData.status === 'success',
        })}
        onClick={() => {
          if (codeBlockData.status === 'pending') {
            applyService.reRenderPendingApply();
          } else if (codeBlockData.status === 'success') {
            applyService.revealApplyPosition(codeBlockData.id);
          }
        }}
      >
        {icon && <span className={icon}></span>}
        <span className={styles['edit-file-tool-file-name']}>{target_file}</span>
        {codeBlockData.iterationCount > 1 && (
          <span className={styles['edit-file-tool-iteration-count']}>{codeBlockData.iterationCount}/3</span>
        )}
        {renderStatus(codeBlockData)}
      </div>
      <ChatMarkdown markdown={`\`\`\`${languageId || ''}\n${code_edit}\n\`\`\``} hideInsert={true} />
    </div>,
    codeBlockData.applyResult && codeBlockData.applyResult.diagnosticInfos.length > 0 && (
      <div
        className={styles['edit-file-tool-diagnostic-errors']}
        key={`edit-file-tool-diagnostic-errors-${codeBlockData.id}`}
      >
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
