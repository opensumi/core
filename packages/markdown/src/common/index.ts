import { CancellationToken, Event, IDisposable, URI } from '@opensumi/ide-core-common';

export interface IMarkdownService {
  previewMarkdownInContainer(
    content: string,
    container: HTMLElement,
    cancellationToken: CancellationToken,
    options?: { baseUrl?: string | undefined },
    onUpdate?: Event<string>,
    onLinkClick?: (uri: URI) => void,
  ): Promise<IDisposable>;
}

export const IMarkdownService = Symbol('IMarkdownService');
