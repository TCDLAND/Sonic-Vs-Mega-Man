import { SUPER_COST, SUPER_DURATION } from './config.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { combatNow } from './combat-clock.js';
import { ctx, game } from './state.js';
import { HIGHWAY_WALLS } from './wall-system.js';
import { drawRobotFrame } from './robot-sprites.js';
import { opaqueInRect } from './pixel-collision.js';
import { beginRobotMove, hitRobotMove, updateRobotMove } from './robot-combat.js';
import { SILVER_FRAMES } from './silver-frames.js';
import { updatedFrame } from './fighter-update-art.js';

const atlases = ['silver', 'super'].map(name => {
    const image = new Image();
    image.src = 'assets/images/silver/' + name + '.png';
    return image;
});
const emeralds = new Image();
emeralds.src = 'assets/story/sonic/shadow-emeralds.png';
const bound = (x, low, high) => Math.min(high, Math.max(low,x));
const middle = f => f.x + f.width / 2;
const foot = f => f.y + f.height;
const mark = (x,y,w,h) => ({x,y,w,h});

function silverFrame(key, index, x, feet, scale, dir, golden) {
    const form = golden ? 1 : 0;
    const img = atlases[form];
    if (!img.complete || !img.naturalWidth) return null;
    const cells = SILVER_FRAMES[form][key];
    const [sx,sy,sw,sh] = cells[bound(index,0,cells.length-1)];
    const flipX = dir<0;
    const pivot = ({jab:.41,medium:.41,push:.38,grab:.42,cast:.46,air:.46})[key] ?? .5;
    return {img,sx,sy,sw,sh,flipX,dx:x-(flipX?1-pivot:pivot)*sw*scale,dy:feet-sh*scale,dw:sw*scale,dh:sh*scale};
}

export function silverShotKind(shot) {
    if (shot.silverReturned) return null;
    if (shot.type==='bassBullet' || /^buster-(rock|protoman|x|zero|emerl|megaman-zero)-[1-4]$/.test(shot.type)) return 'energy';
    if (['kunai','shuriken','rolling-cutter','silver-stone'].includes(shot.type)) return 'solid';
    return null;
}

function hitRect(f, rect, x) {
    if (f.shieldIntersects?.(rect)) return true;
    if (f.pixelBodyIntersectsRect) return f.pixelBodyIntersectsRect(rect,x);
    const y = f.getCurrentY();
    return rect.x < f.x+f.width && rect.x+rect.w > f.x && rect.y < y+f.getCurrentHeight() && rect.y+rect.h > y;
}

