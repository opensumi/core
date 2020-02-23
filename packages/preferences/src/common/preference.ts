export const PREF_SCHEME = 'pref';

export function toPreferenceReadableName(name) {
  const parts = name.split('.');
  let result = toNormalCase(parts[0]);
  if (parts[1]) {
    result += ' > ' + toNormalCase(parts[1]);
  }
  if (parts[2]) {
    result += ' : ' + toNormalCase(parts[2]);
  }
  return result;
}

export function toNormalCase(str: string) {
  return str.substr(0, 1).toUpperCase() + str.substr(1).replace(/([^A-Z])([A-Z])/g, '$1 $2');
}
