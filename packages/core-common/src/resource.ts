import { Injectable, Autowired } from '@ali/common-di';
import { TextDocumentContentChangeEvent } from 'vscode-languageserver-types';
import { URI } from './uri';
import { ContributionProvider } from './contribution-provider';
import { Event, Emitter } from './event';
import { IDisposable } from './disposable';
import { MaybePromise } from './async';
import { CancellationToken } from './cancellation';
import { ApplicationError } from './application-error';
import { Domain } from './di-helper'

export interface Resource extends IDisposable {
  readonly uri: URI;
  readContents(options?: { encoding?: string }): Promise<string>;
  saveContents?(content: string, options?: { encoding?: string }): Promise<void>;
  saveContentChanges?(changes: TextDocumentContentChangeEvent[], options?: { encoding?: string }): Promise<void>;
  readonly onDidChangeContents?: Event<void>;
}
export namespace Resource {
  export interface SaveContext {
    content: string
    changes?: TextDocumentContentChangeEvent[]
    options?: { encoding?: string }
  }
  export async function save(resource: Resource, context: SaveContext, token?: CancellationToken): Promise<void> {
    if (!resource.saveContents) {
      return;
    }
    if (await trySaveContentChanges(resource, context)) {
      return;
    }
    if (token && token.isCancellationRequested) {
      return;
    }
    await resource.saveContents(context.content, context.options);
  }
  export async function trySaveContentChanges(resource: Resource, context: SaveContext): Promise<boolean> {
    if (!context.changes || !resource.saveContentChanges || shouldSaveContent(context)) {
      return false;
    }
    try {
      await resource.saveContentChanges(context.changes, context.options);
    } catch (e) {
      console.error(e);
      return false;
    }
    return true;
  }
  export function shouldSaveContent({ content, changes }: SaveContext): boolean {
    if (!changes) {
      return true;
    }
    let contentChangesLength = 0;
    const contentLength = content.length;
    for (const change of changes) {
      contentChangesLength += JSON.stringify(change).length;
      if (contentChangesLength > contentLength) {
        return true;
      }
    }
    return contentChangesLength > contentLength;
  }
}

export namespace ResourceError {
  export const NotFound = ApplicationError.declare(-40000, (raw: ApplicationError.Literal<{ uri: URI }>) => raw);
}

export const ResourceProvider = Symbol('ResourceProvider');
export type ResourceProvider = (uri: URI) => Promise<Resource>;

export const ResourceResolverContribution = Symbol('ResourceResolverContribution');

export interface ResourceResolverContribution {
  resolve(uri: URI): MaybePromise<Resource | void>;
}

@Injectable()
export class DefaultResourceProvider {

  @Autowired(ResourceResolverContribution)
  protected readonly resolversProvider: ContributionProvider<ResourceResolverContribution>

  /**
   * 当没有对应的资源Provider时返回reject
   */
  async get(uri: URI): Promise<Resource> {
    const resolvers = this.resolversProvider.getContributions();
    for (const resolver of resolvers) {
      const resourceResolver =  await resolver.resolve(uri);
      if (resourceResolver) {
        return Promise.resolve(resourceResolver)
      }
    }
    return Promise.reject(new Error(`A resource provider for '${uri.toString()}' is not registered.`));
  }

}

export class MutableResource implements Resource {
  private contents: string;

  constructor(readonly uri: URI, contents: string, readonly dispose: () => void) {
    this.contents = contents;
  }

  async readContents(): Promise<string> {
    return this.contents;
  }

  async saveContents(contents: string): Promise<void> {
    this.contents = contents;
    this.fireDidChangeContents();
  }

  protected readonly onDidChangeContentsEmitter = new Emitter<void>();
  onDidChangeContents = this.onDidChangeContentsEmitter.event;
  protected fireDidChangeContents(): void {
    this.onDidChangeContentsEmitter.fire(undefined);
  }
}

@Domain(ResourceResolverContribution)
export class InMemoryResourceResolver implements ResourceResolverContribution {

  private resources = new Map<string, MutableResource>();

  add(uri: URI, contents: string): Resource {
    const resourceUri = uri.toString();
    if (this.resources.has(resourceUri)) {
      throw new Error(`Cannot add already existing in-memory resource '${resourceUri}'`);
    }

    const resource = new MutableResource(uri, contents, () => this.resources.delete(resourceUri));
    this.resources.set(resourceUri, resource);
    return resource;
  }

  update(uri: URI, contents: string): Resource {
    const resourceUri = uri.toString();
    const resource = this.resources.get(resourceUri);
    if (!resource) {
      throw new Error(`Cannot update non-existed in-memory resource '${resourceUri}'`);
    }
    resource.saveContents(contents);
    return resource;
  }

  resolve(uri: URI): MaybePromise<Resource | void> {
    if (!this.resources.has(uri.toString())) {
      return;
    }
    return this.resources.get(uri.toString())!;
  }
}

/**
 * Data URI related helpers.
 */
export namespace DataUri {

	export const META_DATA_LABEL = 'label';
	export const META_DATA_DESCRIPTION = 'description';
	export const META_DATA_SIZE = 'size';
	export const META_DATA_MIME = 'mime';

	export function parseMetaData(dataUri: monaco.Uri): Map<string, string> {
		const metadata = new Map<string, string>();
    const uriPath = dataUri.path;
		// Given a URI of:  data:image/png;size:2313;label:SomeLabel;description:SomeDescription;base64,77+9UE5...
		// the metadata is: size:2313;label:SomeLabel;description:SomeDescription
		const meta = uriPath.substring(uriPath.indexOf(';') + 1, uriPath.lastIndexOf(';'));
		meta.split(';').forEach(property => {
			const [key, value] = property.split(':');
			if (key && value) {
				metadata.set(key, value);
			}
		});

		// Given a URI of:  data:image/png;size:2313;label:SomeLabel;description:SomeDescription;base64,77+9UE5...
		// the mime is: image/png
		const mime = uriPath.substring(0, uriPath.indexOf(';'));
		if (mime) {
			metadata.set(META_DATA_MIME, mime);
		}

		return metadata;
	}
}