// FEATURE: Simulation uses delta time and vector fields for blood flow
const canvas=document.getElementById('simCanvas');
const ctx=canvas.getContext('2d');
let width=canvas.width;
let height=canvas.height;

const WORLD_SIZE=1000;
const FIELD_RES=32;
const CELL_SIZE=WORLD_SIZE/FIELD_RES;
let scale=width/WORLD_SIZE;

function resizeCanvas(){
  const avail=Math.min(window.innerWidth-520,1600);
  canvas.width=avail;
  canvas.height=avail*0.75;
  width=canvas.width;
  height=canvas.height;
  scale=width/WORLD_SIZE;
}
window.addEventListener('resize',resizeCanvas);
resizeCanvas();

// FEATURE: Vector field arrays for blood and lymph flow and chemokines
const bloodField=new Float32Array(FIELD_RES*FIELD_RES*2);
const lymphField=new Float32Array(FIELD_RES*FIELD_RES*2);
const chemField=new Float32Array(FIELD_RES*FIELD_RES);

function idx(i,j){return j*FIELD_RES+i;}
function sampleVec(field,x,y){const fx=x/WORLD_SIZE*(FIELD_RES-1);const fy=y/WORLD_SIZE*(FIELD_RES-1);const i=Math.floor(fx);const j=Math.floor(fy);const u=fx-i;const v=fy-j;function vec(i,j){return [field[idx(i,j)*2],field[idx(i,j)*2+1]];}const a=vec(i,j);const b=vec(Math.min(i+1,FIELD_RES-1),j);const c=vec(i,Math.min(j+1,FIELD_RES-1));const d=vec(Math.min(i+1,FIELD_RES-1),Math.min(j+1,FIELD_RES-1));return[(a[0]*(1-u)*(1-v)+b[0]*u*(1-v)+c[0]*(1-u)*v+d[0]*u*v),(a[1]*(1-u)*(1-v)+b[1]*u*(1-v)+c[1]*(1-u)*v+d[1]*u*v)];}
function sampleScalar(field,x,y){const fx=x/WORLD_SIZE*(FIELD_RES-1);const fy=y/WORLD_SIZE*(FIELD_RES-1);const i=Math.floor(fx);const j=Math.floor(fy);const u=fx-i;const v=fy-j;const s0=field[idx(i,j)];const s1=field[idx(Math.min(i+1,FIELD_RES-1),j)];const s2=field[idx(i,Math.min(j+1,FIELD_RES-1))];const s3=field[idx(Math.min(i+1,FIELD_RES-1),Math.min(j+1,FIELD_RES-1))];return s0*(1-u)*(1-v)+s1*u*(1-v)+s2*(1-u)*v+s3*u*v;}
function gradChem(x,y){const eps=CELL_SIZE;const c1=sampleScalar(chemField,Math.max(0,x-eps),y);const c2=sampleScalar(chemField,Math.min(WORLD_SIZE,x+eps),y);const c3=sampleScalar(chemField,x,Math.max(0,y-eps));const c4=sampleScalar(chemField,x,Math.min(WORLD_SIZE,y+eps));return[(c2-c1)/(2*eps),(c4-c3)/(2*eps)];}

function initFields(){for(let j=0;j<FIELD_RES;j++){for(let i=0;i<FIELD_RES;i++){const a=Math.sin(j/5);bloodField[idx(i,j)*2]=a;bloodField[idx(i,j)*2+1]=1;lymphField[idx(i,j)*2]=a*0.5;lymphField[idx(i,j)*2+1]=0.5;}}}
initFields();

