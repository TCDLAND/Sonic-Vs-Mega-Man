import { game, ctx } from './state.js';
import { combatNow } from './combat-clock.js';
import { dealDamage } from './combat-system.js';
import { emitWind } from './wind-effects.js';
import { HIGHWAY_WALLS } from './wall-system.js';

const pawnSheet=new Image(); pawnSheet.src='assets/images/eggman-supports/egg-pawn.png';
const buzzerSheet=new Image(); buzzerSheet.src='assets/images/eggman-supports/buzzer.png';
const supportArt={};
for(const [key,file] of Object.entries({idle:'pawn-idle',run:'pawn-run',shot:'pawn-shot',gun:'pawn-gun',drill:'pawn-drill',blade:'pawn-blade-hit',mine:'pawn-place-mine',grenade:'pawn-grenade',rollingMine:'pawn-rolling-mine',hurt:'pawn-hurt',shotEffect:'pawn-shot-effect',motobug:'motobug-frames',explosion:'badnik-explosion'})){
    supportArt[key]=new Image();supportArt[key].src=`assets/images/eggman-supports/${file}.png`;
}
const [leftWall,rightWall]=HIGHWAY_WALLS;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const center=f=>f.x+f.width/2;
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

const stripSizes={idle:[330,46],run:[454,55],shot:[314,61],gun:[585,73],drill:[605,55],blade:[412,52],mine:[120,45],grenade:[583,51],rollingMine:[163,18],hurt:[213,47],shotEffect:[353,31]};
const strip=(key,count)=>{
    const [width,height]=stripSizes[key],frameWidth=width/count;
    return Array.from({length:count},(_,i)=>[i*frameWidth,0,frameWidth,height]);
};
const pawnIdle=strip('idle',8),pawnRun=strip('run',10),pawnShot=strip('shot',5),pawnGun=strip('gun',10);
const pawnDrill=strip('drill',10),pawnBlade=strip('blade',7),pawnMine=strip('mine',3),pawnGrenade=strip('grenade',13);
const pawnRollingMine=strip('rollingMine',7),pawnHurt=strip('hurt',4),pawnShotEffect=strip('shotEffect',10);
const pawnBubbles=[[14,1288,21,22],[44,1288,21,22],[74,1288,21,22],[105,1288,21,22]];
const pawnExplosion=Array.from({length:12},(_,i)=>[i*47.8,35,47.8,45]);
const bugFrames=[[10,31,42,26],[54,31,42,26],[98,31,42,26],[142,31,42,26],[10,57,42,26],[54,57,42,26],[98,57,42,26],[142,57,42,26]];
const buzzerFrames=Array.from({length:8},(_,i)=>[8+i*36,5,29,36]);
const buzzerBurst=Array.from({length:8},(_,i)=>[5+i*36,85,28,36]);
const effects=[];

function sideOf(fighter){return fighter===game.p1||game.teamFighters?.p1?.includes(fighter)?'p1':'p2';}
function targetOf(owner){return game[sideOf(owner)==='p1'?'p2':'p1'];}
function drawFrame(sheet,frame,x,y,w,h,flip=false,alpha=1){
    if(!sheet.complete||!sheet.naturalWidth||!frame)return false;
    const [sx,sy,sw,sh]=frame;
    ctx.save();ctx.globalAlpha*=alpha;ctx.imageSmoothingEnabled=false;
    if(flip){ctx.translate(x+w,0);ctx.scale(-1,1);ctx.drawImage(sheet,sx,sy,sw,sh,0,y,w,h);}
    else ctx.drawImage(sheet,sx,sy,sw,sh,x,y,w,h);
    ctx.restore();return true;
}
function drawHealth(entity){
    const pct=clamp(entity.health/entity.maxHealth,0,1),x=entity.x-game.cameraX,y=entity.y-10,w=entity.width;
    ctx.fillStyle='#10131b';ctx.fillRect(x-1,y-1,w+2,6);
    ctx.fillStyle=pct>.55?'#68e58c':pct>.25?'#ffd35b':'#ff5757';ctx.fillRect(x,y,w*pct,4);
}
function boom(x,y,scale=1){effects.push({x,y,scale,started:combatNow()});}
function drawEffects(now){
    for(let i=effects.length-1;i>=0;i--){
        const effect=effects[i],age=now-effect.started;
        if(age>=410){effects.splice(i,1);continue;}
        const frame=Math.min(pawnExplosion.length-1,Math.floor(age/52));
        const src=pawnExplosion[frame],size=88*effect.scale;
        drawFrame(supportArt.explosion,src,effect.x-game.cameraX-size/2,effect.y-size/2,size,size*.78,false,1-age/410);
    }
}

