export interface IThemeColor {
  id: string;
}

export function isThemeColor(obj: any): obj is IThemeColor {
  return obj && typeof obj === 'object' && typeof (obj as IThemeColor).id === 'string';
}
