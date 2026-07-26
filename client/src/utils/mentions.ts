// Helpers for the @username mention feature on the client side.
//
// The server is what actually decides who got mentioned. These functions only
// deal with typing an @ and showing it nicely once it arrives back.

// Looks at what the user has typed so far and works out whether they are
// part-way through an @mention.
//
// "hello @al" -> "al"   (show the picker, filtered by "al")
// "hello @al " -> null  (they finished the word, hide the picker)
// "hello" -> null
export function getMentionBeingTyped(text: string) {
  // Only care about the very end of what they've typed
  const lastAtPosition = text.lastIndexOf("@");
  if (lastAtPosition === -1) {
    return null;
  }

  // An @ only starts a mention at the very beginning, or after a space
  const characterBefore = lastAtPosition > 0 ? text[lastAtPosition - 1] : " ";
  if (characterBefore !== " ") {
    return null;
  }

  const afterTheAt = text.slice(lastAtPosition + 1);

  // A space means they've finished typing the name
  if (afterTheAt.includes(" ")) {
    return null;
  }

  return afterTheAt;
}

// Replaces the half-typed @mention with the full username.
// ("hi @al", "alice") -> "hi @alice "
export function completeMention(text: string, username: string) {
  const lastAtPosition = text.lastIndexOf("@");
  if (lastAtPosition === -1) {
    return text;
  }

  const beforeTheAt = text.slice(0, lastAtPosition);
  // Trailing space so they can carry straight on typing
  return beforeTheAt + "@" + username + " ";
}

// Splits message text into plain pieces and mention pieces, so the mentions
// can be styled differently when rendered.
//
// "hi @alice ok" -> [
//   { text: "hi ", isMention: false },
//   { text: "@alice", isMention: true },
//   { text: " ok", isMention: false },
// ]
export function splitTextByMentions(text: string) {
  const pieces: { text: string; isMention: boolean }[] = [];

  if (!text || text === "") {
    return pieces;
  }

  // Same shape of name the server looks for
  const mentionPattern = /@([a-zA-Z0-9._-]+)/g;

  let positionSoFar = 0;
  let oneMatch = mentionPattern.exec(text);

  while (oneMatch !== null) {
    // The ordinary text sitting before this mention
    if (oneMatch.index > positionSoFar) {
      pieces.push({
        text: text.slice(positionSoFar, oneMatch.index),
        isMention: false,
      });
    }

    pieces.push({ text: oneMatch[0], isMention: true });

    positionSoFar = oneMatch.index + oneMatch[0].length;
    oneMatch = mentionPattern.exec(text);
  }

  // Whatever is left after the final mention
  if (positionSoFar < text.length) {
    pieces.push({ text: text.slice(positionSoFar), isMention: false });
  }

  return pieces;
}
