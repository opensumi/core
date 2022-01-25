import { BasicRecycleTree } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';
import { Iterable } from '@opensumi/monaco-editor-core/esm/vs/base/common/iterator';
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { TestPeekMessageToken } from '../../common';
import { ITestResult, maxCountPriority, resultItemParents, TestResultServiceToken } from '../../common/test-result';
import { TestItemExpandState, TestResultItem, TestResultState } from '../../common/testCollection';
import { ITestTreeData } from '../../common/tree-view.model';
import { testingStatesToIcons, testStatesToIconColors } from '../icons/icons';
import { TestResultServiceImpl } from '../test.result.service';
import { TestingPeekMessageServiceImpl } from './test-peek-message.service';

enum ETestTreeType {
  RESULT = 'result',
  TEST = 'test',
  TASK = 'task',
  MESSAGE = 'message',
}

interface ITestBaseTree<T> extends ITestTreeData<T> {
  type: string;
  context: unknown;
  id: string;
  label: string;
  description?: string;
  ariaLabel?: string;
}

export const TestTreeContainer = () => {
  const disposer: Disposable = new Disposable();
  const testResultService: TestResultServiceImpl = useInjectable(TestResultServiceToken);
  const testingPeekMessageService: TestingPeekMessageServiceImpl = useInjectable(TestPeekMessageToken);

  const [treeData, setTreeData] = useState<ITestBaseTree<ITestResult>[]>([]);

  useEffect(() => {
    disposer.addDispose(
      testResultService.onTestChanged((e) => {
        console.log('testResultService.onTestChanged', e);
      }),
    );
    disposer.addDispose(
      testResultService.onResultsChanged((e) => {
        console.log('testResultService.onResultsChanged', e);
      }),
    );
    disposer.addDispose(testingPeekMessageService.onDidReveal((dto) => {}));

    const toTreeResult = testResultService.results.map((e) => getRootChildren(e));
    setTreeData(toTreeResult);

    return disposer.dispose;
  }, []);

  const resolveTestChildren = React.useCallback((node?: ITestBaseTree<unknown>) => {
    if (!node) {
      return null;
    }
    console.log(node);
    if (node.children && node.children.length > 0) {
      return node.children;
    }
    return [];
  }, []);

  const getItemIcon = React.useCallback((item: ITestResult) => {
    const state = item.completedAt === undefined ? TestResultState.Running : maxCountPriority(item.counts);
    return `${testingStatesToIcons.get(state)} ${testStatesToIconColors[state]}` || '';
  }, []);

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
          return testingStatesToIcons.get(test.computedState) || '';
        },
        notExpandable: false,
        description,
        rawItem: test,
      };
    });
  }, []);

  const getRootChildren = React.useCallback((item: ITestResult): ITestBaseTree<ITestResult> => ({
      type: ETestTreeType.RESULT,
      context: item.id,
      id: item.id,
      label: item.name,
      get icon() {
        return getItemIcon(item);
      },
      notExpandable: false,
      rawItem: item,
      get children() {
        return Array.from(getResultChildren(item));
      },
    }), []);

  return (
    <div className='test-output-peek-tree'>
      {treeData.length > 0 && (
        <BasicRecycleTree treeData={treeData} height={900} resolveChildren={resolveTestChildren} />
      )}
    </div>
  );
};
