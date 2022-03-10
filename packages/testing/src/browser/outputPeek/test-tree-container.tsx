import React, { useEffect, useState } from 'react';

import { BasicRecycleTree } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { Disposable, localize } from '@opensumi/ide-core-common';
import { Iterable } from '@opensumi/monaco-editor-core/esm/vs/base/common/iterator';

import { TestPeekMessageToken } from '../../common';
import { ITestResult, maxCountPriority, resultItemParents, TestResultServiceToken } from '../../common/test-result';
import { ITestMessage, ITestTaskState, TestResultItem, TestResultState } from '../../common/testCollection';
import { firstLine, parseMarkdownText } from '../../common/testingStates';
import { buildTestUri, TestUriType } from '../../common/testingUri';
import { ITestTreeData } from '../../common/tree-view.model';
import styles from '../components/testing.module.less';
import { getIconWithColor } from '../icons/icons';
import { TestResultServiceImpl } from '../test.result.service';

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

export const TestTreeContainer = () => {
  const testResultService: TestResultServiceImpl = useInjectable(TestResultServiceToken);
  const testingPeekMessageService: TestingPeekMessageServiceImpl = useInjectable(TestPeekMessageToken);

  const [treeData, setTreeData] = useState<ITestBaseTree<ITestResult>[]>([]);

  useEffect(() => {
    const disposer: Disposable = new Disposable();
    disposer.addDispose(testingPeekMessageService.onDidReveal((dto) => {}));

    const toTreeResult = testResultService.results.map((e) => getRootChildren(e));
    setTreeData(toTreeResult);

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
    (result: ITestResult, test: TestResultItem, taskId: number): Iterable<ITestBaseTree<ITestMessage>> =>
      Iterable.map(test.tasks[0].messages, (m, messageIndex) => {
        const { message, location } = test.tasks[taskId].messages[messageIndex];

        const uri = buildTestUri({
          type: TestUriType.ResultMessage,
          messageIndex,
          resultId: result.id,
          taskIndex: taskId,
          testExtId: test.item.extId,
        });

        return {
          type: ETestTreeType.MESSAGE,
          context: uri,
          // ** 这里应该解析 markdown 转为纯文本信息 **
          label: firstLine(typeof message === 'string' ? message : parseMarkdownText(message.value)),
          id: uri.toString(),
          icon: '',
          notExpandable: false,
          location,
          rawItem: m,
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
    const tests = Iterable.filter(result.tests, (test) => test.tasks.some((t) => t.messages.length > 0));
    return Iterable.map(tests, (test) => {
      let description = '';
      for (const parent of resultItemParents(result, test)) {
        if (parent !== test) {
          description = description ? parent.item.label + ' › ' + description : parent.item.label;
        }
      }
      return {
        type: ETestTreeType.TEST,
        context: test.item.extId,
        id: `${result.id}/${test.item.extId}`,
        label: test.item.label,
        get icon() {
          return getIconWithColor(test.computedState);
        },
        notExpandable: false,
        description,
        rawItem: test,
        get children() {
          return Array.from(getTestChildren(result, test));
        },
      };
    });
  }, []);

  const getRootChildren = React.useCallback(
    (item: ITestResult): ITestBaseTree<ITestResult> => ({
      type: ETestTreeType.RESULT,
      context: item.id,
      id: item.id,
      label: item.name,
      icon: '',
      get iconClassName() {
        return getItemIcon(item);
      },
      rawItem: item,
      get children() {
        return Array.from(getResultChildren(item));
      },
    }),
    [],
  );

  return (
    <div className={styles.test_output_peek_tree}>
      {treeData.length > 0 && (
        <BasicRecycleTree treeData={treeData} height={500} resolveChildren={resolveTestChildren} />
      )}
    </div>
  );
};
