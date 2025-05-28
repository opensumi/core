import { IChatContent } from '@opensumi/ide-core-common';
import { MarkdownString } from '@opensumi/monaco-editor-core/esm/vs/base/common/htmlContent';

import {
  ChatModel,
  ChatRequestModel,
  ChatResponseModel,
  ChatSlashCommandItemModel,
  ChatWelcomeMessageModel,
} from '../../../src/browser/chat/chat-model';
import { ChatFeatureRegistry } from '../../../src/browser/chat/chat.feature.registry';
import { IChatSlashCommandItem } from '../../../src/browser/types';
import { IChatModel, IChatRequestMessage } from '../../../src/common';

// Mock ChatFeatureRegistry
class MockChatFeatureRegistry extends ChatFeatureRegistry {
  constructor() {
    super();
  }
}

describe('ChatResponseModel', () => {
  let chatResponseModel: ChatResponseModel;

  beforeEach(() => {
    chatResponseModel = new ChatResponseModel('requestId', {} as any, 'agentId');
  });

  afterEach(() => {
    chatResponseModel.dispose();
  });

  it('should initialize with default values', () => {
    expect(chatResponseModel.responseParts).toEqual([]);
    expect(chatResponseModel.responseContents).toEqual([]);
    expect(chatResponseModel.isComplete).toBe(false);
    expect(chatResponseModel.isCanceled).toBe(false);
    expect(chatResponseModel.requestId).toBe('requestId');
    expect(chatResponseModel.responseText).toBe('');
    expect(chatResponseModel.errorDetails).toBeUndefined();
    expect(chatResponseModel.followups).toBeUndefined();
  });

  it('should update content correctly', () => {
    chatResponseModel.updateContent({ kind: 'content', content: 'Hello' });
    expect(chatResponseModel.responseParts).toEqual([
      { kind: 'markdownContent', content: new MarkdownString('Hello') },
    ]);
    expect(chatResponseModel.responseText).toBe('Hello');

    chatResponseModel.updateContent({ kind: 'markdownContent', content: new MarkdownString(' World') });
    expect(chatResponseModel.responseParts).toEqual([
      { kind: 'markdownContent', content: new MarkdownString('Hello World') },
    ]);
    expect(chatResponseModel.responseText).toBe('Hello World');

    const resolvedContent = Promise.resolve(new MarkdownString('Async Content'));
    chatResponseModel.updateContent({ kind: 'asyncContent', content: '', resolvedContent });
    expect(chatResponseModel.responseParts).toEqual([
      { kind: 'markdownContent', content: new MarkdownString('Hello World') },
      { kind: 'asyncContent', content: '', resolvedContent },
    ]);
    expect(chatResponseModel.responseText).toBe('Hello World\n\n');

    // Wait for the promise to resolve
    return Promise.resolve().then(() => {
      expect(chatResponseModel.responseParts).toEqual([
        { kind: 'markdownContent', content: new MarkdownString('Hello World') },
        { kind: 'markdownContent', content: new MarkdownString('Async Content') },
      ]);
      expect(chatResponseModel.responseText).toBe('Hello World\n\nAsync Content');
    });
  });

  it('should complete and cancel correctly', () => {
    chatResponseModel.complete();
    expect(chatResponseModel.isComplete).toBe(true);

    chatResponseModel.cancel();
    expect(chatResponseModel.isComplete).toBe(true);
    expect(chatResponseModel.isCanceled).toBe(true);
  });

  it('should reset to default values', () => {
    chatResponseModel.updateContent({ kind: 'content', content: 'Hello' });
    chatResponseModel.complete();
    chatResponseModel.setErrorDetails({ message: 'Error' });
    chatResponseModel.setFollowups([{ kind: 'reply', message: 'Followup' }]);

    chatResponseModel.reset();

    expect(chatResponseModel.responseParts).toEqual([]);
    expect(chatResponseModel.responseContents).toEqual([]);
    expect(chatResponseModel.responseText).toBe('');
    expect(chatResponseModel.isCanceled).toBe(false);
    expect(chatResponseModel.isComplete).toBe(false);
    expect(chatResponseModel.errorDetails).toBeUndefined();
    expect(chatResponseModel.followups).toBeUndefined();
  });
});

