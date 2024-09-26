# 通信模块

基于 sumi rpc 完成多端远程调用场景，兼容 lsp 等通信方式

### 后端服务: backService

backService 即在 Web Server 暴露的能力，类似 web 应用框架中 controller 提供的请求响应逻辑

1. 注册服务

`packages/file-service/src/node/index.ts`

```ts
import { FileSystemNodeOptions, FileService } from './file-service';
import { servicePath } from '../common/index';

export class FileServiceModule extends NodeModule {
  providers = [{ token: 'FileServiceOptions', useValue: FileSystemNodeOptions.DEFAULT }];

  backServices = [
    {
      servicePath,
      token: FileService,
    },
  ];
}
```

例如在 file-service 模块中，通过定义 `backServices` 数组，传递模块提供的后端服务，`servicePath` 为前端模块引用的服务地址，以及对应服务的注入 `token`

2. 服务调用

`packages/file-tree/src/browser/index.ts`

```ts
import { servicePath as FileServicePath } from '@opensumi/ide-file-service';

@Injectable()
export class FileTreeModule extends BrowserModule {
  providers: Provider[] = [createFileTreeAPIProvider(FileTreeAPIImpl)];
  backServices = [
    {
      servicePath: FileServicePath,
    },
  ];
}
```

例如在 file-tree 模块中，首先在模块入口位置声明需要用到的 `backServices`，传入引用的服务 `servicePath`，与服务注册时的 `servicePath` 一致

`packages/file-tree/src/browser/file-tree.service.ts`

```ts
import { servicePath as FileServicePath } from '@opensumi/ide-file-service';

@Injectable()
export default class FileTreeService extends Disposable {
  @observable.shallow
  files: CloudFile[] = [];

  @Autowired()
  private fileAPI: FileTreeAPI;

  @Autowired(CommandService)
  private commandService: CommandService;

  constructor(@Inject(FileServicePath) protected readonly fileService) {
    super();

    this.getFiles();
  }
  createFile = async () => {
    const { content } = await this.fileService.resolveContent('{file_path}');
    const file = await this.fileAPI.createFile({
      name: 'name' + Date.now() + '\n' + content,
      path: 'path' + Date.now(),
    });

    // 只会执行注册在 Module 里声明的 Contribution
    this.commandService.executeCommand('file.tree.console');

    if (this.files) {
      this.files.push(file);
    } else {
      this.files = [file];
    }
  };
}
```

在 file-tree.service.ts 中通过 `servicePath` 进行注入，并直接调用在服务类上的方法

```ts
constructor(@Inject(FileServicePath) protected readonly fileService) {
    super();

    this.getFiles();
  }
```

方法调用会转换成一个远程调用进行响应，返回结果

```ts
const { content } = await this.fileService.resolveContent('{file_path}');
```

### 后端服务: remoteService

remoteService 提供了一种更简单，显式的 API 声明，我们将上面的 fileService 使用 remoteService 重写一遍：

1. 注册服务

`packages/file-service/src/node/index.ts`

```ts
import { FileSystemNodeOptions, FileService } from './file-service';

export class FileServiceModule extends NodeModule {
  providers = [{ token: 'FileServiceOptions', useValue: FileSystemNodeOptions.DEFAULT }];
  remoteServices = [FileService];
}
```

`packages/file-service/src/node/file-service.ts`

```ts
import { servicePath } from '../common/index';

export class FileService extends RemoteService {
  servicePath = servicePath;
  // write your own logic here
}
```
