---
status: accepted
---

# Model Pinned Tabs as an Editor Group Prefix

Each Editor Group will preserve its existing ordered `resources` collection and represent Pinned Tabs as a contiguous leading prefix tracked by a boundary count. Session state will persist the pinned resource URIs rather than only the count, so resources skipped during restoration cannot cause an ordinary tab to become pinned accidentally; this avoids both a broad tab-entry refactor and synchronization drift between tab order and a standalone pinned set.
