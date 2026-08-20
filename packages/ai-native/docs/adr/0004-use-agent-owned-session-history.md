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
- Selection calls the originating Agent's `session/load`, buffers all load-time updates, and replaces the active conversation only after the load succeeds. Live attachment is a separate step and cannot remove a restored transcript when it fails.
- The local Registry remains authoritative only for the Workspace Catalog. Existing Task, archive, unread, attention, status, pending-activation, and remembered-active records remain stored for compatibility but are no longer read or written by Agentic Layout runtime behavior.

## Consequences

Users see only Sessions that an Agent currently reports and recover the transcript returned by that Agent. A list or load failure never falls back to local prompt-derived history. Refresh is explicit and lifecycle-triggered rather than polled. Removing a Project changes future discovery scope but does not delete Agent Sessions or legacy local records.

The current implementation assumes raw ACP `sessionId` values are globally unique across configured Agents. Protocol calls retain the raw value, while browser models continue to use the `acp:` prefix.
