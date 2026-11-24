import { HIGHWAY_WALLS } from './wall-system.js';
import { MET_SCALE, StoryRobot, storyRobotBodies } from './story-robot.js';
import { ConcreteBlock, Rock } from './rock.js';
import { dealDamage } from './combat-system.js';
import { combatNow } from './combat-clock.js';
import { drawRobotFrame } from './robot-sprites.js';
import { emitWind } from './wind-effects.js';
import { ctx, game } from './state.js';

export const WILY_MASTERS={
  cut:{label:'Cut',integrity:48,defense:1.12,speed:7.1,moves:['cutter','wideCutter','leap','slide']},
  guts:{label:'Guts',integrity:78,defense:.78,speed:4.3,moves:['punch','rock','slam','shoulder']},
  heat:{label:'Heat',integrity:60,defense:.96,speed:5.8,moves:['fire','fireball','pillar','rush']}
};
const order=Object.keys(WILY_MASTERS);
const flight=new Image(), workshop=new Image(), metArt=new Image(), leafArt=new Image(), snakeArt=new Image(), fireArt=new Image();
flight.src='assets/images/story-robots/wily-flight.png';
workshop.src='assets/images/story-robots/wily-repair.png';
metArt.src='assets/images/story-robots/met.png';
leafArt.src='assets/images/shield_leaf.png';
snakeArt.src='assets/images/snakes.png';
fireArt.src='assets/images/Heat_fire.png';

const center=f=>f.x+f.width/2;
const foe=f=>f===game.p1?game.p2:game.p1;
const bound=(n,min,max)=>Math.max(min,Math.min(max,n));
function artFrame(img,index,x,feet,scale,dir) {
  if (!img.naturalWidth) return null;
  const d=84*scale;
  return {img,sx:index*84,sy:0,sw:84,sh:84,dx:x-d/2,dy:feet-d,dw:d,dh:d,flipX:dir<0};
}
const CAPSULE_HEIGHT=380;
const CAPSULE_SCALE=2.1;
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

export class Wily extends StoryRobot {
  constructor(x,y,controls){
    super('cut',x,y,controls);
    this.characterId='wily';
    this.characterName='WILY';
    this.manualRobot=true;
    this.isIntroActive=false;
    this.introDone=true;
    this.unitMax=Object.fromEntries(order.map(id=>[id,WILY_MASTERS[id].integrity]));
    this.units={...this.unitMax};
    this.concretes=[];
    this.capsule={x:bound(center(this),280,2315),dir:1};
    this.setMaster('cut');
  }

  setMaster(id) {
    const profile=WILY_MASTERS[id], feet=this.y+this.height, old=this.robotId;
    const {width,height}=storyRobotBodies[id];
    this.robotId=id;
    this.width=width;this.height=height;this.y=feet-height;
    this.defenseMultiplier=profile.defense;
    this.speed=profile.speed;
    this.jumpForce=id==='cut'?-19:id==='guts'?-11:-15.5;
    this.attackAt=-Infinity;
    this.windup=0;
    this.nextAttack=combatNow()+130;
    this.released=true;
    this.move=null;
    this.contact=false;
    this.chargedTarget=null;
    this.carriedConcrete=null;
    this.dashDirection=0;
    this.isDashing=false;
    this.counterUntil=0;
    this.counterAttack=null;
    this.burningUntil=0;
    this.heat=0;
    this.heatDecayAt=0;
    this.cutJumpPending=false;
    this.doubleJumpUsed=false;
    if(old!==id && this.repairMaster===id) this.repairMaster=null;
  }

  rotateMaster(next=1, forced=false) {
    const now=combatNow();
    if(!forced && (this.isHitstunned()||this.isVulnerable||now<(this.swapReady??0)||now<this.tagLockedUntil ||
        (foe(this)?.grabConnected&&!foe(this).grabThrown&&foe(this).grabTarget===this))) return false;
    const i=order.indexOf(this.robotId);
    for(const step of [1,2]) {
      const id=order[(i+step*next+order.length)%order.length];
      if(this.units[id]<=0)continue;
      this.setMaster(id);
      this.swapReady=now+1150;
      emitWind('dust',center(this),this.y+this.height,this.facingDirection||1,1.3,.65);
      return true;
    }
    return false;
  }

  onDamageTaken(info) {
    const id=this.robotId;
    this.units[id]=Math.max(0,this.units[id]-info.damage);
    if(this.units[id]===0 && !order.some(other=>this.units[other]>0)) this.health=0;
    super.onDamageTaken(info);
  }

