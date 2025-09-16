function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
}
// Micro-World Explorer – Looping + Complex Visuals + Audio + UI
// Krushali Chauhan

let zoomLevel = 0;          // can exceed bounds; we wrap it each frame
let layers = [];
let L = 0;                  // number of layers
let clickEvents = [];       // {x,y,frame,zoomIndex}

// sound oscillators (renamed to avoid conflict with p5.pop())
let humOsc, popOsc, pulseOsc, bloomOsc;
let audioReady = false;

// UI slider
let sliderX, sliderY, sliderW = 320, sliderH = 12;
let dragging = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();

  // Build layers
  layers.push(new CellLayer());
  layers.push(new BacteriaLayer());
  layers.push(new ParticleLayer());
  layers.push(new NeuralLayer());
  layers.push(new EcosystemLayer());
  layers.push(new CosmicLayer());
  L = layers.length;

  // Slider position
  sliderX = width/2 - sliderW/2;
  sliderY = height - 44;
}

function draw() {
  background(0);

  // Wrap zoomLevel into [0, L)
  zoomLevel = ((zoomLevel % L) + L) % L;

  // Cross-fade between current and next (wraps at the end)
  const index = floor(zoomLevel);
  const t = zoomLevel - index;              // 0..1
  const nextIndex = (index + 1) % L;

  layers[index].display(1 - t);
  layers[nextIndex].display(t);

  // Light cleanup: keep recent click events only (last ~2s)
  clickEvents = clickEvents.filter(e => frameCount - e.frame < 120);

  // UI
  drawSlider();
  drawLayerTicks();
}

function mouseWheel(event) {
  zoomLevel += event.deltaY * -0.0016;  // smooth scroll
}

function mousePressed() {
  // ensure audio can start (browser gesture)
  if (!audioReady) {
    userStartAudio();
    setupAudio();
    audioReady = true;
  }

  // slider hit?
  if (mouseX > sliderX && mouseX < sliderX + sliderW &&
      mouseY > sliderY - 10 && mouseY < sliderY + 22) {
    dragging = true;
  }

  // record click event at the discrete layer the user is closest to
  const zIndex = floor(zoomLevel + 0.5) % L;
  clickEvents.push({ x: mouseX, y: mouseY, frame: frameCount, zoom: zIndex });
}

function mouseDragged() {
  if (dragging) {
    const pct = constrain((mouseX - sliderX) / sliderW, 0, 1);
    zoomLevel = pct * L;  // note: slider shows 0..L, which wraps to 0
  }
}

function mouseReleased() {
  dragging = false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  sliderX = width/2 - sliderW/2;
  sliderY = height - 44;
}

/* ---------------------- AUDIO ---------------------- */
function setupAudio() {
  // Create oscillators
  humOsc   = new p5.Oscillator('sine');     humOsc.freq(60);  humOsc.amp(0);   humOsc.start();
  popOsc   = new p5.Oscillator('triangle'); popOsc.freq(440); popOsc.amp(0);   popOsc.start();
  pulseOsc = new p5.Oscillator('square');   pulseOsc.freq(200); pulseOsc.amp(0); pulseOsc.start();
  bloomOsc = new p5.Oscillator('sawtooth'); bloomOsc.freq(300); bloomOsc.amp(0); bloomOsc.start();
}

// tiny helpers for one-shot tones
function blip(osc, f=300, a=0.2, attack=0.03, release=0.25) {
  if (!audioReady) return;
  osc.freq(f);
  osc.amp(a, attack);
  osc.amp(0, release);
}

/* ---------------------- UI ---------------------- */
function drawSlider() {
  // track
  noStroke();
  fill(90);
  rect(sliderX, sliderY, sliderW, sliderH, 6);

  // knob (wrap indicator: 0..L)
  const pct = (zoomLevel % L) / L;
  const knobX = sliderX + pct * sliderW;
  fill(210, 160, 255);
  ellipse(knobX, sliderY + sliderH/2, 18);

  // label
  fill(255);
  textAlign(CENTER, BOTTOM);
  textSize(15);
  text("Zoom (loops): " + nf(zoomLevel % L, 1, 2), width/2, sliderY - 8);
}

