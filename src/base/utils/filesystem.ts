import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { _async } from "./async";
import path from "./path";

export async function _readFile(path: string) {
  return _async<string>((p) => {
    const encoding = "utf-8";

    const file = Gio.File.new_for_path(path.toString());

    file.load_contents_async(null, (_, result) => {
      try {
        const [success, contents] = file.load_contents_finish(result);
        if (success) {
          const decoder = new TextDecoder(encoding);
          p.resolve(decoder.decode(contents as any));
        } else {
          p.reject(new Error("Could not read file."));
        }
      } catch (error) {
        p.reject(error);
      }
    });
  });
}

export async function _deleteFile(path: string) {
  return _async((p) => {
    const file = Gio.File.new_for_path(path);

    file.delete_async(GLib.PRIORITY_DEFAULT, null, (_, result) => {
      try {
        if (!file.delete_finish(result)) {
          throw new Error(`Failed to delete file: ${path}`);
        }
        p.resolve(undefined);
      } catch (error) {
        p.reject(error);
      }
    });
  });
}

export async function _readdir(dir: string) {
  const file = Gio.File.new_for_path(dir);

  const enumerator = await _async<Gio.FileEnumerator>((p2) => {
    file.enumerate_children_async(
      "*",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
      (_, result) => {
        try {
          const enumerator = file.enumerate_children_finish(result);
          p2.resolve(enumerator);
        } catch (error) {
          p2.reject(error);
        }
      }
    );
  });

  const getNextBatch = () =>
    _async<Gio.FileInfo[]>((p3) => {
      enumerator.next_files_async(
        50, // max results
        GLib.PRIORITY_DEFAULT,
        null,
        (_, result) => {
          try {
            p3.resolve(enumerator.next_files_finish(result));
          } catch (e) {
            p3.reject(e);
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
}

export async function _walkFiles(
  dir: string,
  onFile: (root: string, name: string) => void
) {
  const file = Gio.File.new_for_path(dir);

  const enumerator = await _async<Gio.FileEnumerator>((p2) => {
    file.enumerate_children_async(
      "*",
      Gio.FileQueryInfoFlags.NONE,
      GLib.PRIORITY_DEFAULT,
      null,
      (_, result) => {
        try {
          const enumerator = file.enumerate_children_finish(result);
          p2.resolve(enumerator);
        } catch (error) {
          p2.reject(error);
        }
      }
    );
  });

  const getNextBatch = () =>
    _async<Gio.FileInfo[]>((p3) => {
      enumerator.next_files_async(
        50, // max results
        GLib.PRIORITY_DEFAULT,
        null,
        (_, result) => {
          try {
            p3.resolve(enumerator.next_files_finish(result));
          } catch (e) {
            p3.reject(e);
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
