// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
export const analytics = getAnalytics(firebaseApp);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Connect to emulators if USE_AUTH_EMULATOR is true
if (import.meta.env.VITE_USE_AUTH_EMULATOR === 'true') {
  console.log('🔧 Using Auth Emulator');
  connectAuthEmulator(auth, 'http://localhost:9099');

  console.log('🔧 Using Firestore Emulator');
  connectFirestoreEmulator(db, 'localhost', 8080);

  console.log('🔧 Using Storage Emulator');
  connectStorageEmulator(storage, 'localhost', 9199);

}
