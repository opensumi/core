import { ConstructorOf, NodeModule } from '@opensumi/ide-core-node';
import { ExpressFileServerModule } from '@opensumi/ide-express-file-server/lib/node';
import { CommonNodeModules } from '@opensumi/ide-startup/lib/node/common-modules';

export const modules: ConstructorOf<NodeModule>[] = [...CommonNodeModules, ExpressFileServerModule];
