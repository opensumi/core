const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function prettyDate(str: string | undefined) {
  const date = str ? new Date(str) : new Date();
  const day = date.getUTCDate();
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function getNickNameDesc(author: string, loginName?: string) {
  if (loginName) {
    return `[@${loginName}](https://github.com/${loginName})`;
  } else {
    return `@${author}`;
  }
}

// 从 PR 描述中提取 type
export function getType(message) {
  const match = /\[x\](.+)/.exec(message);
  return match && match[1] && match[1].trim();
}

// 从 PR 描述中提取 changelog
export function getChangelog(message) {
  const stripedMsg = message.replace(/\r?\n|\r/g, '');
  const match = /### changelog(.+)$/i.exec(stripedMsg);
  return match && match[1] && match[1] && cleanupUselessContent(match[1]);
}

function cleanupUselessContent(msg) {
  msg = msg.replace('- ', '').trim();
  return msg.replace(/^(feat|fix|chore|refactor)\:?/g, '');
}

export function formatBytes(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
}
