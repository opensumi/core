import { Event, IDisposable, URI } from '@opensumi/ide-core-common';
import { ContextKeyValue } from '@opensumi/ide-monaco';
import { Dimension } from '@opensumi/monaco-editor-core/esm/vs/base/browser/dom';
import { IValueWithChangeEvent } from '@opensumi/monaco-editor-core/esm/vs/base/common/event';
import {
  IDocumentDiffItem,
  IMultiDiffEditorModel,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/multiDiffEditor/model';

import { IResourceOpenOptions } from './editor';
import { IResource } from './resource';

export const MULTI_DIFF_SCHEME = 'multi-diff-editor';

export const IMultiDiffSourceResolverService = Symbol('IMultiDiffSourceResolverService');

export interface IMultiDiffSourceResolverService {
  registerResolver(resolver: IMultiDiffSourceResolver): IDisposable;

  resolve(uri: URI): Promise<IResolvedMultiDiffSource | undefined>;

  getResolvers(): IMultiDiffSourceResolver[];
}

export interface IMultiDiffSourceResolver {
  canHandleUri(uri: URI): boolean;

  resolveDiffSource(uri: URI): Promise<IResolvedMultiDiffSource | undefined>;
}

export interface IResolvedMultiDiffSource {
  readonly resources: IValueWithChangeEvent<readonly MultiDiffEditorItem[]>;
  readonly contextKeys?: Record<string, ContextKeyValue>;
}

export class MultiDiffEditorItem {
  constructor(
    readonly originalUri: URI | undefined,
    readonly modifiedUri: URI | undefined,
    readonly goToFileUri: URI | undefined,
    readonly contextKeys?: Record<string, ContextKeyValue>,
  ) {
    if (!originalUri && !modifiedUri) {
      throw new Error('Invalid arguments');
    }
  }

  getKey(): string {
    return JSON.stringify([this.modifiedUri?.toString(), this.originalUri?.toString()]);
  }
}

/**
 * Multi-file Diff Editor abstraction
 * Extends the concept of diff editor to handle multiple file pairs
 */
export interface IMultiDiffEditor extends IDisposable {
  /**
   * Compare multiple file pairs
   */
  compareMultiple(editor: IMultiDiffEditor, resource: IResource, options?: IResourceOpenOptions): Promise<void>;

  /**
   * Get all file pairs currently being compared
   */
  getDiffEntry(uri: URI): IDocumentDiffItem | undefined;

  /**
   * Get the currently selected/active file pair
   */
  getCurrentDiffEntry(): IDocumentDiffItem | undefined;

  /**
   * Layout the editor
   */
  layout(dimension: Dimension): void;

  /**
   * Focus the editor
   */
  focus(): void;

  /**
   * Event emitted when the multi-diff editor model changes
   */
  onMultiDiffModelChange: Event<IMultiDiffEditorModel>;

  /**
   * Collapse all files
   */
  collapseAll(): void;

  /**
   * Expand all files
   */
  expandAll(): void;
}
