import { Injectable, Autowired } from '@opensumi/di';
import { IDisposable, URI, addElement, MaybeNull, Emitter } from '@opensumi/ide-core-browser';

import { IEditor } from '../../common';
import { IBreadCrumbService, IBreadCrumbPart, IBreadCrumbProvider } from '../types';

import { DefaultBreadCrumbProvider } from './default';


@Injectable()
export class BreadCrumbServiceImpl implements IBreadCrumbService {
  private providers: IBreadCrumbProvider[] = [];

  private _onDidUpdateBreadCrumbResults = new Emitter<{ uri: URI; editor: MaybeNull<IEditor> }>();
  public readonly onDidUpdateBreadCrumbResults = this._onDidUpdateBreadCrumbResults.event;

  // editor-id / uriString
  private crumbResults: Map<MaybeNull<IEditor>, Map<string, IBreadCrumbPart[]>> = new Map();

  @Autowired()
  defaultBreadCrumbProvider: DefaultBreadCrumbProvider;

  constructor() {
    this.registerBreadCrumbProvider(this.defaultBreadCrumbProvider);
  }

  registerBreadCrumbProvider(provider: IBreadCrumbProvider): IDisposable {
    const disposer = addElement(this.providers, provider);

    provider.onDidUpdateBreadCrumb((uri: URI) => {
      this.crumbResults.forEach((crumbResults, editor) => {
        if (crumbResults.has(uri.toString())) {
          this.getBreadCrumbs(uri, editor);
        }
      });
    });

    return disposer;
  }

  getBreadCrumbs(uri: URI, editor: MaybeNull<IEditor>): IBreadCrumbPart[] | undefined {
    const editorCrumbResults = this.getEditorCrumbResults(editor);
    for (const provider of this.providers) {
      if (provider.handlesUri(uri)) {
        const lastCrumb = editorCrumbResults.get(uri.toString());
        const newCrumb = provider.provideBreadCrumbForUri(uri, editor);
        if (!isBreadCrumbArrayEqual(lastCrumb, newCrumb)) {
          editorCrumbResults.set(uri.toString(), newCrumb);
          this._onDidUpdateBreadCrumbResults.fire({ editor, uri });
        }
        break;
      }
    }
    return editorCrumbResults.get(uri.toString());
  }

  getEditorCrumbResults(editor: MaybeNull<IEditor>): Map<string, IBreadCrumbPart[]> {
    if (!this.crumbResults.has(editor)) {
      this.crumbResults.set(editor, new Map());
      if (editor) {
        // todo IEditor 应该也暴露 onDispose
        editor.monacoEditor.onDidDispose(() => {
          this.crumbResults.delete(editor);
        });
      }
    }
    return this.crumbResults.get(editor)!;
  }

  disposeCrumb(uri: URI) {
    // this.crumbResults.delete(uri.toString());
  }
}

function isBreadCrumbArrayEqual(p1: IBreadCrumbPart[] | undefined, p2: IBreadCrumbPart[] | undefined): boolean {
  if (!p1 && !p2) {
    return true;
  } else if (!p1 || !p2) {
    return false;
  } else {
    if (p1.length !== p2.length) {
      return false;
    }
    for (let i = 0; i < p1.length; i++) {
      if (!isBreadCrumbEqual(p1[i], p2[i])) {
        return false;
      }
    }
    return true;
  }
}

function isBreadCrumbEqual(p1: IBreadCrumbPart, p2: IBreadCrumbPart): boolean {
  return p1.name === p2.name;
}
