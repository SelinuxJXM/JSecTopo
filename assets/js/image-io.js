/* ============================================================
 * 图像往返元数据（零依赖，file:// 直开可用）
 * ------------------------------------------------------------
 * 导出的 PNG 是位图、SVG 是渲染后的矢量，两者单独靠图形都无法可靠还原
 * 业务字段（IP / 型号 / 区域归属 / 连线端点 id 等）。因此由导出侧写入
 * 自描述工程元数据，导入侧读取后走与 JSON 相同的校验与恢复链路。
 *
 * PNG：在 IEND 之前插入标准 tEXt 数据块（keyword = jstopo-project），
 *      内容为本平台导出的工程 JSON 经 UTF-8 → Base64 编码。
 * SVG：在根 <svg> 后插入 <desc data-jstopo="1">Base64</desc>。
 *
 * 不含本平台元数据的普通图片一律拒绝导入，不做 OCR / 图形猜测。
 * ============================================================ */
(function () {
  'use strict';

  const KEY = 'jstopo-project';
  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

  function utf8ToB64(str) {
    const bytes = new TextEncoder().encode(String(str));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    const bin = atob(String(b64).replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function encodeProject(project) { return utf8ToB64(JSON.stringify(project)); }
  function decodeProject(payload) {
    try { return JSON.parse(b64ToUtf8(payload)); } catch (e) { return null; }
  }

  /* ---------------- SVG ---------------- */
  function injectSvgMeta(xml, project) {
    const s = String(xml || '');
    const desc = '<desc data-jstopo="1">' + encodeProject(project) + '</desc>';
    /* 报告版式内层 <svg> 由外层包裹，元数据留在内层；正则全局检索即可，不限定根元素 */
    return /^([\s\S]*?<svg[^>]*>)/.test(s) ? s.replace(/^([\s\S]*?<svg[^>]*>)/, '$1' + desc) : desc + s;
  }
  function extractSvgMeta(xml) {
    const m = /<desc[^>]*\sdata-jstopo="1"[^>]*>\s*([^<]+?)\s*<\/desc>/.exec(String(xml || ''));
    return m ? decodeProject(m[1]) : null;
  }

  /* ---------------- PNG ---------------- */
  let CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c >>> 0;
    }
    return CRC_TABLE;
  }
  function crc32(bytes, start, end) {
    const t = crcTable();
    let c = 0xFFFFFFFF;
    for (let i = start; i < end; i++) c = t[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function readU32(b, o) { return (((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0); }
  function isPng(b) { return b.length >= 8 && PNG_SIG.every(function (v, i) { return b[i] === v; }); }

  function pngChunks(bytes) {
    if (!isPng(bytes)) return null;
    const out = [];
    let off = 8;
    while (off + 12 <= bytes.length) {
      const len = readU32(bytes, off);
      if (len > bytes.length - off - 12) return null;
      const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
      out.push({ type: type, start: off, len: len, dataStart: off + 8, next: off + 12 + len });
      off += 12 + len;
      if (type === 'IEND') break;
    }
    return out.some(function (c) { return c.type === 'IEND'; }) ? out : null;
  }

  function injectPngMeta(input, project) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const chunks = pngChunks(bytes);
    if (!chunks) return null;
    /* keyword 与 Base64 都是 ASCII，按 Latin-1 一字节一位写入即可 */
    const text = KEY + '\0' + encodeProject(project);
    const data = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) data[i] = text.charCodeAt(i) & 255;
    const chunk = new Uint8Array(12 + data.length);
    chunk.set(u32(data.length), 0);
    chunk.set([116, 69, 88, 116], 4); /* tEXt: 0x74 't', 0x45 'E', 0x58 'X', 0x74 't' */
    chunk.set(data, 8);
    chunk.set(u32(crc32(chunk, 4, 8 + data.length)), 8 + data.length);
    const iend = chunks.filter(function (c) { return c.type === 'IEND'; })[0].start;
    const out = new Uint8Array(bytes.length + chunk.length);
    out.set(bytes.subarray(0, iend), 0);
    out.set(chunk, iend);
    out.set(bytes.subarray(iend), iend + chunk.length);
    return out;
  }

  function extractPngMeta(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    const chunks = pngChunks(bytes);
    if (!chunks) return null;
    const prefix = KEY + '\0';
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      if (c.type !== 'tEXt' || c.len < prefix.length) continue;
      let s = '';
      for (let j = c.dataStart; j < c.dataStart + prefix.length; j++) s += String.fromCharCode(bytes[j]);
      if (s !== prefix) continue;
      let payload = '';
      for (let j = c.dataStart + prefix.length; j < c.dataStart + c.len; j++) payload += String.fromCharCode(bytes[j]);
      return decodeProject(payload);
    }
    return null;
  }

  window.TopoImageIO = {
    KEY: KEY,
    encodeProject: encodeProject, decodeProject: decodeProject,
    utf8ToB64: utf8ToB64, b64ToUtf8: b64ToUtf8,
    injectSvgMeta: injectSvgMeta, extractSvgMeta: extractSvgMeta,
    injectPngMeta: injectPngMeta, extractPngMeta: extractPngMeta
  };
})();
