export function applyChange(origin: string, change: monaco.editor.IModelContentChange) {
  const { rangeLength, rangeOffset, text } = change;
  const next = origin.slice(0, rangeOffset) + text + origin.slice(rangeOffset + rangeLength);
  return next;
}

export function applyChanges(origin: string, stack: Array<monaco.editor.IModelContentChange>) {
  let result = origin;
  stack.forEach((change) => {
    result = applyChange(result, change);
  });
  return result;
}
