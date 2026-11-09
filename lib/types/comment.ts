// Lives at boards/{boardId}/comments/{commentId}, nested under the board like
// photos. A top-level collection would need a where("boardId", ...) filter,
// and Firestore list rules can't inspect a query's filters, so allowing that
// query would allow listing every comment on the project. Nesting scopes the
// list by path: a caller has to know a board id to read anything.
export type Comment = {
  id: string;
  photoId: string;
  body: string;
  authorName: string;
  // The author's Firebase Auth uid, the same id that attributes photos and
  // reactions. The rules require it to match the signed-in user.
  authorGuestId: string;
  createdAt: number;
  deletedAt: number | null;
  deletedBy: string | null;
};

export const MAX_COMMENT_LENGTH = 500;

// The full document for a new comment, matching what the create rule expects.
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

// Fills defaults for any field missing on an older or partial document.
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

// False once a comment has been (soft) removed.
export function isCommentVisible(comment: Comment): boolean {
  return comment.deletedAt === null;
}
