import { NodeModule, ConstructorOf } from '@ali/ide-core-node';
import { CommonNodeModules } from '@ali/ide-startup/lib/node/common-modules';
import { ExpressFileServerModule } from '@ali/ide-express-file-server';

export const modules: ConstructorOf<NodeModule>[] = [
  ...CommonNodeModules,
  ExpressFileServerModule,
];
