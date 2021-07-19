import { InlineValuesProvider } from './../../common/inline-values';
import { LanguageFeatureRegistry } from '@ali/monaco-editor-core/esm/vs/editor/common/modes/languageFeatureRegistry';

export const InlineValuesProviderRegistry = new LanguageFeatureRegistry<InlineValuesProvider>();
