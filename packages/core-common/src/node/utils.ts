/**
 * modified from: https://github.com/mhart/epipebomb
 *
 * support EIO
 */
export function epipeBomb(stream: NodeJS.WriteStream, callback: (code?: number) => void) {
  if (!stream) {
    stream = process.stdout;
  }
  if (!callback) {
    callback = process.exit;
  }

  function epipeFilter(err: any) {
    if (err.code === 'EPIPE') {
      return callback();
    }
    if (err.code === 'EIO') {
      return callback();
    }

    // If there's more than one error handler (ie, us),
    // then the error won't be bubbled up anyway
    if (stream.listeners('error').length <= 1) {
      stream.removeAllListeners('error'); // Pretend we were never here
      stream.emit('error', err); // Then emit as if we were never here
      stream.on('error', epipeFilter); // Then reattach, ready for the next error!
    }
  }

  stream.on('error', epipeFilter);
}

/**
 * 参考：https://github.com/camunda/camunda-modeler/pull/3314
 * fix(app): suppress EPIPE errors for app output
 */
export function suppressNodeJSEpipeError(_process: NodeJS.Process, error: (msg: string) => void) {
  let suppressing = false;
  const logEPIPEErrorOnce = () => {
    if (suppressing) {
      return;
    }

    suppressing = true;
    error('Detected EPIPE error; suppressing further EPIPE errors');
  };

  _process.stdout && epipeBomb(_process.stdout, logEPIPEErrorOnce);
  _process.stderr && epipeBomb(_process.stderr, logEPIPEErrorOnce);
}
