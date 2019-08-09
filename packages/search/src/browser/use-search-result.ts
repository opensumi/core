import * as React from 'react';
import { IDocumentModelManager, IDocumentModel } from '@ali/ide-doc-model/lib/common';
import {
  ContentSearchResult,
  SEARCH_STATE,
  SendClientResult,
  ResultTotal,
  ContentSearchOptions,
} from '../common/';

function mergeSameUriResult(
  data: ContentSearchResult[],
  searchResultMap: Map<string, ContentSearchResult[]>,
  docSearchedList: string[],
  total?: ResultTotal,
) {
  const theTotal = total || { fileNum: 0, resultNum: 0};
  data.forEach((result: ContentSearchResult) => {
    const oldData: ContentSearchResult[] | undefined = searchResultMap.get(result.fileUri);
    if (docSearchedList.indexOf(result.fileUri) > -1) {
      // 通过docModel搜索过的文件不再搜索
      return;
    }
    if (oldData) {
      oldData.push(result);
      searchResultMap.set(result.fileUri, oldData);
      theTotal.resultNum ++;
    } else {
      searchResultMap.set(result.fileUri, [result]);
      theTotal.fileNum ++;
      theTotal.resultNum ++;
    }
  });

  return {
    searchResultMap,
    total: theTotal,
  };
}

/**
 * 分批次接收处理搜索结果
 */
export function useSearchResult(host) {
  const [searchResults, setSearchResults] = React.useState(null as Map<string, ContentSearchResult[]> | null);
  const [searchState, setSearchState] = React.useState(SEARCH_STATE.todo);
  const [searchError, setSearchError] = React.useState('');
  const [resultTotal, setResultTotal] = React.useState({ fileNum: 0, resultNum: 0 } as ResultTotal);
  const [forceData, forceUpdate] = React.useState();

  React.useEffect(() => {
    let tempSearchResults: Map<string, ContentSearchResult[]>;
    let docSearchedList: string[] = [];
    let tempResultTotal: ResultTotal;
    let currentSearchID: number = -1;

    const clear = () => {
      tempSearchResults = new Map();
      tempResultTotal = { fileNum: 0, resultNum: 0 };
      docSearchedList = [];
    };
    clear();
    host.onResult((newResult: SendClientResult) => {
      const { id, data, searchState, error, docModelSearchedList } = newResult;
      if (!data) {
        return;
      }

      if (id > currentSearchID) {
        // 新的搜索开始了
        currentSearchID = id;
        clear();
      }
      if (currentSearchID && currentSearchID > id) {
        // 若存在异步发送的上次搜索结果，丢弃上次搜索的结果
        return;
      }

      if (searchState) {
        setSearchState(searchState);
        if (searchState === SEARCH_STATE.done || searchState === SEARCH_STATE.error) {
          // 搜索结束清理ID
          currentSearchID = -1;
        }
      }

      if (error) {
        // 搜索出错
        setSearchError(error);
      }
      const result = mergeSameUriResult(
        data,
        tempSearchResults,
        docSearchedList,
        tempResultTotal,
      );
      tempSearchResults = result.searchResultMap;
      tempResultTotal = result.total;
      setSearchResults(tempSearchResults);
      setResultTotal(tempResultTotal);
      if (Math.ceil(Math.random() * 10) > 9) {
        // 因为上面两个方法只会在完全静止后触发是否更新
        // 所以 1/10 的概率来强制触发是否更新
        forceUpdate(new Date());
      }
      if (docModelSearchedList) {
        // 记录通 docModel 搜索过的文件，用于过滤服务端搜索的重复内容
        docSearchedList = docModelSearchedList;
      }
    });
  }, []);

  return {
    searchResults,
    setSearchResults,
    searchState,
    setSearchState,
    searchError,
    setSearchError,
    resultTotal,
    setResultTotal,
  };
}

export function searchFromDocModel(
  searchValue: string,
  searchOptions: ContentSearchOptions,
  documentModelManager: IDocumentModelManager,
): {
  result: ContentSearchResult[],
  searchedList: string[],
} {
  const result: ContentSearchResult[] = [];
  const searchedList: string[] = [];

  const docModels = documentModelManager.getAllModels();

  docModels.forEach((docModel: IDocumentModel) => {
    if (!docModel.dirty) {
      return;
    }
    searchedList.push(docModel.uri.toString());
    const textModel = docModel.toEditor();
    const findResults = textModel.findMatches(searchValue,
      true,
      !!searchOptions.useRegExp,
      !!searchOptions.matchCase,
      !!searchOptions.matchWholeWord ? ' \n' : null,
      false,
    );
    findResults.forEach((find: monaco.editor.FindMatch) => {
      result.push({
        root: '',
        fileUri: docModel.uri.toString(),
        line: find.range.startLineNumber,
        matchStart: find.range.startColumn,
        matchLength: find.range.endColumn - find.range.startColumn,
        lineText: textModel.getLineContent(find.range.startLineNumber),
      });
    });
  });

  return {
    result,
    searchedList,
  };
}