class EggPawn {
    constructor(owner){
        this.owner=owner;this.maxHealth=45;this.health=45;this.active=true;
        // En la hoja el Pawn ocupa casi el tamaño de un personaje completo.
        // Mantén ese tamaño en pantalla; el hitbox y la distancia de seguimiento
        // usan estas mismas dimensiones.
        this.width=owner.height*.90;this.height=owner.height*.90;this.scale=1.12;
        this.facing=owner.facingDirection||1;this.x=clamp(owner.x-this.facing*(this.width+14),leftWall.x,rightWall.x-this.width);
        this.floorY=owner.feetY;this.y=this.floorY-this.height;this.vx=0;
        this.state='follow';this.action=null;this.hitAt=-Infinity;this.bubbleUntil=0;this.bubble=0;
        this.orderReadyAt=0;this.lastOrder='';this.hitTargets=new WeakSet();
    }
    bounds(){return {x:this.x+5,y:this.y+5,w:this.width-10,h:this.height-8};}
    takeDamage(damage,attacker){
        if(!this.active||!(damage>0))return false;
        this.health=Math.max(0,this.health-Math.max(1,damage));
        this.hitAt=combatNow();
        if(this.health<=0){
            this.active=false;boom(this.x+this.width/2,this.y+this.height/2,1.25);
            this.owner.eggPawn=null;this.owner.eggPawnReadyAt=combatNow()+9000;
        }
        return true;
    }
    command(order,target){
        const now=combatNow();
        if(!this.active||now<this.orderReadyAt||this.owner.isHitstunned?.())return false;
        this.orderReadyAt=now+2700;this.lastOrder=order;this.action={kind:order,started:now,hit:false,shots:0,target,
            grenade:order==='bomb'&&Math.abs(center(target)-center(this))>260};
        this.bubble=order==='weapon'?0:order==='drill'?1:2;this.bubbleUntil=now+880;
        this.state=order;return true;
    }
    fire(target){
        const now=combatNow(),dir=center(target)>=center(this)?1:-1;
        const shot={owner:this.owner,type:'Egg Pawn shot',damage:4,active:true,
            x:this.x+(dir>0?this.width-4:0),y:this.y+this.height*.42,width:24,height:16,vx:dir*14,vy:0,
            update(){this.x+=this.vx;this.y+=this.vy;this.active=this.x>leftWall.x&&this.x<rightWall.x&&combatNow()-now<950;},
            draw(camera){
                const frame=pawnShotEffect[Math.floor((combatNow()-now)/55)%pawnShotEffect.length];
                drawFrame(supportArt.shotEffect,frame,this.x-camera-7,this.y-5,38,25,dir<0);
            }};
        game.projectiles.push(shot);
    }
    update(target){
        if(!this.active)return;
        const now=combatNow();
        if(!target||target.health<=0||this.owner.health<=0){this.active=false;this.owner.eggPawn=null;return;}
        this.floorY=this.owner.feetY;this.y=this.floorY-this.height;
        if(this.action){
            const a=this.action,age=now-a.started;
            if(a.kind==='weapon'){
                if(age>=330+a.shots*210&&a.shots<3){this.fire(target);a.shots++;}
                if(age>=850)this.action=null;
            }else if(a.kind==='bomb'){
                if(age>=420&&!a.bomb){
                    const dir=Math.sign(center(target)-center(this))||this.facing;
                    a.bomb={x:center(this),y:this.floorY-13,at:now,dir,grenade:a.grenade,vy:a.grenade?-5:0};
                }
                if(a.bomb&&a.bomb.grenade&&age>=420&&age<1120){a.bomb.x+=a.bomb.dir*7;a.bomb.y+=a.bomb.vy;a.bomb.vy+=.32;}
                const bombHit=a.bomb&&(Math.abs(center(target)-a.bomb.x)<target.width/2+22&&Math.abs(target.y+target.height*.65-a.bomb.y)<target.height*.6+30);
                const mineHit=a.bomb&&(!a.bomb.grenade&&(Math.abs(center(target)-a.bomb.x)<target.width/2+22)||a.bomb.x<leftWall.x+12||a.bomb.x>rightWall.x-12);
                if(a.bomb&&(bombHit||mineHit||age>=1260)&&!a.hit){
                    a.hit=true;const point=a.bomb;
                    if(Math.abs(center(target)-point.x)<target.width/2+76&&Math.abs((target.y+target.height*.62)-point.y)<98){
                        const guarded=target.isGuarding;
                        const dealt=dealDamage(target,12,{attacker:this.owner,attackName:'Egg Pawn Bomb',impactX:point.x,element:'fire'});
                        if(dealt>0&&!guarded){target.vx=Math.sign(center(target)-point.x||this.facing)*7;target.vy=-6;target.isGrounded=false;target.wasInAirFromKnockback=true;}
                    }
                    boom(point.x,point.y,1.05);this.action=null;
                }
            }else if(a.kind==='drill'){
                const dir=center(target)>=center(this)?1:-1;this.facing=dir;
                this.x=clamp(this.x+dir*11,leftWall.x,rightWall.x-this.width);
                const touching=Math.abs(center(target)-center(this))<target.width/2+this.width/2&&
                    Math.abs((target.y+target.height*.55)-(this.y+this.height*.55))<target.height*.55+22;
                if(touching&&!a.hit){
                    a.hit=true;const guarded=target.isGuarding;
                    const dealt=dealDamage(target,11,{attacker:this.owner,attackName:'Egg Pawn Drill',impactX:center(this)});
                    if(dealt>0&&!guarded){target.vx=dir*8;target.vy=-5;target.isGrounded=false;target.wasInAirFromKnockback=true;}
                }
                if(age>=570){this.action=null;boom(center(this),this.y+this.height*.56,.7);}
            }
            if(this.action)return;
            this.state='follow';
        }
        if(now-this.hitAt<220)return;
        const followX=clamp(this.owner.x-(this.owner.facingDirection||1)*(this.width+14),leftWall.x,rightWall.x-this.width);
        const dx=followX-this.x;
        this.facing=Math.abs(dx)>6?Math.sign(dx):(this.owner.facingDirection||1);
        this.vx=Math.abs(dx)>19?Math.sign(dx)*Math.min(4.1,Math.abs(dx)*.15):0;
        this.x=clamp(this.x+this.vx,leftWall.x,rightWall.x-this.width);
        this.state=this.vx?'follow':'idle';
        this.floorY=this.owner.feetY;this.y=this.floorY-this.height;
    }
    draw(now){
        if(!this.active)return;
        let sheet=supportArt.idle,list=pawnIdle,frame;
        const hurt=now-this.hitAt<220;
        if(hurt){
            sheet=supportArt.hurt;
            frame=pawnHurt[Math.floor((now-this.hitAt)/55)];
        }
        else if(this.state==='weapon'){
            const age=this.action?now-this.action.started:0;
            sheet=age<320?supportArt.gun:supportArt.shot;list=age<320?pawnGun:pawnShot;
        }else if(this.state==='drill'){
            const age=this.action?now-this.action.started:0;
            sheet=age<230?supportArt.drill:supportArt.blade;
            list=age<230?pawnDrill:pawnBlade;
            frame=list[age<230?Math.floor(age/64)%list.length:Math.floor((age-230)/66)%list.length];
        }
        else if(this.state==='bomb'){
            sheet=this.action?.grenade?supportArt.grenade:supportArt.mine;
            list=this.action?.grenade?pawnGrenade:pawnMine;
        }else if(this.vx){sheet=supportArt.run;list=pawnRun;}
        if(!hurt&&this.state==='weapon'&&this.action){
            const age=now-this.action.started;
            if(age<320)frame=list[Math.floor(age/58)%list.length];
            else{sheet=supportArt.shot;list=pawnShot;frame=list[Math.floor((age-320)/72)%list.length];}
        }else if(!hurt&&this.state==='bomb'&&this.action)frame=list[Math.floor((now-this.action.started)/68)%list.length];
        frame ??= list[Math.floor(now/(this.vx?58:83))%list.length] ?? list[0];
        const [,,sw,sh]=frame, scale=this.height/sh, h=this.height,w=sw*scale;
        const x=this.x-game.cameraX+(this.width-w)/2,y=this.floorY-h;
        drawFrame(sheet,frame,x,y,w,h,this.facing<0);
        drawHealth(this);
        if(now<this.bubbleUntil){const b=pawnBubbles[this.bubble];drawFrame(pawnSheet,b,this.x-game.cameraX+this.width/2-11,this.y-24,22,24);}
        if(this.action?.kind==='bomb'&&this.action.bomb){
            const age=now-this.action.bomb.at,bombFrame=pawnRollingMine[Math.floor(age/70)%pawnRollingMine.length];
            const [,,sw,sh]=bombFrame,scale=1.7;
            drawFrame(supportArt.rollingMine,bombFrame,this.action.bomb.x-game.cameraX-sw*scale/2,this.action.bomb.y-sh*scale/2,sw*scale,sh*scale);
        }
    }
}

