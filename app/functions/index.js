/**
 * LCKY HUB - Cloud Functions
 * Complete admin system, role management, server logic, and username generation
 * 
 * @version 1.0
 * @author LCKY HUB Team
 */

const { setGlobalOptions } = require("firebase-functions");
const { onCall, onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();
const auth = getAuth();

// Global options for cost control
setGlobalOptions({ maxInstances: 10 });

// ===============================
// CONSTANTS & CONFIG
// ===============================

const SUPER_ADMIN_EMAIL = "lucassteckel04@gmail.com";

const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MODERATOR: "moderator",
  STREAMER: "streamer",
  VIP: "vip",
  USER: "user",
  BOT: "bot"
};

const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.ADMIN]: 80,
  [ROLES.MODERATOR]: 60,
  [ROLES.STREAMER]: 50,
  [ROLES.VIP]: 30,
  [ROLES.USER]: 10,
  [ROLES.BOT]: 1
};

const STATUS_VALUES = ["online", "idle", "dnd", "offline"];

// ===============================
// HELPER FUNCTIONS
// ===============================

/**
 * Check if user is authenticated
 */
function isAuthenticated(context) {
  return context.auth != null;
}

/**
 * Get current user ID
 */
function getUserId(context) {
  return context.auth.uid;
}

/**
 * Get user data from Firestore
 */
async function getUserData(uid) {
  const userDoc = await db.collection("users").doc(uid).get();
  return userDoc.exists ? userDoc.data() : null;
}

/**
 * Check if user has specific role
 */
async function hasRole(uid, role) {
  const userData = await getUserData(uid);
  return userData?.role === role;
}

/**
 * Check if user role is at least a certain level
 */
async function hasMinimumRole(uid, minimumRole) {
  const userData = await getUserData(uid);
  if (!userData?.role) return false;
  const userRoleLevel = ROLE_HIERARCHY[userData.role] || 0;
  const requiredRoleLevel = ROLE_HIERARCHY[minimumRole] || 0;
  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Check if user is super admin
 */
async function isSuperAdmin(uid) {
  const userData = await getUserData(uid);
  return userData?.role === ROLES.SUPER_ADMIN || 
         (userData?.email === SUPER_ADMIN_EMAIL && userData?.role === ROLES.ADMIN);
}

/**
 * Check if user is authenticated with Firebase Auth
 */
async function isVerifiedUser(uid) {
  try {
    const userRecord = await auth.getUser(uid);
    return userRecord.emailVerified || userRecord.providerData.length > 0;
  } catch (error) {
    return false;
  }
}

// ===============================
// USERNAME GENERATION
// ===============================

/**
 * Generate a unique username with discriminator
 */
async function generateUsername(baseUsername) {
  const normalizedUsername = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "");
  
  // Check if base username exists
  const usernameDoc = await db.collection("usernames").doc(normalizedUsername).get();
  
  if (!usernameDoc.exists) {
    // Base username is available, no discriminator needed
    return {
      username: normalizedUsername,
      discriminator: null
    };
  }
  
  // Find available discriminator (0001-9999)
  const existingData = usernameDoc.data();
  const usedDiscriminators = new Set();
  
  // Check existing users with this username
  const usersSnapshot = await db.collection("users")
    .where("usernameLower", "==", normalizedUsername)
    .get();
  
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.discriminator) {
      usedDiscriminators.add(parseInt(data.discriminator));
    }
  });
  
  // Find first available discriminator
  for (let i = 1; i <= 9999; i++) {
    const disc = i.toString().padStart(4, "0");
    if (!usedDiscriminators.has(i)) {
      return {
        username: normalizedUsername,
        discriminator: disc
      };
    }
  }
  
  throw new Error("No available discriminator found");
}

/**
 * Reserve username for user
 */
async function reserveUsername(uid, username, discriminator) {
  const usernameKey = username.toLowerCase();
  const usernameDocRef = db.collection("usernames").doc(usernameKey);
  const discriminatorRef = usernameDocRef.collection("discriminators").doc(discriminator || "default");
  
  await db.runTransaction(async (transaction) => {
    const usernameDoc = await transaction.get(usernameDocRef);
    
    if (usernameDoc.exists && discriminator === null) {
      throw new Error("Username already taken");
    }
    
    // Check if discriminator is already taken
    const discDoc = await transaction.get(discriminatorRef);
    if (discDoc.exists) {
      throw new Error("Discriminator already taken");
    }
    
    // Reserve the username/discriminator
    transaction.set(usernameDocRef, {
      username: username,
      primaryUser: discriminator === null ? uid : null,
      createdAt: Timestamp.now()
    });
    
    transaction.set(discriminatorRef, {
      uid: uid,
      assignedAt: Timestamp.now()
    });
  });
}

/**
 * Release username when user changes it
 */
async function releaseUsername(uid, username, discriminator) {
  const usernameKey = username.toLowerCase();
  
  if (discriminator) {
    await db.collection("usernames").doc(usernameKey)
      .collection("discriminators").doc(discriminator).delete();
  } else {
    await db.collection("usernames").doc(usernameKey).delete();
  }
}

