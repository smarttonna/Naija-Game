/**
 * Naija Math Battle — Lobby (Room creation, joining, searching)
 */
const Lobby = {
  // Generate a readable room code: NAI-XXXXXX
  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'NAI-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  // ====== LOCAL (Pass 'n' Play) ======
  startLocalGame(settings) {
    App.gameMode  = 'local';
    App.isHost    = true;
    App.cleanup();
    Game.startLocal(settings);
  },

  // ====== ONLINE — Create Room ======
  async createRoom() {
    if (!App.user) { await App.playAsGuest(); }
    const roomId = Lobby.generateCode();
    App.currentRoomId = roomId;
    App.isHost        = true;

    const roomData = {
      hostId:        App.user.uid,
      hostUsername:  App.profile.username,
      hostCharacter: App.profile.character,
      hostIsGuest:   !!App.isGuest,
      guestId:       null,
      guestUsername: null,
      guestCharacter: null,
      guestIsGuest:  false,
      status:        'waiting',
      settings:      null,
      seed:          Math.floor(Math.random() * 9999999),
      currentRound:  0,
      totalRounds:   10,
      ropePosition:  0,
      team1Score:    0,
      team2Score:    0,
      winner:        null,
      createdAt:     firebase.database.ServerValue.TIMESTAMP
    };

    await db.ref(`rooms/${roomId}`).set(roomData);

    // Show waiting screen
    App.showScreen('waiting');
    document.getElementById('waiting-code').textContent  = roomId;
    document.getElementById('waiting-title').textContent = 'Waiting for opponent...';
    document.getElementById('waiting-sub').textContent   = 'Share this code with your friend';

    // Listen for a guest to join
    const guestRef = db.ref(`rooms/${roomId}/guestId`);
    guestRef.on('value', snap => {
      if (snap.val()) {
        // Guest joined — show setup screen (host configures)
        db.ref(`rooms/${roomId}/status`).set('setup');
        App.showScreen('setup');
        Lobby.initSetupScreen(roomId);
      }
    });
    App.roomListener = () => guestRef.off();
  },

  // ====== ONLINE — Join by Room Code ======
  async joinRoom(roomId, showScreen = true) {
    if (!App.user) { await App.playAsGuest(); }
    App.currentRoomId = roomId;
    App.isHost        = false;
    App.gameMode      = 'online';
    App.cleanup();

    const snap = await db.ref(`rooms/${roomId}`).get();
    if (!snap.exists()) { showToast('Room not found! Check the code.', 'error'); return; }

    const room = snap.val();
    if (room.status !== 'waiting') { showToast('That room is already in progress!', 'error'); return; }
    if (room.hostId === App.user.uid) { showToast("You can't join your own room!", 'error'); return; }

    await db.ref(`rooms/${roomId}`).update({
      guestId:        App.user.uid,
      guestUsername:  App.profile.username,
      guestCharacter: App.profile.character,
      guestIsGuest:   !!App.isGuest
    });

    // Show waiting screen (guest waits for host to configure)
    if (showScreen) App.showScreen('waiting');
    document.getElementById('waiting-code').textContent  = roomId;
    document.getElementById('waiting-title').textContent = 'Joined! Waiting for host to set up...';
    document.getElementById('waiting-sub').textContent   = `vs ${room.hostUsername}`;

    // Listen for status changes
    Lobby.listenRoomStatus(roomId);
  },

  // ====== ONLINE — Challenge by Username ======
  async challengeUser(targetUsername) {
    if (targetUsername === App.profile.username) {
      showToast("You can't challenge yourself!", 'error'); return;
    }
    const target = await Auth.findUserByUsername(targetUsername);
    if (!target) { showToast('Player not found. Check the username.', 'error'); return; }

    // Create the room first
    const roomId = Lobby.generateCode();
    App.currentRoomId = roomId;
    App.isHost        = true;
    App.gameMode      = 'online';

    await db.ref(`rooms/${roomId}`).set({
      hostId: App.user.uid, hostUsername: App.profile.username, hostCharacter: App.profile.character,
      guestId: null, guestUsername: null, guestCharacter: null,
      status: 'waiting', settings: null,
      seed: Math.floor(Math.random() * 9999999),
      currentRound: 0, totalRounds: 10, ropePosition: 0,
      team1Score: 0, team2Score: 0, winner: null,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    // Send challenge
    const challengeId = db.ref(`challenges/${target.uid}`).push().key;
    await db.ref(`challenges/${target.uid}/${challengeId}`).set({
      fromUid:      App.user.uid,
      fromUsername: App.profile.username,
      fromCharacter: App.profile.character,
      roomId,
      status:      'pending',
      timestamp:   firebase.database.ServerValue.TIMESTAMP
    });

    // Show waiting
    App.showScreen('waiting');
    document.getElementById('waiting-code').textContent  = roomId;
    document.getElementById('waiting-title').textContent = `Challenge sent to ${target.username}! ⚔️`;
    document.getElementById('waiting-sub').textContent   = 'Waiting for them to accept...';

    // Listen for acceptance
    const challengeRef = db.ref(`challenges/${target.uid}/${challengeId}/status`);
    const unsub = challengeRef.on('value', snap => {
      if (snap.val() === 'accepted') {
        challengeRef.off('value', unsub);
        Lobby.listenRoomStatus(roomId);
      }
      if (snap.val() === 'declined') {
        challengeRef.off('value', unsub);
        showToast(`${target.username} declined the challenge.`, 'error');
        App.showScreen('mode');
      }
    });
  },

  // ====== Listen to room status changes (guest side + both after setup) ======
  listenRoomStatus(roomId) {
    App.cleanup();
    App.roomListener = () => db.ref(`rooms/${roomId}`).off();
    db.ref(`rooms/${roomId}`).on('value', snap => {
      if (!snap.exists()) return;
      const room = snap.val();

      if (room.status === 'countdown') {
        App.showScreen('game');
        Game.startOnline(room, App.user.uid);
      }
    });
  },

  // ====== Setup Screen (host only) ======
  initSetupScreen(roomId) {
    document.getElementById('setup-room-id').textContent = roomId;
    App.gameMode = 'online';

    document.getElementById('btn-start-game').onclick = async () => {
      const ops        = [...document.querySelectorAll('.op-btn.active')].map(b => b.dataset.op);
      const difficulty = document.querySelector('.diff-btn.active')?.dataset.diff || 'medium';
      const qtype      = document.querySelector('.qtype-btn.active')?.dataset.type || 'arithmetic';
      const rounds     = parseInt(document.getElementById('rounds-select').value) || 10;

      if (!ops.length) { showToast('Select at least one math operation!', 'error'); return; }

      await db.ref(`rooms/${roomId}/settings`).set({ operations: ops, difficulty, questionType: qtype, totalRounds: rounds });
      await db.ref(`rooms/${roomId}`).update({ status: 'countdown', totalRounds: rounds });

      App.showScreen('game');
      const snap = await db.ref(`rooms/${roomId}`).get();
      Game.startOnline(snap.val(), App.user.uid);
    };
  }
};
