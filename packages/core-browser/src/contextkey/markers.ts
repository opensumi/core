import { RawContextKey } from '../raw-context-key';

export const MarkersTreeVisibilityContextKey = new RawContextKey<boolean>('problemsVisibility', false);
export const MarkerFocusContextKey = new RawContextKey<boolean>('problemFocus', false);

// not implemented
export const MarkerViewFilterFocusContextKey = new RawContextKey<boolean>('problemsFilterFocus', false);
export const RelatedInformationFocusContextKey = new RawContextKey<boolean>('relatedInformationFocus', false);
export const ShowErrorsFilterContextKey = new RawContextKey<boolean>('problems.filter.errors', true);
export const ShowWarningsFilterContextKey = new RawContextKey<boolean>('problems.filter.warnings', true);
export const ShowInfoFilterContextKey = new RawContextKey<boolean>('problems.filter.info', true);
export const ShowActiveFileFilterContextKey = new RawContextKey<boolean>('problems.filter.activeFile', false);
export const ShowExcludedFilesFilterContextKey = new RawContextKey<boolean>('problems.filter.excludedFiles', true);
