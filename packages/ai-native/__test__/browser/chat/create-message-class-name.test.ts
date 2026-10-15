import { createMessageByAI, createMessageByUser } from '../../../src/browser/components/utils';

/**
 * Regression: restored ACP sessions stack message rows over each other because
 * the assistant action bar (regenerate / copy / thumbs) is absolutely
 * positioned with a negative bottom offset and relies on the
 * `chat_with_more_actions` reserve class on the message container.
 * createMessageByAI call sites pass that class inside the message OBJECT,
 * while the old implementation let the undefined second argument clobber it,
 * so the class never reached the DOM.
 */
describe('createMessageByAI/User className propagation', () => {
  it('keeps a className passed inside the message object (AI)', () => {
    const data = createMessageByAI({ id: '1', relationId: 'r1', text: 'hi', className: 'chat_with_more_actions' });
    expect(data.className).toContain('rce-ai-msg');
    expect(data.className).toContain('chat_with_more_actions');
  });

  it('keeps a className passed inside the message object (user)', () => {
    const data = createMessageByUser({ id: '2', relationId: 'r2', text: 'hi', className: 'chat_message_code' });
    expect(data.className).toContain('rce-user-msg');
    expect(data.className).toContain('chat_message_code');
  });

  it('still prefers an explicitly passed className argument (AI)', () => {
    const data = createMessageByAI({ id: '3', relationId: 'r3', text: 'hi' }, 'explicit_class');
    expect(data.className).toContain('explicit_class');
  });

  it('still prefers an explicitly passed className argument (user)', () => {
    const data = createMessageByUser({ id: '4', relationId: 'r4', text: 'hi' }, 'explicit_class');
    expect(data.className).toContain('explicit_class');
  });

  it('renders no dangling reserve class when none is given', () => {
    const data = createMessageByAI({ id: '5', relationId: 'r5', text: 'hi' });
    expect(data.className).toBe('rce-ai-msg ');
  });
});
