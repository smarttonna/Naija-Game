/**
 * Naija Math Battle — Core Game Engine
 * Handles both LOCAL (pass 'n' play) and ONLINE modes
 */
const Game = {
  // ---- State ----
  mode: null,           // 'local' | 'online'
  seed: 0,
  operations: ['add'],
  difficulty: 'easy',
  questionType: 'arithmetic',
  totalRounds: 10,
  currentRound: 0,
  ropePosition: 0,      // -5 = team1 wins, +5 = team2 wins
  team1Score: 0,
  team2Score: 0,
  currentQuestion: null,
  timerSecs: 10,
  timerInterval: null,
  myTeam: null,         // 'host' | 'guest' (online only)
  myUid: null,
  roomId: null,
  team1Answered: false,
  team2Answered: false,
  myAnswered: false,
  fbListener: null,
  roundActive: false,

  // =========================================================
  //  LOCAL MODE
  // =========================================================
  startLocal(settings) {
    Game.mode         = 'local';
    Game.seed         = Math.floor(Math.random() * 9999999);
    Game.operations   = settings.operations;
    Game.difficulty   = settings.difficulty;
    Game.questionType = settings.questionType;
    Game.totalRounds  = settings.totalRounds;
    Game.currentRound = 0;
    Game.ropePosition = 0;
    Game.team1Score   = 0;
    Game.team2Score   = 0;

    // Apply team names / characters
    const t1char = CHARACTERS.find(c => c.id === settings.team1Char) || CHARACTERS[0];
    const t2char = CHARACTERS.find(c => c.id === settings.team2Char) || CHARACTERS[1];
    document.getElementById('local-t1-name').textContent = settings.team1Name || t1char.name;
    document.getElementById('local-t2-name').textContent = settings.team2Name || t2char.name;
    document.getElementById('local-t1-char').style.backgroundImage   = `url('assets/characters/${t1char.file}')`;
    document.getElementById('local-t1-char').style.backgroundPosition = t1char.bgPos;
    document.getElementById('local-t2-char').style.backgroundImage   = `url('assets/characters/${t2char.file}')`;
    document.getElementById('local-t2-char').style.backgroundPosition = t2char.bgPos;
    document.getElementById('local-t1-panel').style.setProperty('--team-color', t1char.color);
    document.getElementById('local-t2-panel').style.setProperty('--team-color', t2char.color);

    Game.showView('local');
    Game.updateRopeUI();
    Game.nextRoundLocal();
  },

  nextRoundLocal() {
    Game.currentRound++;
    Game.roundActive    = true;
    Game.team1Answered  = false;
    Game.team2Answered  = false;
    document.getElementById('local-t1-input').value = '';
    document.getElementById('local-t2-input').value = '';
    document.getElementById('local-t1-input').classList.remove('correct','wrong');
    document.getElementById('local-t2-input').classList.remove('correct','wrong');

    const q = Questions.generateQuestion(Game.seed, Game.currentRound, Game.operations, Game.difficulty, Game.questionType);
    Game.currentQuestion = q;

    document.getElementById('local-t1-question').textContent = q.text;
    document.getElementById('local-t2-question').textContent = q.text;
    document.getElementById('local-round').textContent = `Round ${Game.currentRound}/${Game.totalRounds}`;
    Game.startTimer('local-timer', 15, () => Game.nextRoundLocal());
  },

  submitLocalAnswer(team) {
    if (!Game.roundActive) return;
    const inp  = document.getElementById(`local-t${team}-input`);
    const val  = parseInt(inp.value);
    if (isNaN(val)) { showToast('Type a number first!', 'error'); return; }

    const correct = val === Game.currentQuestion.answer;
    inp.classList.add(correct ? 'correct' : 'wrong');

    if (correct) {
      Game.roundActive = false;
      clearInterval(Game.timerInterval);
      if (team === 1) { Game.ropePosition = Math.max(-5, Game.ropePosition - 1); Game.team1Score++; }
      else            { Game.ropePosition = Math.min( 5, Game.ropePosition + 1); Game.team2Score++; }
      Game.updateRopeUI();
      Game.updateScoreLocal();
      Game.flashRope(team);

      setTimeout(() => {
        if (Game.checkGameOver()) { Game.endLocalGame(); }
        else { Game.nextRoundLocal(); }
      }, 1200);
    } else {
      setTimeout(() => { inp.classList.remove('wrong'); inp.value = ''; }, 600);
    }
  },

  endLocalGame() {
    const winner = Game.ropePosition < 0 ? 1 : Game.ropePosition > 0 ? 2 : 0;
    const n1 = document.getElementById('local-t1-name').textContent;
    const n2 = document.getElementById('local-t2-name').textContent;
    const winnerName = winner === 0 ? "It's a DRAW! 🤝" : winner === 1 ? `${n1} WINS! 🏆` : `${n2} WINS! 🏆`;
    Game.showResults(winnerName, Game.team1Score, Game.team2Score, n1, n2);
  },

  // =========================================================
  //  ONLINE MODE
  // =========================================================
  startOnline(roomData, myUid) {
    Game.mode         = 'online';
    Game.myUid        = myUid;
    Game.roomId       = App.currentRoomId;
    Game.myTeam       = (roomData.hostId === myUid) ? 'host' : 'guest';
    Game.seed         = roomData.seed;
    Game.totalRounds  = roomData.totalRounds || 10;
    const s           = roomData.settings || {};
    Game.operations   = s.operations  || ['add'];
    Game.difficulty   = s.difficulty  || 'easy';
    Game.questionType = s.questionType || 'arithmetic';
    Game.currentRound = 0;
    Game.ropePosition = 0;
    Game.team1Score   = 0;
    Game.team2Score   = 0;

    // Set opponent info
    const oppName  = Game.myTeam === 'host' ? roomData.guestUsername  : roomData.hostUsername;
    const oppChar  = Game.myTeam === 'host' ? roomData.guestCharacter : roomData.hostCharacter;
    const myChar   = Game.myTeam === 'host' ? roomData.hostCharacter  : roomData.guestCharacter;
    const myName   = Game.myTeam === 'host' ? roomData.hostUsername   : roomData.guestUsername;
    const charMe   = CHARACTERS.find(c => c.id === myChar)  || CHARACTERS[0];
    const charOpp  = CHARACTERS.find(c => c.id === oppChar) || CHARACTERS[1];

    document.getElementById('online-my-name').textContent  = myName;
    document.getElementById('online-opp-name').textContent = oppName || '...';
    document.getElementById('online-my-char').style.backgroundImage   = `url('assets/characters/${charMe.file}')`;
    document.getElementById('online-my-char').style.backgroundPosition = charMe.bgPos;
    document.getElementById('online-opp-char').style.backgroundImage   = `url('assets/characters/${charOpp.file}')`;
    document.getElementById('online-opp-char').style.backgroundPosition = charOpp.bgPos;

    Game.showView('online');
    Game.updateRopeUI();

    // 3-2-1 countdown then start
    Game.doCountdown(3, () => Game.nextRoundOnline());

    // Listen for room updates (rope, score, winner)
    if (Game.fbListener) { db.ref(`rooms/${Game.roomId}`).off(); }
    db.ref(`rooms/${Game.roomId}`).on('value', snap => {
      if (!snap.exists()) return;
      Game.handleRoomSync(snap.val());
    });
    Game.fbListener = true;
  },

  handleRoomSync(room) {
    // Sync rope & scores from Firebase (authoritative)
    if (room.ropePosition !== undefined) Game.ropePosition = room.ropePosition;
    if (room.team1Score   !== undefined) Game.team1Score   = room.team1Score;
    if (room.team2Score   !== undefined) Game.team2Score   = room.team2Score;
    Game.updateRopeUI();
    Game.updateScoreOnline();

    if (room.winner !== null && room.winner !== undefined && !Game._resultShown) {
      Game._resultShown = true;
      clearInterval(Game.timerInterval);
      const myWin = (room.winner === 'host' && Game.myTeam === 'host') ||
                    (room.winner === 'guest' && Game.myTeam === 'guest') ||
                    room.winner === 'draw';
      const label = room.winner === 'draw' ? "It's a DRAW! 🤝" : myWin ? 'YOU WIN! 🏆' : 'You Lost 😢';
      Game.showResults(label, room.team1Score, room.team2Score,
        room.hostUsername, room.guestUsername);
      // Update stats
      if (App.user) Auth.updateStats(App.user.uid, myWin && room.winner !== 'draw');
    }
  },

  nextRoundOnline() {
    Game.currentRound++;
    Game.myAnswered   = false;
    Game._resultShown = false;
    const q = Questions.generateQuestion(Game.seed, Game.currentRound, Game.operations, Game.difficulty, Game.questionType);
    Game.currentQuestion = q;
    document.getElementById('online-question').textContent = q.text;
    document.getElementById('online-input').value = '';
    document.getElementById('online-input').classList.remove('correct','wrong');
    document.getElementById('online-round').textContent = `Round ${Game.currentRound}/${Game.totalRounds}`;
    document.getElementById('online-feedback').textContent = '';
    Game.startTimer('online-timer', 10, async () => {
      // Timer expired — write no-answer if host
      if (Game.myTeam === 'host') {
        await Game.advanceRoundInDB(null);
      }
    });
  },

  async submitOnlineAnswer(answer) {
    if (Game.myAnswered) return;
    const val = parseInt(answer);
    if (isNaN(val)) return;

    const correct = val === Game.currentQuestion.answer;
    const inp     = document.getElementById('online-input');

    if (correct) {
      Game.myAnswered = true;
      inp.classList.add('correct');
      clearInterval(Game.timerInterval);
      document.getElementById('online-feedback').textContent = '✅ Correct!';
      await Game.advanceRoundInDB(Game.myTeam);
    } else {
      inp.classList.add('wrong');
      document.getElementById('online-feedback').textContent = '❌ Wrong!';
      setTimeout(() => { inp.classList.remove('wrong'); inp.value = ''; document.getElementById('online-feedback').textContent = ''; }, 600);
    }
  },

  // Host submits result to Firebase; guest reacts via handleRoomSync
  async advanceRoundInDB(winner) {
    if (Game.myTeam !== 'host') return; // Only host writes game state
    const ref   = db.ref(`rooms/${Game.roomId}`);
    const snap  = await ref.get();
    const room  = snap.val();
    let newRope = room.ropePosition || 0;
    let t1s     = room.team1Score   || 0;
    let t2s     = room.team2Score   || 0;

    if (winner === 'host') {
      newRope = Math.max(-5, newRope - 1); t1s++;
    } else if (winner === 'guest') {
      newRope = Math.min( 5, newRope + 1); t2s++;
    }

    const round = (room.currentRound || 0) + 1;
    const gameWinner = newRope <= -5 ? 'host' : newRope >= 5 ? 'guest' :
                       round > (room.totalRounds || 10) ?
                         (newRope < 0 ? 'host' : newRope > 0 ? 'guest' : 'draw') : null;

    await ref.update({ ropePosition: newRope, team1Score: t1s, team2Score: t2s, currentRound: round, winner: gameWinner });

    if (!gameWinner) {
      // Small delay before next round for both players
      setTimeout(() => {
        Game.nextRoundOnline();
        // Notify guest to advance via roundTick
        db.ref(`rooms/${Game.roomId}/roundTick`).set(round);
      }, 1200);
    }
  },

  // =========================================================
  //  SHARED UI
  // =========================================================
  showView(mode) {
    document.getElementById('game-view-local').style.display  = mode === 'local'  ? 'flex' : 'none';
    document.getElementById('game-view-online').style.display = mode === 'online' ? 'flex' : 'none';
  },

  doCountdown(n, cb) {
    const el = document.getElementById('countdown-overlay');
    el.classList.add('show');
    let count = n;
    const interval = setInterval(() => {
      el.querySelector('.countdown-num').textContent = count > 0 ? count : 'GO! 🚀';
      if (count <= 0) {
        clearInterval(interval);
        setTimeout(() => { el.classList.remove('show'); cb(); }, 700);
      }
      count--;
    }, 900);
  },

  startTimer(elId, secs, onExpire) {
    clearInterval(Game.timerInterval);
    let t = secs;
    const el = document.getElementById(elId);
    el.textContent = `⏱ ${t}s`;
    el.classList.remove('timer-urgent');
    Game.timerInterval = setInterval(() => {
      t--;
      el.textContent = `⏱ ${t}s`;
      if (t <= 3) el.classList.add('timer-urgent');
      if (t <= 0) { clearInterval(Game.timerInterval); onExpire(); }
    }, 1000);
  },

  updateRopeUI() {
    // rope-marker moves from 0% (team1 wins) to 100% (team2 wins)
    const pct = ((Game.ropePosition + 5) / 10) * 100;
    const marker = document.getElementById('rope-marker');
    if (marker) marker.style.left = `${pct}%`;

    // Pulling animation intensity
    const leftChars  = document.querySelectorAll('.char-pull-left');
    const rightChars = document.querySelectorAll('.char-pull-right');
    leftChars.forEach(el  => el.classList.toggle('winning', Game.ropePosition < 0));
    rightChars.forEach(el => el.classList.toggle('winning', Game.ropePosition > 0));
  },

  flashRope(team) {
    const marker = document.getElementById('rope-marker');
    if (!marker) return;
    marker.classList.add(team === 1 ? 'flash-left' : 'flash-right');
    setTimeout(() => marker.classList.remove('flash-left','flash-right'), 600);
  },

  updateScoreLocal() {
    document.getElementById('local-t1-score').textContent = Game.team1Score;
    document.getElementById('local-t2-score').textContent = Game.team2Score;
    document.getElementById('local-center-t1').textContent = Game.team1Score;
    document.getElementById('local-center-t2').textContent = Game.team2Score;
  },

  updateScoreOnline() {
    const myScore  = Game.myTeam === 'host' ? Game.team1Score : Game.team2Score;
    const oppScore = Game.myTeam === 'host' ? Game.team2Score : Game.team1Score;
    document.getElementById('online-my-score').textContent  = myScore;
    document.getElementById('online-opp-score').textContent = oppScore;
  },

  checkGameOver() {
    return Math.abs(Game.ropePosition) >= 5 || Game.currentRound >= Game.totalRounds;
  },

  showResults(title, t1Score, t2Score, t1Name, t2Name) {
    clearInterval(Game.timerInterval);
    App.showScreen('results');
    document.getElementById('result-title').textContent  = title;
    document.getElementById('result-t1-score').textContent = t1Score;
    document.getElementById('result-t2-score').textContent = t2Score;
    document.getElementById('result-t1-name').textContent  = t1Name  || 'Team 1';
    document.getElementById('result-t2-name').textContent  = t2Name  || 'Team 2';
    Game.launchConfetti();
  },

  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces  = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 3,
      color: ['#00c853','#ffd700','#e91e63','#0095ff','#ff9800'][Math.floor(Math.random() * 5)],
      size: 6 + Math.random() * 8
    }));
    let frame = 0;
    const animate = () => {
      if (frame++ > 180) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.5);
      });
      requestAnimationFrame(animate);
    };
    animate();
  },

  cleanup() {
    clearInterval(Game.timerInterval);
    if (Game.fbListener && Game.roomId) {
      db.ref(`rooms/${Game.roomId}`).off();
      Game.fbListener = null;
    }
    Game._resultShown = false;
    Game.roundActive  = false;
  }
};

// ===== Local keypad handler =====
function localKeypad(team, val) {
  const inp = document.getElementById(`local-t${team}-input`);
  if (val === 'clear') { inp.value = ''; return; }
  if (val === 'submit') { Game.submitLocalAnswer(team); return; }
  if (inp.value.length < 6) inp.value += val;
}

// ===== Online keypad handler =====
function onlineKeypad(val) {
  const inp = document.getElementById('online-input');
  if (val === 'clear') { inp.value = ''; return; }
  if (val === 'submit') { Game.submitOnlineAnswer(inp.value); return; }
  if (inp.value.length < 6) inp.value += val;
}

// Guest roundTick listener is set up in index.html via setupGuestRoundListener()
