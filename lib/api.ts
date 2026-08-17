"use client";

export async function postJson<T>(url: string, body: unknown, hostKey?: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(hostKey ? { "x-host-key": hostKey } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Same error handling as postJson, for the handful of host-only reads that
// pull from boardSecrets - data the client can't get from Firestore directly
// because that collection is closed to every client.
export async function getJson<T>(url: string, hostKey?: string): Promise<T> {
  const res = await fetch(url, {
    headers: hostKey ? { "x-host-key": hostKey } : {},
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
