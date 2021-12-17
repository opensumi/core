const notifier = require('node-notifier');

exports.createNotifierCallback = function () {
  return (severity, errors) => {
    if (severity !== 'error') {
      return;
    }
    const error = errors[0];
    const filename = error.file && error.file.split('!').pop();
    notifier.notify({
      title: 'webpack error',
      message: filename,
    });
  };
};
