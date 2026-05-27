import sharp from "sharp";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("seentbot");

const SAMPLE_SIZE = 32;
const LOW_SIZE = 8;

// Pre-computed DCT coefficients
function initSqrt(n: number): Float64Array {
  const c = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    c[i] = 1;
  }
  c[0] = 1 / Math.sqrt(2.0);
  return c;
}

const SQRT = initSqrt(SAMPLE_SIZE);

function initCos(n: number): Float64Array[] {
  const cosines: Float64Array[] = [];
  for (let k = 0; k < n; k++) {
    cosines[k] = new Float64Array(n);
    for (let nn = 0; nn < n; nn++) {
      cosines[k]![nn] = Math.cos(((2 * k + 1) / (2.0 * n)) * nn * Math.PI);
    }
  }
  return cosines;
}

const COS = initCos(SAMPLE_SIZE);

function applyDct(f: number[][], size: number): number[][] {
  const F: number[][] = [];
  for (let u = 0; u < size; u++) {
    F[u] = [];
    for (let v = 0; v < size; v++) {
      let sum = 0;
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          sum += COS[i]![u]! * COS[j]![v]! * f[i]![j]!;
        }
      }
      sum *= (SQRT[u]! * SQRT[v]!) / 4;
      F[u]![v] = sum;
    }
  }
  return F;
}

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
      logger.debug("Failed to download image", { status: response.status, url });
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.debug("Error downloading image", { url, error: String(error) });
    return null;
  }
}

/**
 * Compute a perceptual hash (pHash) of an image using DCT.
 * Returns a 64-character binary string representing the hash.
 *
 * The algorithm:
 * 1. Resize to 32x32 grayscale
 * 2. Apply 2D DCT (Discrete Cosine Transform)
 * 3. Take 8x8 low-frequency coefficients (top-left)
 * 4. Compare each coefficient to the average
 * 5. Create 64-bit hash (1 if > avg, 0 otherwise)
 *
 * Based on: http://www.hackerfactor.com/blog/?/archives/432-Looks-Like-It.html
 */
export async function computeImageHash(imageBuffer: Buffer): Promise<string | null> {
  try {
    const data = await sharp(imageBuffer)
      .greyscale()
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "fill" })
      .rotate()
      .raw()
      .toBuffer();

    // Build 2D signal array
    const s: number[][] = [];
    for (let x = 0; x < SAMPLE_SIZE; x++) {
      s[x] = [];
      for (let y = 0; y < SAMPLE_SIZE; y++) {
        s[x]![y] = data[SAMPLE_SIZE * y + x]!;
      }
    }

    // Apply 2D DCT
    const dct = applyDct(s, SAMPLE_SIZE);

    // Compute average of low-frequency coefficients (top-left 8x8)
    let totalSum = 0;
    for (let x = 0; x < LOW_SIZE; x++) {
      for (let y = 0; y < LOW_SIZE; y++) {
        totalSum += dct[x + 1]![y + 1]!;
      }
    }
    const avg = totalSum / (LOW_SIZE * LOW_SIZE);

    // Compute hash by comparing each coefficient to average
    let binaryHash = "";
    for (let x = 0; x < LOW_SIZE; x++) {
      for (let y = 0; y < LOW_SIZE; y++) {
        binaryHash += dct[x + 1]![y + 1]! > avg ? "1" : "0";
      }
    }

    // Convert binary string to hex for readability
    const hashHex = BigInt("0b" + binaryHash).toString(16).padStart(16, "0");

    logger.debug("Computed image hash", { hash: hashHex });

    return hashHex;
  } catch (error) {
    logger.debug("Error computing image hash", { error: String(error) });
    return null;
  }
}

/**
 * Convert hex hash to binary string for comparison.
 */
function hexToBinary(hex: string): string {
  return hex
    .split("")
    .map((c) => parseInt(c, 16).toString(2).padStart(4, "0"))
    .join("");
}

/**
 * Calculate Hamming distance between two hash strings.
 * Lower distance = more similar images.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  const binary1 = hexToBinary(hash1);
  const binary2 = hexToBinary(hash2);

  let distance = 0;
  for (let i = 0; i < binary1.length; i++) {
    if (binary1[i] !== binary2[i]) {
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
  // 64 bits in DCT pHash, so similarity = (64 - distance) / 64 * 100
  return ((64 - distance) / 64) * 100;
}