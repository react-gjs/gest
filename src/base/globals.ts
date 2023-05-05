export class Global {
  private static cwd?: string;
  private static tmpDir?: string;
  private static sourceMapLineOffset?: number;

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

  public static getSourceMapLineOffset(): number {
    if (!this.sourceMapLineOffset) {
      throw new Error("Source map offset not set.");
    }

    return this.sourceMapLineOffset;
  }

  public static setSourceMapLineOffset(offset: number): void {
    this.sourceMapLineOffset = offset;
  }
}
