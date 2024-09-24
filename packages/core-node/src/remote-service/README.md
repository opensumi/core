# Rethinking Back Service

在 OpenSumi 中，`back service` 是用来处理某一个前端连接打开后的交互，在前端连接释放后，`back service` 也会被释放。

在我们过去的实践中，我们会遇到以下几个场景的问题：

1. back service 中的数据无法持久化，导致重连后数据消失
2. back service 将自己的数据储存在外部，导致内存泄露
3. back service 机制比较隐晦，比如会自动多例，自动创建 child injector
4. 由于 3 的原因，back service 会被创建为多例，导致某些模块错误使用 `@Autowired` 引用 back service 后, 每次拿到一个空状态的 back service

将自己的数据储存在外部也会有很多问题：

1. 数据的保存需要大量的 Map 来存储状态
2. 多个 back service 不小心对同样的一个外部状态进行了清空
3. 每个 back service 要写一份自己的存储逻辑

一个 back service 能被其他实例引用到就很奇怪，大家都是后端的接口层，所以应该禁止这种行为，有共同的业务逻辑需要抽出成一个通用 Service 来做。而不是用 back service，所以这里明确一下 back service 的职责，只做前端对后端的接口使用，那么我们定下第一个目标：

1. back service 不可被 `@Autowired` 引用到

这个也比较容易实现，使用 di 机制的自动注入即可实现，我们想禁止一个类被实例化，可以看下面这个最简单的例子：

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

然后我们可以实现一个基类，让所有继承这个类的 class 都需要正确的密码才能创建成功：

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

那么升级一下，使用 di 机制：

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

我们通过 `@Optional` 机制，让 childInjector 中存在 `SECRET_TOKEN` 但 injectorA 中不存在该 token，则该类可以在 childInjector 中被初始化，在其他 injector 中则不行。

我们可以更进一步，因为所有 BackService 实际上只需要实例化一遍，所以我们可以在创建之后再把 SECRET_TOKEN 重置掉。

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

可见，d3 是创建不出来的，会 throw Error。

2. 内置 back service 配套的储存层 back service data store
