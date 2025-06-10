import { Heap, IDisposable, onUnexpectedError } from '@opensumi/ide-utils';

/**
 * DOM操作类,用于封装DOM读写操作
 */
class DomOperation {
  private _disposed = false;

  constructor(protected _runner: () => void, public priority: number) {}

  run() {
    if (this._disposed) {
      return;
    }

    try {
      this._runner();
    } catch (error) {
      onUnexpectedError(error);
    }
  }

  dispose() {
    this._disposed = true;
  }
}

// 两个优先级队列,用于交替存储DOM操作
const aQueue = new Heap<DomOperation>({
  comparator: (a, b) => b.priority - a.priority,
});

const bQueue = new Heap<DomOperation>({
  comparator: (a, b) => b.priority - a.priority,
});

// 当前正在执行的队列和下一帧要执行的队列
let runningQueue = aQueue;
let nextQueue = bQueue;

/**
 * 交换两个队列
 */
function swapQueue() {
  if (runningQueue === aQueue) {
    runningQueue = bQueue;
    nextQueue = aQueue;
  } else {
    runningQueue = aQueue;
    nextQueue = bQueue;
  }
}

// 当前动画帧的句柄
let currentFlushHandle: number | undefined;
// 是否在动画帧中
let inAnimationFrame = false;

/**
 * 执行当前队列中的所有DOM操作
 */
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

/**
 * 调度下一帧的执行
 */
function schedule() {
  if (currentFlushHandle) {
    return;
  }

  currentFlushHandle = requestAnimationFrame(flush);
}

/**
 * 如果当前在动画帧中，将操作加入当前队列，否则加入下一帧队列
 */
function runAtThisOrScheduleAtNext(op: DomOperation) {
  if (inAnimationFrame) {
    runningQueue.add(op);
  } else {
    nextQueue.add(op);
  }
}

/**
 * 添加一个DOM读操作到队列中
 * @param fn DOM读操作函数
 * @returns 可取消的操作句柄
 */
function measure(fn: () => void): IDisposable {
  const op = new DomOperation(fn, 10000);
  runAtThisOrScheduleAtNext(op);
  schedule();
  return op;
}

/**
 * 添加一个DOM写操作到队列中
 * @param fn DOM写操作函数
 * @returns 可取消的操作句柄
 */
function mutate(fn: () => void): IDisposable {
  const op = new DomOperation(fn, -10000);
  runAtThisOrScheduleAtNext(op);
  schedule();
  return op;
}

/**
 * 添加一个DOM读操作到下一帧队列中
 * @param fn DOM读操作函数
 * @returns 可取消的操作句柄
 */
function measureAtNextFrame(fn: () => void): IDisposable {
  const op = new DomOperation(fn, 10000);
  nextQueue.add(op);
  schedule();
  return op;
}

/**
 * fastdom工具对象,用于管理DOM读写操作
 */
const fastdom = {
  measure,
  measureAtNextFrame,
  mutate,
};

export default fastdom;
