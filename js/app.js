/**
 * Naija Math Battle — App State & Screen Manager
 */

// ===================== CHARACTERS =====================
const CHARACTERS = [
  { id: 'tunde',  name: 'Tunde',  sprite: 'tunde',  color: '#1565c0', imgX: '0%',    imgY: '0%',   file: 'set_a.jpg', bgPos: '16% center', pullerImg: 'puller_agbada_man.png',   gender: 'm' },
  { id: 'amaka',  name: 'Amaka',  sprite: 'amaka',  color: '#e91e63', imgX: '50%',   imgY: '0%',   file: 'set_a.jpg', bgPos: '50% center', pullerImg: 'puller_ankara_woman.png', gender: 'f' },
  { id: 'emeka',  name: 'Emeka',  sprite: 'emeka',  color: '#f57c00', imgX: '83%',   imgY: '0%',   file: 'set_a.jpg', bgPos: '83% center', pullerImg: 'puller_isiagu_man.png',   gender: 'm' },
  { id: 'fatima', name: 'Fatima', sprite: 'fatima', color: '#e91e8e', imgX: '16%',   imgY: '0%',   file: 'set_b.jpg', bgPos: '16% center', pullerImg: 'puller_ankara_woman.png', gender: 'f' },
  { id: 'chike',  name: 'Chike',  sprite: 'chike',  color: '#2e7d32', imgX: '50%',   imgY: '0%',   file: 'set_b.jpg', bgPos: '50% center', pullerImg: 'puller_agbada_man.png',   gender: 'm' },
  { id: 'sade',   name: 'Sade',   sprite: 'sade',   color: '#7b1fa2', imgX: '83%',   imgY: '0%',   file: 'set_b.jpg', bgPos: '83% center', pullerImg: 'puller_ankara_woman.png', gender: 'f' },
];

// ===================== APP STATE =====================
const App = {
  user: null,
  profile: null,
  selectedChar: null,
  gameMode: null,       // 'local' | 'online'
  currentRoomId: null,
  isHost: false,
  roomListener: null,
  challengeListener: null,

  async init() {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        App.user = user;
        App.profile = await Auth.loadProfile(user.uid);
        if (!App.profile) {
          App.showScreen('character');
          App.renderCharacterGrid();
          const charInput = document.getElementById('char-username');
          if (charInput && !charInput.value && user.displayName) {
            const cleanName = user.displayName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15);
            if (cleanName) charInput.value = cleanName;
          }
        } else {
          App.selectedChar = CHARACTERS.find(c => c.id === App.profile.character) || CHARACTERS[0];
          App.showScreen('home');
          App.renderHome();
          App.listenForChallenges();
        }
      } else {
        App.user = null;
        App.profile = null;
        App.showScreen('auth');
      }
    });
  },

  showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(`screen-${name}`);
    if (el) {
      el.classList.add('active');
      el.scrollTop = 0;
    }
  },

  renderHome() {
    const p = App.profile;
    if (!p) return;
    document.getElementById('home-username').textContent = p.username;
    document.getElementById('home-wins').textContent    = p.wins    || 0;
    document.getElementById('home-losses').textContent  = p.losses  || 0;
    document.getElementById('home-rating').textContent  = p.rating  || 1000;
    const char = CHARACTERS.find(c => c.id === p.character) || CHARACTERS[0];
    document.getElementById('home-char-img').style.backgroundImage  = `url('assets/characters/${char.file}')`;
    document.getElementById('home-char-img').style.backgroundPosition = char.bgPos;
    document.getElementById('home-char-name').textContent = char.name;
  },

  // ---- Render character grid on character select screen ----
  renderCharacterGrid() {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    CHARACTERS.forEach(ch => {
      const card = document.createElement('div');
      card.className = 'char-card' + (App.selectedChar?.id === ch.id ? ' selected' : '');
      card.innerHTML = `
        <div class="char-avatar-img" style="background-image:url('assets/characters/${ch.file}'); background-position:${ch.bgPos};"></div>
        <span class="char-card-name">${ch.name}</span>
      `;
      card.onclick = () => {
        App.selectedChar = ch;
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      };
      grid.appendChild(card);
    });
  },

  // ---- Save character choice & create profile ----
  async saveCharacter() {
    const username = document.getElementById('char-username').value.trim();
    if (!username || username.length < 3) {
      showToast('Enter a username (min 3 characters)!', 'error');
      return;
    }
    if (!App.selectedChar) {
      showToast('Choose a character first!', 'error');
      return;
    }
    // Check username availability
    const taken = await Auth.isUsernameTaken(username);
    if (taken) { showToast('Username already taken. Try another!', 'error'); return; }

    const profile = {
      username,
      character: App.selectedChar.id,
      wins: 0, losses: 0, rating: 1000,
      uid: App.user.uid,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    await Auth.saveProfile(App.user.uid, username, profile);
    App.profile = profile;
    App.showScreen('home');
    App.renderHome();
    App.listenForChallenges();
    showToast(`Welcome, ${username}! 🎉`, 'success');
  },

  // ---- Listen for incoming challenges ----
  listenForChallenges() {
    if (!App.user) return;
    if (App.challengeListener) App.challengeListener();
    const ref = db.ref(`challenges/${App.user.uid}`);
    ref.on('child_added', snap => {
      const ch = snap.val();
      if (!ch || ch.status !== 'pending') return;
      // Show challenge modal
      showChallengeInvite(snap.key, ch);
    });
    App.challengeListener = () => ref.off();
  },

  cleanup() {
    if (typeof App.roomListener === 'function') {
      try { App.roomListener(); } catch (e) {}
    }
    App.roomListener = null;
  }
};

