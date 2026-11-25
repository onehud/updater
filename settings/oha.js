// Idle-screen animation encoder (format read by the HUD firmware)
const HEADER = 36;
const TOO_BIG = 'Ảnh quá lớn hoặc quá nhiều chi tiết, hãy chọn ảnh khác.';

const CRC_T = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_T[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Fit src into a size x size canvas at zoom f (nearest neighbour), centred on black; returns RGB565 pixels
function scale(rgba, srcW, srcH, size, f) {
  const s = Math.min(size / srcW, size / srcH) * f;
  const dw = Math.max(1, Math.round(srcW * s)), dh = Math.max(1, Math.round(srcH * s));
  const ox = (size - dw) >> 1, oy = (size - dh) >> 1;
  const out = new Uint16Array(size * size);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y + 0.5) * srcH / dh));
    for (let x = 0; x < dw; x++) {
      const i = (sy * srcW + Math.min(srcW - 1, Math.floor((x + 0.5) * srcW / dw))) * 4, a = rgba[i + 3];
      const r = (rgba[i] * a + 127) / 255, g = (rgba[i + 1] * a + 127) / 255, b = (rgba[i + 2] * a + 127) / 255;
      out[(oy + y) * size + ox + x] = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
    }
  }
  return out;
}

const ch = (c, k) => (k === 0 ? (c >> 11) << 3 : k === 1 ? ((c >> 5) & 63) << 2 : (c & 31) << 3);

// Median cut over the RGB565 histogram -> <= 256 colours; returns {pal, idx}
function quantize(px) {
  const hist = new Uint32Array(65536);
  for (let i = 0; i < px.length; i++) hist[px[i]]++;
  const colours = [];
  for (let c = 0; c < 65536; c++) if (hist[c]) colours.push(c);
  const mk = (cs) => {
    let range = 0, axis = 0;
    if (cs.length > 1) for (let k = 0; k < 3; k++) {
      let lo = 255, hi = 0;
      for (const c of cs) { const v = ch(c, k); if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo > range) { range = hi - lo; axis = k; }
    }
    return { cs, range, axis };
  };
  const boxes = [mk(colours)];
  while (boxes.length < 256) {
    let best = -1;
    boxes.forEach((b, i) => { if (b.range && (best < 0 || b.range > boxes[best].range)) best = i; });
    if (best < 0) break;
    const { cs, axis } = boxes[best];
    cs.sort((a, b) => ch(a, axis) - ch(b, axis) || a - b);
    let total = 0, acc = 0, cut = cs.length - 1;
    for (const c of cs) total += hist[c];
    for (let i = 0; i < cs.length - 1; i++) { acc += hist[cs[i]]; if (acc * 2 >= total) { cut = i + 1; break; } }
    boxes.splice(best, 1, mk(cs.slice(0, cut)), mk(cs.slice(cut)));
  }
  const lut = new Uint8Array(65536), pal = new Uint16Array(256);
  boxes.forEach(({ cs: box }, b) => {
    let n = 0, r = 0, g = 0, bl = 0;
    for (const c of box) { const w = hist[c]; n += w; r += ch(c, 0) * w; g += ch(c, 1) * w; bl += ch(c, 2) * w; lut[c] = b; }
    if (box.length === 1) pal[b] = box[0];
    else pal[b] = ((Math.round(r / n) & 0xF8) << 8) | ((Math.round(g / n) & 0xFC) << 3) | (Math.round(bl / n) >> 3);
  });
  const idx = new Uint8Array(px.length);
  for (let i = 0; i < px.length; i++) idx[i] = lut[px[i]];
  return { pal, idx };
}

// Runs of >= 2 equal indices become runs, the rest literals (max 128 each)
function rle(idx, out) {
  const n = idx.length;
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && j - i < 128 && idx[j] === idx[i]) j++;
    if (j - i >= 2) { out.push(0x80 | (j - i - 1), idx[i]); i = j; continue; }
    j = i + 1;
    while (j < n && j - i < 128 && !(j + 1 < n && idx[j] === idx[j + 1])) j++;
    out.push(j - i - 1);
    for (let k = i; k < j; k++) out.push(idx[k]);
    i = j;
  }
}

function build(qs, size, frameMs) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  for (const { pal, idx } of qs) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!pal[idx[y * size + x]]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) x0 = y0 = x1 = y1 = 0;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, n = qs.length;
  const body = [];
  for (let k = 0; k < 4 * n; k++) body.push(0);
  for (let k = 0; k < n; k++) {
    while ((HEADER + body.length) % 4) body.push(0);
    const off = HEADER + body.length;
    body[4 * k] = off & 255; body[4 * k + 1] = (off >> 8) & 255; body[4 * k + 2] = (off >> 16) & 255; body[4 * k + 3] = off >>> 24;
    const { pal, idx } = qs[k], rows = [], offs = [];
    for (let y = 0; y < h; y++) {
      offs.push(rows.length);
      rle(idx.subarray((y0 + y) * size + x0, (y0 + y) * size + x0 + w), rows);
    }
    if (offs[h - 1] > 0xFFFF) return null;
    body.push(0x4F, 0x48, 0x46, 0x31);   // "OHF1"
    for (const c of pal) body.push(c & 255, c >> 8);
    for (const o of offs) body.push(o & 255, o >> 8);
    for (const b of rows) body.push(b);
  }
  const out = new Uint8Array(HEADER + body.length);
  out.set(body, HEADER);
  const v = new DataView(out.buffer);
  out.set([0x4F, 0x48, 0x41, 0x31]);   // "OHA1"
  [1, HEADER, size, size, x0, y0, w, h, n, frameMs].forEach((val, i) => v.setUint16(4 + 2 * i, val, true));
  v.setUint32(24, out.length, true);
  v.setUint32(28, crc32(out.subarray(HEADER)), true);
  return out;   // bg (32) and reserved (34) stay 0
}

export function encode({ frames, srcW, srcH }, { canvas, maxBytes, maxFrames = 64 }) {
  if (!frames?.length || !(srcW > 0) || !(srcH > 0)) throw new Error('Không đọc được ảnh.');
  const total = frames.reduce((s, f) => s + (f.delay_ms > 0 ? f.delay_ms : 0), 0);
  // Too detailed for one frame: shrink the picture (canvas stays screen size) down to half before giving up
  for (const f of [1, 0.85, 0.7225, 0.614, 0.522, 0.5]) {
    const cache = new Map();
    const quant = (i) => {
      if (!cache.has(i)) cache.set(i, quantize(scale(frames[i].rgba, srcW, srcH, canvas, f)));
      return cache.get(i);
    };
    let k = Math.min(frames.length, maxFrames);
    for (;;) {
      const pick = Array.from({ length: k }, (_, i) => Math.floor(i * frames.length / k));
      const ms = Math.min(0xFFFF, Math.max(20, Math.round(total / k)));
      const bytes = build(pick.map(quant), canvas, ms);
      if (bytes && bytes.length <= maxBytes) return { bytes, frames: k, scale: f };
      if (!bytes || k === 1) break;   // row offsets overflow does not depend on frame count
      k = Math.max(1, Math.min(k - 1, Math.floor(k * maxBytes / bytes.length)));
    }
  }
  throw new Error(TOO_BIG);
}
