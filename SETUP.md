# 🇳🇬 Naija Math Battle — Setup Guide

## Step 1: Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add Project"** → name it `naija-math-battle`
3. Disable Google Analytics (optional) → Create

---

## Step 2: Enable Authentication

1. In Firebase Console → **Authentication** → Get Started
2. Enable **Email/Password** provider
3. Click Save

---

## Step 3: Enable Realtime Database

1. In Firebase Console → **Realtime Database** → Create Database
2. Choose a region (e.g., `us-central1`)
3. Start in **Test Mode** (we'll secure it below)

### Set these Security Rules:
Go to Realtime Database → **Rules** tab, paste:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth.uid === $uid"
      }
    },
    "usernames": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "rooms": {
      "$roomId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "challenges": {
      "$targetUid": {
        ".read": "auth.uid === $targetUid",
        ".write": "auth != null"
      }
    }
  }
}
```

---

## Step 4: Enable Firestore

1. Firebase Console → **Firestore Database** → Create Database
2. Start in **Test Mode**

### Set these Firestore Rules:
Go to Firestore → **Rules** tab, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == uid;
    }
  }
}
```

---

## Step 5: Get Your Firebase Config

1. Firebase Console → **Project Settings** (gear icon)
2. Scroll to **"Your apps"** → Click **Web** (</> icon)
3. Register the app as "Naija Math Battle"
4. Copy the `firebaseConfig` object

---

## Step 6: Update js/config.js

Open [`js/config.js`](js/config.js) and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",           // ← Your actual key
  authDomain: "naija-math-battle.firebaseapp.com",
  databaseURL: "https://naija-math-battle-default-rtdb.firebaseio.com",
  projectId: "naija-math-battle",
  storageBucket: "naija-math-battle.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Step 7: Open the Game

With XAMPP running, open your browser and go to:
```
http://localhost/Game/
```

---

## Game Modes

| Mode | How it works |
|---|---|
| **Local Battle** | Two players, one device. Split-screen. No internet needed |
| **Online Battle** | Create a room → share the 6-digit code → friend joins on any device |
| **Challenge Friend** | Search by username → send a battle invite → they accept |

---

## File Structure

```
Game/
├── index.html          ← Main SPA
├── css/
│   └── style.css       ← All styles
├── js/
│   ├── config.js       ← 🔑 Firebase config (update this!)
│   ├── questions.js    ← Deterministic question generator
│   ├── app.js          ← App state, character defs, home screen
│   ├── auth.js         ← Firebase auth & user profiles
│   ├── lobby.js        ← Room creation, joining, challenges
│   └── game.js         ← Core game engine
└── assets/
    ├── hero.jpg        ← Landing page banner
    └── characters/
        ├── set_a.jpg   ← Tunde, Amaka, Emeka
        └── set_b.jpg   ← Fatima, Chike, Sade
```