function ring(x,y,r,golden,phase=0) {
    ctx.save();
    ctx.strokeStyle=golden?'#ffe58b':'#75fff2';
    ctx.lineWidth=3;
    ctx.globalAlpha=.52+.28*Math.sin(phase);
    ctx.shadowBlur=12;
    ctx.shadowColor=ctx.strokeStyle;
    ctx.beginPath();
    ctx.ellipse(x-game.cameraX,y,r,r*.73,0,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
}

function drawFieldPortal(x,y,age,closingRemaining=null) {
    if (age<0) return;
    const phase=closingRemaining==null?Math.min(age,150):Math.min(age,closingRemaining);
    if (phase<=0) return;
    const index=age<150?Math.min(3,Math.floor(age/40)):[3,4,5,4][Math.floor(age/65)%4];
    const frame=updatedFrame('silver-guard','impact',index,x,y+62,2.2,1);
    if (frame) drawRobotFrame(ctx,frame,game.cameraX,Math.min(1,phase/65));
}

const specs = {
    jab: {ms:45,active:[2,3],damage:5,range:72,top:100},
    medium: {ms:47,active:[2,3],damage:8,range:82,top:108},
    heavy: {ms:67,active:[2,4],damage:12,range:91,top:115},
    upper: {ms:57,active:[2,3],damage:11,range:92,top:162,launch:-16},
    air: {ms:45,active:[2,5],damage:7,range:82,top:117},
    airHeavy: {ms:49,active:[2,6],damage:12,range:104,top:126,launch:6},
    push:{ms:62,emit:2},
    strongPush:{pose:'push',ms:91,emit:3},
    cast:{ms:61,emit:3},
    shock:{ms:62,emit:4},
    field:{ms:67},
    grab:{ms:60,emit:2},
    orbit:{ms:81,emit:3},
    airDash:{ms:70},
    barrage:{pose:'superPose',ms:83,cinematic:true},
    catastrophe:{pose:'superPose',ms:79,cinematic:true},
    storm:{pose:'superPose',ms:75,cinematic:true}
};
for (const [key,spec] of Object.entries(specs)) {
    Object.assign(spec,{key,pose:spec.pose??key});
    spec.frames=key==='field'?16:SILVER_FRAMES[0][spec.pose].length + (['catastrophe','storm'].includes(key)?4:0);
}
const chains={
    jab:['medium','upper','heavy','grab'],
    medium:['upper','heavy','grab'],
    heavy:['push','strongPush','airDash','barrage'],
    air:['airHeavy']
};

function createShot(owner,key,dir,fromX,fromY,vy=0,final=false) {
    const stone = key==='stone';
    const golden = owner.superSilver;
    const born = combatNow();
    const width=stone?29:final?79:key==='wave'?46:36;
    const height=stone?32:final?110:key==='wave'?74:39;
    game.projectiles.push({
        owner,active:true,x:fromX-width/2,y:fromY-height/2,width,height,
        vx:dir*(stone?13:12),vy,damage:stone?(final?12:golden?7:5):final?14:golden?11:8,
        type:stone?'silver-stone':'silver-wave',projectileForce:final?8:4,
        update() {
            this.x+=this.vx;
            this.y+=this.vy;
            if (stone) this.vy+=.065;
            if (this.x<HIGHWAY_WALLS[0].x-100 || this.x>HIGHWAY_WALLS[1].x+100 || this.y>owner.feetY+40 || combatNow()-born>1700) this.active=false;
        },
        draw(camera) {
            const count=SILVER_FRAMES[golden?1:0][key].length;
            const index=stone?0:Math.min(count-1,Math.floor((combatNow()-born)/43));
            const cell=SILVER_FRAMES[golden?1:0][key][index];
            const scale=Math.min(this.width*1.32/cell[2],this.height/cell[3]);
            drawRobotFrame(ctx,silverFrame(key,index,this.x+this.width/2,this.y+(this.height+cell[3]*scale)/2,scale,dir,golden),camera);
        },
        onHit(target) {
            if (!target.lastGuardImpact?.blocked && !target.lastGuardImpact?.broken) target.vx=dir*(final?17:stone?4:10);
        }
    });
}

export class Silver extends PrototypeFighter {
    constructor(x,y,controls) {
        super(x,y,controls,{name:'SILVER',color:'#b9d8dd',spinProfile:'silver',speed:5.6});
        configureCombatant(this,'silver','SILVER');
        this.maxPower=300;
        this.baseDefense=this.defenseMultiplier;
        this.pose={key:'idle',at:combatNow(),dir:1};
        this.superTapAt=-Infinity;
        this.absorbReadyAt=0;
        this.absorbButtonHeld=false;
        this.absorbClosingAt=0;
        this.absorbRecoveryUntil=0;
        this.grabReadyAt=0;
        this.rocks=[];
        this.caught=[];
        this.aux1=controls.attack==='KeyJ'?'KeyQ':'BracketLeft';
        this.aux2=controls.attack==='KeyJ'?'KeyE':'BracketRight';
    }
    // La barra triple conserva la escala de gasto de los supers existentes.
    addPower(amount) { return super.addPower(amount*2.6); }
    isBusy() { return super.isBusy() || Boolean(this.robotMove || this.transformAt!=null || this.absorbRecoveryUntil>combatNow()); }
    isAttacking() { return super.isAttacking() || Boolean(this.robotMove || this.transformAt!=null); }
    checkDoubleTap(direction,targetX) { if (this.isGrounded && !this.isBusy()) super.checkDoubleTap(direction,targetX); }

    crouchTap() {
        const now=combatNow();
        if (this.hoverUntil>now) this.hoverUntil=0;
        if (now-this.superTapAt>300) { this.superTapAt=now; return; }
        this.superTapAt=-Infinity;
        if (!this.isGrounded || this.isBusy() || this.isVulnerable || this.isIntroActive || this.tagLockedUntil>now) return;
        if (this.superSilver) {
            this.endSuperForm();
            return;
        }
        this.startSuperChange();
    }

    endSuperForm() {
        this.superSilver=false;
        this.superEndsAt=null;
        this.speed=5.6;
        this.dashSpeed=22.4;
        this.defenseMultiplier=this.baseDefense;
    }

    startSuperChange() {
        if (this.superSilver || !this.isGrounded || this.isBusy() || this.isVulnerable ||
            this.isIntroActive || this.tagLockedUntil>combatNow() || !this.spendPower(SUPER_COST)) return false;
        this.transformAt=combatNow();
        this.isCrouching=false;
        this.vx=0;
        return true;
    }

    hover() {
        if (this.hoverUsed || this.isBusy() || this.isVulnerable || this.isIntroActive) return false;
        this.hoverUsed=true;
        this.hoverUntil=combatNow()+(this.superSilver?1850:1260);
        this.isGrounded=false;
        this.vy=-5.5;
        return true;
    }

    startTechnique(key,target,dir,holdField=false) {
        const spec=specs[key], now=combatNow();
        if (!spec || this.isBusy() || this.isVulnerable || this.isIntroActive || this.tagLockedUntil>now ||
            (key==='field' && now<this.absorbReadyAt) || (key==='grab' && now<this.grabReadyAt) ||
            (key==='orbit' && this.rocks.length) ||
            (key==='airDash' && (this.isGrounded ? now<(this.groundDashReadyAt??0) : this.airDashUsed)) ||
            (spec.cinematic && game.mode!=='practice' && now<(this.psychicSpecialReadyAt??0))) return false;
        const psychDamage=this.superSilver && key==='upper' ? 2 : 0;
        const direction=dir || (middle(target)>=middle(this)?1:-1);
        const moveSpec=psychDamage ? {...spec,damage:spec.damage+psychDamage} : spec;
        if (!beginRobotMove(this,moveSpec,direction)) return false;
        if(spec.cinematic) this.psychicSpecialReadyAt=now+5200;
        this.robotMove.target=target;
        this.superTapAt=-Infinity;
        if (key==='field') {
            this.absorbButtonHeld=holdField;
            this.absorbClosingAt=0;
            this.absorbReadyAt=now+1650;
        }
        if (key==='grab') this.grabReadyAt=now+2100;
        if (key==='airDash') {
            if (!this.isGrounded) this.airDashUsed=true;
            else this.groundDashReadyAt=now+720;
        }
        return true;
    }

    command(code,target) {
        const keys=this.keys,c=this.controls,down=keys[c.crouch],air=!this.isGrounded;
        const horizontal=Number(Boolean(keys[c.right]))-Number(Boolean(keys[c.left]));
        if (code===c.crouch) { this.crouchTap(); return; }
        if (code===c.spinKey) {
            if (!down) this.hover();
            return;
        }
        let key;
        if (code===c.attack) key=air?'air':down?'cast':'jab';
        else if (code===c.heavy) key=air?'airHeavy':down?(this.superSilver?'storm':'catastrophe'):'medium';
        else if (code===c.kickLight) {
            const move=this.robotMove;
            if (move?.spec.key==='upper' && move.hit && !move.jumped) {
                move.jumped=true;
                this.robotMove=null;
                this.isGrounded=false;
                this.vy=-13;
                this.startTechnique('air',target);
                return;
            }
            key=air?'airHeavy':down?'orbit':'upper';
        }
        else if (code===c.kickHeavy) key=air?(horizontal?'airDash':'airHeavy'):down?'barrage':horizontal?'airDash':'heavy';
        else if (code===this.aux1) {
            if (this.robotMove?.spec.key==='field') { this.absorbButtonHeld=true; this.absorbClosingAt=0; return; }
            key=down?'grab':'field';
        }
        else if (code===this.aux2) key=down?'shock':horizontal?'strongPush':'push';
        else if (code===c.jump && this.robotMove?.spec.key==='upper' && this.robotMove.hit) {
            this.robotMove=null;
            this.isGrounded=false;
            this.vy=-13;
            return;
        }
        const move=this.robotMove;
        if (move && chains[move.spec.key]?.includes(key)) {
            const age=combatNow()-move.started;
            if (age>=move.spec.ms*2) move.next={key,dir:key==='airDash'?horizontal:0};
            return;
        }
        this.startTechnique(key,target,key==='airDash'?horizontal:0,key==='field' && code===this.aux1);
    }

    fieldIntersects(shot, assist) {
        const x=assist?.x??(middle(this)+(this.robotMove?.direction??this.facingDirection)*78);
        const y=assist?.y??foot(this);
        return shot.x+shot.width > x-66 && shot.x < x+66 && shot.y+shot.height > y-128 && shot.y<y-14;
    }

    interceptSilverShot(shot, assist=null) {
        if (!shot.active || this.shadowFrozenBy || this.health<=0 || !this.fieldIntersects(shot,assist)) return false;
        const move=assist??this.robotMove;
        if (!assist && move?.spec.key!=='field') return false;
        const now=combatNow();
        const age=now-move.started;
        const heldField=!assist && (this.absorbButtonHeld || this.absorbClosingAt>0);
        if (age<(assist?180:100) || (heldField && !this.absorbButtonHeld && now>this.absorbClosingAt) ||
            (!assist && !heldField && age>950) || (assist && age>550)) return false;
        const kind=silverShotKind(shot);
        if (!kind || (assist && kind!=='energy')) return false;
        shot.active=false;
        if (kind==='energy') {
            const heal=Math.max(0,Math.min(this.maxHealth-this.health,shot.damage*.20));
            this.health+=heal;
            if (heal>0) this.addPower(heal*.24);
        } else {
            if (this.caught.length>=(this.superSilver?3:2)) { shot.active=true;return false; }
            this.caught.push({shot,at:combatNow(),x:shot.x,y:shot.y});
        }
        this.sparkAt=combatNow();
        return true;
    }

    releaseCaught() {
        for (const item of this.caught) {
            const original=item.shot;
            const target=original.owner;
            if (!target) continue;
            const dir=target.x>=this.x?1:-1;
            const recorded=original.getPixelBodyFrame?.();
            const sprite=recorded?{...recorded}:null;
            const born=combatNow();
            game.projectiles.push({
                owner:this,active:true, type:original.type, silverReturned:true,
                x:item.x,y:item.y,width:original.width,height:original.height,
                damage:original.damage*(this.superSilver?1.12:1),projectileForce:original.projectileForce,
                vx:dir*14,vy:0,
                update() {
                    this.x+=this.vx;
                    if (combatNow()-born>1700 || this.x<HIGHWAY_WALLS[0].x-170 || this.x>HIGHWAY_WALLS[1].x+170) this.active=false;
                },
                draw(camera) {
                    if (sprite) {
                        drawRobotFrame(ctx,{...sprite,dx:this.x,dy:this.y,flipX:dir<0},camera);
                    } else {
                        original.x=this.x;original.y=this.y;original.direction=dir;
                        original.draw(camera);
                    }
                }
            });
        }
        this.caught=[];
    }

    releaseAbsorb(code) {
        if (code!==this.aux1 || !this.absorbButtonHeld || this.robotMove?.spec.key!=='field') return;
        this.absorbButtonHeld=false;
        this.absorbClosingAt=combatNow()+280;
    }

    grip(move,target) {
        if (target.tagLockedUntil>combatNow() || target.isGuarding || target.shieldRaised || target.minerPhase==='under' || target.shadowFrozenBy ||
            target.silverGrabImmuneUntil>combatNow() || target.health<=0) return false;
        this.grabTarget=target;
        this.grabConnected=true;
        this.grabThrown=false;
        move.capturedAt=combatNow();
        return true;
    }

    letGo(launch=false) {
        const target=this.grabTarget;
        if (target) {
            target.silverGrabImmuneUntil=combatNow()+1500;
            if (launch) {
                const move=this.robotMove;
                const dir=move.throwDir||move.direction;
                const floorSlam=move.slam || move.spec.cinematic;
                target.vx=dir*(floorSlam?5:16);
                target.vy=floorSlam?14:-10;
                target.wasInAirFromKnockback=true;
                target.knockbackAirTimer=0;
            } else target.vy=1;
            target.isGrounded=false;
        }
        this.grabConnected=false;
        this.grabTarget=null;
        this.grabThrown=launch;
    }

    cancelSilverMoves() {
        this.letGo();
        this.robotMove=null;
        this.absorbButtonHeld=false;
        this.absorbClosingAt=0;
        this.hoverUntil=0;
        this.transformAt=null;
        this.caught=[];
        this.rocks=[];
    }
    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (!this.lastGuardImpact?.blocked) {
            this.cancelSilverMoves();
            this.hurtAt=combatNow();
        }
    }

    shootRocks(move,count) {
        for (let i=0;i<count;i++) {
            const rock=this.rocks.shift();
            const x=rock?.x??middle(this)+move.direction*36;
            const y=rock?.y??this.y+this.height*.49;
            createShot(this,'stone',move.direction,x,y,-1.6+i*.85);
        }
    }

    performMove(move,now) {
        const {spec,target,direction:dir}=move;
        const key=spec.key;
        const age=now-move.started;
        const i=Math.floor(age/spec.ms);
        if (key==='airDash' && i>=1) {
            if (!this.isGrounded) this.vy=-this.gravity;
        }
        if (key==='field') {
            this.caught.forEach((item,index)=>{
                item.x=middle(this)+dir*(52+index*24)-item.shot.width/2;
                item.y=this.y+this.height*(.26+index*.16)-item.shot.height/2;
            });
        }
        if (key==='barrage') {
            if (i>=2 && !move.formed) {
                move.formed=true;
                this.makeRocks(this.superSilver?5:4);
            }
            if (i>=4 && i<=8 && move.volley!==i) {
                move.volley=i;
                if (i===8) {
                    if (this.rocks.length) this.shootRocks(move,1);
                    createShot(this,'wave',dir,middle(this)+dir*45,this.y+this.height*.48,0,true);
                } else this.shootRocks(move,1);
            }
        }
        if (i>=spec.emit && !move.emitted) {
            move.emitted=true;
            if (key==='cast') {
                if (this.rocks.length) this.shootRocks(move,this.rocks.length);
                else this.shootRocks(move,this.superSilver?3:2);
            } else if (key==='orbit') this.makeRocks(this.superSilver?4:3);
            else if (key==='push' || key==='strongPush') createShot(this,'wave',dir,middle(this)+dir*38,this.y+this.height*.5,0,key==='strongPush');
        }
        if (!this.grabConnected) return;
        if (!target || target.health<=0 || (target!==game.p1&&target!==game.p2)) {this.letGo();return;}
        const hold=now-move.capturedAt;
        const captureSuper=key==='catastrophe'||key==='storm';
        const horizontal=Number(Boolean(this.keys[this.controls.right]))-Number(Boolean(this.keys[this.controls.left]));
        if (horizontal && !captureSuper) move.throwDir=horizontal;
        if (this.keys[this.controls.crouch] && !captureSuper && age>280) move.slam=true;
        target.x=bound(middle(this)+dir*(captureSuper?135:84)-target.width/2,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-target.width);
        target.y=Math.min(target.feetY-target.height-40,this.y-24)-Math.min(captureSuper?95:39,hold*.32);
        target.isGrounded=false;
        target.vx=target.vy=0;
        if (captureSuper && hold>=140 && hold<440) {
            const count=Math.floor((hold-140)/93);
            if (count!==move.lastPulse) {
                move.lastPulse=count;
                move.pulseAt=now;
                dealDamage(target,key==='storm'?6:5,{attacker:this,attackName:spec.key,ignoreGuard:true});
            }
        }
        if (hold>=(captureSuper?535:230)) {
            dealDamage(target,captureSuper?(key==='storm'?23:18):this.superSilver?14:12,
                {attacker:this,attackName:spec.key,ignoreGuard:true});
            if (captureSuper) this.slamEffect={x:middle(target),y:target.feetY,at:now,golden:this.superSilver};
            this.letGo(true);
        }
    }

    makeRocks(count) {
        const now=combatNow();
        this.rocks=Array.from({length:count},(_,i)=>({index:i,x:middle(this),y:this.y,until:now+3300}));
    }

    update(opponentX,self) {
        const now=combatNow(), grounded=this.isGrounded;
        if (this.robotMove?.spec.key==='field' && !this.absorbButtonHeld && this.absorbClosingAt && now>=this.absorbClosingAt) {
            this.robotMove=null;
            this.absorbClosingAt=0;
            this.absorbRecoveryUntil=now+360;
            this.absorbReadyAt=Math.max(this.absorbReadyAt,now+1300);
            if (this.caught.length) this.releaseCaught();
        }
        const move=this.robotMove;
        const transforming=this.transformAt!=null;
        if (transforming && !this.superSilver && now-this.transformAt>=680) {
            this.superEndsAt=now+SUPER_DURATION;
            this.superSilver=true;
            this.speed=7;
            this.dashSpeed=27;
            this.defenseMultiplier=this.baseDefense*.94;
        }
        if (transforming && now-this.transformAt>=1100) this.transformAt=null;
        if (move) {
            this.performMove(move,now);
            updateRobotMove(this);
            if (!this.robotMove) {
                this.letGo();
                if (this.caught.length) this.releaseCaught();
                if (move.next) this.startTechnique(move.next.key,move.target,move.next.dir);
            }
        }
        const hovering=this.hoverUntil>now && !this.isVulnerable;
        if (hovering) {
            const elapsed=(this.superSilver?1850:1260)-(this.hoverUntil-now);
            const targetVy=elapsed<220 && this.y>120 ? -4.2 : Math.sin(now/115)*.55;
            this.vy=targetVy-this.gravity;
        }
        const keys=this.keys;
        if (this.transformAt!=null) this.keys={};
        try { super.update(opponentX,self); }
        finally { this.keys=keys; }
        if (move?.spec.key==='airDash' && this.robotMove===move) {
            const step=(this.superSilver?19:15)*move.direction;
            this.x=bound(this.x+step,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-this.width);
        }
        if (!grounded && this.isGrounded) this.landAt=now;
        if (this.isGrounded && !hovering) {this.hoverUsed=false;this.airDashUsed=false;}
        this.rocks=this.rocks.filter(r=>r.until>now);
        for (const rock of this.rocks) {
            const a=now/330+rock.index*1.56;
            rock.x=middle(this)+Math.cos(a)*77;
            rock.y=foot(this)-96+Math.sin(a)*36;
        }
        let key='idle';
        const moving=Math.abs(this.vx)>.2;
        const dir=moving&&!this.isGuarding?Math.sign(this.vx):opponentX>=this.x?1:-1;
        if (this.wasInAirFromKnockback) key='knock';
        else if (now-(this.hurtAt??-Infinity)<170) key='hurt';
        else if (this.isVulnerable) key='getup';
        else if (this.isSpinDashActive) key='spin';
        else if (this.isSpinning) key='spinCharge';
        else if (this.isGuarding) key='guard';
        else if (this.isCrouching) key='crouch';
        else if (hovering) key='hover';
        else if (this.isDashing) key='dash';
        else if (!this.isGrounded) key=this.vy<0?'jump':'fall';
        else if (now-(this.landAt??-Infinity)<130) key='land';
        else if (moving) key=this.walkReverse?'walk':'run';
        else if (['run','dash'].includes(this.pose.key)||(this.pose.key==='brake'&&now-this.pose.at<156)) key='brake';
        if (key!==this.pose.key||dir!==this.pose.dir) this.pose={key,at:now,dir};
    }

    tryHit(target) {
        const move=this.robotMove;
        if (!move || this.shadowFrozenBy || this.health<=0 || target.health<=0 || this.isHitstunned()) return;
        hitRobotMove(this,target);
        const key=move.spec.key;
        const i=Math.floor((combatNow()-move.started)/move.spec.ms);
        if (key==='shock' && i>=4 && i<=6 && !move.hit) {
            const reach=this.superSilver?132:110;
            if (hitRect(target,mark(middle(this)-reach,foot(this)-161,reach*2,158),middle(this))) {
                move.hit=true;
                dealDamage(target,this.superSilver?14:12,{attacker:this,attackName:'Psychic Shockwave',impactX:middle(this)});
                if (!target.lastGuardImpact?.blocked) target.vx=Math.sign(middle(target)-middle(this))*11;
            }
        }
        if (!['grab','catastrophe','storm'].includes(key) || move.capturedAt!=null || move.target!==target) return;
        const grab=key==='grab';
        const reach=grab?106:key==='storm'?320:295;
        if (i<(grab?2:4) || i>(grab?3:5)) return;
        const hit=hitRect(target,mark(move.direction>0?middle(this):middle(this)-reach,foot(this)-(grab?122:187),reach,grab?122:187),middle(this));
        if (hit) this.grip(move,target);
    }

    getPixelBodyFrame() {
        const now=combatNow(),move=this.robotMove;
        let {key,at,dir}=this.pose;
        let ms=key==='idle'?117:key==='run'?57:62;
        let feet=foot(this);
        if (move) {key=move.spec.pose;at=move.started;ms=move.spec.ms;dir=move.direction;}
        if (this.isIntroActive) {key='intro';at=now-this.introFrame*ms;}
        if (this.transformAt!=null) {
            const t=bound((now-this.transformAt)/1100,0,1);
            key='superPose';at=this.transformAt;ms=100;
            feet-=Math.sin(t*Math.PI)*37;
        }
        const count=SILVER_FRAMES[this.superSilver?1:0][key].length;
        const i=Math.floor((now-at)/ms);
        let index=!move&&['idle','walk','run','dash','spin','spinCharge'].includes(key)?i%count:i;
        if (move?.spec.key==='field' && this.absorbButtonHeld) index=i%count;
        if (key==='guard') {
            const blocked=this.lastGuardImpact?.blocked && now-this.lastGuardImpact.at<175;
            if (!blocked) {
                const run=SILVER_FRAMES[this.superSilver?1:0].run;
                return silverFrame('run',run.length-1-Math.floor((now-at)/84)%run.length,middle(this),feet,this.height/44,dir,this.superSilver);
            }
            const brace=now-this.lastGuardImpact.at<85 ? 1 : 2;
            return silverFrame('land',brace,middle(this),feet,this.height/44,dir,this.superSilver);
        }
        if (key==='hover' && i>=3) index=3+(i-3)%(count-3);
        if (key==='jump') index=Math.min(count-2,Math.floor(bound((this.vy-this.jumpForce)/-this.jumpForce,0,1)*count));
        if (key==='dash') index=Math.floor((this.dashFrame+this.dashTimer)*count/this.dashFrames.length);
        return silverFrame(key,index,middle(this),feet,this.height/44,dir,this.superSilver);
    }
    pixelBodyIntersectsRect(rect) { return opaqueInRect(this.getPixelBodyFrame(),rect); }

    draw() {
        const now=combatNow();
        const move=this.robotMove;
        const golden=this.superSilver;
        if (this.transformAt!=null) {
            const elapsed=now-this.transformAt;
            const x=middle(this), y=this.y+this.height*.36;
            ring(x,y,80+Math.sin(elapsed/130)*17,golden,elapsed/80);
            if (elapsed<680 && emeralds.complete && emeralds.naturalWidth) {
                for (let i=0;i<7;i++) {
                    const a=i*Math.PI*2/7+elapsed/93;
                    ctx.drawImage(emeralds,i*33,0,33,25,x-game.cameraX+Math.cos(a)*82-11,y+Math.sin(a)*50-8,22,17);
                }
            }
            if (Math.abs(elapsed-680)<115) {
                const glow=1-Math.abs(elapsed-680)/115;
                const sx=x-game.cameraX;
                const flash=ctx.createRadialGradient(sx,y,0,sx,y,158);
                flash.addColorStop(0,'#fff7b8');
                flash.addColorStop(1,'#ffd11b00');
                ctx.save();
                ctx.globalAlpha=glow*.85;
                ctx.fillStyle=flash;
                ctx.fillRect(sx-158,y-158,316,316);
                ctx.restore();
                ring(x,y,115,true,Math.PI/2);
            }
        }
        if (move) {
            const age=now-move.started;
            if (move.spec.key==='field') drawFieldPortal(middle(this)+move.direction*78,foot(this)-72,age-100,
                this.absorbButtonHeld || !this.absorbClosingAt ? null : this.absorbClosingAt-now);
            if (move.spec.key==='shock' && age>175 && age<520) ring(middle(this),foot(this)-68,49+(age-175)*.25,golden,age/35);
            if (move.spec.cinematic && age>=170) ring(middle(this),foot(this)-82,85+Math.sin(age/82)*24,golden,age/24);
            if (this.grabTarget) {
                const x=middle(this.grabTarget);
                const y=this.grabTarget.y+this.grabTarget.height*.54;
                ring(x,y,60,golden,age/48);
                if (move.spec.cinematic) {
                    for (let i=0;i<(golden?5:3);i++) {
                        const a=age/108+i*(golden?1.26:2.09);
                        const radius=now-(move.pulseAt??-Infinity)<88?42:72;
                        drawRobotFrame(ctx,silverFrame('pulse',Math.floor(age/43)%4,x+Math.cos(a)*radius,
                            y+Math.sin(a)*radius*.66,1.45,1,golden),game.cameraX,.88);
                    }
                }
            }
        }
        if (this.slamEffect) {
            const {x,y,at,golden:slamGold}=this.slamEffect;
            const pulse=now-at-100;
            if (pulse>=0 && pulse<300) ring(x,y-17,30+pulse*.35,slamGold,pulse/47);
            if (pulse>=300) this.slamEffect=null;
        }
        if (now-(this.sparkAt??-Infinity)<150) ring(middle(this)+this.pose.dir*42,this.y+this.height*.52,49,golden,now/31);
        for (const rock of this.rocks) drawRobotFrame(ctx,silverFrame('stone',0,rock.x,rock.y+18,.68,1,golden),game.cameraX);
        for (const item of this.caught) {
            const shot=item.shot;
            shot.x=item.x;shot.y=item.y;shot.draw(game.cameraX);
            ring(item.x+shot.width/2,item.y+shot.height/2,Math.min(47,shot.width*.48),golden,now/61);
        }
        drawRobotFrame(ctx,this.getPixelBodyFrame(),game.cameraX);
        const impactAge=now-(this.lastGuardImpact?.at??-Infinity);
        if (this.pose.key==='guard' && this.lastGuardImpact?.blocked && impactAge>=0 && impactAge<175) {
            const frame=updatedFrame('silver-guard','impact',Math.floor(impactAge/30),
                middle(this)+this.pose.dir*24,this.y+this.height*.90,this.height/53,1);
            if (frame) drawRobotFrame(ctx,frame,game.cameraX,.8);
        }
    }
}

