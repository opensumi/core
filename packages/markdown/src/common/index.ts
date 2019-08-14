import { CancellationToken, IDisposable, Event } from '@ali/ide-core-common';

export interface IMarkdownService {

  previewMarkdownInContainer(content: string, container: HTMLElement, onUpdate: Event<string>, cancellationToken: CancellationToken): Promise<IDisposable>;

}

export const IMarkdownService = Symbol('IMarkdownService');