class Motobug {
    constructor(owner,target){
        this.owner=owner;this.maxHealth=24;this.health=24;this.active=true;this.width=owner.height*.94;this.height=owner.height*.70;
        this.direction=center(target)>=center(owner)?1:-1;this.x=clamp(center(owner)+this.direction*54,leftWall.x,rightWall.x-this.width);
        this.floorY=owner.feetY;this.y=this.floorY-this.height;this.started=combatNow();this.hitTarget=false;
    }
    bounds(){return {x:this.x+5,y:this.y+5,w:this.width-10,h:this.height-8};}
    end(){if(!this.active)return;this.active=false;boom(this.x+this.width/2,this.y+this.height/2,1.3);this.owner.eggMotobugReadyAt=combatNow()+7600;if(game.eggMotobug===this)game.eggMotobug=null;}
    takeDamage(damage){if(!this.active||!(damage>0))return false;this.health=0;this.end();return true;}
    update(target){
        if(!this.active)return;
        if(!target||target.health<=0||this.owner.health<=0){this.end();return;}
        this.x+=this.direction*13;
        if(this.x<=leftWall.x||this.x+this.width>=rightWall.x){this.end();return;}
        const r=this.bounds(),t={x:target.x,y:target.getCurrentY(),w:target.width,h:target.getCurrentHeight()};
        if(!this.hitTarget&&overlaps(r,t)){
            this.hitTarget=true;
            const guarded=target.isGuarding;
            if(!guarded){
                const damage=dealDamage(target,12,{attacker:this.owner,attackName:'Motobug Ram',impactX:center(this)});
                if(damage>0&&!guarded){target.vx=this.direction*13;target.vy=-9;target.isGrounded=false;target.wasInAirFromKnockback=true;target.knockbackAirTimer=0;}
            }
            emitWind('dust',center(this),this.floorY,this.direction,1.2,.85);
            this.end();
        }
    }
    draw(now){if(!this.active)return;const frame=bugFrames[Math.floor((now-this.started)/85)%bugFrames.length];const [, ,sw,sh]=frame,scale=this.height/sh,w=Math.min(this.width,sw*scale),h=sh*scale;drawFrame(supportArt.motobug,frame,this.x-game.cameraX+(this.width-w)/2,this.y+this.height-h,w,h,this.direction<0);drawHealth(this);}
}

