export type ReactionEmoji = "heart" | "laugh" | "fire" | "wow";

export const REACTION_EMOJIS: ReactionEmoji[] = ["heart", "laugh", "fire", "wow"];

// Lives at boards/{boardId}/photos/{photoId}. There is deliberately no
// boardId field: the path is the only record of which board a photo belongs
// to, so the two can never disagree.
export type Photo = {
  id: string;
  storagePath: string;
  downloadUrl: string;
  caption: string;
  contributorName: string;
  contributorGuestId: string;
  uploadedAt: number;
  // guestId -> the single reaction that guest picked for this photo (one per guest, can change)
  reactedBy: Record<string, ReactionEmoji>;
  googlePhotosMediaItemId: string | null;
  // Soft delete. Deleting hides a photo everywhere a guest can see it, but
  // never removes the doc or the Storage object - partly so a misfire is
  // recoverable from the admin page, and partly because a guest's claim to
  // own a photo is only a localStorage id and therefore spoofable. Nothing a
  // client can do here destroys anything.
  deletedAt: number | null;
  // The guestId that deleted it, or "host" when it came from the host's own
  // moderation route.
  deletedBy: string | null;
};

export function newPhotoFields(input: {
  storagePath: string;
  downloadUrl: string;
  caption: string;
  contributorName: string;
  contributorGuestId: string;
}): Omit<Photo, "id"> {
  return {
    storagePath: input.storagePath,
    downloadUrl: input.downloadUrl,
    caption: input.caption,
    contributorName: input.contributorName,
    contributorGuestId: input.contributorGuestId,
    uploadedAt: Date.now(),
    reactedBy: {},
    googlePhotosMediaItemId: null,
    deletedAt: null,
    deletedBy: null,
  };
}

export function normalisePhoto(id: string, data: Partial<Photo>): Photo {
  return {
    id,
    storagePath: data.storagePath ?? "",
    downloadUrl: data.downloadUrl ?? "",
    caption: data.caption ?? "",
    contributorName: data.contributorName ?? "Someone",
    contributorGuestId: data.contributorGuestId ?? "",
    uploadedAt: data.uploadedAt ?? Date.now(),
    reactedBy: data.reactedBy ?? {},
    googlePhotosMediaItemId: data.googlePhotosMediaItemId ?? null,
    deletedAt: data.deletedAt ?? null,
    deletedBy: data.deletedBy ?? null,
  };
}

// Every read path should go through this rather than testing `deletedAt`
// directly, so there's one definition of "still on the roll" to change if
// deletion ever grows a second state (hidden, reported, expired).
export function isVisible(photo: Photo): boolean {
  return photo.deletedAt === null;
}

// Counts are always derived from reactedBy rather than stored separately,
// so there's never a chance of the tally drifting from who-actually-reacted.
export function reactionCounts(photo: Photo): Record<ReactionEmoji, number> {
  const counts: Record<ReactionEmoji, number> = { heart: 0, laugh: 0, fire: 0, wow: 0 };
  for (const emoji of Object.values(photo.reactedBy)) {
    counts[emoji]++;
  }
  return counts;
}
