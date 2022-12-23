export interface IFileDecoration {
  badge: string;
  tooltip: string;
  color: string;
  weight?: number;
}

export interface FileDecorationsProvider {
  getDecoration: (uri: any, hasChildren?: boolean) => IFileDecoration;
}
