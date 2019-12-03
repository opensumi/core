import { IEditorFeatureRegistry, IEditorFeatureContribution } from './types';
import { Injectable, Autowired } from '@ali/common-di';
import { IDisposable, addElement, ILogger } from '@ali/ide-core-browser';
import { IEditor } from '../common';

@Injectable()
export class EditorFeatureRegistryImpl implements IEditorFeatureRegistry {

  private contributions: IEditorFeatureContribution[] = [];

  @Autowired(ILogger)
  logger: ILogger;

  registerEditorFeatureContribution(contribution: IEditorFeatureContribution): IDisposable {
    return addElement(this.contributions, contribution);
  }

  runContributions(editor: IEditor) {
    this.contributions.forEach((contribution) => {
      try {
        const disposer = contribution.contribute(editor);
        editor.onDispose(() => {
          disposer.dispose();
        });
      } catch (e) {
        this.logger.error(e);
      }
    });
  }
}
