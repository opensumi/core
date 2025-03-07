import { RawContextKey } from '../raw-context-key';

export const InlineChatIsVisible = new RawContextKey('ai.native.inlineChatIsVisible', false);
export const InlineCompletionIsTrigger = new RawContextKey('ai.native.inlineCompletionIsTrigger', false);
export const InlineHintWidgetIsVisible = new RawContextKey('ai.native.inlineHintWidgetIsVisible', false);
export const InlineDiffPartialEditsIsVisible = new RawContextKey('ai.native.inlineDiffPartialEditsIsVisible', false);
export const CodeEditsIsVisible = new RawContextKey('ai.native.codeEditsIsVisible', false);

export const InlineInputWidgetIsVisible = new RawContextKey('ai.native.inlineInputWidgetIsVisible', false);
// inline input 是否在流式编辑中
export const InlineInputWidgetIsStreaming = new RawContextKey('ai.native.inlineInputWidgetIsStreaming', false);
