import { IEditorFeatureRegistry, IEditorFeatureContribution } from './types';
import { Injectable, Autowired } from '@ali/common-di';
import { IDisposable, addElement, ILogger, Emitter, Event } from '@ali/ide-core-browser';
import { IEditor } from '../common';

@Injectable()
export class EditorFeatureRegistryImpl implements IEditorFeatureRegistry {

  private contributions: IEditorFeatureContribution[] = [];

  private _onDidRegisterFeature = new Emitter<IEditorFeatureContribution>();

  public readonly onDidRegisterFeature: Event<IEditorFeatureContribution> = this._onDidRegisterFeature.event;

  @Autowired(ILogger)
  logger: ILogger;

  registerEditorFeatureContribution(contribution: IEditorFeatureContribution): IDisposable {

    const disposer = addElement(this.contributions, contribution);
    this._onDidRegisterFeature.fire(contribution);
    return disposer;
  }

  runContributions(editor: IEditor) {
    this.contributions.forEach((contribution) => {
      this.runOneContribution(editor, contribution);
    });
  }

  runOneContribution(editor: IEditor, contribution: IEditorFeatureContribution) {
    try {
      const disposer = contribution.contribute(editor);
      editor.onDispose(() => {
        disposer.dispose();
      });
    } catch (e) {
      this.logger.error(e);
    }
  }
}
