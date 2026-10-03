import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(2, 9); // Color type 2 (RGB)
  ihdrData.writeUInt8(0, 10); // Compression 0
  ihdrData.writeUInt8(0, 11); // Filter 0
  ihdrData.writeUInt8(0, 12); // Interlace 0

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data: height scanlines, each starting with filter byte 0 followed by width * 3 bytes
  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      // Soft gradient from (8, 145, 178) cyan to (14, 116, 144)
      const factor = (x + y) / (width + height);
      rawData[pxOffset] = Math.round(r * (1 - factor * 0.2));
      rawData[pxOffset + 1] = Math.round(g * (1 - factor * 0.2));
      rawData[pxOffset + 2] = Math.round(b * (1 - factor * 0.2));
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(4 + 4 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4);
  data.copy(buffer, 8);
  const crc = crc32(buffer.subarray(4, 8 + length));
  buffer.writeUInt32BE(crc, 8 + length);
  return buffer;
}

// Simple CRC32 implementation
function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const cyanR = 8;
const cyanG = 145;
const cyanB = 178;

if (!fs.existsSync('public')) fs.mkdirSync('public');

fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, cyanR, cyanG, cyanB));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, cyanR, cyanG, cyanB));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPNG(512, 512, cyanR, cyanG, cyanB));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, cyanR, cyanG, cyanB));

console.log('Successfully generated PWA PNG icons!');