function drawLayerTicks() {
  // mini tick marks & names along the slider
  textAlign(CENTER, TOP);
  textSize(11);
  for (let i = 0; i < L; i++) {
    const x = sliderX + (i / L) * sliderW;
    stroke(150);
    line(x, sliderY - 6, x, sliderY + sliderH + 6);
    noStroke();
    fill(180);
    text(layers[i].name, x, sliderY + sliderH + 10);
  }
}

/* ---------------------- LAYERS ---------------------- */
// NOTE: each display(alphaFactor: 0..1) cross-fades via alpha multipliers.
// You can further increase complexity per layer as desired.

// 1) Cells
class CellLayer {
  constructor() {
    this.name = "Cells";
    this.cells = [];
    for (let i = 0; i < 22; i++) {
      this.cells.push({
        x: random(width), y: random(height),
        r: random(36, 62), speed: random(0.005, 0.02), phase: random(TWO_PI)
      });
    }
  }
  display(a) {
    // gradient-ish wash
    noStroke();
    fill(25, 35, 60, 200 * a);
    rect(0, 0, width, height);

    // cells with nucleus + soft halo
    for (const c of this.cells) {
      const pul = sin(frameCount * c.speed + c.phase) * 8;
      const R = c.r + pul;

      // halo
      fill(120, 200, 255, 40 * a);
      ellipse(c.x, c.y, R * 1.6);

      // membrane
      fill(120, 210, 255, 180 * a);
      ellipse(c.x, c.y, R);

      // nucleus
      fill(255, 220 * a);
      ellipse(c.x, c.y, R * 0.35);
    }

    // click = mitosis
    for (const e of clickEvents) {
      if (e.zoom === 0) {
        this.cells.push({
          x: e.x + random(-24, 24), y: e.y + random(-24, 24),
          r: random(28, 44), speed: random(0.008, 0.018), phase: random(TWO_PI)
        });
        blip(popOsc, 420, 0.28);
      }
    }

    label(this.name, a);
  }
}

// 2) Bacteria (flow-field wriggle)
class BacteriaLayer {
  constructor() {
    this.name = "Bacteria";
    this.b = [];
    for (let i = 0; i < 48; i++) {
      this.b.push({
        x: random(width), y: random(height),
        a: random(TWO_PI), len: random(28, 42), wob: random(0.03, 0.06)
      });
    }
  }
  display(a) {
    // tinted backdrop
    noStroke();
    fill(12, 50, 28, 220 * a);
    rect(0, 0, width, height);

    // flow influenced by mouse
    for (const o of this.b) {
      const n = noise(o.x * 0.003, o.y * 0.003, frameCount * 0.005) * TWO_PI;
      const mx = map(mouseX, 0, width, -0.04, 0.04);
      const my = map(mouseY, 0, height, -0.04, 0.04);
      o.a += (n - o.a) * 0.06 + mx + my;
      o.x = (o.x + cos(o.a) * 2.0 + width) % width;
      o.y = (o.y + sin(o.a) * 2.0 + height) % height;

      push();
      translate(o.x, o.y);
      rotate(o.a);
      // body
      fill(0, 210, 120, 210 * a);
      ellipse(0, 0, o.len, 14);
      // tail wiggle
      fill(0, 180, 90, 160 * a);
      ellipse(-o.len * 0.35, 0, o.len * 0.4 + sin(frameCount * o.wob) * 6, 8);
      pop();
    }

    // low ambient hum when mostly visible
    if (audioReady) humOsc.amp(a * 0.06, 0.2);

    label(this.name, a);
  }
}

