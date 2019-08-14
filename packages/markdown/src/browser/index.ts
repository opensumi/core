import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { IMarkdownService } from '../common';
import { MarkdownServiceImpl } from './markdown.service';
import { EmbeddedMarkdownEditorContribution } from './contribution';

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
