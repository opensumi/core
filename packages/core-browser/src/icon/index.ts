export function getIcon(iconKey: string) {
  const iconClass = iconMap[iconKey];
  if (!iconClass) {
    console.warn('图标库缺失图标:' + iconKey);
  }
  return `iconfont icon${iconClass || 'smile'}`;
}

export function updateIconMap(customIconMap: {[iconKey: string]: string}) {
  Object.assign(iconMap, customIconMap);
}

export const defaultIconMap = {
  'wait': 'wait',
  'extension': 'extension',
  'debug': 'debug',
  'scm': 'scm',
  'search': 'search',
  'explorer': 'explorer',
  'arrow-down': 'arrow',
  'dashboard-fill': 'dashboard-fill',
  'info-circle-fill': 'info-circle-fill',
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
  'ellipsis': 'ellipsis',
  'right': 'right',
  'cloud-server': 'cloud-server',
  'bell': 'bell',
  'file-text': 'file-text',
  'team': 'team',
  'setting': 'setting',
};

const iconMap: {[iconKey: string]: string} = defaultIconMap;
