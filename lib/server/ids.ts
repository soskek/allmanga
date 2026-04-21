import { canonicalizeUrl } from "@/lib/utils";

export function createIdFromUrl(siteId: string, url: string) {
  const hash = sha1Hex(`${siteId}:${canonicalizeUrl(url)}`);
  return `${siteId}_${hash}`;
}

function sha1Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const words: number[] = [];

  for (let index = 0; index < bytes.length * 8; index += 8) {
    words[index >> 5] |= bytes[index / 8] << (24 - (index % 32));
  }

  words[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  words[(((bytes.length + 8) >> 6) + 1) * 16 - 1] = bytes.length * 8;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  for (let blockStart = 0; blockStart < words.length; blockStart += 16) {
    const schedule = new Array<number>(80);
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = words[blockStart + index] || 0;
    }
    for (let index = 16; index < 80; index += 1) {
      schedule[index] = rotateLeft(schedule[index - 3] ^ schedule[index - 8] ^ schedule[index - 14] ^ schedule[index - 16], 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let index = 0; index < 80; index += 1) {
      const [fn, constant] =
        index < 20
          ? [((b & c) | (~b & d)) >>> 0, 0x5a827999]
          : index < 40
            ? [(b ^ c ^ d) >>> 0, 0x6ed9eba1]
            : index < 60
              ? [((b & c) | (b & d) | (c & d)) >>> 0, 0x8f1bbcdc]
              : [(b ^ c ^ d) >>> 0, 0xca62c1d6];

      const temp = (rotateLeft(a, 5) + fn + e + constant + schedule[index]) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30) >>> 0;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map((part) => part.toString(16).padStart(8, "0")).join("");
}

function rotateLeft(value: number, bits: number) {
  return (value << bits) | (value >>> (32 - bits));
}
