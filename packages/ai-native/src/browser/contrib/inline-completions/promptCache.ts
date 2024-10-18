import { Autowired, Injectable } from '@opensumi/di';
import {
  AINativeSettingSectionsId,
  DisposableStore,
  IAICompletionOption,
  IDisposable,
  PreferenceService,
  StaleLRUMap,
} from '@opensumi/ide-core-browser';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';

import { IIntelligentCompletionsResult } from '../intelligent-completions';

/**
 * 缓存服务
 * 1. 过期时间为 1min
 * 2. 用 prompt 的 hash 值作为 key
 */
@Injectable()
export class PromptCache implements IDisposable {
  protected _disposables = new DisposableStore();

  @Autowired(IHashCalculateService)
  private hashCalculateService: IHashCalculateService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  private cacheMap = new StaleLRUMap<string, IIntelligentCompletionsResult & { relationId: string }>(15, 10, 60 * 1000);

  protected calculateCacheKey(requestBean: IAICompletionOption) {
    const content = requestBean.prompt;
    return this.hashCalculateService.calculate(content);
  }

  protected _isCacheEnabled = false;
  constructor() {
    this._isCacheEnabled = this.preferenceService.getValid(
      AINativeSettingSectionsId.IntelligentCompletionsCacheEnabled,
      true,
    );

    this._disposables.add(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.IntelligentCompletionsCacheEnabled,
        (e) => {
          this._isCacheEnabled = e.newValue;
        },
      ),
    );
  }

  getCache(requestBean: IAICompletionOption) {
    if (!this._isCacheEnabled) {
      return null;
    }
    const hash = this.calculateCacheKey(requestBean);
    if (hash) {
      return this.cacheMap.get(hash) || null;
    }
    return null;
  }

  setCache(bean: IAICompletionOption, res: any) {
    if (!this._isCacheEnabled) {
      return false;
    }
    if (!res) {
      return false;
    }

    const hash = this.calculateCacheKey(bean);
    if (hash) {
      this.cacheMap.set(hash, res);
      return true;
    }
    return false;
  }

  dispose(): void {
    this._disposables.dispose();
  }
}