// ===================== TOAST =====================
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent  = msg;
  t.className    = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ===================== CHALLENGE INVITE MODAL =====================
function showChallengeInvite(challengeKey, data) {
  const modal  = document.getElementById('modal-challenge');
  const fromEl = document.getElementById('challenge-from');
  fromEl.textContent = `${data.fromUsername} wants to battle you! ⚔️`;
  modal.classList.add('show');

  document.getElementById('btn-accept-challenge').onclick = async () => {
    modal.classList.remove('show');
    await db.ref(`challenges/${App.user.uid}/${challengeKey}`).update({ status: 'accepted' });
    Lobby.joinRoom(data.roomId, false);
  };
  document.getElementById('btn-decline-challenge').onclick = async () => {
    modal.classList.remove('show');
    await db.ref(`challenges/${App.user.uid}/${challengeKey}`).update({ status: 'declined' });
  };
}

// ===================== LEADERBOARD =====================
async function loadLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '<p class="loading-text">Loading...</p>';
  try {
    const snap = await firestore.collection('leaderboard')
      .orderBy('rating', 'desc').limit(20).get();
    list.innerHTML = '';
    let rank = 1;
    snap.forEach(doc => {
      const d = doc.data();
      const char = CHARACTERS.find(c => c.id === d.character) || CHARACTERS[0];
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const isMe  = doc.id === App.user?.uid;
      list.innerHTML += `
        <div class="lb-row${isMe ? ' lb-me' : ''}">
          <span class="lb-rank">${medal}</span>
          <div class="lb-char-dot" style="background:${char.color}"></div>
          <span class="lb-name">${d.username}${isMe ? ' (You)' : ''}</span>
          <span class="lb-wins">${d.wins || 0}W</span>
          <span class="lb-rating">${d.rating || 1000} pts</span>
        </div>`;
      rank++;
    });
    if (!snap.size) list.innerHTML = '<p class="loading-text">No players yet. Be the first!</p>';
  } catch (e) {
    if (e.code === 'not-found' || (e.message && e.message.includes('not exist'))) {
      list.innerHTML = '<p class="loading-text" style="color:var(--gold);padding:1rem;">⚠️ Cloud Firestore database has not been created yet.<br><small style="color:var(--text-dim)">Go to Firebase Console → Firestore Database → Create Database.</small></p>';
    } else {
      list.innerHTML = '<p class="loading-text">Could not load leaderboard. Check Firebase setup.</p>';
    }
  }
}