// ===============================
// ADMIN FUNCTIONS
// ===============================

/**
 * Get all admin users
 */
exports.getAdmins = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const uid = getUserId(context);
  if (!await isSuperAdmin(uid)) {
    throw new Error("Insufficient permissions");
  }
  
  const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MODERATOR];
  const admins = [];
  
  for (const role of adminRoles) {
    const snapshot = await db.collection("users")
      .where("role", "==", role)
      .get();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      admins.push({
        uid: doc.id,
        username: data.username,
        discriminator: data.discriminator,
        email: data.email,
        role: data.role,
        createdAt: data.createdAt
      });
    });
  }
  
  return admins;
});

/**
 * Update user role (Admin only)
 */
exports.updateUserRole = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { targetUid, newRole } = context.data;
  const uid = getUserId(context);
  
  if (!newRole || !Object.values(ROLES).includes(newRole)) {
    throw new Error("Invalid role");
  }
  
  // Only super admin can assign super_admin role
  if (newRole === ROLES.SUPER_ADMIN && !await isSuperAdmin(uid)) {
    throw new Error("Only super admin can assign super_admin role");
  }
  
  // Check permission level
  const targetUserData = await getUserData(targetUid);
  if (targetUserData) {
    const requesterLevel = ROLE_HIERARCHY[await getUserData(uid).then(d => d?.role)] || 0;
    const targetLevel = ROLE_HIERARCHY[targetUserData.role] || 0;
    const newLevel = ROLE_HIERARCHY[newRole] || 0;
    
    // Can't modify users with equal or higher role
    if (targetLevel >= requesterLevel) {
      throw new Error("Cannot modify users with equal or higher role");
    }
    
    // Can't assign roles higher than own level
    if (newLevel >= requesterLevel) {
      throw new Error("Cannot assign roles equal to or higher than your own");
    }
  }
  
  // Update user role
  await db.collection("users").doc(targetUid).update({
    role: newRole,
    roleUpdatedAt: Timestamp.now(),
    roleUpdatedBy: uid
  });
  
  // Create notification for user
  await db.collection("notifications").add({
    userId: targetUid,
    type: "role_change",
    title: "Rollenänderung",
    message: `Deine Rolle wurde zu ${newRole} geändert.`,
    createdAt: Timestamp.now(),
    read: false
  });
  
  return { success: true, newRole };
});

/**
 * Get user statistics (Admin)
 */
exports.getUserStats = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const uid = getUserId(context);
  if (!await hasMinimumRole(uid, ROLES.MODERATOR)) {
    throw new Error("Insufficient permissions");
  }
  
  const now = Timestamp.now();
  const oneDayAgo = new Date(now.toDate().getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.toDate().getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const totalUsers = await db.collection("users").count().get();
  const onlineUsers = await db.collection("users")
    .where("status", "==", "online")
    .count().get();
  const newUsersToday = await db.collection("users")
    .where("createdAt", ">=", Timestamp.fromDate(oneDayAgo))
    .count().get();
  const newUsersWeek = await db.collection("users")
    .where("createdAt", ">=", Timestamp.fromDate(oneWeekAgo))
    .count().get();
  
  return {
    totalUsers: totalUsers.data().count,
    onlineUsers: onlineUsers.data().count,
    newUsersToday: newUsersToday.data().count,
    newUsersWeek: newUsersWeek.data().count
  };
});

/**
 * Ban user (Admin)
 */
exports.banUser = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { targetUid, reason, duration } = context.data;
  const uid = getUserId(context);
  
  if (!await hasMinimumRole(uid, ROLES.ADMIN)) {
    throw new Error("Insufficient permissions");
  }
  
  const targetUserData = await getUserData(targetUid);
  if (!targetUserData) {
    throw new Error("User not found");
  }
  
  // Check if target is protected
  if (targetUserData.role === ROLES.SUPER_ADMIN || 
      (targetUserData.email === SUPER_ADMIN_EMAIL)) {
    throw new Error("Cannot ban super admin");
  }
  
  // Prevent banning equal or higher role
  const requesterLevel = ROLE_HIERARCHY[await getUserData(uid).then(d => d?.role)] || 0;
  const targetLevel = ROLE_HIERARCHY[targetUserData.role] || 0;
  if (targetLevel >= requesterLevel) {
    throw new Error("Cannot ban users with equal or higher role");
  }
  
  // Calculate ban end time
  const banEndAt = duration 
    ? Timestamp.now().toDate().getTime() + duration * 60 * 60 * 1000 // duration in hours
    : null;
  
  // Update user ban status
  await db.collection("users").doc(targetUid).update({
    banned: true,
    banReason: reason || "Verstoß gegen Nutzungsbedingungen",
    bannedAt: Timestamp.now(),
    bannedBy: uid,
    banEndAt: banEndAt ? Timestamp.fromDate(new Date(banEndAt)) : null
  });
  
  // Create notification
  await db.collection("notifications").add({
    userId: targetUid,
    type: "ban",
    title: "Account gesperrt",
    message: reason ? `Dein Account wurde gesperrt: ${reason}` : "Dein Account wurde gesperrt.",
    createdAt: Timestamp.now(),
    read: false
  });
  
  // Revoke auth token
  try {
    await auth.updateUser(targetUid, { disabled: true });
  } catch (error) {
    console.error("Failed to disable auth user:", error);
  }
  
  return { success: true, banEndAt };
});

