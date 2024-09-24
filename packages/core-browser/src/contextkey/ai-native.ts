import { RawContextKey } from '../raw-context-key';

export const InlineChatIsVisible = new RawContextKey('ai.native.inlineChatIsVisible', false);
export const InlineCompletionIsTrigger = new RawContextKey('ai.native.inlineCompletionIsTrigger', false);
export const InlineHintWidgetIsVisible = new RawContextKey('ai.native.inlineHintWidgetIsVisible', false);
export const InlineInputWidgetIsVisible = new RawContextKey('ai.native.inlineInputWidgetIsVisible', false);
export const InlineDiffPartialEditsIsVisible = new RawContextKey('ai.native.inlineDiffPartialEditsIsVisible', false);
export const MultiLineEditsIsVisible = new RawContextKey('ai.native.multiLineEditsIsVisible', false);
