# Mock ACP Agent

`mock-acp-agent.mjs` is a deterministic stdio ACP agent for BDD and Playwright hardening. It speaks the real ACP transport through `@agentclientprotocol/sdk`, so OpenSumi still uses the normal `AcpThread` process, JSON-RPC, session updates, permission routing, WebMCP injection, and debug-log path.

Run it directly for help:

```bash
node test/bdd/fixtures/acp-agent/mock-acp-agent.mjs --help
```

Use it in an ACP BDD runtime by overriding the configured ACP agent command:

```json
{
  "ai.native.agent.defaultType": "claude-agent-acp",
  "ai-native.acp.agents": {
    "claude-agent-acp": {
      "command": "node",
      "args": ["test/bdd/fixtures/acp-agent/mock-acp-agent.mjs", "--fixture=stream-rich"],
      "streaming": true,
      "description": "OpenSumi BDD mock ACP agent"
    }
  }
}
```

The fixture can also be selected with `OPENSUMI_ACP_BDD_FIXTURE`. Supported fixture modes include `stream-rich`, `long-stream`, `permission`, `send-failure`, `create-failure`, `load-failure`, `auth-required`, `config-failure`, `process-exit`, and `history`.

`stream-rich` exposes deterministic ACP `configOptions` for `bdd-mode`, `bdd-model`, `bdd-thought-level`, and `bdd-web-search`. After `session/set_config_option`, it returns the complete `configOptions` list. During `session/prompt`, it emits a `BDD_CONFIG_SNAPSHOT` and a tool-call `rawInput.configSnapshot` so tests can prove the prompt turn used the selected footer values without asserting LLM-generated content.

Keep fixture assertions deterministic: assert ACP/UI state, sentinel text prefixed with `BDD_`, fixed command/config metadata, and bounded safe-state responses. Do not add real credentials or LLM output to this agent.
