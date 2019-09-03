import { CancellationToken, IDisposable, Event } from '@ali/ide-core-common';

export interface IMarkdownService {

  previewMarkdownInContainer(content: string, container: HTMLElement, cancellationToken: CancellationToken, onUpdate?: Event<string>): Promise<IDisposable>;

}

export const IMarkdownService = Symbol('IMarkdownService');
