import GLib from "gi://GLib?version=2.0";

type GMainLoop = GLib.MainLoop & {
  runAsync(): Promise<void>;
};

export class Mainloop {
  private static _gMainloop = new GLib.MainLoop(null, false) as GMainLoop;
  private static _exitCode = 0;

  public static start() {
    return this._gMainloop.runAsync().then(() => this._exitCode);
  }

  public static exit(exitCode = 0) {
    this._exitCode = exitCode;
    this._gMainloop.quit();
  }
}
