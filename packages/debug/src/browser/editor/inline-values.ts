import { LanguageFeatureRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes/languageFeatureRegistry';

import { InlineValuesProvider } from './../../common/inline-values';

export const InlineValuesProviderRegistry = new LanguageFeatureRegistry<InlineValuesProvider>();
