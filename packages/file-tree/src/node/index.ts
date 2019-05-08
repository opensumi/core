import { NodeModule } from '@ali/ide-core-node';
import { FileTreeController } from './file-tree.controller';

export const fileTree: NodeModule = {
  controllers: [
    FileTreeController,
  ],
};
