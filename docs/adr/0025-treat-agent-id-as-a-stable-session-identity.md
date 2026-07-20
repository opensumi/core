---
status: accepted
---

# Treat agentId as a stable Session identity

The host-managed ACP Agent Catalog treats `agentId` as a stable, non-reusable identity for an Agent's Session namespace. Agent Tasks retain that identity rather than executable arguments, environment variables, credentials, or configuration snapshots; compatible upgrades remain responsible for loading existing Sessions, while an incompatible implementation must use a new identity or provide its own migration instead of being registered under an existing `agentId`.
