const htmlUnescapes: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Used to match HTML entities and HTML characters. */
const reEscapedHtml = /&(?:amp|lt|gt|quot|#(?:0+)?39);/g;
const reHasEscapedHtml = RegExp(reEscapedHtml.source);

export const unescape = (str = '') => reHasEscapedHtml.test(str) ? str.replace(reEscapedHtml, (entity) => htmlUnescapes[entity] || "'") : str;

export const joinBase = (path: string, base?: string) => {
  if (!base) {
    return path;
  }

  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
};
