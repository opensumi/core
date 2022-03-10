import { URI, Emitter, Event, IDisposable, DisposableCollection, PreferenceService } from '@opensumi/ide-core-browser';

import { DebugConfiguration } from '../common';

export class DebugConfigurationModel implements IDisposable {
  protected json: DebugConfigurationModel.JsonContent;

  protected readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

  protected readonly toDispose = new DisposableCollection(this.onDidChangeEmitter);

  constructor(readonly workspaceFolderUri: string, protected readonly preferences: PreferenceService) {
    this.reconcile();
    this.toDispose.push(
      this.preferences.onPreferenceChanged((e) => {
        if (e.preferenceName === 'launch' && e.affects(workspaceFolderUri)) {
          this.reconcile();
        }
      }),
    );
  }

  get uri(): URI | undefined {
    return this.json.uri;
  }

  dispose(): void {
    this.toDispose.dispose();
  }
  get onDispose(): Event<void> {
    return this.toDispose.onDispose;
  }

  get configurations(): DebugConfiguration[] {
    return this.json.configurations;
  }

  async reconcile(): Promise<void> {
    this.json = this.parseConfigurations();
    this.onDidChangeEmitter.fire(undefined);
  }
  protected parseConfigurations(): DebugConfigurationModel.JsonContent {
    const configurations: DebugConfiguration[] = [];
    const { configUri, value } = this.preferences.resolve<any>('launch', undefined, this.workspaceFolderUri);
    if (value && typeof value === 'object' && 'configurations' in value) {
      if (Array.isArray(value.configurations)) {
        for (const configuration of value.configurations) {
          if (DebugConfiguration.is(configuration)) {
            configurations.push(configuration);
          }
        }
      }
    }
    return {
      uri: configUri,
      configurations,
    };
  }
}
export namespace DebugConfigurationModel {
  export interface JsonContent {
    uri?: URI;
    configurations: DebugConfiguration[];
  }
}
