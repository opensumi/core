# 重新思考 Back Service

在 OpenSumi 中，`back service` 用于处理前端连接打开后的交互，并在前端连接释放后被释放。

在过去的实践中，我们遇到了以下问题：

1. back service 中的数据无法持久化，导致重连后数据丢失。
2. back service 将数据存储在外部，导致内存泄漏。
3. back service 机制较为隐晦，例如它是自动多例，是创建在 child injector 中而不是全局 injector。
4. 由于第 3 点，back service 会被创建为多个实例，导致某些模块错误地使用 `@Autowired` 引用 back service，每次都会得到一个空状态的 back service。

将数据存储在外部也存在许多问题：

1. 数据保存需要大量的 Map 来存储状态。
2. 多个 back service 可能会意外地清空同一个外部状态。
3. 每个 back service 都需要编写自己的存储逻辑，比如 Terminal/Extension 等模块的储存和逻辑非常耦合

back service 被其他实例引用是很奇怪的，因为它们都是后端接口层，所以应该禁止这种行为。共有的业务逻辑应提取为通用 Service，而不是使用 back service。因此，我们的第一个目标是：

## 1. back service 不可被 `@Autowired` 引用

这可以通过使用 DI 机制的自动注入来实现，让我们一步步来看。

我们想禁止一个类被实例化，可以看下面这个最简单的例子：

```ts
class NeedPassword {
  private static readonly correctPassword: string = 'your_password_here';

  constructor(password: string) {
    if (password !== NeedPassword.correctPassword) {
      throw new Error('Invalid password');
    }
  }
}
const ins = new NeedPassword('wrong_password'); // throw Error: Invalid password
```

我们可以实现一个基类，所有继承这个类的类都需要正确的密码才能创建成功：

```ts
abstract class NeedPassword {
  protected readonly password: string = 'custom_password_here';

  constructor(password: string) {
    if (password !== this.password) {
      throw new Error('Invalid password');
    }
  }
}

class CustomPassword extends NeedPassword {}

const instance1 = new CustomPassword('custom_password_here'); // OK
const instance2 = new CustomPassword('wrong_password'); // Error: Invalid password
```

接下来，使用 DI 机制：

```ts
import 'reflect-metadata';
import { Injectable, Injector, Optional } from '@opensumi/di';

const SECRET_TOKEN = Symbol('SECRET_TOKEN');

const RealSecret = Math.random().toString(36).substring(7);

@Injectable({ multiple: true })
export class Service2 {
  flag = '{you_got_it}';

  constructor(@Optional(SECRET_TOKEN) secret: string) {
    if (secret !== RealSecret) {
      throw new Error('Invalid secret');
    }
  }
}

const injectorA = new Injector();

const child = injectorA.createChild([
  {
    token: SECRET_TOKEN,
    useValue: RealSecret,
  },
]);

const d2 = child.get(Service2);
console.log(`flag`, d2.flag); // print `flag {you_got_it}`

const d1 = injectorA.get(Service2); // Error: Invalid secret
```

通过 `@Optional` 机制，childInjector`中存在`SECRET_TOKEN`，但 `injectorA`中不存在该 token，因此该类只能在`childInjector` 中被初始化，而不能在其他 injector 中初始化。

我们可以更进一步，因为所有 BackService 实际上只需要实例化一次，所以可以在创建之后重置 `SECRET_TOKEN`。

```ts
// ...
const child = injectorA.createChild([
  {
    token: SECRET_TOKEN,
    useValue: RealSecret,
  },
]);

const d2 = child.get(Service2);
console.log(`flag`, d2.flag); // print `flag {you_got_it}`

child.overrideProviders({
  token: SECRET_TOKEN,
  useValue: 'do_not_use_autowired_to_get_back_service',
  override: true,
});

