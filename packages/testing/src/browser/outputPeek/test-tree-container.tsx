import { BasicRecycleTree } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { TestPeekMessageToken } from '../../common';
import { ITestResult, maxCountPriority, TestResultServiceToken } from '../../common/test-result';
import { TestItemExpandState, TestResultState } from '../../common/testCollection';
import { ITestTreeData } from '../../common/tree-view.model';
import { testingStatesToIcons, testStatesToIconColors } from '../icons/icons';
import { TestResultServiceImpl } from '../test.result.service';
import { TestingPeekMessageServiceImpl } from './test-peek-message.service';

export const TestTreeContainer = () => {
  const disposer: Disposable = new Disposable();
  const testResultService: TestResultServiceImpl = useInjectable(TestResultServiceToken);
  const testingPeekMessageService: TestingPeekMessageServiceImpl = useInjectable(TestPeekMessageToken);

  const [treeData, setTreeData] = useState<ITestTreeData<ITestResult>[]>([]);

  const getItemIcon = React.useCallback((item: ITestResult) => {
    const state = item.completedAt === undefined ? TestResultState.Running : maxCountPriority(item.counts);
    return `${testingStatesToIcons.get(state)} ${testStatesToIconColors[state]}` || '';
  }, []);

  const asTreeData = React.useCallback(
    (item: ITestResult): ITestTreeData<ITestResult> => ({
      label: item.name,
      get icon() {
        return getItemIcon(item);
      },
      rawItem: item,
      get children() {
        return null;
      },
    }),
    [],
  );

  const resolveTestChildren = React.useCallback((node?: ITestTreeData) => {
    if (!node) {
      return null;
    }
    if (node.children && node.children.length > 0) {
      return node.children;
    }
    return [];
  }, []);

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

    const toTreeResult = testResultService.results.map(asTreeData);
    setTreeData(toTreeResult);

    return disposer.dispose;
  }, []);

  return (
    <div className='test-output-peek-tree'>
      {treeData.length > 0 && (
        <BasicRecycleTree treeData={treeData} height={900} resolveChildren={resolveTestChildren} />
      )}
    </div>
  );
};
