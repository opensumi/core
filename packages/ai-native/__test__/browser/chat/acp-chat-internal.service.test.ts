import { formatAcpLoadSessionFallbackMessage } from '../../../src/browser/chat/chat.internal.service.acp';

describe('AcpChatInternalService', () => {
  describe('formatAcpLoadSessionFallbackMessage()', () => {
    it('returns a friendly fallback message for object-shaped errors', () => {
      expect(
        formatAcpLoadSessionFallbackMessage({
          code: -32603,
          data: {
            sessionId: 'a3e1d854-a698-463b-9492-10b8638f30e3',
          },
        }),
      ).toBe('Unable to open this chat history. A new session has been created.');
    });

    it('returns a friendly not-found message when the session no longer exists', () => {
      expect(formatAcpLoadSessionFallbackMessage(new Error('Session not found'))).toBe(
        'This chat history is no longer available. A new session has been created.',
      );
    });
  });
});
