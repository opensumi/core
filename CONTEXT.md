# OpenSumi ACP Chat

This context describes the user-facing conversation concepts shared by ACP chat modules and their tests.

## Language

**Active Session**: The ACP chat session currently shown to the user and eligible to receive new turns. _Avoid_: Current chat, selected chat

**Queued Turn**: A user-authored chat turn scheduled while the Active Session is generating. It carries user content and command context, but uses the Active Session's Mode, Model, and configuration at delivery time. By default it waits for normal generation completion before it is sent. It may be edited without changing its FIFO position. It becomes invalid when the Active Session changes or is cleared. A manual stop, an agent error, or a delivery that cannot start leaves queued turns in place and pauses automatic processing until the user acts. _Avoid_: Queued message, pending prompt

**Immediate Send**: An explicit user action that cancels the active generation and sends a selected Queued Turn or the current draft as soon as cancellation completes, bypassing other queued turns. After normal completion, the remaining queue resumes its original FIFO order; if delivery cannot start, the bypassed turn returns first in line and automatic processing pauses. _Avoid_: Steer, fast track
