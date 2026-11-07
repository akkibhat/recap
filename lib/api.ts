"use client";

import { getIdToken } from "@/lib/hooks/useAuth";

// Every host-privileged request carries whichever proofs are available: the
// board's hostKey from localStorage, and a Google ID token if the host is
// signed in. The server accepts either, so sending both means a host stays
// authorised whether they're on the device that created the board, signed in
// on a new one, or both.
async function hostHeaders(hostKey?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (hostKey) headers["x-host-key"] = hostKey;

  const token = await getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

// POSTs a JSON body with the host headers and returns the parsed reply, or
// throws the server's error message.
export async function postJson<T>(url: string, body: unknown, hostKey?: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await hostHeaders(hostKey)) },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// `body` is optional because most deletes identify their target entirely in
// the URL. Board deletion is the exception: it carries a typed confirmation,
// which belongs in the body rather than a query string so it stays out of
// server logs and browser history.
export async function deleteJson<T>(url: string, hostKey?: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(await hostHeaders(hostKey)),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Same error handling as postJson, for the handful of host-only reads that
// pull from boardSecrets - data the client can't get from Firestore directly
// because that collection is closed to every client.
export async function getJson<T>(url: string, hostKey?: string): Promise<T> {
  const res = await fetch(url, { headers: await hostHeaders(hostKey) });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
