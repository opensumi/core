import raf from 'raf';

interface RafMap {
  [id: number]: number;
}

let id = 0;
const ids: RafMap = {};

// Support call raf with delay specified frame
function wrapperRaf(callback: () => void, delayFrames = 1): number {
  const myId: number = id++;
  let restFrames: number = delayFrames;

  function internalCallback() {
    restFrames -= 1;

    if (restFrames <= 0) {
      callback();
      delete ids[myId];
    } else {
      ids[myId] = raf(internalCallback);
    }
  }

  ids[myId] = raf(internalCallback);

  return myId;
}

wrapperRaf.cancel = function cancel(pid?: number) {
  if (pid === undefined) {
    return;
  }

  raf.cancel(ids[pid]);
  delete ids[pid];
};

wrapperRaf.ids = ids; // export this for test usage

export { wrapperRaf };
