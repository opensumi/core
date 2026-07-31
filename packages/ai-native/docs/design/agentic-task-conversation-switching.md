# Agentic Task Conversation Switching

## Outcome

Agentic Layout switches Task Conversations without replacing the readable conversation with a page-level loading state. The current Active Task remains visible while the latest requested Task is prepared, then the Task Row, transcript, input context, and reading position change atomically.

The complete experience is delivered in one release. The Agentic path is not enabled until atomic selection, transcript/live readiness separation, bounded view-model caching, virtualized rendering, scroll restoration, and long-history coverage are all present.

## Selection contract

- The requested Task Row represents a Pending Task Selection with a local progress indicator.
- The current Active Task and Agentic Chat View remain visible and interactive while selection is pending.
- The Task List remains usable; a later selection supersedes an earlier one.
- Selecting the Active Task is a no-op, and selecting the same Pending Task does not duplicate work.
- A failed or superseded selection never becomes active and never clears unread state.
- Transcript Ready commits the visible Task Conversation atomically.
- Live Ready is independent. Before it is reached, the transcript and draft are available, the editor remains editable, and Send is disabled with a lightweight connection status.

## Conversation presentation model

- Each Task Conversation owns a stable, data-only message view model.
- View models contain message identity and presentation descriptors, not React nodes or mounted components.
- Cold history is converted once and committed as one collection; it is never replayed through one dispatch per retained message.
- Live updates incrementally update the owning conversation's view model, including background conversations.
- The Active and Pending conversations are protected in a message-weighted LRU cache.
- The cache retains at most five recent conversations and at most 5,000 visible message entries.
- Eviction removes only derived presentation data. Canonical history and lightweight reading anchors remain available.

## Virtualized list

- The change is limited to Agentic Layout; Classic ACP Chat retains its current list.
- The community `MessageBox` remains the message presentation primitive so existing appearance and theme behavior remain unchanged.
- OpenSumi owns the virtualized list and scrolling behavior because the latest stable `react-chat-elements` release still renders its complete data source.
- Stable Message IDs are used as item keys.
- Only the visible range and bounded overscan are mounted.
- Dynamic-height Markdown, reasoning, plans, tool calls, and expanded content are remeasured without losing the reading anchor.
- A conversation stores either bottom affinity or the top visible Message ID plus viewport offset. Raw `scrollTop` is not used as the durable cross-session position.
- Background output does not move a conversation whose user was reading above the bottom.

## Verification

The deterministic ACP fixture accepts a history message-count parameter. The long-history scenario creates two sessions with 1,000 visible messages each, alternating user and assistant content and periodically including Markdown, reasoning, plan, and tool-call rows.

Pull-request CI enforces:

- no page-level `Loading chat…` replacement during Task selection;
- the previous transcript remains visible until the target is Transcript Ready;
- only the latest overlapping selection can commit;
- warm selection does not reload or replay retained history;
- message count, ordering, stable identity, and session isolation are preserved;
- mounted message rows remain bounded, with an initial ceiling of 80;
- switching away and back restores bottom affinity or the Message ID reading anchor;
- streaming, expansion, collapse, and dynamic-height changes do not steal the reading position;
- the input is editable but cannot submit before Live Ready;
- Agentic message screenshots remain visually equivalent to the current `MessageBox` presentation;
- Classic ACP Chat behavior remains unchanged.

Click-to-visible timings are recorded as diagnostic evidence. A hard percentile-based timing budget is deferred until representative CI samples are available.

## Delivery

Implementation may be organized internally into reviewable commits, but the user-visible Agentic path changes only once, after the complete contract and verification matrix pass together.
