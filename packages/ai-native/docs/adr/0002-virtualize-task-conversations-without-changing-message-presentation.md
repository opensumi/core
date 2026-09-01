# Virtualize Task Conversations Without Changing Message Presentation

Agentic Chat will preserve the community `MessageBox` presentation contract while replacing the community `MessageList` container with OpenSumi-owned virtualized scrolling. This keeps existing message appearance, themes, and rich content rendering stable while allowing long Task Conversations to mount only the visible message range; upgrading `react-chat-elements` alone is insufficient because its latest stable `MessageList` still renders the complete data source.

The initial migration is limited to Agentic Layout. Classic ACP Chat retains its current list behavior until Agentic visual parity, scrolling, accessibility, and long-history behavior have been proven independently.

## Consequences

The replacement must preserve the existing message CSS contract and explicitly own bottom following, upward-reading stability, dynamic-height remeasurement, per-conversation scroll restoration, accessibility, and screenshot parity. Scroll restoration records either bottom affinity or a stable Message ID plus viewport offset; raw `scrollTop` is not a durable reading position for variable-height content.

Verification will include deterministic switching between two Task Conversations with 1,000 visible messages each. The fixture will mix alternating user and assistant messages with periodic Markdown, reasoning, plan, and tool-call content so that virtualization is exercised against variable-height rows rather than uniform placeholders.

Pull-request CI will enforce deterministic structural limits rather than a fixed wall-clock threshold: the previous conversation remains visible while selection is pending, mounted message rows remain bounded, warm selection does not replay retained history, message identity and ordering remain stable, and each conversation restores its reading anchor. Click-to-visible timing will be recorded as diagnostic evidence until enough CI samples exist to define a reliable percentile-based performance budget.
