import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
import React from 'react';

import { Injectable, Autowired } from '@opensumi/di';
import {
  getIcon,
  StatusBarAlignment,
  StatusBarCommand,
  StatusBarEntryAccessor,
  TERMINAL_COMMANDS,
} from '@opensumi/ide-core-browser';
import {
  CommandService,
  Emitter,
  Event,
  ILogger,
  localize,
  raceTimeout,
  toMarkdownString,
} from '@opensumi/ide-core-common';
import { IDialogService } from '@opensumi/ide-overlay/lib/common';
import { IStatusBarService } from '@opensumi/ide-status-bar/lib/common';
import { IWorkspaceStorageService } from '@opensumi/ide-workspace/lib/common';

import { ITerminalProcessPath, ITerminalProcessService } from '../common';
import {
  deserializeEnvironmentVariableCollection,
  IEnvironmentVariableCollectionWithPersistence,
  IEnvironmentVariableService,
  IMergedEnvironmentVariableCollection,
  IMergedEnvironmentVariableCollectionDiff,
  ISerializableEnvironmentVariableCollection,
  mutatorTypeLabel,
  serializeEnvironmentVariableCollection,
} from '../common/environmentVariable';
import { MergedEnvironmentVariableCollection } from '../common/environmentVariableCollection';

import { TerminalVariable } from './component/terminal.variable';

export const ENVIRONMENT_VARIABLE_COLLECTIONS_KEY = 'terminal.integrated.environmentVariableCollections';

const ENVIRONMENT_VARIABLE_CHANGED_STATUS = 'terminal.environmentVariableCollections.changed';

interface ISerializableExtensionEnvironmentVariableCollection {
  extensionIdentifier: string;
  collection: ISerializableEnvironmentVariableCollection;
}

@Injectable()
export class TerminalEnvironmentService implements IEnvironmentVariableService {
  collections: Map<string, IEnvironmentVariableCollectionWithPersistence> = new Map();

  mergedCollection: IMergedEnvironmentVariableCollection | undefined;

  private previousMergedCollection: IMergedEnvironmentVariableCollection | undefined;

  private statusBarEntryAccessor: StatusBarEntryAccessor | undefined;

  private readonly _onDidChangeCollections = new Emitter<IMergedEnvironmentVariableCollection>();
  get onDidChangeCollections(): Event<IMergedEnvironmentVariableCollection> {
    return this._onDidChangeCollections.event;
  }

  @Autowired(IWorkspaceStorageService)
  private storageService: IWorkspaceStorageService;

  @Autowired(IStatusBarService)
  private readonly statusbarService: IStatusBarService;

  @Autowired(ITerminalProcessPath)
  public readonly terminalProcessService: ITerminalProcessService;

  @Autowired(IDialogService)
  protected dialogService: IDialogService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  async initEnvironmentVariableCollections(): Promise<void> {
    const serializedCollections = await this.storageService.getData<string | undefined>(
      ENVIRONMENT_VARIABLE_COLLECTIONS_KEY,
    );

    if (serializedCollections) {
      try {
        const collectionsJson: ISerializableExtensionEnvironmentVariableCollection[] =
          JSON.parse(serializedCollections);
        collectionsJson.forEach((c) => {
          this.collections.set(c.extensionIdentifier, {
            persistent: true,
            map: deserializeEnvironmentVariableCollection(c.collection),
          });
        });
      } catch (err) {
        this.logger.warn(
          `parse environment variable collection error: \n ${err.message}, data: \n ${serializedCollections}`,
        );
      }
    }

    this.mergedCollection = this.resolveMergedCollection();
    this.previousMergedCollection = undefined;
  }

  set(extensionIdentifier: string, collection: IEnvironmentVariableCollectionWithPersistence): void {
    this.collections.set(extensionIdentifier, collection);
    this.updateCollections();
  }

  delete(extensionIdentifier: string): void {
    this.collections.delete(extensionIdentifier);
    this.updateCollections();
  }

  public async getProcessEnv(): Promise<{ [key in string]: string | undefined } | undefined> {
    return raceTimeout(this.terminalProcessService.getEnv(), 1000);
  }

  private resolveMergedCollection(): IMergedEnvironmentVariableCollection {
    return new MergedEnvironmentVariableCollection(this.collections);
  }

  private onDidClickStatusBarEntry(diff: IMergedEnvironmentVariableCollectionDiff) {
    this.dialogService
      .warning(React.createElement(TerminalVariable, { diff }), [
        localize('dialog.file.close'),
        localize('terminal.relaunch'),
      ])
      .then((res) => {
        if (res && res === localize('terminal.relaunch')) {
          this.commandService.executeCommand(TERMINAL_COMMANDS.RE_LAUNCH.id);
          this.statusBarEntryAccessor?.dispose();
          this.statusBarEntryAccessor = undefined;
        }
      });
  }

  private updateStatusBarMessage() {
    if (!this.mergedCollection) {
      return;
    }

    const diff = this.previousMergedCollection?.diff(this.mergedCollection);
    if (!diff) {
      return;
    }

    if (this.statusBarEntryAccessor) {
      this.statusBarEntryAccessor.dispose();
      this.statusBarEntryAccessor = undefined;
    }

    const changes: string[] = [];
    this.mergedCollection.map.forEach((mutators, variable) => {
      mutators.forEach((mutator) => changes.push(mutatorTypeLabel(mutator.type, mutator.value, variable)));
    });

    this.commandService
      .tryExecuteCommand(StatusBarCommand.addElement.id, ENVIRONMENT_VARIABLE_CHANGED_STATUS, {
        iconClass: getIcon('warning-circle'),
        color: 'orange',
        alignment: StatusBarAlignment.RIGHT,
        tooltip: toMarkdownString(
          localize('terminal.environment.changed') + '\n\n```\n' + changes.join('\n') + '\n```',
        ),
        onClick: () => this.onDidClickStatusBarEntry(diff),
      })
      .then((res: StatusBarEntryAccessor) => {
        this.statusBarEntryAccessor = res;
      });
  }

  private notifyCollectionUpdates() {
    this._onDidChangeCollections.fire(this.mergedCollection!);
    this.updateStatusBarMessage();
  }

  private updateCollections() {
    throttle(this.persistCollections.bind(this), 100)();

    this.previousMergedCollection = this.mergedCollection;
    this.mergedCollection = this.resolveMergedCollection();

    debounce(this.notifyCollectionUpdates.bind(this), 1000)();
  }

  private persistCollections() {
    const collectionsJson: ISerializableExtensionEnvironmentVariableCollection[] = [];
    this.collections.forEach((collection, extensionIdentifier) => {
      if (collection.persistent) {
        collectionsJson.push({
          extensionIdentifier,
          collection: serializeEnvironmentVariableCollection(this.collections.get(extensionIdentifier)!.map),
        });
      }
    });

    const stringifiedJson = JSON.stringify(collectionsJson);
    this.storageService.setData(ENVIRONMENT_VARIABLE_COLLECTIONS_KEY, stringifiedJson);
  }
}
