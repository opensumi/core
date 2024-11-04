import { Injectable } from '@opensumi/di';
import { observableValue, transaction } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/base';

import { IProgressIndicator, IProgressRunner } from '.';

@Injectable({ multiple: true })
export class ProgressIndicator implements IProgressIndicator {
  public readonly progressModel = {
    show: observableValue<boolean>(this, false),
    fade: observableValue<boolean>(this, false),
    worked: observableValue<number>(this, 0),
    total: observableValue<number | undefined>(this, undefined),
  };

  show(totalOrInfinite: true | number, delay?: number | undefined): IProgressRunner {
    if (totalOrInfinite !== true) {
      transaction((tx) => {
        this.progressModel.total.set(totalOrInfinite, tx);
      });
    }
    this.showOnceScheduler(delay);
    return {
      total: (value) => {
        transaction((tx) => {
          this.progressModel.worked.set(0, tx);
          this.progressModel.total.set(value, tx);
        });
      },
      worked: (value) => {
        transaction((tx) => {
          if (this.progressModel.total.get()) {
            const worked = Math.max(1, Number(value));
            const fullWorked = Math.min(worked + this.progressModel.worked.get(), this.progressModel.total.get()!);
            this.progressModel.worked.set(fullWorked, tx);
          }
          this.progressModel.show.set(true, tx);
        });
      },
      done: () => {
        this.doDone(true);
      },
    };
  }

  async showWhile(promise: Promise<unknown>, delay?: number | undefined): Promise<void> {
    transaction((tx) => {
      this.progressModel.total.set(undefined, tx);
    });

    this.showOnceScheduler(delay);
    await promise;
    this.doDone(false);
  }

  private scheduled: NodeJS.Timeout;
  private showOnceScheduler(delay?: number) {
    if (typeof delay === 'number') {
      clearTimeout(this.scheduled);
      this.scheduled = setTimeout(() => this.on(), delay);
    } else {
      this.on();
    }
  }

  private doDone(delayed?: boolean) {
    transaction((tx) => {
      this.progressModel.fade.set(true, tx);
    });

    if (this.progressModel.total.get()) {
      // 进度100%随后隐藏
      transaction((tx) => {
        this.progressModel.worked.set(this.progressModel.total.get()!, tx);
      });

      if (delayed) {
        setTimeout(this.off, 800);
      } else {
        this.off();
      }
    } else {
      // 通过css淡出隐藏
      if (delayed) {
        setTimeout(this.off, 800);
      } else {
        this.off();
      }
    }
  }

  private off() {
    transaction((tx) => {
      this.progressModel.total.set(undefined, tx);
      this.progressModel.worked.set(0, tx);
      this.progressModel.show.set(false, tx);
      this.progressModel.fade.set(false, tx);
    });
  }

  private on() {
    transaction((tx) => {
      this.progressModel.show.set(true, tx);
    });
  }
}
