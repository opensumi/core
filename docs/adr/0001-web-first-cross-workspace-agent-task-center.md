---
status: superseded by ADR-0016
---

# Use a web-first cross-workspace Agent Task Center

OpenSumi will explore a web-first Agent Task Center for one developer managing Agent Tasks across roughly two to five projects. The first scope is a task inbox, ACP status and request rendering, workspace-independent task review, and explicit workspace handoff. Selecting a task will not implicitly load its complete workspace, and the product will not copy VS Code's separate desktop Agents Window or attempt to host several complete workspaces simultaneously. This keeps cross-project review fast in Web IDE and embedded deployments while allowing multiple ACP-compatible Agent implementations.
