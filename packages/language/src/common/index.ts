/**
 * A document filter denotes a document by different properties like
 * the [language](#TextDocument.languageId), the [scheme](#Uri.scheme) of
 * its resource, or a glob-pattern that is applied to the [path](#TextDocument.fileName).
 *
 * @sample A language filter that applies to typescript files on disk: `{ language: 'typescript', scheme: 'file' }`
 * @sample A language filter that applies to all package.json paths: `{ language: 'json', pattern: '**package.json' }`
 */
export declare type DocumentFilter = {
  /** A language id, like `typescript`. */
  language: string;
  /** A Uri [scheme](#Uri.scheme), like `file` or `untitled`. */
  scheme?: string;
  /** A glob pattern, like `*.{ts,js}`. */
  pattern?: string;
} | {
  /** A language id, like `typescript`. */
  language?: string;
  /** A Uri [scheme](#Uri.scheme), like `file` or `untitled`. */
  scheme: string;
  /** A glob pattern, like `*.{ts,js}`. */
  pattern?: string;
} | {
  /** A language id, like `typescript`. */
  language?: string;
  /** A Uri [scheme](#Uri.scheme), like `file` or `untitled`. */
  scheme?: string;
  /** A glob pattern, like `*.{ts,js}`. */
  pattern: string;
};

/**
 * A document selector is the combination of one or many document filters.
 *
 * @sample `let sel:DocumentSelector = [{ language: 'typescript' }, { language: 'json', pattern: '**∕tsconfig.json' }]`;
 */
export declare type DocumentSelector = (string | DocumentFilter)[];

export const TYPESCRIPT_LANGUAGE_ID = 'typescript';
export const TYPESCRIPT_LANGUAGE_NAME = 'TypeScript';
