import { ITree, TreeModel } from '@ali/ide-components';
import { Injectable, Optional} from '@ali/common-di';

@Injectable()
export class FileTreeModel extends TreeModel {
  constructor(@Optional() tree: ITree) {
      super(tree);
  }
}
