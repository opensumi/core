import cls from 'classnames';
import * as React from 'react';

import { Popover, PopoverPosition, Select, getIcon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { URI } from '@opensumi/ide-utils';

import styles from './mention-input.module.less';
import { MentionPanel } from './mention-panel';
import { FooterButtonPosition, MENTION_KEYWORD, MentionInputProps, MentionItem, MentionState } from './types';

export const WHITE_SPACE_TEXT = '&nbsp;';

export const MentionInput: React.FC<MentionInputProps> = ({
  mentionItems = [],
  onSend,
  onStop,
  loading = false,
  mentionKeyword = MENTION_KEYWORD,
  onSelectionChange,
  onImageUpload,
  labelService,
  workspaceService,
  placeholder = 'Ask anything, @ to mention',
  footerConfig = {
    buttons: [],
    showModelSelector: false,
  },
}) => {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [mentionState, setMentionState] = React.useState<MentionState>({
    active: false,
    startPos: null,
    filter: '',
    position: { top: 0, left: 0 },
    activeIndex: 0,
    level: 0, // 0: 一级菜单, 1: 二级菜单
    parentType: null, // 二级菜单的父类型
    secondLevelFilter: '', // 二级菜单的筛选文本
    inlineSearchActive: false, // 是否在输入框中进行二级搜索
    inlineSearchStartPos: null, // 内联搜索的起始位置
    loading: false, // 添加加载状态
  });

  // 添加模型选择状态
  const [selectedModel, setSelectedModel] = React.useState<string>(footerConfig.defaultModel || '');

  // 添加缓存状态，用于存储二级菜单项
  const [secondLevelCache, setSecondLevelCache] = React.useState<Record<string, MentionItem[]>>({});

  // 添加历史记录状态
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);
  const [currentInput, setCurrentInput] = React.useState<string>('');
  const [isNavigatingHistory, setIsNavigatingHistory] = React.useState<boolean>(false);

  // 获取当前菜单项
  const getCurrentItems = (): MentionItem[] => {
    if (mentionState.level === 0) {
      return mentionItems;
    } else if (mentionState.parentType) {
      // 如果正在加载，返回缓存的项目
      if (mentionState.loading) {
        return secondLevelCache[mentionState.parentType] || [];
      }

      // 返回缓存的项目
      return secondLevelCache[mentionState.parentType] || [];
    }
    return [];
  };

  // 添加防抖函数
  const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

    React.useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };

  // 使用防抖处理搜索文本
  const debouncedSecondLevelFilter = useDebounce(mentionState.secondLevelFilter, 300);

  React.useEffect(() => {
    setSelectedModel(footerConfig.defaultModel || '');
  }, [footerConfig.defaultModel]);

  // 监听搜索文本变化，实时更新二级菜单
  React.useEffect(() => {
    if (mentionState.level === 1 && mentionState.parentType && debouncedSecondLevelFilter !== undefined) {
      // 查找父级菜单项
      const parentItem = mentionItems.find((item) => item.id === mentionState.parentType);
      if (!parentItem) {
        return;
      }

      // 设置加载状态
      setMentionState((prev) => ({ ...prev, loading: true }));

      // 异步加载
      const fetchItems = async () => {
        try {
          // 首先显示高优先级项目（如果有）
          const items: MentionItem[] = [];
          if (parentItem.getHighestLevelItems) {
            const highestLevelItems = parentItem.getHighestLevelItems();
            for (const item of highestLevelItems) {
              if (!items.some((i) => i.id === item.id)) {
                items.push(item);
              }
            }
            // 立即更新缓存，显示高优先级项目
            setSecondLevelCache((prev) => ({
              ...prev,
              [mentionState.parentType!]: highestLevelItems,
            }));
          }

          // 然后异步加载更多项目
          if (parentItem.getItems) {
            try {
              // 获取子菜单项
              const newItems = await parentItem.getItems(debouncedSecondLevelFilter);

              // 去重合并
              const combinedItems: MentionItem[] = [...items];

              for (const item of newItems) {
                if (!combinedItems.some((i) => i.id === item.id)) {
                  combinedItems.push(item);
                }
              }

              // 更新缓存
              setSecondLevelCache((prev) => ({
                ...prev,
                [mentionState.parentType!]: combinedItems,
              }));
            } catch (error) {
              // 如果异步加载失败，至少保留高优先级项目
              setMentionState((prev) => ({ ...prev, loading: false }));
            }
          }

          // 最后清除加载状态
          setMentionState((prev) => ({ ...prev, loading: false }));
        } catch (error) {
          setMentionState((prev) => ({ ...prev, loading: false }));
        }
      };

      fetchItems();
    }
  }, [debouncedSecondLevelFilter, mentionState.level, mentionState.parentType]);

  // 获取光标位置
  const getCursorPosition = (element: HTMLElement): number => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return 0;
    }

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
  };

  // 处理输入事件
  const handleInput = () => {
    // 如果用户开始输入，退出历史导航模式
    if (isNavigatingHistory) {
      setIsNavigatingHistory(false);
      setHistoryIndex(-1);
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) {
      return;
    }

    const text = editorRef.current.textContent || '';
    const cursorPos = getCursorPosition(editorRef.current);

    // 判断是否刚输入了 @
    if (text[cursorPos - 1] === mentionKeyword && !mentionState.active && !mentionState.inlineSearchActive) {
      setMentionState({
        active: true,
        startPos: cursorPos,
        filter: mentionKeyword,
        position: { top: 0, left: 0 }, // 固定位置，不再需要动态计算
        activeIndex: 0,
        level: 0,
        parentType: null,
        secondLevelFilter: '',
        inlineSearchActive: false,
        inlineSearchStartPos: null,
        loading: false,
      });
    }

    // 如果已激活提及面板且在一级菜单，更新过滤内容
    if (mentionState.active && mentionState.level === 0 && mentionState.startPos !== null) {
      if (cursorPos < mentionState.startPos) {
        // 如果光标移到了 @ 之前，关闭面板
        setMentionState((prev) => ({ ...prev, active: false }));
      } else {
        const newFilter = text.substring(mentionState.startPos - 1, cursorPos);
        setMentionState((prev) => ({
          ...prev,
          filter: newFilter,
          activeIndex: 0,
        }));
      }
    }

    // 如果在输入框中进行二级搜索
    if (mentionState.inlineSearchActive && mentionState.inlineSearchStartPos !== null && mentionState.parentType) {
      // 获取父级类型
      const parentItem = mentionItems.find((i) => i.id === mentionState.parentType);
      if (!parentItem) {
        return;
      }

      // 检查光标是否在 @type: 之后
      const typePrefix = `@${parentItem.type}:`;
      const prefixPos = mentionState.inlineSearchStartPos - typePrefix.length;

      if (prefixPos >= 0 && cursorPos > prefixPos + typePrefix.length) {
        // 提取搜索文本
        const searchText = text.substring(prefixPos + typePrefix.length, cursorPos);

        // 只有当搜索文本变化时才更新状态
        if (searchText !== mentionState.secondLevelFilter) {
          setMentionState((prev) => ({
            ...prev,
            secondLevelFilter: searchText,
            active: true,
            activeIndex: 0,
          }));
        }
      } else if (cursorPos <= prefixPos) {
        // 如果光标移到了 @type: 之前，关闭内联搜索
        setMentionState((prev) => ({
          ...prev,
          inlineSearchActive: false,
          active: false,
        }));
      }
    }

    // 检查输入框高度，如果超过最大高度则添加滚动条
    if (editorRef.current) {
      const editorHeight = editorRef.current.scrollHeight;
      if (editorHeight > 120) {
        editorRef.current.style.overflowY = 'auto';
      } else {
        editorRef.current.style.overflowY = 'hidden';
      }
    }

    // 检查编辑器内容，处理只有 <br> 标签的情况
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      // 如果内容为空或只有 <br> 标签
      if (content === '' || content === '<br>' || content === '<br/>') {
        // 清空编辑器内容
        editorRef.current.innerHTML = '';
      }
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 如果按下ESC键且提及面板处于活动状态或内联搜索处于活动状态
    if (e.key === 'Escape' && (mentionState.active || mentionState.inlineSearchActive)) {
      // 如果在二级菜单，返回一级菜单
      if (mentionState.level > 0) {
        setMentionState((prev) => ({
          ...prev,
          level: 0,
          activeIndex: 0,
          secondLevelFilter: '',
          inlineSearchActive: false,
        }));
      } else {
        // 如果在一级菜单，完全关闭面板
        setMentionState((prev) => ({
          ...prev,
          active: false,
          inlineSearchActive: false,
        }));
      }
      e.preventDefault();
      return;
    }

    // 添加对 @ 键的监听，支持在任意位置触发菜单
    if (e.key === MENTION_KEYWORD && !mentionState.active && !mentionState.inlineSearchActive && editorRef.current) {
      const cursorPos = getCursorPosition(editorRef.current);

      // 立即设置菜单状态，不等待 handleInput
      setMentionState({
        active: true,
        startPos: cursorPos + 1, // +1 因为 @ 还没有被插入
        filter: mentionKeyword,
        position: { top: 0, left: 0 }, // 固定位置
        activeIndex: 0,
        level: 0,
        parentType: null,
        secondLevelFilter: '',
        inlineSearchActive: false,
        inlineSearchStartPos: null,
        loading: false,
      });
    }

    // 处理上下方向键导航历史记录
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // 只有在非提及面板激活状态下才处理历史导航
      if (!mentionState.active && !mentionState.inlineSearchActive && editorRef.current && history.length > 0) {
        const currentContent = editorRef.current.innerHTML;

        // 检查是否应该触发历史导航
        const shouldTriggerHistory =
          // 当前内容为空
          !currentContent ||
          currentContent === '<br>' ||
          // 或者当前内容与历史记录中的某一项匹配（正在浏览历史）
          (isNavigatingHistory && historyIndex >= 0 && history[history.length - 1 - historyIndex] === currentContent);

        if (shouldTriggerHistory) {
          e.preventDefault();

          // 如果是第一次按上下键，保存当前输入
          if (!isNavigatingHistory) {
            setCurrentInput(currentContent);
            setIsNavigatingHistory(true);
          }

          // 计算新的历史索引
          let newIndex = historyIndex;
          if (e.key === 'ArrowUp') {
            // 向上导航到较早的历史记录
            newIndex = Math.min(history.length - 1, historyIndex + 1);
          } else {
            // 向下导航到较新的历史记录
            newIndex = Math.max(-1, historyIndex - 1);
          }

          setHistoryIndex(newIndex);

          // 更新编辑器内容
          if (newIndex === -1) {
            // 恢复到当前输入
            editorRef.current.innerHTML = currentInput;
          } else {
            // 显示历史记录
            editorRef.current.innerHTML = history[history.length - 1 - newIndex];
          }

          // 将光标移到末尾
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }

          return;
        }
      }
    } else if (isNavigatingHistory && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
      // 如果用户在浏览历史记录后开始输入其他内容，退出历史导航模式
      setIsNavigatingHistory(false);
      setHistoryIndex(-1);
    }

    // 添加对 Enter 键的处理，只有在按下 Shift+Enter 时才允许换行
    if (e.key === 'Enter') {
      // 检查是否是输入法的回车键
      if (e.nativeEvent.isComposing) {
        return; // 如果是输入法组合输入过程中的回车，不做任何处理
      }

      if (!e.shiftKey) {
        e.preventDefault();
        if (!mentionState.active) {
          handleSend();
          return;
        }
      }
    }

    // 如果提及面板未激活，不处理其他键盘事件
    if (!mentionState.active) {
      return;
    }

    // 获取当前过滤后的项目
    let filteredItems = getCurrentItems();

    // 一级菜单过滤
    if (mentionState.level === 0 && mentionState.filter && mentionState.filter.length > 1) {
      const searchText = mentionState.filter.substring(1).toLowerCase();
      filteredItems = filteredItems.filter((item) => item.text.toLowerCase().includes(searchText));
    }

    if (filteredItems.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      // 向下导航
      setMentionState((prev) => ({
        ...prev,
        activeIndex: (prev.activeIndex + 1) % filteredItems.length,
      }));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      // 向上导航
      setMentionState((prev) => ({
        ...prev,
        activeIndex: (prev.activeIndex - 1 + filteredItems.length) % filteredItems.length,
      }));
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      // 确认选择
      if (filteredItems.length > 0) {
        handleSelectItem(filteredItems[mentionState.activeIndex]);
        e.preventDefault();
      }
    }
  };

  // 添加对输入法事件的处理
  const handleCompositionEnd = () => {
    // 输入法输入完成后的处理
    // 这里可以添加额外的逻辑，如果需要的话
  };

  // 添加粘贴事件处理
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;

    // 先收集所有图片文件
    const imageFiles: File[] = [];
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    e.preventDefault();

    // 处理所有收集到的图片
    if (imageFiles.length > 0 && onImageUpload) {
      await onImageUpload(imageFiles);
      return;
    }

    const text = e.clipboardData.getData('text/plain');

    // 处理文本，保留换行和缩进
    const processedText = text
      .replace(/\t/g, '    ')
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/[ \t]+$/gm, '');

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    // 将处理后的文本按行分割
    const lines = processedText.split('\n');
    const fragment = document.createDocumentFragment();

    lines.forEach((line, index) => {
      // 处理行首空格，将每个空格转换为 &nbsp;
      const processedLine = line.replace(/^[ ]+/g, (match) => {
        const span = document.createElement('span');
        span.innerHTML = '\u00A0'.repeat(match.length);
        return span.innerHTML;
      });

      // 创建一个临时容器来保持 HTML 内容
      const container = document.createElement('span');
      container.innerHTML = processedLine;

      // 将容器的内容添加到文档片段
      while (container.firstChild) {
        fragment.appendChild(container.firstChild);
      }

      // 如果不是最后一行，添加换行符
      if (index < lines.length - 1) {
        fragment.appendChild(document.createElement('br'));
      }
    });

    // 插入处理后的内容
    range.insertNode(fragment);

    // 将光标移动到插入内容的末尾
    range.setStartAfter(fragment);
    range.setEndAfter(fragment);
    selection.removeAllRanges();
    selection.addRange(range);

    // 触发 input 事件以更新状态
    handleInput();
  };

  // 初始化编辑器
  React.useEffect(() => {
    if (editorRef.current) {
      // 设置初始占位符
      if (placeholder && !editorRef.current.textContent) {
        editorRef.current.setAttribute('data-placeholder', placeholder);
      }
    }
  }, [placeholder]);

  // 处理点击事件
  const handleDocumentClick = (e: MouseEvent) => {
    if (mentionState.active && !document.querySelector(`.${styles.mention_panel}`)?.contains(e.target as Node)) {
      setMentionState((prev) => ({
        ...prev,
        active: false,
        inlineSearchActive: false,
      }));
    }
  };

  // 添加和移除全局点击事件监听器
  React.useEffect(() => {
    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [mentionState.active]);

  // 选择提及项目
  const handleSelectItem = (item: MentionItem, isTriggerByClick = false) => {
    if (!editorRef.current) {
      return;
    }

    // 如果项目有子菜单，进入二级菜单
    if (item.getItems) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        return;
      }

      // 如果是从一级菜单选择了带子菜单的项目
      if (mentionState.level === 0 && mentionState.startPos !== null) {
        // 更安全地处理文本替换
        let textNode;
        let startOffset;
        let endOffset;

        // 找到包含 @ 符号的文本节点
        const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
        let charCount = 0;
        let node;

        while ((node = walker.nextNode())) {
          const nodeLength = node.textContent?.length || 0;

          // 检查 @ 符号是否在这个节点中
          if (mentionState.startPos - 1 >= charCount && mentionState.startPos - 1 < charCount + nodeLength) {
            textNode = node;
            startOffset = mentionState.startPos - 1 - charCount;

            // 确保不会超出节点范围
            const cursorPos = isTriggerByClick
              ? mentionState.startPos + mentionState.filter.length - 1
              : getCursorPosition(editorRef.current);
            endOffset = Math.min(cursorPos - charCount, nodeLength);
            break;
          }

          charCount += nodeLength;
        }

        if (textNode) {
          // 创建一个新的范围来替换文本
          const tempRange = document.createRange();
          tempRange.setStart(textNode, startOffset);
          tempRange.setEnd(textNode, endOffset);

          // 替换为 @type:
          tempRange.deleteContents();
          const typePrefix = document.createTextNode(`${mentionKeyword}${item.type}:`);
          tempRange.insertNode(typePrefix);

          // 将光标移到 @type: 后面
          const newRange = document.createRange();
          newRange.setStartAfter(typePrefix);
          newRange.setEndAfter(typePrefix);
          selection.removeAllRanges();
          selection.addRange(newRange);
          // 激活内联搜索模式
          setMentionState((prev) => ({
            ...prev,
            active: true,
            level: 1,
            parentType: item.id,
            inlineSearchActive: true,
            inlineSearchStartPos: getCursorPosition(editorRef.current as HTMLElement),
            secondLevelFilter: '',
            activeIndex: 0,
          }));
          editorRef.current.focus();
          return;
        }
      }

      return;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return;
    }

    // 如果是在内联搜索模式下选择项目
    if (mentionState.inlineSearchActive && mentionState.parentType && mentionState.inlineSearchStartPos !== null) {
      // 找到 @type: 的位置
      const parentItem = mentionItems.find((i) => i.id === mentionState.parentType);
      if (!parentItem) {
        return;
      }

      const typePrefix = `${mentionKeyword}${parentItem.type}:`;
      const prefixPos = mentionState.inlineSearchStartPos - typePrefix.length;

      if (prefixPos >= 0) {
        // 创建一个带样式的提及标签
        const mentionTag = document.createElement('span');
        mentionTag.className = styles.mention_tag;
        mentionTag.dataset.id = item.id;
        mentionTag.dataset.type = item.type;
        mentionTag.dataset.contextId = item.contextId || '';
        mentionTag.contentEditable = 'false';

        // 为 file 和 folder 类型添加图标
        if (item.type === 'file' || item.type === 'folder') {
          // 创建图标容器
          const iconSpan = document.createElement('span');
          iconSpan.className = cls(
            styles.mention_icon,
            item.type === 'file' ? labelService?.getIcon(new URI(item.text)) : getIcon('folder'),
          );
          mentionTag.appendChild(iconSpan);
        }
        const workspace = workspaceService?.workspace;
        let relativePath = item.text;
        if (workspace && item.contextId) {
          relativePath = item.contextId.replace(new URI(workspace.uri).codeUri.fsPath, '').slice(1);
        }
        // 创建文本内容容器
        const textSpan = document.createTextNode(relativePath);
        mentionTag.appendChild(textSpan);

        // 创建一个范围从 @type: 开始到当前光标
        const tempRange = document.createRange();

        // 定位到 @type: 的位置
        let charIndex = 0;
        let foundStart = false;
        const textNodes: Array<{ node: Node; start: number; end: number }> = [];

        function findPosition(node: Node) {
          if (node.nodeType === 3) {
            // 文本节点
            textNodes.push({
              node,
              start: charIndex,
              end: charIndex + node.textContent!.length,
            });
            charIndex += node.textContent!.length;
          } else if (node.nodeType === 1) {
            // 元素节点
            const children = node.childNodes || [];
            for (const child of Array.from(children)) {
              findPosition(child);
            }
          }
        }

        findPosition(editorRef.current);

        for (const textNode of textNodes) {
          if (prefixPos >= textNode.start && prefixPos <= textNode.end) {
            const startOffset = prefixPos - textNode.start;
            tempRange.setStart(textNode.node, startOffset);
            foundStart = true;
          }

          if (foundStart) {
            // 如果是点击触发，使用过滤文本的长度来确定结束位置
            const cursorPos = isTriggerByClick
              ? prefixPos + typePrefix.length + mentionState.secondLevelFilter.length
              : getCursorPosition(editorRef.current);

            if (cursorPos >= textNode.start && cursorPos <= textNode.end) {
              const endOffset = cursorPos - textNode.start;
              tempRange.setEnd(textNode.node, endOffset);
              break;
            }
          }
        }

        if (foundStart) {
          tempRange.deleteContents();
          tempRange.insertNode(mentionTag);

          // 将光标移到提及标签后面
          const newRange = document.createRange();
          newRange.setStartAfter(mentionTag);
          newRange.setEndAfter(mentionTag);
          selection.removeAllRanges();
          selection.addRange(newRange);

          // 添加一个空格，增加间隔
          const spaceNode = document.createTextNode('\u00A0'); // 使用不间断空格
          newRange.insertNode(spaceNode);
          newRange.setStartAfter(spaceNode);
          newRange.setEndAfter(spaceNode);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }

        setMentionState((prev) => ({
          ...prev,
          active: false,
          inlineSearchActive: false,
        }));
        editorRef.current.focus();
        return;
      }
    }

    // 原有的处理逻辑（用于非内联搜索情况）
    // 创建一个带样式的提及标签
    const mentionTag = document.createElement('span');
    mentionTag.className = styles.mention_tag;
    mentionTag.dataset.id = item.id;
    mentionTag.dataset.type = item.type;
    mentionTag.dataset.contextId = item.contextId || '';
    mentionTag.contentEditable = 'false';

    // 为 file 和 folder 类型添加图标
    if (item.type === 'file' || item.type === 'folder') {
      // 创建图标容器
      const iconSpan = document.createElement('span');
      iconSpan.className = cls(
        styles.mention_icon,
        item.type === 'file' ? labelService?.getIcon(new URI(item.text)) : getIcon('folder'),
      );
      mentionTag.appendChild(iconSpan);
    }
    const workspace = workspaceService?.workspace;
    let relativePath = item.text;
    if (workspace && item.contextId) {
      relativePath = item.contextId.replace(new URI(workspace.uri).codeUri.fsPath, '').slice(1);
    }
    // 创建文本内容容器
    const textSpan = document.createTextNode(relativePath);
    mentionTag.appendChild(textSpan);

    // 定位到 @ 符号的位置
    let charIndex = 0;
    let foundStart = false;
    const textNodes: Array<{ node: Node; start: number; end: number }> = [];

    function findPosition(node: Node) {
      if (node.nodeType === 3) {
        // 文本节点
        textNodes.push({
          node,
          start: charIndex,
          end: charIndex + node.textContent!.length,
        });
        charIndex += node.textContent!.length;
      } else if (node.nodeType === 1) {
        // 元素节点
        const children = node.childNodes;
        for (const child of Array.from(children)) {
          findPosition(child);
        }
      }
    }

    findPosition(editorRef.current);

    const tempRange = document.createRange();

    if (mentionState.startPos !== null) {
      for (const textNode of textNodes) {
        if (mentionState.startPos - 1 >= textNode.start && mentionState.startPos - 1 <= textNode.end) {
          const startOffset = mentionState.startPos - 1 - textNode.start;
          tempRange.setStart(textNode.node, startOffset);
          foundStart = true;
        }

        if (foundStart) {
          // 如果是点击触发，使用过滤文本的长度来确定结束位置
          const cursorPos = isTriggerByClick
            ? mentionState.startPos + mentionState.filter.length - 1
            : getCursorPosition(editorRef.current);

          if (cursorPos >= textNode.start && cursorPos <= textNode.end) {
            const endOffset = cursorPos - textNode.start;
            tempRange.setEnd(textNode.node, endOffset);
            break;
          }
        }
      }
    }

    if (foundStart) {
      tempRange.deleteContents();
      tempRange.insertNode(mentionTag);

      // 将光标移到提及标签后面
      const newRange = document.createRange();
      newRange.setStartAfter(mentionTag);
      newRange.setEndAfter(mentionTag);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // 添加一个空格，增加间隔
      const spaceNode = document.createTextNode('\u00A0'); // 使用不间断空格
      newRange.insertNode(spaceNode);
      newRange.setStartAfter(spaceNode);
      newRange.setEndAfter(spaceNode);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    setMentionState((prev) => ({ ...prev, active: false }));
    editorRef.current.focus();
  };

  // 处理模型选择变更
  const handleModelChange = React.useCallback(
    (value: string) => {
      setSelectedModel(value);
      onSelectionChange?.(value);
    },
    [selectedModel, onSelectionChange],
  );

  // 修改 handleSend 函数
  const handleSend = () => {
    if (!editorRef.current) {
      return;
    }

    // 获取原始HTML内容
    const rawContent = editorRef.current.innerHTML;
    if (!rawContent) {
      return;
    }

    // 创建一个临时元素来处理内容
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawContent;

    // 查找所有提及标签并替换为对应的contextId
    const mentionTags = tempDiv.querySelectorAll(`.${styles.mention_tag}`);
    mentionTags.forEach((tag) => {
      const contextId = tag.getAttribute('data-context-id');
      if (contextId) {
        // 替换为contextId
        const replacement = document.createTextNode(
          `{{${mentionKeyword}${tag.getAttribute('data-type')}:${contextId}}}`,
        );
        // 替换内容
        tag.parentNode?.replaceChild(replacement, tag);
      }
    });

    // 获取处理后的内容
    let processedContent = tempDiv.innerHTML;
    processedContent = processedContent.trim().replaceAll(WHITE_SPACE_TEXT, ' ');
    // 添加到历史记录
    if (rawContent) {
      setHistory((prev) => [...prev, rawContent]);
      // 重置历史导航状态
      setHistoryIndex(-1);
      setIsNavigatingHistory(false);
    }

    if (onSend) {
      // 传递当前选择的模型和其他配置信息
      onSend(processedContent, {
        model: selectedModel,
        ...footerConfig,
      });
    }

    editorRef.current.innerHTML = '';

    // 重置编辑器高度和滚动条
    if (editorRef.current) {
      editorRef.current.style.overflowY = 'hidden';
      editorRef.current.style.height = 'auto';
    }
  };

  const handleStop = React.useCallback(() => {
    if (onStop) {
      onStop();
    }
  }, [onStop]);

  // 渲染自定义按钮
  const renderButtons = React.useCallback(
    (position: FooterButtonPosition) =>
      (footerConfig.buttons || [])
        .filter((button) => button.position === position)
        .map((button) => (
          <Popover
            key={button.id}
            overlayClassName={styles.popover_icon}
            id={`ai-chat-${button.id}`}
            position={PopoverPosition.top}
            title={button.title}
          >
            <EnhanceIcon
              className={cls(button.icon ? getIcon(button.icon) : button.iconClass, styles[`${button.id}_logo`])}
              tabIndex={0}
              role='button'
              ariaLabel={button.title}
              onClick={button.onClick}
            />
          </Popover>
        )),
    [footerConfig.buttons],
  );

  return (
    <div className={styles.input_container}>
      {mentionState.active && (
        <div className={styles.mention_panel_container}>
          <MentionPanel
            items={getCurrentItems()}
            activeIndex={mentionState.activeIndex}
            onSelectItem={(item) => handleSelectItem(item, true)}
            position={{ top: 0, left: 0 }}
            filter={mentionState.level === 0 ? mentionState.filter : mentionState.secondLevelFilter}
            visible={true}
            level={mentionState.level}
            loading={mentionState.loading}
          />
        </div>
      )}
      <div className={styles.editor_area}>
        <div
          ref={editorRef}
          className={styles.editor}
          contentEditable={true}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionEnd={handleCompositionEnd}
        />
      </div>
      <div className={styles.footer}>
        <div className={styles.left_control}>
          {footerConfig.showModelSelector && (
            <Select
              options={footerConfig.modelOptions || []}
              value={selectedModel}
              onChange={handleModelChange}
              className={styles.model_selector}
              size='small'
              disabled={footerConfig.disableModelSelector}
            />
          )}
          {renderButtons(FooterButtonPosition.LEFT)}
        </div>
        <div className={styles.right_control}>
          {renderButtons(FooterButtonPosition.RIGHT)}
          <Popover
            overlayClassName={styles.popover_icon}
            id={'ai-chat-send'}
            position={PopoverPosition.top}
            content={!loading ? 'Send' : 'Stop'}
          >
            {!loading ? (
              <EnhanceIcon
                wrapperClassName={styles.send_logo}
                className={cls(getIcon('send-outlined'), styles.send_logo_icon)}
                tabIndex={0}
                role='button'
                onClick={handleSend}
                ariaLabel={'Send'}
              />
            ) : (
              <EnhanceIcon
                wrapperClassName={styles.stop_logo}
                className={cls(getIcon('stop'), styles.stop_logo_icon)}
                tabIndex={0}
                role='button'
                ariaLabel={'Stop'}
                onClick={handleStop}
              />
            )}
          </Popover>
        </div>
      </div>
    </div>
  );
};