/**
 * Unban user (Admin)
 */
exports.unbanUser = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { targetUid } = context.data;
  const uid = getUserId(context);
  
  if (!await hasMinimumRole(uid, ROLES.ADMIN)) {
    throw new Error("Insufficient permissions");
  }
  
  await db.collection("users").doc(targetUid).update({
    banned: false,
    banReason: null,
    bannedAt: null,
    bannedBy: null,
    banEndAt: null
  });
  
  // Re-enable auth
  try {
    await auth.updateUser(targetUid, { disabled: false });
  } catch (error) {
    console.error("Failed to enable auth user:", error);
  }
  
  return { success: true };
});

// ===============================
// SERVER / GROUP FUNCTIONS
// ===============================

/**
 * Create server
 */
exports.createServer = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { name, description, icon } = context.data;
  const uid = getUserId(context);
  
  if (!name || name.length < 2 || name.length > 100) {
    throw new Error("Server name must be between 2 and 100 characters");
  }
  
  const serverId = db.collection("servers").doc().id;
  
  await db.collection("servers").doc(serverId).set({
    name,
    description: description || "",
    icon: icon || null,
    ownerId: uid,
    createdAt: Timestamp.now(),
    memberCount: 1,
    isPrivate: false
  });
  
  // Add owner as admin member
  await db.collection("servers").doc(serverId).collection("members").doc(uid).set({
    uid,
    role: "admin",
    joinedAt: Timestamp.now()
  });
  
  // Update user's server list
  await db.collection("users").doc(uid).update({
    serverIds: FieldValue.arrayUnion(serverId)
  });
  
  return { serverId };
});

/**
 * Join server
 */
exports.joinServer = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { serverId } = context.data;
  const uid = getUserId(context);
  
  const serverDoc = await db.collection("servers").doc(serverId).get();
  if (!serverDoc.exists) {
    throw new Error("Server not found");
  }
  
  const serverData = serverDoc.data();
  
  if (serverData.isPrivate) {
    throw new Error("This server is private");
  }
  
  // Check if already member
  const memberDoc = await db.collection("servers").doc(serverId)
    .collection("members").doc(uid).get();
  if (memberDoc.exists) {
    throw new Error("Already a member of this server");
  }
  
  // Add as member
  await db.collection("servers").doc(serverId).collection("members").doc(uid).set({
    uid,
    role: "member",
    joinedAt: Timestamp.now()
  });
  
  // Update server member count
  await db.collection("servers").doc(serverId).update({
    memberCount: FieldValue.increment(1)
  });
  
  // Update user's server list
  await db.collection("users").doc(uid).update({
    serverIds: FieldValue.arrayUnion(serverId)
  });
  
  return { success: true };
});

/**
 * Leave server
 */
exports.leaveServer = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { serverId } = context.data;
  const uid = getUserId(context);
  
  const serverDoc = await db.collection("servers").doc(serverId).get();
  if (!serverDoc.exists) {
    throw new Error("Server not found");
  }
  
  const serverData = serverDoc.data();
  
  if (serverData.ownerId === uid) {
    throw new Error("Owner cannot leave server. Transfer ownership first.");
  }
  
  // Remove from members
  await db.collection("servers").doc(serverId).collection("members").doc(uid).delete();
  
  // Update server member count
  await db.collection("servers").doc(serverId).update({
    memberCount: FieldValue.increment(-1)
  });
  
  // Remove from user's server list
  await db.collection("users").doc(uid).update({
    serverIds: FieldValue.arrayRemove(serverId)
  });
  
  return { success: true };
});

/**
 * Create server invitation
 */
exports.createInvite = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { serverId, maxUses, expiresIn } = context.data;
  const uid = getUserId(context);
  
  // Check if member with permission to invite
  const memberDoc = await db.collection("servers").doc(serverId)
    .collection("members").doc(uid).get();
  
  if (!memberDoc.exists) {
    throw new Error("Not a member of this server");
  }
  
  const memberData = memberDoc.data();
  if (!["admin", "moderator"].includes(memberData.role) && memberData.role !== "admin") {
    throw new Error("Insufficient permissions to create invites");
  }
  
  const inviteId = db.collection("servers").doc(serverId)
    .collection("invites").doc().id;
  
  const expiresAt = expiresIn 
    ? Timestamp.now().toDate().getTime() + expiresIn * 60 * 60 * 1000
    : null;
  
  await db.collection("servers").doc(serverId).collection("invites").doc(inviteId).set({
    code: inviteId.substring(0, 8),
    createdBy: uid,
    maxUses: maxUses || 0,
    uses: 0,
    createdAt: Timestamp.now(),
    expiresAt: expiresAt ? Timestamp.fromDate(new Date(expiresAt)) : null
  });
  
  return { inviteCode: inviteId.substring(0, 8) };
});

