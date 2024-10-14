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

back service 被其他实例引用是很奇怪的，因为它们都是后端接口层，所以应该禁止这种行为。共有的业务逻辑应提取为通用 Service，而不是使用 back service。

back service 以前是默认多例，比如说我打开了三个前端页面，每个前端页面是一个不同的仓库，然后后端有一个 GitBackService，前端可以通过这个 GitBackService 来拿到当前仓库的 branch 信息等，但是要先通过 api 传给 GitBackService 一些 workspaceDir 相关的内容。

但是如果你在后端的 TerminalServiceClient（多例）里引用了 GitBackService，你期望 gitBackService.currentBranch 是什么？期望的应该要是当前仓库的 branch，实际上它会创建一个新的 instance，这个 instance 里全部是空数据（因为没有前端传 workspaceDir 这一步）

而如果用了文章里提到的 SessionDataStore 的话，同一会话内共享 sessionDataStore，所以你是能取到正确的 currentBranch 的，以前这种情况，你又要手动去声明一个 GitBackendData 放到 node module 的 providers 里，将这个 GitBackendData 全局掉才行，而且全局掉你还得做很多 clientId 的隔离。

因此，我们的第一个目标是：

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

通过 `@Optional` 机制，`childInjector` 中存在 `SECRET_TOKEN`，但 `injectorA` 中不存在该 token，因此该类只能在 `childInjector` 中被初始化，而不能在其他 injector 中初始化。

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

## 2. 引入 Remote Service

分析上述问题后，我们考虑用一种新的约束规则，改变原来使用 back service 的方式，使声明 back service 更加程序化和简洁。

