# Prevent ACP Pool Warmup from Causing False Thread-Pool Saturation

Status: ready-for-agent

## Problem Statement

Developers can receive `Thread pool is full (10), no reusable LRU thread available` while creating or restoring an ACP Session even though no ten Agent Tasks are actively consuming the configured concurrency. Startup pool warmup currently treats the configured capacity ceiling as a target, starts processes for one working directory until the pool is full, and prevents foreground work for another Workspace Target from reclaiming those processes while initialization is in flight.

The error exposes internal LRU terminology, does not tell the developer what action is possible, and conflates several different conditions: background warmup, genuinely active Agent Tasks, in-flight Session operations, and dead ACP process instances. A disconnected ACP process may also continue occupying capacity even though the durable Task Conversation could be restored through another process.

## Solution

Make ACP pool warmup a best-effort, one-time startup optimization that prepares at most one standby ACP Thread. Foreground Session creation and restoration take priority over warmup: when the only available slot belongs to an incompatible warming process, the foreground operation waits for initialization to settle, safely disposes that process, and creates the process required by the requested Workspace Target.

Keep the configured pool size as a global ACP process-capacity ceiling shared across Workspace Targets. Preserve working and user-interactive Agent Tasks, preserve LRU switching for ready Task Conversations, and reclaim disconnected process instances without treating ordinary prompt or Session failures as process failures. Only genuine active-capacity saturation fails, using a stable ACP-specific error identity and an actionable localized message.

## User Stories

1. As a developer, I want the first ACP Session after IDE startup to benefit from process warmup, so that initial Task Launch latency is reduced.
2. As a developer, I want startup warmup to create only the process capacity it needs, so that opening the IDE does not start ten unnecessary Agent processes.
3. As a developer, I want the configured pool size to remain a capacity ceiling, so that ACP process counts stay predictable.
4. As a developer working across Workspace Targets, I want a warm process for one target not to block Task Launch for another target, so that cross-project Agent Tasks remain usable.
5. As a developer, I want foreground Session creation to take priority over background warmup, so that an optimization cannot prevent real work.
6. As a developer, I want an incompatible warming process to be replaced safely, so that the requested Agent starts with the correct working directory and runtime configuration.
7. As a developer, I want foreground creation to wait briefly for an in-flight warmup when necessary, so that the system avoids leaking or corrupting a process during concurrent initialization and disposal.
8. As a developer, I want a compatible foreground request to claim the warming process directly, so that initialization is not duplicated.
9. As a developer, I want concurrent foreground requests to have exclusive ownership of capacity slots, so that two Sessions cannot claim the same ACP Thread.
10. As a developer, I want different working directories to remain separate ACP process configurations, so that Agent process state, relative configuration, and filesystem context cannot leak across Workspace Targets.
11. As a developer, I want ready Task Conversations to remain eligible for LRU switching, so that I can open more durable Agent Tasks than the number of simultaneously resident processes.
12. As a developer, I want an LRU-switched Task Conversation to remain restorable, so that switching capacity does not delete my Task or conversation history.
13. As a developer, I want to switch to another Session while one process has disconnected, so that one process failure does not block unrelated work.
14. As a developer, I want a disconnected process instance to release its pool capacity, so that dead processes cannot accumulate until every new Task Launch fails.
15. As a developer, I want a disconnected Task Conversation to be reloadable through a new ACP process, so that process failure does not imply durable Session loss.
16. As a developer, I want an ordinary prompt failure to leave the ACP process available when its connection is still healthy, so that a recoverable request error does not destroy useful capacity.
17. As a developer, I want a Session load failure to be distinguished from a dead Agent process, so that recovery behavior matches the actual failure layer.
18. As a developer, I want a permission or input-waiting Agent Task to retain its process, so that background capacity management cannot discard work requiring my response.
19. As a developer, I want a working Agent Task never to be evicted to make room for another Task Launch, so that active work is preserved.
20. As a developer, I want genuine concurrency saturation to fail immediately rather than wait indefinitely in an invisible queue, so that I can decide which task to stop or revisit.
21. As a developer, I want the saturation message to explain that the concurrent task limit was reached, so that I understand the problem without knowing ACP pool internals.
22. As a developer, I want the saturation message to suggest switching to or stopping an active task and retrying, so that the failure is actionable.
23. As a developer, I want failed Session creation to clear its loading state, so that the Agentic Chat View does not remain stuck.
24. As a developer, I want failed Session creation to preserve the previously active Session or draft, so that a capacity error does not disrupt my current conversation.
25. As a developer, I want only one error notification for a failed Task Launch, so that the same RPC failure is not reported repeatedly by multiple layers.
26. As an OpenSumi maintainer, I want real saturation to have a stable ACP-specific error identity, so that browser behavior does not depend on matching an English error sentence.
27. As an OpenSumi maintainer, I want pool diagnostics to explain why each candidate was excluded, so that warmup, reservation, pending load, compatibility, and active work can be distinguished quickly.
28. As an OpenSumi maintainer, I want diagnostics to avoid Agent arguments, environment values, tokens, and MCP headers, so that troubleshooting does not expose sensitive data.
29. As an OpenSumi maintainer, I want pool reuse and capacity reclamation to be modeled separately, so that a dead process can be removed without being considered reusable.
30. As an OpenSumi maintainer, I want startup warmup to remain one-shot rather than a continuous pool regulator, so that background behavior stays bounded and understandable.
31. As an OpenSumi maintainer, I want the current global process limit to apply across Workspace Targets, so that adding projects cannot create an unbounded number of Agent processes.
32. As an OpenSumi contributor, I want deterministic regression tests for the warmup race, so that future startup optimizations cannot reintroduce false pool saturation.
33. As an OpenSumi contributor, I want existing LRU, reservation, pending-load, and lazy Session reload tests to remain authoritative, so that the repair preserves established behavior.

