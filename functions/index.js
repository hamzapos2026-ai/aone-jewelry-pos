const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const allowedRoles = ["admin", "manager", "cashier", "biller"];
const validStatuses = ["active", "inactive"];

exports.createUserBySuperAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required to create a user."
    );
  }

  const creatorUid = context.auth.uid;
  const creatorDoc = await db.collection("users").doc(creatorUid).get();
  if (!creatorDoc.exists || creatorDoc.data().role !== "superadmin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only superadmin users can create new users."
    );
  }

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");
  const role = String(data.role || "").trim();
  const status = String(data.status || "").trim();

  if (!name) {
    throw new functions.https.HttpsError("invalid-argument", "User name is required.");
  }
  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "User email is required.");
  }
  if (!password || password.length < 6) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Password must contain at least 6 characters."
    );
  }
  if (!allowedRoles.includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid user role.");
  }
  if (!validStatuses.includes(status)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid user status.");
  }

  try {
    await admin.auth().getUserByEmail(email);
    throw new functions.https.HttpsError("already-exists", "Email already exists.");
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "Failed to verify email uniqueness."
      );
    }
  }

  const newUser = await admin.auth().createUser({
    email,
    password,
    displayName: name,
    disabled: status !== "active"
  });

  await admin.auth().setCustomUserClaims(newUser.uid, { role });

  await db.collection("users").doc(newUser.uid).set({
    uid: newUser.uid,
    email,
    name,
    role,
    status,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: creatorUid,
    lastLogin: null
  });

  return {
    success: true,
    uid: newUser.uid,
    email,
    name,
    role,
    status
  };
});