const labels={idle:'Reposo',walk:'Paso atrás',run:'Carrera',dash:'Dash',brake:'Freno',jump:'Salto',fall:'Caída',land:'Aterrizaje',
    hover:'Levitación',airDash:'Psychic Dash',guard:'Guardia',crouch:'Agachado',intro:'Pose de entrada',jab:'Golpe rápido',
    medium:'Golpe medio',heavy:'Golpe fuerte',upper:'Psychic Upper',air:'Golpe aéreo',airHeavy:'Remate aéreo',
    push:'Psychic Push',field:'Campo psíquico',grab:'Psychic Grab',shock:'Psychic Shockwave',cast:'Psychic Throw',
    orbit:'Psychic Orbit',superPose:'Concentración y transición',hurt:'Impacto',knock:'Retroceso',getup:'Recuperación',
    spinCharge:'Carga de Spin Dash',spin:'Spin Dash',pulse:'Pulso psíquico',wave:'Onda psíquica',stone:'Fragmento suspendido'};

export function silverAnimations() {
    return SILVER_FRAMES.flatMap((pack,form)=>Object.entries(labels).map(([key,name])=>({
        id:(form?'super-':'')+key,name:(form?'Super Silver · ':'Silver · ')+name,count:pack[key].length,
        ms:specs[key]?.ms??(key==='idle'?117:key==='run'?57:62),
        frame(index){return silverFrame(key,index,0,0,1,1,form);}
    })));
}

