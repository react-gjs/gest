import Fs from "fs-gjs";

export const walkFiles = async (
  dir: string,
  onFile: (root: string, name: string) => void
) => {
  const files = await Fs.listDir(dir);

  for (const file of files) {
    if (file.isDirectory) {
      await walkFiles(file.filepath, onFile);
    } else {
      onFile(dir, file.filename);
    }
  }
};
