/**
 * ACP Error Codes
 * Based on JSON-RPC 2.0 standard errors + ACP-specific errors
 */

export const ACPErrorCode = {
  // JSON-RPC standard errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // ACP-specific errors
  SERVER_ERROR: -32000,
  RESOURCE_NOT_FOUND: -32002,

  // ACP application errors
  AUTHENTICATION_REQUIRED: 1000,
  SESSION_NOT_FOUND: 1001,
  FORBIDDEN: 1003,
} as const;

export type ACPErrorCode = (typeof ACPErrorCode)[keyof typeof ACPErrorCode];