/**
 * Join server via invite
 */
exports.joinViaInvite = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { inviteCode } = context.data;
  const uid = getUserId(context);
  
  // Find server with this invite
  const serversSnapshot = await db.collectionGroup("invites")
    .where("code", "==", inviteCode)
    .get();
  
  if (serversSnapshot.empty) {
    throw new Error("Invalid invite code");
  }
  
  let inviteDoc, serverId;
  serversSnapshot.forEach(doc => {
    serverId = doc.ref.parent.parent.id;
    inviteDoc = doc;
  });
  
  const inviteData = inviteDoc.data();
  
  // Check expiration
  if (inviteData.expiresAt && inviteData.expiresAt.toDate() < new Date()) {
    throw new Error("Invite has expired");
  }
  
  // Check max uses
  if (inviteData.maxUses > 0 && inviteData.uses >= inviteData.maxUses) {
    throw new Error("Invite has reached max uses");
  }
  
  // Join server
  await exports.joinServer({ data: { serverId }, auth: context.auth });
  
  // Increment invite uses
  await db.collection("servers").doc(serverId).collection("invites")
    .doc(inviteDoc.id).update({
      uses: FieldValue.increment(1)
    });
  
  return { success: true };
});

/**
 * Block user
 */
exports.blockUser = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { targetUid } = context.data;
  const uid = getUserId(context);
  
  if (targetUid === uid) {
    throw new Error("Cannot block yourself");
  }
  
  // Add to blocked list
  await db.collection("users").doc(uid).collection("blocked").doc(targetUid).set({
    uid: targetUid,
    blockedAt: Timestamp.now()
  });
  
  // Remove from friends if present
  await db.collection("friends").doc(uid).collection("userFriends").doc(targetUid).delete();
  await db.collection("friends").doc(targetUid).collection("userFriends").doc(uid).delete();
  
  return { success: true };
});

/**
 * Unblock user
 */
exports.unblockUser = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { targetUid } = context.data;
  const uid = getUserId(context);
  
  await db.collection("users").doc(uid).collection("blocked").doc(targetUid).delete();
  
  return { success: true };
});

/**
 * Get blocked users list
 */
exports.getBlockedUsers = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const uid = getUserId(context);
  
  const blockedSnapshot = await db.collection("users").doc(uid)
    .collection("blocked").get();
  
  const blocked = [];
  for (const doc of blockedSnapshot.docs) {
    const blockedData = doc.data();
    const userData = await getUserData(blockedData.uid);
    if (userData) {
      blocked.push({
        uid: doc.id,
        username: userData.username,
        discriminator: userData.discriminator,
        blockedAt: blockedData.blockedAt
      });
    }
  }
  
  return blocked;
});

// ===============================
// FRIEND FUNCTIONS
// ===============================

/**
 * Send friend request
 */
exports.sendFriendRequest = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { toUsername, toDiscriminator } = context.data;
  const uid = getUserId(context);
  
  // Find user by username and discriminator
  const usersSnapshot = await db.collection("users")
    .where("usernameLower", "==", toUsername.toLowerCase())
    .get();
  
  let targetUid = null;
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    if (!toDiscriminator || data.discriminator === toDiscriminator) {
      targetUid = doc.id;
      break;
    }
  }
  
  if (!targetUid) {
    throw new Error("User not found");
  }
  
  if (targetUid === uid) {
    throw new Error("Cannot add yourself as friend");
  }
  
  // Check if already friends
  const friendDoc = await db.collection("friends").doc(uid)
    .collection("userFriends").doc(targetUid).get();
  if (friendDoc.exists) {
    throw new Error("Already friends with this user");
  }
  
  // Check if blocked
  const blockedByMe = await db.collection("users").doc(uid)
    .collection("blocked").doc(targetUid).get();
  if (blockedByMe.exists) {
    throw new Error("You have blocked this user");
  }
  
  const blockedByThem = await db.collection("users").doc(targetUid)
    .collection("blocked").doc(uid).get();
  if (blockedByThem.exists) {
    throw new Error("This user has blocked you");
  }
  
  // Check for existing request
  const requestsSnapshot = await db.collection("friendRequests")
    .where("fromUserId", "==", uid)
    .where("toUserId", "==", targetUid)
    .get();
  
  if (!requestsSnapshot.empty) {
    throw new Error("Friend request already sent");
  }
  
  const userData = await getUserData(uid);
  const targetUserData = await getUserData(targetUid);
  
  const requestId = db.collection("friendRequests").doc().id;
  await db.collection("friendRequests").doc(requestId).set({
    fromUserId: uid,
    fromUsername: userData.username,
    fromDiscriminator: userData.discriminator,
    toUserId: targetUid,
    toUsername: targetUserData.username,
    toDiscriminator: targetUserData.discriminator,
    status: "pending",
    createdAt: Timestamp.now()
  });
  
  // Create notification
  await db.collection("notifications").add({
    userId: targetUid,
    type: "friend_request",
    title: "Freundschaftsanfrage",
    message: `${userData.username} möchte befreundet sein.`,
    fromUserId: uid,
    createdAt: Timestamp.now(),
    read: false
  });
  
  return { requestId };
});

