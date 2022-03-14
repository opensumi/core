import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { OpenedEditorContribution } from './opened-editor.contribution';
import { OpenedEditorDecorationService } from './services/opened-editor-decoration.service';
import { OpenedEditorModelService } from './services/opened-editor-model.service';
import { OpenedEditorService } from './services/opened-editor-tree.service';

@Injectable()
export class OpenedEditorModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: OpenedEditorDecorationService,
      useClass: OpenedEditorDecorationService,
    },
    {
      token: OpenedEditorService,
      useClass: OpenedEditorService,
    },
    {
      token: OpenedEditorModelService,
      useClass: OpenedEditorModelService,
    },
    OpenedEditorContribution,
  ];
}