## Implementation Decisions

- The ACP thread-pool size remains a global process-capacity boundary shared across Workspace Targets.
- Startup warmup prepares at most one compatible ACP Thread rather than filling the configured pool size.
- Warmup is a one-time startup optimization. A consumed standby process is not continuously replenished in the background.
- Foreground Session create and load operations have priority over background warmup.
- A compatible warming process is claimed and awaited by the foreground operation instead of starting a duplicate process.
- An incompatible warming process is exclusively reserved by one foreground operation, awaited until initialization settles, then disposed and replaced with the requested runtime configuration.
- In-flight initialization is not disposed concurrently because the current process-startup lifecycle is not safely cancellable. Adding cancellable initialization is a separate architectural change.
- Agent process compatibility continues to include Agent identity, command, arguments, working directory, environment, and Node path.
- Working directory remains part of compatibility even though ACP Session creation accepts a working directory, because Agent processes may depend on their spawn directory and process-local state.
- Process reuse and capacity reclamation are separate concepts. Ready processes can be reused; disconnected processes cannot be reused but can release capacity.
- `idle` and `awaiting_prompt` processes are reusable when configuration and ownership rules allow it.
- `disconnected` process instances are reclaimable and their active node mappings are released without deleting durable Task or Session metadata.
- Ordinary prompt and Session-operation failures do not reclaim a process when the transport remains usable.
- The currently undefined production meaning of `errored` is not included in automatic reclamation.
- Working, permission/input-waiting, reserved, warming, and pending-load capacity remains protected from eviction.
- Ready Task Conversations continue to participate in existing LRU switching and lazy reload behavior.
- Allocation prefers preserving Sessions and avoiding process startup: compatible unbound capacity, compatible warmup, free capacity, dead/unbound capacity, compatible ready LRU Sessions, incompatible ready LRU Sessions, then incompatible warmup.
- Genuine saturation occurs only after every remaining slot is owned by active work, user interaction, or a foreground Session operation.
- Genuine saturation remains fail-fast. No implicit capacity queue, timeout policy, or queue cancellation model is introduced.
- A stable runtime-neutral error name identifies genuine ACP pool saturation across the existing RPC boundary.
- A custom Error subclass is not required because RPC reconstruction does not preserve prototypes; the standard Error name and message are used as the stable serialized contract.
- The browser maps the stable error identity to an actionable localized message and presents the error once at the presentation boundary.
- Internal LRU, reservation, pending-load, warmup, compatibility, and reclaimability data remains in diagnostic logs rather than user-facing messages.
- Candidate diagnostics include status, ownership flags, warmup membership, runtime compatibility, process reuse eligibility, capacity reclaimability, and explicit exclusion reasons.
- Diagnostic output excludes Agent command arguments, environment contents, authentication material, and MCP headers.
- No persisted schema change is required.
- Existing ACP Session IDs, Task Conversation durability, and browser Session prefixes remain unchanged.

