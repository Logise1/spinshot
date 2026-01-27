// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA2mBPrQrMX4d-kTqB5md72THurGa25W2E",
    authDomain: "spin-397bc.firebaseapp.com",
    projectId: "spin-397bc",
    storageBucket: "spin-397bc.firebasestorage.app",
    messagingSenderId: "458475015970",
    appId: "1:458475015970:web:d3f626ad5a9e8654b89f7b",
    measurementId: "G-LXHFCTVS55"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, doc, setDoc, getDoc, updateDoc, onSnapshot };
