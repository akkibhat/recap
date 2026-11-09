"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

const GUEST_NAME_KEY = "recap:guestName";

// A guest's id is their Firebase Auth uid. Guests never see a sign-in: the
// first time a board screen opens, the browser is signed in anonymously in
// the background, and that uid sticks for as long as the browser keeps its
// storage. A host who is signed in with Google uses their own uid instead.
//
// Being a real signed-in uid is the point. The Firestore and Storage rules
// check request.auth.uid against contributorGuestId and authorGuestId, so a
// guest can only post as, edit, remove or react as themselves. (The old id
// was a random string anyone could copy out of a photo document.)
export function useGuestId(): { guestId: string | null; error: string | null } {
  const [guestId, setGuestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (user) {
          setGuestId(user.uid);
          return;
        }
        // Nobody signed in (a first visit, or a host who just signed out):
        // sign this browser in anonymously, and this listener fires again.
        setGuestId(null);
        signInAnonymously(auth).catch((err: unknown) => {
          console.error("Anonymous sign-in failed", err);
          setError("Couldn't connect to the board. Check your connection and reload.");
        });
      }),
    []
  );

  return { guestId, error };
}

// The name this guest put on their photos, or "" if they haven't set one.
export function getGuestName(): string {
  return localStorage.getItem(GUEST_NAME_KEY) ?? "";
}

// Remembers the guest's name in this browser.
export function setGuestName(name: string): void {
  localStorage.setItem(GUEST_NAME_KEY, name);
}
