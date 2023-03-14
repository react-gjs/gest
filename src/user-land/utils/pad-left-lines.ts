/** Adds a left padding to all lines except the first one. */
export function padLeftLines(
  text: string,
  char: string | undefined | null,
  length = 1
): string {
  const padChar = char?.[0] ?? " ";
  const paddingStr = Array.from({ length }, () => padChar).join("");
  return text
    .split("\n")
    .map((line, index) => (index === 0 ? line : paddingStr + line))
    .join("\n");
}
