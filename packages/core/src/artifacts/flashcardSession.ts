/**
 * A flashcard revision session: one card at a time, the reader reveals the
 * answer, then says whether they knew it. The last card ends on a summary that
 * offers to go over only the cards they missed (mockup
 * `mobile-design-mockups/flashcards_ux/`, direction B).
 *
 * Shared by the mobile artifact screen and the web AI pane. The session lives
 * as long as the screen does: nothing is stored, so leaving and coming back
 * starts a new one.
 */

export type FlashcardRating = "known" | "again";

export interface FlashcardSession {
  /** Indexes into the artifact's cards, in the order of this round. */
  readonly order: readonly number[];
  /** Position in `order`; equals `order.length` once the round is over. */
  readonly position: number;
  readonly revealed: boolean;
  /** Card indexes rated "known" in this round. */
  readonly known: readonly number[];
  /** Card indexes rated "again" in this round, in the order they were rated. */
  readonly again: readonly number[];
}

export type FlashcardAction =
  | { type: "reveal" }
  | { type: "rate"; rating: FlashcardRating }
  | { type: "restart"; cardCount: number }
  | { type: "reviewMissed" };

function startRound(order: readonly number[]): FlashcardSession {
  return { order, position: 0, revealed: false, known: [], again: [] };
}

export function startFlashcardSession(cardCount: number): FlashcardSession {
  return startRound(Array.from({ length: cardCount }, (_, i) => i));
}

export function isFlashcardRoundOver(session: FlashcardSession): boolean {
  return session.position >= session.order.length;
}

export function flashcardSessionReducer(
  session: FlashcardSession,
  action: FlashcardAction,
): FlashcardSession {
  switch (action.type) {
    case "reveal":
      return isFlashcardRoundOver(session)
        ? session
        : { ...session, revealed: true };
    case "rate": {
      if (isFlashcardRoundOver(session) || !session.revealed) return session;
      const card = session.order[session.position];
      return {
        ...session,
        position: session.position + 1,
        revealed: false,
        known: action.rating === "known" ? [...session.known, card] : session.known,
        again: action.rating === "again" ? [...session.again, card] : session.again,
      };
    }
    case "restart":
      return startFlashcardSession(action.cardCount);
    case "reviewMissed":
      return session.again.length > 0 ? startRound(session.again) : session;
  }
}
