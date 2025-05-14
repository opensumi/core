import { CancellationToken, Event, IDisposable, URI } from '@opensumi/ide-core-common';

export interface MarkdownOptions {
  baseUrl?: string;
  gfm?: boolean;
  breaks?: boolean;
  pedantic?: boolean;
  renderer?: any;
}

export interface IMarkdownService {
  previewMarkdownInContainer(
    content: string,
    container: HTMLElement,
    cancellationToken: CancellationToken,
    options?: MarkdownOptions,
    onUpdate?: Event<string>,
    onLinkClick?: (uri: URI) => void,
  ): Promise<IDisposable>;
}

export const IMarkdownService = Symbol('IMarkdownService');
