import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Event, map, useInjectable } from '@opensumi/ide-core-browser';
import { IBasicInlineMenuPosition } from '@opensumi/ide-components/lib/recycle-tree/basic/types';
import { BasicRecycleTree, IRecycleTreeHandle } from '@opensumi/ide-components/lib/recycle-tree';

import { ITestTreeData, ITestTreeItem, ITestTreeViewModel, TestTreeViewModelToken } from '../../common/tree-view.model';
import { TestItemExpandState, TestRunProfileBitset } from '../../common/testCollection';
import { RuntTestCommand } from '../../common/commands';
import { ITestService, TestServiceToken } from '../../common';
import { testingStatesToIcons } from '../icons';

import styles from './testing.module.less';

const TestingExplorerInlineMenus = [
  {
    icon: 'start',
    title: 'Run Tests',
    command: RuntTestCommand.id,
    position: IBasicInlineMenuPosition.TREE_CONTAINER,
  },
  {
    icon: 'openfile',
    title: 'Open File',
    command: 'open-file',
    position: IBasicInlineMenuPosition.TREE_CONTAINER,
  },
];

export const TestingExplorerTree: React.FC<{}> = observer(() => {
  const testViewModel = useInjectable<ITestTreeViewModel>(TestTreeViewModelToken);
  const testService = useInjectable<ITestService>(TestServiceToken);

  const [treeData, setTreeData] = useState<ITestTreeData[]>([]);

  const getItemIcon = React.useCallback((item: ITestTreeItem) => testingStatesToIcons.get(item.state) || '', []);

  const asTreeData = React.useCallback(
    (item: ITestTreeItem): ITestTreeData => ({
      label: item.label,
      icon: getItemIcon(item),
      notExpandable: item.test.expand === TestItemExpandState.NotExpandable,
      rawItem: item,
      get children() {
        if (item.test.expand === TestItemExpandState.Expandable || item.children) {
          return Array.from(map(item.children, asTreeData)) || [];
        }
        return null;
      },
    }),
    [],
  );

  useEffect(() => {
    const disposable = Event.debounce(
      testViewModel.onUpdate,
      () => {},
      500,
    )(() => {
      for (const root of testViewModel.roots) {
        if (root.depth === 0 && root.children.size > 0) {
          const result: ITestTreeData[] = [];
          for (const child of root.children) {
            result.push(asTreeData(child));
          }
          setTreeData(result);
        }
      }
    });
    return disposable.dispose;
  }, [testViewModel]);

  const resolveTestChildren = React.useCallback((node?: ITestTreeData) => {
    if (!node) {
      return null;
    }
    if (node.children && node.children.length > 0) {
      return node.children;
    }
    return [];
  }, []);

  const inlineMenuActuator = React.useCallback((node, action) => {
    const { rawItem } = node.raw;
    switch (action.command) {
      case RuntTestCommand.id: {
        testService.runTests({
          tests: rawItem.tests,
          group: TestRunProfileBitset.Run,
        });
      }
    }
  }, []);

  const handleTreeReady = (handle: IRecycleTreeHandle) => {
    testViewModel.setTreeHandlerApi(handle);
  };

  return (
    <div>
      {treeData.length > 0 && (
        <BasicRecycleTree
          treeData={treeData}
          onReady={handleTreeReady}
          itemClassname={styles.item_label}
          height={900}
          resolveChildren={resolveTestChildren}
          inlineMenus={TestingExplorerInlineMenus}
          inlineMenuActuator={inlineMenuActuator}
        />
      )}
    </div>
  );
});
