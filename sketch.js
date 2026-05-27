// ============================================================
// Week 3 Example 2: Full Fighting Game
// ============================================================

// ------------------------------------------------------------
// GAME STATES
// The game is always in exactly one state at a time.
// Each state controls what gets drawn and what responds to input.
// Storing states as constants prevents typos — if you mistype
// STATE_FIGHT, JavaScript will throw an error instead of
// silently using the wrong string.
// ------------------------------------------------------------
const STATE_START = "start";
const STATE_FIGHT = "fight";
const STATE_WIN   = "win";
const STATE_PORTAL_TRANSITION = "portalTransition";

let gameState = STATE_START;
let winner = null; // stores "P1" or "P2" when the game ends

// ------------------------------------------------------------
// SOUNDS
// Loaded in preload() so they are ready before the game starts.
// punchSounds is an array — a random one plays on each hit
// so punches don't sound identical every time.
// ------------------------------------------------------------
let punchSounds = [];
let winSound;
let bgMusic;

let portalSwooshSound;
let shieldUpSound;
let shieldOnSound;
let robotHurtSound;

let arenaBg;
let robotImg;
let bluePortalImg;
let orangePortalImg;

let portalTransitionFrame = 0;
let portalTransitionDuration = 90;
// ------------------------------------------------------------
// FIGHTER CLASS
// Extended from Example 1 to include health, attacking,
// hit detection, and a visual flash when hit.
// ------------------------------------------------------------
class Fighter {
  // ----------------------------------------------------------
  // constructor()
  // Sets up all properties for this fighter instance.
  // "label" is new here — used to identify P1 or P2 when
  // determining the winner.
  // ----------------------------------------------------------
  constructor(x, y, colour, controls, label) {
    // Position and physics
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.speed = 0.5;
    this.maxSpeed = 4;
    this.friction = 0.78;
    this.r = 28;

    // Appearance
    this.colour = colour;
    this.label = label; // "P1" or "P2"

    // Controls
    this.controls = controls;

    // Health — 3 hits to lose
    this.maxHealth = 3;
    this.health = 3;

    // Attack state
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackDuration = 18;  // frames the punch stays active
    this.attackCooldown = 0;   // frames until this fighter can attack again
    this.punchReach = 55;      // how far the fist extends in pixels
    this.punchDir = 1;         // direction of punch: 1 = right, -1 = left

    // Block state
    this.isBlocking = false;

    // Hit flash — briefly turns white when hit
    this.hitFlash = 0;

    // Prevents registering more than one hit per attack swing
    this.hitLanded = false;

    this.portalCooldown = 0;
  }

  // ----------------------------------------------------------
  // update()
  // Called every frame during the FIGHT state.
  // Returns early if the game is not in progress.
  // ----------------------------------------------------------
  update() {
    if (gameState !== STATE_FIGHT) return;

    this.handleInput();
    this.applyPhysics();

    // Count down attack timer — ends the attack after attackDuration frames
    if (this.isAttacking) {
      this.attackTimer--;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.hitLanded = false;
        this.attackCooldown = 20; // short cooldown before next punch
      }
    }

    // Count down cooldown each frame until it reaches zero
    if (this.attackCooldown > 0) this.attackCooldown--;

    // Count down hit flash each frame until it reaches zero
    if (this.hitFlash > 0) this.hitFlash--;

