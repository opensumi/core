import { QuickOpenAction, QuickOpenActionOptions, QuickOpenItem } from '@ali/ide-core-browser';

export abstract class QuickOpenBaseAction implements QuickOpenAction {
  constructor(protected options: QuickOpenActionOptions) {
  }

  get id(): string {
      return this.options.id;
  }

  get label(): string {
      return this.options.label || '';
  }

  set label(value: string) {
      this.options.label = value;
  }

  get tooltip(): string {
      return this.options.tooltip || '';
  }

  set tooltip(value: string) {
      this.options.tooltip = value;
  }

  get class(): string | undefined {
      return this.options.class || '';
  }

  set class(value: string | undefined) {
      this.options.class = value;
  }

  get enabled(): boolean {
      return this.options.enabled || true;
  }

  set enabled(value: boolean) {
      this.options.enabled = value;
  }

  get checked(): boolean {
      return this.options.checked || false;
  }

  set checked(value: boolean) {
      this.options.checked = value;
  }

  get radio(): boolean {
      return this.options.radio || false;
  }

  set radio(value: boolean) {
      this.options.radio = value;
  }

  abstract run(item?: QuickOpenItem): Promise<void>;

  dispose(): void { }
}
