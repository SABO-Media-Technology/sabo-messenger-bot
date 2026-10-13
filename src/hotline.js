/**
 * Per-page hotline.
 * - Trang bida (SABO Arena / Quản lý Giải Đấu / SABO Billiards) dùng hotline bida theo Dify SSoT.
 * - Các trang khác (Design, Web, Agency, APP, HUB, AI, BĐS, Media...) giữ hotline công ty.
 */
const DEFAULT_HOTLINE = "0798893333";
const BIDA_HOTLINE = "0961 167 717";

function getHotline(page) {
  return (page && page.hotline) || DEFAULT_HOTLINE;
}

/** Thay placeholder {{HOTLINE}} bằng hotline của trang. */
function applyHotline(text, page) {
  return String(text).split("{{HOTLINE}}").join(getHotline(page));
}

module.exports = { DEFAULT_HOTLINE, BIDA_HOTLINE, getHotline, applyHotline };
