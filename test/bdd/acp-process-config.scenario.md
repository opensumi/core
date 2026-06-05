# Scenario: ACP Process Config - Browser Merge and Node Spawn Resolution

**Trigger:** `packages/ai-native/src/browser/acp/build-agent-process-config.ts` or `packages/ai-native/src/node/acp/acp-spawn-config.ts`

**Layer:** `node-contract` **Required profile:** `default` **Fixtures:** Browser preference fixture and node spawn config resolver fixture. **Workspace mutation:** None. **Automation status:** Automated contract spec; no runtime IDE interaction is required.

## Given

- An ACP agent registration exists with `agentId`, `command`, `args`, `env`, and `cwd`.
- User preferences may override agent `command`, `args`, `env`, and `nodePath`.
- Node process environment may include `SUMI_ACP_NODE_PATH` and `SUMI_ACP_AGENT_PATH`.

## When

### Part A - Browser Config Merge

1. Call `buildAcpAgentProcessConfig` with registration defaults only.
2. Call it with user overrides for command and args.
3. Call it with registration env and user env overrides using the same key.
4. Call it with configured MCP servers.
5. Call it with empty-string user overrides.
6. Mutate the returned env/args arrays and inspect the original registration object.

### Part B - Node Spawn Resolution

7. Call `resolveAgentSpawnConfig` without ACP environment overrides.
8. Call it with `SUMI_ACP_NODE_PATH`.
9. Call it with `SUMI_ACP_AGENT_PATH`.
10. Call it with a relative node path.
11. Call it with an agent command containing spaces.
12. Call it when `PATH` is empty or missing from the node environment.

## Then

- Registration defaults are preserved when no user override exists.
- User command and args override registration command and args.
- Empty-string user overrides are ignored unless the setting explicitly allows blank values.
- Environment variables merge by name; user env values win on duplicate names.
- Building config does not mutate registration defaults or user preference arrays.
- `cwd` always comes from the registration workspace value.
- MCP servers are carried through only when provided.
- Node resolution chooses node path in this order: `SUMI_ACP_NODE_PATH` -> user preference `nodePath` -> `process.execPath`.
- The resolved env sets `NODE` to the selected node executable directory plus `/node`.
- The resolved env prepends the selected node executable directory to `PATH`.
- `SUMI_ACP_AGENT_PATH` overrides the browser-resolved command.
- A relative node path fails fast with a clear absolute-path error.
- Commands containing spaces are passed as the executable path plus args according to existing spawn conventions; they are not shell-split implicitly.
- Missing `PATH` is handled by creating a deterministic path that includes the selected node executable directory.

## Pass / Fail Judgment

- **PASS** - browser config merge and node spawn resolution are deterministic and do not silently accept unsafe relative node paths.
- **FAIL** - env overrides are lost, command/node override precedence is wrong, or relative node paths reach process spawning.
