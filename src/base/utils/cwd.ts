let _cwd: null | string = null;

export function setCwd(uri: string): void {
  _cwd = uri;
}

export function getCwd(): string {
  if (_cwd === null) {
    throw new Error("CWD is not set");
  }

  return _cwd;
}
