import { AINativeSettingSectionsId, PreferenceSchema } from '@opensumi/ide-core-browser';
import { localize } from '@opensumi/ide-core-common';

export enum EInlineDiffPreviewMode {
  inlineLive = 'inlineLive',
  sideBySide = 'sideBySide',
}

export const aiNativePreferenceSchema: PreferenceSchema = {
  properties: {
    [AINativeSettingSectionsId.InlineDiffPreviewMode]: {
      type: 'string',
      enum: [EInlineDiffPreviewMode.inlineLive, EInlineDiffPreviewMode.sideBySide],
      enumDescriptions: [
        localize('preference.ai.native.inlineDiff.preview.mode.inlineLive'),
        localize('preference.ai.native.inlineDiff.preview.mode.sideBySide'),
      ],
      default: EInlineDiffPreviewMode.inlineLive,
    },
    [AINativeSettingSectionsId.InlineChatAutoVisible]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.InlineChatCodeActionEnabled]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.InterfaceQuickNavigationEnabled]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.ChatVisibleType]: {
      type: 'string',
      enum: ['never', 'always', 'default'],
      default: 'default',
    },
    [AINativeSettingSectionsId.IntelligentCompletionsPromptEngineeringEnabled]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.IntelligentCompletionsDebounceTime]: {
      type: 'number',
      default: 150,
    },
    [AINativeSettingSectionsId.IntelligentCompletionsCacheEnabled]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.IntelligentCompletionsAlwaysVisible]: {
      type: 'boolean',
      default: false,
    },
    [AINativeSettingSectionsId.CodeEditsLintErrors]: {
      type: 'boolean',
      default: false,
    },
    [AINativeSettingSectionsId.CodeEditsLineChange]: {
      type: 'boolean',
      default: false,
    },
  },
};
