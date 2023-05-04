export type StackItem =
  | {
      internal?: undefined;
      filepath: string;
      column?: number | null;
      line?: number | null;
      symbolName?: string | null;
    }
  | {
      filepath?: undefined;
      internal: string;
    };

export type ParsedStack = Array<StackItem>;

export type ErrorStackParser = (err: Error) => ParsedStack;