    if (this.portalCooldown > 0) {
      this.portalCooldown--;
    }
  }

  // ----------------------------------------------------------
  // handleInput()
  // Reads keyboard state for this fighter's specific keys.
  // keyIsDown() returns true every frame the key is held —
  // this gives smooth continuous movement.
  // ----------------------------------------------------------
  handleInput() {
    if (keyIsDown(this.controls.left))  this.vx -= this.speed;
    if (keyIsDown(this.controls.right)) this.vx += this.speed;

    // Clamp speed — prevents infinite acceleration
    this.vx = constrain(this.vx, -this.maxSpeed, this.maxSpeed);

    // Friction — gradually slows the fighter when no key is pressed
    if (!keyIsDown(this.controls.left) && !keyIsDown(this.controls.right)) {
      this.vx *= this.friction;
    }

    // Block state — held key toggles blocking on/off each frame
    let wasBlocking = this.isBlocking;
    this.isBlocking = keyIsDown(this.controls.block);
    if (this.isBlocking && !wasBlocking) {
      shieldUpSound.play();
      if (!shieldOnSound.isPlaying()) {
        shieldOnSound.loop();
      }
    }
    if (!this.isBlocking && wasBlocking) {
      shieldOnSound.stop();
    }
  }

  // ----------------------------------------------------------
  // applyPhysics()
  // Moves the fighter and keeps them inside the canvas.
  // No gravity in this example — fighters stay on the ground.
  // ----------------------------------------------------------
  applyPhysics() {
    this.x += this.vx;
    this.x = constrain(this.x, this.r, width - this.r);
  }

  // ----------------------------------------------------------
  // startAttack()
  // Called from keyPressed() when the attack key is pressed.
  // Uses keyPressed() rather than keyIsDown() so the punch
  // fires once per press, not every frame.
  // targetX is the opponent's x position — used to set the
  // direction the fist extends.
  // ----------------------------------------------------------
  startAttack(targetX) {
    // Do nothing if already attacking or in cooldown
    if (this.isAttacking || this.attackCooldown > 0) return;

    this.isAttacking = true;
    this.attackTimer = this.attackDuration;
    this.hitLanded = false;

    // Punch extends toward the opponent
    this.punchDir = targetX > this.x ? 1 : -1;

    // Pick a random punch sound from the array for variety
    let randomPunch = punchSounds[floor(random(punchSounds.length))];
    randomPunch.play();
  }

  // ----------------------------------------------------------
  // getPunchX()
  // Returns the x position of the fist tip.
  // Used in checkHits() to test whether the punch connects.
  // ----------------------------------------------------------
  getPunchX() {
    return this.x + this.punchDir * this.punchReach;
  }

  // ----------------------------------------------------------
  // takeHit()
  // Called on this fighter when the opponent's punch connects.
  // Blocked punches deal no damage.
  // ----------------------------------------------------------
  takeHit() {
    if (this.isBlocking) return; // blocked — no damage
    robotHurtSound.play();
    this.health--;
    this.hitFlash = 12; // flash white for 12 frames

    // If health reaches zero, end the game
    if (this.health <= 0) {
      this.health = 0;
      // The winner is whichever fighter is NOT this one
      endGame(this.label === "P1" ? "P2" : "P1");
    }
  }

  // ----------------------------------------------------------
  // draw()
  // Draws the shield ring, fist, blob body, and eyes.
  // push() and pop() isolate drawing styles to this method.
  // ----------------------------------------------------------
  draw() {
    push();

    // Shield ring when blocking
    if (this.isBlocking) {
      noFill();
      stroke(255, 255, 255, 150);
      strokeWeight(3);
      ellipse(this.x, this.y, (this.r + 16) * 2, (this.r + 16) * 2);
    }

    // Draw fist when attacking
    if (this.isAttacking) {
      if (this.label === "P1") {
        fill(48, 193, 255); // cyan
      } else {
        fill(255, 136, 0); // orange
      }
      noStroke();
      ellipse(this.getPunchX(), this.y, 20, 20);
    }

    // Robot character
    imageMode(CENTER);
    push();
    translate(this.x, this.y);
    // P1 faces right, P2 faces left
    if (this.label === "P1") {
      scale(-1, 1);
    }
    // White flash overlay when hit
    if (this.hitFlash > 0) {
      tint(255, 180);
    } else {
      noTint();
    }
    image(robotImg, 0, 0, this.r * 2.4, this.r * 2.4);
    pop();
    noTint();
  }
}

// ============================================================
// GLOBAL VARIABLES
// ============================================================
let fighter1, fighter2;
let bluePortal = { x: 25, y: 305, w: 70, h: 120 };
let orangePortal = { x: 775, y: 305, w: 70, h: 120 };
let groundY;

