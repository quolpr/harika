let isSuppressing = false;

export const suppressLog = <T>(f: () => T): T => {
  try {
    isSuppressing = true;

    return f();
  } finally {
    isSuppressing = false;
  }
};

export const getIsLogSuppressing = () => isSuppressing;
