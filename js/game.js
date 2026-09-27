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

    // Setup Tug-of-War Arena pullers with character portraits, real human images & team colors
    const setPuller = (side, char, name, pullerImg) => {
      const avatar = document.getElementById(`local-avatar-${side}`);
      const nameEl = document.getElementById(`local-puller-name-${side}`);
      const puller = document.getElementById(`local-puller-${side}`);
      const imgEl  = document.getElementById(`local-puller-img-${side}`);
      if (avatar) {
        avatar.style.backgroundImage = `url('assets/characters/${char.file}')`;
        avatar.style.backgroundPosition = char.bgPos;
        avatar.style.borderColor = char.color;
      }
      if (nameEl) nameEl.textContent = name;
      if (puller) puller.style.setProperty('--puller-color', char.color);
      if (imgEl) {
        imgEl.src = `assets/characters/${pullerImg}`;
      }
    };
    let t1Img = t1char.pullerImg || 'puller_agbada_man.png';
    let t2Img = t2char.pullerImg || 'puller_ankara_woman.png';
    if (t1Img === t2Img) {
      t2Img = (t1Img === 'puller_agbada_man.png') ? 'puller_isiagu_man.png' : 'puller_agbada_man.png';
    }
    setPuller('left', t1char, settings.team1Name || t1char.name, t1Img);
    setPuller('right', t2char, settings.team2Name || t2char.name, t2Img);

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

    // Setup Online Tug-of-War Arena pullers with character portraits, real human images & team colors
    const setOnlinePuller = (side, char, name, pullerImg) => {
      const avatar = document.getElementById(`online-avatar-${side}`);
      const nameEl = document.getElementById(`online-puller-name-${side}`);
      const puller = document.getElementById(`online-puller-${side}`);
      const imgEl  = document.getElementById(`online-puller-img-${side}`);
      if (avatar) {
        avatar.style.backgroundImage = `url('assets/characters/${char.file}')`;
        avatar.style.backgroundPosition = char.bgPos;
        avatar.style.borderColor = char.color;
      }
      if (nameEl) nameEl.textContent = name;
      if (puller) puller.style.setProperty('--puller-color', char.color);
      if (imgEl) {
        imgEl.src = `assets/characters/${pullerImg}`;
      }
    };
    let myImg = charMe.pullerImg || 'puller_agbada_man.png';
    let oppImg = charOpp.pullerImg || 'puller_ankara_woman.png';
    if (myImg === oppImg) {
      oppImg = (myImg === 'puller_agbada_man.png') ? 'puller_isiagu_man.png' : 'puller_agbada_man.png';
    }
    setOnlinePuller('left', charMe, myName, myImg);
    setOnlinePuller('right', charOpp, oppName || 'Opponent', oppImg);

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
    // ropePosition ranges from -5 (team1/left wins) to +5 (team2/right wins)
    const pos = Game.ropePosition;
    // Map -5..+5 to percentage 18%..82% so marker stays within the pullers
    const pct = 50 + (pos / 5) * 32;

    // Update all rope markers (local and online)
    document.querySelectorAll('.rope-marker').forEach(marker => {
      marker.style.left = `${pct}%`;
    });

    // Update Puller positioning & dragging states
    const updateTugPair = (leftId, rightId) => {
      const leftEl  = document.getElementById(leftId);
      const rightEl = document.getElementById(rightId);
      if (!leftEl || !rightEl) return;

      leftEl.classList.remove('pulling-hard', 'being-dragged', 'dragged-loss', 'victorious');
      rightEl.classList.remove('pulling-hard', 'being-dragged', 'dragged-loss', 'victorious');

      if (pos < 0) {
        // Team 1 (Left) is WINNING / PULLING
        // Right is BEING DRAGGED forward toward center!
        const dragDist = Math.abs(pos) * 8; // dragged forward up to 40px
        const pullDist = Math.abs(pos) * 3; // step back up to 15px

        leftEl.style.transform = `translateX(-${pullDist}px)`;
        rightEl.style.transform = `translateX(-${dragDist}px)`;

        leftEl.classList.add('pulling-hard');
        rightEl.classList.add('being-dragged');

        if (pos <= -5) {
          rightEl.classList.add('dragged-loss');
          leftEl.classList.add('victorious');
        }
      } else if (pos > 0) {
        // Team 2 (Right) is WINNING / PULLING
        // Left is BEING DRAGGED forward toward center!
        const dragDist = pos * 8; // dragged forward up to 40px
        const pullDist = pos * 3; // step back up to 15px

        leftEl.style.transform = `translateX(${dragDist}px)`;
        rightEl.style.transform = `translateX(${pullDist}px)`;

        rightEl.classList.add('pulling-hard');
        leftEl.classList.add('being-dragged');

        if (pos >= 5) {
          leftEl.classList.add('dragged-loss');
          rightEl.classList.add('victorious');
        }
      } else {
        // Neutral (tied at 0)
        leftEl.style.transform = 'translateX(0px)';
        rightEl.style.transform = 'translateX(0px)';
      }
    };

    updateTugPair('local-puller-left', 'local-puller-right');
    updateTugPair('online-puller-left', 'online-puller-right');
  },

  flashRope(team) {
    document.querySelectorAll('.rope-marker').forEach(marker => {
      marker.classList.add(team === 1 ? 'flash-left' : 'flash-right');
      setTimeout(() => marker.classList.remove('flash-left', 'flash-right'), 600);
    });

    // Fun battle shouts in comic bubbles!
    const winShouts = ['HEAVE! 🔥', 'ODOGWU! 💪', 'PULL AM! ⚡', 'I SABI! 🎯', 'NO SHAKING! 💥'];
    const dragShouts = ['YEEPA! 😱', 'SLIPPING! 💦', 'E CHOKE! 😫', 'HOLD AM! 🏃‍♂️', 'WAIT O! 😵'];
    const winWord = winShouts[Math.floor(Math.random() * winShouts.length)];
    const dragWord = dragShouts[Math.floor(Math.random() * dragShouts.length)];

    const shoutPair = (winId, dragId) => {
      const winEl = document.getElementById(winId);
      const dragEl = document.getElementById(dragId);
      if (winEl) {
        winEl.textContent = winWord;
        winEl.classList.add('show');
        setTimeout(() => winEl.classList.remove('show'), 900);
      }
      if (dragEl) {
        dragEl.textContent = dragWord;
        dragEl.classList.add('show');
        setTimeout(() => dragEl.classList.remove('show'), 900);
      }
    };

    if (team === 1) {
      shoutPair('local-shout-left', 'local-shout-right');
      shoutPair('online-shout-left', 'online-shout-right');
    } else {
      shoutPair('local-shout-right', 'local-shout-left');
      shoutPair('online-shout-right', 'online-shout-left');
    }
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
