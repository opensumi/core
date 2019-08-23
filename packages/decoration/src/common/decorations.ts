import { Uri, Event, CancellationToken } from '@ali/ide-core-common';
import { IDisposable } from '@ali/ide-core-common/lib/disposable';

type ColorIdentifier = string;

export interface IDecorationData {
  readonly weight?: number;
  readonly color?: ColorIdentifier;
  readonly letter?: string;
  readonly tooltip?: string;
  readonly bubble?: boolean;
  readonly source?: string;
}

export interface IDecoration {
  readonly tooltip: string;
  readonly labelClassName: string;
  readonly badgeClassName: string;
  update(data: IDecorationData): IDecoration;
}

export interface IDecorationsProvider {
  readonly label: string;
  readonly onDidChange: Event<Uri[]>;
  provideDecorations(uri: Uri, token: CancellationToken): IDecorationData | Promise<IDecorationData | undefined> | undefined;
}

export interface IResourceDecorationChangeEvent {
  affectsResource(uri: Uri): boolean;
}

export abstract class IDecorationsService {

  readonly _serviceBrand: any;

  readonly onDidChangeDecorations: Event<IResourceDecorationChangeEvent>;

  abstract registerDecorationsProvider(provider: IDecorationsProvider): IDisposable;

  abstract getDecoration(uri: Uri, includeChildren: boolean, overwrite?: IDecorationData): IDecoration | undefined;
}
