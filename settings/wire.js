// FFF4 payload codec — keep in sync with components/utils/settings_wire.c
export const LEN = 16;
export const VERSION = 1;
export const CAP = { LED: 1, CONN_MODE: 2, BUZZER: 4, EMOJI: 8, THEME_ALL: 16 };

export function unpack(view) {
  if (view.byteLength !== LEN) throw new Error(`Payload sai độ dài: ${view.byteLength}`);
  if (view.getUint8(0) !== VERSION) throw new Error(`Firmware dùng phiên bản ${view.getUint8(0)}, web cần ${VERSION}`);
  const b = (i) => view.getUint8(i) === 1;
  return {
    caps: view.getUint8(1),
    brightness: view.getUint8(2),
    rotation: view.getUint8(3),
    autoBrightness: b(4),
    theme: view.getUint8(5),
    speedVolume: b(6),
    signVolume: b(7),
    mirror: b(8),
    led: b(9),
    overspeedBlink: b(10),
    emojiIdle: b(11),
    speedOffset: view.getInt8(12),
    connectionMode: view.getUint8(13),
  };
}

export function pack(s) {
  const out = new Uint8Array(LEN);
  const view = new DataView(out.buffer);
  out[0] = VERSION;
  out[2] = s.brightness;
  out[3] = s.rotation;
  out[4] = +s.autoBrightness;
  out[5] = s.theme;
  out[6] = +s.speedVolume;
  out[7] = +s.signVolume;
  out[8] = +s.mirror;
  out[9] = +s.led;
  out[10] = +s.overspeedBlink;
  out[11] = +s.emojiIdle;
  view.setInt8(12, s.speedOffset);
  out[13] = s.connectionMode;
  return out;
}
