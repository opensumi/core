import { URI, Emitter } from '@opensumi/ide-core-common';
import { IResourceProvider, IResource } from '@opensumi/ide-editor';
import {
  IEditorDocumentModelContentProvider,
  IEditorComponentResolver,
  IEditorComponent,
} from '@opensumi/ide-editor/lib/browser';

export const doNotClose: string[] = [];

export const TestResourceProvider: IResourceProvider = {
  scheme: 'test',
  provideResource: (uri: URI) => ({
    uri,
    name: uri.path.toString(),
    icon: 'iconTest ' + uri.toString(),
    supportsRevive: true,
  }),
  shouldCloseResource: (r, _) => !doNotClose.includes(r.uri.toString()),
};

const _onDidChangeTestContent = new Emitter<URI>();

export const TestEditorDocumentProvider: IEditorDocumentModelContentProvider = {
  handlesScheme: (scheme: string) => scheme === 'test',
  isReadonly: (uri: URI) => false,
  provideEditorDocumentModelContent: async (uri: URI, encoding) => {
    if (uri.path.toString() === '/loading') {
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          resolve();
        }, 500),
      );
    }
    return uri.toString();
  },
  onDidChangeContent: _onDidChangeTestContent.event,
};

export const TestResourceResolver: IEditorComponentResolver = (resource: IResource, results) => {
  results.push({
    type: 'code',
  });
};

export const TestResourceResolver2: IEditorComponentResolver = (resource: IResource, results) => {
  if (resource.uri.authority === 'component') {
    results.push({
      componentId: 'test-v-component',
      type: 'component',
      weight: 100,
    });
    return;
  }
  if (resource.uri.authority === 'diff') {
    results.push({
      componentId: 'test-v-component',
      type: 'diff',
    });
    return;
  }
};

export const TestResourceComponent: IEditorComponent = {
  component: () => null as any,
  uid: 'test-v-component',
  scheme: 'test',
};
