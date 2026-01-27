/**
 * SpinShot.io
 * Full Code Implementation with DeltaTime & Invincibility
 */

// --- Audio Manager (Tone.js) ---
const SFX = {
    synth: null,
    poly: null,
    noise: null,
    lastBounceTime: 0,

    init: async () => {
        try {
            await Tone.start();
            SFX.synth = new Tone.MembraneSynth({
                pitchDecay: 0.05,
                octaves: 4,
                oscillator: { type: "sine" },
                envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.4, attackCurve: "exponential" }
            }).toDestination();
            SFX.synth.volume.value = -10;

            SFX.poly = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: "triangle" },
                envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }
            }).toDestination();
            SFX.poly.volume.value = -15;

            SFX.noise = new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.005, decay: 0.3, sustain: 0 }
            }).toDestination();
            SFX.noise.volume.value = -12;
        } catch (e) {
            console.warn("Audio Context init failed:", e);
        }
    },

    safeTrigger: (synth, note, duration, time) => {
        if (synth && Tone.context.state === 'running') {
            try {
                synth.triggerAttackRelease(note, duration, time);
            } catch (e) { }
        }
    },

    playLaunch: () => SFX.safeTrigger(SFX.synth, "C2", "8n", Tone.now()),
    playOrb: () => {
        const notes = ["C6", "D6", "E6", "G6", "A6"];
        const note = notes[Math.floor(Math.random() * notes.length)];
        SFX.safeTrigger(SFX.poly, note, "32n", Tone.now());
    },
    playKill: () => {
        SFX.safeTrigger(SFX.noise, null, "8n", Tone.now());
        SFX.safeTrigger(SFX.synth, "G1", "4n", Tone.now());
    },
    playBounce: () => {
        const now = Tone.now();
        if (now > SFX.lastBounceTime + 0.1) {
            SFX.lastBounceTime = now;
            SFX.safeTrigger(SFX.synth, "A1", "16n", now);
        }
    },
    playPowerup: () => SFX.safeTrigger(SFX.poly, ["C5", "E5", "G5", "C6"], "16n", Tone.now())
};

// --- Configuración ---
const CONFIG = {
    MAP_WIDTH: 1500,
    MAP_HEIGHT: 1500,
    BASE_RADIUS: 30,
    MAX_RADIUS: 100,
    BASE_SPIN_SPEED: 0.1,
    FRICTION: 0.96,
    LAUNCH_FORCE_BASE: 20,
    KILL_VELOCITY_THRESHOLD: 10,
    ORB_COUNT: 50,
    BOT_COUNT: 9, // Total 10 (1 Player + 9 Bots)
    POWERUP_SPAWN_RATE: 0.002,
    INVINCIBLE_TIME: 3000,
    POWERUP_DURATION: 8000
};

const CHARACTERS = {
    'PRIMO': { name: 'EL TANQUE', color: '#eab308', hpMult: 1.2, speedMult: 0.9, special: 'SHOCKWAVE', icon: '🥊' },
    'COLT': { name: 'PISTOLERO', color: '#3b82f6', hpMult: 0.9, speedMult: 1.1, special: 'BULLET', icon: '🔫' },
    'MAX': { name: 'VELOCISTA', color: '#ec4899', hpMult: 1.0, speedMult: 1.3, special: 'TURBO', icon: '⚡' }
};

// --- Clases ---