class Buzzer {
    constructor(owner,target){
        this.owner=owner;this.maxHealth=20;this.health=20;this.active=true;this.width=owner.height*.68;this.height=owner.height*.68;
        this.direction=center(target)>=center(owner)?1:-1;this.x=center(owner)-this.width/2;this.y=owner.feetY-145;
        this.started=combatNow();this.hitTarget=false;this.vx=this.direction*7.8;
    }
    bounds(){return {x:this.x+4,y:this.y+4,w:this.width-8,h:this.height-8};}
    end(){if(!this.active)return;this.active=false;boom(center(this),this.y+this.height/2,.95);this.owner.eggBuzzerReadyAt=combatNow()+6200;if(game.eggBuzzer===this)game.eggBuzzer=null;}
    takeDamage(damage){if(!this.active||!(damage>0))return false;this.health=Math.max(0,this.health-damage);if(!this.health)this.end();return true;}
    update(target){
        if(!this.active)return;
        const now=combatNow();
        if(!target||target.health<=0||this.owner.health<=0||now-this.started>2900){this.end();return;}
        const aimX=center(target),aimY=target.getCurrentY()+target.getCurrentHeight()*.45;
        const dx=aimX-center(this),dy=aimY-(this.y+this.height/2);
        this.direction=Math.sign(dx)||this.direction;
        this.x=clamp(this.x+Math.sign(dx)*Math.min(8,Math.abs(dx)*.07),leftWall.x,rightWall.x-this.width);
        this.y=clamp(this.y+Math.sign(dy)*Math.min(5,Math.abs(dy)*.065),24,Math.max(24,this.owner.feetY-205));
        if(Math.abs(dx)<this.width/2+target.width*.38&&Math.abs(dy)<this.height/2+target.height*.35&&!this.hitTarget){
            this.hitTarget=true;
            const guarded=target.isGuarding;
            const damage=dealDamage(target,8,{attacker:this.owner,attackName:'Buzzer Anti-Air',impactX:center(this)});
            if(damage>0&&!guarded){target.vy=-10;target.vx=this.direction*4;target.isGrounded=false;target.wasInAirFromKnockback=true;}
            this.end();
        }
    }
    draw(now){if(!this.active)return;const frames=(now-this.started<190)?buzzerFrames:buzzerBurst;const frame=frames[Math.floor(now/60)%frames.length];const [, ,sw,sh]=frame,scale=this.height/sh,w=Math.min(this.width,sw*scale),h=sh*scale;drawFrame(buzzerSheet,frame,this.x-game.cameraX+(this.width-w)/2,this.y+(this.height-h)/2,w,h,this.direction<0);drawHealth(this);}
}

