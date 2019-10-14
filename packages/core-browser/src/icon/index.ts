const iconPrefixes = ['kaitian-icon kticon-'];

export function getIcon(iconKey: string) {
  let lastIndex = iconPrefixes.length;
  while (!iconMap[iconPrefixes[--lastIndex]][iconKey]) {
    if (lastIndex === 0) { break; }
  }
  const iconClass = iconMap[iconPrefixes[lastIndex]][iconKey];
  if (!iconClass) {
    console.warn('图标库缺失图标:' + iconKey);
  }

  return `${iconPrefixes[lastIndex]}${iconClass || 'smile'}`;
}

export function getOctIcon(iconKey: string) {
  return `octicon octicon-${iconKey}`;
}

export function updateIconMap(prefix: string, customIconMap: {[iconKey: string]: string}) {
  iconMap[prefix] = customIconMap;
  iconPrefixes.push(prefix);
}

export const defaultIconMap = {
  'wait': 'wait',
  'extension': 'extension',
  'debug': 'debug',
  'scm': 'scm',
  'search': 'search',
  'explorer': 'explorer',
  'arrow-down': 'arrow-down',
  'dashboard-fill': 'dashboard-fill',
  'info-circle': 'info-circle',
  'info-circle-fill': 'info-circle-fill',
  'close-circle': 'close-circle',
  'close-circle-fill': 'close-circle-fill',
  'check-circle-fill': 'check-circle-fill',
  'check': 'check',
  'delete': 'delete',
  'detail': 'detail',
  'sync': 'sync',
  'question-circle': 'question-circle',
  'control-fill': 'control-fill',
  'codelibrary-fill': 'codelibrary-fill',
  'close': 'close',
  'unorderedlist': 'unorderedlist',
  'swap': 'swap',
  'up': 'up',
  'branches': 'branches',
  'file-exclamation': 'file-exclamation',
  'folder-fill': 'folder-fill',
  'folder-fill-open': 'folder-fill',
  'ellipsis': 'ellipsis',
  'right': 'right',
  'cloud-server': 'cloud-server',
  'bell': 'bell',
  'file-text': 'file-text',
  'team': 'team',
  'setting': 'setting',
  'embed': 'embed',
  'refresh': 'refresh',
  'search-close': 'close-square',
  'fold': 'collapse-all',
  'open': 'open',
  'withdraw': 'withdraw',
  'plus': 'plus',
  'line': 'line',
  'add': 'add',
  'ab': 'ab',
  'abl': 'abl',
  'regex': 'regex',
  'eye': 'eye',
  'clear': 'clear',
  'eye-close': 'eye-close',
  'replace': 'replace',
  'window-maximize': 'window-maximize',
  'cloud-download': 'cloud-download',
  'new-file': 'new-file',
  'new-folder': 'new-folder',
  'collapse-all': 'collapse-all',
  'close-all': 'close-all',
  'save-all': 'save-all',
};

const iconMap: {[iconPrefix: string]: {[iconKey: string]: string}} = {
  [iconPrefixes[0]]: defaultIconMap,
};
