"use client";

// The gallery renders frames at roughly 313x470 CSS pixels, which is 1410 tall
// on a 3x phone screen. 1440 covers that exactly - 1200 left the thumbnail
// being upscaled by about 17% on the sharpest phones, which is the one thing a
// smaller image must not do here, since seeing the photo is the point.
//
// A 3024x4032 phone photo comes out 1080x1440, which is still roughly a tenth
// of the original's bytes.
const MAX_EDGE = 1440;
const QUALITY = 0.8;

export type Thumbnail = { blob: Blob; extension: string };

// Builds a downscaled copy of an image for the gallery to load, leaving the
// original untouched - full resolution still gets uploaded and is what the
// lightbox and the Google Photos archive use.
//
// Returns null rather than throwing when it can't do the work: an unusual
// format, a codec the browser can't decode into a canvas (HEIC straight off an
// iPhone is the realistic case), or a video once those are supported. Callers
// treat null as "no thumbnail" and fall back to the original, so a photo the
// browser can't downscale still uploads fine - it just loads heavier.
export async function makeThumbnail(file: File): Promise<Thumbnail | null> {
  if (!file.type.startsWith("image/")) return null;

  try {
    // imageOrientation matters: without it a photo carrying EXIF rotation
    // produces a thumbnail turned on its side relative to the original, so the
    // gallery and the lightbox would disagree about which way up it is.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    // Already small enough - a "thumbnail" here would be the same bytes with
    // an extra round trip, so skip it and let the original serve.
    if (scale === 1) {
      bitmap.close();
      return null;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    if (!blob) return null;

    // Always JPEG regardless of the source: these are photographs, and a PNG
    // thumbnail of one is many times larger for no visible gain.
    return { blob, extension: "jpg" };
  } catch {
    return null;
  }
}
