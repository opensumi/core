# Create Draft-bound ACP Sessions for initial Skill catalogs

ACP v1 advertises available slash commands only through session-scoped updates after `session/new`; it has no draft-catalog request. Agentic Layout therefore creates an ordinary ACP Session for a resolved Draft only when the Agent advertises Session closing, and uses that Session's catalog for the initial Skill UI. This is a role of an existing ACP Session, not a new local entity or durable Task: the current Draft owns the Session through a latest-intent generation, closes it when discarded or superseded, and deletes its unprompted history only when the Agent advertises standard Session deletion. A superseded Session load likewise releases only its own replay and attachment, and cannot replace the active Session.

## Considered Options

- Add a pre-session catalog protocol method: ACP v1 does not define one, and an extension would reduce interoperability.
- Wait for the first Prompt: preserves the prior lifecycle but leaves the initial Skill UI empty.
- Keep a client-side catalog cache: it is not authoritative for the selected Agent and Workspace Target.