class Entity{
  constructor(x,y,radius,mass){this.x=x;this.y=y;this.vx=0;this.vy=0;this.radius=radius;this.mass=mass;this.life=Infinity;}
  force(fx,fy,dt){this.vx+=fx/this.mass*dt;this.vy+=fy/this.mass*dt;}
  integrate(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;}
  bounce(){const r=this.radius;if(this.x-r<0){this.x=r;this.vx=-this.vx*0.9;damageWall('left');}if(this.x+r>WORLD_SIZE){this.x=WORLD_SIZE-r;this.vx=-this.vx*0.9;damageWall('right');}if(this.y-r<0){this.y=r;this.vy=-this.vy*0.9;damageWall('top');}if(this.y+r>WORLD_SIZE){this.y=WORLD_SIZE-r;this.vy=-this.vy*0.9;damageWall('bottom');}}
  step(dt){}
  draw(){}}

// FEATURE: RBCs follow blood flow passively
class RBC extends Entity{
  constructor(){super(Math.random()*WORLD_SIZE,Math.random()*WORLD_SIZE,12,1);}
  step(dt){const [fx,fy]=sampleVec(bloodField,this.x,this.y);this.force(fx*2,fy*2,dt);this.force((Math.random()-0.5)*10,(Math.random()-0.5)*10,dt);this.integrate(dt);this.bounce();}
  draw(){ctx.fillStyle='red';ctx.beginPath();ctx.arc(this.x*scale,this.y*scale,this.radius*scale/10,0,Math.PI*2);ctx.fill();}}

// FEATURE: Pathogens drift with flow and replicate over time
class Pathogen extends Entity{
  constructor(){super(Math.random()*WORLD_SIZE,Math.random()*WORLD_SIZE,12,0.8);this.health=3;this.repTimer=6+Math.random()*4;this.hue=Math.random()*360;}
  step(dt){const [fx,fy]=sampleVec(bloodField,this.x,this.y);this.force(fx,fy,dt);this.force((Math.random()-0.5)*8,(Math.random()-0.5)*8,dt);this.integrate(dt);this.bounce();this.repTimer-=dt;if(this.repTimer<=0){this.repTimer=6+Math.random()*4;const n=2+Math.floor(Math.random()*4);for(let i=0;i<n;i++){const child=new Pathogen();child.x=this.x;child.y=this.y;child.hue=this.hue+(Math.random()-0.5)*20;state.pathogens.push(child);}}}
  draw(){ctx.fillStyle=`hsl(${this.hue},60%,50%)`;ctx.beginPath();ctx.arc(this.x*scale,this.y*scale,this.radius*scale/10,0,Math.PI*2);ctx.fill();ctx.fillStyle='black';ctx.fillRect(this.x*scale-6,this.y*scale-10,12,3);ctx.fillStyle='lime';ctx.fillRect(this.x*scale-6,this.y*scale-10,12*(this.health/3),3);}}

// FEATURE: Neutrophils chase pathogens and can self-destruct
class Neutrophil extends Entity{
  constructor(){super(Math.random()*WORLD_SIZE,Math.random()*WORLD_SIZE,15,1.4);this.explode=null;}
  step(dt){const [fxf,fyf]=sampleVec(bloodField,this.x,this.y);let fx=fxf*0.5,fy=fyf*0.5;const [cx,cy]=gradChem(this.x,this.y);fx+=cx*100;fy+=cy*100;this.force(fx,fy,dt);this.force((Math.random()-0.5)*10,(Math.random()-0.5)*10,dt);const target=nearestEntity(this,state.pathogens);if(target&&distance(this,target)<25&&!this.explode){this.explode=0.3;}if(this.explode!==null){this.explode-=dt;if(this.explode<=0){for(const p of state.pathogens){if(distance(this,p)<25){p.health=0;}}particleBurst(this.x,this.y,'blue');this.life=0;}}this.integrate(dt);this.bounce();}
  draw(){ctx.fillStyle='blue';ctx.beginPath();ctx.arc(this.x*scale,this.y*scale,this.radius*scale/10,0,Math.PI*2);ctx.fill();}}

