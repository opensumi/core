import { observable, action } from 'mobx';

import { Injectable } from '@opensumi/di';

import { IProgressIndicator, IProgressRunner, IProgressModel } from '.';

@Injectable({ multiple: true })
export class ProgressIndicator implements IProgressIndicator {
  @observable
  public progressModel: IProgressModel = {
    show: false,
    fade: false,
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
        this.doDone(true);
      },
    };
  }

  async showWhile(promise: Promise<unknown>, delay?: number | undefined): Promise<void> {
    this.progressModel.total = undefined;
    this.showOnceScheduler(delay);
    await promise;
    this.doDone(false);
  }

  private scheduled: NodeJS.Timer;
  private showOnceScheduler(delay?: number) {
    if (typeof delay === 'number') {
      clearTimeout(this.scheduled);
      this.scheduled = global.setTimeout(this.on, delay);
    } else {
      this.on();
    }
  }

  private doDone(delayed?: boolean) {
    this.progressModel.fade = true;
    if (this.progressModel.total) {
      // 进度100%随后隐藏
      this.progressModel.worked = this.progressModel.total;
      if (delayed) {
        global.setTimeout(this.off, 800);
      } else {
        this.off();
      }
    } else {
      // 通过css淡出隐藏
      if (delayed) {
        global.setTimeout(this.off, 800);
      } else {
        this.off();
      }
    }
  }

  @action.bound
  private off() {
    this.progressModel.total = undefined;
    this.progressModel.worked = 0;
    this.progressModel.show = false;
    this.progressModel.fade = false;
  }

  @action.bound
  private on() {
    this.progressModel.show = true;
  }
}
