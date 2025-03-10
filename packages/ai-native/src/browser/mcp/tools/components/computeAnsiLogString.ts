import AnsiUp from 'ansi_up';

import filterEraseMultipleLine from './filterEraseMultipleLine';

type LogContent = string;

const ansiUp = new AnsiUp();

export function computeAnsiLogString(logs: LogContent, enableEraseLineFilter = true, hideEmptyLine = false): string {
  const splittedLogs = logs.split('\n');
  // 处理清空上行逻辑
  // 上移 cursor + 清空整行
  let filteredLogs = enableEraseLineFilter ? filterEraseMultipleLine(splittedLogs) : splittedLogs;
  if (hideEmptyLine) {
    filteredLogs = filteredLogs.map((line) => line.replace('\r', '')).filter((line) => !!line);
  }

  const htmlLogLines = filteredLogs.map((line) => {
    const htmlLog = ansiUp.ansi_to_html(line);

    return htmlLog;
  });
  return htmlLogLines.join('\n');
}
