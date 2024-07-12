import cls from 'classnames';
import React, { FC, useEffect, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { BasicRecycleTree } from '@opensumi/ide-components';
import {
  BasicCompositeTreeNode,
  BasicTreeNode,
} from '@opensumi/ide-components/lib/recycle-tree/basic/tree-node.define';
import { ViewState, transformLabelWithCodicon, useInjectable } from '@opensumi/ide-core-browser';
import { Disposable, localize } from '@opensumi/ide-core-common';
import { IIconService } from '@opensumi/ide-theme/lib/common/theme.service';
import { Iterable } from '@opensumi/monaco-editor-core/esm/vs/base/common/iterator';

import { TestPeekMessageToken } from '../../common';
import { ITestResult, TestResultServiceToken, maxCountPriority, resultItemParents } from '../../common/test-result';
import {
  ITestMessage,
  ITestTaskState,
  TestMessageType,
  TestResultItem,
  TestResultState,
} from '../../common/testCollection';
import { firstLine, parseMarkdownText } from '../../common/testingStates';
import { TestUriType, buildTestUri } from '../../common/testingUri';
import { ITestTreeData } from '../../common/tree-view.model';
import styles from '../components/testing.module.less';
import { getIconWithColor } from '../icons/icons';
import { TestResultServiceImpl } from '../test.result.service';

import { TestDto } from './test-output-peek';
import { TestingPeekMessageServiceImpl } from './test-peek-message.service';

enum ETestTreeType {
  RESULT = 'result',
  TEST = 'test',
  TASK = 'task',
  MESSAGE = 'message',
}

interface ITestBaseTree<T> extends ITestTreeData<T> {
  type: ETestTreeType;
  context: unknown;
  id: string;
  label: string;
  description?: string;
  ariaLabel?: string;
}

export const TestTreeContainer: FC<{ viewState?: ViewState }> = ({ viewState }) => {
  const testResultService: TestResultServiceImpl = useInjectable(TestResultServiceToken);
  const testingPeekMessageService: TestingPeekMessageServiceImpl = useInjectable(TestPeekMessageToken);
  const iconService = useInjectable<IIconService>(IIconService);

  const [treeData, setTreeData] = useState<ITestBaseTree<ITestResult>[]>([]);

  useEffect(() => {
    const disposer: Disposable = new Disposable();
    disposer.addDispose(testingPeekMessageService.onDidReveal((dto) => {}));

    const toTreeResult = testResultService.results.map((e) => getRootChildren(e));
    setTreeData(toTreeResult);

    const testResultEventDisposable = testResultService.onResultsChanged((results) => {
      const toTreeResult = testResultService.results.map((e) => getRootChildren(e));
      setTreeData(toTreeResult);
    });

    disposer.addDispose(testResultEventDisposable);

    testResultService.onTestChanged((result) => {
      const toTreeResult = testResultService.results.map((e) => getRootChildren(e));
      setTreeData(toTreeResult);
    });

    return disposer.dispose.bind(disposer);
  }, []);

  const resolveTestChildren = React.useCallback((node?: ITestBaseTree<unknown>) => {
    if (!node) {
      return null;
    }
    if (node.children && node.children.length > 0) {
      return node.children;
    }
    return [];
  }, []);

  const getItemIcon = React.useCallback((item: ITestResult) => {
    const state = item.completedAt === undefined ? TestResultState.Running : maxCountPriority(item.counts);
    return getIconWithColor(state);
  }, []);

  const getTaskChildren = React.useCallback(
    (
      result: ITestResult,
      test: TestResultItem,
      taskId: number,
    ): Iterable<ITestBaseTree<ITestMessage & { dto: TestDto }>> =>
      Iterable.map(test.tasks[0].messages, (testMessage, messageIndex) => {
        const { message, location } = test.tasks[taskId].messages[messageIndex];

        const uri = buildTestUri({
          type: TestUriType.ResultMessage,
          messageIndex,
          resultId: result.id,
          taskIndex: taskId,
          testExtId: test.item.extId,
        });

        const testDto = new TestDto(result.id, test, taskId, messageIndex);

        return {
          type: ETestTreeType.MESSAGE,
          context: uri,
          // ** 这里应该解析 markdown 转为纯文本信息 **
          label: firstLine(typeof message === 'string' ? message : parseMarkdownText(message.value)),
          id: uri.toString(),
          icon: '',
          notExpandable: false,
          location,
          rawItem: { ...testMessage, dto: testDto },
        };
      }),
    [],
  );

  const getTestChildren = React.useCallback(
    (result: ITestResult, test: TestResultItem): Iterable<ITestBaseTree<ITestTaskState>> => {
      const tasks = Iterable.filter(test.tasks, (task) => task.messages.length > 0);
      return Iterable.map(tasks, (t, taskId) => {
        const task = result.tasks[taskId];
        return {
          type: ETestTreeType.TASK,
          context: String(taskId),
          label: task.name ?? localize('test.task.unnamed'),
          id: `${result.id}/${test.item.extId}/${taskId}`,
          icon: '',
          task,
          notExpandable: false,
          rawItem: t,
          get children() {
            return Array.from(getTaskChildren(result, test, taskId));
          },
        };
      });
    },
    [],
  );

  const getResultChildren = React.useCallback((result: ITestResult): Iterable<ITestBaseTree<TestResultItem>> => {
    const tests = Iterable.filter(result.tests, (test) =>
      test.tasks.some((t) => t.messages.length > 0 || t.state >= TestResultState.Running),
    );
    return Iterable.map(tests, (test) => {
      let description = '';
      for (const parent of resultItemParents(result, test)) {
        if (parent !== test) {
          description = description ? parent.item.label + ' › ' + description : parent.item.label;
        }
      }
      description = transformLabelWithCodicon(description, {}, iconService.fromString.bind(iconService));
      const renderLabel = transformLabelWithCodicon(
        test.item.label,
        {
          verticalAlign: 'middle',
          marginRight: '4px',
        },
        iconService.fromString.bind(iconService),
      );

      const tasksInCurrentTest = test.tasks.filter((task) => task.messages.length > 0);
      const moreThanOneTask = tasksInCurrentTest.length > 1;

      const children = moreThanOneTask
        ? Array.from(getTestChildren(result, test))
        : Array.from(getTaskChildren(result, test, 0));
      const expandable = children.length > 0;

      return {
        type: ETestTreeType.TEST,
        context: test.item.extId,
        id: `${result.id}/${test.item.extId}`,
        renderLabel,
        label: test.item.label,
        icon: '',
        get iconClassName() {
          return getIconWithColor(test.computedState);
        },
        notExpandable: false,
        expandable,
        description: '',
        rawItem: test,
        get children() {
          return children;
        },
      };
    });
  }, []);

  // 渲染 ITestResult，每项测试的节点
  const getRootChildren = React.useCallback((item: ITestResult): ITestBaseTree<ITestResult & { dto: TestDto }> => {
    const testDtoStub = {
      messages: [
        {
          location: undefined,
          message: {
            value: item.getOutput(),
            uris: {},
            isTrusted: true,
            supportThemeIcons: true,
          },
          type: TestMessageType.Error,
        },
      ],
      messageIndex: 0,
    } as TestDto;

    return {
      type: ETestTreeType.RESULT,
      context: item.id,
      id: item.id,
      label: item.name,
      icon: '',
      get iconClassName() {
        return getItemIcon(item);
      },
      expandable: true,
      rawItem: { ...item, dto: testDtoStub },
      get children() {
        return Array.from(getResultChildren(item));
      },
    };
  }, []);

  // 需要用到 monaco 的 codicon，因此需要使用对应的 monaco-editor class
  return (
    <div className={cls(styles.test_output_peek_tree, 'monaco-editor')}>
      <BasicRecycleTree
        treeData={treeData}
        height={viewState?.height || 500}
        resolveChildren={resolveTestChildren}
        onClick={(event, node: BasicCompositeTreeNode | BasicTreeNode) => {
          if (!node) {
            return;
          }
          // 右侧 Test 列表点击时的左侧联动
          const raw = node.raw as ITestTreeData<ITestResult>;
          const rawItem = raw.rawItem as ITestResult & { dto?: TestDto };
          if (rawItem.dto) {
            testingPeekMessageService._didReveal.fire(rawItem.dto);
          }
        }}
      />
    </div>
  );
};
