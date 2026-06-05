import { hasAcpChatSendPayload } from '../../../src/browser/components/acp/chat-input-validation';

describe('ACP chat input validation', () => {
  it('rejects plain whitespace-only prompts', () => {
    expect(hasAcpChatSendPayload({ message: '' })).toBe(false);
    expect(hasAcpChatSendPayload({ message: '   \n\t  ' })).toBe(false);
    expect(hasAcpChatSendPayload({ message: '\u00a0\u200b' })).toBe(false);
  });

  it('rejects contenteditable blank markup', () => {
    expect(hasAcpChatSendPayload({ message: '<br>' })).toBe(false);
    expect(hasAcpChatSendPayload({ message: '<div><br></div>&nbsp;<span> </span>' })).toBe(false);
  });

  it('keeps text, context chips, commands, and attachments valid', () => {
    expect(hasAcpChatSendPayload({ message: 'hello\nworld' })).toBe(true);
    expect(hasAcpChatSendPayload({ message: '{{@file:/workspace/editor.js}}' })).toBe(true);
    expect(hasAcpChatSendPayload({ message: '<span data-context-id="/workspace/editor.js"></span>' })).toBe(true);
    expect(hasAcpChatSendPayload({ message: '   ', command: 'generate' })).toBe(true);
    expect(hasAcpChatSendPayload({ message: '   ', images: ['data:image/png;base64,a'] })).toBe(true);
  });
});
