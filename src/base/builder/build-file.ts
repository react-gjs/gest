import { Command } from "../command/command";
import { getDirname } from "../utils/get-dirname";
import path from "../utils/path";

export async function _buildFile(params: {
  input: string;
  output: string;
  mainSetup?: string;
  fileSetup?: string;
}) {
  const { input, output, mainSetup, fileSetup } = params;

  const args = [
    path.join(getDirname(import.meta.url), "esbuild-script.mjs"),
    input,
    output,
  ];

  if (mainSetup) {
    args.push(mainSetup);
  }

  if (fileSetup) {
    args.push(fileSetup);
  }

  const cmd = new Command("node", ...args);

  await cmd.runSync();
}
