---
status: proposed
---

# One Agent Task has one ACP session

Each Agent Task in B-lite will contain exactly one Task Conversation backed by one ACP session. All follow-up messages for the same objective continue that session. A distinct objective becomes another Agent Task rather than another chat inside the original task. This reuses OpenSumi's current ACP session model and keeps task status, permissions, unread state, and review ownership unambiguous.
