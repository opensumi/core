import { BasicModule, ConstructorOf } from '@ali/ide-core-common';
import { FunctionComponent } from 'react';
import { CommandContribution } from '@ali/ide-core-common';

export type SlotMap = Map<string | symbol, FunctionComponent>;

export abstract class BrowserModule extends BasicModule {
  abstract slotMap: SlotMap;
  contributionsCls: Array<ConstructorOf<CommandContribution>> = [];
}
