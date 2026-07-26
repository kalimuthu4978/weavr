import User from "../models/User";

// Works out who a message mentions with @username.
//
// We resolve the names on the SERVER rather than trusting a list sent by the
// client, so nobody can craft a request that notifies people they didn't
// actually mention.

// Pulls the candidate names out of the text.
// "hey @alice and @bob_2!" -> ["alice", "bob_2"]
export function extractMentionNames(text: string) {
  if (!text || text.trim() === "") {
    return [];
  }

  // @ followed by letters, numbers, dots, dashes or underscores.
  // The @ must start the text or follow a space, so an email address like
  // bob@gmail.com isn't read as mentioning "gmail.com".
  // The "g" flag finds every match, not just the first.
  const mentionPattern = /(^|\s)@([a-zA-Z0-9._-]+)/g;

  const foundNames: string[] = [];
  let oneMatch = mentionPattern.exec(text);

  while (oneMatch !== null) {
    // Group 2 is the name; group 1 is the space (or start) before the @
    const nameWithoutAt = oneMatch[2];
    // Skip duplicates so mentioning someone twice only counts once
    if (!foundNames.includes(nameWithoutAt)) {
      foundNames.push(nameWithoutAt);
    }
    oneMatch = mentionPattern.exec(text);
  }

  return foundNames;
}

// Turns the names in a message into real user ids.
//
// allowedUserIds limits who can be mentioned - for a group message that's the
// group's members, so an @ can't be used to ping someone outside the group.
// Pass null to allow anyone (used for direct messages).
export async function resolveMentionedUserIds(
  text: string,
  senderId: string,
  allowedUserIds: string[] | null
) {
  const names = extractMentionNames(text);
  if (names.length === 0) {
    return [];
  }

  // Look the names up. Usernames are unique, so this is an exact match.
  const matchingUsers = await User.find({ username: { $in: names } }).select(
    "_id"
  );

  const mentionedIds: string[] = [];

  for (const oneUser of matchingUsers) {
    const userId = String(oneUser._id);

    // Mentioning yourself shouldn't notify you
    if (userId === senderId) {
      continue;
    }
    // For groups, only people actually in the group
    if (allowedUserIds !== null && !allowedUserIds.includes(userId)) {
      continue;
    }

    mentionedIds.push(userId);
  }

  return mentionedIds;
}
