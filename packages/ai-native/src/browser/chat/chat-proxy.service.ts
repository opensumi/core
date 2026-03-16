/**
 * ChatProxyService - 聊天代理服务
 *
 * 负责注册默认的聊天 Agent，作为 AI 后端服务和聊天界面之间的代理：
 * - 注册默认 Agent 处理聊天请求
 * - 调用 AI 后端服务进行流式请求
 * - 管理请求配置（模型、API Key、系统提示等）
 *
 * 被以下类调用:
 * - ChatFeatureRegistry: 使用 AGENT_ID 注册斜杠命令
 * - ChatAgentViewService: 过滤渲染 Agent 时排除默认 Agent
 * - ApplyService: 依赖注入使用，获取请求配置
 */
import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  ChatAgentViewServiceToken,
  Disposable,
  IApplicationService,
  MCPConfigServiceToken,
} from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings/ai-native';

import { DefaultChatAgentToken, IChatAgentService } from '../../common';
import { ChatToolRender } from '../components/ChatToolRender';
import { MCPConfigService } from '../mcp/config/mcp-config.service';
import { IChatAgentViewService } from '../types';

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

  @Autowired(IApplicationService)
  private readonly applicationService: IApplicationService;

  @Autowired(MCPConfigServiceToken)
  private readonly mcpConfigService: MCPConfigService;

  @Autowired(DefaultChatAgentToken)
  private readonly defaultChatAgent: DefaultChatAgent;

  public registerDefaultAgent() {
    this.chatAgentViewService.registerChatComponent({
      id: 'toolCall',
      component: ChatToolRender,
      initialProps: {},
    });

    this.applicationService.getBackendOS().then(() => {
      this.addDispose(this.chatAgentService.registerAgent(this.defaultChatAgent));
      queueMicrotask(() => {
        this.chatAgentService.updateAgent(ChatProxyService.AGENT_ID, {});
      });
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
