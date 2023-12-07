export interface ErrorLike {
  message: string;
  name: string;
  stack?: string;
  cause?: ErrorLike;
}

function serializeErrorReplacer(key: string, value: any) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: value.cause,
    };
  }
  return value;
}

export function serializeError(error: Error): string {
  return JSON.stringify(error, serializeErrorReplacer);
}

export function reviveError(error: ErrorLike): Error {
  const result = new Error(error.message);
  result.name = error.name;
  result.stack = error.stack;
  if (error.cause) {
    (result as unknown as { cause: Error }).cause = reviveError(error.cause);
  }
  return result;
}
