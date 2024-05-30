import { Injectable } from '@opensumi/di';

import { CommandToken } from '../common/intell/parser';
import { IFigSpecLoader } from '../common/intell/runtime';

import suggestionBundle from './bundle.js';

const speclist = [
  'git', 'ls', 'cd', 'npm', 'yarn', 'docker', 'docker-compose', 'vim', 'vi', 'nano',
  'ssh', 'scp', 'curl', 'wget', 'ping', 'netstat', 'nslookup', 'dig', 'gzip', 'tar',
  'unzip', 'make', 'gcc', 'g++', 'clang', 'java', 'python', 'python3', 'pip', 'pip3',
  'virtualenv', 'node', 'nvm', 'mvn', 'gradle', 'go', 'rustc', 'cargo', 'dotnet',
  'php', 'ruby', 'gem', 'bundle', 'swift', 'kotlin', 'ansible', 'terraform',
  'azure', 'gcloud', 'kubectl', 'helm', 'vagrant', 'virtualbox', 'vmware', 'screen',
  'tmux', 'htop', 'iftop', 'top', 'ps', 'kill', 'systemctl', 'systemd', 'journalctl',
  'crontab', 'at', 'chmod', 'chown', 'rsync', 'sftp', 'ftp', 'mount', 'umount', 'df',
  'du', 'find', 'grep', 'awk', 'sed', 'cut', 'sort', 'uniq', 'cat', 'tac', 'less', 'more',
  'head', 'tail', 'diff', 'patch', 'wc', 'echo', 'printf', 'env', 'export', 'unset',
  'alias', 'unalias', 'history', 'type', 'which', 'whereis', 'whoami', 'who', 'w',
  'uptime', 'dmesg', 'uname', 'lscpu', 'lshw', 'free', 'df', 'du', 'tree', 'nc', 'socat',
  'telnet', 'openssl', 'ssh-keygen', 'gpg', 'gitlab-runner', 'travis', 'circleci',
  'jenkins', 'codeship', 'bitbucket-pipelines', 'azure-pipelines', 'github-actions',
  'firebase', 'heroku', 'now', 'vercel', 'netlify', 'surge', 's3cmd', 'rclone',
  'ansible-playbook', 'ansible-galaxy', 'ansible-vault', 'ansible-doc', 'mocha',
  'jest', 'karma', 'jasmine', 'protractor', 'cypress', 'selenium-webdriver', 'webdriverio',
  'puppeteer', 'playwright', 'storybook', 'react', 'vue', 'angular', 'svelte', 'nextjs',
  'nuxtjs', 'gatsby', 'jekyll', 'hugo', 'hexo', 'eleventy', 'markdown', 'asciidoctor',
  'pandoc', 'latex', 'groff', 'ffmpeg', 'imagemagick', 'docker', 'podman', 'buildah',
  'skaffold', 'kaniko', 'tilt', 'kind', 'minikube', 'microk8s', 'k3s', 'rkt', 'cri-o',
  // 添加更多根据个人或团队的具体需求
];

// SpecLoaderImpl 类在 Node.js 层实现了 SpecLoader接口
// TODO Node 层直接读取 node_modules
@Injectable()
export class SpecLoaderNodeImpl implements IFigSpecLoader {
  private specSet: any = {}; // TODO 更好的 Type
  private loadedSpecs: { [key: string]: Fig.Spec } = {};

  constructor() {
    (speclist as string[]).forEach((s) => {
      let activeSet = this.specSet;
      const specRoutes = s.split("/");
      specRoutes.forEach((route, idx) => {
        if (typeof activeSet !== "object") {
          return;
        }
        if (idx === specRoutes.length - 1) {
          // const prefix = versionedSpeclist.includes(s) ? "/index.js" : `.js`;
          // HACK: 看了一下 bundle 的补全数据，这里都是 .js，为了暂先不引入 fig 的完整依赖，这里先写死了
          const prefix = `.js`;
          activeSet[route] = `@withfig/autocomplete/build/${s}${prefix}`;
        } else {
          activeSet[route] = activeSet[route] || {};
          activeSet = activeSet[route];
        }
      });
    });
  }

  public getSpecSet(): any {
    return this.specSet;
  }

  public async loadSpec(cmd: CommandToken[]): Promise<Fig.Spec | undefined> {
    const rootToken = cmd.at(0);
    if (!rootToken?.complete) {
      return;
    }

    if (this.loadedSpecs[rootToken.token]) {
      return this.loadedSpecs[rootToken.token];
    }
    if (this.specSet[rootToken.token]) {
      const spec = suggestionBundle[rootToken.token];
      this.loadedSpecs[rootToken.token] = spec;
      return spec;
    }
  }

  public async lazyLoadSpec(key: string): Promise<Fig.Spec | undefined> {
    return suggestionBundle[key];
  }

  public async lazyLoadSpecLocation(location: Fig.SpecLocation): Promise<Fig.Spec | undefined> {
    return;
  }
}