// ============================================================
// preload()
// Runs once before setup(). Loads all sounds so they are
// ready before the game starts.
// ============================================================
function preload() {
  // Load all 9 punch sounds into an array
  // A random one will be picked each time a punch lands
  for (let i = 1; i <= 9; i++) {
    punchSounds.push(loadSound("assets/sounds/punch_" + i + ".wav"));
  }
  winSound = loadSound("assets/sounds/win.wav");
  bgMusic  = loadSound("assets/sounds/background.mp3");
  arenaBg = loadImage("assets/images/metal_wall.jpg");
  robotImg = loadImage("assets/images/robot_char.png");
  bluePortalImg = loadImage("assets/images/portal.png");
  orangePortalImg = loadImage("assets/images/portal_orange.png");
  portalSwooshSound = loadSound("assets/sounds/portal_swoosh.mp3");
  shieldUpSound = loadSound("assets/sounds/shield_up.mp3");
  shieldOnSound = loadSound("assets/sounds/shield_on.mp3");
  robotHurtSound = loadSound("assets/sounds/robot_hurt.mp3");
  
  shieldUpSound.setVolume(2.0);
  portalSwooshSound.setVolume(1.2);
  shieldOnSound.setVolume(1.5);
  bgMusic.setVolume(0.75);
}

// ============================================================
// setup()
// Runs once at the very start of the sketch.
// Creates the canvas and both fighter instances.
// ============================================================
function setup() {
  createCanvas(800, 450);
  groundY = height - 80;
  setupFighters();
}

// ------------------------------------------------------------
// setupFighters()
// Creates both fighter instances with their starting
// positions, colours, and control keys.
// Called on setup and again on rematch to reset state.
//
// Key code reference:
// 65=A, 68=D, 70=F, 71=G (Player 1)
// LEFT_ARROW=37, RIGHT_ARROW=39, 75=K, 76=L (Player 2)
// ------------------------------------------------------------
function setupFighters() {
  fighter1 = new Fighter(
    200,
    groundY - 28,
    color(48, 193, 255), // teal
    { left: 65, right: 68, attack: 70, block: 71 }, // A D F G
    "P1",
  );

  fighter2 = new Fighter(
    600,
    groundY - 28,
    color(255, 150, 30), // orange
    { left: LEFT_ARROW, right: RIGHT_ARROW, attack: 75, block: 76 }, // Arrows K L
    "P2",
  );
}

// ============================================================
// draw()
// Runs repeatedly in a loop after setup() finishes.
// Switches what gets drawn based on the current game state.
// ============================================================
function draw() {
  imageMode(CORNER);
  image(arenaBg, 0, 0, width, height);

  fill(0, 0, 0, 180);
  rect(0, 0, width, height);

  if (gameState === STATE_START) {
    drawStartScreen();

  } else if (gameState === STATE_PORTAL_TRANSITION) {
    drawPortalTransition();

  } else if (gameState === STATE_FIGHT) {
    drawArena();
    drawPortals();
    updateAndDrawFighters();
    checkHits();
    drawHealthBars();
    drawFightHUD();

  } else if (gameState === STATE_WIN) {
    drawArena();
    fighter1.draw();
    fighter2.draw();
    drawWinScreen();
  }
}

function drawPortals() {
  imageMode(CENTER);
  image(bluePortalImg, bluePortal.x, bluePortal.y, bluePortal.w, bluePortal.h);
  image(orangePortalImg, orangePortal.x, orangePortal.y, orangePortal.w, orangePortal.h);
}

