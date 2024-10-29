export const DELEGATE_COMMANDS = {
  UNDO: 'undo',
  REDO: 'redo',
  SELECT_ALL: 'editor.action.selectAll',
};

// 不卸载 Monaco 内默认快捷键的命令白名单
export const SKIP_UNREGISTER_MONACO_KEYBINDINGS = ['acceptRenameInput', 'acceptRenameInputWithPreview'];
