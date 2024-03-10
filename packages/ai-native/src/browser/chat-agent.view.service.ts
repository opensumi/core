import { Injectable } from '@opensumi/di';
import { IDisposable } from '@opensumi/ide-core-common';

import { IChatAgentViewService, IChatComponentConfig } from './types';

@Injectable()
export class ChatAgentViewService implements IChatAgentViewService {
  private componentsMap = new Map<string, IChatComponentConfig>();

  registerChatComponent(config: IChatComponentConfig): IDisposable {
    this.componentsMap.set(config.id, config);
    return {
      dispose: () => {
        if (this.componentsMap.get(config.id) === config) {
          this.componentsMap.delete(config.id);
        }
      },
    };
  }

  getChatComponent(id: string): IChatComponentConfig | null {
    return this.componentsMap.get(id) || null;
  }
}
