import React, { useEffect, useState } from 'react';

import { BasicRecycleTree, IRecycleTreeHandle } from '@opensumi/ide-components/lib/recycle-tree';
import { BasicCompositeTreeNode } from '@opensumi/ide-components/lib/recycle-tree/basic/tree-node.define';
import { CommandService, Event, map, transformLabelWithCodicon, useInjectable } from '@opensumi/ide-core-browser';
import { IIconService } from '@opensumi/ide-theme';

import { ITestService, TestServiceToken } from '../../common';
import { DebugTestCommand, GoToTestCommand, RuntTestCommand } from '../../common/commands';
import { TestItemExpandState, TestRunProfileBitset } from '../../common/testCollection';
import { TestingExplorerInlineMenus } from '../../common/testing-view';
import { ITestTreeData, ITestTreeItem, TestTreeViewModelToken } from '../../common/tree-view.model';
import { getIconWithColor } from '../icons/icons';
import { TestTreeItem, TestTreeViewModelImpl } from '../test-tree-view.model';

import styles from './testing.module.less';

export const TestingExplorerTree: React.FC<{}> = () => {
  const testViewModel = useInjectable<TestTreeViewModelImpl>(TestTreeViewModelToken);
  const testService = useInjectable<ITestService>(TestServiceToken);
  const commandService = useInjectable<CommandService>(CommandService);
  const iconService = useInjectable<IIconService>(IIconService);

  const [treeData, setTreeData] = useState<ITestTreeData[]>([]);

  const getItemIcon = React.useCallback((item: ITestTreeItem) => getIconWithColor(item.state), []);

  const asTreeData = React.useCallback(
    (item: TestTreeItem): ITestTreeData => ({
      label: item.label,
      renderLabel: transformLabelWithCodicon(
        item.label,
        {
          verticalAlign: 'middle',
          marginRight: '4px',
          marginLeft: '4px',
        },
        iconService.fromString.bind(iconService),
      ),
      icon: '',
      get iconClassName() {
        return getItemIcon(item);
      },
      expandable: item.test.expand !== TestItemExpandState.NotExpandable,
      rawItem: item,
      sortText: item.sortText,
      get children() {
        if (item.test.expand === TestItemExpandState.Expandable || item.children) {
          const testTree = testViewModel.getTestTreeItem(item.test.item.extId);
          return Array.from(map(testTree?.children || [], asTreeData));
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
          let result: ITestTreeData[] = [];
          for (const child of root.children) {
            result.push(asTreeData(child));
          }

          result = result.sort((a, b) => (a.sortText || a.label).localeCompare(b.sortText || b.label));
          setTreeData(result);
        }
      }
    });

    return disposable.dispose;
  }, [testViewModel]);

  useEffect(() => {
    if (testViewModel.treeHandlerApi) {
      const model = testViewModel.treeHandlerApi.getModel();
      if (model.root.children?.length === 0) {
        model.root.refresh();
      }
    }
  }, [treeData]);

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
      case DebugTestCommand.id:
        testService.runTests({
          tests: rawItem.tests,
          group: TestRunProfileBitset.Debug,
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
    <div className='monaco-workbench monaco-component'>
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
};
