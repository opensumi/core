# ACP Chat Agentic Layout Scenario Index

The former monolithic Agentic layout scenario has been split so each runtime failure has a narrow owner and a clear required profile.

- `acp-chat-agentic-startup.scenario.md`: Agentic startup, default tool surface, and safe state observability.
- `acp-chat-agentic-input-send.scenario.md`: draft input, first send, command/mention controls, and send recovery.
- `acp-chat-agentic-history.scenario.md`: New Chat, persisted history, session switching, and permission badges.
- `acp-chat-agentic-layout-interop.scenario.md`: Explorer/editor interop, resize, reload, and Agentic/Classic switching.
- `acp-chat-agentic-fallback.scenario.md`: usable chat rendering when ACP backend readiness fails.

Evidence files and historical reports may still refer to the old scenario name. New validation should use the split `.scenario.md` files above.