/**
 * Accept friend request
 */
exports.acceptFriendRequest = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { requestId } = context.data;
  const uid = getUserId(context);
  
  const requestDoc = await db.collection("friendRequests").doc(requestId).get();
  if (!requestDoc.exists) {
    throw new Error("Request not found");
  }
  
  const requestData = requestDoc.data();
  
  if (requestData.toUserId !== uid) {
    throw new Error("Not your request to accept");
  }
  
  if (requestData.status !== "pending") {
    throw new Error("Request already processed");
  }
  
  // Add to both users' friend lists
  await db.collection("friends").doc(uid).collection("userFriends").doc(requestData.fromUserId).set({
    userId: requestData.fromUserId,
    friendId: requestData.fromUserId,
    friendUsername: requestData.fromUsername,
    friendDiscriminator: requestData.fromDiscriminator,
    status: "friends",
    createdAt: Timestamp.now()
  });
  
  await db.collection("friends").doc(requestData.fromUserId).collection("userFriends").doc(uid).set({
    userId: uid,
    friendId: uid,
    friendUsername: requestData.toUsername,
    friendDiscriminator: requestData.toDiscriminator,
    status: "friends",
    createdAt: Timestamp.now()
  });
  
  // Update request status
  await db.collection("friendRequests").doc(requestId).update({
    status: "accepted",
    respondedAt: Timestamp.now()
  });
  
  // Notify sender
  await db.collection("notifications").add({
    userId: requestData.fromUserId,
    type: "friend_request_accepted",
    title: "Freundschaftsanfrage angenommen",
    message: `${requestData.toUsername} hat deine Anfrage angenommen.`,
    createdAt: Timestamp.now(),
    read: false
  });
  
  return { success: true };
});

/**
 * Decline friend request
 */
exports.declineFriendRequest = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { requestId } = context.data;
  const uid = getUserId(context);
  
  const requestDoc = await db.collection("friendRequests").doc(requestId).get();
  if (!requestDoc.exists) {
    throw new Error("Request not found");
  }
  
  const requestData = requestDoc.data();
  
  if (requestData.toUserId !== uid && requestData.fromUserId !== uid) {
    throw new Error("Not your request");
  }
  
  await db.collection("friendRequests").doc(requestId).update({
    status: "declined",
    respondedAt: Timestamp.now()
  });
  
  return { success: true };
});

/**
 * Remove friend
 */
exports.removeFriend = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { friendUid } = context.data;
  const uid = getUserId(context);
  
  await db.collection("friends").doc(uid).collection("userFriends").doc(friendUid).delete();
  await db.collection("friends").doc(friendUid).collection("userFriends").doc(uid).delete();
  
  return { success: true };
});

// ===============================
// CHAT FUNCTIONS
// ===============================

/**
 * Create DM chat
 */
exports.createDMChat = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { targetUid } = context.data;
  const uid = getUserId(context);
  
  // Check if DM already exists
  const chatsSnapshot = await db.collection("chats")
    .where("type", "==", "dm")
    .where("participants", "array-contains", uid)
    .get();
  
  for (const doc of chatsSnapshot.docs) {
    const data = doc.data();
    if (data.participants.includes(targetUid)) {
      return { chatId: doc.id, existing: true };
    }
  }
  
  const chatId = db.collection("chats").doc().id;
  
  await db.collection("chats").doc(chatId).set({
    type: "dm",
    participants: [uid, targetUid],
    createdAt: Timestamp.now(),
    createdBy: uid
  });
  
  // Add participants subcollection
  await db.collection("chats").doc(chatId).collection("participants").doc(uid).set({
    uid,
    joinedAt: Timestamp.now()
  });
  
  await db.collection("chats").doc(chatId).collection("participants").doc(targetUid).set({
    uid: targetUid,
    joinedAt: Timestamp.now()
  });
  
  return { chatId, existing: false };
});

/**
 * Create group chat
 */
exports.createGroupChat = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { name, participantIds } = context.data;
  const uid = getUserId(context);
  
  const chatId = db.collection("chats").doc().id;
  
  const participants = [uid, ...participantIds];
  
  await db.collection("chats").doc(chatId).set({
    type: "group",
    name: name || "Group Chat",
    participants: participants,
    createdAt: Timestamp.now(),
    createdBy: uid
  });
  
  // Add all participants
  for (const pid of participants) {
    await db.collection("chats").doc(chatId).collection("participants").doc(pid).set({
      uid: pid,
      joinedAt: Timestamp.now()
    });
  }
  
  return { chatId };
});

/**
 * Send message
 */
