import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { EditorEmptyComponentContribution } from './editor-empty-component.contribution';

@Injectable()
export class SampleModule extends BrowserModule {
  providers: Provider[] = [
    EditorEmptyComponentContribution,
  ];
}
