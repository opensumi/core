import { Injector, Token } from '@opensumi/di';

export type ErrorCode =
  | 'SERVICE_UNAVAILABLE'
  | 'TOOL_NOT_LOADED'
  | 'TOOL_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'ABORTED'
  | 'RPC_TIMEOUT'
  | 'DI_ERROR'
  | 'FILE_NOT_FOUND'
  | 'FILE_EXISTS'
  | 'INVALID_INPUT'
  | 'IS_DIRECTORY'
  | 'NOT_A_DIRECTORY'
  | 'EXECUTION_ERROR';

export interface WebMcpToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
  details?: string;
}

export function tryGetService<T>(container: Injector, token: Token | symbol): T | null {
  try {
    return container.get(token) as T;
  } catch {
    return null;
  }
}

export function classifyError(err: unknown): ErrorCode {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'RPC_TIMEOUT';
    }
    if (msg.includes('permission') || msg.includes('forbidden')) {
      return 'PERMISSION_DENIED';
    }
    if (msg.includes('abort')) {
      return 'ABORTED';
    }
    if (msg.includes('not found') || msg.includes('enoent')) {
      return 'FILE_NOT_FOUND';
    }
    if (msg.includes('already exists') || msg.includes('eexist')) {
      return 'FILE_EXISTS';
    }
    if (msg.includes('di') || msg.includes('injector')) {
      return 'DI_ERROR';
    }
  }
  return 'EXECUTION_ERROR';
}

const SENSITIVE_PATTERNS = [
  /(?:token|key|secret|password|auth)["\s]*[:=]\s*["']?[^"'`\s,}]+/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /ghp_[a-zA-Z0-9]{30,}/g,
];

export function safeErrorMessage(err: unknown, maxLen = 200): string {
  let msg = err instanceof Error ? err.message : String(err);
  for (const pattern of SENSITIVE_PATTERNS) {
    msg = msg.replace(pattern, '[REDACTED]');
  }
  return msg.length > maxLen ? msg.slice(0, maxLen) + '...' : msg;
}

export function successResult(result: unknown): WebMcpToolResult {
  return { success: true, result };
}

export function errorResult(error: ErrorCode, err: unknown): WebMcpToolResult {
  return { success: false, error, details: safeErrorMessage(err) };
}

export function serviceUnavailableResult(serviceName: string): WebMcpToolResult {
  return { success: false, error: 'SERVICE_UNAVAILABLE', details: `Service ${serviceName} is not available` };
}