exports.sendMessage = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { chatId, content, type = "text", replyTo } = context.data;
  const uid = getUserId(context);
  
  // Check if participant
  const participantDoc = await db.collection("chats").doc(chatId)
    .collection("participants").doc(uid).get();
  
  if (!participantDoc.exists) {
    throw new Error("Not a participant of this chat");
  }
  
  const userData = await getUserData(uid);
  
  const messageId = db.collection("chats").doc(chatId)
    .collection("messages").doc().id;
  
  await db.collection("chats").doc(chatId).collection("messages").doc(messageId).set({
    content,
    type,
    senderId: uid,
    senderName: userData.username,
    senderDiscriminator: userData.discriminator,
    timestamp: Timestamp.now(),
    replyTo: replyTo || null,
    edited: false
  });
  
  // Update chat last message
  await db.collection("chats").doc(chatId).update({
    lastMessage: {
      content: content.substring(0, 100),
      senderId: uid,
      timestamp: Timestamp.now()
    }
  });
  
  return { messageId };
});

/**
 * Delete message
 */
exports.deleteMessage = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { chatId, messageId } = context.data;
  const uid = getUserId(context);
  
  const messageDoc = await db.collection("chats").doc(chatId)
    .collection("messages").doc(messageId).get();
  
  if (!messageDoc.exists) {
    throw new Error("Message not found");
  }
  
  const messageData = messageDoc.data();
  
  // Only sender can delete
  if (messageData.senderId !== uid) {
    throw new Error("Cannot delete messages from other users");
  }
  
  await db.collection("chats").doc(chatId).collection("messages")
    .doc(messageId).delete();
  
  return { success: true };
});

// ===============================
// STREAM FUNCTIONS
// ===============================

/**
 * Start stream
 */
exports.startStream = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { title, game } = context.data;
  const uid = getUserId(context);
  
  // Check if streamer role
  if (!await hasMinimumRole(uid, ROLES.STREAMER)) {
    throw new Error("Streamer role required");
  }
  
  const userData = await getUserData(uid);
  
  // Check if already streaming
  const activeStream = await db.collection("streams")
    .where("streamerId", "==", uid)
    .where("status", "==", "live")
    .get();
  
  if (!activeStream.empty) {
    throw new Error("Already streaming");
  }
  
  const streamId = db.collection("streams").doc().id;
  
  await db.collection("streams").doc(streamId).set({
    title: title || `${userData.username}'s Stream`,
    game: game || null,
    streamerId: uid,
    streamerName: userData.username,
    streamerDiscriminator: userData.discriminator,
    startedAt: Timestamp.now(),
    status: "live",
    viewerCount: 0
  });
  
  return { streamId };
});

/**
 * End stream
 */
exports.endStream = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { streamId } = context.data;
  const uid = getUserId(context);
  
  const streamDoc = await db.collection("streams").doc(streamId).get();
  if (!streamDoc.exists) {
    throw new Error("Stream not found");
  }
  
  const streamData = streamDoc.data();
  
  if (streamData.streamerId !== uid) {
    throw new Error("Not your stream");
  }
  
  await db.collection("streams").doc(streamId).update({
    status: "ended",
    endedAt: Timestamp.now()
  });
  
  return { success: true };
});

/**
 * Join stream as viewer
 */
exports.joinStream = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { streamId } = context.data;
  const uid = getUserId(context);
  
  const streamDoc = await db.collection("streams").doc(streamId).get();
  if (!streamDoc.exists) {
    throw new Error("Stream not found");
  }
  
  const streamData = streamDoc.data();
  
  if (streamData.status !== "live") {
    throw new Error("Stream is not live");
  }
  
  // Add to viewers
  await db.collection("streams").doc(streamId).collection("viewers").doc(uid).set({
    uid,
    joinedAt: Timestamp.now()
  });
  
  // Increment viewer count
  await db.collection("streams").doc(streamId).update({
    viewerCount: FieldValue.increment(1)
  });
  
  return { success: true };
});

/**
 * Leave stream
 */
exports.leaveStream = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { streamId } = context.data;
  const uid = getUserId(context);
  
  await db.collection("streams").doc(streamId).collection("viewers").doc(uid).delete();
  
  await db.collection("streams").doc(streamId).update({
    viewerCount: FieldValue.increment(-1)
  });
  
  return { success: true };
});

// ===============================
// SETTINGS FUNCTIONS
// ===============================

/**
 * Update user settings
 */
exports.updateSettings = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { settings } = context.data;
  const uid = getUserId(context);
  
  // Validate settings keys
  const allowedKeys = [
    "status", "statusMessage", "privacy", "notifications", 
    "audioInput", "audioOutput", "videoInput", "theme"
  ];
  
  for (const key of Object.keys(settings)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`Invalid setting: ${key}`);
    }
  }
  
  await db.collection("settings").doc(uid).set(settings, { merge: true });
  
  return { success: true };
});

/**
 * Get user settings
 */
exports.getSettings = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const uid = getUserId(context);
  
  const settingsDoc = await db.collection("settings").doc(uid).get();
  
  return settingsDoc.exists ? settingsDoc.data() : {};
});

/**
 * Submit Q&A question
 */
