function getStringProperty(value: Record<string, unknown>, key: string): string | undefined {
  const property = value[key];
  return typeof property === 'string' && property.trim() ? property : undefined;
}

function getErrorRecord(error: unknown): Record<string, unknown> | undefined {
  return error && typeof error === 'object' ? (error as Record<string, unknown>) : undefined;
}

function getErrorData(error: unknown): Record<string, unknown> | undefined {
  const data = getErrorRecord(error)?.data;
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined;
}

function getAcpUserFacingErrorMessage(error: unknown): string {
  const originalMessage = getAcpErrorMessage(error);
  const errorRecord = getErrorRecord(error);
  const data = getErrorData(error);

  const modelId = data && getStringProperty(data, 'modelId');
  if (errorRecord?.code === -32602 && modelId) {
    return `The selected model "${modelId}" is unavailable. Choose another model and try again.`;
  }

  if (originalMessage.includes('OpenCode service failure')) {
    const service = data && getStringProperty(data, 'service');
    const errorName = data && getStringProperty(data, 'errorName');
    const source = service ? ` its ${service} service` : ' an internal service';
    const details = [service && `service: ${service}`, errorName && `error: ${errorName}`].filter(Boolean).join(', ');

    return `OpenCode couldn't complete the request because${source} failed. Retry the request. If it keeps failing, start a new session.${
      details ? ` (${details})` : ''
    }`;
  }

  return originalMessage;
}

function stringifyErrorObject(error: object): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(error, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  } catch {
    return String(error);
  }
}

export function getAcpErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    const message = getStringProperty(errorRecord, 'message');
    if (message) {
      return message;
    }

    const nestedError = errorRecord.error;
    if (nestedError && typeof nestedError === 'object') {
      const nestedMessage = getStringProperty(nestedError as Record<string, unknown>, 'message');
      if (nestedMessage) {
        return nestedMessage;
      }
    }

    const text = stringifyErrorObject(error);
    return text === '{}' ? String(error) : text;
  }

  return String(error);
}

export function normalizeAcpError(error: unknown): Error {
  const originalMessage = getAcpErrorMessage(error);
  const userFacingMessage = getAcpUserFacingErrorMessage(error);
  if (error instanceof Error && userFacingMessage === originalMessage) {
    return error;
  }

  const normalizedError = new Error(userFacingMessage);
  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    const code = errorRecord.code;
    const data = errorRecord.data;

    if (code !== undefined) {
      (normalizedError as Error & { code?: unknown }).code = code;
    }
    if (data !== undefined) {
      (normalizedError as Error & { data?: unknown }).data = data;
    }
    if (userFacingMessage !== originalMessage) {
      (normalizedError as Error & { originalMessage?: string }).originalMessage = originalMessage;
    }
    (normalizedError as Error & { cause?: unknown }).cause = error;
  }

  return normalizedError;
}
