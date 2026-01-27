import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, doc, setDoc, getDoc, onSnapshot } from "./firebase-config.js";

// Audio Manager
const AudioMgr = {
    bgm: new Audio('static/bgm.mp3'),
    sfxSelect: new Audio('static/select.ogg'),
    sfxPlay: new Audio('static/play.ogg'),
    sfxChange: new Audio('static/change.ogg'),

    init() {
        this.bgm.loop = true;
        this.bgm.volume = 0.3;
        this.sfxSelect.volume = 0.5;
        this.sfxPlay.volume = 0.6;
        this.sfxChange.volume = 0.4;
    },

    playBGM() {
        this.bgm.play().catch(e => console.log("Audio autoplay blocked, waiting for interaction"));
    },

    stopBGM() {
        this.bgm.pause();
        this.bgm.currentTime = 0;
    },

    playSelect() {
        this.sfxSelect.currentTime = 0;
        this.sfxSelect.play().catch(() => { });
    },

    playChange() {
        this.sfxChange.currentTime = 0;
        this.sfxChange.play().catch(() => { });
    },

    playStart() {
        this.sfxPlay.currentTime = 0;
        this.sfxPlay.play().catch(() => { });
    }
};

AudioMgr.init();

// DOM Elements
const screens = {
    loading: document.getElementById('loading-screen'),
    auth: document.getElementById('auth-screen'),
    lobby: document.getElementById('lobby-screen'),
    game: document.getElementById('game-container')
};

const dom = {
    authForm: document.getElementById('auth-form'),
    usernameInput: document.getElementById('username-input'),
    passwordInput: document.getElementById('password-input'),
    authSubmitBtn: document.getElementById('auth-submit'),
    toggleAuthBtn: document.getElementById('toggle-auth-mode'),
    authTitle: document.getElementById('auth-title'),
    authMessage: document.getElementById('auth-message'),

    // Lobby
    playBtn: document.getElementById('play-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    labelUsername: document.getElementById('lobby-username'),
    labelTrophies: document.getElementById('lobby-trophies'),

    // Game Over Integration (Optional, if we want to update trophies after game)
};

let isLoginMode = true;
let gameInstance = null;

// Initialize Game Instance
window.addEventListener('load', () => {
    // Wait for game.js to load
    if (window.Game) {
        gameInstance = new window.Game();
    }
});

// UI Logic
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');

    // Audio Logic based on screen
    if (screenName === 'lobby') {
        AudioMgr.playBGM();
    } else if (screenName === 'game') {
        AudioMgr.stopBGM(); // Use game's own audio
    }
}

// Global Click Sound
document.addEventListener('click', (e) => {
    // Play sound on any button interaction
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        AudioMgr.playSelect();
    }
    // ensure bgm starts on first interaction if blocked
    if (AudioMgr.bgm.paused && !screens.game.classList.contains('hidden') === false) {
        // only if not in game
        if (!document.getElementById('lobby-screen').classList.contains('hidden') || !document.getElementById('auth-screen').classList.contains('hidden'))
            AudioMgr.playBGM();
    }
});

// Auth Toggle
dom.toggleAuthBtn.addEventListener('click', () => {
    AudioMgr.playChange();
    isLoginMode = !isLoginMode;
    dom.authTitle.innerText = isLoginMode ? "INICIAR SESIÓN" : "CREAR CUENTA";
    dom.authSubmitBtn.innerText = isLoginMode ? "ENTRAR" : "REGISTRARSE";
    dom.toggleAuthBtn.innerText = isLoginMode ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra";
    dom.authMessage.innerText = "";
});

// Auth Submit
dom.authSubmitBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const username = dom.usernameInput.value.trim();
    const password = dom.passwordInput.value.trim();

    if (!username || !password) {
        dom.authMessage.innerText = "Por favor, rellena todos los campos.";
        return;
    }

    // Email spoofing as requested
    const email = `${username}@email.com`;

    dom.authSubmitBtn.disabled = true;
    dom.authSubmitBtn.innerText = "Cargando...";

    try {
        if (isLoginMode) {
            // Login
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            // Register
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Set Display Name
            await updateProfile(user, { displayName: username });

            // Create User User Document
            await setDoc(doc(db, "users", user.uid), {
                username: username,
                trophies: 0,
                createdAt: new Date()
            });
        }
    } catch (error) {
        console.error(error);
        let msg = "Error desconocido";
        if (error.code === 'auth/email-already-in-use') msg = "El usuario ya existe.";
        if (error.code === 'auth/wrong-password') msg = "Contraseña incorrecta.";
        if (error.code === 'auth/user-not-found') msg = "Usuario no encontrado.";
        if (error.code === 'auth/invalid-email') msg = "Usuario inválido.";
        if (error.code === 'auth/weak-password') msg = "La contraseña es muy débil (min 6 caracteres).";

        dom.authMessage.innerText = msg;
        dom.authSubmitBtn.disabled = false;
        dom.authSubmitBtn.innerText = isLoginMode ? "ENTRAR" : "REGISTRARSE";
    }
});

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Logged in as:", user.displayName);
        // Setup Lobby
        dom.labelUsername.innerText = user.displayName || user.email.split('@')[0];

        // Listen to Trophies
        const userDocRef = doc(db, "users", user.uid);
        onSnapshot(userDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                dom.labelTrophies.innerText = data.trophies || 0;
            } else {
                // Determine if we need to create it (migration)
                setDoc(userDocRef, { username: user.displayName, trophies: 0 }).then(() => dom.labelTrophies.innerText = 0);
            }
        });

        showScreen('lobby');
    } else {
        showScreen('auth');
        dom.authSubmitBtn.disabled = false;
        dom.authSubmitBtn.innerText = isLoginMode ? "ENTRAR" : "REGISTRARSE";
    }
});

// Logout
dom.logoutBtn.addEventListener('click', () => {
    signOut(auth);
    location.reload(); // Reload to reset game state just in case
});

// Play Game
dom.playBtn.addEventListener('click', () => {
    AudioMgr.playStart();

    // Delay slightly for sound effect
    setTimeout(() => {
        showScreen('game');
        const username = dom.labelUsername.innerText;
        if (gameInstance) {
            gameInstance.startGame(username);
        }
    }, 500);
});

// Orientation Check
function checkOrientation() {
    if (window.innerHeight > window.innerWidth) {
        // Portrait
        document.getElementById('orientation-warning').style.display = 'flex';
    } else {
        document.getElementById('orientation-warning').style.display = 'none';
    }
}
window.addEventListener('resize', checkOrientation);
checkOrientation();
