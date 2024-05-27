import cls from 'classnames';
import React, { ReactNode } from 'react';

import { Injectable, Autowired } from '@opensumi/di';
import { Icon } from '@opensumi/ide-components';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { MarkerService } from '@opensumi/ide-markers/lib/browser/markers-service';
import { MarkerGroupNode, MarkerNode } from '@opensumi/ide-markers/lib/browser/tree/tree-node.defined';

import { InstructionEnum } from '../../common';
import { AiChatService } from '../ai-chat.service';

import styles from './override.module.less';

@Injectable()
export class AiMarkerService extends MarkerService {
  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  @Autowired()
  private aiChatService: AiChatService;

  @Autowired(IFileServiceClient)
  private readonly fileSystem: IFileServiceClient;

  private async handleAiIcon(node: MarkerNode) {
    try {
      const resource = node.marker.resource;
      const message = node.marker.message;
      const { content } = await this.fileSystem.readFile(resource.toString());

      const messageWithPrompt = `代码内容是 \`\`\`\n${content.toString()}\n\`\`\`。此时有个异常问题是 "${message}", 你需要解释这个异常问题并给出修复建议`;

      this.aiChatService.launchChatMessage({
        message: `${InstructionEnum.aiExplainKey} ${node.marker.message}`,
        prompt: messageWithPrompt,
      });
    } catch (error) {
      throw Error('read file error', error);
    }
  }

  override renderMarkerNodeIcon(component: ReactNode, node: MarkerGroupNode | MarkerNode): ReactNode {
    return (
      <div className={cls(!MarkerGroupNode.is(node) && styles.ai_marker_node_icon_container)}>
        {!MarkerGroupNode.is(node) && (
          <Icon
            tooltip='AI 智能问题诊断'
            onClick={() => this.handleAiIcon(node)}
            className={cls(getExternalIcon('lightbulb'), styles.ai_icon)}
          />
        )}
        {component}
      </div>
    );
  }
}
