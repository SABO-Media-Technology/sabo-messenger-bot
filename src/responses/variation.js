/**
 * Light phrasing variation for unavoidable template/fallback paths.
 * Deterministic per seed so tests stay stable.
 */

function hashSeed(text) {
  const s = String(text || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickVariant(items, seed) {
  if (!items?.length) return "";
  return items[((seed >>> 0) % items.length + items.length) % items.length];
}

function pickOpener(address, seed) {
  return pickVariant(
    [
      `Dạ ${address}!`,
      `Ừ ${address},`,
      `${address} ơi,`,
      `Em nghe rồi ạ —`,
    ],
    seed,
  );
}

function pickCloser(seed) {
  return pickVariant(
    [
      "Anh/chị cần em làm rõ thêm phần nào cứ nhắn nhé!",
      "Có gì thắc mắc thêm anh/chị cứ hỏi em tiếp ạ.",
      "Muốn đi sâu giá hay timeline thì nhắn em nhé!",
    ],
    seed,
  );
}

module.exports = {
  hashSeed,
  pickVariant,
  pickOpener,
  pickCloser,
};
