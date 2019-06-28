import { Injectable } from '@ali/common-di';

export const ExtensionNodeServiceServerPath = 'ExtensionNodeService';

export interface IExtensionCandidate {

  path: string;

  packageJSON: {[key: string]: any};

  extraMetaData: {
    [key: string]: string | null;
  };

}

@Injectable()
export abstract class ExtensionNodeService {
  abstract async getAllCandidatesFromFileSystem(scan: string[], candidate: string[], extraMetaData: {[key: string]: string; }): Promise<IExtensionCandidate[]>;
}
