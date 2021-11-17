import { InlineValuesProvider } from './../../common/inline-values';
import { LanguageFeatureRegistry } from '@ide-framework/monaco-editor-core/esm/vs/editor/common/modes/languageFeatureRegistry';

export const InlineValuesProviderRegistry = new LanguageFeatureRegistry<InlineValuesProvider>();