class Trail {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.life = 1.0;
        this.decay = 0.08;
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

class Projectile extends Entity {
    constructor(x, y, angle, owner) {
        super(x, y, 10, '#fff');
        this.vx = Math.cos(angle) * 25;
        this.vy = Math.sin(angle) * 25;
        this.owner = owner;
        this.life = 40; // Frames
    }
    update(timeScale) {
        this.x += this.vx * timeScale;
        this.y += this.vy * timeScale;
        this.life -= timeScale;
        if (this.life <= 0) this.alive = false;

        // Simple trail
        if (Math.random() > 0.5)
            this.owner.game.particles.push(new Particle(this.x, this.y, '#fff', 2));
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class Orb extends Entity {
    constructor() {
        super(Math.random() * CONFIG.MAP_WIDTH, Math.random() * CONFIG.MAP_HEIGHT, 8, `hsl(${Math.random() * 360}, 80%, 60%)`);
        this.floatOffset = Math.random() * 100;
        this.initialX = this.x;
        this.initialY = this.y;
    }
    draw(ctx, time) {
        const pulse = Math.sin(time * 0.005 + this.floatOffset) * 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x - 2, this.y - 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

class PowerUp extends Entity {
    constructor() {
        super(Math.random() * (CONFIG.MAP_WIDTH - 200) + 100, Math.random() * (CONFIG.MAP_HEIGHT - 200) + 100, 30, '#FFF');
        this.type = Math.floor(Math.random() * 3);
        this.icon = ['🎯', '🛡️', '🔒'][this.type];
        this.color = ['#3b82f6', '#22c55e', '#a855f7'][this.type];
        this.name = ['SLOW SPIN', 'WALL BOUNCE', 'VECTOR LOCK'][this.type];
        this.rotation = 0;
    }
    draw(ctx, time) {
        const bounce = Math.sin(time * 0.005) * 8;
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
        this.decay = 0.05 + Math.random() * 0.05;
        this.color = color;
        this.size = Math.random() * 6 + 3;
    }
    update(timeScale) {
        this.x += this.vx * timeScale;
        this.y += this.vy * timeScale;
        this.life -= this.decay * timeScale;
        this.size *= 0.9;
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

class Player extends Entity {
    constructor(name, isBot = false, gameInstance, charType = 'PRIMO') {
        super(0, 0, CONFIG.BASE_RADIUS, isBot ? '#ef4444' : '#06b6d4');
        this.name = name;
        this.isBot = isBot;
        this.game = gameInstance;

        // Character Stats
        this.charType = charType;
        const stats = CHARACTERS[charType];
        this.color = isBot ? `hsl(${Math.random() * 360}, 70%, 50%)` : stats.color;
        this.radius *= stats.hpMult;

        this.angle = Math.random() * Math.PI * 2;
        this.vx = 0;
        this.vy = 0;
        this.state = 'SPINNING';
        this.score = 0;
        this.kills = 0;

        // Abilities
        this.specialReady = true;
        this.specialCooldown = 0;
        this.specialMaxCooldown = 300; // 5 seconds approx

        this.activePowerup = null;
        this.powerupEndTime = 0;
        this.canBounce = false;

        this.trails = [];
        this.flash = 0;
        this.spawnTime = Date.now();
        this.botActionTimer = 0;
    }

    isInvincible() {
        return Date.now() - this.spawnTime < CONFIG.INVINCIBLE_TIME;
    }

    triggerSpecial() {
        if (!this.specialReady) return;

        this.specialReady = false;
        this.specialCooldown = this.specialMaxCooldown;
        const stats = CHARACTERS[this.charType];

        if (!this.isBot) SFX.playLaunch(); // Re-use generic sound or add special sound

        if (stats.special === 'SHOCKWAVE') {
            // Push everyone away
            this.game.createExplosion(this.x, this.y, '#fbbf24', 50);
            this.game.players.forEach(p => {
                if (p === this || !p.alive) return;
                const d = Math.hypot(p.x - this.x, p.y - this.y);
                if (d < 300) {
                    const ang = Math.atan2(p.y - this.y, p.x - this.x);
                    p.vx += Math.cos(ang) * 30;
                    p.vy += Math.sin(ang) * 30;
                    p.state = 'MOVING'; // Break spin
                }
            });
        } else if (stats.special === 'BULLET') {
            const angle = this.state === 'SPINNING' ? this.angle : Math.atan2(this.vy, this.vx);
            this.game.projectiles.push(new Projectile(this.x, this.y, angle, this));
            this.game.projectiles.push(new Projectile(this.x, this.y, angle - 0.2, this));
            this.game.projectiles.push(new Projectile(this.x, this.y, angle + 0.2, this));
        } else if (stats.special === 'TURBO') {
            const angle = this.state === 'SPINNING' ? this.angle : Math.atan2(this.vy, this.vx);
            this.vx = Math.cos(angle) * 40;
            this.vy = Math.sin(angle) * 40;
            this.state = 'MOVING';
            this.trails.push(new Trail(this.x, this.y, this.radius, '#fff'));
        }
    }

    update(timeScale) {
        const speed = Math.hypot(this.vx, this.vy);
        const now = Date.now();

        // Cooldown
        if (this.specialCooldown > 0) {
            this.specialCooldown -= timeScale;
            if (this.specialCooldown <= 0) {
                this.specialReady = true;
                if (!this.isBot) {
                    // UI Update for special ready could go here
                }
            }
        }

        // Check Powerup Expiration
        if (this.activePowerup && now > this.powerupEndTime) this.deactivatePowerup();

        if (this.state === 'SPINNING') {
            let spinSpeed = CONFIG.BASE_SPIN_SPEED * CHARACTERS[this.charType].speedMult;
            spinSpeed *= (1 - (this.radius / 500));
            if (this.activePowerup === 'SLOW SPIN') spinSpeed *= 0.3;
            if (this.activePowerup === 'VECTOR LOCK') spinSpeed = 0;

            this.angle += spinSpeed * timeScale;
            this.angle = this.angle % (Math.PI * 2);

            const spinFriction = Math.pow(0.85, timeScale);
            this.vx *= spinFriction;
            this.vy *= spinFriction;
        }
        else if (this.state === 'MOVING') {
            this.x += this.vx * timeScale;
            this.y += this.vy * timeScale;
            const moveFriction = Math.pow(CONFIG.FRICTION, timeScale);
            this.vx *= moveFriction;
            this.vy *= moveFriction;

            if (speed > 5) {
                if (Math.random() < 0.4 * timeScale) this.trails.push(new Trail(this.x, this.y, this.radius, this.color));
            }
            if (speed < 0.8) {
                this.state = 'SPINNING';
                this.canBounce = false;
            }
        }

        for (let i = this.trails.length - 1; i >= 0; i--) {
            this.trails[i].update(timeScale);
            if (this.trails[i].life <= 0) this.trails.splice(i, 1);
        }

        if (this.flash > 0) this.flash -= 1 * timeScale;

        this.handleMapCollisions();
        if (this.isBot) this.updateBotAI(timeScale);
    }

    // ... [Reuse collision logic, it's fine] ...

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
            const force = (CONFIG.LAUNCH_FORCE_BASE * CHARACTERS[this.charType].speedMult) + (this.radius * 0.05);
            this.vx = Math.cos(this.angle) * force;
            this.vy = Math.sin(this.angle) * force;
            this.state = 'MOVING';
            if (!this.isBot) SFX.playLaunch();
            this.flash = 5;
        }
    }

    updateBotAI(timeScale) {
        if (!this.alive) return;
        this.botActionTimer += timeScale;

        // Bot Special Usage
        if (this.specialReady && this.botActionTimer > 60 && Math.random() < 0.01) {
            const enemiesNear = this.game.players.some(p => p !== this && p.alive && Math.hypot(p.x - this.x, p.y - this.y) < 300);
            if (enemiesNear) this.triggerSpecial();
        }

        if (this.state !== 'SPINNING') return;
        if (this.botActionTimer < 5) return;
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
            if (diff < 0.15) this.launch();
        } else {
            if (Math.random() < 0.03) this.launch();
        }
    }

    // ... Powerup Logic reuse ...

    applyPowerup(type) {
        this.activePowerup = type;
        this.powerupEndTime = Date.now() + CONFIG.POWERUP_DURATION;
        if (type === 'WALL BOUNCE') this.canBounce = true;
        if (!this.isBot) {
            SFX.playPowerup();
            // UI handled in Game loop or specialized UI method
        }
    }

    deactivatePowerup() {
        this.activePowerup = null;
        this.canBounce = false;
    }

    grow(amount) {
        this.score += Math.floor(amount);
        if (this.radius < CONFIG.MAX_RADIUS) {
            this.radius += amount * 0.15;
        }
    }

    draw(ctx) {
        this.trails.forEach(t => t.draw(ctx));
        ctx.save();
        ctx.translate(this.x, this.y);

        // Invincibility
        if (this.isInvincible()) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 15, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(Date.now() * 0.01) * 0.3})`;
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        if (this.flash > 0) ctx.fillStyle = 'white';
        else ctx.fillStyle = this.color;

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

        // Aura for special ready
        if (this.specialReady) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 20;
        } else {
            ctx.shadowBlur = 0;
        }

        const speed = Math.hypot(this.vx, this.vy);
        if (speed > CONFIG.KILL_VELOCITY_THRESHOLD) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        // Arrow shape
        ctx.moveTo(this.radius + 10, 0);
        ctx.lineTo(this.radius, 10);
        ctx.lineTo(this.radius, -10);
        ctx.fill();

        if (this.activePowerup === 'VECTOR LOCK') {
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(500, 0);
            ctx.stroke();
        }

        ctx.restore();

        if (this.alive) {
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.max(12, this.radius * 0.4)}px 'Lilita One'`;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.strokeText(this.name, this.x, this.y - this.radius - 12);
            ctx.fillText(this.name, this.x, this.y - this.radius - 12);
        }
    }
}

// --- Motor Principal ---

// --- Motor Principal ---

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.particles = [];
        this.orbs = [];
        this.powerups = [];
        this.players = [];
        this.projectiles = [];

