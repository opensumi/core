# Refresh the ACP Slash Command Catalog through ACP updates

ACP v1 defines Agent-to-Client `available_commands_update` notifications, but no Client-to-Agent command-catalog read or version-check request. ACP Agents therefore send a complete replacement catalog after skill installation, removal, enablement, or disablement and when a Task Conversation becomes live after restoration; Browser replaces only that Task Conversation's cached catalog. Opening `/` reads this cached catalog without waiting, while an Agent update may immediately replace an open menu.

## Considered Options

- Add a Client-to-Agent catalog refresh request: ACP v1 does not define one; a custom extension would reduce portability.
- Recreate the Task Conversation: this is unnecessarily disruptive to active work.
