import { deflateSync, inflateSync } from "zlib";

/**
 * Wrap a rendered PNG in a PDF at a stated physical size.
 *
 * WHY A PDF AT ALL, WHEN THE PNG IS ALREADY 300DPI. Because a PNG does not
 * say how big it is. It says 1016 by 1476 pixels, and every print shop then
 * decides for itself what that means: one scales it to the page, one assumes
 * 72dpi and prints a tag the size of a paperback, one asks you to send a PDF
 * instead. A PDF carries a MediaBox in points, so 86 by 125 millimetres is a
 * measurement the file itself makes rather than a thing you have to put in
 * the email and hope somebody reads.
 *
 * WHY THIS IS HAND-ROLLED. The project has no PDF library and no image
 * library, and this needs about eighty lines of the PDF spec rather than a
 * dependency and its transitive tree in every deploy. What it emits is a
 * single-page PDF 1.4 with one image drawn across the whole page, which is
 * the simplest thing a printer will accept and the hardest to get wrong.
 *
 * It is a raster inside a PDF, not vector artwork. Nothing is lost by that:
 * the source is a PNG from Satori, so it was never vector to begin with. At
 * 300dpi it is press quality for anything at this size.
 */

/** Points per millimetre. PDF measures in points, printers talk millimetres. */
const PT_PER_MM = 72 / 25.4;

interface Png {
  width: number;
  height: number;
  /** Interleaved 8-bit samples, alpha already composited away. */
  rgb: Buffer;
}

/**
 * Decode a PNG far enough to get RGB samples out of it.
 *
 * Only what Satori emits is supported: 8 bits per channel, colour type 2
 * (RGB) or 6 (RGBA), not interlaced. Anything else throws rather than
 * producing a subtly wrong image, because a tag that prints with the colours
 * shifted is worse than one that does not print.
 */
function decodePng(png: Buffer): Png {
  if (png.length < 33 || png.readUInt32BE(0) !== 0x89504e47) {
    throw new Error("Not a PNG");
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const bitDepth = png[24];
  const colourType = png[25];
  const interlace = png[28];
  if (bitDepth !== 8 || (colourType !== 2 && colourType !== 6) || interlace !== 0) {
    throw new Error(
      `Unsupported PNG: depth ${bitDepth}, colour type ${colourType}, interlace ${interlace}`
    );
  }
  const channels = colourType === 6 ? 4 : 3;

  // IDAT can be split across chunks; the compressed stream is their
  // concatenation, not each one separately.
  const parts: Buffer[] = [];
  let i = 8;
  while (i + 8 <= png.length) {
    const len = png.readUInt32BE(i);
    const type = png.toString("ascii", i + 4, i + 8);
    if (type === "IDAT") parts.push(png.subarray(i + 8, i + 8 + len));
    if (type === "IEND") break;
    i += 12 + len;
  }
  if (parts.length === 0) throw new Error("PNG has no image data");

  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);

  /**
   * Undo the per-row filters.
   *
   * Each row is one filter byte then its samples, and every filter predicts
   * a byte from its left neighbour, the one above, or both, so the rows have
   * to be walked in order and in place. This is the only genuinely fiddly
   * part of reading a PNG and it is worth doing exactly rather than nearly:
   * an off-by-one in the Paeth case does not fail, it just skews the image
   * into diagonal smears.
   */
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const rowStart = y * stride;
    const prevStart = rowStart - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[pos + x];
      const a = x >= channels ? out[rowStart + x - channels] : 0;
      const b = y > 0 ? out[prevStart + x] : 0;
      const c = y > 0 && x >= channels ? out[prevStart + x - channels] : 0;
      let r: number;
      switch (filter) {
        case 0:
          r = v;
          break;
        case 1:
          r = v + a;
          break;
        case 2:
          r = v + b;
          break;
        case 3:
          r = v + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`Unknown PNG filter ${filter} on row ${y}`);
      }
      out[rowStart + x] = r & 0xff;
    }
    pos += stride;
  }

  if (channels === 3) return { width, height, rgb: out };

  /**
   * Composite onto white rather than simply dropping the alpha channel.
   *
   * The tags are opaque, so this is almost always a straight copy — but a
   * partly transparent pixel whose alpha is discarded prints as whatever
   * colour happened to be under it, which on an antialiased edge is a dark
   * fringe. Paper is white; compositing onto white is what the printer is
   * going to do anyway.
   */
  const rgb = Buffer.alloc(width * height * 3);
  for (let p = 0, q = 0; p < out.length; p += 4, q += 3) {
    const alpha = out[p + 3];
    if (alpha === 255) {
      rgb[q] = out[p];
      rgb[q + 1] = out[p + 1];
      rgb[q + 2] = out[p + 2];
    } else {
      const inv = 255 - alpha;
      rgb[q] = (out[p] * alpha + 255 * inv) / 255;
      rgb[q + 1] = (out[p + 1] * alpha + 255 * inv) / 255;
      rgb[q + 2] = (out[p + 2] * alpha + 255 * inv) / 255;
    }
  }
  return { width, height, rgb };
}