// FEATURE: Macrophages digest pathogens and release cytokines
class Macrophage extends Entity{
  constructor(){super(Math.random()*WORLD_SIZE,Math.random()*WORLD_SIZE,20,2.2);this.digest=0;}
  step(dt){const [fxf,fyf]=sampleVec(bloodField,this.x,this.y);let fx=fxf*0.3,fy=fyf*0.3;const [cx,cy]=gradChem(this.x,this.y);fx+=cx*60;fy+=cy*60;this.force(fx,fy,dt);if(this.digest>0){this.digest-=dt;this.vx*=0.2;this.vy*=0.2;}this.force((Math.random()-0.5)*8,(Math.random()-0.5)*8,dt);for(const p of state.pathogens){if(distance(this,p)<this.radius+p.radius){p.health=0;this.digest=4;chemDeposit(this.x,this.y,1);}}
    this.integrate(dt);this.bounce();}
  draw(){ctx.fillStyle='green';ctx.beginPath();ctx.arc(this.x*scale,this.y*scale,this.radius*scale/10,0,Math.PI*2);ctx.fill();}}

// FEATURE: Cytotoxic T-cells hunt tagged pathogens
class TCell extends Entity{
  constructor(){super(Math.random()*WORLD_SIZE,Math.random()*WORLD_SIZE,13,1.2);}
  step(dt){const [fxf,fyf]=sampleVec(bloodField,this.x,this.y);let fx=fxf*0.4,fy=fyf*0.4;const target=nearestTagged(this);if(target){const a=Math.atan2(target.y-this.y,target.x-this.x);fx+=Math.cos(a)*80;fy+=Math.sin(a)*80;}else{const [cx,cy]=gradChem(this.x,this.y);fx+=cx*80;fy+=cy*80;}this.force(fx,fy,dt);this.force((Math.random()-0.5)*8,(Math.random()-0.5)*8,dt);for(const p of state.pathogens){if(p.flagged&&distance(this,p)<this.radius+p.radius){p.health=0;}}this.integrate(dt);this.bounce();}
  draw(){ctx.fillStyle='purple';ctx.beginPath();ctx.arc(this.x*scale,this.y*scale,this.radius*scale/10,0,Math.PI*2);ctx.fill();}}

// FEATURE: B-cells create antibodies over time
class BCell extends Entity{
  constructor(){super(Math.random()*WORLD_SIZE,Math.random()*WORLD_SIZE,13,1.1);this.cool=0;}
  step(dt){const [fxf,fyf]=sampleVec(bloodField,this.x,this.y);let fx=fxf*0.4,fy=fyf*0.4;const [cx,cy]=gradChem(this.x,this.y);fx+=cx*50;fy+=cy*50;this.force(fx,fy,dt);this.force((Math.random()-0.5)*8,(Math.random()-0.5)*8,dt);this.cool-=dt;if(this.cool<=0){const ab=new Antibody(this.x,this.y);state.antibodies.push(ab);this.cool=4;}this.integrate(dt);this.bounce();}
  draw(){ctx.fillStyle='cyan';ctx.beginPath();ctx.arc(this.x*scale,this.y*scale,this.radius*scale/10,0,Math.PI*2);ctx.fill();}}

// FEATURE: Antibodies tag pathogens for destruction
class Antibody extends Entity{
  constructor(x,y){super(x,y,5,0.5);this.life=10;}
  step(dt){const target=nearestEntity(this,state.pathogens);if(target){const a=Math.atan2(target.y-this.y,target.x-this.x);this.force(Math.cos(a)*50,Math.sin(a)*50,dt);}this.force((Math.random()-0.5)*5,(Math.random()-0.5)*5,dt);this.integrate(dt);this.life-=dt;if(target&&distance(this,target)<target.radius+this.radius){target.flagged=true;this.life=0;}}
  draw(){ctx.fillStyle='orange';ctx.beginPath();ctx.arc(this.x*scale,this.y*scale,this.radius*scale/10,0,Math.PI*2);ctx.fill();}}

