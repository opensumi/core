import { RawContextKey } from '../raw-context-key';

// https://github.com/microsoft/vscode/blob/9318bcc5183dbbc49cea8843859cbdeb59b94eaf/src/vs/workbench/contrib/search/common/constants.ts
export const SearchViewFocusedKey = new RawContextKey<boolean>('searchViewletFocus', false);
export const SearchInputBoxFocusedKey = new RawContextKey<boolean>('searchInputBoxFocus', false);
export const ReplaceInputBoxFocusedKey = new RawContextKey<boolean>('replaceInputBoxFocus', false);
export const HasSearchResults = new RawContextKey<boolean>('hasSearchResult', false);
export const SearchViewVisibleKey = new RawContextKey<boolean>('searchViewletVisible', true);

// not impliments
export const InputBoxFocusedKey = new RawContextKey<boolean>('inputBoxFocus', false);
export const PatternIncludesFocusedKey = new RawContextKey<boolean>('patternIncludesInputBoxFocus', false);
export const PatternExcludesFocusedKey = new RawContextKey<boolean>('patternExcludesInputBoxFocus', false);
export const ReplaceActiveKey = new RawContextKey<boolean>('replaceActive', false);
export const FirstMatchFocusKey = new RawContextKey<boolean>('firstMatchFocus', false);
export const FileMatchOrMatchFocusKey = new RawContextKey<boolean>('fileMatchOrMatchFocus', false); // This is actually, Match or File or Folder
export const FileMatchOrFolderMatchFocusKey = new RawContextKey<boolean>('fileMatchOrFolderMatchFocus', false);
export const FileMatchOrFolderMatchWithResourceFocusKey = new RawContextKey<boolean>(
  'fileMatchOrFolderMatchWithResourceFocus',
  false,
); // Excludes "Other files"
export const FileFocusKey = new RawContextKey<boolean>('fileMatchFocus', false);
export const FolderFocusKey = new RawContextKey<boolean>('folderMatchFocus', false);
export const ResourceFolderFocusKey = new RawContextKey<boolean>('folderMatchWithResourceFocus', false);
export const MatchFocusKey = new RawContextKey<boolean>('matchFocus', false);
export const ViewHasSearchPatternKey = new RawContextKey<boolean>('viewHasSearchPattern', false);
export const ViewHasReplacePatternKey = new RawContextKey<boolean>('viewHasReplacePattern', false);
export const ViewHasFilePatternKey = new RawContextKey<boolean>('viewHasFilePattern', false);
export const ViewHasSomeCollapsibleKey = new RawContextKey<boolean>('viewHasSomeCollapsibleResult', false);
export const InTreeViewKey = new RawContextKey<boolean>('inTreeView', false);
