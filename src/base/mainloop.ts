import GLib from "gi://GLib?version=2.0";

type GMainLoop = GLib.MainLoop & {
  runAsync(): Promise<void>;
};

export class Mainloop {
  private static _gMainloop: GMainLoop;
  private static _exitCode: number;

  static {
    this._gMainloop = new GLib.MainLoop(null, false) as GMainLoop;
    this._exitCode = 0;

    if (typeof this._gMainloop.runAsync === "undefined") {
      Object.defineProperty(this._gMainloop, "runAsync", {
        value: runAsyncPolyfill,
      });
    }
  }

  public static start() {
    return this._gMainloop.runAsync().then(() => this._exitCode);
  }

  public static exit(exitCode = 0) {
    this._exitCode = exitCode;
    this._gMainloop.quit();
  }
}

function runAsyncPolyfill(this: GLib.MainLoop) {
  const p = new Promise<void>((resolve, reject) => {
    GLib.idle_add(-10000, () => {
      try {
        resolve(this.run());
      } catch (e) {
        reject(e);
      }
      return GLib.SOURCE_REMOVE;
    });
  });

  return p;
}
