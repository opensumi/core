import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Optional } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId, Disposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/ide-monaco';
import { IObservable, IReader, autorun, observableFromEvent } from '@opensumi/ide-monaco/lib/common/observable';

import { AINativeContextKey } from '../../../ai-core.contextkeys';
import { CodeEditsRenderType, CodeEditsResultValue } from '../index';

import { BaseCodeEditsView } from './base';
import { DefaultCodeEditsView } from './default';
import { LegacyCodeEditsView } from './legacy';

@Injectable()
export class CodeEditsPreviewer extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private readonly renderTypeObs: IObservable<CodeEditsRenderType>;
  private view: BaseCodeEditsView | undefined;

  constructor(
    @Optional() protected readonly monacoEditor: ICodeEditor,
    @Optional() protected readonly aiNativeContextKey: AINativeContextKey,
  ) {
    super();

    this.renderTypeObs = observableFromEvent(this, this.preferenceService.onPreferenceChanged, () =>
      this.preferenceService.getValid(AINativeSettingSectionsId.CodeEditsRenderType, CodeEditsRenderType.default),
    );

    this.addDispose(
      autorun((reader: IReader) => {
        const renderType = this.renderTypeObs.read(reader);
        if (this.view) {
          this.view.dispose();
          this.view = undefined;
        }

        if (renderType === CodeEditsRenderType.default) {
          this.view = new DefaultCodeEditsView(this.monacoEditor, this.injector);
        } else {
          this.view = new LegacyCodeEditsView(this.monacoEditor, this.injector);
        }
      }),
    );
  }

  public render(completionModel: CodeEditsResultValue) {
    this.view?.render(completionModel);
    this.aiNativeContextKey.multiLineEditsIsVisible.set(true);
  }

  public hide() {
    this.view?.hide();
    this.aiNativeContextKey.multiLineEditsIsVisible.set(false);
  }

  public accept() {
    this.view?.accept();
  }

  public discard() {
    this.view?.discard();
  }
}
