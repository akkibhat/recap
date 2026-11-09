"use client";

import { useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export type AuthState = {
  user: User | null;
  // Distinct from `user === null`. Firebase restores a persisted session
  // asynchronously, so on first render nobody is signed in yet even when they
  // are - anything that redirects or hides UI on "not signed in" has to wait
  // for this to go false or it will flash for a returning host.
  loading: boolean;
};

// The signed-in host, kept live as they sign in or out. Guests are signed in
// too, anonymously (see useGuestId), but they're never a host: an anonymous
// user reads as nobody here, so the host UI never shows to a guest.
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next && !next.isAnonymous ? next : null);
        setLoading(false);
      }),
    []
  );

  return { user, loading };
}

// Opens Google's sign-in popup.
export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

// Signs the host out of this browser.
export async function signOutHost(): Promise<void> {
  await signOut(auth);
}

// The bearer token every host-privileged API route accepts as an alternative
// to a board's hostKey. Returns null when nobody is signed in, which is a
// normal state here rather than an error - a host who isn't signed in on this
// device can still have the board's key in localStorage.
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  return user && !user.isAnonymous ? user.getIdToken() : null;
}
