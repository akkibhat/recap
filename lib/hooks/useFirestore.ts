"use client";

import { useEffect, useState } from "react";
import {
  DocumentReference,
  Query,
  onSnapshot,
  DocumentData,
} from "firebase/firestore";

// Shared by every hook that needs a single live document, so the
// onSnapshot/useState/useEffect wiring only exists once.
export function useDocumentData<T>(
  ref: DocumentReference<DocumentData> | null,
  normalise: (id: string, data: DocumentData) => T
): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribedPath, setSubscribedPath] = useState<string | null>(null);

  // Render-time reset when ref changes to a new document, rather than a
  // synchronous setState inside the effect body (react-hooks/set-state-in-effect).
  if (ref && ref.path !== subscribedPath) {
    setSubscribedPath(ref.path);
    setLoading(true);
  }

  useEffect(() => {
    if (!ref) return;
    return onSnapshot(ref, (snap) => {
      setData(snap.exists() ? normalise(snap.id, snap.data()) : null);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.path]);

  if (!ref) return { data: null, loading: false };
  return { data, loading };
}

// Shared by every hook that needs a live, ordered list from a query.
export function useCollectionList<T>(
  query: Query<DocumentData> | null,
  normalise: (id: string, data: DocumentData) => T
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribedQuery, setSubscribedQuery] = useState<Query<DocumentData> | null>(null);

  if (query && query !== subscribedQuery) {
    setSubscribedQuery(query);
    setLoading(true);
  }

  useEffect(() => {
    if (!query) return;
    return onSnapshot(query, (snap) => {
      setData(snap.docs.map((doc) => normalise(doc.id, doc.data())));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!query) return { data: [], loading: false };
  return { data, loading };
}
