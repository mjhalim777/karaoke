// =============================================================
//  Karaoke settings — the only file you need to edit.
//  See README.md for step-by-step instructions.
// =============================================================

// 1) Firebase (makes the TV and the phones talk to each other).
//    Paste the "firebaseConfig" values from your Firebase project here.
//    Leave apiKey empty ("") to run in DEMO MODE, which only syncs
//    between tabs of the same browser on one computer (good for testing).
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyA3oK-3qCxRv8BMg7qcg_fSoP7rrhrAmqA",
  authDomain: "karaoke-24c7c.firebaseapp.com",
  databaseURL: "https://karaoke-24c7c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "karaoke-24c7c",
  storageBucket: "karaoke-24c7c.firebasestorage.app",
  messagingSenderId: "344256829982",
  appId: "1:344256829982:web:cde3e1885e57d0b9786c0f"
};

// 2) YouTube Data API v3 key (lets phones search for songs).
//    Leave empty ("") and phones can still add songs by pasting a YouTube link.
//    This key is PUBLIC once the site is online, so restrict it to your
//    GitHub Pages address in Google Cloud (see README.md).
window.YOUTUBE_API_KEY = "AIzaSyCH7AxGYc3kJtLRMZ6q6Cj9-ohmIjRltyU";
