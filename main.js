const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

const state = {
  running: false,
  speed: 1,
  spawnRate: 3,
  frame: 0,
  walls: [
    { side: 'top', integrity: 100 },
    { side: 'bottom', integrity: 100 },
    { side: 'left', integrity: 100 },
    { side: 'right', integrity: 100 },
  ],
  rbcs: [],
  pathogens: [],
  neutrophils: [],
  macrophages: [],
  tcells: [],
  particles: [],
  reinforcements: 3,
};

class Entity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }
  update() {
    this.x += this.vx * state.speed;
    this.y += this.vy * state.speed;
    if (this.x < 10) { this.x = 10; this.vx *= -1; damageWall('left'); }
    if (this.x > width-10) { this.x = width-10; this.vx *= -1; damageWall('right'); }
    if (this.y < 10) { this.y = 10; this.vy *= -1; damageWall('top'); }
    if (this.y > height-10) { this.y = height-10; this.vy *= -1; damageWall('bottom'); }
  }
}

class RBC extends Entity {
  constructor() {
    super(rand(20,width-20), rand(20,height-20));
    this.radius = 5;
  }
  update() {
    this.vx += rand(-0.5,0.5);
    this.vy += rand(-0.5,0.5);
    super.update();
  }
  draw() {
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
  }
}

class Pathogen extends Entity {
  constructor() {
    super(rand(20,width-20), rand(20,height-20));
    this.radius = 6;
    this.health = 3;
    this.timer = randInt(300,600);
    this.flagged = false;
  }
  update() {
    this.vx += rand(-0.5,0.5);
    this.vy += rand(-0.5,0.5);
    super.update();
    if (--this.timer <= 0) {
      this.timer = randInt(300,600);
      state.pathogens.push(new Pathogen());
    }
  }
  draw() {
    ctx.fillStyle = this.flagged ? 'orange' : 'purple';
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.fillRect(this.x-6, this.y-10, 12, 3);
    ctx.fillStyle = 'lime';
    ctx.fillRect(this.x-6, this.y-10, 12 * (this.health/3), 3);
  }
}

class Neutrophil extends Entity {
  constructor() {
    super(rand(20,width-20), rand(20,height-20));
    this.radius = 6;
    this.life = 600;
  }
  update() {
    const target = nearest(this, state.pathogens);
    if (target && dist(this,target) < 100) {
      const a = Math.atan2(target.y-this.y, target.x-this.x);
      this.vx += Math.cos(a)*0.5;
      this.vy += Math.sin(a)*0.5;
    } else {
      this.vx += rand(-0.2,0.2);
      this.vy += rand(-0.2,0.2);
    }
    super.update();
    for (let p of state.pathogens) {
      if (dist(this,p) < this.radius+p.radius) {
        p.health -= 1;
        p.flagged = true;
        this.life = 0;
        particleBurst(p.x,p.y,'blue');
        break;
      }
    }
    if (--this.life <= 0) {
      state.neutrophils.splice(state.neutrophils.indexOf(this),1);
    }
  }
  draw() {
    ctx.fillStyle = 'blue';
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
  }
}

class Macrophage extends Entity {
  constructor() {
    super(rand(20,width-20), rand(20,height-20));
    this.radius = 8;
    this.cool=0;
  }
  update() {
    if (this.cool>0) { this.cool--; }
    const target = nearest(this, state.pathogens);
    if (target) {
      const a = Math.atan2(target.y-this.y,target.x-this.x);
      this.vx += Math.cos(a)*0.2;
      this.vy += Math.sin(a)*0.2;
    }
    super.update();
    if (this.cool===0) {
      for (let p of state.pathogens) {
        if (dist(this,p) < this.radius+p.radius) {
          p.flagged = true;
          state.pathogens.splice(state.pathogens.indexOf(p),1);
          particleBurst(p.x,p.y,'green');
          this.cool = 120;
          break;
        }
      }
    }
  }
  draw() {
    ctx.fillStyle = 'green';
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
  }
}

class TCell extends Entity {
  constructor() {
    super(rand(20,width-20), rand(20,height-20));
    this.radius = 7;
  }
  update() {
    const target = nearest(this, state.pathogens.filter(p=>p.flagged));
    if (target) {
      const a = Math.atan2(target.y-this.y,target.x-this.x);
      this.vx += Math.cos(a)*0.4;
      this.vy += Math.sin(a)*0.4;
    }
    super.update();
    for (let p of state.pathogens) {
      if (p.flagged && dist(this,p)<this.radius+p.radius) {
        state.pathogens.splice(state.pathogens.indexOf(p),1);
        particleBurst(p.x,p.y,'purple');
        break;
      }
    }
  }
  draw() {
    ctx.fillStyle = 'purple';
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
  }
}

