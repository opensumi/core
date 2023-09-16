import React, { ReactNode } from 'react';
import { Injectable, Autowired } from '@opensumi/di';
import { MarkerService } from '@opensumi/ide-markers/lib/browser/markers-service';
import { MarkerGroupNode, MarkerNode } from '@opensumi/ide-markers/lib/browser/tree/tree-node.defined';

import cls from 'classnames';

import * as styles from './override.module.less';
import { Icon } from '@opensumi/ide-components';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { AiChatService } from '../ai-chat.service';

@Injectable()
export class AiMarkerService extends MarkerService {

  @Autowired()
  private aiChatService: AiChatService;

  private handleAiIcon(node: MarkerNode) {
    this.aiChatService.launchChatMessage({
      message: `/explain ${node.marker.message}`,
      prompt: this.aiChatService.explainProblemPrompt(node.marker.message),
    });
  }

  override renderMarkerNodeIcon(component: ReactNode, node: MarkerGroupNode | MarkerNode): ReactNode {
    return (
      <div className={cls(!(MarkerGroupNode.is(node)) && styles.ai_marker_node_icon_container)}>
        {
          !MarkerGroupNode.is(node) && <Icon tooltip='AI 智能问题诊断' onClick={() => this.handleAiIcon(node)} className={cls(getExternalIcon('lightbulb'), styles.ai_icon)} />
        }
        {component}
      </div>
    )
  }
}