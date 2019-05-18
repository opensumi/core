// TODO: 导入 FileServiceNode 进行服务端 service 注册
// TODO: 导入 FileServiceBrowser 进行客户端 service 注册

import { startServer } from '@ali/ide-dev-tool/src/server';
import { FileServiceModule } from '@ali/ide-file-service/src/node';
import { Injector } from '@ali/common-di';

const injecttor = new Injector();

startServer([injecttor.get(FileServiceModule)]);