// FEATURE: Particles visualize effects like bursts or explosions
class Particle{constructor(x,y,color){this.x=x;this.y=y;this.vx=(Math.random()-0.5)*20;this.vy=(Math.random()-0.5)*20;this.life=2;color&&(this.color=color);}draw(){ctx.fillStyle=this.color;ctx.fillRect(this.x*scale,this.y*scale,2,2);}step(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;this.life-=dt;}}

function particleBurst(x,y,color){for(let i=0;i<10;i++)state.particles.push(new Particle(x,y,color));}

function chemDeposit(x,y,amt){const fx=Math.floor(x/CELL_SIZE);const fy=Math.floor(y/CELL_SIZE);const index=idx(Math.min(fx,FIELD_RES-1),Math.min(fy,FIELD_RES-1));chemField[index]+=amt;}

function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function nearestEntity(ent,list){let best=null;let bestd=Infinity;for(const o of list){const d=distance(ent,o);if(d<bestd){bestd=d;best=o;}}return best;}
function nearestTagged(t){let best=null;let bestd=Infinity;for(const p of state.pathogens){if(p.flagged){const d=distance(t,p);if(d<bestd){bestd=d;best=p;}}}return best;}

// FEATURE: Central state tracks all cells, walls and memory
const state={running:false,lastTime:0,rbcs:[],pathogens:[],neutrophils:[],macrophages:[],tcells:[],bcells:[],antibodies:[],particles:[],walls:[{side:'top',hp:100},{side:'bottom',hp:100},{side:'left',hp:100},{side:'right',hp:100}],record:[],speed:1,memory:false};

// FEATURE: Walls can be damaged and repaired
function damageWall(side){const wall=state.walls.find(w=>w.side===side);if(!wall)return;wall.hp-=1;chemDeposit(WORLD_SIZE/2,WORLD_SIZE/2,2);if(wall.hp<=0){wall.hp=0;}}

// FEATURE: Visual feedback for tissue walls
function drawWalls(){ctx.strokeStyle='gray';ctx.lineWidth=5*scale;ctx.strokeRect(0,0,width,height);}

// FEATURE: Generic update loop for entity arrays
function updateEntities(arr,dt){for(let i=arr.length-1;i>=0;i--){arr[i].step(dt);arr[i].life<=0&&arr.splice(i,1);} }

// FEATURE: Core simulation step updates all entities and checks memory cells
function gameStep(dt){state.record.push({t:state.lastTime,path:state.pathogens.length});updateEntities(state.rbcs,dt);updateEntities(state.pathogens,dt);updateEntities(state.neutrophils,dt);updateEntities(state.macrophages,dt);updateEntities(state.tcells,dt);updateEntities(state.bcells,dt);updateEntities(state.antibodies,dt);updateEntities(state.particles,dt);for(const p of state.pathogens){if(p.health<=0){p.flagged=true;particleBurst(p.x,p.y,'orange');state.pathogens.splice(state.pathogens.indexOf(p),1);}}
  if(state.pathogens.length===0&&state.bcells.length>0&&!state.memory){state.memory=true;}}

// FEATURE: Rendering routine draws all cells and updates stats
function draw(){ctx.clearRect(0,0,width,height);drawWalls();for(const a of state.rbcs)a.draw();for(const a of state.pathogens)a.draw();for(const a of state.neutrophils)a.draw();for(const a of state.macrophages)a.draw();for(const a of state.tcells)a.draw();for(const a of state.bcells)a.draw();for(const a of state.antibodies)a.draw();for(const a of state.particles)a.draw();updateStats();}

// FEATURE: Main loop honors simulation speed and pauses
function loop(time){if(!state.running){state.lastTime=time;return;}const dt=(time-state.lastTime)/1000*state.speed;state.lastTime=time;gameStep(dt);draw();requestAnimationFrame(loop);}