export function startEggmanSupport(owner,kind,order,target){
    if(!owner||!target||owner.health<=0||!['0','go'].includes(game.countdown?.phase))return false;
    const now=combatNow();
    if(kind==='pawn'){
        if(!owner.eggPawn){if(now<(owner.eggPawnReadyAt||0))return false;owner.eggPawn=new EggPawn(owner);}
        return owner.eggPawn.command(order,target);
    }
    if(kind==='motobug'){
        if(game.eggMotobug||now<(owner.eggMotobugReadyAt||0))return false;
        game.eggMotobug=new Motobug(owner,target);return true;
    }
    if(kind==='buzzer'){
        if(game.eggBuzzer||now<(owner.eggBuzzerReadyAt||0))return false;
        game.eggBuzzer=new Buzzer(owner,target);return true;
    }
    return false;
}

export function updateEggmanSupports(){
    const now=combatNow();
    for(const side of ['p1','p2']){
        const owner=game[side];if(!owner||owner.characterId!=='eggman')continue;
        const target=game[side==='p1'?'p2':'p1'];
        owner.eggPawn?.update(target);
    }
    game.eggMotobug?.update(targetOf(game.eggMotobug.owner));
    game.eggBuzzer?.update(targetOf(game.eggBuzzer.owner));
    for(const support of [...(game.p1?.eggPawn?[game.p1.eggPawn]:[]),...(game.p2?.eggPawn?[game.p2.eggPawn]:[])])if(!support.active)support.owner.eggPawn=null;
    if(game.eggMotobug&&!game.eggMotobug.active)game.eggMotobug=null;
    if(game.eggBuzzer&&!game.eggBuzzer.active)game.eggBuzzer=null;
    for(let i=effects.length-1;i>=0;i--)if(now-effects[i].started>=410)effects.splice(i,1);
}

export function drawEggmanSupports(){
    const now=combatNow();
    game.p1?.eggPawn?.draw(now);game.p2?.eggPawn?.draw(now);
    game.eggMotobug?.draw(now);game.eggBuzzer?.draw(now);drawEffects(now);
}

export function hitEggmanSupport(target,attacker,rect,damage){
    if(!target||!attacker||attacker===target||!(damage>0))return false;
    const ownerSide=sideOf(target),attackerSide=sideOf(attacker);
    if(ownerSide===attackerSide)return false;
    const candidates=[target.eggPawn,game.eggMotobug?.owner===target?game.eggMotobug:null,
        game.eggBuzzer?.owner===target?game.eggBuzzer:null].filter(s=>s?.active);
    for(const support of candidates){if(overlaps(support.bounds(),rect))return support.takeDamage(damage,attacker);}
    return false;
}

export function hitEggmanSupportByProjectile(projectile,target){
    if(!projectile?.active||projectile.collisionDisabled||!target)return false;
    const hit=hitEggmanSupport(target,projectile.owner,{x:projectile.x,y:projectile.y,w:projectile.width,h:projectile.height},projectile.damage);
    if(hit)projectile.active=false;
    return hit;
}

export function resetEggmanSupports(){
    game.eggMotobug=null;game.eggBuzzer=null;effects.length=0;
}
