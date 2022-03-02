import fetch from 'node-fetch';
import { DefaultLogFields } from 'simple-git';
import { ICommitLogFields } from './types';

const GITHUB_URL = 'https://github.com/opensumi/core';

export function getCompareLink(from: string, to: string) {
  return `${GITHUB_URL}/compare/${from}...${to}`;
}

export function getPullRequestLink(prId: string) {
  return `${GITHUB_URL}/pull/${prId}`;
}

async function getPrDesc(prIid: string, projectId = 'opensumi/core') {
  const res = await fetch(`https://api.github.com/repos/${projectId}/pulls/${prIid}`, {
    method: 'GET',
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  const ret = await res.json();
  return ret;
}

export async function getTagList(per_page: number = 10, projectId = 'opensumi/core') {
  const res = await fetch(`https://api.github.com/repos/${projectId}/tags?per_page=${per_page}`, {
    method: 'GET',
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  const ret = await res.json();
  return ret;
}

export async function compareCommits(base: string, head: string, projectId = 'opensumi/core') {
  const res = await fetch(`https://api.github.com/repos/${projectId}/compare/${base}...${head}`, {
    method: 'GET',
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  const ret = await res.json();
  return ret;
}

/**
 * 从 commit log 按照 github 的特性分离 Changelog
 */
export async function extractChangelog(logs: ReadonlyArray<DefaultLogFields>): Promise<ICommitLogFields[]> {
  const githubPrLogs = logs.filter((n) => n.message.endsWith(')'));
  const result: ICommitLogFields[] = [];
  const regex = /\(#(\d+)\)$/;
  for (const log of githubPrLogs) {
    const ret = regex.exec(log.message);
    if (ret && ret[1]) {
      // fetch pr desc from github service and insert it to `body` field
      const prIid = ret[1];
      const prDetail = await getPrDesc(prIid);
      result.push({
        ...log,
        loginName: prDetail.user.login,
        pullRequestDescription: prDetail.body || '',
        pullRequestId: prIid,
      });
    }
  }
  return result;
}
