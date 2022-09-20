import { IPreferenceViewDesc, localize } from '@opensumi/ide-core-browser';

export const PREF_SCHEME = 'pref';

export const knownTermMappings = new Map<string, string>();
knownTermMappings.set('power shell', 'PowerShell');
knownTermMappings.set('powershell', 'PowerShell');
knownTermMappings.set('javascript', 'JavaScript');
knownTermMappings.set('typescript', 'TypeScript');

['css', 'html', 'scss', 'less', 'json', 'js', 'ts', 'ie', 'id', 'php', 'scm', 'npm'].forEach((v) => {
  knownTermMappings.set(v, v.toUpperCase());
});

function transformFirstTerm(term: string): string {
  const termLowerCase = term.toLowerCase();
  if (knownTermMappings.has(termLowerCase)) {
    return knownTermMappings.get(termLowerCase)!;
  }
  return toNormalCase(term);
}

export function toPreferenceReadableName(name: string) {
  const parts = name.split('.');
  let result = transformFirstTerm(parts[0]);
  if (parts[1]) {
    result += ' > ' + toNormalCase(parts[1]);
  }
  if (parts[2]) {
    result += ' : ' + toNormalCase(parts[2]);
  }
  if (parts.slice(3).length > 0) {
    result += '. ' + parts.slice(3).join(' ');
  }
  return result;
}

export function getPreferenceItemLabel(pref: IPreferenceViewDesc) {
  if (pref.localized) {
    return localize(pref.localized);
  }
  return toPreferenceReadableName(pref.id);
}

export function toNormalCase(str: string) {
  return str.substr(0, 1).toUpperCase() + str.substr(1).replace(/([^A-Z])([A-Z])/g, '$1 $2');
}
