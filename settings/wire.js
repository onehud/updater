// FFF4 payload v2 codec — keep in sync with components/utils/settings_wire.c
// Layout: docs/specs/2026-11-25-web-settings-v2.md §2
export const LEN = 64;
export const VERSION = 2;
export const CAP = { LED: 1, CONN_MODE: 2, BUZZER: 4, EMOJI: 8 };
export const BOARDS = ['128', 'c3', '18', 's318'];
export const SLOTS = 4;
export const RANGES = 8;
export const SPEED_OFFSET_MIN = -10;
export const SPEED_OFFSET_MAX = 10;
const BOOLS = ['autoBrightness', 'speedVolume', 'signVolume', 'mirror', 'led', 'overspeedBlink', 'emojiIdle'];
const BOOL_AT = { autoBrightness: 5, speedVolume: 7, signVolume: 8, mirror: 9, led: 10, overspeedBlink: 11, emojiIdle: 12 };

export function unpack(view) {
  if (view.byteLength !== LEN) throw new Error('HUD cần cập nhật firmware để dùng trang này');
  if (view.getUint8(0) !== VERSION) throw new Error('HUD cần cập nhật firmware để dùng trang này');
  const s = {
    caps: view.getUint8(1),
    board: BOARDS[view.getUint8(2)] ?? '128',
    brightness: view.getUint8(3),
    rotation: view.getUint8(4),
    theme: view.getUint8(6),
    connectionMode: view.getUint8(13),
    percent: view.getUint8(14) === 1,
    ranges: Array.from({ length: RANGES }, (_, i) => view.getInt8(15 + i)),
    slots: Array.from({ length: SLOTS }, (_, i) => ({ start: view.getUint16(23 + 3 * i, true), level: view.getUint8(25 + 3 * i) })),
    mac: Array.from({ length: 6 }, (_, i) => view.getUint8(36 + i).toString(16).padStart(2, '0').toUpperCase()).join(':'),
    version: new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset + 42, 22)).replace(/\0.*$/s, ''),
  };
  for (const k of BOOLS) s[k] = view.getUint8(BOOL_AT[k]) === 1;
  return s;
}

const int = (v, lo, hi, what) => {
  if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`${what} phải trong ${lo}..${hi}: ${v}`);
  return v;
};

// test = 1 asks the HUD to beep once ("Thử loa"); caps, board, MAC and version are read-only
export function pack(s, test = false) {
  const out = new Uint8Array(LEN);
  const view = new DataView(out.buffer);
  out[0] = VERSION;
  out[3] = int(s.brightness, 10, 100, 'Độ sáng');
  out[4] = int(s.rotation, 0, 3, 'Xoay');
  if (s.theme !== 0 && s.theme !== 2) throw new Error(`Mặt hiển thị không hợp lệ: ${s.theme}`);
  out[6] = s.theme;
  for (const k of BOOLS) out[BOOL_AT[k]] = +!!s[k];
  out[13] = int(s.connectionMode, 0, 1, 'Kết nối');
  out[14] = +!!s.percent;
  for (let i = 0; i < RANGES; i++) view.setInt8(15 + i, int(s.ranges[i], SPEED_OFFSET_MIN, SPEED_OFFSET_MAX, 'Độ lệch'));
  for (let i = 0; i < SLOTS; i++) {
    const { start, level } = s.slots[i];
    if (int(start, 0, 1410, 'Giờ') % 30) throw new Error(`Giờ phải theo bước 30 phút: ${start}`);
    view.setUint16(23 + 3 * i, start, true);
    out[25 + 3 * i] = int(level, 10, 100, 'Độ sáng khung giờ');
  }
  out[35] = +!!test;
  return out;
}
