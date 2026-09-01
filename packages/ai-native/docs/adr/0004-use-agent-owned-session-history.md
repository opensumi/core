# Use Agent-owned ACP Sessions as Agentic Layout history

## Context

Agentic Layout previously used locally persisted Durable Task records to populate its history list and route restoration. Those records can survive even when an Agent no longer exposes the Session, and they do not contain the authoritative transcript needed to recover a conversation. This could leave users selecting stale rows and seeing a generic session-service failure instead of Agent-returned history.

ACP v1 defines `session/list` as the discovery surface for Sessions known to an Agent and `session/load` as the optional restoration operation. Agents send restored conversation content through `session/update` while `session/load` is in progress.

## Decision

- The originating ACP Agent is authoritative for Session existence, metadata, and conversation content.
- Agentic Layout builds one atomic Session Browser snapshot by serially querying every available Agent for every available Known Workspace Target with `session/list`.
- A failed target query discards that Agent's entire result for the refresh. The UI remains silent and diagnostics contain only bounded Agent, Project, and error-type identifiers.
- Only Agent-returned Sessions whose `cwd` matches an available authorized project are shown. Agent-provided titles and `updatedAt` values are used directly.
- A listed Session creates only a metadata model and a page-local route from `sessionId` to `{ agentId, cwd }`.
- Agentic Layout may retain a separate local archive marker keyed by `{ agentId, cwd, sessionId }`. This marker changes only whether an Agent-returned Session appears in the active or archived browser section; it never substitutes for Agent discovery or mutates the Agent-owned Session.
- The active ACP Thread records each client-submitted User Prompt as a replay-shaped `user_message_chunk`. This fills the page-reload gap when an Agent omits user-message echoes from `session/load`; matching Agent echoes are suppressed so the restored turn appears once. These retained updates live only with the Thread and do not become durable local transcript authority.
- Selection calls the originating Agent's `session/load`, combines its load-time updates with any retained client-submitted User Prompt updates from the active Thread, and replaces the active conversation only after the load succeeds. Live attachment is a separate step and cannot remove a restored transcript when it fails.
- The local Registry remains authoritative for the Workspace Catalog and Agent Session Archive Markers. Existing legacy Task, archive, unread, attention, status, pending-activation, and remembered-active records remain stored for compatibility but are no longer read or written by Agentic Layout runtime behavior.

## Consequences

Users see only Sessions that an Agent currently reports and recover the transcript returned by that Agent, plus client-submitted User Prompts still retained by an active ACP Thread. A browser reload therefore preserves the user side of a live conversation even when the Agent replays only its own output. Releasing the backing Thread also releases this non-durable Prompt retention. Locally archived Sessions remain discoverable in a separate collapsed section without being closed or deleted. A list or load failure never falls back to Durable Task or prompt-derived history. Refresh is lifecycle-triggered rather than polled. Removing a Project changes future discovery scope but does not delete Agent Sessions or legacy local records.

The current implementation assumes raw ACP `sessionId` values are globally unique across configured Agents. Protocol calls retain the raw value, while browser models continue to use the `acp:` prefix.
