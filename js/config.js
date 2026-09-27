/**
 * Naija Math Battle — Firebase Config
 * ⚠️  Replace ALL placeholder values with your actual Firebase project credentials.
 *      Go to: Firebase Console → Project Settings → Your Apps → SDK setup
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

// Service references (used throughout the app)
const auth     = firebase.auth();
const db       = firebase.database();       // Realtime DB — live game state
const firestore = firebase.firestore();     // Firestore — profiles, leaderboard

window.auth      = auth;
window.db        = db;
window.firestore = firestore;
