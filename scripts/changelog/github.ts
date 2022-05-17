import fetch from 'node-fetch';
import { DefaultLogFields } from 'simple-git';
import { ICommitLogFields, PR_STATE } from './types';

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

/**
 * 获取某个时间至今合并/新建的所有 PR
 * @param date
 * @param state 状态，合并的、关闭的、新建的
 * @param projectId
 */
export async function getPrList(startTime: number = Date.now(), state = PR_STATE.CLOSED, projectId = 'opensumi/core') {
  const per_page = 100;
  let page = 1;
  const start = new Date(startTime).getTime();
  const result: any[] = [];
  const _state = state === PR_STATE.ALL ? 'all' : state === PR_STATE.CLOSED ? 'closed' : 'open';
  for (page = 1; ; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${projectId}/pulls?` +
        new URLSearchParams({
          per_page: String(per_page),
          page: String(page),
          state: _state,
        }),
      {
        method: 'GET',
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const ret = await res.json();
    if (ret.length === 0) {
      break;
    }
    for (const item of ret) {
      // 如果查询的是 PR_STATE.CLOSED 状态，以 merged_at 时间进行判断
      // 如果查询的是 PR_STATE.OPEN 或 PR_STATE.ALL 状态，则以 created_at 进行判断
      const time = new Date(state === PR_STATE.CLOSED ? item.merged_at || item.closed_at : item.created_at).getTime();
      if (time >= start) {
        result.push(item);
      } else {
        break;
      }
    }
  }
  return result;
}
