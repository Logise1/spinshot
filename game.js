// Lógica del juego extraída

// Bloque JS #6
/**
         * SpinShot.io
         * Full Code Implementation with Firebase & Online Multiplayer
         */

// --- Firebase Config ---
// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyA2mBPrQrMX4d-kTqB5md72THurGa25W2E",
    authDomain: "spin-397bc.firebaseapp.com",
    databaseURL: "https://spin-397bc-default-rtdb.europe-west1.firebasedatabase.app", // Added correct DB URL
    projectId: "spin-397bc",
    storageBucket: "spin-397bc.firebasestorage.app",
    messagingSenderId: "458475015970",
    appId: "1:458475015970:web:d3f626ad5a9e8654b89f7b",
    measurementId: "G-LXHFCTVS55"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database(); // Now uses the correct URL
// const rtdbUrl = "https://spin-397bc-default-rtdb.europe-west1.firebasedatabase.app/";
// const onlineDb = firebase.app().database(rtdbUrl); 
// We can just use 'db' for everything now as it is configured correctly.
const onlineDb = db;

// --- Global State ---
let CURRENT_USER = null;
let USER_DATA = {
    coins: 0,
    skins: ['#06b6d4'], // Default cyan skin
    equippedSkin: '#06b6d4',
    highScore: 0
};
let ONLINE_PLAYERS = {};
let PLAYER_REF = null;

// --- Auth Manager ---
const AuthManager = {
    login: async (email, pass) => {
        try {
            // Append fake domain if just username is provided
            const userEmail = email.includes('@') ? email : `${email}@spinshot.io`;
            await auth.signInWithEmailAndPassword(userEmail, pass);
        } catch (e) {
            throw e;
        }
    },
    register: async (email, pass) => {
        try {
            const userEmail = email.includes('@') ? email : `${email}@spinshot.io`;
            await auth.createUserWithEmailAndPassword(userEmail, pass);
            // Init user data
            const u = auth.currentUser;
            await db.ref('users/' + u.uid).set({
                username: email.split('@')[0],
                coins: 0,
                highScore: 0,
                skins: ['#06b6d4'],
                equippedSkin: '#06b6d4'
            });
        } catch (e) {
            throw e;
        }
    }


    // ... (Audio Manager code skipped in replacement block as we need to match lines correctly, but focusing on Config area for now)
};

// --- Configuración ---
const CONFIG = {
    MAP_WIDTH: 3000,
    MAP_HEIGHT: 3000,
    BASE_RADIUS: 25,
    MAX_RADIUS: 120,
    // Velocidades ajustadas para 60 FPS target
    BASE_SPIN_SPEED: 0.09,
    FRICTION: 0.965,
    LAUNCH_FORCE_BASE: 18,
    KILL_VELOCITY_THRESHOLD: 9,
    ORB_COUNT: 250,
    BOT_COUNT: 12,
    POWERUP_SPAWN_RATE: 0.003, // Por frame normalizado
    INVINCIBLE_TIME: 5000, // milisegundos
    POWERUP_DURATION: 10000, // milisegundos
    SKINS_DB: [
        { color: '#06b6d4', name: 'Cyan Default', price: 0 },
        { color: '#f43f5e', name: 'Rose Red', price: 100 },
        { color: '#22c55e', name: 'Neon Green', price: 150 },
        { color: '#eab308', name: 'Golden Sun', price: 300 },
        { color: '#a855f7', name: 'Deep Purple', price: 500 },
        { color: '#ec4899', name: 'Hot Pink', price: 750 },
        { color: '#ffffff', name: 'Ghost White', price: 1000 },
        { color: '#000000', name: 'Void Black', price: 2000 },
        { color: 'rainbow', name: 'RGB Master', price: 5000 }
    ]
};

// --- Shop System ---
const Shop = {
    init: () => {
        const grid = document.getElementById('skins-grid');
        grid.innerHTML = '';
        CONFIG.SKINS_DB.forEach(skin => {
            const btn = document.createElement('div');
            btn.className = `skin-btn p-3 rounded-lg border-2 border-slate-700 bg-slate-800 flex flex-col items-center cursor-pointer relative`;

            const isOwned = USER_DATA.skins.includes(skin.color);
            const isEquipped = USER_DATA.equippedSkin === skin.color;

            if (!isOwned) btn.classList.add('locked');
            if (isEquipped) btn.classList.add('selected');

            btn.innerHTML = `
                        <div class="w-12 h-12 rounded-full mb-2 shadow-lg" style="background: ${skin.color === 'rainbow' ? 'linear-gradient(45deg, red,orange,yellow,green,blue,indigo,violet)' : skin.color}"></div>
                        <span class="text-xs text-white font-bold mb-1">${skin.name}</span>
                        <span class="text-xs ${isOwned ? 'text-green-400' : 'text-yellow-400'} font-mono">${isOwned ? 'OWNED' : `💰 ${skin.price}`}</span>
                    `;

            btn.onclick = () => Shop.handleMainAction(skin);
            grid.appendChild(btn);
        });
        document.getElementById('shop-coins').innerText = USER_DATA.coins;
    },

    handleMainAction: (skin) => {
        if (USER_DATA.skins.includes(skin.color)) {
            // Equip
            USER_DATA.equippedSkin = skin.color;
            Shop.saveUser();
        } else {
            // Buy
            if (USER_DATA.coins >= skin.price) {
                USER_DATA.coins -= skin.price;
                USER_DATA.skins.push(skin.color);
                USER_DATA.equippedSkin = skin.color; // Auto equip on buy
                Shop.saveUser();
            } else {
                // Animación de error visual si quieres
                alert("No tienes suficientes monedas!");
            }
        }
        Shop.init(); // Re-render
    },

    saveUser: () => {
        if (CURRENT_USER) {
            db.ref('users/' + CURRENT_USER.uid).update({
                coins: USER_DATA.coins,
                skins: USER_DATA.skins,
                equippedSkin: USER_DATA.equippedSkin
            });
        }
    }
};

// --- Clases ---

class Trail {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.life = 1.0;
        // Ajustado para decaer en tiempo real (~1s de vida)
        this.decay = 0.05;
    }
    update(timeScale) {
        this.life -= this.decay * timeScale;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = Math.max(0, this.life * 0.4);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Entity {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.alive = true;
    }
}

