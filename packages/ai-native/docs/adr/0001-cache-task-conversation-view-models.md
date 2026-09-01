# Cache Task Conversation View Models

Agentic Layout will cache a data-only message view model per Task Conversation instead of retaining every conversation's mounted React tree or pre-created React nodes. A warm Task selection can therefore replace the active view model atomically without replaying retained history, while cold conversations are transformed once and committed as one collection; the virtualized item renderer creates `MessageBox` and rich content components only for visible rows.

## Consequences

Message identities must remain stable across activation, live progress updates must update the owning conversation's cached view model, and an evicted conversation may pay the one-time reconstruction cost again.

The cache is a message-weighted LRU: the Active and Pending Task Conversations are protected, no more than five recent conversation view models are retained, and the cache also stops at 5,000 visible message entries. Eviction removes only reconstructable presentation data; canonical Task Conversation history and lightweight per-conversation reading anchors remain available.
