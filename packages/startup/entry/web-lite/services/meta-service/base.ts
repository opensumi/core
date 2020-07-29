export const IMetaService = Symbol('IMetaService');

export interface IMetaService {
  projectId: string; // SCM projectId
  group: string; // git repo group
  name: string; // git repo name
  ref: string; // git repo ref(branch | commitId)
  repo?: string; // group/name
}
