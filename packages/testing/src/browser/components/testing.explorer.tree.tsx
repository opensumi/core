import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { CommandService, Event, map, useInjectable } from '@opensumi/ide-core-browser';
import { BasicRecycleTree, IRecycleTreeHandle } from '@opensumi/ide-components/lib/recycle-tree';

import { ITestTreeData, ITestTreeItem, ITestTreeViewModel, TestTreeViewModelToken } from '../../common/tree-view.model';
import { TestItemExpandState, TestRunProfileBitset } from '../../common/testCollection';
import { GoToTestCommand, RuntTestCommand } from '../../common/commands';
import { ITestService, TestServiceToken } from '../../common';
import { getIconWithColor } from '../icons/icons';
import { BasicCompositeTreeNode } from '@opensumi/ide-components/lib/recycle-tree/basic/tree-node.define';
import { TestingExplorerInlineMenus } from '../../common/testing-view';

import styles from './testing.module.less';

export const TestingExplorerTree: React.FC<{}> = observer(() => {
  const testViewModel = useInjectable<ITestTreeViewModel>(TestTreeViewModelToken);
  const testService = useInjectable<ITestService>(TestServiceToken);
  const commandService = useInjectable<CommandService>(CommandService);

  const [treeData, setTreeData] = useState<ITestTreeData[]>([]);

  const getItemIcon = React.useCallback((item: ITestTreeItem) => getIconWithColor(item.state), []);

  const asTreeData = React.useCallback(
    (item: ITestTreeItem): ITestTreeData => ({
      label: item.label,
      get icon() {
        return getItemIcon(item);
      },
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

  const inlineMenuActuator = React.useCallback((node: BasicCompositeTreeNode, action) => {
    const { rawItem } = node.raw as ITestTreeData;
    switch (action.command) {
      case RuntTestCommand.id:
        testService.runTests({
          tests: rawItem.tests,
          group: TestRunProfileBitset.Run,
        });
        break;
      case GoToTestCommand.id:
        commandService.executeCommand(GoToTestCommand.id, rawItem.test.item.extId);
        break;
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
