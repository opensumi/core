import { IRPCProtocol } from '@opensumi/ide-connection';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { MainThreadSumiAPIIdentifier } from '../../../../lib/common/sumi';
import { IMainThreadChatAgents } from '../../../../lib/common/sumi/chat-agents';
import { IExtensionDescription } from '../../../../lib/common/vscode';
import { ExtHostChatAgents } from '../../../../lib/hosted/api/sumi/ext.host.chat.impl';
import { CancellationToken, CancellationTokenSource } from '@opensumi/ide-core-common';

describe('ExtHostChatAgents', () => {
  let chatAgents: IMainThreadChatAgents;
  let extHostChatAgents: ExtHostChatAgents;
  const map = new Map();
  const rpcProtocol: IRPCProtocol = {
    getProxy: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
      return value;
    },
    get: (r) => map.get(r),
  };

  beforeEach(() => {
    chatAgents = mockService({});
    rpcProtocol.set(MainThreadSumiAPIIdentifier.MainThreadChatAgents, chatAgents);
    extHostChatAgents = new ExtHostChatAgents(rpcProtocol);
  });

  it('should create a chat agent', () => {
    // Mock the necessary dependencies and create an extension description
    const extension = {
      id: 'extensionId',
      name: 'Extension Name',
      version: '1.0.0',
      publisher: 'Publisher',
      extensionPath: '/path/to/extension',
    } as unknown as IExtensionDescription;
    const name = 'Chat Agent';
    const handler = jest.fn();

    // Call the createChatAgent method
    const agent = extHostChatAgents.createChatAgent(extension, name, handler);

    // Assert that the agent is created and registered
    expect(agent).toBeDefined();
    expect(extHostChatAgents['agents'].size).toBe(1);
    expect(extHostChatAgents['proxy'].$registerAgent).toHaveBeenCalledWith(expect.any(Number), name, {});
  });

  it('should send a message', () => {
    // Mock the necessary dependencies and create an extension description
    const extension = {
      id: 'extensionId',
      name: 'Extension Name',
      version: '1.0.0',
      publisher: 'Publisher',
      extensionPath: '/path/to/extension',
    } as unknown as IExtensionDescription;
    const chunk = {
      content: 'Hello, world!',
    };

    // Call the sendMessage method
    extHostChatAgents.sendMessage(extension, chunk);

    // Assert that the message is sent
    expect(extHostChatAgents['proxy'].$sendMessage).toHaveBeenCalledWith({
      kind: 'content',
      content: chunk.content,
    });
  });

  it('should invoke an agent', async () => {
    // Mock the necessary dependencies and create a request
    const handle = 1;
    const request = {
      sessionId: 'sessionId',
      requestId: 'requestId',
      command: 'command',
      message: 'message',
    };
    const context = {
      history: [],
    };
    const token = new CancellationTokenSource().token;

    // Mock the agent and its invoke method
    const agent = {
      invoke: jest.fn().mockResolvedValue({}),
      validateSlashCommand: jest.fn().mockResolvedValue(undefined),
      extension: {},
    };
    extHostChatAgents['agents'].set(handle, agent);

    // Call the $invokeAgent method
    const result = await extHostChatAgents.$invokeAgent(handle, request, context, token);

    // Assert that the agent is invoked and the result is returned
    expect(agent.invoke).toHaveBeenCalledWith(
      {
        prompt: request.message,
        variables: {},
        slashCommand: undefined,
      },
      { history: [] },
      expect.anything(),
      token,
    );
    expect(result).toEqual({ errorDetails: undefined });
  });

  // Add more test cases for other methods in ExtHostChatAgents
});
