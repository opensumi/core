# ACP v1 Slash Command Refresh: Protocol Findings

**Question.** Can an ACP v1 Client fetch or version-check an Agent's slash-command catalog after a session is created, so the UI can refresh it when a user opens the `/` menu?

**Answer.** Not through a standard ACP v1 request. ACP v1 defines an Agent-to-Client `session/update` notification whose `sessionUpdate` is `available_commands_update`; it supports dynamic, full-list updates at any point in a session. The v1 schema and slash-command documentation define neither a Client-to-Agent command-catalog request nor a catalog revision/version field.

## What ACP v1 provides

1. After session creation, an Agent **may** send an `available_commands_update` in a `session/update` notification. Its required payload is `availableCommands`. The official docs explicitly allow another notification at any time in the session to add, remove, or change commands.
2. The notification is a complete available-command list for that session. It contains command `name`, `description`, and optional input hint; the defined payload has no `catalogVersion`, ETag, or `notModified` result.
3. The standard Client-to-Agent session methods in the v1 schema include lifecycle, mode/configuration, and prompt methods, but no command discovery or refresh method.

**Implication for dynamic installation.** An ACP-v1-conformant Agent can make a newly installed skill visible immediately by emitting another `available_commands_update` after its command catalog changes. The Browser must treat each notification as replacement state for that session, rather than an incremental patch.

## What this means for the `/`-open design

The earlier proposal of a standard `refresh/getAvailableCommands(sessionId, knownVersion)` call is **not ACP v1**. With ACP v1 alone, opening `/` can show the cached list without a network round trip, but cannot guarantee a fresh list if the Browser missed an Agent notification (for example while disconnected).

There are two valid designs:

| Design | `/`-open behavior | Freshness guarantee |
| --- | --- | --- |
| Standard ACP v1 only | Show cached commands immediately. The Agent publishes a replacement update after install/uninstall/enable/disable and after session creation. | Fresh while the session receives Agent updates; no pull-based recovery for a missed update. |
| ACP v1 extension | Show cache immediately, then call an Agent-defined request such as `_opensumi/refresh_available_commands` once per menu-open lifecycle. The response may carry a revision and either `notModified` or the replacement list. | The requested on-open validation guarantee, for Agents that advertise and implement the extension. |

The extension is ACP-compatible, but it is not a portable ACP v1 feature: custom methods **must** begin with `_`, and support should be advertised through the `_meta` field of `agentCapabilities` in the `initialize` response. A Client should fall back to the standard push-only behavior when that capability is absent. It should continue to accept ordinary `available_commands_update` notifications as the fast path.

## Capability negotiation

`initialize` happens before session creation. The Client sends its supported protocol version and client capabilities; the Agent replies with its selected version and agent capabilities. Missing capabilities must be treated as unsupported. ACP permits custom capabilities inside `agentCapabilities._meta`, which is the appropriate place to declare a proprietary pull-refresh method and its response contract.

Example (illustrative, not ACP-standard):

```json
{
  "agentCapabilities": {
    "_meta": {
      "opensumi": {
        "refreshAvailableCommands": true
      }
    }
  }
}
```

## Sources

- [ACP v1 Slash Commands — Advertising commands and Dynamic updates](https://agentclientprotocol.com/protocol/v1/slash-commands) — states that the Agent may send `available_commands_update` after creating a session and may send it again at any time.
- [ACP v1 schema — `AvailableCommandsUpdate`](https://github.com/agentclientprotocol/agent-client-protocol/releases/latest/download/schema.json) — defines required `availableCommands`; no catalog-version field. Retrieved 2026-08-11.
- [ACP v1 schema — declared methods](https://github.com/agentclientprotocol/agent-client-protocol/releases/latest/download/schema.json) — no standard command-list/refresh request. Retrieved 2026-08-11.
- [ACP v1 Initialization](https://agentclientprotocol.com/protocol/v1/initialization) — defines version/capability negotiation and omitted-capability semantics.
- [ACP v1 Extensibility](https://agentclientprotocol.com/protocol/v1/extensibility) — reserves underscore-prefixed custom methods and specifies `_meta` capability advertisement.