class Orb extends Entity {
    constructor() {
        super(
            Math.random() * CONFIG.MAP_WIDTH,
            Math.random() * CONFIG.MAP_HEIGHT,
            6 + Math.random() * 6,
            `hsl(${Math.random() * 360}, 80%, 60%)`
        );
        this.floatOffset = Math.random() * 100;
    }

    draw(ctx, time) {
        // time viene en ms
        const pulse = Math.sin(time * 0.005 + this.floatOffset) * 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(this.x, this.y, (this.radius + pulse) * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
    }
}

class PowerUp extends Entity {
    constructor() {
        super(
            Math.random() * (CONFIG.MAP_WIDTH - 200) + 100,
            Math.random() * (CONFIG.MAP_HEIGHT - 200) + 100,
            30,
            '#FFF'
        );
        this.type = Math.floor(Math.random() * 3);
        this.icon = ['🎯', '🛡️', '🔒'][this.type];
        this.color = ['#3b82f6', '#22c55e', '#a855f7'][this.type];
        this.name = ['SLOW SPIN', 'WALL BOUNCE', 'VECTOR LOCK'][this.type];
        this.rotation = 0;
    }

    draw(ctx, time) {
        const bounce = Math.sin(time * 0.005) * 8;
        // Rotación visual basada en tiempo
        this.rotation = time * 0.002;

        ctx.save();
        ctx.translate(this.x, this.y + bounce);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.stroke();

        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.rect(-18, -18, 36, 36);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.stroke();

        ctx.rotate(-this.rotation);
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.icon, 0, 0);

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, speed) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * speed + 2;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        this.life = 1.0;
        this.decay = 0.015 + Math.random() * 0.02;
        this.color = color;
        this.size = Math.random() * 6 + 3;
    }

    update(timeScale) {
        this.x += this.vx * timeScale;
        this.y += this.vy * timeScale;

        // Fricción ajustada a timeScale
        this.vx *= Math.pow(0.92, timeScale);
        this.vy *= Math.pow(0.92, timeScale);

        this.life -= this.decay * timeScale;
        this.size *= Math.pow(0.95, timeScale);
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class CoinParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.targetX = 0; // Will be set relative to camera in update
        this.targetY = 0;
        this.collected = false;
    }

    update(timeScale, playerX, playerY) {
        if (this.collected) return;

        // First phase: explode out
        if (this.life > 0.8) {
            this.x += this.vx * timeScale;
            this.y += this.vy * timeScale;
            this.vx *= 0.9;
            this.vy *= 0.9;
        } else {
            // Second phase: fly to player center
            const dx = playerX - this.x;
            const dy = playerY - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 20) {
                this.collected = true;
                return;
            }

            const angle = Math.atan2(dy, dx);
            const speed = 25 * (1.1 - this.life); // Accelerate
            this.x += Math.cos(angle) * speed * timeScale;
            this.y += Math.sin(angle) * speed * timeScale;
        }

        this.life -= 0.01 * timeScale;
    }

    draw(ctx) {
        if (this.collected) return;
        ctx.fillStyle = '#fbbf24'; // Amber-400
        ctx.beginPath();
        ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Shine
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x - 2, this.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Player extends Entity {
    constructor(name, isBot = false, gameInstance, id = null, skin = null) {
        super(
            Math.random() * CONFIG.MAP_WIDTH,
            Math.random() * CONFIG.MAP_HEIGHT,
            CONFIG.BASE_RADIUS,
            isBot ? `hsl(${Math.random() * 360}, 75%, 55%)` : (skin || '#06b6d4')
        );
        this.name = name;
        this.isBot = isBot;
        this.game = gameInstance;
        this.id = id || (isBot ? `bot_${Math.random()}` : (CURRENT_USER ? CURRENT_USER.uid : `guest_${Math.random()}`));

        this.angle = Math.random() * Math.PI * 2;
        this.vx = 0;
        this.vy = 0;
        this.state = 'SPINNING';
        this.score = 0;
        this.kills = 0;

        this.activePowerup = null;
        this.powerupEndTime = 0;
        this.canBounce = false;

        this.trails = [];
        this.flash = 0;

        // Skin logic
        this.skin = skin || (isBot ? this.color : USER_DATA.equippedSkin);
        if (this.skin === 'rainbow') this.isRainbow = true;

        // Invincibility based on timestamp
        this.spawnTime = Date.now();

        // Bot timers
        this.botActionTimer = 0;
    }

    isInvincible() {
        if (this.isOnlineRemote) return false; // Simple hack: remote players logic handled by their client usually, but for now trust local
        return Date.now() - this.spawnTime < CONFIG.INVINCIBLE_TIME;
    }

    update(timeScale) {
        // Rainbow Effect
        if (this.isRainbow) {
            this.color = `hsl(${Date.now() / 10 % 360}, 80%, 60%)`;
        }

        // Safety Check for NaN
        if (isNaN(this.x) || isNaN(this.y)) {
            this.x = CONFIG.MAP_WIDTH / 2;
            this.y = CONFIG.MAP_HEIGHT / 2;
            this.vx = 0;
            this.vy = 0;
        }

        // If this is a remote player coming from Firebase, we don't simulate physics the same way
        // We just interpolate (handled in Game loop usually, but for now let's assume direct pos updates for simplicity or basic prediction)
        if (this.isOnlineRemote) return;

        const speed = Math.hypot(this.vx, this.vy);
        const now = Date.now();

        // Check Powerup Expiration
        if (this.activePowerup && now > this.powerupEndTime) {
            this.deactivatePowerup();
        }

        if (this.state === 'SPINNING') {
            let spinSpeed = CONFIG.BASE_SPIN_SPEED;
            spinSpeed *= (1 - (this.radius / 500));

            if (this.activePowerup === 'SLOW SPIN') spinSpeed *= 0.3;
            if (this.activePowerup === 'VECTOR LOCK') spinSpeed = 0;

            // Aplicar rotación con timeScale
            this.angle += spinSpeed * timeScale;
            this.angle = this.angle % (Math.PI * 2);

            // Fricción fuerte al girar
            const spinFriction = Math.pow(0.85, timeScale);
            this.vx *= spinFriction;
            this.vy *= spinFriction;
        }
        else if (this.state === 'MOVING') {
            this.x += this.vx * timeScale;
            this.y += this.vy * timeScale;

            // Fricción normal
            const moveFriction = Math.pow(CONFIG.FRICTION, timeScale);
            this.vx *= moveFriction;
            this.vy *= moveFriction;

            if (speed > 5) {
                // Probabilidad normalizada por timeScale para trails consistentes
                if (Math.random() < 0.4 * timeScale) {
                    this.trails.push(new Trail(this.x, this.y, this.radius, this.color));
                }
            }
            if (speed < 0.8) {
                this.state = 'SPINNING';
                this.canBounce = false;
            }
        }

        // Actualizar Trails
        for (let i = this.trails.length - 1; i >= 0; i--) {
            this.trails[i].update(timeScale);
            if (this.trails[i].life <= 0) this.trails.splice(i, 1);
        }

        if (this.flash > 0) this.flash -= 1 * timeScale;

        this.handleMapCollisions();

        if (this.isBot) this.updateBotAI(timeScale);

        // Legacy Sync disabled - using Network.update (Data Saver) logic instead
        /*
        if (!this.isBot && !this.isOnlineRemote && PLAYER_REF) {
            PLAYER_REF.set({
                x: Math.floor(isNaN(this.x) ? 0 : this.x),
                y: Math.floor(isNaN(this.y) ? 0 : this.y),
                angle: this.angle.toFixed(2),
                radius: Math.floor(this.radius),
                skin: this.skin,
                name: this.name,
                score: this.score,
                lastInput: Date.now()
            });
        }
        */
    }

    handleMapCollisions() {
        let hitWall = false;
        const r = this.radius;

        if (this.x - r < 0) { this.x = r; this.vx = Math.abs(this.vx); hitWall = true; }
        if (this.x + r > CONFIG.MAP_WIDTH) { this.x = CONFIG.MAP_WIDTH - r; this.vx = -Math.abs(this.vx); hitWall = true; }
        if (this.y - r < 0) { this.y = r; this.vy = Math.abs(this.vy); hitWall = true; }
        if (this.y + r > CONFIG.MAP_HEIGHT) { this.y = CONFIG.MAP_HEIGHT - r; this.vy = -Math.abs(this.vy); hitWall = true; }

        if (hitWall) {
            if (this.canBounce) {
                this.canBounce = false;
                SFX.playBounce();
                this.game.createExplosion(this.x, this.y, '#fff', 5);
            } else {
                this.vx = 0;
                this.vy = 0;
                this.state = 'SPINNING';
                SFX.playBounce();
            }
        }
    }

    launch() {
        if (this.state === 'SPINNING') {
            const force = CONFIG.LAUNCH_FORCE_BASE + (this.radius * 0.08);
            this.vx = Math.cos(this.angle) * force;
            this.vy = Math.sin(this.angle) * force;
            this.state = 'MOVING';
            if (!this.isBot && !this.isOnlineRemote) SFX.playLaunch();
            this.flash = 5;
        }
    }

    updateBotAI(timeScale) {
        if (this.state !== 'SPINNING') return;

        // Cooldown artificial para que el bot no calcule cada frame si hay lag
        this.botActionTimer += timeScale;
        if (this.botActionTimer < 5) return; // Chequear cada ~5 frames normalizados
        this.botActionTimer = 0;

        let nearestTarget = null;
        let minDist = 600;

        const potentialTargets = this.game.players.filter(p => p !== this && p.alive);

        for (const target of potentialTargets) {
            const d = Math.hypot(target.x - this.x, target.y - this.y);
            if (d < minDist) {
                minDist = d;
                nearestTarget = target;
            }
        }

        if (nearestTarget) {
            let angleToTarget = Math.atan2(nearestTarget.y - this.y, nearestTarget.x - this.x);
            if (angleToTarget < 0) angleToTarget += Math.PI * 2;

            let myAngle = this.angle % (Math.PI * 2);
            if (myAngle < 0) myAngle += Math.PI * 2;

            const diff = Math.abs(angleToTarget - myAngle);
            const tolerance = 0.15;

            if (diff < tolerance) this.launch();
        } else {
            // Probabilidad ajustada por timeScale (para ser consistente en Hz altos/bajos)
            if (Math.random() < 0.01 * 5) this.launch(); // *5 porque chequeamos cada 5 frames
        }
    }

    applyPowerup(type) {
        this.activePowerup = type;
        this.powerupEndTime = Date.now() + CONFIG.POWERUP_DURATION;
        if (type === 'WALL BOUNCE') this.canBounce = true;

        if (!this.isBot && !this.isOnlineRemote) {
            SFX.playPowerup();
            const ui = document.getElementById('powerup-display');
            const txt = document.getElementById('powerup-text');
            const icon = document.getElementById('powerup-icon');
            if (ui) {
                ui.classList.remove('hidden', 'scale-0');
                ui.classList.add('scale-100');
                txt.innerText = type;
                if (type === 'SLOW SPIN') icon.innerText = '🎯';
                if (type === 'WALL BOUNCE') icon.innerText = '🛡️';
                if (type === 'VECTOR LOCK') icon.innerText = '🔒';
            }
        }
    }

    deactivatePowerup() {
        this.activePowerup = null;
        this.canBounce = false;
        if (!this.isBot) {
            const ui = document.getElementById('powerup-display');
            if (ui) {
                ui.classList.add('scale-0');
                setTimeout(() => ui.classList.add('hidden'), 300);
            }
        }
    }

    grow(amount) {
        this.score += Math.floor(amount);
        if (this.radius < CONFIG.MAX_RADIUS) {
            this.radius += amount * 0.15;
        }
        if (!this.isBot) {
            const bar = document.getElementById('mass-bar');
            const pct = (this.radius / CONFIG.MAX_RADIUS) * 100;
            bar.style.width = pct + '%';
        }
    }

    draw(ctx) {
        this.trails.forEach(t => t.draw(ctx));

        ctx.save();
        ctx.translate(this.x, this.y);

        // Visual de Invencibilidad
        if (this.isInvincible()) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 15, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.4 + Math.sin(Date.now() * 0.01) * 0.3})`; // Azul pulsante
            ctx.lineWidth = 4;
            ctx.stroke();
            if (!this.isBot) {
                const ui = document.getElementById('invincible-status');
                if (ui.classList.contains('hidden')) ui.classList.remove('hidden');
            }
        } else if (!this.isBot) {
            const ui = document.getElementById('invincible-status');
            if (!ui.classList.contains('hidden')) ui.classList.add('hidden');
        }

        if (this.flash > 0) {
            ctx.fillStyle = 'white';
        } else {
            ctx.globalAlpha = this.isInvincible() ? 0.7 : 1.0;
            ctx.fillStyle = this.color;
        }

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

        const speed = Math.hypot(this.vx, this.vy);
        if (speed > CONFIG.KILL_VELOCITY_THRESHOLD) {
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#f43f5e';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.stroke();
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        ctx.rotate(this.angle);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.moveTo(this.radius + 12, 0);
        ctx.lineTo(this.radius - 2, 8);
        ctx.lineTo(this.radius + 2, 0);
        ctx.lineTo(this.radius - 2, -8);
        ctx.fill();

        if (this.activePowerup === 'VECTOR LOCK') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.setLineDash([10, 10]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.radius + 15, 0);
            ctx.lineTo(500, 0);
            ctx.stroke();
        }

        ctx.restore();

        if (this.alive) {
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(10, this.radius * 0.4)}px 'Segoe UI'`;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(this.name, this.x, this.y - this.radius - 12);
            ctx.shadowBlur = 0;
        }
    }
}

