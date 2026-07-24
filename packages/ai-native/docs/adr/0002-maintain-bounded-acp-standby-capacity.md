# Maintain bounded ACP standby capacity in the Node service

Agentic Layout declares the current ACP Standby Target from the browser, while the Node-side ACP Agent service continuously reconciles one compatible Standby ACP Process within the existing shared process-capacity limit. Keeping reconciliation beside the authoritative process pool avoids browser lifecycle and RPC ordering races; foreground Task Launch always takes priority, active Task Conversations are never evicted for warming, and an unsatisfied standby target remains best-effort rather than expanding resources beyond the configured limit.

The browser debounces target changes and owns user-facing recovery for capacity exhaustion. The Node service owns standby claiming and replenishment, superseded-target reclamation, cancellable warmup, capacity-change retries, failure backoff, deduplication, and shutdown cleanup. A Task Launch that finds every process non-reclaimable fails without queuing, preserving its Task Draft and unsent Prompt for explicit retry.

Foreground Task Launch remains cancellable while the Agent is being prepared. Cancellation preserves the Task Draft, invalidates late asynchronous results, and cleans up any Session created by the cancelled attempt so that it cannot replace the active conversation or become a Durable Agent Task.

A Task Launch commits only when ACP has accepted the first Prompt and established its request stream. Session creation before that point is temporary: failure or cancellation releases it and preserves the Draft, while errors after acceptance belong to the now-durable Agent Task. This prevents failed retries from creating orphan Sessions, duplicate Tasks, or duplicate first Prompts.

While launch is in progress, Agentic Layout freezes the submitted Draft configuration and Prompt, presents a single user-facing task-starting state, and offers cancellation as the only foreground action. It avoids exposing warmup or process-initialization phases; cancellation restores the editable Draft and input focus, while a slow launch may add non-technical explanatory text without changing the committed submission snapshot.

Project Addition alone does not change the standby target or start an ACP process. Task Draft Agent or Workspace changes are debounced and replace one target rather than accumulating warm processes; foreground submission flushes that debounce and immediately uses the latest Draft configuration.

Historical Task Selection is a foreground Session load and does not change the standby target. Overlapping selections remain latest-wins at the UI boundary, and every superseded load releases its local Session reference and attachment when it settles; this cleanup must not cancel Agent work already running. Processes retained for genuinely running historical Tasks count as real active capacity, while browsing or rapidly switching ready history must not leak pool capacity.
