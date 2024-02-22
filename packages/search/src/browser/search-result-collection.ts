import { SEARCH_STATE, SendClientResult } from '../common';

/**
 * 用于收集多个搜索结果后合并，减少更新视图频率
 */
export class SearchResultCollection {
  list: SendClientResult[] = [];

  maxLength = 5;

  pushAndGetResultList(result: SendClientResult) {
    const { id, data, searchState } = result;
    const outResultList: SendClientResult[] = [];

    if (searchState === SEARCH_STATE.error || searchState === SEARCH_STATE.done) {
      // 搜索结束或出错，把缓存搜索结果抛出
      const tempResult = this.getTempResult();
      if (tempResult) {
        outResultList.push(tempResult);
      }
      outResultList.push(result);
      return outResultList;
    }

    if (data.length < 1) {
      // 其他数据，原样抛出
      outResultList.push(result);
      return outResultList;
    }

    if (this.list.length > 0) {
      if (id === this.list[0].id) {
        // 同一个搜索的搜索结果
        this.pushTempResult(result);
      } else {
        // 不同搜索的搜索结果
        const tempResult = this.getTempResult();
        if (tempResult) {
          outResultList.push(tempResult);
        }
        this.pushTempResult(result);
      }
    } else {
      this.pushTempResult(result);
    }
    if (this.list.length >= this.maxLength) {
      outResultList.push(this.getTempResult()!);
    }

    return outResultList;
  }

  private getTempResult(): SendClientResult | undefined {
    let outResult: SendClientResult | undefined;

    if (this.list.length < 1) {
      return outResult;
    }

    this.list.forEach((result: SendClientResult, index) => {
      if (index === 0) {
        return;
      }
      this.list[0].data = this.list[0].data.concat(result.data);
    });

    outResult = this.list[0];
    this.list = [];
    return outResult;
  }

  private pushTempResult(result: SendClientResult) {
    this.list.push(result);
  }
}
