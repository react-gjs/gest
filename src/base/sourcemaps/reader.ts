import { Base64VLQ } from "./vlq";

export type SourceMap = {
  version: number;
  sources: string[];
  sourcesContent: string[];
  mappings: string;
  names: string[];
};

export class SourceMapReader {
  private converter = new Base64VLQ();

  constructor(private map: SourceMap) {}

  protected getLineN(text: string, n: number) {
    let line = 0;
    let lineStart = 0;

    while (line !== n) {
      lineStart = text.indexOf("\n", lineStart) + 1;
      line++;
    }

    if (line > 0 && lineStart === 0) {
      return "";
    }

    let lineEnd = text.indexOf("\n", lineStart + 1);

    if (lineEnd === -1) {
      lineEnd = text.length;
    }

    return text.slice(lineStart, lineEnd);
  }

  getOriginalPosition(outLine: number, outColumn: number) {
    // SourceMap is 0 based, error stack is 1 based
    outLine -= 1;
    outColumn -= 1;

    const vlqs = this.map.mappings.split(";").map((line) => line.split(","));

    const state: [number, number, number, number, number] = [0, 0, 0, 0, 0];

    if (vlqs.length <= outLine) return null;

    for (const [index, line] of vlqs.entries()) {
      state[0] = 0;

      for (const [_, segment] of line.entries()) {
        if (!segment) continue;
        const segmentCords = this.converter.decode(segment);

        const prevState: typeof state = [...state];

        state[0] += segmentCords[0];

        if (segmentCords.length > 1) {
          state[1] += segmentCords[1];
          state[2] += segmentCords[2];
          state[3] += segmentCords[3];
          if (segmentCords[4] !== undefined) state[4] += segmentCords[4];

          if (index === outLine) {
            if (prevState[0] < outColumn && outColumn <= state[0]) {
              return {
                file: this.map.sources[state[1]],
                line: state[2] + 1,
                column: outColumn + state[3] - state[0] + 1,
              };
            }
          }
        }
      }

      if (index === outLine) {
        return {
          file: this.map.sources[state[1]],
          line: state[2] + 1, // back to 1 based
          column: 1,
        };
      }
    }

    return null;
  }
}