  interceptIncomingHit(damage, options) {
    if(super.interceptIncomingHit(damage,options))return true;
    if(options.projectile && this.leafCharges>0) {
      this.leafCharges--;
      return true;
    }
    const now=combatNow();
    if(!(now<this.gutsCounterUntil) || options.projectile || !options.attacker || options.attacker===this || this.robotId!=='cut')return false;
    this.gutsCounterUntil=0;
    this.gutsAssist={at:now,x:center(this)-this.facingDirection*90,dir:options.attacker.x>=this.x?1:-1,hit:false};
    return true;
  }

  commandWily(code,target) {
    const c=this.controls, blue=c.attack==='KeyJ', down=Boolean(this.keys[c.crouch]);
    const now=combatNow();
    if (code===(blue?'KeyQ':'BracketLeft')) {
      this.rotateMaster(down?-1:1);
      return true;
    }
    if (code===(blue?'KeyE':'BracketRight')) {
      if(down) this.toggleRepair();
      else this.callSupport(target,Boolean(this.keys[c.jump]));
      return true;
    }
    if(code===c.jump && this.robotId==='cut' && !this.isGrounded && !this.doubleJumpUsed && !this.isHitstunned()) {
      this.doubleJumpUsed=true;this.cutJumpPending=true;return true;
    }
    const index=[c.attack,c.heavy,c.kickLight,c.kickHeavy].indexOf(code);
    if(index<0)return false;
    if(now<this.tagLockedUntil || this.isHitstunned() || this.isVulnerable)return true;
    if(this.robotId==='cut' && down && code===c.heavy) {
      if(this.units.guts>0 && now>=(this.gutsCounterReady??0)) {
        this.gutsCounterUntil=now+330;
        this.gutsCounterReady=now+4800;
      }
      return true;
    }
    let move=WILY_MASTERS[this.robotId].moves[index];
    if(this.robotId==='heat' && !this.isGrounded && index===3)move='airRush';
    if(this.robotId==='guts' && index===1 && this.concretes.some(b=>b.isPlatform())) {
      this.catchConcrete(now,this);
      if(this.carriedConcrete)return true;
    }
    this.commandMasterMove(move,target.x);
    return true;
  }

  toggleRepair() {
    if(this.wilySupport)return false;
    if(this.repairMaster) { this.repairMaster=null;return true; }
    this.repairMaster=order.filter(id=>id!==this.robotId&&this.units[id]>0&&this.units[id]<WILY_MASTERS[id].integrity)
      .sort((a,b)=>this.units[a]/WILY_MASTERS[a].integrity-this.units[b]/WILY_MASTERS[b].integrity)[0]??null;
    return Boolean(this.repairMaster);
  }

  callSupport(target,beam=false) {
    const now=combatNow();
    if(this.repairMaster || this.wilySupport || now<(this.supportReady??0) || now<this.tagLockedUntil || !target)return false;
    const direction=center(target)>=center(this)?1:-1;
    if(this.leafCharges>0) {
      this.leafCharges=0;
      this.throwLeaves(direction);
    }
    const pool=this.robotId==='heat'?['fire','fire','fire','snake','leaf','met']
      :['concrete','concrete','concrete','snake','leaf','met'];
    const kind=beam?'beam':pool[Math.floor(Math.random()*pool.length)];
    const x=kind==='beam'?center(this)+bound(center(target)-center(this),-275,275):center(this);
    this.wilySupport={at:now,kind,direction,destination:bound(x,300,2295)};
    this.supportReady=now+(beam?8100:6200);
    return true;
  }

  throwLeaves(direction) {
    for(const [dx,dy,vy] of [[0,-34,-2],[18,0,0],[0,34,2]]) {
      this.spawnSupply('leaf',center(this)+dx*direction,this.y+this.height*.48+dy,direction,vy);
    }
  }

