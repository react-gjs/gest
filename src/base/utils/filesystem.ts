import Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";
import { _async } from "./async";
import path from "./path";

class FsError extends Error {
  private _message = "";

  constructor(private readonly args: any[]) {
    super();
    this.name = "FsError";
  }

  get message() {
    return this.valueOf().slice(9);
  }

  _throw(fnName: string, message?: string) {
    if (message != null) {
      this._message = `'${fnName}' has thrown an error: ${message}`;
    } else {
      this._message = `'${fnName}' has thrown an error.`;
    }
    throw this;
  }

  valueOf() {
    return `FsError: ${this._message}\nArguments: ${JSON.stringify(
      this.args,
      null,
      2
    )}`;
  }

  toString() {
    return this.valueOf();
  }
}

function getErrMessage(e: unknown): string | undefined {
  if (typeof e === "string") {
    return e;
  } else if (
    typeof e === "object" &&
    e != null &&
    (e instanceof Error || "message" in e)
  ) {
    return String((e as { message: string }).message);
  }
}

function fsFunc<A extends any[], R extends Promise<any>>(
  name: string,
  impl: (...args: A) => R
): (...args: A) => R {
  const a = {
    [name](...args: A) {
      const err = new FsError(args);

      return (async () => {
        try {
          return await impl(...args);
        } catch (e) {
          err._throw(name, getErrMessage(e));
        }
      })();
    },
  };

  return a[name] as any;
}

export const _readFile = fsFunc("readFile", (filepath: string) =>
  _async<string>((p) => {
    const encoding = "utf-8";

    const file = Gio.File.new_for_path(filepath.toString());

    file.load_contents_async(null, (_, result) => {
      try {
        const [success, contents] = file.load_contents_finish(result);
        if (success) {
          const decoder = new TextDecoder(encoding);
          p.resolve(decoder.decode(contents as any));
        } else {
          p.reject("could not read file");
        }
      } catch (error) {
        p.reject(error);
      }
    });
  })
);

export const _deleteFile = fsFunc("deleteFile", (filepath: string) =>
  _async((p) => {
    const file = Gio.File.new_for_path(filepath);

    file.delete_async(GLib.PRIORITY_DEFAULT, null, (_, result) => {
      try {
        if (!file.delete_finish(result)) {
          p.reject("unable to delete file");
        }
        p.resolve(undefined);
      } catch (error) {
        p.reject(error);
      }
    });
  })
);

export const _readdir = fsFunc("readdir", async (dir: string) => {
  const file = Gio.File.new_for_path(dir);

  const enumerator = await _async<Gio.FileEnumerator>((p) => {
    file.enumerate_children_async(
      "*",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
      (_, result) => {
        try {
          const enumerator = file.enumerate_children_finish(result);
          p.resolve(enumerator);
        } catch (error) {
          p.reject(error);
        }
      }
    );
  });

  const getNextBatch = () =>
    _async<Gio.FileInfo[]>((p) => {
      enumerator.next_files_async(
        50, // max results
        GLib.PRIORITY_DEFAULT,
        null,
        (_, result) => {
          try {
            p.resolve(enumerator.next_files_finish(result));
          } catch (e) {
            p.reject(e);
          }
        }
      );
    });

  const allFile: string[] = [];

  let nextBatch: Gio.FileInfo[] = [];

  while ((nextBatch = await getNextBatch()).length > 0) {
    allFile.push(...nextBatch.map((f) => f.get_name()));
  }

  return allFile;
});

export const _walkFiles = fsFunc(
  "walkFiles",
  async (dir: string, onFile: (root: string, name: string) => void) => {
    const file = Gio.File.new_for_path(dir);

    const enumerator = await _async<Gio.FileEnumerator>((p) => {
      file.enumerate_children_async(
        "*",
        Gio.FileQueryInfoFlags.NONE,
        GLib.PRIORITY_DEFAULT,
        null,
        (_, result) => {
          try {
            const enumerator = file.enumerate_children_finish(result);
            p.resolve(enumerator);
          } catch (error) {
            p.reject(error);
          }
        }
      );
    });

    const getNextBatch = () =>
      _async<Gio.FileInfo[]>((p) => {
        enumerator.next_files_async(
          50, // max results
          GLib.PRIORITY_DEFAULT,
          null,
          (_, result) => {
            try {
              p.resolve(enumerator.next_files_finish(result));
            } catch (e) {
              p.reject(e);
            }
          }
        );
      });

    let nextBatch: Gio.FileInfo[] = [];

    while ((nextBatch = await getNextBatch()).length > 0) {
      for (const child of nextBatch) {
        const isDir = child.get_file_type() === Gio.FileType.DIRECTORY;
        if (!isDir) {
          onFile(dir, child.get_name());
        } else {
          await _walkFiles(path.join(dir, child.get_name()), onFile);
        }
      }
    }
  }
);

export const _mkdir = fsFunc("mkdir", (path: string) =>
  _async((p) => {
    const file = Gio.File.new_for_path(path.toString());

    file.make_directory_async(
      GLib.PRIORITY_DEFAULT,
      null,
      async (_, result) => {
        try {
          if (!file.make_directory_finish(result)) {
            p.reject("failed to create directory");
          }

          p.resolve(undefined);
        } catch (error) {
          p.reject(error);
        }
      }
    );
  })
);
