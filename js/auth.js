/**
 * Naija Math Battle — Authentication
 */
const Auth = {
  async register(email, password, cb) {
    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        await auth.signOut();
      }
      App.isGuest = false;
      sessionStorage.removeItem('nmb_guest');
      await auth.createUserWithEmailAndPassword(email, password);
      cb(null);
    } catch (e) { cb(e.message); }
  },

  async login(email, password, cb) {
    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        await auth.signOut();
      }
      App.isGuest = false;
      sessionStorage.removeItem('nmb_guest');
      await auth.signInWithEmailAndPassword(email, password);
      cb(null);
    } catch (e) { cb(e.message); }
  },

  async loginWithGoogle(cb) {
    try {
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        await auth.signOut();
      }
      App.isGuest = false;
      sessionStorage.removeItem('nmb_guest');
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await auth.signInWithPopup(provider);
      if (cb) cb(null);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') {
        if (cb) cb(null);
        return;
      }
      // If popup is blocked by browser, simulator, or COOP policy, fall back to redirect
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await auth.signInWithRedirect(provider);
          return;
        } catch (redirErr) {
          if (cb) cb(redirErr.message);
          return;
        }
      }
      if (cb) cb(e.message);
    }
  },

  async signInGuest() {
    try {
      if (auth.signInAnonymously) {
        const cred = await auth.signInAnonymously();
        return cred.user;
      }
    } catch (e) {
      console.info('Firebase anonymous auth not enabled or restricted; continuing with local guest session:', e.message);
    }
    return null;
  },

  async logout() {
    App.cleanup();
    if (App.challengeListener) { App.challengeListener(); App.challengeListener = null; }
    sessionStorage.removeItem('nmb_guest');
    App.isGuest = false;
    App.user = null;
    App.profile = null;
    if (auth.currentUser) {
      try { await auth.signOut(); } catch (e) {}
    }
    App.showScreen('auth');
  },

  async loadProfile(uid) {
    const snap = await db.ref(`users/${uid}`).get();
    return snap.exists() ? snap.val() : null;
  },

  async saveProfile(uid, username, profile) {
    await db.ref(`users/${uid}`).set(profile);
    // Also save to username index for search
    await db.ref(`usernames/${username}`).set(uid);
    // Firestore leaderboard entry (safeguarded against adblocker ERR_BLOCKED_BY_CLIENT)
    try {
      await firestore.collection('leaderboard').doc(uid).set({
        username: profile.username,
        character: profile.character,
        wins: 0, losses: 0, rating: 1000
      });
    } catch (e) {
      console.warn('Leaderboard sync skipped (Firestore blocked by adblocker or unavailable):', e);
    }
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
    // DO NOT register stats or wins if user is in guest mode or anonymous
    if (App.isGuest || !uid || String(uid).startsWith('guest_') || (auth.currentUser && auth.currentUser.isAnonymous)) {
      console.info('Guest mode: win/loss is not registered to leaderboard or profile.');
      return;
    }
    const ref  = db.ref(`users/${uid}`);
    const snap = await ref.get();
    const p    = snap.val() || {};
    const wins   = (p.wins   || 0) + (won ? 1 : 0);
    const losses = (p.losses || 0) + (won ? 0 : 1);
    const ratingDelta = won ? 25 : -15;
    const rating = Math.max(0, (p.rating || 1000) + ratingDelta);
    await ref.update({ wins, losses, rating });
    try {
      await firestore.collection('leaderboard').doc(uid).update({ wins, losses, rating });
    } catch (e) {
      console.warn('Leaderboard stat sync skipped:', e);
    }
  }
};
