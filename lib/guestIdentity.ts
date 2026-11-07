"use client";

import { nanoid } from "nanoid";

const GUEST_ID_KEY = "recap:guestId";
const GUEST_NAME_KEY = "recap:guestName";

// A guest never logs in - this id is generated once per browser and persisted
// in localStorage, purely to attribute uploads/reactions and let a guest
// change their own reaction on a photo without needing an account.
export function getOrCreateGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = nanoid(12);
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

// The name this guest put on their photos, or "" if they haven't set one.
export function getGuestName(): string {
  return localStorage.getItem(GUEST_NAME_KEY) ?? "";
}

// Remembers the guest's name in this browser.
export function setGuestName(name: string): void {
  localStorage.setItem(GUEST_NAME_KEY, name);
}
