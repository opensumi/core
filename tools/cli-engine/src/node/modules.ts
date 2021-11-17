import { NodeModule, ConstructorOf } from '@ide-framework/ide-core-node';
import { CommonNodeModules } from '@ide-framework/ide-startup/lib/node/common-modules';
import { ExpressFileServerModule } from '@ide-framework/ide-express-file-server';

export const modules: ConstructorOf<NodeModule>[] = [
  ...CommonNodeModules,
  ExpressFileServerModule,
];
