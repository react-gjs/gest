export function _leftPad(str: string, len: number, char = " ") {
  const pad = char.repeat(len);
  return pad + str.replaceAll("\n", "\n" + pad);
}
