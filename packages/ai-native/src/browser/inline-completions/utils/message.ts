export const MESSAGE_SHOW_TIME = 0; // message 当前显示次数

export const getPromptMessageText = (): string =>
  `Tab 采纳/Esc 取消/${process.platform === 'darwin' ? 'Option' : 'Alt'}+] 下一个`;

export const getMoreStr = (num: number, str: string) => {
  let myString = '';
  for (let i = 0; i < num; i++) {
    myString += str;
  }
  return myString;
};