exports.submitQuestion = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { question, category } = context.data;
  const uid = getUserId(context);
  
  if (!question || question.length < 10 || question.length > 1000) {
    throw new Error("Question must be between 10 and 1000 characters");
  }
  
  const questionId = db.collection("questions").doc().id;
  
  await db.collection("questions").doc(questionId).set({
    userId: uid,
    question,
    category: category || "general",
    status: "pending",
    createdAt: Timestamp.now()
  });
  
  return { questionId };
});

// ===============================
// FIRESTORE TRIGGERS
// ===============================

/**
 * Handle new user creation
 */
exports.onUserCreated = onDocumentCreated(
  { documentPath: "users/{userId}" },
  async (event) => {
    const userId = event.params.userId;
    const data = event.data;
    
    // Reserve username
    try {
      await reserveUsername(userId, data.username, data.discriminator);
    } catch (error) {
      console.error("Failed to reserve username:", error);
    }
    
    // Set default settings
    await db.collection("settings").doc(userId).set({
      status: "online",
      notifications: {
        friendRequests: true,
        messages: true,
        mentions: true,
        streams: true
      },
      privacy: {
        allowFriendRequests: true,
        allowDMs: true,
        showOnlineStatus: true
      },
      theme: "dark"
    });
    
    // Create notification for super admin about new user
    try {
      const superAdmin = await auth.getUserByEmail(SUPER_ADMIN_EMAIL);
      await db.collection("notifications").add({
        userId: superAdmin.uid,
        type: "new_user",
        title: "Neuer Benutzer",
        message: `${data.username} hat sich registriert.`,
        createdAt: Timestamp.now(),
        read: false
      });
    } catch (error) {
      // Super admin might not exist yet
    }
  }
);

/**
 * Handle username changes
 */
exports.onUsernameChange = onDocumentUpdated(
  { documentPath: "users/{userId}" },
  async (event) => {
    const userId = event.params.userId;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    
    if (beforeData.username !== afterData.username || 
        beforeData.discriminator !== afterData.discriminator) {
      // Release old username
      if (beforeData.username) {
        try {
          await releaseUsername(userId, beforeData.username, beforeData.discriminator);
        } catch (error) {
          console.error("Failed to release old username:", error);
        }
      }
      
      // Reserve new username
      try {
        await reserveUsername(userId, afterData.username, afterData.discriminator);
      } catch (error) {
        console.error("Failed to reserve new username:", error);
      }
    }
  }
);

/**
 * Handle ban expiration check (runs every minute via scheduler)
 */
exports.checkBanExpiration = onRequest(
  { schedule: "every 1 minutes" },
  async (req, res) => {
    const now = Timestamp.now();
    
    const expiredBans = await db.collection("users")
      .where("banned", "==", true)
      .where("banEndAt", "<=", now)
      .get();
    
    for (const doc of expiredBans.docs) {
      await doc.ref.update({
        banned: false,
        banReason: null,
        bannedAt: null,
        bannedBy: null,
        banEndAt: null
      });
      
      // Re-enable auth
      try {
        await auth.updateUser(doc.id, { disabled: false });
      } catch (error) {
        console.error("Failed to enable user:", error);
      }
    }
    
    res.send(`Checked ${expiredBans.size} expired bans`);
  }
);

/**
 * Update online status
 */
exports.updateOnlineStatus = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { status } = context.data;
  const uid = getUserId(context);
  
  if (!STATUS_VALUES.includes(status)) {
    throw new Error("Invalid status");
  }
  
  await db.collection("users").doc(uid).update({
    status,
    lastSeen: Timestamp.now()
  });
  
  return { success: true };
});

/**
 * Get online friends
 */
exports.getOnlineFriends = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const uid = getUserId(context);
  
  const friendsSnapshot = await db.collection("friends").doc(uid)
    .collection("userFriends").get();
  
  const onlineFriends = [];
  
  for (const doc of friendsSnapshot.docs) {
    const friendId = doc.data().friendId;
    const friendData = await getUserData(friendId);
    
    if (friendData && friendData.status === "online") {
      onlineFriends.push({
        uid: friendId,
        username: friendData.username,
        discriminator: friendData.discriminator,
        status: friendData.status,
        statusMessage: friendData.statusMessage
      });
    }
  }
  
  return onlineFriends;
});

/**
 * Search users
 */
exports.searchUsers = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { query } = context.data;
  
  if (!query || query.length < 2) {
    throw new Error("Search query must be at least 2 characters");
  }
  
  const normalizedQuery = query.toLowerCase();
  
  const usersSnapshot = await db.collection("users")
    .where("usernameLower", ">=", normalizedQuery)
    .where("usernameLower", "<", normalizedQuery + "\uf8ff")
    .limit(20)
    .get();
  
  const results = [];
  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    results.push({
      uid: doc.id,
      username: data.username,
      discriminator: data.discriminator,
      status: data.status,
      avatarColor: data.avatarColor
    });
  }
  
  return results;
});

/**
 * Get user profile
 */
