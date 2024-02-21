# WSChannel

## Description

`WSChannel` 一开始是为了支持在浏览器环境下同时支持创建两个 RPCService 实例而出现的。我们在浏览器的 Browser 层需要和 Main 和 Ext 两个环境进行通信，建立两个 WebSocket 连接显然是不合适的。因此我们需要一个能够支持多路复用的 WebSocket 连接，然后 `WSChannel` 和 `WSChannelHandler` 就应运而生。

同样的，在 Electron 应用中，我们也需要和后端的 Node.js 进行通信，我们也希望在一个 net.Socket 上进行多路复用。

所以 `WSChannel` 是两个端通信的最基础的一层，需要发消息都是由 `WSChannel` 发送给对端的 `WSChannel` 来进行分发的。

## Quick Start

`WSChannel` 负责传输通信数据，它内部还是需要传入一个传输数据的通道，我们定义其为 `IConnectionShape`：

### Connection

```ts
export interface IConnectionShape<T> {
  send(data: T): void;
  onMessage: (cb: (data: T) => void) => IDisposable;
  onceClose: (cb: (code?: number, reason?: string) => void) => IDisposable;
}
```

我们内置了一些常见的通信方式，你可以在 `packages/connection/src/common/connection/drivers` 下查看它们。比如说基于 Stream 的你可以这么使用：

```ts
import { StreamConnection } from '@opensumi/ide-connection/lib/common/connection/drivers';
const connection = new StreamConnection(process.stdout, process.stdin);
```

有了 Connection 后，你就可以使用 `WSChannel.forClient(connection)` 来创建一个 WSChannel 了。

### WSChannelHandler

每个 WSChannel 实例都有一个 id 属性和 channelPath 属性，这代表了它的唯一标识和它的路径。我们可以使用 `WSChannelHandler` 来进行管理所有的 `WSChannel`。

假设我们现在有两个 Handler，分别是 `browserHandler` 和 `mainHandler`，我们需要在 'CHAT' 路径下进行通信，整条通信链路如下：

以下均为伪代码：

```text
browserHandler.openChannel('CHAT');
 -> chatChannelBrowser.open()

mainHandler.onChannelOpen('CHAT')
 -> chatChannelMain.serverReady()

browserHandler.onServerChannelReady('CHAT')
```

可以看到，需要经历一次握手，然后才能进行通信。
