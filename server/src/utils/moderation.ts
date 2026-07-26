// Helpers for hiding messages an admin has moderated.
//
// A hidden message is NOT deleted - it stays in the database so there is a
// record of what happened. But its content must not reach other users, so we
// strip the text and any attachment before sending it out. The client sees
// isHidden === true and shows a "removed by an admin" placeholder instead.

// Cleans ONE message document for sending to a client.
export function stripIfHidden(oneMessage: any) {
  // .toObject() turns the Mongoose document into a plain object we can safely
  // edit without changing what's stored in the database.
  const plainMessage = oneMessage.toObject ? oneMessage.toObject() : oneMessage;

  if (!plainMessage.isHidden) {
    return plainMessage;
  }

  plainMessage.text = "";
  plainMessage.fileUrl = "";
  plainMessage.fileName = "";
  plainMessage.fileType = "";

  return plainMessage;
}

// Cleans a whole list of messages.
export function stripHiddenMessages(messageList: any[]) {
  const cleanedMessages = [];

  for (const oneMessage of messageList) {
    cleanedMessages.push(stripIfHidden(oneMessage));
  }

  return cleanedMessages;
}
