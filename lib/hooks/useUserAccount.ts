"use client";

import { useMemo } from "react";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normaliseUserAccount, UserAccount } from "@/lib/types/userAccount";
import { useDocumentData } from "./useFirestore";

// Live account-level state for the signed-in host. Mainly exists so the
// Google Photos connection shows as connected the moment the OAuth callback
// redirects back, without polling or a manual refresh.
export function useUserAccount(uid: string | null) {
  const ref = useMemo(() => (uid ? doc(db, "users", uid) : null), [uid]);
  return useDocumentData<UserAccount>(ref, (_id, data) => normaliseUserAccount(data));
}
