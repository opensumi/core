import { Widget, StackedPanel, SingletonLayout } from '@phosphor/widgets';

export class ActivatorStackedPanelWidget extends Widget {

  constructor(options?: Widget.IOptions) {
    super(options);

    this.stackedPanel = new StackedPanel();
    const layout = new SingletonLayout({fitPolicy: 'set-min-size'});

    layout.widget = this.stackedPanel;

    this.layout = layout;
  }
  readonly stackedPanel: StackedPanel;
}
