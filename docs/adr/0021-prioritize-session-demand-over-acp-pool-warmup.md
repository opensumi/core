---
status: accepted
---

# Prioritize ACP session demand over pool warmup

The ACP thread-pool limit is a global process-capacity boundary shared across Workspace Targets, while pool warmup is only a best-effort latency optimization. A foreground session create or load may be blocked by ACP Threads doing real session work, but must not fail solely because background warmup occupies the remaining capacity; warmup has no reserved capacity entitlement and must yield to foreground session demand. Startup warmup prepares at most one standby ACP Thread instead of filling the pool, because the configured pool size is a capacity ceiling rather than a startup target. We retain a global limit rather than allocating a full pool per working directory because per-target pools would allow ACP process counts to grow without a stable bound.

## Consequences

When foreground demand encounters an incompatible ACP Thread whose warmup initialization is still in flight, it may wait for that initialization to settle before disposing and replacing the thread, but it must not fail with pool exhaustion solely because of warmup. The current `AcpThread` initialization lifecycle is not safely cancellable while process startup is in flight, so immediate concurrent disposal is outside this repair and would require a separate process-lifecycle design.

ACP Threads remain compatible only when their Agent process configuration matches, including the working directory. Although ACP session creation accepts a working directory, an Agent process may depend on its spawn directory, relative configuration, or process-local state; pool warmup therefore does not make an ACP process reusable across Workspace Targets.

A disconnected ACP Thread represents an unavailable process instance or transport, not necessarily a failed durable ACP session or an unavailable Agent implementation. Disconnected instances may be disposed to reclaim capacity, while an ordinary prompt or session-operation failure must not cause process reclamation when the connection remains usable. The currently unused `errored` thread status is excluded from this policy until its production meaning is defined explicitly.

When every capacity slot is owned by real session work, user interaction, or an in-flight foreground session operation, new session demand fails fast rather than terminating active sessions or entering an implicit wait queue. Awaiting sessions remain eligible for LRU switching and later reload, but genuinely active sessions are preserved. The failure must distinguish real concurrency saturation from a warmup conflict and leave the caller able to switch sessions, stop existing work, or retry later.

Pool warmup is a one-time startup optimization. After the single standby ACP Thread is claimed, the service does not continuously replenish another standby; subsequent processes are created in response to actual session demand. This avoids evolving startup warmup into a background pool regulator that gradually refills the global capacity for a working directory that may not match the next Workspace Target.

Real concurrency saturation is exposed through a stable ACP-specific error identity and an actionable, localized browser message. Internal terms such as LRU state, reservations, pending loads, and warmup membership remain diagnostic log details rather than user-facing error text; custom error properties are not relied upon because the current RPC error serializer preserves the error name and message but not arbitrary fields.
