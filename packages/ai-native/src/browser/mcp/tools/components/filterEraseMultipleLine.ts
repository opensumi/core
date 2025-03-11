export const ESC = '\u001B[';
export const eraseLine = ESC + '2K';
export const eraseEndLine = ESC + 'K';

export const cursorUp = (count = 1) => ESC + count + 'A';

/**
 * 处理过滤清空上行，清空本行逻辑。
 *
 * 关于清空上 n 行：
 * 一般在日志中，出现覆盖上行的情况，ascii 编码为 2K [1A 2K ...] 1G 的样式。 如 \u001b[2K\u001b[1A\u001b[2K\u001b[1A\u001b[2K\u001b[G\r\n，代表清空上两行。
 * 其中，2K 代表清空整行，1A 代表光标上移，配合下一个 2K 则最终效果为清空上行，而 1G 是移动光标到本行开始（位置 1）。
 * 在日志过滤过程中，可以只处理 1A 2K 这个序列，遇到后把该日志的上一行删掉即可。
 *
 * 关于清空本行，按顺序执行：
 * 1. 在当前行没有 Cursor 操作符（如上移时），匹配最后一个 [2K （清空本行）或 \r[K（指针回 0，再清空本行到末尾，相当于清空本行），只输出 [2K 后的内容，
 * 2. 在当前行没有 Cursor 操作符时且有多个 \r （carriage return charactor，移动光标到行首）时，reduce 按 \r \x1b[G 或 \x1b[1G 切分的片断，不段用后一 part 的部分从头覆盖得出结果。
 */
export default function filterEraseMultipleLine(logs: string[]) {
  // 上移 cursor + 清空整行
  const eraseLastLine = cursorUp(1) + eraseLine;
  const eraseCurrentLine = eraseLine;
  const eraseCurrentLine2 = `\r${eraseEndLine}`;

  const moveCursorToLeftRegStrs = ['\\r', '\\u001b\\[G', '\\u001b\\[1G'];
  const moveCursorToLeftRegStr = new RegExp(`${moveCursorToLeftRegStrs.join('|')}`);

  const filteredLogs = logs.reduce((acc: string[], nowLine) => {
    // 当前清空上行搜索指针
    let pos = 0;
    const step = eraseLastLine.length;

    while (true) {
      pos = nowLine.indexOf(eraseLastLine, pos);
      // 出现清空上行
      if (pos >= 0) {
        pos += step;
        acc.pop();
      } else {
        break;
      }
    }

    // 对单行日志的重写做处理
    // 简单处理，不去解析真正的 Cursor 所在行，否则逻辑过于麻烦
    // 处理 [2K
    let lastErasePos = nowLine.lastIndexOf(eraseCurrentLine);
    if (lastErasePos < 0) {
      // 处理 \r[K
      lastErasePos = nowLine.lastIndexOf(eraseCurrentLine2);
    }
    if (lastErasePos > 0) {
      // 从后向前搜索最后一个清行操作
      nowLine = nowLine.slice(lastErasePos);
    }

    // 处理多 \r 情况，当 \r 连续时，切分出的空字段无用，过滤掉
    const carriageRewrites = nowLine.split(moveCursorToLeftRegStr).filter((part) => !!part);
    if (carriageRewrites.length > 1) {
      nowLine = carriageRewrites.reduce((nextNowLine, nowPart) => {
        const leftPart = nextNowLine.slice(nowPart.length);
        return nowPart + leftPart;
      }, '');
    }

    acc.push(nowLine);
    return acc;
  }, []);

  return filteredLogs;
}
