export class MethodTimeoutError extends Error {
  constructor(method: string) {
    super(`method ${method} timeout`);
  }
}
