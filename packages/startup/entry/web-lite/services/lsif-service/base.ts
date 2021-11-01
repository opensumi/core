import type vscode from 'vscode';

export const ILsifService = Symbol('ILsifService');

export interface ILsifPayload {
  repository: string;
  commit: string;
  path: string;
  character: number;
  line: number;
}

export interface ILsifService {
  fetchLsifHover(payload: ILsifPayload): vscode.ProviderResult<vscode.Hover>;
  fetchLsifDefinition(payload: ILsifPayload): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]>;
  fetchLsifReferences(payload: ILsifPayload): vscode.ProviderResult<vscode.Location[]>;
}
