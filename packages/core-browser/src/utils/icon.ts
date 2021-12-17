/**
 * 获取 icon class name
 * @param text status-bar 传过来的文字
 * @returns [icon, text]
 */
export function getIconClass(text: string): [string | null, string] {
  const regExp = /\$\(([^\)]*)\)(.*)/;
  const result = text.match(regExp);
  if (!result) {
    return [null, text];
  }
  return [result[1], result[2].trim()];
}
