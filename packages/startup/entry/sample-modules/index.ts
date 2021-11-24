import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { EditorEmptyComponentContribution } from './editor-empty-component.contribution';

@Injectable()
export class SampleModule extends BrowserModule {
  providers: Provider[] = [
    EditorEmptyComponentContribution,
  ];
}
