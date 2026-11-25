export const HEADER_LEN = 64, SIG_LEN = 64, BEGIN_LEN = HEADER_LEN + SIG_LEN;
const MAGIC = [0x4f, 0x48, 0x55, 0x31];
const FLAG_SIGNED = 0x0002;
export const UNSIGNED = 'File firmware không hợp lệ cho HUD';

export async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function loadPackage(bytes) {
  if (!MAGIC.every((b, i) => bytes[i] === b) || bytes.length <= BEGIN_LEN) throw new Error(`${UNSIGNED}.`);
  const begin = bytes.slice(0, BEGIN_LEN), header = begin.subarray(0, HEADER_LEN), image = bytes.subarray(BEGIN_LEN);
  const v = new DataView(begin.buffer);
  if (v.getUint16(4, true) !== 1) throw new Error(`${UNSIGNED}.`);
  if (v.getUint16(6, true) !== FLAG_SIGNED || v.getUint16(48, true) !== SIG_LEN) throw new Error(`${UNSIGNED}.`);
  if (v.getUint32(8, true) !== image.length) throw new Error(`${UNSIGNED}.`);
  const sha = await sha256(image);
  if (!sha.every((b, i) => b === header[16 + i])) throw new Error('File firmware bị hỏng.');
  return { header, begin, image };
}
