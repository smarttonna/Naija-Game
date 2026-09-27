/**
 * Naija Math Battle — Firebase Config
 * ⚠️  Replace ALL placeholder values with your actual Firebase project credentials.
 *      Go to: Firebase Console → Project Settings → Your Apps → SDK setup
 */

const firebaseConfig = {
  apiKey: "AIzaSyBxF8ZDXBbNurWjvK262Jdu2mHM5Kx5l6g",
  authDomain: "naija-game.firebaseapp.com",
  databaseURL: "https://naija-game-default-rtdb.firebaseio.com",
  projectId: "naija-game",
  storageBucket: "naija-game.firebasestorage.app",
  messagingSenderId: "754519002596",
  appId: "1:754519002596:web:df3478785eca97327d4bf1",
  measurementId: "G-HP3LW1GK4M"
};

firebase.initializeApp(firebaseConfig);

// Service references (used throughout the app)
const auth     = firebase.auth();
const db       = firebase.database();       // Realtime DB — live game state
const firestore = firebase.firestore();     // Firestore — profiles, leaderboard

window.auth      = auth;
window.db        = db;
window.firestore = firestore;
