import React, { useMemo } from 'react';

import { Icon } from '@opensumi/ide-components';
import { AppConfig, LabelService, URI, Uri, detectModeId, path, useInjectable } from '@opensumi/ide-core-browser';
import { Loading } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { ILanguageService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages/language';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { ChatMarkdown } from '../../../components/ChatMarkdown';
import { IMCPServerToolComponentProps } from '../../../types';
import { BaseApplyService } from '../../base-apply.service';

import styles from './index.module.less';

export const EditFileToolComponent = (props: IMCPServerToolComponentProps) => {
  const { state, args, result } = props;
  const labelService = useInjectable(LabelService);
  const appConfig = useInjectable<AppConfig>(AppConfig);
  const applyService = useInjectable<BaseApplyService>(BaseApplyService);
  const { target_file = '', code_edit } = args || {};
  const absolutePath = path.join(appConfig.workspaceDir, target_file);
  const codeBlockData = applyService.getCodeBlock(absolutePath);

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
  //   多次迭代时，仅在首处tool组件中展示
  if (!args || !codeBlockData || codeBlockData.iterationCount > 1) {
    return null;
  }
  return (
    <div className={styles['edit-file-tool']}>
      <div className={styles['edit-file-tool-header']}>
        {icon && <span className={icon}></span>}
        <span className={styles['edit-file-tool-file-name']}>{target_file}</span>
        {codeBlockData.iterationCount > 1 && (
          <span className={styles['edit-file-tool-iteration-count']}>{codeBlockData.iterationCount}/3</span>
        )}
        {state === 'streaming-start' || (state === 'streaming' && <Loading />)}
        {state === 'complete' && (
          <Icon
            iconClass='codicon codicon-circle-large'
            onClick={() => {
              applyService.reRenderPendingApply();
            }}
          />
        )}
        {state === 'result' && (
          <Icon
            iconClass='codicon codicon-check-all'
            onClick={() => {
              applyService.revealApplyPosition(codeBlockData.id);
            }}
          />
        )}
      </div>
      <ChatMarkdown markdown={`\`\`\`${languageId || ''}\n${code_edit}\n\`\`\``} />
    </div>
  );
};
