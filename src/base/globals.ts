export class Global {
  private static cwd?: string;
  private static tmpDir?: string;

  public static getCwd(): string {
    if (!this.cwd) {
      throw new Error("CWD not set.");
    }

    return this.cwd;
  }

  public static setCwd(cwd: string): void {
    this.cwd = cwd;
  }

  public static getTmpDir(): string {
    if (!this.tmpDir) {
      throw new Error("TMPDIR not set.");
    }

    return this.tmpDir;
  }

  public static setTmpDir(tmpDir: string): void {
    this.tmpDir = tmpDir;
  }
}
