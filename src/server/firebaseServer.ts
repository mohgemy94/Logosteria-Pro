import { initializeApp } from 'firebase/app';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import fs from 'fs';
import path from 'path';

// Silence verbose internal firestore grpc idle disconnect logs in Node
setLogLevel('silent');

const origConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a) || '')).join(' ');
  if (msg.includes('Disconnecting idle stream') || msg.includes('Timed out waiting for new targets')) {
    return; // Benign idle stream cleanup in Node runtime
  }
  origConsoleError.apply(console, args);
};

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
try {
  const fileContent = fs.readFileSync(configPath, 'utf-8');
  firebaseConfig = JSON.parse(fileContent);
} catch (e) {
  console.warn("Could not load firebase-applet-config.json. Ensure it exists in the root.");
}

const app = initializeApp(firebaseConfig);

// Initialize Firestore with long polling to prevent gRPC idle stream warnings in Node
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

