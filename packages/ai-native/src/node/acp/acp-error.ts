function getStringProperty(value: Record<string, unknown>, key: string): string | undefined {
  const property = value[key];
  return typeof property === 'string' && property.trim() ? property : undefined;
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
  if (error instanceof Error) {
    return error;
  }

  const normalizedError = new Error(getAcpErrorMessage(error));
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
    (normalizedError as Error & { cause?: unknown }).cause = error;
  }

  return normalizedError;
}
