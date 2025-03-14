import { CancellationToken, Emitter } from '@opensumi/ide-core-common';
import { ChatFeatureRegistryToken, ChatServiceToken } from '@opensumi/ide-core-common/lib/types/ai-native';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { ChatAgentService } from '../../../lib/browser/chat/chat-agent.service';
import { IChatAgent, IChatAgentMetadata, IChatAgentRequest, IChatManagerService } from '../../../lib/common';
import { LLMContextServiceToken } from '../../../lib/common/llm-context';
import { ChatAgentPromptProvider } from '../../../lib/common/prompts/context-prompt-provider';

describe('ChatAgentService', () => {
  let injector: MockInjector;
  let chatAgentService: ChatAgentService;

  beforeEach(() => {
    injector = createBrowserInjector(
      [],
      new MockInjector([
        {
          token: IChatManagerService,
          useValue: {
            startSession: jest.fn(),
          },
        },
        {
          token: ChatAgentPromptProvider,
          useValue: {
            provideContextPrompt: async (val, msg) => msg,
          },
        },
        {
          token: ChatServiceToken,
          useValue: {},
        },
        {
          token: LLMContextServiceToken,
          useValue: {
            onDidContextFilesChangeEvent: new Emitter().event,
            serialize: () => {},
          },
        },
        {
          token: ChatFeatureRegistryToken,
          useValue: {},
        },
      ]),
    );
    chatAgentService = injector.get(ChatAgentService);
  });

  it('should register an agent', () => {
    const agent = { id: 'agent1', metadata: {} } as IChatAgent;
    const disposable = chatAgentService.registerAgent(agent);

    expect(chatAgentService.hasAgent(agent.id)).toBe(true);
    expect(chatAgentService.getAgent(agent.id)).toBe(agent);

    disposable.dispose();

    expect(chatAgentService.hasAgent(agent.id)).toBe(false);
    expect(chatAgentService.getAgent(agent.id)).toBeUndefined();
  });

  it('should update agent metadata', () => {
    const agent = {
      id: 'agent1',
      metadata: {},
      provideSlashCommands: () => Promise.resolve([]),
      invoke: () => {},
    } as unknown as IChatAgent;
    chatAgentService.registerAgent(agent);

    const updateMetadata = { name: 'Agent 1' } as IChatAgentMetadata;
    chatAgentService.updateAgent(agent.id, updateMetadata);

    expect(agent.metadata).toEqual(updateMetadata);
  });

  it('should invoke agent', async () => {
    const agent = {
      id: 'agent1',
      invoke: jest.fn().mockResolvedValue({}),
      metadata: {
        systemPrompt: 'You are a helpful assistant.',
      },
    } as unknown as IChatAgent;
    chatAgentService.registerAgent(agent);

    const request = {} as IChatAgentRequest;
    const progress = jest.fn();
    const history = [];
    const token = CancellationToken.None;

    await chatAgentService.invokeAgent(agent.id, request, progress, history, token);

    expect(agent.invoke).toHaveBeenCalledWith(request, progress, history, token);
  });

  it('should parse message', () => {
    const agent1 = { id: 'agent1', commands: [{ name: 'command1' }] } as unknown as IChatAgent;
    const agent2 = { id: 'agent2', commands: [{ name: 'command2' }] } as unknown as IChatAgent;
    chatAgentService.registerAgent(agent1);
    chatAgentService.registerAgent(agent2);

    const message1 = '@agent1 /command1 Hello';
    const parsedInfo1 = chatAgentService.parseMessage(message1);
    expect(parsedInfo1.agentId).toBe(agent1.id);
    expect(parsedInfo1.command).toBe('');
    expect(parsedInfo1.message).toBe('/command1 Hello');

    const message2 = '@agent2 /command2 World';
    const parsedInfo2 = chatAgentService.parseMessage(message2);
    expect(parsedInfo2.agentId).toBe(agent2.id);
    expect(parsedInfo2.command).toBe('');
    expect(parsedInfo2.message).toBe('/command2 World');

    const message3 = '@agent3 /command3 Hi';
    const parsedInfo3 = chatAgentService.parseMessage(message3);
    expect(parsedInfo3.agentId).toBe('');
    expect(parsedInfo3.command).toBe('');
    expect(parsedInfo3.message).toBe('@agent3 /command3 Hi');
  });
});
