# WSChannel

## Description

`WSChannel` 一开始是为了支持在浏览器环境下同时支持创建两个 RPCService 实例而出现的。我们在浏览器的 Browser 层需要和 Main 和 Ext 两个环境进行通信，建立两个 WebSocket 连接显然是不合适的。因此我们需要一个能够支持多路复用的 WebSocket 连接，然后 `WSChannel` 和 `WSChannelServer` 就应运而生。

其实这种多路复用是非常有用的，在 Node.js 里我们也需要它，因为我们也会需要在一个 `net.Socket` 连接中同时传输多种信息。我遇到的情况就是需要同时支持 `@vscode/jsonrpc` 和 sumi-rpc，所以我把 Node.js 的通信连接各种东西也改成了 `WSChannel`。
