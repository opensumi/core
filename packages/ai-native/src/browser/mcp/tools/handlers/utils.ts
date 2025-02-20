export function generateCodeBlockId(composerId: string, messageId: string): string {
  return `${composerId}:${messageId}`;
}
