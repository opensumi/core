import simpleGit from 'simple-git';
import groupBy from 'lodash/groupBy';
import fs from 'fs';
import path from 'path';
import { formatBytes, getType, getChangelog, getNickNameDesc, prettyDate } from './util';
import * as Github from './github';
import { ICommitLogFields } from './types';

const OTHER_CHANGE_FIELD_KEY = '其他改动';
const RELEASE_VERSION_REGEX = /^v\d+\.\d+\.\d+$/;
const VERSION_COMMIT_MAP = new Map();

const git = simpleGit();

/**
 * 从 PULL_REQUEST_TEMPLATE 中读取 PR 类型的排序规则
 */
const getTypeSorter = () => {
  const templateMdPath = path.resolve(__dirname, '../../.github/PULL_REQUEST_TEMPLATE.md');
  const content = fs.readFileSync(templateMdPath, 'utf-8');
  const regex = /\[ \](.+)/g;
  const sorterDesc: string[] = [];
  let myArray: RegExpExecArray | null = null;
  // 连续匹配取出 pr types
  while ((myArray = regex.exec(content)) !== null) {
    // 去掉两端空格
    let sorterKey = myArray[1].trim();
    if (sorterKey.startsWith(OTHER_CHANGE_FIELD_KEY) || sorterKey.includes(OTHER_CHANGE_FIELD_KEY)) {
      sorterKey = OTHER_CHANGE_FIELD_KEY;
    }
    sorterDesc.push(sorterKey);
  }
  return sorterDesc;
};

const prTypeMap = {
  新特性提交: '🎉 New Features',
  '日常 bug 修复': '🐛 Bug Fixes',
  代码风格优化: '💄 Code Style Changes',
  重构: '🪚 Refactors',
  其他改动: '🧹 Chores',
  性能优化: '🚀 Performance Improvements',
  文档改进: '📚 Documentation Changes',
  样式改进: '💄 Style Changes',
  测试用例: '⏱ Tests',
  'Other Changes': '🧹 Chores',
};

function convertToEnglishType(type: string) {
  if (prTypeMap[type]) {
    return prTypeMap[type];
  }
  // 没有或匹配不到默认都是 🧹 Chores
  return type;
}

function convertToMarkdown(logs: ICommitLogFields[]) {
  const extendedLogs = logs
    .map((log) => {
      return {
        ...log,
        changelog: getChangelog(log.pullRequestDescription),
        type: convertToEnglishType(getType(log.pullRequestDescription) || OTHER_CHANGE_FIELD_KEY),
        href: Github.getPullRequestLink(log.pullRequestId),
        nickNameDesc: getNickNameDesc(log.author_name, log.loginName),
      };
    })
    .filter((log) => !!log.changelog);

  const prTypedList = groupBy(extendedLogs, 'type');

  // 数组降维
  const sorterDesc = getTypeSorter();
  return Array.prototype.concat.apply(
    [],
    Object.keys(prTypedList)
      // 按照 MERGE_TEMPLATE 中顺序做排序
      .sort((a, b) => {
        const aPos = sorterDesc.indexOf(a);
        const bPos = sorterDesc.indexOf(b);

        if (aPos > -1 && bPos > -1) {
          return aPos - bPos;
        }

        if (aPos > -1) {
          return -1;
        }

        if (bPos > -1) {
          return 1;
        }
        return a.localeCompare(b);
      })
      .map((type) => {
        return [`#### ${type}`].concat(
          ...(prTypedList[type]
            ? prTypedList[type].map((commit) => {
                return (
                  `- ${commit.changelog || commit.message}` +
                  ` [#${commit.pullRequestId}](${commit.href})` +
                  ` by ${commit.nickNameDesc}`
                );
              })
            : []),
        );
      }),
  );
}

/**
 * 读取两个 tag 之间的日志列表
 * @param from 老的 tag
 * @param to 新的 tag
 */
