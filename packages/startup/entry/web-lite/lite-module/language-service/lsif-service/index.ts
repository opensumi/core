import type * as vscode from 'vscode';

import { Autowired, Injectable } from '@opensumi/di';

import { ILsifService, ILsifPayload } from './base';
import { LsifClient } from './lsif-client';

@Injectable()
export class LsifServiceImpl implements ILsifService {
  @Autowired(LsifClient)
  private readonly lsifClient: LsifClient;

  async fetchLsifHover(payload: ILsifPayload): Promise<vscode.Hover> {
    return await this.lsifClient.hover(payload);
  }

  async fetchLsifDefinition(
    payload: ILsifPayload,
  ): Promise<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
    return await this.lsifClient.definition(payload);
  }

  async fetchLsifReferences(payload: ILsifPayload): Promise<vscode.Location[]> {
    return await this.lsifClient.reference(payload);
  }
}
