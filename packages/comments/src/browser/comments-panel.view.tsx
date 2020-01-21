import * as React from 'react';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
import { observer } from 'mobx-react-lite';
import { useInjectable, isUndefined } from '@ali/ide-core-browser';
import { ICommentsService, ICommentsTreeNode } from '../common';
import * as styles from './comments.module.less';
import { WorkbenchEditorService } from '@ali/ide-editor';

const scrollContainerStyle = {
  width: '100%',
  height: '100%',
};

function getRenderTree(nodes: ICommentsTreeNode[]) {
  return nodes.filter((node) => {
    if (node && node.parent) {
      if (node.parent.expanded === false || node.parent.parent?.expanded === false) {
        return false;
      }
    }
    return true;
  });
}

export const CommentsPanel = observer((props) => {
  const commentsService = useInjectable<ICommentsService>(ICommentsService);
  const workbenchEditorService = useInjectable<WorkbenchEditorService>(WorkbenchEditorService);
  // TODO: 使用 viewState.h
  const [ containerHeight, setContainerHeight ] = React.useState(300);
  const [ treeNodes, setTreeNodes ] = React.useState<ICommentsTreeNode[]>([]);

  React.useEffect(() => {
    setTreeNodes(commentsService.commentsTreeNodes);
  }, [commentsService.commentsTreeNodes]);

  const handleSelect = React.useCallback(([item]: [ ICommentsTreeNode ]) => {
    if (!isUndefined(item.expanded)) {
      const newNodes = treeNodes.map((node) => {
        if (node.id === item.id) {
          node.expanded = !node.expanded;
        }
        return node;
      });
      setTreeNodes(newNodes);
    }

    workbenchEditorService.open(item.uri!, {
      range: item.thread.range,
    });
  }, [workbenchEditorService, treeNodes]);

  return (
    <div className={styles.comment_panel}>
      <RecycleTree
        containerHeight={containerHeight}
        scrollContainerStyle={scrollContainerStyle}
        nodes={getRenderTree(treeNodes)}
        foldable={true}
        outline={false}
        onSelect={(item) => handleSelect(item)}
      />
    </div>
  );
});
