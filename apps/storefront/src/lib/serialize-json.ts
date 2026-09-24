/** Serialize data embedded in HTML without allowing merchant text to close its script. */
export function serializeJsonForScript(value: unknown): string {
  return (JSON.stringify(value) ?? "null")
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
