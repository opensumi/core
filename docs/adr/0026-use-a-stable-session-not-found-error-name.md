---
status: accepted
---

# Use a stable Error.name for missing ACP Sessions

The Node ACP boundary maps ACP error code `-32002` (`Resource not found`) received specifically from `session/load` to a shared stable `Error.name`, and Browser code uses only that identity to enter the Unavailable Task Conversation condition. Browser code does not infer Session loss by matching human-readable error messages, and we do not introduce a broader error-code hierarchy because the existing RPC boundary reliably preserves error names while arbitrary custom fields are not part of its compatibility contract.

## Consequences

ACP Agents are expected to return `RequestError.resourceNotFound(sessionId)` when `session/load` targets a missing Session. Older Agents that report the condition only through human-readable text remain retryable generic load failures until they adopt the protocol error; OpenSumi deliberately prefers that false-negative compatibility behavior over falsely declaring a durable Task Conversation unavailable.
