"use client";

// The gallery renders frames at roughly 313x470 CSS pixels, which is 1410 tall
// on a 3x phone screen. 1440 covers that exactly - 1200 left the thumbnail
// being upscaled by about 17% on the sharpest phones, which is the one thing a
// smaller image must not do here, since seeing the photo is the point.
//
// A 3024x4032 phone photo comes out 1080x1440, which is roughly a twentieth of
// the original's bytes.
const MAX_EDGE = 1440;
const QUALITY = 0.8;

// A video that never fires loadeddata or seeked - a codec the browser can't
// decode is the usual cause - must not hang the upload. Falling out here just
// means no poster frame.
const VIDEO_TIMEOUT_MS = 10_000;

export type Thumbnail = { blob: Blob; extension: string };
export type MediaProbe = { thumbnail: Thumbnail | null; durationSeconds: number | null };

// Draws a source onto a canvas no bigger than MAX_EDGE and encodes it as JPEG.
function drawToThumbnail(
  source: CanvasImageSource,
  width: number,
  height: number
): Promise<Thumbnail | null> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  context.drawImage(source, 0, 0, w, h);

  return new Promise((resolve) =>
    canvas.toBlob(
      // Always JPEG regardless of the source: these are photographs and video
      // frames, and a PNG of either is many times larger for no visible gain.
      (blob) => resolve(blob ? { blob, extension: "jpg" } : null),
      "image/jpeg",
      QUALITY
    )
  );
}

// Makes a gallery-sized copy of a photo, or none if it's already small enough.
async function probeImage(file: File): Promise<MediaProbe> {
  // imageOrientation matters: without it a photo carrying EXIF rotation
  // produces a thumbnail turned on its side relative to the original, so the
  // gallery and the lightbox would disagree about which way up it is.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  // Already small enough - a "thumbnail" here would be the same bytes with an
  // extra round trip, so skip it and let the original serve.
  if (Math.max(bitmap.width, bitmap.height) <= MAX_EDGE) {
    bitmap.close();
    return { thumbnail: null, durationSeconds: null };
  }

  const thumbnail = await drawToThumbnail(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return { thumbnail, durationSeconds: null };
}

// Pulls a poster frame out of a video so the gallery has something to show. A
// strip full of black rectangles would be useless, and there's no server-side
// transcoding here to do it for us.
async function probeVideo(file: File): Promise<MediaProbe> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  // muted + playsInline keep mobile Safari willing to decode a frame without a
  // user gesture, which it otherwise refuses.
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    const seeked = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), VIDEO_TIMEOUT_MS);
      const fail = () => {
        clearTimeout(timer);
        resolve(false);
      };

      video.onerror = fail;
      video.onloadeddata = () => {
        // A little way in rather than frame zero: the first frame of a phone
        // video is very often black while exposure settles.
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
      };
      video.onseeked = () => {
        clearTimeout(timer);
        resolve(true);
      };
    });

    const durationSeconds = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
    if (!seeked || !video.videoWidth) return { thumbnail: null, durationSeconds };

    const thumbnail = await drawToThumbnail(video, video.videoWidth, video.videoHeight);
    return { thumbnail, durationSeconds };
  } finally {
    video.src = "";
    URL.revokeObjectURL(objectUrl);
  }
}

// Builds a downscaled still for the gallery to load, leaving the original
// untouched - full resolution is what the lightbox plays or shows, what the zip
// export contains, and what reaches Google Photos.
//
// Never throws. An unusual format, a codec the browser can't decode into a
// canvas (HEIC straight off an iPhone is the realistic case), or a video whose
// metadata never arrives all yield no thumbnail, and callers fall back to the
// original - so the upload still succeeds, it just loads heavier. For a video
// that fallback means the gallery shows the video file itself as a poster,
// which browsers render as the first frame.
export async function probeMedia(file: File): Promise<MediaProbe> {
  try {
    if (file.type.startsWith("image/")) return await probeImage(file);
    if (file.type.startsWith("video/")) return await probeVideo(file);
    return { thumbnail: null, durationSeconds: null };
  } catch {
    return { thumbnail: null, durationSeconds: null };
  }
}
