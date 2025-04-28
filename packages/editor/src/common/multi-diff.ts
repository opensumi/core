import { Event, IDisposable, URI } from '@opensumi/ide-core-common';
import { ContextKeyValue } from '@opensumi/ide-monaco';
import { Dimension } from '@opensumi/monaco-editor-core/esm/vs/base/browser/dom';
import { IValueWithChangeEvent } from '@opensumi/monaco-editor-core/esm/vs/base/common/event';
import { IDocumentDiffItem } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/multiDiffEditor/model';

import { IEditorDocumentModelRef, IResourceOpenOptions } from './editor';

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
  compareMultiple(): Promise<void>;

  // /**
  //  * Add a new file pair comparison to the existing view
  //  * @param entry The file pair entry to add
  //  * @param options Resource open options
  //  */
  // addComparison(entry: IDocumentDiffItem, options?: IResourceOpenOptions): void;

  // /**
  //  * Remove a file pair comparison from the view
  //  * @param originalUri URI of the original file to remove
  //  * @param modifiedUri URI of the modified file to remove
  //  */
  // removeComparison(originalUri: URI, modifiedUri: URI): void;

  /**
   * The currently active diff editor showing the selected file pair
   */
  // currentDiffEditor: {
  //   originalEditor: IEditor;
  //   modifiedEditor: IEditor;
  // };

  /**
   * Get all file pairs currently being compared
   */
  getDiffEntries(): IDocumentDiffItem[];

  /**
   * Get the currently selected/active file pair
   */
  getCurrentDiffEntry(): IDocumentDiffItem | undefined;

  /**
   * Get line changes for the currently selected file pair
   */
  // getLineChanges(): ILineChange[] | null;

  /**
   * Layout the editor
   */
  layout(dimension: Dimension): void;

  /**
   * Focus the editor
   */
  focus(): void;

  /**
   * Event emitted when a new file pair reference is opened
   */
  onRefOpen: Event<IEditorDocumentModelRef>;

  /**
   * Event emitted when the selected file pair changes
   */
  onCurrentDiffEntryChange: Event<IDocumentDiffItem | undefined>;

  /**
   * Event emitted when the list of file pairs changes
   */
  onDiffEntriesChange: Event<IDocumentDiffItem[]>;
}
