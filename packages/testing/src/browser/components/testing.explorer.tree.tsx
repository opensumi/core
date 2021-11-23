import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@opensumi/ide-core-browser';
import { Event } from '@opensumi/ide-core-common';
import { IBasicInlineMenuPosition, IBasicTreeData } from '@opensumi/ide-components/lib/recycle-tree/basic/types';
import { BasicRecycleTree } from '@opensumi/ide-components/lib/recycle-tree';
import { map } from '@opensumi/ide-core-common/lib/iterator';

import { ITestTreeItem, ITestTreeViewModel, TestTreeViewModelToken } from '../../common/tree-view.model';
import { TestItemExpandState, TestRunProfileBitset } from '../../common/testCollection';
import { RuntTestCommand } from '../../common/commands';
import { ITestService, TestServiceToken } from '../../common';

export const TestingExplorerTree: React.FC<{}> = observer(() => {
  const testViewModel = useInjectable<ITestTreeViewModel>(TestTreeViewModelToken);
  const testService = useInjectable<ITestService>(TestServiceToken);

  const [treeData, setTreeData] = useState<IBasicTreeData[]>([]);

  const getItemIcon = React.useCallback((item: ITestTreeItem) => {
    switch (item.test.expand) {
      case TestItemExpandState.Expandable:
        return 'check-close-circle-o';
      case TestItemExpandState.BusyExpanding:
        return 'spinner';
      case TestItemExpandState.Expanded:
        return 'circle-outline';
      default:
        return 'circle-outline';
    }
  }, []);

  const asTreeData = React.useCallback((item: ITestTreeItem) => {
    return {
      label: item.label,
      icon: getItemIcon(item),
      rawItem: item,
      get children() {
        if (item.test.expand === TestItemExpandState.Expandable || item.children) {
          return Array.from(map(item.children, asTreeData)) || [];
        }
        return null;
      },
    };
  }, []);

  useEffect(() => {
    const disposable = Event.debounce(testViewModel.onUpdate, () => { }, 500)(() => {
      for (const root of testViewModel.roots) {
        if (root.depth === 0 && root.children.size > 0) {
          const result: IBasicTreeData[] = [];
          for (const child of root.children) {
            result.push(asTreeData(child));
          }
          setTreeData(result);
        }
      }
    });
    return disposable.dispose;
  }, [testViewModel]);

  const resolveTestChildren = React.useCallback((node?: IBasicTreeData) => {
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
        testService.runTests(
          {
            tests: rawItem.tests,
            group: TestRunProfileBitset.Run,
          },
        );
      }
    }
  }, []);

  return (<div>
    {treeData.length > 0 && <BasicRecycleTree
      treeData={treeData}
      height={900}
      resolveChildren={resolveTestChildren}
      inlineMenus={(node) => {
        return [
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
      }}
      inlineMenuActuator={inlineMenuActuator}
    />}
  </div>);
});
