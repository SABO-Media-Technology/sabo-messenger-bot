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
      `Em nghe rồi ạ —`,
      `${address} ơi,`,
    ],
    seed,
  );
}

function pickCloser(seed) {
  return pickVariant(
    [
      "Anh/chị muốn em đi sâu giá, timeline hay tính năng ạ?",
      "Có gì thắc mắc thêm anh/chị cứ hỏi em tiếp ạ.",
      "Muốn em gợi scope cụ thể thì nhắn em nhé!",
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
