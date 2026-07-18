---
status: superseded by ADR-0020
---

# Launch tasks only for known Workspace Targets

Agentic Layout will launch Durable Agent Tasks only for Workspace Targets that are already known and authorized. It will not clone arbitrary repositories or provision development environments; selecting a different known target performs the defined Workspace-aware Task Switch before creating or restoring its ACP session. This gives B-lite cross-project Task selection without turning it into a repository and environment provisioning product.
