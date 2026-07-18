---
status: proposed
---

# Let ACP Agents manage shared-workspace concurrency

B-lite will preserve OpenSumi's existing ACP Thread concurrency model. Multiple Agent Tasks for the same Workspace Target may run in separate ACP Threads while using the same backing directory. ACP Agents are responsible for coordinating concurrent work. B-lite will not create an isolated worktree per task, serialize tasks by project, detect or resolve file conflicts, or independently verify exclusive change attribution in Task Artifacts. This keeps the initial implementation aligned with the current runtime and treats concurrency coordination as an Agent responsibility.
