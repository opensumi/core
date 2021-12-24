import { DefaultLogFields } from 'simple-git';

export interface ICommitLogFields extends DefaultLogFields {
  /**
   * PR Id / Antcode 侧为 PR Iid / Gitlab 为 id
   */
  pullRequestId: string;
  /**
   * PR 的描述 / Antcode 侧需要单独获取 / Gitlab 放在 commit body 中
   */
  pullRequestDescription: string;
  /**
   * 登陆名称，根据该名称获取到用户个人页地址
   */
  loginName?: string;
}
