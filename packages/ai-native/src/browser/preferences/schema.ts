import { AINativeSettingSectionsId, PreferenceSchema } from '@opensumi/ide-core-browser';
import { localize } from '@opensumi/ide-core-common';

export enum EInlineDifPreviewMode {
  inlineLive = 'inlineLive',
  sideBySide = 'sideBySide',
}

export const aiNativePreferenceSchema: PreferenceSchema = {
  properties: {
    [AINativeSettingSectionsId.InlineDiffPreviewMode]: {
      type: 'string',
      enum: [EInlineDifPreviewMode.inlineLive, EInlineDifPreviewMode.sideBySide],
      enumDescriptions: [
        localize('preference.ai.native.inlineDiff.preview.mode.inlineLive'),
        localize('preference.ai.native.inlineDiff.preview.mode.sideBySide'),
      ],
      default: EInlineDifPreviewMode.inlineLive,
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
    [AINativeSettingSectionsId.InlineCompletionsPromptEngineeringEnabled]: {
      type: 'boolean',
      default: true,
    },
    [AINativeSettingSectionsId.InlineCompletionsDebounceTime]: {
      type: 'number',
      default: 150,
    },
  },
};
