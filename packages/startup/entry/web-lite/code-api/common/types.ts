type ConstructorOf<T = any> = new (...args: any[]) => T;

export enum CodePlatform {
  github = 'github',
}

// 暂时只支持github
export type ICodePlatform = 'github';

export type EntryFileType = 'commit' | 'tree' | 'blob';

export interface EntryInfo {
  /**
   * file size
   */
  size: number;
  /**
   * file type
   */
  fileType: 'binary' | 'text' | 'image';
}

export interface TreeEntry extends Partial<EntryInfo> {
  /**
   * file mode
   */
  mode: string;
  /**
   * file type
   */
  type: EntryFileType;
  /**
   * object id
   */
  id: string;
  /**
   * file name
   */
  name: string;
  /**
   * full path
   */
  path: string;

  content?: string;
}

export type EntryParam = Pick<TreeEntry, 'id' | 'path'>;

export interface BranchOrTag {
  name: string;
  commit: {
    id: string;
  };
}

export interface RefsParam {
  branches: BranchOrTag[];
  tags: BranchOrTag[];
}

export type ISearchResults = Array<{
  path: string;
  line: number;
  content: string;
}>;

export interface IRepositoryModel {
  platform: ICodePlatform;
  owner: string;
  name: string;
  commit: string;
}

export interface CommitParams {
  ref?: string;
  path?: string;
  page: number;
  pageSize: number;
}

export interface CommitRecord {
  id: string;
  parents: ReadonlyArray<string>;
  author: string;
  authorEmail: string;
  authorDate: string;
  committer: string;
  committerEmail: string;
  committerDate: string;
  // signature: null; // GPA 签名
  message: string;
  title?: string;
}

export interface CommitFileChange {
  oldFilePath: string;
  newFilePath: string;
  type: CommitFileStatus;
  additions: number | null;
  deletions: number | null;
}

export const enum CommitFileStatus {
  Added = 'A',
  Modified = 'M',
  Deleted = 'D',
  Renamed = 'R',
}

export const ICodeAPIProvider = Symbol('ICodeAPIProvider');

export interface ICodeAPIProvider {
  registerPlatformProvider(
    platform: ICodePlatform,
    provider: { provider: ConstructorOf<ICodeAPIService>; onView?: () => void },
  ): void;
  asPlatform(platform: ICodePlatform): ICodeAPIService;
}

export interface ICodeAPIService {
  /**
   * 检查 API service 可用性
   */
  available(): Promise<boolean>;
  /**
   * 根据分支获取最新的 commit
   */
  getCommit(repo: IRepositoryModel, ref: string): Promise<string>;
  /**
   * 获取 tree
   */
  getTree(repo: IRepositoryModel, path: string, recursive?: number): Promise<TreeEntry[]>;
  /**
   * 获取 blob
   */
  getBlob(repo: IRepositoryModel, entry: EntryParam): Promise<Uint8Array>;
  /**
   * 获取 blob
   */
  getBlobByCommitPath(repo: IRepositoryModel, commit: string, path: string): Promise<Uint8Array>;
  /**
   * 获取 entry 相关信息
   */
  getEntryInfo?(repo: IRepositoryModel, entry: EntryParam): Promise<EntryInfo>;
  /**
   * 获取所有分支
   */
  getBranches(repo: IRepositoryModel): Promise<BranchOrTag[]>;
  /**
   * 获取所有分支
   */
  getBranchNames?(repo: IRepositoryModel): Promise<string[]>;
  /**
   * 获取所有标签
   */
  getTags(repo: IRepositoryModel): Promise<BranchOrTag[]>;
  /**
   * 静态资源路径
   */
  transformStaticResource(repo: IRepositoryModel, path: string): string;
  /**
   * 内容搜索
   */
  searchContent(repo: IRepositoryModel, searchString: string, options: { limit: number }): Promise<ISearchResults>;
  /**
   * 文件搜索
   */
  searchFile(repo: IRepositoryModel, searchString: string, options: { limit?: number }): Promise<string[]>;
  /**
   * file blame
   */
  getFileBlame(repo: IRepositoryModel, filepath: string): Promise<Uint8Array>;
  /**
   * commits list
   */
  getCommits(repo: IRepositoryModel, params: CommitParams): Promise<CommitRecord[]>;
  /**
   * commit diff
   */
  getCommitDiff(repo: IRepositoryModel, sha: string): Promise<CommitFileChange[]>;
  /**
   * compare commit
   */
  getCommitCompare(repo: IRepositoryModel, from: string, to: string): Promise<CommitFileChange[]>;
}

export interface ICodeAPIServiceProvider extends ICodeAPIService {
  initialize?(): void | Promise<void>;
}
