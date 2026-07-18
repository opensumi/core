# Context Map

## Contexts

- [ACP Chat](./CONTEXT.md) — defines user-facing conversation concepts shared by ACP chat modules and tests
- [Agent Task Center](./packages/ai-native/CONTEXT.md) — defines cross-workspace Agent task monitoring and review concepts
- [Editor Tabs](./packages/editor/CONTEXT.md) — defines user-facing editor tab states and transitions

## Relationships

- **Agent Task Center → ACP Chat**: An Agent Task may expose an ACP Chat session as its interaction history, but the task also owns cross-workspace lifecycle and attention metadata.