/**
 * A single-page PDF holding one PNG, sized in millimetres.
 *
 * `title` becomes the document title, which is what a print shop's queue
 * shows instead of "Untitled" or a route name.
 */
export function pngToPdf(png: Buffer, mmWidth: number, mmHeight: number, title: string): Buffer {
  const { width, height, rgb } = decodePng(png);
  const data = deflateSync(rgb);

  const pw = +(mmWidth * PT_PER_MM).toFixed(3);
  const ph = +(mmHeight * PT_PER_MM).toFixed(3);

  // The image is drawn across the whole MediaBox, so the page IS the artwork
  // and there is no margin for a printer to interpret.
  const content = Buffer.from(`q\n${pw} 0 0 ${ph} 0 0 cm\n/Im0 Do\nQ\n`, "latin1");

  // Dates in PDF are D:YYYYMMDDHHmmSS, and a file with no date is one that
  // sorts unpredictably in whatever the shop drops it into.
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `D:${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}` +
    `${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())}Z`;

  // Parentheses and backslashes end or escape a PDF string, so a title
  // carrying one would truncate the object and corrupt the file.
  const safeTitle = title.replace(/([\\()])/g, "\\$1");

  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] ` +
        `/Resources << /XObject << /Im0 5 0 R >> /ProcSet [/PDF /ImageC] >> ` +
        `/Contents 4 0 R >>`,
      "latin1"
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"),
      content,
      Buffer.from("endstream", "latin1"),
    ]),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
          `/Length ${data.length} >>\nstream\n`,
        "latin1"
      ),
      data,
      Buffer.from("\nendstream", "latin1"),
    ]),
    Buffer.from(
      `<< /Title (${safeTitle}) /Producer (LinkUpNaija) /CreationDate (${stamp}) >>`,
      "latin1"
    ),
  ];

  /**
   * The cross-reference table is byte offsets into this very file, so the
   * parts have to be assembled in order and measured as they go. Get one
   * offset wrong and some readers repair it silently while others refuse the
   * file outright, which is the kind of bug you discover at the print shop.
   */
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  let offset = chunks[0].length;
  const offsets: number[] = [];

  objects.forEach((body, idx) => {
    const obj = Buffer.concat([
      Buffer.from(`${idx + 1} 0 obj\n`, "latin1"),
      body,
      Buffer.from("\nendobj\n", "latin1"),
    ]);
    offsets.push(offset);
    offset += obj.length;
    chunks.push(obj);
  });

  const count = objects.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  xref +=
    `trailer\n<< /Size ${count} /Root 1 0 R /Info ${objects.length} 0 R >>\n` +
    `startxref\n${offset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(chunks);
}

export { PT_PER_MM };
