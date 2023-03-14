export interface BSMIdentifier {
  kind: "identifier";
  value: string;
}

export interface BSMValue {
  kind: "value";
  value: string | number | boolean;
}

export interface BSMJsonValue {
  kind: "json";
  value: { json: string };
}

export interface BuildScriptMessage {
  input: string;
  output: string;
  globals?: Record<string, BSMIdentifier | BSMValue | BSMJsonValue>;
  setup: {
    main?: string;
    secondary?: string;
  };
}
