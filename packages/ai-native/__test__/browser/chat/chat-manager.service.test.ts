import { PreferenceService } from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId, CancellationToken, Emitter } from '@opensumi/ide-core-common';
import { ChatFeatureRegistryToken } from '@opensumi/ide-core-common/lib/types/ai-native';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { ChatManagerService } from '../../../src/browser/chat/chat-manager.service';
import { ChatFeatureRegistry } from '../../../src/browser/chat/chat.feature.registry';
import { ISessionModel, ISessionProvider } from '../../../src/browser/chat/session-provider';
import { ISessionProviderRegistry } from '../../../src/browser/chat/session-provider-registry';
import { IChatAgentService } from '../../../src/common';

describe('ChatManagerService', () => {
  let injector: MockInjector;
  let chatManagerService: ChatManagerService;
  let mockSessionProviderRegistry: jest.Mocked<ISessionProviderRegistry>;
  let mockMainProvider: jest.Mocked<ISessionProvider>;
  let mockChatAgentService: jest.Mocked<IChatAgentService>;
  let mockPreferenceService: jest.Mocked<PreferenceService>;
  let mockChatFeatureRegistry: jest.Mocked<ChatFeatureRegistry>;

  const mockSessionData: ISessionModel[] = [
    {
      sessionId: 'test-session-1',
      modelId: 'test-model',
      history: {
        additional: {},
        messages: [
          {
            role: 'user' as any,
            content: 'Hello',
            id: '',
            order: 0,
          },
          {
            role: 'assistant' as any,
            content: 'Hi there!',
            id: '',
            order: 0,
          },
        ],
      },
      requests: [],
    },
  ];

  beforeEach(() => {
    jest.useFakeTimers();

    mockMainProvider = {
      id: 'local-storage',
      canHandle: jest.fn().mockReturnValue(true),
      loadSessions: jest.fn().mockResolvedValue(mockSessionData),
      loadSession: jest.fn().mockResolvedValue(mockSessionData[0]),
      saveSessions: jest.fn().mockResolvedValue(undefined),
    };

    mockSessionProviderRegistry = {
      initialize: jest.fn(),
      getProvider: jest.fn().mockReturnValue(mockMainProvider),
      getProviderBySessionId: jest.fn().mockReturnValue(mockMainProvider),
      getAllProviders: jest.fn().mockReturnValue([mockMainProvider]),
      registerProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    } as unknown as jest.Mocked<ISessionProviderRegistry>;

    mockChatAgentService = {
      invokeAgent: jest.fn().mockResolvedValue({}),
      getFollowups: jest.fn().mockResolvedValue([]),
      hasAgent: jest.fn().mockReturnValue(true),
      getAgent: jest.fn(),
      registerAgent: jest.fn(),
      updateAgent: jest.fn(),
      parseMessage: jest.fn(),
      getAgents: jest.fn().mockReturnValue([]),
      getSlashCommands: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<IChatAgentService>;

    mockPreferenceService = {
      get: jest.fn(),
      onPreferenceChanged: new Emitter().event,
    } as unknown as jest.Mocked<PreferenceService>;

    mockChatFeatureRegistry = {
      getFeatures: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<ChatFeatureRegistry>;

    injector = createBrowserInjector(
      [],
      new MockInjector([
        {
          token: ISessionProviderRegistry,
          useValue: mockSessionProviderRegistry,
        },
        {
          token: IChatAgentService,
          useValue: mockChatAgentService,
        },
        {
          token: PreferenceService,
          useValue: mockPreferenceService,
        },
        {
          token: ChatFeatureRegistryToken,
          useValue: mockChatFeatureRegistry,
        },
      ]),
    );

    chatManagerService = injector.get(ChatManagerService);
  });

  afterEach(() => {
    chatManagerService.dispose();
    jest.useRealTimers();
  });

  describe('init()', () => {
    it('should call getAllProviders and load sessions from the first matching provider', async () => {
      await chatManagerService.init();

      expect(mockSessionProviderRegistry.getAllProviders).toHaveBeenCalled();
      expect(mockMainProvider.loadSessions).toHaveBeenCalled();
    });

    it('should add loaded sessions to sessionModels cache', async () => {
      await chatManagerService.init();

      const session = chatManagerService.getSession('test-session-1');
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe('test-session-1');
    });

    it('should restore modelId from session data', async () => {
      await chatManagerService.init();

      const session = chatManagerService.getSession('test-session-1');
      expect(session?.modelId).toBe('test-model');
    });

    it('should fire storageInit event after loading', async () => {
      const initCallback = jest.fn();
      chatManagerService.onStorageInit(initCallback);

      await chatManagerService.init();

      expect(initCallback).toHaveBeenCalled();
    });

    it('should filter out sessions with empty message history', async () => {
      const emptySessionData: ISessionModel[] = [
        {
          sessionId: 'empty-session',
          modelId: 'test-model',
          history: {
            additional: {},
            messages: [],
          },
          requests: [],
        },
        ...mockSessionData,
      ];
      mockMainProvider.loadSessions.mockResolvedValue(emptySessionData);

      await chatManagerService.init();

      expect(chatManagerService.getSession('empty-session')).toBeUndefined();
      expect(chatManagerService.getSession('test-session-1')).toBeDefined();
    });

    it('should restore requests from session data', async () => {
      const sessionWithRequests: ISessionModel[] = [
        {
          sessionId: 'session-with-requests',
          modelId: 'test-model',
          history: {
            additional: {},
            messages: [{ role: 'user' as any, content: 'Hello' }],
          },
          requests: [
            {
              requestId: 'req-1',
              message: { prompt: 'Hello', agentId: 'test-agent' },
              response: {
                isCanceled: false,
                responseText: 'Hi there!',
                responseContents: [],
                responseParts: [],
                errorDetails: undefined,
                followups: undefined,
              },
            },
          ],
        },
      ];
      mockMainProvider.loadSessions.mockResolvedValue(sessionWithRequests);

      await chatManagerService.init();

      const session = chatManagerService.getSession('session-with-requests');
      expect(session).toBeDefined();
      const requests = session!.getRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].requestId).toBe('req-1');
      expect(requests[0].message.prompt).toBe('Hello');
      expect(requests[0].response.responseText).toBe('Hi there!');
      expect(requests[0].response.isComplete).toBe(true);
    });
  });

  describe('startSession()', () => {
    it('should create a new session with unique sessionId', () => {
      const session = chatManagerService.startSession();

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(chatManagerService.getSession(session.sessionId)).toBe(session);
    });

    it('should add session to sessionModels cache', () => {
      const session = chatManagerService.startSession();

      expect(chatManagerService.getSession(session.sessionId)).toBe(session);
    });

    it('should create multiple sessions with different ids', () => {
      const session1 = chatManagerService.startSession();
      const session2 = chatManagerService.startSession();

      expect(session1.sessionId).not.toBe(session2.sessionId);
      expect(chatManagerService.getSession(session1.sessionId)).toBe(session1);
      expect(chatManagerService.getSession(session2.sessionId)).toBe(session2);
    });
  });

  describe('getSession()', () => {
    it('should return existing session', () => {
      const session = chatManagerService.startSession();

      const retrieved = chatManagerService.getSession(session.sessionId);

      expect(retrieved).toBe(session);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = chatManagerService.getSession('non-existent-id');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('clearSession()', () => {
    it('should remove session from cache', () => {
      const session = chatManagerService.startSession();

      chatManagerService.clearSession(session.sessionId);

      expect(chatManagerService.getSession(session.sessionId)).toBeUndefined();
    });

    it('should cancel pending request when clearing session', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      // Use a deferred promise so we can control when invokeAgent resolves
      let resolveInvoke!: (value: any) => void;
      mockPreferenceService.get.mockReturnValue('test-model');
      mockChatAgentService.invokeAgent.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInvoke = resolve;
          }),
      );

      const sendPromise = chatManagerService.sendRequest(session.sessionId, request, false);

      // Clear the session while request is pending
      chatManagerService.clearSession(session.sessionId);

      expect(chatManagerService.getSession(session.sessionId)).toBeUndefined();

      // Resolve the invoke to let sendRequest finish
      resolveInvoke({});
      await sendPromise;
    });

    it('should call saveSessions after clearing', async () => {
      await chatManagerService.init();
      mockMainProvider.saveSessions.mockClear();

      const session = chatManagerService.startSession();

      chatManagerService.clearSession(session.sessionId);

      // Advance past the debounce delay (1000ms)
      jest.advanceTimersByTime(1100);

      // Flush microtasks
      await Promise.resolve();

      expect(mockMainProvider.saveSessions).toHaveBeenCalled();
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        chatManagerService.clearSession('non-existent-id');
      }).toThrow('Unknown session: non-existent-id');
    });
  });

  describe('getSessions()', () => {
    it('should return all sessions', () => {
      const session1 = chatManagerService.startSession();
      const session2 = chatManagerService.startSession();

      const sessions = chatManagerService.getSessions();

      expect(sessions).toContain(session1);
      expect(sessions).toContain(session2);
      expect(sessions.length).toBe(2);
    });

    it('should return empty array when no sessions', () => {
      const sessions = chatManagerService.getSessions();

      expect(sessions).toEqual([]);
    });

    it('should include sessions loaded from init', async () => {
      await chatManagerService.init();

      const sessions = chatManagerService.getSessions();

      expect(sessions.length).toBe(1);
      expect(sessions[0].sessionId).toBe('test-session-1');
    });

    it('should include both loaded and newly created sessions', async () => {
      await chatManagerService.init();
      const newSession = chatManagerService.startSession();

      const sessions = chatManagerService.getSessions();

      expect(sessions.length).toBe(2);
      expect(sessions.some((s) => s.sessionId === 'test-session-1')).toBe(true);
      expect(sessions.some((s) => s.sessionId === newSession.sessionId)).toBe(true);
    });
  });

  describe('createRequest()', () => {
    it('should create a request for existing session', () => {
      const session = chatManagerService.startSession();

      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent');

      expect(request).toBeDefined();
      expect(request?.message.prompt).toBe('Hello');
      expect(request?.message.agentId).toBe('test-agent');
    });

    it('should create a request with command', () => {
      const session = chatManagerService.startSession();

      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent', 'explain');

      expect(request).toBeDefined();
      expect(request?.message.command).toBe('explain');
    });

    it('should create a request with images', () => {
      const session = chatManagerService.startSession();

      const request = chatManagerService.createRequest(session.sessionId, 'Describe this', 'test-agent', undefined, [
        'image1.png',
        'image2.png',
      ]);

      expect(request).toBeDefined();
      expect(request?.message.images).toEqual(['image1.png', 'image2.png']);
    });

    it('should return undefined if session has pending request', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      // Use a deferred promise to keep the request pending
      let resolveInvoke!: (value: any) => void;
      mockPreferenceService.get.mockReturnValue('test-model');
      mockChatAgentService.invokeAgent.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInvoke = resolve;
          }),
      );

      const sendPromise = chatManagerService.sendRequest(session.sessionId, request, false);

      // Try to create another request while one is pending
      const secondRequest = chatManagerService.createRequest(session.sessionId, 'World', 'test-agent');
      expect(secondRequest).toBeUndefined();

      // Cleanup: resolve and cancel
      chatManagerService.cancelRequest(session.sessionId);
      resolveInvoke({});
      await sendPromise;
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        chatManagerService.createRequest('non-existent-id', 'Hello', 'test-agent');
      }).toThrow('Unknown session: non-existent-id');
    });
  });

  describe('sendRequest()', () => {
    it('should send request through chat agent service', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');

      await chatManagerService.sendRequest(session.sessionId, request, false);

      expect(mockChatAgentService.invokeAgent).toHaveBeenCalledWith(
        'test-agent',
        expect.objectContaining({
          sessionId: session.sessionId,
          requestId: request.requestId,
          message: 'Hello',
          regenerate: false,
        }),
        expect.any(Function),
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('should set modelId on first request', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');

      await chatManagerService.sendRequest(session.sessionId, request, false);

      expect(session.modelId).toBe('test-model');
    });

    it('should not change modelId if already set and matches', async () => {
      const session = chatManagerService.startSession();
      session.modelId = 'test-model';
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');

      await chatManagerService.sendRequest(session.sessionId, request, false);

      expect(session.modelId).toBe('test-model');
    });

    it('should throw error if model changed', async () => {
      const session = chatManagerService.startSession();
      session.modelId = 'old-model';
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('new-model');

      await expect(chatManagerService.sendRequest(session.sessionId, request, false)).rejects.toThrow(
        'Model changed unexpectedly',
      );
    });

    it('should throw error for non-existent session', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      await expect(chatManagerService.sendRequest('non-existent-id', request, false)).rejects.toThrow(
        'Unknown session: non-existent-id',
      );
    });

    it('should pass regenerate flag to agent', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');

      await chatManagerService.sendRequest(session.sessionId, request, true);

      expect(mockChatAgentService.invokeAgent).toHaveBeenCalledWith(
        'test-agent',
        expect.objectContaining({
          regenerate: true,
        }),
        expect.any(Function),
        expect.any(Array),
        expect.any(Object),
      );
    });

    it('should set error details from agent result', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');
      const errorDetails = { message: 'Something went wrong' };
      mockChatAgentService.invokeAgent.mockResolvedValueOnce({ errorDetails });

      await chatManagerService.sendRequest(session.sessionId, request, false);

      expect(request.response.errorDetails).toEqual(errorDetails);
    });

    it('should set followups from agent service', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');
      const followups = [{ kind: 'reply' as const, message: 'Tell me more' }];
      mockChatAgentService.getFollowups.mockResolvedValueOnce(followups);

      await chatManagerService.sendRequest(session.sessionId, request, false);

      // Flush microtasks for followups promise to resolve
      await Promise.resolve();
      await Promise.resolve();

      expect(mockChatAgentService.getFollowups).toHaveBeenCalledWith(
        'test-agent',
        session.sessionId,
        CancellationToken.None,
      );
      expect(request.response.followups).toEqual(followups);
      expect(request.response.isComplete).toBe(true);
    });

    it('should handle cancellation during request', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');

      // Make invokeAgent cancel the request mid-flight
      mockChatAgentService.invokeAgent.mockImplementation(async (_agentId, _req, _progress, _history, token) => {
        // Simulate cancellation during the request
        chatManagerService.cancelRequest(session.sessionId);
        return {};
      });

      await chatManagerService.sendRequest(session.sessionId, request, false);

      expect(request.response.isCanceled).toBe(true);
    });

    it('should clean up pending request after completion', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');

      await chatManagerService.sendRequest(session.sessionId, request, false);

      // After sendRequest completes, creating a new request should work (no pending request)
      const newRequest = chatManagerService.createRequest(session.sessionId, 'World', 'test-agent');
      expect(newRequest).toBeDefined();
    });

    it('should clean up pending request even if agent throws', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');
      mockChatAgentService.invokeAgent.mockRejectedValueOnce(new Error('Agent error'));

      await expect(chatManagerService.sendRequest(session.sessionId, request, false)).rejects.toThrow('Agent error');

      // After error, creating a new request should work (pending request cleaned up)
      const newRequest = chatManagerService.createRequest(session.sessionId, 'World', 'test-agent');
      expect(newRequest).toBeDefined();
    });

    it('should pass context window from preferences to getMessageHistory', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockImplementation((key: string) => {
        if (key === AINativeSettingSectionsId.ModelID) {
          return 'test-model';
        }
        if (key === AINativeSettingSectionsId.ContextWindow) {
          return 4096;
        }
        return undefined;
      });

      const getMessageHistorySpy = jest.spyOn(session, 'getMessageHistory');

      await chatManagerService.sendRequest(session.sessionId, request, false);

      expect(getMessageHistorySpy).toHaveBeenCalledWith(4096);
      getMessageHistorySpy.mockRestore();
    });

    it('should accept progress from agent during request', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');

      mockChatAgentService.invokeAgent.mockImplementation(async (_agentId, _req, progressCallback) => {
        progressCallback({ kind: 'content', content: 'Hello ' });
        progressCallback({ kind: 'content', content: 'World' });
        return {};
      });

      await chatManagerService.sendRequest(session.sessionId, request, false);

      expect(request.response.responseText).toContain('Hello ');
      expect(request.response.responseText).toContain('World');
    });

    it('should not accept progress after cancellation', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');

      mockChatAgentService.invokeAgent.mockImplementation(async (_agentId, _req, progressCallback, _history, token) => {
        progressCallback({ kind: 'content', content: 'Before cancel' });
        // Simulate cancellation
        chatManagerService.cancelRequest(session.sessionId);
        // This progress should be ignored because token is cancelled
        progressCallback({ kind: 'content', content: 'After cancel' });
        return {};
      });

      await chatManagerService.sendRequest(session.sessionId, request, false);

      expect(request.response.responseText).toContain('Before cancel');
      expect(request.response.responseText).not.toContain('After cancel');
    });

    it('should pass command and images in request props', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Describe this', 'test-agent', 'explain', [
        'img1.png',
      ])!;

      mockPreferenceService.get.mockReturnValueOnce('test-model');

      await chatManagerService.sendRequest(session.sessionId, request, false);

      expect(mockChatAgentService.invokeAgent).toHaveBeenCalledWith(
        'test-agent',
        expect.objectContaining({
          command: 'explain',
          images: ['img1.png'],
        }),
        expect.any(Function),
        expect.any(Array),
        expect.any(Object),
      );
    });
  });

  describe('cancelRequest()', () => {
    it('should cancel pending request', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      let resolveInvoke!: (value: any) => void;
      mockPreferenceService.get.mockReturnValue('test-model');
      mockChatAgentService.invokeAgent.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInvoke = resolve;
          }),
      );

      const sendPromise = chatManagerService.sendRequest(session.sessionId, request, false);

      // Cancel the request
      chatManagerService.cancelRequest(session.sessionId);

      // Resolve to let sendRequest finish
      resolveInvoke({});
      await sendPromise;

      expect(request.response.isCanceled).toBe(true);
    });

    it('should be safe to cancel non-existent request', () => {
      expect(() => {
        chatManagerService.cancelRequest('non-existent-id');
      }).not.toThrow();
    });

    it('should allow new request after cancellation', async () => {
      const session = chatManagerService.startSession();
      const request = chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent')!;

      let resolveInvoke!: (value: any) => void;
      mockPreferenceService.get.mockReturnValue('test-model');
      mockChatAgentService.invokeAgent.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInvoke = resolve;
          }),
      );

      const sendPromise = chatManagerService.sendRequest(session.sessionId, request, false);
      chatManagerService.cancelRequest(session.sessionId);
      resolveInvoke({});
      await sendPromise;

      // Should be able to create a new request
      const newRequest = chatManagerService.createRequest(session.sessionId, 'World', 'test-agent');
      expect(newRequest).toBeDefined();
    });
  });

  describe('saveSessions()', () => {
    it('should save sessions through provider', async () => {
      await chatManagerService.init();
      mockMainProvider.saveSessions.mockClear();

      chatManagerService.startSession();

      // Trigger save and advance past debounce
      chatManagerService['saveSessions']();
      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      expect(mockMainProvider.saveSessions).toHaveBeenCalled();
    });

    it('should convert ChatModel to ISessionData before saving', async () => {
      await chatManagerService.init();
      mockMainProvider.saveSessions.mockClear();

      const session = chatManagerService.startSession();

      chatManagerService['saveSessions']();
      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      const savedData = (mockMainProvider.saveSessions as jest.Mock).mock.calls[0][0];
      expect(savedData).toBeDefined();
      expect(Array.isArray(savedData)).toBe(true);
      expect(savedData.some((d: ISessionModel) => d.sessionId === session.sessionId)).toBe(true);
    });

    it('should not save if mainProvider has no saveSessions method', async () => {
      // Set mainProvider without saveSessions
      const providerWithoutSave: ISessionProvider = {
        id: 'no-save',
        canHandle: jest.fn().mockReturnValue(true),
        loadSessions: jest.fn().mockResolvedValue([]),
        loadSession: jest.fn().mockResolvedValue(undefined),
      };
      mockSessionProviderRegistry.getAllProviders.mockReturnValue([providerWithoutSave]);

      await chatManagerService.init();
      chatManagerService.startSession();

      // Should not throw
      chatManagerService['saveSessions']();
      jest.advanceTimersByTime(1100);
      await Promise.resolve();
    });

    it('should include request data in saved sessions', async () => {
      await chatManagerService.init();
      mockMainProvider.saveSessions.mockClear();

      const session = chatManagerService.startSession();
      chatManagerService.createRequest(session.sessionId, 'Hello', 'test-agent');

      chatManagerService['saveSessions']();
      jest.advanceTimersByTime(1100);
      await Promise.resolve();

      const savedData = (mockMainProvider.saveSessions as jest.Mock).mock.calls[0][0] as ISessionModel[];
      const savedSession = savedData.find((d) => d.sessionId === session.sessionId);
      expect(savedSession).toBeDefined();
      expect(savedSession!.requests.length).toBe(1);
      expect(savedSession!.requests[0].message.prompt).toBe('Hello');
    });
  });

  describe('LRU cache behavior', () => {
    it('should evict oldest sessions when exceeding MAX_SESSION_COUNT', () => {
      const sessions: string[] = [];

      // Create 21 sessions (MAX_SESSION_COUNT is 20)
      for (let i = 0; i < 21; i++) {
        const session = chatManagerService.startSession();
        sessions.push(session.sessionId);
      }

      // The first session should have been evicted
      expect(chatManagerService.getSession(sessions[0])).toBeUndefined();
      // The last session should still exist
      expect(chatManagerService.getSession(sessions[20])).toBeDefined();
    });
  });
});