// --- Motor Principal ---

// --- Audio Manager Enhanced ---
const SFX = {
    bgm: new Audio('static/bgm.mp3'),
    sounds: {
        select: new Audio('static/select.ogg'),
        change: new Audio('static/change.ogg'),
        play: new Audio('static/play.ogg'),
        bounce: new Audio('static/bounce.ogg'),
        launch: new Audio('static/launch.ogg'),
        orb: new Audio('static/orb.ogg'),
        powerup: new Audio('static/powerup.ogg'),
        kill: new Audio('static/kill.ogg')
    },

    init: async () => {
        // Preload
        SFX.bgm.loop = true;
        SFX.bgm.volume = 0.3;
    },

    play: (name) => {
        try {
            const sound = SFX.sounds[name];
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => { }); // Ignore interaction errors
            }
        } catch (e) { }
    },

    startMusic: () => {
        SFX.bgm.play().catch(e => { });
    },

    // Compatibility Helpers
    playBounce: () => SFX.play('bounce'),
    playKill: () => SFX.play('kill'),
    playOrb: () => SFX.play('orb'),
    playLaunch: () => SFX.play('launch'),
    playPowerup: () => SFX.play('powerup')
};

// --- Network Manager (Data Saver) ---
const Network = {
    buffer: [],
    lastSendTime: 0,
    SEND_RATE: 500, // ms
    CAPTURE_RATE: 33, // ms (approx 30fps)
    lastCaptureTime: 0,

    update: (player) => {
        const now = Date.now();

        // 1. Capture State
        if (now - Network.lastCaptureTime > Network.CAPTURE_RATE) {
            const angle = parseFloat(player.angle.toFixed(2));
            const safeAngle = isNaN(angle) ? 0 : angle; // Prevent NaN
            const safeV = isNaN(player.vx) ? 0 : player.vx;

            Network.buffer.push({
                t: now,
                x: Math.round(player.x),
                y: Math.round(player.y),
                a: safeAngle,
                s: player.skin, // optimized? maybe send only once
                v: safeV // for strict interpolation
            });
            Network.lastCaptureTime = now;
        }

        // 2. Flush to Firebase
        if (now - Network.lastSendTime > Network.SEND_RATE) {
            if (Network.buffer.length > 0 && CURRENT_USER) {
                // Send last 15 updates
                const payload = Network.buffer;
                db.ref('players/' + CURRENT_USER.uid).set({
                    id: CURRENT_USER.uid,
                    name: player.name,
                    skin: player.skin,
                    data: payload,
                    score: player.score,
                    lastUpdate: firebase.database.ServerValue.TIMESTAMP
                });
                Network.buffer = []; // Clear
                Network.lastSendTime = now;
            }
        }
    }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.state = 'LOGIN'; // LOGIN, LOBBY, PLAYING, GAMEOVER
        this.particles = [];
        this.orbs = [];
        this.players = []; // Contains Local + Remote
        this.remotePlayers = {}; // Map of ID -> Player object

        this.spawnPoint = { x: CONFIG.MAP_WIDTH / 2, y: CONFIG.MAP_HEIGHT / 2 };
        this.initBotMatch();

        this.camera = { x: 0, y: 0 };
        this.shake = 0;
        this.running = true;

        // Time control
        this.lastTime = performance.now();

        // Bindings
        window.addEventListener('resize', () => this.resize());

        // Inputs
        this.inputHandler = (e) => {
            if (this.state === 'PLAYING') {
                if (e.type === 'keydown' && e.code === 'Space') this.handleInput();
                if (e.type === 'mousedown' || e.type === 'touchstart') {
                    e.preventDefault();
                    this.handleInput();
                }
            }
        };
        window.addEventListener('keydown', this.inputHandler);
        this.canvas.addEventListener('mousedown', this.inputHandler);
        this.canvas.addEventListener('touchstart', this.inputHandler, { passive: false });

        // Setup UI Hooks
        this.setupUI();

        // Start Loop
        requestAnimationFrame((t) => this.loop(t));

        // Global Record Listener
        this.setupGlobalRecord();

        // Check for existing session
        auth.onAuthStateChanged(user => {
            if (user) {
                this.loadUserData(user);
            }
        });
    }

    initBotMatch() {
        this.orbs = [];
        // Keep players but filter to only bots if resetting? Or just fresh init
        this.players = [];
        this.particles = [];
        // Fix: Initialize powerups and coins so checkCollisions doesn't crash on first frame
        this.powerups = [];
        this.coinParticles = [];

        // Spawn bots
        for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
            this.players.push(new Player(`BOT ${i + 1}`, true, this));
        }

        // Spawn orbs
        for (let i = 0; i < CONFIG.ORB_COUNT; i++) {
            this.orbs.push(new Orb());
        }
    }

    setupUI() {
        // Auth
        document.getElementById('login-btn').addEventListener('click', () => { SFX.play('select'); this.handleAuth('login'); });
        document.getElementById('register-btn').addEventListener('click', () => { SFX.play('select'); this.handleAuth('register'); });

        // Lobby
        const lobbyBtn = document.createElement('button');
        lobbyBtn.id = 'lobby-play-btn';
        lobbyBtn.className = 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-110 transition-transform duration-200 text-white font-black text-4xl px-12 py-6 rounded-full shadow-[0_0_40px_rgba(6,182,212,0.6)] border-4 border-white';
        lobbyBtn.innerText = 'PLAY';
        lobbyBtn.onclick = () => {
            SFX.play('play');
            this.enterGame();
        };

        const skinBtn = document.createElement('button');
        skinBtn.id = 'lobby-skin-btn';
        skinBtn.className = 'mt-4 bg-slate-800 border border-slate-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-700';
        skinBtn.innerText = '🎨 SKINS';
        skinBtn.onclick = () => {
            SFX.play('select');
            document.getElementById('shop-screen').classList.remove('hidden');
            Shop.init();
        };

        // Create Lobby Container
        const lobbyDiv = document.createElement('div');
        lobbyDiv.id = 'lobby-screen';
        lobbyDiv.className = 'absolute inset-0 flex flex-col items-center justify-center z-40 hidden pointer-events-none'; // Pointer events auto on children
        lobbyDiv.innerHTML = `
                    <div class="pointer-events-auto flex flex-col items-center animate-bounce-slow mt-80">
                        <!-- Buttons injected via JS to bind events directly -->
                    </div>
                `;
        document.body.appendChild(lobbyDiv);
        lobbyDiv.firstElementChild.appendChild(lobbyBtn);
        lobbyDiv.firstElementChild.appendChild(skinBtn);

        // Shop Close
        document.getElementById('shop-close-btn').addEventListener('click', () => {
            document.getElementById('shop-screen').classList.add('hidden');
            if (this.player) this.player.skin = USER_DATA.equippedSkin; // Update preview
        });

        document.getElementById('restart-btn').addEventListener('click', () => location.reload()); // Simple reload for now
    }

    setupGlobalRecord() {
        db.ref('globalRecord').on('value', snap => {
            const val = snap.val();
            if (val) {
                document.getElementById('global-record').classList.remove('hidden');
                document.getElementById('record-val').innerText = Math.floor(val.score);
                document.getElementById('record-holder').innerText = val.holder;
                // Also update leaderboard in Lobby?
            }
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // ... Auth methods (handleAuth, loadUserData) reused from before ...
    // We just change the success callback to enterLobby()

    async handleAuth(mode) {
        // ... (Existing Auth Logic wrapper for brevity, assume similar to previous but calling loadUserData)
        const email = document.getElementById('username-input').value;
        const pass = document.getElementById('password-input').value;
        if (!email || !pass) return;

        // Visual feedback
        const btn = mode === 'login' ? document.getElementById('login-btn') : document.getElementById('register-btn');
        const originalText = btn.innerText;
        btn.innerText = "⏳...";
        document.getElementById('auth-error').classList.add('hidden');


        try {
            if (mode === 'login') await AuthManager.login(email, pass);
            else await AuthManager.register(email, pass);

            if (auth.currentUser) {
                btn.innerText = "OK!";
                await this.loadUserData(auth.currentUser);
            }
        } catch (e) {
            console.error(e);
            document.getElementById('auth-error').innerText = e.message;
            document.getElementById('auth-error').classList.remove('hidden');
            btn.innerText = originalText;
        }
    }

    async loadUserData(user) {
        try {
            CURRENT_USER = user;
            const snap = await db.ref('users/' + user.uid).once('value');
            let data = snap.val();
            if (!data) {
                data = { username: user.email.split('@')[0], coins: 0, highScore: 0, skins: ['#06b6d4'], equippedSkin: '#06b6d4' };
                await db.ref('users/' + user.uid).set(data);
            }
            USER_DATA = { ...USER_DATA, ...data };
            // Safe fallbacks
            if (!USER_DATA.skins) USER_DATA.skins = ['#06b6d4'];
            if (!USER_DATA.equippedSkin) USER_DATA.equippedSkin = '#06b6d4';

            this.enterLobby(); // GO TO LOBBY
        } catch (err) {
            console.error(err);
            this.enterLobby(); // Fallback to lobby even if data load fails
        }
    }

    enterLobby() {
        this.state = 'LOBBY';
        SFX.startMusic();

        // Hide Start Screen
        document.getElementById('start-screen').style.display = 'none';

        // Show Lobby UI
        document.getElementById('lobby-screen').classList.remove('hidden');
        document.getElementById('ui-layer').classList.remove('hidden'); // Show HUD (coins etc)

        // Initialize a "Preview Player"
        this.player = new Player(USER_DATA.username, false, this, CURRENT_USER.uid, USER_DATA.equippedSkin);
        this.player.x = this.spawnPoint.x;
        this.player.y = this.spawnPoint.y;
        // Add player to the world list so they are rendered/updated (mostly for visual in lobby)
        // But wait, if we add them to players list, bot AI might target them. 
        // For Lobby, we might just want to draw them manually or make them invisible to bots.
        // Let's just keep track of this.player separately for drawing in loop, as before, but positioned in world.
    }

    async enterGame() {
        this.state = 'PLAYING';
        document.getElementById('lobby-screen').classList.add('hidden');

        // Full Init
        this.particles = [];
        this.orbs = [];
        this.players = [];
        this.remotePlayers = {};
        this.coinParticles = [];
        this.powerups = [];

        // Audio might have failed or be ready, either way proceed to game
        try {
            if (Tone.context.state !== 'running') await Tone.start();
        } catch (e) { console.log("Audio auto-start disallowed"); }

        // World Setup (If not already running bot match? Actually enterGame restarts everything usually)
        // The user wants transition. Let's keep the bots if possible? 
        // "No sale la skin seleccionada" -> Fix skin

        // Force skin update from USER_DATA just in case
        this.player.skin = USER_DATA.equippedSkin;
        if (this.player.skin === 'rainbow') this.player.isRainbow = true;
        else this.player.isRainbow = false;
        this.player.color = this.player.isRainbow ? this.player.color : this.player.skin; // Reset color

        // Clear bots/orbs only if we want a fresh game, but user implies "playing alone with bots".
        // Let's Refresh slightly but keep the flow.
        this.orbs = [];
        for (let i = 0; i < CONFIG.ORB_COUNT; i++) this.orbs.push(new Orb());

        this.players = [];
        for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
            this.players.push(new Player(`BOT ${i + 1}`, true, this));
        }

        // Reset Player to Spawn Point
        this.player.x = this.spawnPoint.x;
        this.player.y = this.spawnPoint.y;
        this.players.push(this.player);

        this.lastTime = performance.now(); // Reset time to prevent huge dt/explosion on start

        // Start Network Listeners
        this.startOnlineSync();
    }

    handleInput() {
        if (this.player && this.player.alive) this.player.launch();
    }

    startOnlineSync() {
        // Initialize Online Presence
        if (CURRENT_USER) {
            PLAYER_REF = db.ref('players/' + CURRENT_USER.uid);
            PLAYER_REF.onDisconnect().remove();
            // Listen for other players
            onlineDb.ref('players').on('value', snap => {
                this.onlinePlayersData = snap.val() || {};
                this.syncOnlinePlayers();
            });
        }

        // If already running, don't double loop
        if (!this.running) {
            this.running = true;
            this.lastTime = performance.now();
            this.loop();
        }
    }

    syncOnlinePlayers() {
        if (!CURRENT_USER) return;
        const onlineIds = Object.keys(this.onlinePlayersData);

        // Remove disconnected
        for (let i = this.players.length - 1; i >= 0; i--) {
            const p = this.players[i];
            if (p.isOnlineRemote && !this.onlinePlayersData[p.id]) {
                this.players.splice(i, 1);
            }
        }

        // Add/Update new
        onlineIds.forEach(id => {
            if (id === CURRENT_USER.uid) return; // Skip self

            const data = this.onlinePlayersData[id];
            let p = this.players.find(pl => pl.id === id);

            if (!p) {
                p = new Player(data.name, false, this, id, data.skin);
                p.isOnlineRemote = true; // Flag to identify remote
                this.players.push(p);
            }

            // Simple interpolation/snap
            const lerp = 0.5;
            // Validate data to strictly avoid NaN infection
            const targetX = Number(data.x);
            const targetY = Number(data.y);

            if (!isNaN(targetX) && !isNaN(targetY)) {
                // If local p.x or p.y were NaN, snap to valid
                if (isNaN(p.x)) p.x = targetX;
                if (isNaN(p.y)) p.y = targetY;

                p.x = p.x + (targetX - p.x) * lerp;
                p.y = p.y + (targetY - p.y) * lerp;
            }

            p.angle = parseFloat(data.angle) || 0;
            p.radius = data.radius || CONFIG.BASE_RADIUS;
            p.skin = data.skin;
            if (data.skin === 'rainbow') p.isRainbow = true;
        });
    }

    updateRemotePlayer(data) {
        const p = this.remotePlayers[data.id];
        if (!p) return;

        // DATA SAVER LOGIC: Receive batch of frames
        // We trust the order from Firebase (timestamped array usually)
        if (data.data && Array.isArray(data.data)) {
            // Filter out old packets if needed, or just append
            // Simple append:
            data.data.forEach(packet => {
                // Avoid duplicates if possible, but basic append is fine for now
                if (packet.t > (p.lastPacketTime || 0)) {
                    p.dataBuffer.push(packet);
                }
            });
            if (data.data.length > 0) p.lastPacketTime = data.data[data.data.length - 1].t;
        }

        // Update non-physics props
        p.skin = data.skin;
        p.score = data.score;
    }

    removeRemotePlayer(id) {
        this.players = this.players.filter(p => p.id !== id);
        delete this.remotePlayers[id];
    }

    loop(timestamp) {
        // Delta Time
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;
        // Cap delta time to prevent spiraling (e.g. tab switching)
        const safeDt = Math.min(dt, 100);
        const timeScale = safeDt / 16.67; // Normalize to 60fps

        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // --- CAMERA LOGIC ---
        let camX = 0, camY = 0;

        if (this.state === 'LOGIN' || this.state === 'LOBBY') {
            // Focus on Spawn Point
            camX = this.spawnPoint.x - this.canvas.width / 2;
            camY = this.spawnPoint.y - this.canvas.height / 2;
        } else if (this.player && this.player.alive) {
            camX = this.player.x - this.canvas.width / 2;
            camY = this.player.y - this.canvas.height / 2;
        }

        this.camera.x = camX;
        this.camera.y = camY;

        // Apply Shake
        const shakeX = (Math.random() - 0.5) * this.shake;
        const shakeY = (Math.random() - 0.5) * this.shake;
        this.shake *= 0.9;

        this.ctx.save();
        this.ctx.translate(-camX + shakeX, -camY + shakeY);

        // Draw World Grid
        this.drawWorldGrid(); // Using a non-camera dependent local grid function for simplicity or adapting existing

        // Update & Draw Orbs
        this.orbs.forEach(orb => orb.draw(this.ctx, timestamp));

        // Particles
        this.particles.forEach((p, i) => {
            p.update(timeScale);
            p.draw(this.ctx);
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        // Update & Draw Players (Bots + Remote)
        // In LOGIN/LOBBY, we process bots.
        // In PLAYING, we process all.

        this.players.forEach(p => {
            // Skip dead players
            if (!p.alive) return;

            // Skip local player in LOGIN state
            if (this.state === 'LOGIN' && p === this.player) return;

            // In LOBBY, we might want to show the player BUT update/draw is tricky if they aren't in 'players' array yet or we want custom behavior.
            // The 'enterLobby' logic didn't add player to this.players.
            // So we handle 'this.player' separately for Lobby.

            if (p === this.player && this.state === 'PLAYING') {
                p.update(timeScale);
            } else if (p.isBot) {
                p.update(timeScale); // Bots have local AI
            } else if (p.isOnlineRemote && p.dataBuffer.length > 0) {
                // ... (Remote interpolation code) ...
                // Copying logic for brevity, assuming standard interpolation needed
                const target = p.dataBuffer[0];
                const dx = target.x - p.x;
                const dy = target.y - p.y;
                const dist = Math.hypot(dx, dy);
                const moveSpeed = 15 * timeScale;
                if (dist < moveSpeed) {
                    p.x = target.x;
                    p.y = target.y;
                    p.angle = target.a;
                    p.vx = target.v;
                    p.dataBuffer.shift();
                } else {
                    const angle = Math.atan2(dy, dx);
                    p.x += Math.cos(angle) * moveSpeed;
                    p.y += Math.sin(angle) * moveSpeed;
                    p.angle = target.a;
                }
            }
            p.draw(this.ctx);
        });

        // Lobby Specific: Draw Local Player manually
        if (this.state === 'LOBBY' && this.player) {
            if (USER_DATA) {
                this.player.skin = USER_DATA.equippedSkin;
                if (this.player.skin === 'rainbow') this.player.isRainbow = true;
                else {
                    this.player.isRainbow = false;
                    this.player.color = this.player.skin;
                }
            }
            // Slight bobbing or rotation?
            this.player.angle += 0.02 * timeScale;
            this.player.draw(this.ctx);
        }

        // Check Collisions (Run always for bots? Yes)
        this.checkCollisions(); // This handles pvp. We need to make sure it doesn't kill the "Lobby Player" if strict

        this.ctx.restore();

        // UI & Network
        if (this.state === 'PLAYING') {
            this.updateUI(dt); // Passing DT
            if (this.player && this.player.alive) {
                Network.update(this.player);
            }
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    // Renaming drawGrid to drawWorldGrid and fixing it to use standard world coordinates
    drawWorldGrid() {
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 10;
        this.ctx.strokeRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);

        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 2;
        const gridSize = 150;

        this.ctx.beginPath();
        for (let x = 0; x <= CONFIG.MAP_WIDTH; x += gridSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, CONFIG.MAP_HEIGHT);
        }
        for (let y = 0; y <= CONFIG.MAP_HEIGHT; y += gridSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(CONFIG.MAP_WIDTH, y);
        }
        this.ctx.stroke();
    }

    spawnPowerup(timeScale) {

        if (Math.random() < CONFIG.POWERUP_SPAWN_RATE * timeScale && this.powerups.length < 8) {
            this.powerups.push(new PowerUp());
        }
    }

    checkCollisions() {
        const allEntities = this.players.filter(p => p.alive);

        // Orbes
        allEntities.forEach(p => {
            for (let i = this.orbs.length - 1; i >= 0; i--) {
                const orb = this.orbs[i];
                if (Math.abs(p.x - orb.x) > p.radius + orb.radius + 10) continue;
                const dist = Math.hypot(p.x - orb.x, p.y - orb.y);
                if (dist < p.radius + orb.radius) {
                    p.grow(4);
                    if (!p.isBot && !p.isOnlineRemote) SFX.playOrb();
                    this.orbs.splice(i, 1);
                    this.orbs.push(new Orb());
                }
            }
        });

        // PowerUps
        allEntities.forEach(p => {
            for (let i = this.powerups.length - 1; i >= 0; i--) {
                const pup = this.powerups[i];
                const dist = Math.hypot(p.x - pup.x, p.y - pup.y);
                if (dist < p.radius + 30) {
                    p.applyPowerup(pup.name);
                    this.powerups.splice(i, 1);
                }
            }
        });

        // PvP Collision
        for (let i = 0; i < allEntities.length; i++) {
            for (let j = i + 1; j < allEntities.length; j++) {
                const p1 = allEntities[i];
                const p2 = allEntities[j];

                // Don't calculate collision between two remote players
                if (p1.isOnlineRemote && p2.isOnlineRemote) continue;

                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

                if (dist < p1.radius + p2.radius) {
                    // Simple physics resolution for local simulation
                    const s1 = Math.hypot(p1.vx, p1.vy);
                    const s2 = Math.hypot(p2.vx, p2.vy);

                    const p1Lethal = s1 > CONFIG.KILL_VELOCITY_THRESHOLD;
                    const p2Lethal = s2 > CONFIG.KILL_VELOCITY_THRESHOLD;

                    const p1Invincible = p1.isInvincible();
                    const p2Invincible = p2.isInvincible();

                    if (p1Lethal && p2Lethal) {
                        if (!p1Invincible) this.killPlayer(p1);
                        if (!p2Invincible) this.killPlayer(p2);
                    } else if (p1Lethal && !p2Lethal) {
                        if (!p2Invincible) this.killPlayer(p2, p1);
                        else this.bouncePlayers(p1, p2);
                    } else if (!p1Lethal && p2Lethal) {
                        if (!p1Invincible) this.killPlayer(p1, p2);
                        else this.bouncePlayers(p1, p2);
                    } else {
                        this.bouncePlayers(p1, p2);
                        if (dist < 500 && !p1.isOnlineRemote) SFX.playBounce();
                    }
                }
            }
        }
    }

    bouncePlayers(p1, p2) {
        if (isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) return; // Prevent NaN propagation

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const force = 1.5;
        if (!p1.isOnlineRemote) {
            p1.vx -= Math.cos(angle) * force;
            p1.vy -= Math.sin(angle) * force;
        }
        if (!p2.isOnlineRemote) {
            p2.vx += Math.cos(angle) * force;
            p2.vy += Math.sin(angle) * force;
        }
    }

    killPlayer(victim, killer = null) {
        if (!victim.alive) return;
        victim.alive = false;

        SFX.playKill();
        this.createExplosion(victim.x, victim.y, victim.color, victim.radius * 1.5);
        this.shake = 10;

        if (killer) {
            killer.grow(victim.radius * 1.5);
            killer.kills++;
            killer.flash = 10;

            // Coins reward logic
            if (killer === this.player) {
                const ratio = victim.radius / killer.radius;
                // 60-80 coins
                let coins = Math.floor(60 + Math.random() * 20 * Math.min(ratio, 1.5));
                if (coins < 60) coins = 60;
                if (coins > 80) coins = 80;

                // Screen space logic for coins UI flow
                const pScreenX = this.player.x - this.camera.x + this.canvas.width / 2;
                const pScreenY = this.player.y - this.camera.y + this.canvas.height / 2;

                for (let i = 0; i < coins; i++) {
                    const coin = {
                        x: pScreenX,
                        y: pScreenY,
                        vx: (Math.random() - 0.5) * 15, // fast visual explosion
                        vy: (Math.random() - 0.5) * 15,
                        life: 1.0,
                        val: 1 // value per particle
                    };
                    this.coinParticles.push(coin);
                }
            }
        }

        if (victim === this.player) {
            document.body.classList.add('shake');
            setTimeout(() => {
                const gameOverScreen = document.getElementById('game-over-screen');
                document.getElementById('final-score').innerText = Math.floor(this.player.score);
                document.getElementById('final-kills').innerText = this.player.kills;
                gameOverScreen.classList.remove('hidden');

                // Check Global Record
                db.ref('globalRecord').transaction(current => {
                    if (!current || this.player.score > current.score) {
                        return { score: Math.floor(this.player.score), holder: this.player.name };
                    }
                    return current;
                });

            }, 800);
        } else if (!victim.isOnlineRemote) {
            if (victim.isBot) {
                // Remove dead bot from array after a short visual delay or immediately?
                // Better: Keep it 'alive=false' so it stops updating, but remove it from array eventually or just filter in loop.
                // The issue is that the loop draws everything in this.players.
                // Let's remove it from this.players so it disappears.
                const idx = this.players.indexOf(victim);
                if (idx > -1) this.players.splice(idx, 1);

                setTimeout(() => {
                    const newBot = new Player(`BOT ${Math.floor(Math.random() * 999)}`, true, this);
                    this.players.push(newBot);
                }, 1500);
            }
        }
    }

    createExplosion(x, y, color, size) {
        const count = Math.min(size * 3, 100);
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color, size * 0.3));
        }
    }

    updateAndDrawCoins(dt) {
        const timeScale = dt / 16.66;
        const coinEl = document.getElementById('coin-display');
        if (!coinEl) return;

        const rect = coinEl.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // UI Space

        for (let i = this.coinParticles.length - 1; i >= 0; i--) {
            const c = this.coinParticles[i];

            if (c.life > 0.8) {
                // Explosion phase
                c.x += c.vx * timeScale;
                c.y += c.vy * timeScale;
                c.vx *= 0.9;
                c.vy *= 0.9;
            } else {
                // Fly phase
                const dx = targetX - c.x;
                const dy = targetY - c.y;
                const dist = Math.hypot(dx, dy);
                dist
                if (dist < 30) {
                    // Collected
                    USER_DATA.coins += c.val;
                    this.coinParticles.splice(i, 1);
                    Shop.saveUser();
                    continue;
                }

                const angle = Math.atan2(dy, dx);
                const speed = 35 * (1.1 - c.life);
                c.x += Math.cos(angle) * speed * timeScale;
                c.y += Math.sin(angle) * speed * timeScale;
            }

            c.life -= 0.005 * timeScale;
            if (c.life <= 0) this.coinParticles.splice(i, 1);

            // Draw
            this.ctx.fillStyle = '#fbbf24';
            this.ctx.beginPath();
            this.ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.stroke();
        }

        this.ctx.restore();
        document.getElementById('coin-display').innerText = USER_DATA.coins;
    }

    drawOffscreenIndicators() {
        if (!this.player || !this.player.alive) return;

        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Viewport Space

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        this.players.forEach(p => {
            if (p === this.player || !p.alive) return;

            // Check if offscreen
            const screenX = (p.x - this.camera.x) + cx;
            const screenY = (p.y - this.camera.y) + cy;

            if (screenX < 0 || screenX > this.canvas.width || screenY < 0 || screenY > this.canvas.height) {
                const angle = Math.atan2(screenY - cy, screenX - cx);
                // Clamp to screen padding
                const pad = 40;

                // Refined intersection for precise edges
                const w = this.canvas.width / 2 - pad;
                const h = this.canvas.height / 2 - pad;
                let dx = Math.cos(angle);
                let dy = Math.sin(angle);


                const tx = w / Math.abs(dx);
                const ty = h / Math.abs(dy);
                const t = Math.min(tx, ty);

                const px = cx + dx * t;
                const py = cy + dy * t;

                // Draw Arrow
                this.ctx.translate(px, py);
                this.ctx.rotate(angle);

                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.moveTo(15, 0);
                this.ctx.lineTo(-10, 10);
                this.ctx.lineTo(-10, -10);
                this.ctx.fill();

                // Name popup
                this.ctx.rotate(-angle);
                this.ctx.fillStyle = 'white';
                this.ctx.shadowColor = 'black';
                this.ctx.shadowBlur = 4;
                this.ctx.font = 'bold 12px sans-serif';
                this.ctx.textAlign = 'center';

                // Offset text towards center slightly
                const textOffset = -25;
                this.ctx.fillText(p.name, Math.cos(angle) * textOffset, Math.sin(angle) * textOffset);
                this.ctx.shadowBlur = 0;

                this.ctx.translate(-px, -py);
            }
        });

        this.ctx.restore();
    }

    updateUI(dt) {
        if (!this.player) return;
        document.getElementById('score-display').innerText = Math.floor(this.player.score);
        // Coins handled in updateAndDrawCoins
        const fps = Math.round(1000 / dt);
        document.getElementById('fps-counter').innerText = fps;

        const sorted = [...this.players].filter(p => p.alive).sort((a, b) => b.score - a.score).slice(0, 5);
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = sorted.map((p, i) =>
            `<li class="flex justify-between items-center bg-slate-800/50 p-1 px-2 rounded ${p === this.player ? 'border border-yellow-500/50' : ''}">
                <span class="${p === this.player ? 'text-yellow-300 font-bold' : 'text-gray-300'} text-xs">
                    #${i + 1} ${p.name}
                </span>
                <span class="text-xs font-mono text-cyan-400">${Math.floor(p.score)}</span>
            </li>`
        ).join('');
    }


}

window.onload = () => new Game();