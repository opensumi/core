import { Uri, Event, CancellationToken, IDisposable } from '@ali/ide-core-common';

type ColorIdentifier = string;

export interface IDecorationData {
  readonly weight?: number;
  readonly color?: ColorIdentifier;
  readonly letter?: string;
  readonly tooltip?: string;
  readonly bubble?: boolean;
  readonly source?: string; // hacky... we should remove it and use equality under the hood
}

export interface IDecorationsProvider {
  readonly label: string;
  readonly onDidChange: Event<Uri[]>;
  provideDecorations(uri: Uri, token: CancellationToken): IDecorationData | Promise<IDecorationData | undefined> | undefined;
}

export interface IResourceDecorationChangeEvent {
  affectsResource(uri: Uri): boolean;
}

export interface IDecoration {
  key: string;
  badge: string;
  tooltip: string;
  color?: string; // color id
}

export abstract class IDecorationsService {
  readonly onDidChangeDecorations: Event<IResourceDecorationChangeEvent>;

  abstract registerDecorationsProvider(provider: IDecorationsProvider): IDisposable;

  abstract getDecoration(uri: Uri, includeChildren: boolean, overwrite?: IDecorationData): IDecoration | undefined;
}
