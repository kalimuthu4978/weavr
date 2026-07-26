import mongoose from "mongoose";
import User from "../models/User";
import Group from "../models/Group";
import Message from "../models/Message";
import GroupMessage from "../models/GroupMessage";

// Builds the numbers behind the admin "Analytics & Reporting" section.
//
// This lives in its own file rather than inside routes/admin.ts because the
// database aggregations are long, and the route itself should stay short and
// easy to read.

// --- Small date helpers ---------------------------------------------------

// Midnight at the start of the day, "days" days ago.
// countingDaysBack(0) is midnight today, countingDaysBack(6) is 6 days ago.
function countingDaysBack(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

// Turns a Date into the "YYYY-MM-DD" form our per-day grouping uses
function toDayKey(date: Date) {
  const year = date.getFullYear();
  // getMonth() is 0-based, so add 1. padStart keeps it two digits.
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

// --- Message volume per day ----------------------------------------------

// Counts how many messages were sent on each day, for one collection.
// Returns something like { "2026-07-25": 12, "2026-07-26": 4 }
async function countMessagesPerDay(model: any, since: Date) {
  const rows = await model.aggregate([
    // Only look at messages from the period we care about
    { $match: { createdAt: { $gte: since } } },
    // Group them by their date, ignoring the time of day
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        total: { $sum: 1 },
      },
    },
  ]);

  // Turn the array of rows into a plain lookup object
  const countsByDay: Record<string, number> = {};
  rows.forEach((oneRow: any) => {
    countsByDay[oneRow._id] = oneRow.total;
  });

  return countsByDay;
}

// Builds one entry per day for the chart, including days with no messages
// (otherwise the chart would silently skip quiet days).
async function buildMessagesPerDay(numberOfDays: number) {
  const since = countingDaysBack(numberOfDays - 1);

  const directPerDay = await countMessagesPerDay(Message, since);
  const groupPerDay = await countMessagesPerDay(GroupMessage, since);

  const days = [];

  // Walk from the oldest day up to today so the chart reads left to right
  for (let stepsBack = numberOfDays - 1; stepsBack >= 0; stepsBack--) {
    const dayDate = countingDaysBack(stepsBack);
    const dayKey = toDayKey(dayDate);

    const directCount = directPerDay[dayKey] || 0;
    const groupCount = groupPerDay[dayKey] || 0;

    days.push({
      date: dayKey,
      direct: directCount,
      group: groupCount,
      total: directCount + groupCount,
    });
  }

  return days;
}

// --- Most active people and groups ---------------------------------------

// The users who sent the most messages, counting direct and group together.
async function buildTopUsers(howMany: number) {
  // Count each person's direct messages, then their group messages
  const directCounts = await Message.aggregate([
    { $group: { _id: "$sender", total: { $sum: 1 } } },
  ]);
  const groupCounts = await GroupMessage.aggregate([
    { $group: { _id: "$sender", total: { $sum: 1 } } },
  ]);

  // Add the two together, keyed by user id
  const totalsByUser: Record<string, number> = {};

  directCounts.forEach((oneRow: any) => {
    const userId = String(oneRow._id);
    totalsByUser[userId] = (totalsByUser[userId] || 0) + oneRow.total;
  });
  groupCounts.forEach((oneRow: any) => {
    const userId = String(oneRow._id);
    totalsByUser[userId] = (totalsByUser[userId] || 0) + oneRow.total;
  });

  // Sort by who sent the most, and keep the top few
  const rankedUserIds = Object.keys(totalsByUser).sort(
    (firstId, secondId) => totalsByUser[secondId] - totalsByUser[firstId]
  );
  const topUserIds = rankedUserIds.slice(0, howMany);

  // Swap the ids for real usernames
  const users = await User.find({ _id: { $in: topUserIds } }).select(
    "username profilePicture"
  );

  const topUsers = topUserIds.map((oneUserId) => {
    const matchingUser = users.find(
      (oneUser: any) => String(oneUser._id) === oneUserId
    );
    return {
      userId: oneUserId,
      username: matchingUser ? (matchingUser as any).username : "Deleted user",
      profilePicture: matchingUser
        ? (matchingUser as any).profilePicture
        : "",
      messageCount: totalsByUser[oneUserId],
    };
  });

  return topUsers;
}

