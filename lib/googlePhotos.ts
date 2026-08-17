// Server-only. Raw fetch calls against Google's OAuth + Photos Library REST
// APIs rather than pulling in the full googleapis package for what's a
// handful of endpoints.
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "http://localhost:3001/api/google-photos/callback";
const SCOPE = "https://www.googleapis.com/auth/photoslibrary.appendonly";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} - Google Photos isn't configured yet.`);
  return value;
}

// `state` is an opaque nonce recorded server-side, not a subject identifier -
// see the connect route for why.
export function getGooglePhotosAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // Forces Google to return a refresh_token even if this host authorized
    // before - otherwise a repeat auth (e.g. after the 7-day testing-mode
    // token expiry) silently omits it.
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string | null }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  const data = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (may need reconnecting): ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function createAlbum(accessToken: string, title: string): Promise<{ id: string; productUrl: string }> {
  const res = await fetch("https://photoslibrary.googleapis.com/v1/albums", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ album: { title } }),
  });
  if (!res.ok) throw new Error(`Google Photos album creation failed: ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, productUrl: data.productUrl };
}

// Google's own cap on mediaItems:batchCreate.
export const MEDIA_ITEM_BATCH_LIMIT = 50;

// Step one of two: hand Google the bytes and get back a token standing in for
// them. Nothing exists in the library yet at this point.
export async function uploadPhotoBytes(
  accessToken: string,
  imageBytes: Buffer,
  // Google rejects the upload if this doesn't match the bytes, so it has to be
  // the type recorded at upload rather than a hardcoded guess. Videos were
  // silently impossible while this said image/jpeg.
  contentType: string
): Promise<string> {
  const res = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "X-Goog-Upload-Content-Type": contentType,
      "X-Goog-Upload-Protocol": "raw",
    },
    body: new Uint8Array(imageBytes),
  });
  if (!res.ok) throw new Error(`Google Photos byte upload failed: ${await res.text()}`);
  return res.text();
}

export type CreatedMediaItem = { uploadToken: string; mediaItemId: string | null };

// Step two: turn up to 50 upload tokens into album entries in a single call.
// This used to run once per photo, so a hundred-photo board made two hundred
// round trips to Google instead of a hundred and two.
//
// Returns each token's resulting media item id so the caller can record which
// photos are already in the album, which is what makes a retry skip them.
export async function createMediaItems(
  accessToken: string,
  albumId: string,
  items: { uploadToken: string; filename: string }[]
): Promise<CreatedMediaItem[]> {
  if (items.length === 0) return [];
  if (items.length > MEDIA_ITEM_BATCH_LIMIT) {
    throw new Error(`batchCreate accepts at most ${MEDIA_ITEM_BATCH_LIMIT} items`);
  }

  const res = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      albumId,
      newMediaItems: items.map((item) => ({
        simpleMediaItem: { uploadToken: item.uploadToken, fileName: item.filename },
      })),
    }),
  });
  if (!res.ok) throw new Error(`Google Photos media item creation failed: ${await res.text()}`);

  const data = await res.json();
  const results: { uploadToken?: string; status?: { message?: string }; mediaItem?: { id?: string } }[] =
    data.newMediaItemResults ?? [];

  // A batch can partially succeed: the call returns 200 and reports per-item
  // status. Treating the whole batch as successful because the HTTP call was
  // would mark photos archived that Google actually rejected - and this
  // archive deletes Storage copies on success.
  const failed = results.filter((r) => r.status?.message && r.status.message !== "Success");
  if (failed.length > 0) {
    throw new Error(
      `Google Photos rejected ${failed.length} of ${results.length}: ${failed[0].status?.message}`
    );
  }

  return results.map((r) => ({
    uploadToken: r.uploadToken ?? "",
    mediaItemId: r.mediaItem?.id ?? null,
  }));
}