// La asistencia sólo existe durante la entrada, la ventana activa y la retirada.
export function requestSilverAssist(side, push = false, chosen = null) {
    const active=game[side];
    const reserve=chosen??game.teamFighters?.[side]?.find(f=>f!==active && f.characterId==='silver' && f.health>0);
    const now=combatNow();
    if (!reserve || game.silverAssist?.[side] || (game.silverAssistReady?.[side]??0)>now ||
        !['0','go'].includes(game.countdown?.phase)) return false;
    game.silverAssist??={};
    game.silverAssistReady??={};
    const rival=game[side==='p1'?'p2':'p1'];
    const dir=rival.x>=active.x?1:-1;
    const x=bound(middle(active)+dir*101,HIGHWAY_WALLS[0].x+40,HIGHWAY_WALLS[1].x-40);
    game.silverAssist[side]={silver:reserve,active,started:now,dir,x,y:active.feetY,push};
    game.silverAssistReady[side]=now+9200;
    return true;
}

export function handleSilverAssistShot(shot,target) {
    const side=target===game.p1?'p1':'p2';
    const assist=game.silverAssist?.[side];
    if (!assist || assist.active!==target || !shot.active || !assist.silver.fieldIntersects(shot,assist)) return false;
    const age=combatNow()-assist.started;
    return !assist.push && age>=320 && age<690 && assist.silver.interceptSilverShot(shot,assist);
}

export function updateSilverAssists() {
    if (!game.silverAssist) return;
    for (const side of ['p1','p2']) {
        const assist=game.silverAssist[side];
        if (!assist) continue;
        const age=combatNow()-assist.started;
        if (age>=850 || assist.silver.health<=0 || game[side]!==assist.active) {delete game.silverAssist[side];continue;}
        if (assist.push && age>=320 && !assist.sent) {
            assist.sent=true;
            createShot(assist.silver,'wave',assist.dir,assist.x+assist.dir*40,assist.y-82);
        }

    }
}

export function drawSilverAssists() {
    for (const assist of Object.values(game.silverAssist??{})) {
        const age=combatNow()-assist.started;
        const fade=Math.min(1,age/130,(850-age)/125);
        const x=assist.x-assist.dir*58*(1-Math.min(1,age/168));
        const key=assist.push?'push':'field';
        const gold=assist.silver.superSilver;
        drawRobotFrame(ctx,silverFrame(key,Math.floor(age/96),x,assist.y,assist.silver.height/44,assist.dir,gold),game.cameraX,fade);
        if (!assist.push) drawFieldPortal(assist.x,assist.y-73,age-320,370);
    }
}
