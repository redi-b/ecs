type CryptoLike = {
  getRandomValues?: ((values: Uint32Array) => Uint32Array) | undefined;
  randomUUID?: (() => string) | undefined;
};

export function createMediaUploadId(cryptoLike: CryptoLike | undefined = globalThis.crypto) {
  if (typeof cryptoLike?.randomUUID === "function") return cryptoLike.randomUUID();

  const values = new Uint32Array(2);
  if (typeof cryptoLike?.getRandomValues === "function") {
    cryptoLike.getRandomValues(values);
  } else {
    values[0] = Math.floor(Math.random() * 0xffffffff);
    values[1] = Math.floor(Math.random() * 0xffffffff);
  }

  return `upload-${(values.at(0) ?? 0).toString(36)}-${(values.at(1) ?? 0).toString(36)}`;
}
