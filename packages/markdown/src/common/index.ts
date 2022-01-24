import { CancellationToken, IDisposable, Event, URI } from '@opensumi/ide-core-common';

export interface IMarkdownService {
  previewMarkdownInContainer(
    content: string,
    container: HTMLElement,
    cancellationToken: CancellationToken,
    onUpdate?: Event<string>,
    onLinkClick?: (uri: URI) => void,
  ): Promise<IDisposable>;
}

export const IMarkdownService = Symbol('IMarkdownService');