        this.camera = { x: 0, y: 0 };
        this.shake = 0;

        this.running = false;
        this.player = null;

        // Time control
        this.lastTime = 0;

        window.addEventListener('resize', () => this.resize());

        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.handleLaunch();
            if (e.code === 'KeyE' || e.code === 'KeyF') this.handleSpecial();
        });

        // Touch/Mouse Controls handled via UI buttons now, but keep click for fallback launch
        this.canvas.addEventListener('mousedown', (e) => {
            // Only if not clicking UI buttons
            if (e.target.id === 'gameCanvas') this.handleLaunch();
        });

        document.getElementById('restart-btn').addEventListener('click', () => location.reload());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    handleLaunch() {
        if (this.running && this.player && this.player.alive) {
            this.player.launch();
        }
    }

    handleSpecial() {
        if (this.running && this.player && this.player.alive) {
            this.player.triggerSpecial();
        }
    }

    init(userCharType) {
        this.particles = [];
        this.orbs = [];
        this.powerups = [];
        this.players = [];
        this.projectiles = [];

        for (let i = 0; i < CONFIG.ORB_COUNT; i++) this.orbs.push(new Orb());

        // Grid Spawn Logic (2x5) centered
        // Map is 1500w x 1500h
        const centerX = CONFIG.MAP_WIDTH / 2;
        const centerY = CONFIG.MAP_HEIGHT / 2;
        const gapX = 150;
        const gapY = 300; // Large vertical gap between teams or rows

        // Spots: 2 lines of 5
        const spots = [];
        for (let row = 0; row < 2; row++) {
            for (let col = 0; col < 5; col++) {
                // Centered grid
                const x = centerX - (2 * gapX) + (col * gapX);
                const y = centerY - (0.5 * gapY) + (row * gapY);
                spots.push({ x, y });
            }
        }

        // Shuffle spots
        spots.sort(() => Math.random() - 0.5);

        // Bots
        const botNames = ["Dynamike", "Bo", "Tick", "8-Bit", "Emz", "Stu", "Piper", "Pam", "Frank"];
        const charKeys = Object.keys(CHARACTERS);

        for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
            const spot = spots.pop();
            const randomChar = charKeys[Math.floor(Math.random() * charKeys.length)];
            const bot = new Player(botNames[i] || `Bot ${i}`, true, this, randomChar);
            bot.x = spot.x;
            bot.y = spot.y;
            this.players.push(bot);
        }

        // Player
        const playerSpot = spots.pop();
        this.player = new Player("YOU", false, this, userCharType);
        this.player.x = playerSpot.x;
        this.player.y = playerSpot.y;
        this.players.push(this.player);
    }

    async startGame(playerName, charType = 'PRIMO') {
        await SFX.init();
        const name = playerName || "JUGADOR";

        this.init(charType);

        // Update player name
        this.player.name = name.toUpperCase();

        this.running = true;
        this.lastTime = performance.now();
        this.loop();
    }

    spawnPowerup(timeScale) {
        if (Math.random() < CONFIG.POWERUP_SPAWN_RATE * timeScale && this.powerups.length < 5) {
            this.powerups.push(new PowerUp());
        }
    }

    checkCollisions() {
        const allEntities = this.players.filter(p => p.alive);

        // Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            // Map bounds for projectiles
            if (proj.x < 0 || proj.x > CONFIG.MAP_WIDTH || proj.y < 0 || proj.y > CONFIG.MAP_HEIGHT) {
                proj.alive = false;
            }

            if (!proj.alive) {
                this.projectiles.splice(i, 1);
                continue;
            }

            for (const p of allEntities) {
                if (p === proj.owner) continue;
                const dist = Math.hypot(p.x - proj.x, p.y - proj.y);
                if (dist < p.radius) {
                    // Hit
                    proj.alive = false;
                    this.createExplosion(proj.x, proj.y, '#fff', 10);

                    // Knockback or damage (SpinShot uses physics knockback usually)
                    const ang = Math.atan2(p.y - proj.y, p.x - proj.x);
                    p.vx += Math.cos(ang) * 15;
                    p.vy += Math.sin(ang) * 15;
                    p.state = 'MOVING'; // interrupt spin

                    if (p.isInvincible()) continue;
                    // Maybe reduce stats? For now just knockback is powerful enough in sumo
                }
            }
        }

        // Orbes
        allEntities.forEach(p => {
            for (let i = this.orbs.length - 1; i >= 0; i--) {
                const orb = this.orbs[i];
                if (Math.abs(p.x - orb.x) > p.radius + orb.radius + 10) continue;
                const dist = Math.hypot(p.x - orb.x, p.y - orb.y);
                if (dist < p.radius + orb.radius) {
                    p.grow(4);
                    if (!p.isBot) SFX.playOrb();
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

                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

                if (dist < p1.radius + p2.radius) {
                    const s1 = Math.hypot(p1.vx, p1.vy);
                    const s2 = Math.hypot(p2.vx, p2.vy);
                    const p1Lethal = s1 > CONFIG.KILL_VELOCITY_THRESHOLD;
                    const p2Lethal = s2 > CONFIG.KILL_VELOCITY_THRESHOLD;
                    const p1Inv = p1.isInvincible();
                    const p2Inv = p2.isInvincible();

                    if (p1Lethal && p2Lethal) {
                        if (!p1Inv) this.killPlayer(p1);
                        if (!p2Inv) this.killPlayer(p2);
                    } else if (p1Lethal && !p2Lethal) {
                        if (!p2Inv) this.killPlayer(p2, p1);
                        else this.bouncePlayers(p1, p2);
                    } else if (!p1Lethal && p2Lethal) {
                        if (!p1Inv) this.killPlayer(p1, p2);
                        else this.bouncePlayers(p1, p2);
                    } else {
                        this.bouncePlayers(p1, p2);
                        if (dist < 500) SFX.playBounce();
                    }
                }
            }
        }
    }

    bouncePlayers(p1, p2) {
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const force = 1.5;
        p1.vx -= Math.cos(angle) * force;
        p1.vy -= Math.sin(angle) * force;
        p2.vx += Math.cos(angle) * force;
        p2.vy += Math.sin(angle) * force;
    }

    killPlayer(victim, killer = null) {
        if (!victim.alive) return;
        victim.alive = false;

        SFX.playKill();
        this.createExplosion(victim.x, victim.y, victim.color, victim.radius * 2);
        this.shake = 15;

        if (killer) {
            killer.grow(victim.radius * 1.5);
            killer.kills++;
            killer.flash = 10;
        }

        if (victim === this.player) {
            document.body.classList.add('shake');
            setTimeout(() => {
                const gameOverScreen = document.getElementById('game-over-screen');
                document.getElementById('final-score').innerText = Math.floor(this.player.score);
                document.getElementById('final-kills').innerText = this.player.kills;
                gameOverScreen.classList.remove('hidden');
            }, 800);
        }
    }

    createExplosion(x, y, color, size) {
        const count = Math.min(size * 3, 50);
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color, size * 0.3));
        }
    }

    updateUI(dt) {
        if (!this.player) return;
        document.getElementById('score-display').innerText = this.player.score;
        const fps = Math.round(1000 / dt);
        document.getElementById('fps-counter').innerText = fps;

        const sorted = [...this.players].filter(p => p.alive).sort((a, b) => b.score - a.score).slice(0, 5);
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = sorted.map((p, i) =>
            `<li class="flex justify-between items-center bg-slate-800/80 p-1 px-2 rounded ${p === this.player ? 'border border-yellow-500/50' : ''}">
        <span class="${p === this.player ? 'text-yellow-300 font-bold' : 'text-gray-300'} text-xs overflow-hidden text-ellipsis whitespace-nowrap max-w-[100px]">
            #${i + 1} ${p.name}
        </span>
        <span class="text-xs font-mono text-cyan-400">${Math.floor(p.score)}</span>
    </li>`
        ).join('');
    }

    drawGrid() {
        this.ctx.fillStyle = '#0f172a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        let shakeX = 0, shakeY = 0;
        if (this.shake > 0) {
            shakeX = (Math.random() - 0.5) * this.shake;
            shakeY = (Math.random() - 0.5) * this.shake;
            this.shake *= 0.9;
            if (this.shake < 0.5) this.shake = 0;
        }

        this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

        // Map Border
        this.ctx.strokeStyle = '#334155';
        this.ctx.lineWidth = 20;
        this.ctx.strokeRect(0, 0, CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);

        // Grid
        this.ctx.strokeStyle = '#1e293b';
        this.ctx.lineWidth = 2;
        const gridSize = 150;

        const startX = Math.floor(this.camera.x / gridSize) * gridSize;
        const startY = Math.floor(this.camera.y / gridSize) * gridSize;
        const endX = startX + this.canvas.width + gridSize;
        const endY = startY + this.canvas.height + gridSize;

        this.ctx.beginPath();
        for (let x = startX; x < endX; x += gridSize) {
            if (x < 0 || x > CONFIG.MAP_WIDTH) continue;
            this.ctx.moveTo(x, Math.max(0, startY));
            this.ctx.lineTo(x, Math.min(CONFIG.MAP_HEIGHT, endY));
        }
        for (let y = startY; y < endY; y += gridSize) {
            if (y < 0 || y > CONFIG.MAP_HEIGHT) continue;
            this.ctx.moveTo(Math.max(0, startX), y);
            this.ctx.lineTo(Math.min(CONFIG.MAP_WIDTH, endX), y);
        }
        this.ctx.stroke();

        this.ctx.restore();
    }

    loop() {
        if (!this.running) return;

        const now = performance.now();
        let dt = now - this.lastTime;
        this.lastTime = now;
        if (dt > 100) dt = 100;
        const timeScale = dt / (1000 / 60);

        this.spawnPowerup(timeScale);

        this.players.forEach(p => p.alive && p.update(timeScale));
        this.projectiles.forEach(p => p.alive && p.update(timeScale));

        this.particles.forEach((p, i) => {
            p.update(timeScale);
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        this.checkCollisions();

        if (this.player.alive) {
            const targetX = this.player.x - this.canvas.width / 2;
            const targetY = this.player.y - this.canvas.height / 2;
            const lerpFactor = 1 - Math.pow(0.85, timeScale); // Faster camera
            this.camera.x += (targetX - this.camera.x) * lerpFactor;
            this.camera.y += (targetY - this.camera.y) * lerpFactor;
        }

        this.drawGrid();

        this.ctx.save();
        let shakeX = (this.shake > 0) ? (Math.random() - 0.5) * this.shake : 0;
        let shakeY = (this.shake > 0) ? (Math.random() - 0.5) * this.shake : 0;
        this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);

        this.orbs.forEach(orb => orb.draw(this.ctx, now));
        this.powerups.forEach(pup => pup.draw(this.ctx, now));
        this.particles.forEach(p => p.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.players.forEach(p => { if (p.alive) p.draw(this.ctx); });

        this.ctx.restore();

        this.updateUI(dt);
        requestAnimationFrame(() => this.loop());
    }
}

// Make globally available
window.Game = Game;
window.CHARACTERS = CHARACTERS;