function drawPortalTransition() {
  portalTransitionFrame++;

  let progress = portalTransitionFrame / portalTransitionDuration;
  progress = constrain(progress, 0, 1);

  // makes the zoom start slower and end smoother
  let easedProgress = progress * progress * (3 - 2 * progress);

  imageMode(CENTER);

  // portal grows from small to huge
  let portalSize = lerp(120, width * 2.2, easedProgress);
  image(bluePortalImg, width / 2, height / 2, portalSize, portalSize);

  // fade to black near the end
  let fadeAlpha = map(progress, 0.55, 1, 0, 255);
  fadeAlpha = constrain(fadeAlpha, 0, 255);

  fill(0, fadeAlpha);
  noStroke();
  rect(0, 0, width, height);

  // once transition is done, start the fight
  if (portalTransitionFrame >= portalTransitionDuration) {
    startGame();
  }
}

function checkPortals(fighter) {

  if (fighter.portalCooldown > 0) return;

  let touchingBlue =
    abs(fighter.x - bluePortal.x) < bluePortal.w / 2 &&
    abs(fighter.y - bluePortal.y) < bluePortal.h / 2;

  let touchingOrange =
    abs(fighter.x - orangePortal.x) < orangePortal.w / 2 &&
    abs(fighter.y - orangePortal.y) < orangePortal.h / 2;

  if (touchingBlue) {
    portalSwooshSound.play();
    fighter.portalCooldown = 30;
    setTimeout(() => {
      fighter.x = orangePortal.x - 90;
    }, 200);
  } else if (touchingOrange) {
    portalSwooshSound.play();
    fighter.portalCooldown = 30;
    setTimeout(() => {
      fighter.x = bluePortal.x + 90;
    }, 200);
  }
}

// ============================================================
// GAME STATE FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// startGame()
// Transitions to the FIGHT state, resets fighters,
// and starts background music.
// ------------------------------------------------------------
function startGame() {
  gameState = STATE_FIGHT;
  winner = null;
  setupFighters();
  if (!bgMusic.isPlaying()) {
    bgMusic.loop();
  }
}

// ------------------------------------------------------------
// endGame()
// Transitions to the WIN state, stores the winner's label,
// stops music, and plays the win sound.
// ------------------------------------------------------------
function endGame(winnerLabel) {
  gameState = STATE_WIN;
  winner = winnerLabel;
  bgMusic.stop();
  winSound.play();
}

// ============================================================
// DRAW FUNCTIONS
// ============================================================

// ------------------------------------------------------------
// drawStartScreen()
// Displayed before the game begins.
// ------------------------------------------------------------
function drawStartScreen() {
  // Title
  fill(255);
  textAlign(CENTER);
  textSize(72);
  textFont('Georgia');
  text("P O R T A L S", width / 2, height / 2 - 60);

  image(bluePortalImg, 225 , 90, 100, 100);

  // Subtitle
  fill(160);
  textSize(18);
  text("First to land 3 hits wins", width / 2, height / 2 - 20);

  // Controls — each player shown in their colour
  textSize(14);
  fill(48, 193, 255);
  text("P1: A/D move   F attack   G block", width / 2, height / 2 + 30);
  fill(255, 136, 0);
  text("P2: Arrows move   K attack   L block", width / 2, height / 2 + 55);

  // Start prompt
  fill(255);
  textSize(16);
  text("Press ENTER to start", width / 2, height / 2 + 110);
}

// ------------------------------------------------------------
// drawWinScreen()
// Displayed after a fighter's health reaches zero.
// A semi-transparent overlay sits on top of the arena.
// ------------------------------------------------------------
function drawWinScreen() {
  // Semi-transparent overlay
  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  // Winner text — shown in the winner's colour
  fill(winner === "P1" ? color(48, 193, 255) : color(255, 136, 0));
  textAlign(CENTER);
  textSize(56);
  text(winner + " WINS!", width / 2, height / 2 - 30);

  // Rematch prompt
  fill(255);
  textSize(18);
  text("Press ENTER to rematch", width / 2, height / 2 + 40);
}

// ------------------------------------------------------------
// drawArena()
// Draws the ground plane and dividing line.
// ------------------------------------------------------------
function drawArena() {
  // transparent floor area so background still shows
  fill(0, 0, 0, 80);
  noStroke();
  rect(0, groundY, width, height - groundY);

  stroke(80);
  strokeWeight(1);
  line(0, groundY, width, groundY);
}

