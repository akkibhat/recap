// Lives at boards/{boardId}/comments/{commentId} - a subcollection, unlike
// photos which are top-level with a boardId field.
//
// That's deliberate. A top-level collection can only be queried with a
// where("boardId", "==", …) filter, and Firestore list rules can't inspect a
// query's filters - so permitting the query at all permits listing every
// comment on the project. Nesting under the board scopes the list by path
// instead, and a caller has to know a board id to read anything.
export type Comment = {
  id: string;
  photoId: string;
  body: string;
  authorName: string;
  // Same localStorage nanoid that attributes photos and reactions. Spoofable,
  // which is why deletion here is soft exactly as it is for photos.
  authorGuestId: string;
  createdAt: number;
  deletedAt: number | null;
  deletedBy: string | null;
};

export const MAX_COMMENT_LENGTH = 500;

export function newCommentFields(input: {
  photoId: string;
  body: string;
  authorName: string;
  authorGuestId: string;
}): Omit<Comment, "id"> {
  return {
    photoId: input.photoId,
    body: input.body,
    authorName: input.authorName,
    authorGuestId: input.authorGuestId,
    createdAt: Date.now(),
    deletedAt: null,
    deletedBy: null,
  };
}

export function normaliseComment(id: string, data: Partial<Comment>): Comment {
  return {
    id,
    photoId: data.photoId ?? "",
    body: data.body ?? "",
    authorName: data.authorName ?? "Someone",
    authorGuestId: data.authorGuestId ?? "",
    createdAt: data.createdAt ?? Date.now(),
    deletedAt: data.deletedAt ?? null,
    deletedBy: data.deletedBy ?? null,
  };
}

export function isCommentVisible(comment: Comment): boolean {
  return comment.deletedAt === null;
}
