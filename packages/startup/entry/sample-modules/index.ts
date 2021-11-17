import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';

import { EditorEmptyComponentContribution } from './editor-empty-component.contribution';

@Injectable()
export class SampleModule extends BrowserModule {
  providers: Provider[] = [
    EditorEmptyComponentContribution,
  ];
}
