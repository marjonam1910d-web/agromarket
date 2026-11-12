/**
 * Qaramliksiz QR kod generatori (ISO/IEC 18004): bayt rejimi, xato tuzatish darajasi M, 1–10 versiyalar.
 * Shartnoma havolalari (~60–100 belgi) uchun yetarli. Natija — SVG.
 */

// Versiya bo'yicha: [jami kodli so'zlar, blokdagi ECC so'zlar, 1-guruh bloklar, 1-guruh blok hajmi, 2-guruh bloklar, 2-guruh blok hajmi] (M daraja)
const EC_M: [number, number, number, number, number][] = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
];
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// GF(256) arifmetikasi
const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenerator(degree: number) {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}
function rsRemainder(data: number[], degree: number) {
  const gen = rsGenerator(degree);
  const res = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ res.shift()!;
    res.push(0);
    for (let i = 0; i < degree; i++) res[i] ^= mul(gen[i + 1], factor);
  }
  return res;
}

function encodeData(text: string) {
  const bytes = Array.from(Buffer.from(text, 'utf8'));
  for (let v = 1; v <= 10; v++) {
    const [ecPer, g1, s1, g2, s2] = EC_M[v - 1];
    const dataCw = g1 * s1 + g2 * s2;
    const countBits = v < 10 ? 8 : 16;
    const needBits = 4 + countBits + bytes.length * 8;
    if (needBits > dataCw * 8) continue;
    const bits: number[] = [];
    const put = (val: number, len: number) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    put(0b0100, 4);
    put(bytes.length, countBits);
    for (const b of bytes) put(b, 8);
    put(0, Math.min(4, dataCw * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const cw: number[] = [];
    for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let pad = 0; cw.length < dataCw; pad++) cw.push(pad % 2 ? 0x11 : 0xec);
    // bloklarga bo'lish va ECC
    const blocks: number[][] = [];
    let off = 0;
    for (let i = 0; i < g1; i++) blocks.push(cw.slice(off, (off += s1)));
    for (let i = 0; i < g2; i++) blocks.push(cw.slice(off, (off += s2)));
    const eccs = blocks.map((b) => rsRemainder(b, ecPer));
    const out: number[] = [];
    const maxLen = Math.max(s1, s2);
    for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
    for (let i = 0; i < ecPer; i++) for (const e of eccs) out.push(e[i]);
    return { version: v, codewords: out };
  }
  throw new Error('QR: matn juda uzun');
}

export function qrMatrix(text: string): boolean[][] {
  const { version, codewords } = encodeData(text);
  const size = 17 + version * 4;
  const m: (boolean | null)[][] = Array.from({ length: size }, () => new Array<boolean | null>(size).fill(null));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (r: number, c: number, v: boolean) => {
    m[r][c] = v;
    fn[r][c] = true;
  };
  // Qidiruv naqshlari
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark = inner && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(rr, cc, dark);
      }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);
  // Tekislash naqshlari
  const al = ALIGN[version - 1];
  for (const r of al)
    for (const c of al) {
      if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  // Vaqt chiziqlari
  for (let i = 8; i < size - 8; i++) {
    if (!fn[6][i]) set(6, i, i % 2 === 0);
    if (!fn[i][6]) set(i, 6, i % 2 === 0);
  }
  // Format va versiya joylarini band qilish
  for (let i = 0; i < 9; i++) {
    if (!fn[8][i]) set(8, i, false);
    if (!fn[i][8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, false);
    set(size - 1 - i, 8, false);
  }
  set(size - 8, 8, true); // qora modul
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit);
      set(b, a, bit);
    }
  }
  // Ma'lumotlarni zigzag bo'yicha joylash
  const dataBits: number[] = [];
  for (const b of codewords) for (let i = 7; i >= 0; i--) dataBits.push((b >>> i) & 1);
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vert : vert;
        if (fn[r][c]) continue;
        m[r][c] = k < dataBits.length ? dataBits[k++] === 1 : false;
      }
    }
  }
  // Niqob tanlash (jarima ballari bo'yicha)
  const masks: ((r: number, c: number) => boolean)[] = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];
  const formatBits = (mask: number) => {
    const data = (0b00 << 3) | mask; // M daraja = 00
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  };
  const build = (mask: number) => {
    const g = m.map((row, r) => row.map((v, c) => (fn[r][c] ? Boolean(v) : Boolean(v) !== masks[mask](r, c))));
    const bits = formatBits(mask);
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    // g[qator][ustun]
    for (let i = 0; i <= 5; i++) g[i][8] = bit(i);
    g[7][8] = bit(6);
    g[8][8] = bit(7);
    g[8][7] = bit(8);
    for (let i = 9; i < 15; i++) g[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i++) g[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) g[size - 15 + i][8] = bit(i);
    g[size - 8][8] = true;
    return g;
  };
  const penalty = (g: boolean[][]) => {
    let p = 0;
    for (let i = 0; i < size; i++) {
      for (const line of [g[i], g.map((row) => row[i])]) {
        let run = 1;
        for (let j = 1; j < size; j++) {
          if (line[j] === line[j - 1]) run++;
          else {
            if (run >= 5) p += run - 2;
            run = 1;
          }
        }
        if (run >= 5) p += run - 2;
      }
    }
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) p += 3;
    const dark = g.flat().filter(Boolean).length;
    p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return p;
  };
  let best = build(0);
  let bestP = penalty(best);
  for (let i = 1; i < 8; i++) {
    const g = build(i);
    const p = penalty(g);
    if (p < bestP) {
      best = g;
      bestP = p;
    }
  }
  return best;
}

export function qrSvg(text: string, opts: { color?: string; margin?: number } = {}) {
  const g = qrMatrix(text);
  const margin = opts.margin ?? 4;
  const n = g.length + margin * 2;
  let path = '';
  g.forEach((row, r) => row.forEach((v, c) => {
    if (v) path += `M${c + margin} ${r + margin}h1v1h-1z`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="${opts.color ?? '#111'}"/></svg>`;
}
