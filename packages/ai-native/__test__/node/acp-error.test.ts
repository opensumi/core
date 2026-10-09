import { getAcpErrorMessage, normalizeAcpError } from '../../src/node/acp/acp-error';

describe('ACP error normalization', () => {
  it('turns an OpenCode service failure into an actionable message while preserving diagnostics', () => {
    const originalError = {
      code: -32603,
      message: 'Internal error: OpenCode service failure',
      data: { service: 'session', errorName: 'DatabaseError' },
    };

    const error = normalizeAcpError(originalError) as Error & {
      code?: number;
      data?: unknown;
      originalMessage?: string;
    };

    expect(error.message).toBe(
      "OpenCode couldn't complete the request because its session service failed. Retry the request. If it keeps failing, start a new session. (service: session, error: DatabaseError)",
    );
    expect(error.code).toBe(-32603);
    expect(error.data).toEqual(originalError.data);
    expect(error.originalMessage).toBe(originalError.message);
    expect(error.cause).toBe(originalError);
  });

  it('explains how to recover when the selected model is unavailable', () => {
    const originalError = {
      code: -32602,
      message: 'Invalid params: model not found: cfuse/GLM-5.2',
      data: { providerId: 'cfuse', modelId: 'cfuse/GLM-5.2' },
    };

    const error = normalizeAcpError(originalError);

    expect(error.message).toBe(
      'The selected model "cfuse/GLM-5.2" is unavailable. Choose another model and try again.',
    );
    expect((error as Error & { originalMessage?: string }).originalMessage).toBe(originalError.message);
  });

  it('keeps unknown Error instances unchanged', () => {
    const originalError = new Error('Agent connection lost');

    expect(normalizeAcpError(originalError)).toBe(originalError);
    expect(getAcpErrorMessage(originalError)).toBe('Agent connection lost');
  });
});
