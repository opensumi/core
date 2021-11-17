import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { IMarkdownService } from '../common';
import { MarkdownServiceImpl } from './markdown.service';
import { EmbeddedMarkdownEditorContribution } from './contribution';
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
