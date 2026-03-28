import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD5H3vIkOuMalO4PJhMvSTyU4LkwlADwEE",
  authDomain: "clarity-6cba2.firebaseapp.com",
  projectId: "clarity-6cba2",
  storageBucket: "clarity-6cba2.firebasestorage.app",
  messagingSenderId: "7446492195",
  appId: "1:7446492195:web:fb849ce16577e56b4e6d96",
  measurementId: "G-TMSRLL1TTP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