const d3 = child.get(Service2); // Error: Invalid secret
```

可以看到，d3 无法创建，会抛出错误。

### 引入 Remote Service

分析上述问题后，我们考虑用一种新的约束规则，改变原来使用 back service 的方式，使声明 back service 更加程序化和简洁。

在设计后端架构时，通常会提到架构分层，将后端服务划分为 [`controller`]()、[`service`](https://martinfowler.com/eaaCatalog/serviceLayer.html) 和 [`dao`]() 等。

原来的 back service 模糊了 controller 和 service 的概念，一个 back service 前后端都能用，所以使用起来不明不白。

因此，我们引入了一个新概念：Remote Service，它是仅面向前端的远程 Service，后端其他 Service 不可引用该 Service。你可以在这个 Service 内编写校验、逻辑和调度，但它的使用场景更像 Controller，只接受外部请求调用。

> Martin Fowler 的《企业架构模式》中的 Service Layer 定义：  
> 服务层从连接客户层的角度定义了应用程序的边界及其可用操作集。它封装了应用程序的业务逻辑，在执行操作时控制事务并协调响应。

我们可以先列出这个新的 Remote Service 的原则，以便明确什么该做，什么不该做：

1. 前后端 1 对 1 通信。
2. Remote Service 只能在通信连接后实例化，且无法再次实例化。
3. 所有的 Remote Service 命名推荐以 RemoteService 结尾。

## 2. back service 存储逻辑优化

现在我们应该称它为 remote service 存储逻辑优化。

之前 back service 的状态存取都是各个类自己存储，现在我们仍然推荐这么做。

但我们现在推出了一款非常通用的 InMemoryDataStore，如果没有特殊需求，可以使用它。它提供了 `find`/`update`/`create`/`patch` 等多种便捷的资源管理功能。

它非常适合 OpenSumi 的后端架构，你可以根据 `clientId`/`sessionId` 去存储，查询数据，断开连接后删除数据。

### 灵感来自 flask 和 feathers

在 flask 中处理每个请求时，可以用 session 或 g 来存储内容，存在 session 里的内容在会话结束后会被删除，存在 g 上的则会一直存储。因此，我们考虑如果 OpenSumi 提供一个 SessionDataStore 和 GDataStore，让用户在 RemoteService 中使用这个 DataStore，是不是可以缓解大部分问题？

同时，GDataStore 也可以在普通的后端 Service 中使用，并提供数据变更的监听。

GDataStore 会实现默认的 CRUD 接口，让你使用它就像使用一个 MongoDB 数据库一样。

来看一个实际的场景，我们有一个全局的 TerminalService，它会监听 GDataStore(TerminalClient) 的 created/removed 事件，然后做相关处理。

```ts
interface Item {
  id: string;
}

interface GDataStore<T extends Item> {
  create(item: Item): void;
  find(query: Record<string, any>): void;
  size(query: Record<string, any>): void;
  get(id: string, query?: Record<string, any>): Item;
  update(id: string, item: Partial<Item>): void;
  remove(id: string): void;
}

class TerminalClientRemoteService extends RemoteService {
  @Autowired(GDataStore, { tag: 'TerminalClientRemoteService' })
  gDataStore: GDataStore;

  init(clientId: string) {
    this.gDataStore.create({
      id: clientId,
      client: this,
    });

    this.gDataStore.on('removed', (item) => {
      switch (item.type) {
        case 'terminal': {
          this.rpcClient.close(item.sessionId);
        }
      }
    });
  }

  createTerminal(sessionId: string, terminal: Terminal) {
    this.gDataStore.create({
      id: clientId,
      sessionId,
      type: 'terminal',
      terminal,
    });
  }

  getAllTerminals() {
    return this.gDataStore.find({
      type: 'terminal',
      id: clientId,
    });
  }

  dispose() {
    this.gDataStore.remove(clientId);
  }
}

class TerminalService {
  @Autowired(GDataStore, { tag: 'TerminalClientRemoteService' })
  gDataStore: GDataStore;

  initialize() {
    this.gDataStore.on('created', () => {});
    this.gDataStore.on('updated', () => {});
    this.gDataStore.on('removed', () => {});
    this.gDataStore.on('custom-event', () => {});
  }

  closeTerminal(id: string) {
    this.gDataStore.remove(id);
  }
}
```

以上便是使用 GDataStore 之后优化的代码，代码很优雅。而优化前的代码非常混乱：

1. [TerminalService](https://github.com/opensumi/core/blob/v3.3/packages/terminal-next/src/node/terminal.service.ts#L47)
2. [TerminalServiceClient](https://github.com/opensumi/core/blob/v3.3/packages/terminal-next/src/node/terminal.service.client.ts#L88)

可以看到，原来的 TerminalService 不仅是逻辑层，还包含了数据的存储，clientId/sessionId 和具体 Terminal 的之间通过 4 个 map 来存储，其中还牵涉到隐式的长短 id 转换。