// ------------------------------------------------------------
// updateAndDrawFighters()
// Updates physics and input, then draws both fighters.
// Separated from draw() to keep it readable.
// ------------------------------------------------------------
function updateAndDrawFighters() {
  fighter1.update();
  fighter2.update();
  checkPortals(fighter1);
  checkPortals(fighter2);
  fighter1.draw();
  fighter2.draw();
}

// ------------------------------------------------------------
// checkHits()
// Called every frame during the FIGHT state.
// Checks if an attacking fighter's fist overlaps the opponent.
// hitLanded prevents the same swing from registering twice.
// ------------------------------------------------------------
function checkHits() {
  // Fighter 1 hitting Fighter 2
  if (fighter1.isAttacking && !fighter1.hitLanded) {
    let fistX = fighter1.getPunchX();
    let dist = abs(fistX - fighter2.x);
    if (dist < fighter2.r + 10) {
      fighter2.takeHit();
      fighter1.hitLanded = true;
    }
  }

  // Fighter 2 hitting Fighter 1
  if (fighter2.isAttacking && !fighter2.hitLanded) {
    let fistX = fighter2.getPunchX();
    let dist = abs(fistX - fighter1.x);
    if (dist < fighter1.r + 10) {
      fighter1.takeHit();
      fighter2.hitLanded = true;
    }
  }
}

// ------------------------------------------------------------
// drawHealthBars()
// Drawn as two rect()s per player — a grey background bar
// and a coloured health bar that shrinks as health decreases.
// map() converts health (0–3) to bar width in pixels.
// ------------------------------------------------------------
function drawHealthBars() {
  let barW    = 200;
  let barH    = 18;
  let barY    = 45;
  let padding = 30;

  // Player 1 health bar — left side, fills left to right
  let p1W = map(fighter1.health, 0, fighter1.maxHealth, 0, barW);
  fill(40);
  rect(padding, barY, barW, barH, 4);
  fill(48, 193, 255);
  rect(padding, barY, p1W, barH, 4);

  // Player 2 health bar — right side, fills right to left
  let p2W = map(fighter2.health, 0, fighter2.maxHealth, 0, barW);
  fill(40);
  rect(width - padding - barW, barY, barW, barH, 4);
  fill(255, 136, 0);
  rect(width - padding - p2W, barY, p2W, barH, 4);

  // Labels
  fill(255);
  textSize(13);
  noStroke();
  textAlign(LEFT);
  text("P1", padding, barY - 5);
  textAlign(RIGHT);
  text("P2", width - padding, barY - 5);
}

// ------------------------------------------------------------
// drawFightHUD()
// HUD = Heads Up Display.
// Shows controls at the bottom of the screen during a fight.
// ------------------------------------------------------------
function drawFightHUD() {
  noStroke();
  fill(120);
  textSize(12);
  textAlign(LEFT);
  text("A/D move   F attack   G block", 16, height - 12);
  textAlign(RIGHT);
  text("Arrows move   K attack   L block", width - 16, height - 12);
}

// ============================================================
// keyPressed()
// Used for actions that fire ONCE per press (attack, start).
// keyIsDown() is used for held actions (movement, blocking).
// This is an important distinction — keyPressed() fires once
// per keypress, keyIsDown() fires every frame the key is held.
// ============================================================
function keyPressed() {
  // Start or rematch — only responds to ENTER
  if (keyCode === ENTER) {
    if (gameState === STATE_START) {
      portalTransitionFrame = 0;
      portalSwooshSound.play();
      gameState = STATE_PORTAL_TRANSITION;
    } 
    else if (gameState === STATE_WIN) {
      startGame();
    }
  }

  // Player 1 attack — F key (keyCode 70)
  if (keyCode === 70 && gameState === STATE_FIGHT) {
    fighter1.startAttack(fighter2.x);
  }

  // Player 2 attack — K key (keyCode 75)
  if (keyCode === 75 && gameState === STATE_FIGHT) {
    fighter2.startAttack(fighter1.x);
  }
}
