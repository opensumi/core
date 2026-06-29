import { ChatManagerService } from '../../../src/browser/chat/chat-manager.service';
import { ChatFeatureRegistry } from '../../../src/browser/chat/chat.feature.registry';

describe('ChatManagerService', () => {
  const createService = () => {
    const service = new ChatManagerService() as ChatManagerService & {
      chatAgentService: any;
      chatFeatureRegistry: ChatFeatureRegistry;
      logger: any;
      saveSessions: jest.Mock;
      preferenceService: any;
    };

    Object.defineProperty(service, 'chatFeatureRegistry', {
      value: new ChatFeatureRegistry(),
    });
    Object.defineProperty(service, 'logger', {
      value: {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      },
    });
    Object.defineProperty(service, 'preferenceService', {
      value: {
        get: jest.fn(() => undefined),
      },
    });
    Object.defineProperty(service, 'saveSessions', {
      value: jest.fn(),
    });

    return service;
  };

  it('sets response error details when agent invocation throws', async () => {
    const service = createService();
    const model = await service.startSession();
    const request = model.addRequest({ agentId: 'agentId', prompt: 'hello' });
    const error = new Error('request failed');

    Object.defineProperty(service, 'chatAgentService', {
      value: {
        invokeAgent: jest.fn().mockRejectedValue(error),
        getFollowups: jest.fn().mockResolvedValue([]),
      },
    });

    await service.sendRequest(model.sessionId, request, false);

    expect(request.response.errorDetails).toEqual({ message: error.message });
    expect(request.response.isComplete).toBe(true);
    expect(service.chatAgentService.getFollowups).not.toHaveBeenCalled();
  });

  it('completes response immediately when agent returns error details', async () => {
    const service = createService();
    const model = await service.startSession();
    const request = model.addRequest({ agentId: 'agentId', prompt: 'hello' });

    Object.defineProperty(service, 'chatAgentService', {
      value: {
        invokeAgent: jest.fn().mockResolvedValue({ errorDetails: { message: 'agent error' } }),
        getFollowups: jest.fn().mockResolvedValue([]),
      },
    });

    await service.sendRequest(model.sessionId, request, false);

    expect(request.response.errorDetails).toEqual({ message: 'agent error' });
    expect(request.response.isComplete).toBe(true);
    expect(service.chatAgentService.invokeAgent).toHaveBeenCalledWith(
      request.message.agentId,
      expect.objectContaining({
        sessionId: model.sessionId,
        requestId: request.requestId,
        message: request.message.prompt,
        regenerate: false,
      }),
      expect.any(Function),
      expect.any(Array),
      expect.anything(),
    );
    expect(service.chatAgentService.getFollowups).not.toHaveBeenCalled();
  });
});