function readLogs(from: string, to: string) {
  return git.log({
    from: from,
    to: to,
    // symmetric revision range cannot works
    // symmetric: `${from}...${to}`
  });
}

/**
 * 获取全部的 TagList
 */
async function getTagsByV(isRemote?: boolean) {
  let list;
  if (!isRemote) {
    // 倒序获取本地 TagList
    const ret = await git.tags(['-l', '--sort=-v:refname']);
    list = ret.all;
  } else {
    // GtiHub Action 下，通过 API 获取 TagList
    const remoteTagList = await Github.getTagList();
    list = remoteTagList.map((tag) => {
      VERSION_COMMIT_MAP.set(tag.name, tag.commit.sha);
      return tag.name;
    });
  }
  return list;
}

async function findSymmetricRevision(isRemote: boolean = false) {
  const tagList = await getTagsByV(isRemote);
  let tagA: string | undefined = undefined;
  let tagB: string | undefined = undefined;
  for (const tag of tagList) {
    if (tagB === undefined && RELEASE_VERSION_REGEX.test(tag)) {
      tagB = tag;
      continue;
    }

    if (tagA === undefined && RELEASE_VERSION_REGEX.test(tag)) {
      tagA = tag;
      continue;
    }

    if (tagA && tagB) {
      break;
    }
  }
  return [tagA, tagB];
}

export async function run(from: string, to: string, options: { isRemote?: boolean; isRelease?: boolean }) {
  const { isRemote, isRelease } = options;
  console.log(`from: ${from}`, `to: ${to}`, isRemote ? 'remote' : 'local');
  const [tagFrom, tagTo] = !from || !to ? await findSymmetricRevision(isRemote) : [];
  const tagA = from || tagFrom;
  const tagB = to || tagTo;
  if (!tagA || !tagB) {
    throw new Error(`Missing revision ${tagA}..${tagB}`);
  }

  console.log(`Generating changelog from revision ${tagA}..${tagB}`);
  let logs;
  let releaseTitle;
  let compareLink;
  if (isRemote) {
    let base;
    let head;
    if (isRelease) {
      base = VERSION_COMMIT_MAP.get(tagA);
      head = VERSION_COMMIT_MAP.get(tagB);
    } else if (process.env.GITHUB_SHA) {
      // 如果存在 GITHUB_SHA，说明当前处于 Github Actions 环境，使用最新的 Release 版本与当前提供的 Commit SHA 做比较
      base = VERSION_COMMIT_MAP.get(tagB);
      head = process.env.GITHUB_SHA;
    } else {
      base = VERSION_COMMIT_MAP.get(tagA);
      head = VERSION_COMMIT_MAP.get(tagB);
    }
    console.log('base:', base);
    console.log('head:', head);
    const result = await Github.compareCommits(base, head);
    logs = {
      all: result.commits.map((e) => e.commit),
      total: result.commits.length,
    };
  } else {
    logs = await readLogs(tagA, tagB);
  }

  if (process.env.GITHUB_SHA) {
    compareLink = Github.getCompareLink(VERSION_COMMIT_MAP.get(tagB), process.env.GITHUB_SHA);
    releaseTitle = [`### [${process.env.GITHUB_SHA}](${compareLink})`, `> ${prettyDate(logs.latest?.date)}`];
  } else {
    compareLink = Github.getCompareLink(tagA, tagB);
    releaseTitle = [`### [${tagB}](${compareLink})`, `> ${prettyDate(logs.latest?.date)}`];
  }

  const githubPrLogs = await Github.extractChangelog(logs.all);
  const releaseContent = convertToMarkdown(githubPrLogs);

  const changelog = [...releaseTitle, ...releaseContent].join('\n\n');

  const logFile = path.resolve(__dirname, '../../releaselog.md');
  await fs.promises.writeFile(logFile, changelog);
  const bytes = Buffer.byteLength(changelog, 'utf8');
  console.log(`${formatBytes(bytes)} written to ${logFile}\n`);
}
