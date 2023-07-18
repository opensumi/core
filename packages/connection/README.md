# 通信模块(connection)

基于 jsonrpc 完成多端远程调用场景，兼容 lsp 等通信方式

### opensumi 中使用

**准备**

1. 框架中服务分为运行在浏览器环境的 前端服务(frontService) 与运行在 node 环境的 后端服务(backService)，服务在两端的实现方式是一致的
2. 目前在 `tools/dev-tool` 中的启动逻辑中完成了服务的注册和获取逻辑，在具体功能模块中无需关心具体的通信注册获取逻辑

**后端服务(backService)** 后端服务(backService) 即在 Web Server 暴露的能力，类似 web 应用框架中 controller 提供的请求响应逻辑

1. 注册服务

`packages/file-service/src/node/index.ts`

```javascript
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

```javascript
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

```javascript
import {servicePath as FileServicePath} from '@opensumi/ide-file-service';

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
    const {content} = await this.fileService.resolveContent('{file_path}');
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
  }
}
```

在 file-tree.service.ts 中通过 `servicePath` 进行注入，并直接调用在服务类上的方法

```javascript
constructor(@Inject(FileServicePath) protected readonly fileService) {
    super();

    this.getFiles();
  }
```

方法调用会转换成一个远程调用进行响应，返回结果

```javascript
const { content } = await this.fileService.resolveContent('{file_path}');
```

**前端服务(frontService)** 后端服务(backService) 即在 Browser 环境下运行的代码暴露的能力

1. 注册服务

`packages/file-ree/src/browser/index.ts`

```javascript
@Injectable()
export class FileTreeModule extends BrowserModule {
  providers: Provider[] = [createFileTreeAPIProvider(FileTreeAPIImpl)];
  backServices = [
    {
      servicePath: FileServicePath,
    },
  ];
  frontServices = [
    {
      servicePath: FileTreeServicePath,
      token: FileTreeService,
    },
  ];
}
```

与后端服务注册类似，例如在 file-tree 模块中声明 `frontServices` 字段，传入对应的服务地址 `servicePath` 和对应服务的注入 `token`

2. 服务使用

`packages/file-service/src/node/index.ts`

```javascript
import { servicePath as FileTreeServicePath } from '@opensumi/ide-file-tree';

@Injectable()
export class FileServiceModule extends NodeModule {
  providers = [{ token: 'FileServiceOptions', useValue: FileSystemNodeOptions.DEFAULT }];

  backServices = [
    {
      servicePath,
      token: FileService,
    },
  ];
  frontServices = [
    {
      servicePath: FileTreeServicePath,
    },
  ];
}
```

与使用后端服务一致，在模块定义中声明需要使用的前端服务 `frontServices`，传入前端服务注册时用的 `servicePath` 一致

`packages/file-service/src/node/file-service.ts`

```javascript
@Injectable()
export class FileService implements IFileService {

  constructor(
    @Inject('FileServiceOptions') protected readonly options: FileSystemNodeOptions,
    @Inject(FileTreeServicePath) protected readonly fileTreeService
  ) { }

  async resolveContent(uri: string, options?: { encoding?: string }): Promise<{ stat: FileStat, content: string }> {
    const fileTree = await this.fileTreeService
    fileTree.fileName(uri.substr(-5))

    ...
    return { stat, content };
  }
```

与使用后端服务使用方式一致，在 file-service.ts 中通过 `servicePath` 进行注入，通过调用注入服务的对应方法

```javascript
  constructor(
    @Inject('FileServiceOptions') protected readonly options: FileSystemNodeOptions,
    @Inject(FileTreeServicePath) protected readonly fileTreeService
  ) { }
```

方法调用会转换成一个远程调用进行响应，返回结果

```javascript
const fileTree = await this.fileTreeService;
fileTree.fileName(uri.substr(-5));
```

与后端服务调用区别的是，目前因前端代码后置执行，所以首先需要获取服务 `await this.fileTreeService` 后进行调用
