import { useState, useCallback } from 'react';
import keycode from 'keycode';

// todo: hotkeys 增加类型提示
// 键位值请查看 https://github.com/timoxley/keycode
export const useHotKey = (hotkeys: string[], handler: () => void): {
  onKeyDown: (keyCode: number) => void;
  onKeyUp: () => void;
} => {
  // 初始化函数
  const initializer = useCallback(() => {
    return hotkeys.reduce((prev, key) => {
      const keycodeNum = keycode(key);
      if (typeof keycodeNum === 'number') {
        prev[keycodeNum] = false;
      }
      return prev;
    }, {});
  }, [ hotkeys ]);

  const [keyPressRecords, setKeyPressRecords] = useState<{
    [key: string]: boolean;
  }>(initializer);

  function onKeyDown(keyCode: number) {
    setKeyPressRecords((r) => {
      if (keyCode in r) {
        return { ...r, [keyCode]: true };
      }
      return r;
    });
  }

  function onKeyUp() {
    // 快捷键匹配触发
    if (Object.values(keyPressRecords).every((n) => n === true)) {
      handler();
    }

    // reset value
    setKeyPressRecords((r) => {
      return Object.keys(keyPressRecords).reduce((prev, keyNum) => {
        prev[keyNum] = false;
        return prev;
      }, {});
    });
  }

  return {
    onKeyDown,
    onKeyUp,
  };
};