// FEATURE: Initial population of cells
function init(){scale=canvas.width/WORLD_SIZE;for(let i=0;i<40;i++)state.rbcs.push(new RBC());for(let i=0;i<2;i++)state.neutrophils.push(new Neutrophil());for(let i=0;i<1;i++)state.macrophages.push(new Macrophage());for(let i=0;i<1;i++)state.tcells.push(new TCell());for(let i=0;i<1;i++)state.bcells.push(new BCell());draw();}

init();

// controls
function play(){if(!state.running){state.running=true;requestAnimationFrame(loop);}}
function pause(){state.running=false;}
function stepFrame(){if(!state.running){gameStep(1/60);draw();}}

// FEATURE: Spawning helper to create entities at coordinates
function spawnType(type,x,y){let obj=null;switch(type){case 'Pathogen':obj=new Pathogen();state.pathogens.push(obj);break;case 'Neutrophil':obj=new Neutrophil();state.neutrophils.push(obj);break;case 'Macrophage':obj=new Macrophage();state.macrophages.push(obj);break;case 'TCell':obj=new TCell();state.tcells.push(obj);break;case 'BCell':obj=new BCell();state.bcells.push(obj);break;}if(obj){obj.x=x;obj.y=y;}}

// FEATURE: Drag and drop spawn from palette to canvas
document.querySelectorAll('.spawnItem').forEach(it=>{
  it.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',it.dataset.type);});
});
canvas.addEventListener('dragover',e=>e.preventDefault());
canvas.addEventListener('drop',e=>{e.preventDefault();const type=e.dataTransfer.getData('text/plain');const rect=canvas.getBoundingClientRect();const x=(e.clientX-rect.left)/scale;const y=(e.clientY-rect.top)/scale;spawnType(type,x,y);});

document.getElementById('playBtn').onclick=()=>{state.running?pause():play();};
document.getElementById('stepBtn').onclick=stepFrame;
document.getElementById('speedSelect').onchange=e=>{state.speed=parseFloat(e.target.value);};
document.getElementById('sizeSlider').oninput=e=>{const s=parseInt(e.target.value);canvas.width=s;canvas.height=s*0.75;width=s;height=s*0.75;scale=width/WORLD_SIZE;draw();};

document.getElementById('exportBtn').onclick=exportData;

// FEATURE: Display live counts for each cell type
function updateStats(){const charts=document.getElementById('charts');charts.innerHTML=`RBC:${state.rbcs.length}<br>Path:${state.pathogens.length}<br>N:${state.neutrophils.length}<br>M:${state.macrophages.length}<br>T:${state.tcells.length}<br>B:${state.bcells.length}<br>Ab:${state.antibodies.length}`;}

// FEATURE: Tooltip on hover shows cell data
canvas.addEventListener('pointermove',e=>{
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/scale; const y=(e.clientY-rect.top)/scale;
  let found=null;
  const all=[...state.rbcs,...state.pathogens,...state.neutrophils,...state.macrophages,...state.tcells,...state.bcells,...state.antibodies];
  for(const obj of all){ if(distance({x,y},obj)<obj.radius){ found=obj; break; } }
  const tip=document.getElementById('tooltip');
  if(found){
    tip.classList.remove('hidden');
    tip.style.left=e.clientX+10+'px';
    tip.style.top=e.clientY+10+'px';
    let info=found.constructor.name;
    if(found.health!==undefined) info+=` HP:${found.health}`;
    if(found.life!==undefined && found.life!==Infinity) info+=` life:${found.life.toFixed(1)}`;
    tip.textContent=info;
  } else {
    tip.classList.add('hidden');
  }
});

// FEATURE: Keyboard shortcuts for play/pause and step
window.addEventListener('keydown',e=>{
  if(e.code==='Space'){e.preventDefault();state.running?pause():play();}
  if(e.code==='ArrowRight') stepFrame();
});

// FEATURE: Export run statistics as CSV
function exportData(){
  let csv='time,pathogen\n';
  state.record.forEach(r=>{csv+=`${r.t},${r.path}\n`;});
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='simulation.csv';
  a.click();
}