## Testing Decisions

- The primary testing seam is the existing node-side ACP Agent service contract because it owns capacity, Session mappings, LRU order, reservations, warmup promises, and process disposal decisions. Tests assert observable allocation results, Session preservation, disposal, error identity, and logs rather than private helper structure.
- The browser Session creation boundary is the secondary seam because it verifies the RPC-revived error identity, localized actionable messaging, single-notification behavior, loading cleanup, and preservation of the active Session or draft.
- The existing ACP thread-pool LRU BDD scenario is the highest integration seam. It documents and validates warmup conflict recovery, genuine saturation, disconnected recovery, LRU switching, lazy Session reload, and usable UI state after failure.
- Existing thread-pool tests are prior art for deterministic mocked statuses, deferred initialization, reservations, pending loads, terminal cleanup, and Session mapping assertions.
- Existing ACP Session provider and chat internal service tests are prior art for browser creation, loading state, message presentation, and active Session preservation.
- A good warmup race test starts warmup for Workspace Target A with a size-one pool, starts foreground creation for Workspace Target B, verifies the request waits rather than rejects, completes initialization, and verifies replacement and successful Session creation.
- A good ownership test starts a second foreground request while the first owns the warming slot and verifies that the process is never double-claimed.
- A good disconnected recovery test verifies capacity release and later durable Session reload, not merely that a disposal method was called.
- A good saturation test keeps every process genuinely active, verifies no active Session is evicted, and asserts the stable error identity and actionable browser result.
- A good prompt-failure test verifies a healthy connection returns to a ready state and remains reusable.
- Tests must verify the global process count never exceeds the configured capacity throughout the warmup race.
- Focused node Jest, browser jsdom Jest, affected TypeScript references, the relevant BDD contract path, and repository diff checks form the completion gate.

## Out of Scope

- A foreground capacity wait queue for genuinely active saturation.
- Queue cancellation, queue ordering, queue persistence, or capacity-release notifications.
- Immediate cancellation or concurrent disposal of an in-flight ACP Thread initialization.
- Redesigning ACP process startup around cancellation tokens or lifecycle generations.
- Removing the working directory from Agent process compatibility.
- Sharing one ACP process across different Workspace Targets.
- Allocating an independent full pool per Workspace Target.
- Continuously maintaining a warm standby process after startup.
- Changing the user-configured pool-size setting or its default value.
- Automatically terminating working or permission/input-waiting Agent Tasks.
- Defining new production semantics for the `errored` Thread status.
- Changing ACP Session persistence, Task Retention, Task Archive, or permanent deletion behavior.
- Changing Agent-specific support for restoring a Session that no longer exists remotely.
- General refactoring of the ACP process lifecycle beyond the capacity repair.

## Further Notes

- The accepted architectural decision is recorded as ADR 0021, “Prioritize ACP session demand over pool warmup.”
- The original error is an application-level ACP capacity guard, not a Node.js worker-thread-pool error.
- The confirmed regression can be reproduced when startup warmup fills the pool for one working directory and foreground Session creation targets another working directory.
- Current candidate diagnostics can report `reusable=true` for a warming process because they only describe status eligibility; the revised diagnostics must make warmup ownership explicit.
- The repair must preserve unrelated active working-tree changes in the ACP browser Session provider.
