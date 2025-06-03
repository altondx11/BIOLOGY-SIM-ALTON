const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
let width = canvas.width;
let height = canvas.height;
let activeTool = null;

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
  showLabels: true,
  record: [],
  tutorialShown: false,
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
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
    if(state.showLabels){
      ctx.fillStyle='black';
      ctx.fillText('RBC',this.x+8,this.y);
    }
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
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'black';
    ctx.fillRect(this.x-6, this.y-10, 12, 3);
    ctx.fillStyle = 'lime';
    ctx.fillRect(this.x-6, this.y-10, 12 * (this.health/3), 3);
    if(state.showLabels){
      ctx.fillStyle='black';
      ctx.fillText('Path',this.x+8,this.y);
    }
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
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.3)';
    ctx.shadowBlur=3;
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
    if(state.showLabels){
      ctx.fillStyle='black';
      ctx.fillText('Neu',this.x+8,this.y);
    }
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
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.3)';
    ctx.shadowBlur=3;
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
    if(state.showLabels){
      ctx.fillStyle='black';
      ctx.fillText('Mac',this.x+8,this.y);
    }
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
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,0.3)';
    ctx.shadowBlur=3;
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
    if(state.showLabels){
      ctx.fillStyle='black';
      ctx.fillText('T',this.x+8,this.y);
    }
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
  state.record.push({time:state.frame, pathogen:state.pathogens.length, neutrophil:state.neutrophils.length, macrophage:state.macrophages.length, tcell:state.tcells.length});
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
  const m = document.getElementById('metrics');
  const txt = `Path:${state.pathogens.length} Neu:${state.neutrophils.length} Mac:${state.macrophages.length} T:${state.tcells.length}`;
  m.textContent = txt;
  m.style.color = (state.pathogens.length===0||state.neutrophils.length===0||state.macrophages.length===0||state.tcells.length===0)?'orange':'black';
}

function init(){
  for(let i=0;i<50;i++) state.rbcs.push(new RBC());
  for(let i=0;i<5;i++) state.neutrophils.push(new Neutrophil());
  for(let i=0;i<2;i++) state.macrophages.push(new Macrophage());
  for(let i=0;i<2;i++) state.tcells.push(new TCell());
  draw();
}

function play(){
  if(!state.running){
    state.running = true;
    update();
  }
}
function pause(){ state.running=false; }
function stepFrame(){
  if(!state.running){
    step();
    draw();
  }
}
function reset(){
  Object.assign(state,{rbcs:[],pathogens:[],neutrophils:[],macrophages:[],tcells:[],particles:[],walls:[{side:'top',integrity:100},{side:'bottom',integrity:100},{side:'left',integrity:100},{side:'right',integrity:100}],frame:0,record:[]});
  init();
}

document.getElementById('playBtn').onclick=()=>{ state.running? pause(): play(); };
document.getElementById('stepBtn').onclick=stepFrame;
document.getElementById('speedSelect').onchange=e=>{ state.speed=parseInt(e.target.value); };
document.getElementById('sizeSlider').oninput=e=>{
  const s=parseInt(e.target.value); canvas.width=s; canvas.height=s; width=s; height=s; draw();
};
document.getElementById('settingsBtn').onclick=()=>{document.getElementById('settings').classList.toggle('hidden');};
document.getElementById('closeSettings').onclick=()=>{document.getElementById('settings').classList.add('hidden');};
document.getElementById('labelToggle').onchange=e=>{state.showLabels=e.target.checked;};
document.getElementById('spawnBtn').onclick=()=>{
  document.getElementById('spawnMenu').classList.toggle('hidden');
};
document.querySelectorAll('#spawnMenu [data-spawn]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const type=btn.getAttribute('data-spawn');
    const x=width/2,y=height/2;
    if(type==='Pathogen') state.pathogens.push(new Pathogen());
    if(type==='Neutrophil') state.neutrophils.push(new Neutrophil());
    if(type==='Macrophage') state.macrophages.push(new Macrophage());
    if(type==='TCell') state.tcells.push(new TCell());
    document.getElementById('spawnMenu').classList.add('hidden');
    draw();
  });
});
document.getElementById('closeSpawn').onclick=()=>{document.getElementById('spawnMenu').classList.add('hidden');};
document.getElementById('shieldBtn').onclick=()=>{ state.walls.forEach(w=>w.integrity=Math.min(100,w.integrity+10)); draw(); };
document.getElementById('syringeBtn').onclick=()=>{ activeTool='syringe'; };
document.getElementById('trashBtn').onclick=()=>{ activeTool='delete'; };
canvas.addEventListener('click',e=>{
  const rect=canvas.getBoundingClientRect();
  const x=e.clientX-rect.left, y=e.clientY-rect.top;
  if(activeTool==='syringe'){
    particleBurst(x,y,'orange');
    activeTool=null;
  } else if(activeTool==='delete'){
    const all=[...state.pathogens,...state.neutrophils,...state.macrophages,...state.tcells];
    for(const obj of all){
      if(dist({x,y},obj)<obj.radius){
        const arr=state[obj.constructor.name.toLowerCase()+'s'];
        if(arr){arr.splice(arr.indexOf(obj),1);} break;
      }
    }
    activeTool=null; draw();
  }
});
canvas.addEventListener('pointermove',e=>{
  const rect=canvas.getBoundingClientRect();
  const x=e.clientX-rect.left; const y=e.clientY-rect.top;
  let found=null;
  const all=[...state.rbcs,...state.pathogens,...state.neutrophils,...state.macrophages,...state.tcells];
  for(const obj of all){ if(dist({x,y},obj)<obj.radius){ found=obj; break; } }
  const tip=document.getElementById('tooltip');
  if(found){
    tip.classList.remove('hidden');
    tip.style.left=e.clientX+10+'px';
    tip.style.top=e.clientY+10+'px';
    let info=found.constructor.name;
    if(found.health!==undefined) info+=` HP:${found.health}`;
    if(found.life!==undefined) info+=` life:${found.life}`;
    tip.textContent=info;
  } else {
    tip.classList.add('hidden');
  }
});

window.addEventListener('keydown',e=>{
  if(e.code==='Space'){ e.preventDefault(); state.running? pause(): play(); }
  if(e.code==='ArrowRight') stepFrame();
});

function exportData(){
  let csv='time,pathogen,neutrophil,macrophage,tcell\n';
  state.record.forEach(r=>{csv+=`${r.time},${r.pathogen},${r.neutrophil},${r.macrophage},${r.tcell}\n`;});
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='simulation.csv';
  a.click();
}
document.getElementById('exportBtn').onclick=exportData;

init();