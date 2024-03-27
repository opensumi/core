import { Autowired, Injectable } from '@opensumi/di';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser';
import { BaseContextKey } from '@opensumi/ide-core-browser/lib/contextkey/base';
import {
  MarkerFocusContextKey,
  MarkersTreeVisibilityContextKey,
} from '@opensumi/ide-core-browser/lib/contextkey/markers';

@Injectable()
export class MarkersContextKey extends BaseContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextkeyService: IContextKeyService;

  public markersTreeVisibility: IContextKey<boolean>;
  public markerFocus: IContextKey<boolean>;

  private _contextKeyService: IContextKeyService;

  protected initScopedContext(dom: HTMLDivElement) {
    this._contextKeyService = this.globalContextkeyService.createScoped(dom);
    this.markersTreeVisibility = MarkersTreeVisibilityContextKey.bind(this._contextKeyService);
    this.markerFocus = MarkerFocusContextKey.bind(this._contextKeyService);
  }

  get service() {
    return this._contextKeyService;
  }
}
