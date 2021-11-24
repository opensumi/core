import { NodeModule, ConstructorOf } from '@opensumi/ide-core-node';
import { CommonNodeModules } from '@opensumi/ide-startup/lib/node/common-modules';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server';

export const modules: ConstructorOf<NodeModule>[] = [
  ...CommonNodeModules,
  ExpressFileServerModule,
];
