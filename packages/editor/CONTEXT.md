# OpenSumi Editor Tabs

This context describes the user-facing states and transitions of tabs within the OpenSumi editor area.

## Language

**Pinned Tab**: An editor tab explicitly fixed by the user within one Editor Group and restored with that group's session state. It appears in that group's Pinned Region and is protected from ordinary single-tab and bulk close actions, while remaining explicitly closeable. Pinning a Preview Tab also performs Keep Open; later unpinning does not restore Preview state. _Avoid_: Preview pin, pinned preview, keep-open tab

**Editor Group**: An independently arranged collection of editor tabs. The same resource may have different tab states in different Editor Groups. _Avoid_: Global editor, shared tab list

**Pinned Region**: The continuous leading section of an Editor Group's tab bar that contains all of that group's Pinned Tabs. _Avoid_: Global pinned list, scattered pinned tabs

**Keep Open**: The transition that turns a Preview Tab into an ordinary non-preview tab so that a later preview does not replace it. Keep Open does not create a Pinned Tab. _Avoid_: Pin Tab, fixed tab

**Preview Tab**: A provisional editor tab that may be replaced when another resource is opened in preview mode. _Avoid_: Pinned Tab, fixed tab
