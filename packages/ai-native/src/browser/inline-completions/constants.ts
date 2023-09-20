interface CodeFuseConfigModel {
  chatPromptMaxSize: number;
  completionFileList: string[];
  completionPromptMaxLineSize: number;
  completionSuffixMaxLineSize: number;
  intervalTime: number;
  streamTimeOut: number;
  timeOut: number;
  completionRegular: string;
}

/**
 * 插件配置信息
 */
export let codeFuseDefaultConfig: CodeFuseConfigModel = {
  chatPromptMaxSize: 4096,
  completionFileList: ['java', 'go', 'python', 'javascript', 'typescript'],
  completionPromptMaxLineSize: 1024,
  completionSuffixMaxLineSize: 500,
  intervalTime: 1800000,
  streamTimeOut: 40000,
  timeOut: 20000,
  completionRegular: '[\\)\\]\\}]',
};
