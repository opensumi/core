import { Injectable } from '@ali/common-di';
import { IProgressIndicator, IProgressRunner } from '.';

export interface IProgressModel {
  show: boolean;
  worked: number;
  total: number | undefined;
}

@Injectable({ multiple: true })
export class ProgressIndicator implements IProgressIndicator {

  progressModel: IProgressModel = {
    show: false,
    worked: 0,
    total: undefined,
  };

  show(totalOrInfinite: true | number, delay?: number | undefined): IProgressRunner {
    if (totalOrInfinite !== true) {
      this.progressModel.total = totalOrInfinite;
    }
    this.showOnceScheduler(delay);
    return {
      total: (value) => {
        this.progressModel.worked = 0;
        this.progressModel.total = value;
      },
      worked: (value) => {
        if (this.progressModel.total) {
          const worked = Math.max(1, Number(value));
          const fullWorked = Math.min(worked + this.progressModel.worked, this.progressModel.total);
          this.progressModel.worked = fullWorked;
        }
        this.progressModel.show = true;
      },
      done: () => {
        this.doDone(false);
      },
    };
  }

  async showWhile(promise: Promise<unknown>, delay?: number | undefined): Promise<void> {
    this.progressModel.total = undefined;
    this.showOnceScheduler(delay);
    this.progressModel.show = true;
    await promise;
    this.doDone(true);
  }

  private scheduled: NodeJS.Timeout;
  private showOnceScheduler(delay?: number) {
    if (typeof delay === 'number') {
      clearTimeout(this.scheduled);
      this.scheduled = setTimeout(() => {
        this.progressModel.show = true;
      }, delay);
    } else {
      this.progressModel.show = true;
    }
  }

  private doDone(delayed?: boolean) {
    if (this.progressModel.total) {
      // 进度100%随后隐藏
      this.progressModel.worked = this.progressModel.total;
      if (delayed) {
        setTimeout(() => this.off(), 200);
      } else {
        this.off();
      }
    } else {
      // 通过css淡出隐藏
      if (delayed) {
        setTimeout(() => this.off(), 200);
      } else {
        this.off();
      }
    }
  }

  private off() {
    this.progressModel.total = undefined;
    this.progressModel.worked = 0;
    this.progressModel.show = false;
  }
}
