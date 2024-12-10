import type Gio from "gi://Gio?version=2.0";
import GLib from "gi://GLib?version=2.0";

export function readStream(stream: Gio.InputStream | null) {
  return new Promise<Uint8Array>((resolve, reject) => {
    if (!stream) return resolve(Uint8Array.from([]));

    const buff = stream.read_all_async(
      GLib.PRIORITY_LOW,
      null,
      (_, result) => {
        const [ok] = stream.read_all_finish(result);
        if (!ok)
          return reject(new Error("Failed to read the input stream"));
        resolve(buff);
      },
    );
  });
}