describe('ChatModel', () => {
  let chatModel: ChatModel;
  let mockChatFeatureRegistry: ChatFeatureRegistry;

  beforeEach(() => {
    mockChatFeatureRegistry = new MockChatFeatureRegistry();
    chatModel = new ChatModel(mockChatFeatureRegistry);
  });

  afterEach(() => {
    chatModel.dispose();
  });

  it('should initialize with default values', () => {
    expect(chatModel.sessionId).toBeDefined();
    expect(chatModel.requests).toEqual([]);
  });

  it('should add a request correctly', () => {
    const message = { agentId: 'agentId', prompt: 'Hello' };
    const request = chatModel.addRequest(message);

    expect(chatModel.requests.length).toBe(1);
    expect(request.requestId).toBeDefined();
    expect(request.session).toBe(chatModel);
    expect(request.message).toBe(message);
    expect(request.response).toBeInstanceOf(ChatResponseModel);
  });

  it('should accept response progress correctly', () => {
    const message = { agentId: 'agentId', prompt: 'Hello' };
    const request = chatModel.addRequest(message);

    const progress: IChatContent = { kind: 'content', content: 'Hello' };
    chatModel.acceptResponseProgress(request, progress);

    expect(request.response.responseParts).toEqual([{ kind: 'markdownContent', content: new MarkdownString('Hello') }]);
    expect(request.response.responseText).toBe('Hello');
  });

  it('should dispose correctly', () => {
    const message = { agentId: 'agentId', prompt: 'Hello' };
    const request = chatModel.addRequest(message);

    chatModel.dispose();

    expect(chatModel.disposed).toBe(true);
    expect(request.response.disposed).toBe(true);
  });
});
describe('ChatRequestModel', () => {
  let chatRequestModel: ChatRequestModel;
  let requestId: string;
  let session: IChatModel;
  let message: IChatRequestMessage;
  let response: ChatResponseModel;

  beforeEach(() => {
    requestId = 'requestId';
    session = {} as IChatModel;
    message = { agentId: 'agentId', prompt: 'Hello' };
    response = new ChatResponseModel('requestId', {} as any, 'agentId');
    chatRequestModel = new ChatRequestModel(requestId, session, message, response as any);
  });

  it('should have the correct requestId', () => {
    expect(chatRequestModel.requestId).toBe(requestId);
  });

  it('should have the correct session', () => {
    expect(chatRequestModel.session).toBe(session);
  });

  it('should have the correct message', () => {
    expect(chatRequestModel.message).toBe(message);
  });

  it('should have the correct response', () => {
    expect(chatRequestModel.response).toBe(response);
  });
});
describe('ChatSlashCommandItemModel', () => {
  let chatCommand: IChatSlashCommandItem;
  let chatSlashCommandItemModel: ChatSlashCommandItemModel;

  beforeEach(() => {
    chatCommand = {
      name: 'testCommand',
      isShortcut: true,
      icon: 'testIcon',
      description: 'testDescription',
      tooltip: 'testTooltip',
    };
    chatSlashCommandItemModel = new ChatSlashCommandItemModel(chatCommand, 'command', 'agentId');
  });

  it('should have the correct name', () => {
    expect(chatSlashCommandItemModel.name).toBe(chatCommand.name);
  });

  it('should have the correct isShortcut value', () => {
    expect(chatSlashCommandItemModel.isShortcut).toBe(chatCommand.isShortcut);
  });

  it('should have the correct icon', () => {
    expect(chatSlashCommandItemModel.icon).toBe(chatCommand.icon);
  });

  it('should have the correct description', () => {
    expect(chatSlashCommandItemModel.description).toBe(chatCommand.description);
  });

  it('should have the correct tooltip', () => {
    expect(chatSlashCommandItemModel.tooltip).toBe(chatCommand.tooltip);
  });

  it('should have the correct nameWithSlash value', () => {
    const AI_SLASH = '/';
    const expectedNameWithSlash = chatCommand.name.startsWith(AI_SLASH)
      ? chatCommand.name
      : `${AI_SLASH} ${chatCommand.name}`;
    expect(chatSlashCommandItemModel.nameWithSlash).toBe(expectedNameWithSlash);
  });
});
describe('ChatWelcomeMessageModel', () => {
  let chatWelcomeMessageModel: ChatWelcomeMessageModel;

  beforeEach(() => {
    chatWelcomeMessageModel = new ChatWelcomeMessageModel('Welcome!', []);
  });

  afterEach(() => {
    chatWelcomeMessageModel.dispose();
  });

  it('should have the correct id', () => {
    expect(chatWelcomeMessageModel.id).toMatch(/^welcome_\d+$/);
  });

  it('should have the correct content', () => {
    expect(chatWelcomeMessageModel.content).toBe('Welcome!');
  });

  it('should have the correct sample questions', () => {
    expect(chatWelcomeMessageModel.sampleQuestions).toEqual([]);
  });
});
