import { ServerModule } from '@ali/ide-core-node';
import { FileTreeController } from './file-tree.controller';

export const fileTree: ServerModule = {
  controllers: [
    FileTreeController,
  ],
};
