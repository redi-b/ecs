export function filenameFromContentDisposition(value: string | null, fallback: string) {
  if (!value) return fallback;
  const utf8 = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quoted = value.match(/filename="([^"]+)"/i)?.[1];
  const plain = value.match(/filename=([^;]+)/i)?.[1]?.trim();
  let decodedUtf8: string | undefined;
  try {
    decodedUtf8 = utf8 ? decodeURIComponent(utf8) : undefined;
  } catch {
    decodedUtf8 = undefined;
  }
  const candidate = decodedUtf8 ?? quoted ?? plain ?? fallback;
  return Array.from(candidate, (character) => {
    const code = character.charCodeAt(0);
    return character === "/" || character === "\\" || code < 32 || code === 127 ? "-" : character;
  }).join("");
}
