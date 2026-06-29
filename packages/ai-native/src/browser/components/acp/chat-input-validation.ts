const CONTENT_REFERENCE_PATTERN = /\{\{@(?:file|folder|code|rule):[^}]+\}\}/i;
const CONTENT_EDITABLE_PAYLOAD_ATTRIBUTE_PATTERN = /\sdata-(?:context-id|command)=["'][^"']+["']/i;
const CONTENT_EDITABLE_EMPTY_HTML_PATTERN =
  /^(?:(?:\s|&nbsp;|&#160;|&#x0*a0;|\u00a0|\u200b|\u200c|\u200d|\ufeff)+|<br\s*\/?>|<\/?(?:div|p|span)[^>]*>)*$/i;

function hasAttachmentPayload(images?: readonly unknown[]): boolean {
  return Array.isArray(images) && images.some(Boolean);
}

export function hasChatInputTextPayload(message?: string): boolean {
  if (typeof message !== 'string') {
    return false;
  }

  if (CONTENT_REFERENCE_PATTERN.test(message) || CONTENT_EDITABLE_PAYLOAD_ATTRIBUTE_PATTERN.test(message)) {
    return true;
  }

  return !CONTENT_EDITABLE_EMPTY_HTML_PATTERN.test(message);
}

export function hasAcpChatSendPayload({
  message,
  images,
  command,
}: {
  message?: string;
  images?: readonly unknown[];
  command?: string;
}): boolean {
  return hasAttachmentPayload(images) || Boolean(command?.trim()) || hasChatInputTextPayload(message);
}