// 3) Molecular Swarms (orbital rings + explosions)
class ParticleLayer {
  constructor() {
    this.name = "Molecular Swarms";
    this.p = [];
    for (let i = 0; i < 220; i++) {
      this.p.push({ ang: random(TWO_PI), r: random(24, 240), speed: random(0.004, 0.012) });
    }
  }
  display(a) {
    noStroke();
    fill(0, 0, 45, 255 * a);
    rect(0, 0, width, height);

    // rings
    for (const q of this.p) {
      const ang = q.ang + frameCount * q.speed;
      const x = width / 2 + cos(ang) * q.r;
      const y = height / 2 + sin(ang) * q.r;
      fill(255, 220, 120, 180 * a);
      ellipse(x, y, 5);
    }

    // click = local pulse/explosion
    for (const e of clickEvents) {
      if (e.zoom === 2) {
        const rad = 20 + ((frameCount - e.frame) % 60);
        noFill();
        stroke(255, 255, 140, 220 * a);
        strokeWeight(2);
        ellipse(e.x, e.y, rad);
        strokeWeight(1);
        noStroke();
        blip(pulseOsc, 220, 0.22);
      }
    }

    label(this.name, a);
  }
}

// 4) Neural Webs (glowing graph + firing)
class NeuralLayer {
  constructor() {
    this.name = "Neural Webs";
    this.nodes = [];
    for (let i = 0; i < 22; i++) {
      this.nodes.push({ x: random(width), y: random(height) });
    }
  }
  display(a) {
    // deep wash
    noStroke();
    fill(8, 12, 36, 255 * a);
    rect(0, 0, width, height);

    // connections
    stroke(210, 160, 255, 160 * a);
    strokeWeight(1.2);
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const ni = this.nodes[i], nj = this.nodes[j];
        const d = dist(ni.x, ni.y, nj.x, nj.y);
        if (d < 240) line(ni.x, ni.y, nj.x, nj.y);
      }
    }

    // nodes
    noStroke();
    for (const n of this.nodes) {
      fill(205, 140, 255, 220 * a);
      ellipse(n.x, n.y, 12);
    }

    // click = fire neuron (glow pulse)
    for (const e of clickEvents) {
      if (e.zoom === 3) {
        const w = 42 + sin(frameCount * 0.22) * 16;
        fill(255, 190, 255, 220 * a);
        ellipse(e.x, e.y, w);
        blip(bloomOsc, 520, 0.22);
      }
    }

    label(this.name, a);
  }
}

// 5) Abstract Ecosystem (fractal-ish blooms + drag grow)
class EcosystemLayer {
  constructor() { this.name = "Abstract Ecosystem"; }
  display(a) {
    noStroke();
    fill(44, 16, 28, 255 * a);
    rect(0, 0, width, height);

    // coral/fungi bouquets
    for (let i = 0; i < 26; i++) {
      const x = noise(i * 0.11, frameCount * 0.004) * width;
      const y = noise(i * 0.17, frameCount * 0.004 + 99) * height;
      fill(205, 120, 185, 210 * a);
      beginShape();
      for (let ang = 0; ang < TWO_PI; ang += PI / 9) {
        const rr = 34 + noise(i, ang, frameCount * 0.014) * 90;
        vertex(x + cos(ang) * rr, y + sin(ang) * rr);
      }
      endShape(CLOSE);
    }

    // drag to grow living blooms
    if (mouseIsPressed) {
      fill(160, 255, 210, 190 * a);
      const r = 56 + sin(frameCount * 0.12) * 22;
      ellipse(mouseX, mouseY, r);
      blip(bloomOsc, 240, 0.12, 0.02, 0.18);
    }

    label(this.name, a);
  }
}

// 6) Cosmic Infinity (galaxy-ish noise starfield)
class CosmicLayer {
  constructor() { this.name = "Cosmic Infinity"; }
  display(a) {
    noStroke();
    fill(0, 0, 0, 255 * a);
    rect(0, 0, width, height);

    stroke(255, 255 * a);
    strokeWeight(1);
    for (let i = 0; i < 420; i++) {
      const x = noise(i * 0.09, frameCount * 0.0016) * width;
      const y = noise(i * 0.12, frameCount * 0.0016 + 77) * height;
      point(x, y);
    }

    // periodic twinkle
    if (audioReady && a > 0.5 && frameCount % 110 === 0) {
      blip(pulseOsc, 110, 0.06, 0.05, 0.3);
    }

    label(this.name, a);
  }
}

/* ---------------------- UTIL ---------------------- */
function label(txt, a=1) {
  noStroke();
  fill(255, 240 * a);
  textAlign(CENTER, TOP);
  textSize(22);
  text(txt, width / 2, 16);
}
