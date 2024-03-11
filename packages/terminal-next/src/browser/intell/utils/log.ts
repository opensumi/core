let logEnabled = false;

const reset = async () => {

};

const debug = (content: object) => {
  if (!logEnabled) {
    return;
  }
  console.log('shellIntell: ', content);
};

export const enable = async () => {
  await reset();
  logEnabled = true;
};

export default { reset, debug, enable };
