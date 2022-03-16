export namespace API {
  interface RateLimit {
    limit: number;
    remaining: number;
    reset: number;
    used: number;
  }
  // https://docs.github.com/en/rest/reference/rate-limit
  export interface ResponseGetRateLimit {
    resources: {
      core: RateLimit;
      graphql: RateLimit;
      integration_manifest: RateLimit;
      search: RateLimit;
    };
  }

  export type ResponseGetCommit = string;

  export interface ResponseGetTree {
    sha: string;
    url: string;
    tree: Array<{
      path: string;
      mode: string;
      type: 'commit' | 'tree' | 'blob';
      sha: string;
      size?: number;
      url?: string;
    }>;
  }

  export type ResponseGetRefs = Array<{
    name: string;
    commit: {
      sha: string;
    };
  }>;

  export type ResponseMatchingRefs = Array<{
    ref: string;
    object: {
      sha: string;
      type: string;
    };
  }>;

  export interface ResponseBlobCommitPath {
    content: string;
    encoding: 'base64';
  }

  export interface ResponseCommit {
    sha: string;
    node_id: string;
    commit: {
      author: {
        name: string;
        email: string;
        date: string;
      };
      committer: {
        name: string;
        email: string;
        date: string;
      };
      message: string;
      tree: {
        sha: string;
        url: string;
      };
      url: string;
      comment_count: string;
      verification: {
        verified: boolean;
        reason: 'string';
        signature: null;
        payload: null;
      };
    };
    url: string;
    html_url: string;
    comments_url: string[];
    author: null;
    committer: null;
    parents: Array<{
      sha: string;
      uri: string;
      html_url: string;
    }>;
  }

  export interface ResponseCommitFileChange {
    sha: string;
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    blob_url: string;
    raw_url: string;
    contents_url: string;
    previous_filename?: string;
  }

  export interface ResponseCommitDetail extends ResponseCommit {
    files: ResponseCommitFileChange[];
  }

  export interface ResponseCommitCompare {
    base_commit: ResponseCommit;
    merge_base_commit: ResponseCommit;
    commits: ResponseCommit[];
    files: ResponseCommitFileChange[];
  }
}
