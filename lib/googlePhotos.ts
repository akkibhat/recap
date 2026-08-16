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

export function getGooglePhotosAuthUrl(boardId: string): string {
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
    state: boardId,
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

// Two-step per the Photos Library API: upload raw bytes for an upload
// token, then batchCreate the actual media item (directly into the album).
export async function addPhotoToAlbum(
  accessToken: string,
  albumId: string,
  imageBytes: Buffer,
  filename: string
): Promise<void> {
  const uploadRes = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "X-Goog-Upload-Content-Type": "image/jpeg",
      "X-Goog-Upload-Protocol": "raw",
    },
    body: new Uint8Array(imageBytes),
  });
  if (!uploadRes.ok) throw new Error(`Google Photos byte upload failed: ${await uploadRes.text()}`);
  const uploadToken = await uploadRes.text();

  const createRes = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      albumId,
      newMediaItems: [{ simpleMediaItem: { uploadToken, fileName: filename } }],
    }),
  });
  if (!createRes.ok) throw new Error(`Google Photos media item creation failed: ${await createRes.text()}`);
}