exports.getUserProfile = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { userId } = context.data;
  
  const userData = await getUserData(userId);
  
  if (!userData) {
    throw new Error("User not found");
  }
  
  return {
    uid: userId,
    username: userData.username,
    discriminator: userData.discriminator,
    status: userData.status,
    statusMessage: userData.statusMessage,
    bio: userData.bio,
    createdAt: userData.createdAt,
    role: userData.role
  };
});

/**
 * Update user profile
 */
exports.updateProfile = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { bio, statusMessage, avatarColor } = context.data;
  const uid = getUserId(context);
  
  const updates = {};
  
  if (bio !== undefined) {
    if (bio.length > 500) {
      throw new Error("Bio must be less than 500 characters");
    }
    updates.bio = bio;
  }
  
  if (statusMessage !== undefined) {
    if (statusMessage.length > 150) {
      throw new Error("Status message must be less than 150 characters");
    }
    updates.statusMessage = statusMessage;
  }
  
  if (avatarColor !== undefined) {
    updates.avatarColor = avatarColor;
  }
  
  await db.collection("users").doc(uid).update(updates);
  
  return { success: true };
});

// ===============================
// CALL FUNCTIONS
// ===============================

/**
 * Create call
 */
exports.createCall = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { type, targetUid } = context.data;
  const uid = getUserId(context);
  
  const callId = db.collection("calls").doc().id;
  
  await db.collection("calls").doc(callId).set({
    type: type || "voice", // voice, video, screen
    status: "pending",
    initiatorId: uid,
    participants: [uid],
    createdAt: Timestamp.now()
  });
  
  // Add initiator as participant
  await db.collection("calls").doc(callId).collection("participants").doc(uid).set({
    uid,
    joinedAt: Timestamp.now(),
    status: "connected"
  });
  
  if (targetUid) {
    // Create call notification for target
    const userData = await getUserData(uid);
    await db.collection("notifications").add({
      userId: targetUid,
      type: "incoming_call",
      title: "Eingehender Anruf",
      message: `${userData.username} ruft an...`,
      callId,
      createdAt: Timestamp.now(),
      read: false
    });
  }
  
  return { callId };
});

/**
 * Join call
 */
exports.joinCall = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { callId } = context.data;
  const uid = getUserId(context);
  
  const callDoc = await db.collection("calls").doc(callId).get();
  if (!callDoc.exists) {
    throw new Error("Call not found");
  }
  
  const callData = callDoc.data();
  
  if (callData.status === "ended") {
    throw new Error("Call has ended");
  }
  
  // Add as participant
  await db.collection("calls").doc(callId).collection("participants").doc(uid).set({
    uid,
    joinedAt: Timestamp.now(),
    status: "connected"
  });
  
  // Update call participants
  await db.collection("calls").doc(callId).update({
    participants: FieldValue.arrayUnion(uid),
    status: "active"
  });
  
  return { success: true };
});

/**
 * Leave call
 */
exports.leaveCall = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { callId } = context.data;
  const uid = getUserId(context);
  
  await db.collection("calls").doc(callId).collection("participants").doc(uid).update({
    status: "left",
    leftAt: Timestamp.now()
  });
  
  // Check if all left
  const participantsSnapshot = await db.collection("calls").doc(callId)
    .collection("participants")
    .where("status", "==", "connected")
    .get();
  
  if (participantsSnapshot.empty) {
    await db.collection("calls").doc(callId).update({
      status: "ended",
      endedAt: Timestamp.now()
    });
  }
  
  return { success: true };
});

/**
 * End call (initiator only)
 */
exports.endCall = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { callId } = context.data;
  const uid = getUserId(context);
  
  const callDoc = await db.collection("calls").doc(callId).get();
  if (!callDoc.exists) {
    throw new Error("Call not found");
  }
  
  const callData = callDoc.data();
  
  if (callData.initiatorId !== uid) {
    throw new Error("Only initiator can end the call");
  }
  
  await db.collection("calls").doc(callId).update({
    status: "ended",
    endedAt: Timestamp.now()
  });
  
  return { success: true };
});

/**
 * Get call info
 */
exports.getCallInfo = onCall(async (context) => {
  if (!isAuthenticated(context)) {
    throw new Error("Authentication required");
  }
  
  const { callId } = context.data;
  
  const callDoc = await db.collection("calls").doc(callId).get();
  if (!callDoc.exists) {
    throw new Error("Call not found");
  }
  
  const callData = callDoc.data();
  
  // Get participants
  const participantsSnapshot = await db.collection("calls").doc(callId)
    .collection("participants").get();
  
  const participants = [];
  for (const doc of participantsSnapshot.docs) {
    const pData = doc.data();
    const userData = await getUserData(pData.uid);
    participants.push({
      uid: doc.id,
      username: userData?.username,
      discriminator: userData?.discriminator,
      status: pData.status
    });
  }
  
  return {
    id: callId,
    type: callData.type,
    status: callData.status,
    initiatorId: callData.initiatorId,
    participants,
    createdAt: callData.createdAt,
    endedAt: callData.endedAt
  };
});

// Export role constants for client use
exports.ROLES = ROLES;
exports.ROLE_HIERARCHY = ROLE_HIERARCHY;
