import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { IMarkdownService } from '../common';

import { EmbeddedMarkdownEditorContribution } from './contribution';
import { MarkdownServiceImpl } from './markdown.service';
export { Markdown } from './markdown-widget';
@Injectable()
export class MarkdownModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IMarkdownService,
      useClass: MarkdownServiceImpl,
    },
    EmbeddedMarkdownEditorContribution,
  ];
}
