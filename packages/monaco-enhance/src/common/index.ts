export interface IFoldedCodeWidgetContentProvider {
  renderInforOverlay: (dom: HTMLDivElement, range: monaco.IRange) => void;
}