  spawnSupply(kind,x,y,direction,vy=0) {
    const owner=this, start=combatNow();
    const color=kind==='fire'?'#ff7849':kind==='snake'||kind==='leaf'?'#73e977':'#ffdb59';
    game.projectiles.push({
      owner,active:true,type:'Wily · '+kind,
      damage:kind==='fire'?9:kind==='leaf'?6:kind==='snake'?8:7,
      element:kind==='fire'?'fire':undefined,x,y,width:27,height:20,vx:direction*(kind==='snake'?7:kind==='leaf'?13:10),vy,
      update(){
        this.x+=this.vx; this.y+=this.vy;
        if(kind==='fire')this.y=Math.min(owner.feetY-20,this.y);
        if(combatNow()-start>1350||this.x<HIGHWAY_WALLS[0].x||this.x>HIGHWAY_WALLS[1].x)this.active=false;
      },
      draw(camera){
        const image=kind==='fire'?fireArt:kind==='leaf'?leafArt:kind==='snake'?snakeArt:null;
        if (image?.naturalWidth) {
          const height=kind==='snake'?image.naturalHeight:32;
          const count=Math.floor(image.naturalWidth/32);
          if (count>0) {
            const frame=Math.floor((combatNow()-start)/70)%Math.min(kind==='leaf'?12:8,count);
            drawRobotFrame(ctx,{img:image,sx:frame*32,sy:0,sw:32,sh:height,
              dx:this.x-10,dy:this.y-13,dw:49,dh:43,flipX:direction<0},camera);
            return;
          }
        }
        ctx.save();ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=7;
        ctx.beginPath();ctx.ellipse(this.x+13-camera,this.y+10,13,kind==='leaf'?4:8,direction*.38,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    });
  }

  updateCapsule(now) {
    const call=this.wilySupport;
    const dir=this===game.p1?1:-1;
    const resting=bound(center(this)-dir*190,280,2315);
    const goal=call?.x??call?.destination??resting;
    this.capsule.x+=bound((goal-this.capsule.x)*.21,-16,16);
    if(call && call.x==null && now-call.at>=(call.kind==='beam'?180:330)) call.x=this.capsule.x;
    this.capsule.dir=call?.direction??dir;
  }

  capsuleFeet(now) { return this.feetY-CAPSULE_HEIGHT+Math.sin(now/220)*5; }

  resolveSupport(call,target,now) {
    const age=now-call.at;
    const strikeX=call.x??this.capsule.x;
    if(!call.sent && age>=330) {
      call.sent=true;
      const {kind,direction}=call;
      const x=strikeX;
      if(kind==='concrete') {
        const block=new ConcreteBlock(this,'build_near');
        block.direction=direction;
        this.concretes.push(block);
      }
      else if(kind==='leaf')this.leafCharges=3;
      else if(kind==='snake')this.spawnSupply(kind,x,this.feetY-20,direction);
      else if(kind==='fire') {
        for(const n of [-52,0,52])this.spawnSupply(kind,x+n,this.capsuleFeet(now)-8,direction,8);
      } else if(kind==='met')this.spawnMet(direction,now,x,this.capsuleFeet(now));
    }
    if(call.kind==='beam'&&!call.hit&&age>=360&&age<570&&target&&Math.abs(center(target)-strikeX)<target.width*.4+34 && target.y+target.height>this.capsuleFeet(now)-12) {
      call.hit=true;
      dealDamage(target,17,{attacker:this,attackName:'Rayo de la cápsula',impactX:strikeX,projectile:true});
      emitWind('stormFx',strikeX,target.y+target.height,call.direction,1.8);
    }
    if(age>=740)this.wilySupport=null;
  }

  spawnMet(direction,now,x=center(this)-direction*225,y=this.feetY) {
    if(!this.wilyMet)this.wilyMet={x:bound(x,240,2340),y,vy:1.5,dir:direction,at:now,next:now+900};
  }

  update(opponentX,self) {
    const now=combatNow(), target=foe(this);
    const dt=bound(now-(this.wilyUpdatedAt??now),0,60)/1000;
    this.wilyUpdatedAt=now;
    if(this.health>0 && this.units[this.robotId]===0) this.rotateMaster(1,true);
    if(this.cutJumpPending) { this.cutJumpPending=false;this.isGrounded=false;this.vy=-15.5; }
    if(this.isGrounded)this.doubleJumpUsed=false;
    super.update(opponentX,self);
    if(this.repairMaster) {
      const id=this.repairMaster, cap=WILY_MASTERS[id].integrity;
      this.units[id]=Math.min(cap,this.units[id]+9*dt);
      if(this.units[id]>=cap)this.repairMaster=null;
      if(target&&now>=(this.repairMetReady??0)) {
        this.spawnMet(center(target)>center(this)?1:-1,now);
        this.repairMetReady=now+6200;
      }
    }
    this.updateCapsule(now);
    if(this.wilySupport)this.resolveSupport(this.wilySupport,target,now);
    for(const block of this.concretes)block.update();
    this.concretes=this.concretes.filter(block=>block.active);
    if(this.wilyMet && target) {
      const met=this.wilyMet, gap=center(target)-met.x;
      if(now-met.at>10200)this.wilyMet=null;
      else if(met.y<this.feetY) {
        met.vy=Math.min(15,met.vy+.65);
        met.y=Math.min(this.feetY,met.y+met.vy);
      } else {
        met.hidden=Math.abs(gap)<(met.hidden?185:120);
        met.dir=Math.sign(gap)||1;
        if(!met.hidden && Math.abs(gap)>320)met.x+=met.dir*2;
        if(!met.hidden&&now>=met.next) { met.next=now+1650;this.spawnSupply('met',met.x,this.feetY-46,met.dir); }
      }
    }
    if(this.gutsAssist) {
      const assist=this.gutsAssist, age=now-assist.at;
      if(age>540)this.gutsAssist=null;
      else if(age>75) {
        assist.x+=assist.dir*14;
        if(!assist.hit&&target&&Math.abs(center(target)-assist.x)<105&&target.y+target.height>this.feetY-110) {
          assist.hit=true;dealDamage(target,13,{attacker:this,attackName:'Estampida de Guts Man',impactX:assist.x});
        }
      }
    }
  }

  cancelWilyMoves() {
    this.wilySupport=null;
    this.gutsAssist=null;
    this.gutsCounterUntil=0;
    this.attackAt=-Infinity;
    this.released=true;
    this.move=null;
    this.chargedTarget=null;
    this.cutJumpPending=false;
  }

  resolveConcreteBody(fighter) { Rock.prototype.resolveConcreteBody.call(this,fighter); }
  handleProjectileVsConcrete(projectile) {return Rock.prototype.handleProjectileVsConcrete.call(this,projectile); }

  draw(opponentX) {
    super.draw(opponentX);
    const now=combatNow();
    for(const block of this.concretes)block.draw(game.cameraX);
    if(this.leafCharges>0) {
      ctx.save();ctx.fillStyle='#84fb79';
      for(let i=0;i<this.leafCharges;i++) {
        const a=now/260+i*2.095;const x=center(this)+Math.cos(a)*72-game.cameraX;
        const y=this.y+this.height*.5+Math.sin(a)*40;
        if(leafArt.naturalWidth) ctx.drawImage(leafArt,Math.floor(now/65+i*3)%12*32,0,32,32,x-22,y-22,44,44);
        else { ctx.beginPath();ctx.ellipse(x,y,10,5,a,0,Math.PI*2);ctx.fill(); }
      }
      ctx.restore();
    }
    if(this.repairMaster) {
      const left=this===game.p1;
      const x=game.cameraX+(left?92:1188);
      const feet=this.feetY-6;
      const id=this.repairMaster;
      const critical=this.units[id]<WILY_MASTERS[id].integrity*.35;
      drawRobotFrame(ctx,this.getMasterRepairFrame(id,critical,x+(left?138:-138),feet,2.65),game.cameraX);
      drawRobotFrame(ctx,artFrame(workshop,Math.floor(now/145)%3,x,feet,2.65,left?1:-1),game.cameraX);
      if(Math.floor(now/90)%8<3) {
        const sparkX=x-game.cameraX+(left?42:-42),sparkY=feet-27;
        ctx.save();ctx.strokeStyle='#ffe2a4';ctx.lineWidth=2;
        for(const offset of [-10,0,10]) {
          ctx.beginPath();ctx.moveTo(sparkX,sparkY);
          ctx.lineTo(sparkX+offset,sparkY-10-Math.abs(offset)*.5);ctx.stroke();
        }
        ctx.restore();
      }
    } else {
      const call=this.wilySupport, age=call?now-call.at:0;
      const x=this.capsule.x;
      const feet=this.capsuleFeet(now);
      const gestures=[5,6,7,7,6,5];
      const frame=call?gestures[Math.min(gestures.length-1,Math.floor(age/120))]:Math.floor(now/153)%6;
      drawRobotFrame(ctx,artFrame(flight,frame,x,feet,CAPSULE_SCALE,this.capsule.dir),game.cameraX);
      if(call?.kind==='beam' && age>=180&&age<570) {
        const beamX=x-game.cameraX;
        ctx.save();ctx.fillStyle=age>=360?'#fff5cf':'#ff9566';
        ctx.shadowColor='#ff704a';ctx.shadowBlur=18;
        const width=age>=360?62:4;
        ctx.fillRect(beamX-width/2,feet-12,width,this.feetY-feet+12);
        ctx.restore();
      }
    }
    const met=this.wilyMet;
    if(metArt.naturalWidth&&met) {
      const cell=120, index=met.hidden?0:met.y<this.feetY?1:now>=met.next-370?3:4+Math.floor(now/95)%4;
      const width=cell*MET_SCALE,height=100*MET_SCALE;
      drawRobotFrame(ctx,{img:metArt,sx:index*cell,sy:0,sw:cell,sh:100,
        dx:met.x-width/2,dy:met.y-height,dw:width,dh:height,flipX:met.dir>0},game.cameraX);
    }
    if(this.gutsAssist) {
      const a=this.gutsAssist;
      this.drawGutsAssist(Math.min(9,Math.floor((now-a.at)/52)),a.x-game.cameraX,this.feetY,a.dir);
    }
  }
}
