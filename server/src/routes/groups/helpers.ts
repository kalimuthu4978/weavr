// Shared checks used by every group route.
//
// These live in their own file so both the core routes and the membership
// routes can use them without one importing the other.


// Turns a member entry into a plain id string.
//
// A group's members can arrive in two different shapes:
//   - as plain ObjectIds, when we loaded the group normally
//   - as full user documents, when we used .populate("members")
// This handles both, so the checks below work either way.
export function toIdString(memberOrId: any) {
  if (!memberOrId) {
    return "";
  }
  // A populated user document keeps its id in _id
  if (memberOrId._id) {
    return memberOrId._id.toString();
  }
  return memberOrId.toString();
}

// Is this user a member of the group?
export function isMemberOfGroup(group: any, userId: string) {
  return group.members.some(
    (oneMember: any) => toIdString(oneMember) === userId
  );
}

// Is this user allowed to manage the group?
// The creator always counts, even for older groups that were saved before
// the groupAdmins field existed.
export function isAdminOfGroup(group: any, userId: string) {
  if (group.createdBy && toIdString(group.createdBy) === userId) {
    return true;
  }
  if (!Array.isArray(group.groupAdmins)) {
    return false;
  }
  return group.groupAdmins.some(
    (oneAdmin: any) => toIdString(oneAdmin) === userId
  );
}

