import { Autowired, Injectable } from '@opensumi/di';
import { Deferred, IDisposable } from '@opensumi/ide-core-common';

import { IChatAgentService } from '../../common';
import { IChatAgentViewService, IChatComponentConfig } from '../types';

import { ChatProxyService } from './chat-proxy.service';

@Injectable()
export class ChatAgentViewService implements IChatAgentViewService {
  @Autowired(IChatAgentService)
  private readonly chatAgentService: IChatAgentService;

  private componentsMap = new Map<string, IChatComponentConfig>();
  private componentsDeferredMap = new Map<string, Deferred<IChatComponentConfig>>();

  registerChatComponent(config: IChatComponentConfig): IDisposable {
    this.componentsMap.set(config.id, config);
    if (this.componentsDeferredMap.has(config.id)) {
      this.componentsDeferredMap.get(config.id)!.resolve(config);
      this.componentsDeferredMap.delete(config.id);
    }
    return {
      dispose: () => {
        if (this.componentsMap.get(config.id) === config) {
          this.componentsMap.delete(config.id);
          this.componentsDeferredMap.delete(config.id);
        }
      },
    };
  }

  getChatComponent(id: string): IChatComponentConfig | null {
    if (this.componentsMap.has(id)) {
      return this.componentsMap.get(id)!;
    }
    if (!this.componentsDeferredMap.has(id)) {
      this.componentsDeferredMap.set(id, new Deferred());
    }
    return null;
  }

  getChatComponentDeferred(id: string) {
    return this.componentsDeferredMap.get(id) || null;
  }

  getRenderAgents() {
    return this.chatAgentService.getAgents().filter((agent) => agent.id !== ChatProxyService.AGENT_ID);
  }
}
