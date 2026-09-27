/**
 * Naija Math Battle — Authentication
 */
const Auth = {
  async register(email, password, cb) {
    try {
      await auth.createUserWithEmailAndPassword(email, password);
      cb(null);
    } catch (e) { cb(e.message); }
  },

  async login(email, password, cb) {
    try {
      await auth.signInWithEmailAndPassword(email, password);
      cb(null);
    } catch (e) { cb(e.message); }
  },

  async logout() {
    App.cleanup();
    if (App.challengeListener) { App.challengeListener(); App.challengeListener = null; }
    await auth.signOut();
  },

  async loadProfile(uid) {
    const snap = await db.ref(`users/${uid}`).get();
    return snap.exists() ? snap.val() : null;
  },

  async saveProfile(uid, username, profile) {
    await db.ref(`users/${uid}`).set(profile);
    // Also save to username index for search
    await db.ref(`usernames/${username}`).set(uid);
    // Firestore leaderboard entry
    await firestore.collection('leaderboard').doc(uid).set({
      username: profile.username,
      character: profile.character,
      wins: 0, losses: 0, rating: 1000
    });
  },

  async isUsernameTaken(username) {
    const snap = await db.ref(`usernames/${username}`).get();
    return snap.exists();
  },

  async findUserByUsername(username) {
    const snap = await db.ref(`usernames/${username}`).get();
    if (!snap.exists()) return null;
    const uid   = snap.val();
    const usnap = await db.ref(`users/${uid}`).get();
    return usnap.exists() ? { uid, ...usnap.val() } : null;
  },

  async updateStats(uid, won) {
    const ref  = db.ref(`users/${uid}`);
    const snap = await ref.get();
    const p    = snap.val() || {};
    const wins   = (p.wins   || 0) + (won ? 1 : 0);
    const losses = (p.losses || 0) + (won ? 0 : 1);
    const ratingDelta = won ? 25 : -15;
    const rating = Math.max(0, (p.rating || 1000) + ratingDelta);
    await ref.update({ wins, losses, rating });
    await firestore.collection('leaderboard').doc(uid).update({ wins, losses, rating });
  }
};
