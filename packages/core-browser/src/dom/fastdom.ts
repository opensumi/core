import { Heap, IDisposable, onUnexpectedError } from '@opensumi/ide-utils';

class DomOpeartion {
  private _canceled: boolean;

  constructor(protected _runner: () => void, public priority: number) {}

  run() {
    if (this._canceled) {
      return;
    }

    try {
      this._runner();
    } catch (error) {
      onUnexpectedError(error);
    }
  }

  dispose() {
    this._canceled = true;
  }
}

const aQueue = new Heap<DomOpeartion>({
  comparator: (a, b) => b.priority - a.priority,
});

const bQueue = new Heap<DomOpeartion>({
  comparator: (a, b) => b.priority - a.priority,
});

let runningQueue = aQueue;
let nextQueue = bQueue;

function swapQueue() {
  if (runningQueue === aQueue) {
    runningQueue = bQueue;
    nextQueue = aQueue;
  } else {
    runningQueue = aQueue;
    nextQueue = bQueue;
  }
}

let currentFlushHandle: number | undefined;
let inAnimationFrame = false;

function flush() {
  currentFlushHandle = undefined;

  inAnimationFrame = true;

  swapQueue();

  while (runningQueue.size > 0) {
    const op = runningQueue.pop()!;
    op.run();
  }

  inAnimationFrame = false;
}

function schedule() {
  if (currentFlushHandle) {
    return;
  }

  currentFlushHandle = requestAnimationFrame(flush);
}

/**
 * 如果当前在动画帧中，将操作加入当前队列，否则加入下一帧队列
 */
function runAtThisOrScheduleAtNext(op: DomOpeartion) {
  if (inAnimationFrame) {
    runningQueue.add(op);
  } else {
    nextQueue.add(op);
  }
}

function measure(fn: () => void): IDisposable {
  const op = new DomOpeartion(fn, 10000);
  runAtThisOrScheduleAtNext(op);
  schedule();
  return op;
}

function mutate(fn: () => void): IDisposable {
  const op = new DomOpeartion(fn, -10000);
  runAtThisOrScheduleAtNext(op);
  schedule();
  return op;
}

function measureAtNextFrame(fn: () => void): IDisposable {
  const op = new DomOpeartion(fn, 10000);
  nextQueue.add(op);
  schedule();
  return op;
}

const fastdom = {
  measure,
  measureAtNextFrame,
  mutate,
};

export default fastdom;
