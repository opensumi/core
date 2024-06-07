import { DefaultLogFields } from 'simple-git';

export interface ICommitLogFields extends DefaultLogFields {
  pullRequestId: string;
  pullRequestDescription: string;
  loginName?: string;
}

export enum PR_STATE {
  CLOSED = 0,
  OPEN,
  ALL,
}
