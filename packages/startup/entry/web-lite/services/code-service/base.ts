export const ICodeService = Symbol('ICodeService');

export interface ICodeService {
  fetchContent(repo: string, path: string, ref: string): Promise<string>;
}
