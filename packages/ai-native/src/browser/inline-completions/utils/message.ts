type Colors = 'codefuse.trailingLineBackgroundColor' | 'codefuse.trailingLineForegroundColor';

const MESSAGE_SHOW_TIME_MAX = 3; // message最大显示次数
export let MESSAGE_SHOW_TIME = 0; // message当前显示次数

// const annotationDecoration: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({
//   after: {
//     margin: '0 0 0 3em',
//     textDecoration: 'none',
//   },
//   rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
// });

export const getPromptMessageText = (): string => `Tab 采纳/Esc 取消/${process.platform === 'darwin' ? 'Option' : 'Alt'}+] 下一个`;

/**
 * @desc 显示代码补全批注
 * @param codeType 0 代表代码行，1代表代码块
 * @returns
 */
// export const setPromptMessage = (codeType: number, content: string): void => {

//   // 判断提示显示次数，同步缓存
//   // tokenManager?.setToken('messageShowTimes', 0)
//   if (MESSAGE_SHOW_TIME === 0) MESSAGE_SHOW_TIME = tokenManager?.getToken('messageShowTimes') || 0
//   if (MESSAGE_SHOW_TIME_MAX <= MESSAGE_SHOW_TIME) return

//   const editor = vscode.window.activeTextEditor;

//   if (!editor) return

//   const decoration = {
//     renderOptions: {
//       after: {
//         backgroundColor: new vscode.ThemeColor('codefuse.trailingLineBackgroundColor' satisfies Colors),
//         color: new vscode.ThemeColor('codefuse.trailingLineForegroundColor' satisfies Colors),
//         // color: '#f00',
//         contentText: getPromptMessageText(),
//         fontWeight: 'normal',
//         fontStyle: 'oblique',
//         textDecoration: `none;`,
//       },
//     },
//     range:<any> new vscode.Range(0, 0, 0, 0),
//   }

//   const position = editor.selection.active;

//   // 取代码提示最后一行的空白长度用来设置提示位置
//   const codeContentList = content.split('\n')

//   // 是否使用单行装饰 1: 单行代码补全 2: 多行代码补全类型，但是只返回一行补全代码 3: 光标处于最后一行
//   const isOnlyOneLine = codeType === 0 || codeContentList.length < 2 || position.line === editor.document.lineCount - 1

//   const lastLineLength = codeContentList[codeContentList.length - 1].length
//   const lastLineSpaceLength = lastLineLength - codeContentList[codeContentList.length - 1].replace(/[ ]/g, '').length

//   // let hasBlankRow = codeContentList.length <= 2 && !codeContentList.every(e => e.length > 0)

//   const maxSmallIntegerV8 = 2 ** 40; // 参照gitlen写的，是装饰处于当行最后面

//   const l = isOnlyOneLine ? position.line : position.line + 1 // 在代码片段补全的情况下将装饰设置在光标下一行

//   // 在多行补全的情况下，将装饰放在下一行，再向上移动一行的距离，模拟处于当前行的最下方
//   decoration.renderOptions.after.textDecoration = isOnlyOneLine ? 'none;' : `none;position: absolute;left:${lastLineSpaceLength*8-42}px;top: -22px;`

//   decoration.range = editor.document.validateRange(new vscode.Range(l, maxSmallIntegerV8, l, maxSmallIntegerV8));

//   editor.setDecorations(annotationDecoration, [decoration]);
// }

/**
 * @desc 清除代码补全批注
 */
// export const clearPromptMessage = () => {
//   const editor = vscode.window.activeTextEditor;
//   editor?.setDecorations(annotationDecoration, []);
// }

// export const deleteNote = (type?: boolean) => {

//   if (MESSAGE_SHOW_TIME_MAX <= MESSAGE_SHOW_TIME) return

//   const editor = vscode.window.activeTextEditor;
//   if (editor) {
//     let tt = getPromptMessageText()
//     let lineCount = editor.selection.active.line

//     if (type) {
//       for (let i = 0; i < editor.document.lineCount; i ++) {
//         if (editor.document.lineAt(i).text.includes(tt)) {
//           lineCount = i
//           break
//         }
//       }
//     }

//     const activeLineText = editor.document.lineAt(lineCount).text
//     const preLineText = editor.document.lineAt(lineCount - 1).text

//     if (activeLineText.includes(tt) || lineCount === 0) {
//       if (activeLineText.indexOf(tt) !== 0 && preLineText.length > 0) {
//         var length = tt.length + 10
//         const startChar = activeLineText.length - length > 0 ? activeLineText.length - length : 0
//         var start = new vscode.Position(lineCount, startChar);
//         var end = new vscode.Position(lineCount, activeLineText.length);
//         var range = new vscode.Range(start, end);

//         editor.edit(editBuilder => {
//           editBuilder.delete(range);
//         });
//       } else {
//         const activeLine = lineCount - 2 > 0 ? lineCount - 2 : 0
//         const preLineText = editor.document.lineAt(activeLine).text
//         var start = new vscode.Position(activeLine, preLineText.length);
//         var end = new vscode.Position(lineCount, activeLineText.length);
//         var range = new vscode.Range(start, end);

//         editor.edit(editBuilder => {
//           editBuilder.delete(range);
//         });
//       }
//     }
//   }
// }

// export const returnHandleWithNote = (event: any) => {

//   if (MESSAGE_SHOW_TIME_MAX <= MESSAGE_SHOW_TIME) return

//   if (event.reason === 1 || event.reason === 2) {
//       let change = event.contentChanges[0];
//       let changedText = change.text; // 获取到变化的文本
//       let noteText = getPromptMessageText()
//       if (changedText.includes(noteText)) {
//         if (event.reason === 1) {
//           vscode.commands.executeCommand('undo')
//         } else {
//           deleteNote(true)
//         }
//       }
//   }
// }

export const getMoreStr = (num: number, str: string) => {
  let myString = '';
  for (let i = 0; i < num; i++) {
    myString += str;
  }
  return myString;
};
