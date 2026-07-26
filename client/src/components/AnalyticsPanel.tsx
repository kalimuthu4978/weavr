import type { AnalyticsReport } from "../api/admin";
import Avatar from "./Avatar";

type AnalyticsPanelProps = {
  report: AnalyticsReport | null;
  // Which range is selected, and how to change it
  rangeInDays: number;
  onChangeRange: (days: number) => void;
};

// Turns "2026-07-26" into "26 Jul" for the chart labels
function toShortDate(dayKey: string) {
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const parts = dayKey.split("-");
  const monthNumber = Number(parts[1]);
  const dayNumber = Number(parts[2]);
  return dayNumber + " " + monthNames[monthNumber - 1];
}

// One labelled figure in the insight grid
function InsightTile({
  value,
  label,
  highlight,
}: {
  value: string | number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-3 text-center">
      <div
        className={
          "text-2xl font-bold " +
          (highlight ? "text-red-600" : "text-purple-700")
        }
      >
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

// The admin "Analytics & Reporting" section: message volume over time, the
// most active people and groups, engagement figures and system health.
//
// The bar chart is plain CSS heights rather than a charting library, which
// keeps the bundle small and avoids another dependency.
function AnalyticsPanel({
  report,
  rangeInDays,
  onChangeRange,
}: AnalyticsPanelProps) {
  if (report === null) {
    return (
      <div className="bg-white text-gray-800 rounded-xl shadow p-4">
        <p className="text-gray-400 text-sm">Loading analytics...</p>
      </div>
    );
  }

  // The tallest day decides the scale, so the chart always fills its height.
  // Guard with 1 so a completely quiet period doesn't divide by zero.
  let busiestDayTotal = 1;
  report.messagesPerDay.forEach((oneDay) => {
    if (oneDay.total > busiestDayTotal) {
      busiestDayTotal = oneDay.total;
    }
  });

  const rangeChoices = [7, 14, 30];

  return (
    <div className="bg-white text-gray-800 rounded-xl shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
        <span className="font-semibold text-purple-700">
          Analytics &amp; Reporting
        </span>

        {/* Range picker for the volume chart */}
        <div className="flex gap-1">
          {rangeChoices.map((oneChoice) => (
            <button
              key={oneChoice}
              onClick={() => onChangeRange(oneChoice)}
              className={
                "text-xs font-semibold px-2.5 py-1 rounded-lg transition " +
                (rangeInDays === oneChoice
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200")
              }
            >
              {oneChoice}d
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* --- Message volume over time --- */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Message volume
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            <span className="inline-block w-2 h-2 rounded-sm bg-purple-600 mr-1"></span>
            Direct
            <span className="inline-block w-2 h-2 rounded-sm bg-purple-300 ml-3 mr-1"></span>
            Group
          </p>

          {/* Each column is one day. Bars are stacked: direct on top of group. */}
          <div className="flex items-end gap-1 h-40 overflow-x-auto pb-1">
            {report.messagesPerDay.map((oneDay) => {
              const directHeight = (oneDay.direct / busiestDayTotal) * 100;
              const groupHeight = (oneDay.group / busiestDayTotal) * 100;

              return (
                <div
                  key={oneDay.date}
                  className="flex-1 min-w-[18px] flex flex-col items-center justify-end h-full"
                  title={
                    toShortDate(oneDay.date) +
                    ": " +
                    oneDay.total +
                    " messages (" +
                    oneDay.direct +
                    " direct, " +
                    oneDay.group +
                    " group)"
                  }
                >
                  {/* A count above the bar, only when there's something there */}
                  {oneDay.total > 0 && (
                    <span className="text-[10px] text-gray-500 mb-0.5">
                      {oneDay.total}
                    </span>
                  )}

                  <div
                    className="w-full bg-purple-300 rounded-t-sm"
                    style={{ height: groupHeight + "%" }}
                  ></div>
                  <div
                    className="w-full bg-purple-600"
                    style={{ height: directHeight + "%" }}
                  ></div>

                  {/* A thin base line so empty days are still visible */}
                  <div className="w-full h-px bg-gray-300"></div>
                </div>
              );
            })}
          </div>

          {/* Only label the first and last day, so labels never overlap */}
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>
              {report.messagesPerDay.length > 0
                ? toShortDate(report.messagesPerDay[0].date)
                : ""}
            </span>
            <span>
              {report.messagesPerDay.length > 0
                ? toShortDate(
                  report.messagesPerDay[report.messagesPerDay.length - 1].date
                )
                : ""}
            </span>
          </div>
        </div>

        {/* --- User activity --- */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            User activity
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <InsightTile
              value={report.userActivity.totalUsers}
              label="Total users"
            />
            <InsightTile
              value={report.userActivity.onlineNow}
              label="Online now"
            />
            <InsightTile
              value={report.userActivity.activeToday}
              label="Active today"
            />
            <InsightTile
              value={report.userActivity.activeThisWeek}
              label="Active this week"
            />
            <InsightTile
              value={report.userActivity.newThisWeek}
              label="New this week"
            />
            <InsightTile
              value={report.userActivity.deactivatedUsers}
              label="Deactivated"
              highlight={report.userActivity.deactivatedUsers > 0}
            />
          </div>
        </div>

        {/* --- Engagement insights --- */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Engagement
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <InsightTile
              value={report.engagement.totalMessages}
              label="Messages sent"
            />
            <InsightTile
              value={report.engagement.averageMessagesPerUser}
              label="Avg per user"
            />
            <InsightTile
              value={report.engagement.weeklyActivePercent + "%"}
              label="Weekly active"
            />
            <InsightTile
              value={report.engagement.attachmentPercent + "%"}
              label="With attachment"
            />
            <InsightTile
              value={report.engagement.groupSharePercent + "%"}
              label="Sent in groups"
            />
          </div>
        </div>

        {/* --- Most active people and groups, side by side --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Most active users
            </h3>
            {report.topUsers.length === 0 ? (
              <p className="text-xs text-gray-400">No messages yet.</p>
            ) : (
              <div className="space-y-2">
                {report.topUsers.map((oneUser, position) => (
                  <div
                    key={oneUser.userId}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs text-gray-400 w-4">
                      {position + 1}
                    </span>
                    <Avatar
                      imageUrl={oneUser.profilePicture}
                      name={oneUser.username}
                      size="small"
                    />
                    <span className="text-sm flex-1 truncate">
                      {oneUser.username}
                    </span>
                    <span className="text-sm font-semibold text-purple-700">
                      {oneUser.messageCount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Most active groups
            </h3>
            {report.topGroups.length === 0 ? (
              <p className="text-xs text-gray-400">
                No group messages yet.
              </p>
            ) : (
              <div className="space-y-2">
                {report.topGroups.map((oneGroup, position) => (
                  <div
                    key={oneGroup.groupId}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs text-gray-400 w-4">
                      {position + 1}
                    </span>
                    <Avatar
                      imageUrl={oneGroup.groupPicture}
                      name={oneGroup.name}
                      size="small"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{oneGroup.name}</div>
                      <div className="text-xs text-gray-400">
                        {oneGroup.memberCount} members
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-purple-700">
                      {oneGroup.messageCount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- System performance --- */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            System health
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <InsightTile
              value={report.system.uptimeMinutes + "m"}
              label="Server uptime"
            />
            <InsightTile
              value={
                report.system.memoryUsedMb + "/" + report.system.memoryTotalMb + "MB"
              }
              label="Memory in use"
            />
            <InsightTile
              value={
                report.system.databaseLatencyMs < 0
                  ? "n/a"
                  : report.system.databaseLatencyMs + "ms"
              }
              label="Database latency"
              highlight={report.system.databaseLatencyMs > 500}
            />
            <InsightTile
              value={report.system.nodeVersion}
              label="Node version"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPanel;
