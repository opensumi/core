import { Autowired, Injectable } from '@opensumi/di';
import { AINativeConfigService, PreferenceService } from '@opensumi/ide-core-browser';
import {
  ChatAgentViewServiceToken,
  Disposable,
  IApplicationService,
  IDisposable,
  MCPConfigServiceToken,
} from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

import { DefaultChatAgentToken, IChatAgentService } from '../../common';
import { ChatToolRender } from '../components/ChatToolRender';
import { MCPConfigService } from '../mcp/config/mcp-config.service';
import { IChatAgentViewService } from '../types';

import { AcpChatAgent } from './acp-chat-agent';
import { DefaultChatAgent } from './default-chat-agent';

/**
 * @internal
 */
@Injectable()
export class ChatProxyService extends Disposable {
  static readonly AGENT_ID = DefaultChatAgent.AGENT_ID;

  @Autowired(IChatAgentService)
  private readonly chatAgentService: IChatAgentService;

  @Autowired(ChatAgentViewServiceToken)
  private readonly chatAgentViewService: IChatAgentViewService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(IApplicationService)
  private readonly applicationService: IApplicationService;

  @Autowired(MCPConfigServiceToken)
  private readonly mcpConfigService: MCPConfigService;

  @Autowired(DefaultChatAgentToken)
  private readonly defaultChatAgent: DefaultChatAgent;

  @Autowired(AcpChatAgent)
  private readonly acpChatAgent: AcpChatAgent;

  private agentDisposable: IDisposable | null = null;

  public registerDefaultAgent() {
    this.chatAgentViewService.registerChatComponent({
      id: 'toolCall',
      component: ChatToolRender,
      initialProps: {},
    });

    this.applicationService.getBackendOS().then(() => {
      // 根据配置动态选择 Agent：ACP 模式使用 AcpChatAgent，否则使用 DefaultChatAgent
      const agentToRegister = this.aiNativeConfigService.capabilities.supportsAgentMode
        ? this.acpChatAgent
        : this.defaultChatAgent;

      const disposable = this.chatAgentService.registerAgent(agentToRegister);
      this.agentDisposable = disposable;
      queueMicrotask(() => {
        this.chatAgentService.updateAgent(ChatProxyService.AGENT_ID, {});
      });
    });
  }

  /**
   * Fallback to DefaultChatAgent when ACP is unavailable.
   * Disposes the previously registered AcpChatAgent and registers DefaultChatAgent in its place.
   */
  public registerFallbackAgent(): void {
    this.agentDisposable?.dispose();
    this.addDispose(this.chatAgentService.registerAgent(this.defaultChatAgent));
    queueMicrotask(() => {
      this.chatAgentService.updateAgent(ChatProxyService.AGENT_ID, {});
    });
  }

  public async getRequestOptions() {
    const model = this.preferenceService.get<string>(AINativeSettingSectionsId.LLMModelSelection);
    const modelId = this.preferenceService.get<string>(AINativeSettingSectionsId.ModelID);
    let apiKey: string = '';
    let baseURL: string = '';
    if (model === 'deepseek') {
      apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.DeepseekApiKey, '');
    } else if (model === 'openai') {
      apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiApiKey, '');
    } else if (model === 'anthropic') {
      apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.AnthropicApiKey, '');
    } else {
      // openai-compatible 为兜底
      apiKey = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiApiKey, '');
      baseURL = this.preferenceService.get<string>(AINativeSettingSectionsId.OpenaiBaseURL, '');
    }
    const maxTokens = this.preferenceService.get<number>(AINativeSettingSectionsId.MaxTokens);
    const agent = this.chatAgentService.getAgent(DefaultChatAgent.AGENT_ID);
    const disabledTools = await this.mcpConfigService.getDisabledTools();
    return {
      clientId: this.applicationService.clientId,
      model,
      modelId,
      apiKey,
      baseURL,
      maxTokens,
      system: agent?.metadata.systemPrompt,
      disabledTools,
    };
  }
}
