import { logger } from "./logger.js";

/**
 * Download an image and return as a Buffer.
 */
export async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Seentbot/1.0 (Discord bot)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.debug(`Failed to download image: ${response.status} ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.debug(`Error downloading image: ${url} - ${error}`);
    return null;
  }
}

/**
 * Compute an average perceptual hash (pHash) of an image.
 * Returns a hex string representing the hash.
 *
 * The algorithm:
 * 1. Resize image to 8x8
 * 2. Convert to grayscale
 * 3. Compute average color
 * 4. Create 64-bit hash (8x8 pixels, each = avg or below)
 */
export async function computeImageHash(imageBuffer: Buffer): Promise<string | null> {
  try {
    // Use jimp to process image
    const { Jimp } = await import("jimp");

    const image = await Jimp.read(imageBuffer);

    // Resize to 8x8
    image.resize({ w: 8, h: 8 });

    // Convert to grayscale and get pixel data
    const grayscale = image.greyscale();
    const pixels = grayscale.bitmap.data;

    // Compute average brightness
    let sum = 0;
    const pixelValues: number[] = [];

    // Extract grayscale values (every 4th byte in RGBA)
    for (let i = 0; i < pixels.length; i += 4) {
      const value = pixels[i] as number; // R value (after grayscale, all channels equal)
      pixelValues.push(value);
      sum += value;
    }

    const avg = sum / pixelValues.length;

    // Create hash: 1 if pixel >= avg, 0 otherwise
    let hash = "";
    for (const value of pixelValues) {
      hash += value >= avg ? "1" : "0";
    }

    // Convert binary string to hex
    const hashNum = BigInt("0b" + hash);
    const hashHex = hashNum.toString(16).padStart(16, "0");

    logger.debug(`Computed image hash: ${hashHex}`);

    return hashHex;
  } catch (error) {
    logger.debug(`Error computing image hash: ${error}`);
    return null;
  }
}

/**
 * Calculate Hamming distance between two hash strings.
 * Lower distance = more similar images.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    // Pad shorter hash with zeros
    const maxLen = Math.max(hash1.length, hash2.length);
    hash1 = hash1.padStart(maxLen, "0");
    hash2 = hash2.padStart(maxLen, "0");
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * Calculate similarity percentage (100% = identical).
 */
export function hashSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  // 64 bits in average hash, so similarity = (64 - distance) / 64 * 100
  return ((64 - distance) / 64) * 100;
}