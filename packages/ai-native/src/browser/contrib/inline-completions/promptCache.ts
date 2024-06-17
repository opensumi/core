import { Autowired, Injectable } from '@opensumi/di';
import {
  AINativeSettingSectionsId,
  DisposableStore,
  IAICompletionResultModel,
  PreferenceService,
  StaleLRUMap,
} from '@opensumi/ide-core-browser';
import { IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';

/**
 * 用 prompt 的 hash 值作为 key 的缓存服务，自带缓存过期时间
 */
@Injectable()
export class PromptCache {
  protected _disposables = new DisposableStore();

  @Autowired(IHashCalculateService)
  private hashCalculateService: IHashCalculateService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private cacheMap = new StaleLRUMap<string, IAICompletionResultModel>(100, 80, 2 * 60 * 1000);

  usingCache: boolean;

  constructor() {
    this.usingCache = this.preferenceService.getValid(AINativeSettingSectionsId.InlineCompletionsUsingCache, true);

    this._disposables.add(
      this.preferenceService.onSpecificPreferenceChange(
        AINativeSettingSectionsId.InlineCompletionsUsingCache,
        ({ newValue }) => {
          this.usingCache = newValue;
        },
      ),
    );
  }

  getCache(prompt: string) {
    if (!this.usingCache) {
      return null;
    }
    const hash = this.hashCalculateService.calculate(prompt);
    if (hash) {
      return this.cacheMap.get(hash) || null;
    }
    return null;
  }

  setCache(prompt: string, res: any) {
    if (!this.usingCache) {
      return false;
    }
    if (!res) {
      return false;
    }

    const hash = this.hashCalculateService.calculate(prompt);
    if (hash) {
      this.cacheMap.set(hash, res);
      return true;
    }
    return false;
  }

  dispose() {
    this._disposables.dispose();
    this.cacheMap.clear();
  }
}