class Particle {
  constructor(x,y,color) {
    this.x=x; this.y=y; this.vx=rand(-2,2); this.vy=rand(-2,2); this.life=30; this.color=color;
  }
  update() {
    this.x+=this.vx; this.y+=this.vy; this.life--;
  }
  draw() {
    ctx.fillStyle=this.color;
    ctx.fillRect(this.x,this.y,2,2);
  }
}

function particleBurst(x,y,color) {
  for(let i=0;i<10;i++) state.particles.push(new Particle(x,y,color));
}

function rand(min,max){return Math.random()*(max-min)+min;}
function randInt(min,max){return Math.floor(rand(min,max));}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function nearest(entity, list){
  let best=null, bestd=Infinity;
  for(let l of list){const d=dist(entity,l); if(d<bestd){bestd=d; best=l;}}
  return best;
}

function damageWall(side){
  const wall = state.walls.find(w=>w.side===side);
  wall.integrity -= 0.05;
}

function drawWalls(){
  ctx.strokeStyle = 'gray';
  ctx.lineWidth = 10;
  ctx.strokeRect(5,5,width-10,height-10);
  ctx.fillStyle = 'yellow';
  state.walls.forEach(w=>{
    let x=0,y=0;
    if (w.side==='top') { x=width/2-50; y=2; }
    if (w.side==='bottom') { x=width/2-50; y=height-12; }
    if (w.side==='left') { x=2; y=height/2-50; }
    if (w.side==='right') { x=width-102; y=height/2-50; }
    ctx.fillRect(x,y,w.integrity,5);
  });
}

function updateEntities(arr){
  for(let i=arr.length-1;i>=0;i--){ arr[i].update(); if(arr[i].life<=0) arr.splice(i,1); }
}
function drawEntities(arr){ arr.forEach(e=>e.draw()); }

function update(){
  if(!state.running) return;
  for(let i=0;i<state.speed;i++) step();
  draw();
  requestAnimationFrame(update);
}

function step(){
  state.frame++;
  if(state.frame % Math.floor(120/state.spawnRate)===0){ state.pathogens.push(new Pathogen()); }
  updateEntities(state.rbcs);
  updateEntities(state.pathogens);
  updateEntities(state.neutrophils);
  updateEntities(state.macrophages);
  updateEntities(state.tcells);
  updateEntities(state.particles);
}

function draw(){
  ctx.clearRect(0,0,width,height);
  drawWalls();
  drawEntities(state.rbcs);
  drawEntities(state.pathogens);
  drawEntities(state.neutrophils);
  drawEntities(state.macrophages);
  drawEntities(state.tcells);
  drawEntities(state.particles);
  document.getElementById('stats').textContent=
    `RBC:${state.rbcs.length} Path:${state.pathogens.length} Neu:${state.neutrophils.length} Mac:${state.macrophages.length} T:${state.tcells.length}`;
}

function init(){
  for(let i=0;i<50;i++) state.rbcs.push(new RBC());
  for(let i=0;i<5;i++) state.neutrophils.push(new Neutrophil());
  for(let i=0;i<2;i++) state.macrophages.push(new Macrophage());
  for(let i=0;i<2;i++) state.tcells.push(new TCell());
  draw();
}

function start(){ if(!state.running){ state.running=true; update(); } }
function pause(){ state.running=false; }
function reset(){
  Object.assign(state,{rbcs:[],pathogens:[],neutrophils:[],macrophages:[],tcells:[],particles:[],walls:[{side:'top',integrity:100},{side:'bottom',integrity:100},{side:'left',integrity:100},{side:'right',integrity:100}],frame:0});
  init();
}

document.getElementById('startBtn').onclick=start;
document.getElementById('pauseBtn').onclick=pause;
document.getElementById('resetBtn').onclick=reset;
document.getElementById('reinforceBtn').onclick=()=>{
  if(state.reinforcements>0){
    state.neutrophils.push(new Neutrophil());
    state.macrophages.push(new Macrophage());
    state.reinforcements--; }
};
document.getElementById('spawnRate').oninput=e=>{state.spawnRate=parseInt(e.target.value);};
document.getElementById('speedSelect').onchange=e=>{state.speed=parseInt(e.target.value);};

init();