// The groups with the most messages in them
async function buildTopGroups(howMany: number) {
  const groupCounts = await GroupMessage.aggregate([
    { $group: { _id: "$group", total: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: howMany },
  ]);

  const groupIds = groupCounts.map((oneRow: any) => oneRow._id);
  const groups = await Group.find({ _id: { $in: groupIds } }).select(
    "name members groupPicture"
  );

  const topGroups = groupCounts.map((oneRow: any) => {
    const matchingGroup = groups.find(
      (oneGroup: any) => String(oneGroup._id) === String(oneRow._id)
    );
    return {
      groupId: String(oneRow._id),
      name: matchingGroup ? (matchingGroup as any).name : "Deleted group",
      groupPicture: matchingGroup ? (matchingGroup as any).groupPicture : "",
      memberCount: matchingGroup ? (matchingGroup as any).members.length : 0,
      messageCount: oneRow.total,
    };
  });

  return topGroups;
}

// --- User activity --------------------------------------------------------

// How many DIFFERENT people sent a message since a given moment.
// We work it out from messages rather than storing a "last seen" field, so
// there's nothing extra to keep up to date.
async function countActiveUsersSince(since: Date) {
  const directSenders = await Message.distinct("sender", {
    createdAt: { $gte: since },
  });
  const groupSenders = await GroupMessage.distinct("sender", {
    createdAt: { $gte: since },
  });

  // A Set removes duplicates, so someone who sent both kinds counts once
  const uniqueSenders = new Set<string>();
  directSenders.forEach((oneId: any) => uniqueSenders.add(String(oneId)));
  groupSenders.forEach((oneId: any) => uniqueSenders.add(String(oneId)));

  return uniqueSenders.size;
}

async function buildUserActivity() {
  const startOfToday = countingDaysBack(0);
  const startOfWeek = countingDaysBack(6);

  const totalUsers = await User.countDocuments();
  const deactivatedUsers = await User.countDocuments({ isActive: false });
  const newThisWeek = await User.countDocuments({
    createdAt: { $gte: startOfWeek },
  });
  const onlineNow = await User.countDocuments({ status: "online" });

  const activeToday = await countActiveUsersSince(startOfToday);
  const activeThisWeek = await countActiveUsersSince(startOfWeek);

  return {
    totalUsers: totalUsers,
    deactivatedUsers: deactivatedUsers,
    newThisWeek: newThisWeek,
    onlineNow: onlineNow,
    activeToday: activeToday,
    activeThisWeek: activeThisWeek,
  };
}

// --- Engagement -----------------------------------------------------------

async function buildEngagement(totalUsers: number, activeThisWeek: number) {
  const directTotal = await Message.countDocuments();
  const groupTotal = await GroupMessage.countDocuments();
  const allMessages = directTotal + groupTotal;

  // How many messages carry a file rather than just text
  const directWithFile = await Message.countDocuments({
    fileUrl: { $ne: "" },
  });
  const groupWithFile = await GroupMessage.countDocuments({
    fileUrl: { $ne: "" },
  });
  const messagesWithFile = directWithFile + groupWithFile;

  // Guard against dividing by zero on a brand new install
  const averageMessagesPerUser =
    totalUsers > 0 ? Math.round((allMessages / totalUsers) * 10) / 10 : 0;

  const weeklyActivePercent =
    totalUsers > 0 ? Math.round((activeThisWeek / totalUsers) * 100) : 0;

  const attachmentPercent =
    allMessages > 0 ? Math.round((messagesWithFile / allMessages) * 100) : 0;

  const groupSharePercent =
    allMessages > 0 ? Math.round((groupTotal / allMessages) * 100) : 0;

  return {
    totalMessages: allMessages,
    averageMessagesPerUser: averageMessagesPerUser,
    weeklyActivePercent: weeklyActivePercent,
    attachmentPercent: attachmentPercent,
    groupSharePercent: groupSharePercent,
  };
}

// --- System performance ---------------------------------------------------

async function buildSystemHealth() {
  // How long the server process has been up, in whole minutes
  const uptimeMinutes = Math.round(process.uptime() / 60);

  // Memory the Node process is using, in megabytes
  const memory = process.memoryUsage();
  const memoryUsedMb = Math.round(memory.heapUsed / 1024 / 1024);
  const memoryTotalMb = Math.round(memory.heapTotal / 1024 / 1024);

  // Time a trivial database command to get a rough latency figure
  let databaseLatencyMs = -1;
  const startedAt = Date.now();
  try {
    // mongoose.connection.db is undefined until the connection is ready
    const database = mongoose.connection.db;
    if (database) {
      await database.admin().ping();
      databaseLatencyMs = Date.now() - startedAt;
    }
  } catch (error) {
    console.log("Database ping failed:", error);
  }

  return {
    uptimeMinutes: uptimeMinutes,
    memoryUsedMb: memoryUsedMb,
    memoryTotalMb: memoryTotalMb,
    databaseLatencyMs: databaseLatencyMs,
    nodeVersion: process.version,
  };
}

// --- The whole report -----------------------------------------------------

// Pulls every section together. numberOfDays controls how far the message
// volume chart looks back.
export async function buildAnalyticsReport(numberOfDays: number) {
  const messagesPerDay = await buildMessagesPerDay(numberOfDays);
  const topUsers = await buildTopUsers(5);
  const topGroups = await buildTopGroups(5);
  const userActivity = await buildUserActivity();
  const engagement = await buildEngagement(
    userActivity.totalUsers,
    userActivity.activeThisWeek
  );
  const system = await buildSystemHealth();

  return {
    rangeInDays: numberOfDays,
    messagesPerDay: messagesPerDay,
    topUsers: topUsers,
    topGroups: topGroups,
    userActivity: userActivity,
    engagement: engagement,
    system: system,
  };
}
