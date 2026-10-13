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

function pickCloser(seed, verticalId = "sabo-mt-services") {
  if (verticalId === "billiards-ops") {
    return pickVariant(
      [
        "Anh/chị đang cần hỗ trợ cho quán bida hay muốn tham gia giải đấu ạ?",
        "Anh/chị cần tư vấn tổ chức giải hay đặt bàn cứ nhắn em nhé!",
        "Có gì thắc mắc về app hay giải đấu anh/chị cứ hỏi em tiếp ạ.",
      ],
      seed,
    );
  }
  if (verticalId === "ai-education") {
    return pickVariant(
      [
        "Anh/chị muốn tìm hiểu khóa học cho bản thân hay cho team ạ?",
        "Có gì thắc mắc thêm về khóa học anh/chị cứ hỏi em tiếp ạ.",
        "Anh/chị muốn bắt đầu từ ChatGPT hay tạo ảnh AI trước ạ?",
      ],
      seed,
    );
  }
  return pickVariant(
    [
      "Anh/chị muốn em đi sâu giá, timeline hay tính năng ạ?",
      "Có gì thắc mắc thêm anh/chị cứ hỏi em tiếp ạ.",
      "Muốn em tư vấn chi tiết hơn thì nhắn em nhé!",
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
