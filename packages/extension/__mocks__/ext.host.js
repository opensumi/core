setTimeout(() => {
  console.log('send ready');
  process.send('ready');

  process.on('message', async (msg) => {
    if (msg === 'close') {
      process.send('finish');
    }
  });
}, 1000);
