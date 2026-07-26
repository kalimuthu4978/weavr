// Browser push notifications for new messages.
//
// This uses the built-in Notification API, which shows a desktop notification
// even when the browser tab is in the background. The brief asks for both
// in-app notifications (the unread badges, already built) and push ones.
//
// Note: browsers only allow this on https, or on localhost during development.

// Has the browser got the Notification API at all?
// Older browsers and some mobile ones don't.
export function browserSupportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

// Ask the user for permission, if we haven't already.
// The browser only shows its prompt once - after that it remembers the answer,
// so calling this again is harmless.
export async function requestNotificationPermission() {
  if (!browserSupportsNotifications()) {
    return "unsupported";
  }

  // "granted" or "denied" means they've already answered
  if (Notification.permission !== "default") {
    return Notification.permission;
  }

  try {
    const answer = await Notification.requestPermission();
    return answer;
  } catch (error) {
    console.log("Could not ask for notification permission:", error);
    return "denied";
  }
}

// Show a notification about a new message.
//
// We deliberately only do this when the tab is hidden. If the user is already
// looking at the chat, a desktop popup would just be annoying - the in-app
// unread badge is enough.
export function showMessageNotification(title: string, body: string) {
  if (!browserSupportsNotifications()) {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }
  if (!document.hidden) {
    return;
  }

  try {
    const notification = new Notification(title, {
      body: body,
      icon: "/logo.png",
      // Giving every notification the same tag means a burst of messages
      // replaces itself instead of stacking up a wall of popups.
      tag: "weavr-message",
    });

    // Clicking the notification brings the chat tab back to the front
    notification.onclick = function () {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.log("Could not show notification:", error);
  }
}

// Builds the short preview line shown in the notification body.
export function buildMessagePreview(
  text: string,
  fileType: string,
  fileName: string
) {
  if (text && text.trim() !== "") {
    return text;
  }

  // No text means it's an attachment - describe it instead
  if (fileType === "image") {
    return "📷 Sent a photo";
  }
  if (fileType === "video") {
    return "🎥 Sent a video";
  }
  if (fileType === "file") {
    return "📄 " + (fileName !== "" ? fileName : "Sent a file");
  }

  return "New message";
}
