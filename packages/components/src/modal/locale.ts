export interface ModalLocale {
  okText: string;
  cancelText: string;
  justOkText: string;
}

const defaultLocale: ModalLocale = {
  okText: 'OK',
  cancelText: 'Cancel',
  justOkText: 'OK',
};

let runtimeLocale: ModalLocale = {
  ...defaultLocale,
};

export function changeConfirmLocale(newLocale?: ModalLocale) {
  if (newLocale) {
    runtimeLocale = {
      ...runtimeLocale,
      ...newLocale,
    };
  } else {
    runtimeLocale = {
      ...defaultLocale,
    };
  }
}

export function getConfirmLocale() {
  return runtimeLocale;
}