在设计后端架构时，通常会提到架构分层，将后端服务划分为 [`controller`](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller)、[`service`](https://martinfowler.com/eaaCatalog/serviceLayer.html) 和 [`dao`](https://en.wikipedia.org/wiki/Data_access_object) 等。

原来的 back service 模糊了 controller 和 service 的概念，一个 back service 前后端都能用，所以使用起来不明不白。

因此，我们引入了一个新概念：Remote Service，它是仅面向前端的远程 Service，后端其他 Service 不可引用该 Service。你可以在这个 Service 内编写校验、逻辑和调度，但它的使用场景更像 Controller，只接受外部请求调用。

> Martin Fowler 的《企业架构模式》中的 Service Layer 定义：  
> 服务层从连接客户层的角度定义了应用程序的边界及其可用操作集。它封装了应用程序的业务逻辑，在执行操作时控制事务并协调响应。

我们可以先列出这个新的 Remote Service 的原则，以便明确什么该做，什么不该做：

1. 前后端 1 对 1 通信。
2. Remote Service 只能在通信连接后实例化，且无法再次实例化。
3. 所有的 Remote Service 命名推荐以 RemoteService 结尾。

我们在 BasicModule 中新增一个字段 `remoteServices` 区分以前的 `backServices`：

```ts
@Injectable()
export class BasicModule {
  // ...
  backServices?: BackService[];

  remoteServices?: (Token | ConstructorOf<any>)[];
}
```

我们决定将 RemoteService 定义为装饰器:

```ts
export function RemoteService(servicePath: string, protocol?: RPCProtocol<any>) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    markInjectable(constructor);

    return class extends constructor {
      servicePath = servicePath;
      protocol = protocol;

      constructor(...args: any[]) {
        if (args.length > 1) {
          throw new Error('Cannot use RemoteService instance directly.');
        }
        if (__remoteServiceInstantiateFlagAllowed !== args[0]) {
          throw new Error('Cannot use RemoteService instance directly.');
        }

        super(...args);
      }
    };
  };
}
```

TypeScript 的装饰器是可以装饰 class 的 constructor 的，见：[Class Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html#class-decorators)

用 RemoteService 装饰的类在前端连接建立后会实例化每一个 XRemoteService。逻辑见： [core-node/src/connection.ts#L144](https://github.com/opensumi/core/blob/37906914e7c3ff325d74e0be1945f1a66def6232/packages/core-node/src/connection.ts#L144)。

原有的 `backServices` 也非常容易迁移到新的 RemoteService 上，能让你写更少的代码。

用起来就像这样：

```ts
@Injectable()
export class OpenVsxExtensionManagerModule extends NodeModule {
  remoteServices = [VSXExtensionRemoteService];
}
```

而以前则是：

```ts
@Injectable()
export class OpenVsxExtensionManagerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: VSXExtensionBackSerivceToken,
      useClass: VSXExtensionService,
    },
  ];

  backServices = [
    {
      servicePath: VSXExtensionServicePath,
      token: VSXExtensionBackSerivceToken,
    },
  ];
}
```

可以看到这种写法可以省掉一个无用的 token: VSXExtensionBackSerivceToken，这也减少了很多的复杂性。

## 3. Remote Service 存储逻辑优化

之前 back service 的状态存取都是各个类自己存储，现在我们仍然推荐这么做，但我们现在推出了一款非常通用的 InMemoryDataStore，如果没有特殊需求，可以使用它。它提供了 `find`/`update`/`create`/`remove` 等多种便捷的资源管理功能。

它非常适合 OpenSumi 的后端架构，你可以根据 `clientId`/`sessionId` 去存储，查询数据，断开连接后删除数据。

### 灵感来自 flask 和 feathers

在 flask 中处理每个请求时，可以用 session 或 g 来存储内容，存在 session 里的内容在会话结束后会被删除，存在 g 上的则会一直存储。因此，我们考虑如果 OpenSumi 提供一个 SessionDataStore 和 GDataStore，让用户在 RemoteService 中使用这个 DataStore，是不是可以缓解大部分问题？

同时，GDataStore 也可以在普通的后端 Service 中使用，并提供数据变更的监听。

GDataStore 会实现默认的 CRUD 接口，让你使用它就像使用一个 MongoDB 数据库一样。

这部分的思路来自 feathers，这是一个很有个性的后端框架，提供了非常方便的接口声明以及数据操作。

来看一个实际的场景，我们有一个全局的 TerminalService，它会监听 GDataStore(TerminalDataStore) 的 created/removed 事件，然后做相关处理。

```ts
interface Item {
  id: string;
}

export interface GDataStore<Item> {
  create(item: Item): Item;
  find(query: Record<string, any>): Item[] | undefined;
  size(query: Record<string, any>): number;
  get(id: string, query?: Record<string, any>): Item | undefined;
  update(id: string, item: Partial<Item>): void;
  remove(id: string): void;
}

class TerminalClientRemoteService extends RemoteService {
  @GDataStore(TerminalClientData)
  gDataStore: GDataStore<TerminalClientData>;

  @GDataStore(TerminalDataStore)
  gTerminalDataStore: GDataStore<TerminalDataStore>;

  init(clientId: string) {
    this.gDataStore.create({
      id: clientId,
      client: this,
    });

    this.gTerminalDataStore.on('removed', (item) => {
      switch (item.type) {
        case 'terminal': {
          this.rpcClient.close(item.id);
        }
      }
    });
  }

  createTerminal(sessionId: string, options: TerminalOptions) {
    const terminal = this.terminalService.createTerminal(options);
    this.gTerminalDataStore.create({
      id: sessionId,
      clientId,
      terminal,
    });
  }

  getAllTerminals(clientId: string) {
    return this.gTerminalDataStore.find({
      clientId,
    });
  }

  dispose() {
    this.gDataStore.remove(clientId);
  }
}

class TerminalService {
  @GDataStore(TerminalDataStore)
  gTerminalDataStore: GDataStore<TerminalDataStore>;

  initialize() {
    this.gTerminalDataStore.on('created', () => {});
    this.gTerminalDataStore.on('updated', () => {});
    this.gTerminalDataStore.on('removed', () => {});
    this.gTerminalDataStore.on('custom-event', () => {});
  }

  closeTerminal(sessionId: string) {
    this.gTerminalDataStore.remove(sessionId);
  }

  removeClient(clientId: string) {
    this.gTerminalDataStore.removeAll({
      clientId,
    });
  }
}
```

以上便是使用 GDataStore 之后优化的代码，代码很优雅。而优化前的代码非常混乱：

1. [TerminalService](https://github.com/opensumi/core/blob/v3.3/packages/terminal-next/src/node/terminal.service.ts#L47)
2. [TerminalServiceClient](https://github.com/opensumi/core/blob/v3.3/packages/terminal-next/src/node/terminal.service.client.ts#L88)

可以看到，原来的 TerminalService 不仅是逻辑层，还包含了数据的存储，clientId/sessionId 和具体 Terminal 的之间通过 4 个 map 来存储，其中还牵涉到隐式的长短 id 转换。

### 自动化创建 Data Store

我们想让用户使用装饰器模式来使用 Data Store，提供一种及其简单的使用方法，无需声明，直接装饰即可使用。

```ts
export const TerminalDataStore = 'TerminalDataStore';
export interface TerminalDataStore {
  clientId: string;
  client: ITerminalServiceClient;
}

class TerminalService {
  @GDataStore(TerminalDataStore)
  gTerminalDataStore: GDataStore<TerminalDataStore>;
}
```

由于装饰器的执行是在类实例化之前，所以我们可以在 `GDataStore` 这个装饰器中收集 token，然后将它们加入 Injector 即可：

```ts
function generateToken(type: 'global' | 'session', token: string, options?: DataStoreOptions) {
  // ...
}

export type GDataStore<T, K = number> = InMemoryDataStore<T, K>;
export function GDataStore(token: string, options?: DataStoreOptions): PropertyDecorator {
  const sym = generateToken('global', token, options);

  return Autowired(sym, {
    tag: token,
  });
}
```

用一个闭包中的变量 `dataStore` 来储存，然后在创建 Injector 的时候将所有的 token 放入 injector:

```ts
function _injectDataStores(injector: Injector) {
  dataStore.forEach(([token, opts]) => {
    injector.addProviders({
      token,
      useValue: new InMemoryDataStore(opts),
    });
  });
}
```

这样在整个 injector 中通过 token + tag 的方式就能获取到唯一一个实例了。

这里在添加 provider 的时候用了 `dropdownForTag: false`，这个标记告诉 injector 在创建 child injector 的时候不泄露这个 tag。
