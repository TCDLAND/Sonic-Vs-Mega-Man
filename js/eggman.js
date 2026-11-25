import { Fighter } from './fighter.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { combatNow } from './combat-clock.js';
import { updatedCells, updatedFrame } from './fighter-update-art.js';
import { drawRobotFrame } from './robot-sprites.js';
import { ctx, game } from './state.js';
import { HIGHWAY_WALLS } from './wall-system.js';
import { startEggmanSupport } from './eggman-supports.js';

const moves = {
    jab: { art:'jab', duration:420, hit:[180], damage:7, reach:105 },
    spike: { art:'spike', duration:460, hit:[205], damage:9, reach:112 },
    driver: { art:'drill', duration:550, hit:[250], damage:12, reach:122 },
    high: { art:'idle', duration:680, hit:[270], damage:14, ball:'high', launch:-7 },
    low: { art:'idle', duration:740, hit:[320], damage:15, ball:'low' },
    crush: { art:'idle', duration:820, hit:[410], damage:19, ball:'low', launch:5 },
    grab: { art:'upper', duration:670, hit:[285], damage:12, reach:88, launch:-7 },
    orbit: { art:'idle', duration:1550, hit:[0], damage:12, ball:'orbit' },
    upper: { art:'upper', duration:540, hit:[225], damage:10, reach:96, launch:-10 },
    air: { art:'idle', duration:620, hit:[260], damage:11, ball:'low' },
    scrap: { art:'shot', duration:690, hit:[350], damage:10, projectile:'scrap' },
    missile: { art:'missile', duration:730, hit:[300], damage:13, projectile:'missile' },
    bomb: { art:'bomb', duration:660, hit:[335], damage:14, projectile:'bomb' },
    rampage: { art:'idle', duration:1400, hit:[315,690,1080], damage:9, ball:'rampage' },
    protocol: { art:'upper', duration:570, hit:[255], damage:8, reach:102, capture:true },
    finish: { art:'idle', duration:1180, hit:[360,650,950], damage:10, ball:'rampage' }
};
const artCounts = Object.fromEntries(
    ['idle','boost','jump','hover','guard',...Object.values(moves).map(move=>move.art)]
        .map(key=>[key,updatedCells('egg',key).length])
);
const center = f => f.x + f.width / 2;
const hullY = f => f.y + f.height * .56;
const [left,right] = HIGHWAY_WALLS;

function ballPoint(fighter,move,age) {
        const progress=Math.max(0,Math.min(1,age/move.spec.duration));
        const arc=move.spec.ball==='rampage'?Math.sin(progress*Math.PI*3):Math.sin(progress*Math.PI);
        const scale=fighter.height/152;
        const reach=(move.spec.ball==='rampage'?172:147)*scale;
        const x=Math.max(left.x+20,Math.min(right.x-20,center(fighter)+move.direction*(18+arc*reach)));
        const base=hullY(fighter);
        const y=move.spec.ball==='high'?base-77*Math.abs(arc):base+55*Math.abs(arc);
        return {x,y:Math.min(fighter.feetY-19,y)};
    }

const MAX_FUEL=100;
const DASH_FUEL=18;
const FUEL_REFILL_DELAY=350;
const BALL_RADIUS=61;
const CHAIN_LENGTH=178;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

const ballArt=document.createElement('canvas');
ballArt.width=ballArt.height=32;
const ballCtx=ballArt.getContext('2d');
const metalColors=['#181e2c','#2f3a4c','#48596e','#67798e','#8799a7','#b5c6cd'];
for(let py=0;py<32;py++) for(let px=0;px<32;px++) {
    const x=(px-15.5)/15.5, y=(py-15.5)/15.5;
    const radius=Math.hypot(x,y);
    if (radius>1) continue;
    const z=Math.sqrt(1-radius*radius);
    const light=-x*.42-y*.55+z*.72;
    let level=radius>.93?0:clamp(Math.floor(light*5)+1,1,5);
    if (radius<.93 && Math.abs(y-x*.32+.28*z)<.07) level=Math.max(1,level-2);
    ballCtx.fillStyle=metalColors[level];
    ballCtx.fillRect(px,py,1,1);
}
for(const [x,y] of [[7,12],[12,14],[18,16],[24,18]]) {
    ballCtx.fillStyle='#252e3b'; ballCtx.fillRect(x,y,3,3);
    ballCtx.fillStyle='#aebac2'; ballCtx.fillRect(x,y,2,1);
}

function drawBall(fighter,move,age,alpha=1) {
    const {x,y}=move.ball ?? ballPoint(fighter,move,age);
    const radius=move.ball?BALL_RADIUS:43;
    const cableX=center(fighter)-game.cameraX, cableY=hullY(fighter)+12;
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.strokeStyle='#534d52';
    ctx.lineWidth=move.ball?9:6;
    ctx.beginPath();
    ctx.moveTo(cableX,cableY);
    ctx.quadraticCurveTo((cableX+x-game.cameraX)/2,Math.max(y,cableY)+12,x-game.cameraX,y);
    ctx.stroke();
    ctx.strokeStyle='#ccc4b3';
    ctx.lineWidth=2;
    ctx.stroke();
    ctx.restore();
    const bx=x-game.cameraX;
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.imageSmoothingEnabled=false;
    if (move.ball?.flaming) {
        const glow=ctx.createRadialGradient(bx,y,radius*.72,bx,y,radius*1.38);
        glow.addColorStop(0,'#ffec91'); glow.addColorStop(.68,'#f76d28cc'); glow.addColorStop(1,'#ef372100');
        ctx.fillStyle=glow;
        ctx.beginPath(); ctx.arc(bx,y,radius*1.38,0,Math.PI*2); ctx.fill();
        const trailX=bx-(move.ball.x-(move.ball.fromX??move.ball.x))*3;
        const trailY=y-(move.ball.y-(move.ball.fromY??move.ball.y))*3;
        ctx.lineWidth=radius*.38;
        ctx.strokeStyle='#f6924180';
        ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(bx,y);ctx.lineTo(trailX,trailY);ctx.stroke();
    }
    ctx.drawImage(ballArt,bx-radius,y-radius,2*radius,2*radius);
    ctx.restore();
}

export class Eggman extends Fighter {
    constructor(x,y,controls) {
        super(x,y,'#d85a3b',controls,false);
        this.width=160;
        this.height=152;
        this.y=this.feetY-this.height;
        this.speed=5.7;
        this.flightDirection=1;
        this.fuel=MAX_FUEL;
        this.maxFuel=MAX_FUEL;
        this.comboStep=0;
        this.eggPawn=null;
        this.eggPawnReadyAt=0;
        this.eggMotobugReadyAt=0;
        this.eggBuzzerReadyAt=0;
        configureCombatant(this,'eggman','EGGMAN');
    }

    getCurrentHeight() { return this.height; }
    getCurrentY() { return this.y; }

    isBusy() { return super.isBusy() || !!this.eggMove; }
    isAttacking() { return super.isAttacking() || !!this.eggMove; }

    startMove(key,target) {
        const spec=moves[key];
        if (!spec) return false;
        const now=combatNow();
        const family=spec.ball?'ball':spec.projectile?'shot':key;
        const inPractice=game.mode==='practice';
        if (this.isBusy() || this.isVulnerable || this.isHitstunned() || (!inPractice &&
            (now<(this.eggReady?.[family]??0) || now<(this.eggReady?.[key]??0)))) return false;
        const direction=center(target)>=center(this)?1:-1;
        this.eggMove={spec,key,started:now,direction,hit:new Set()};
        if (spec.ball) this.initBall(this.eggMove);
        this.eggReady??={};
        this.eggReady[family]=now+spec.duration+(spec.ball?230:spec.projectile?170:0);
        if(key==='rampage'||key==='protocol') this.eggReady[key]=now+5600;
        return true;
    }

    command(code,target) {
        const c=this.controls;
        const blue=c.attack==='KeyJ';
        const down=Boolean(this.keys[c.crouch]);
        const targetRight=center(target)>center(this);
        const toward=Boolean(this.keys[targetRight?c.right:c.left]);
        const backward=Boolean(this.keys[targetRight?c.left:c.right]);
        const up=Boolean(this.keys[c.jump]);
        let key;
        if (code===c.attack) {
            if (combatNow()>(this.comboUntil||0)) this.comboStep=0;
            if (this.eggMove && ['jab','spike'].includes(this.eggMove.key) &&
                this.eggMove.hit.size && combatNow()-this.eggMove.started>this.eggMove.spec.duration-180) {
                this.comboQueued=true;
                return true;
            }
            key=down?'air':['jab','spike','driver'][this.comboStep];
            if (this.startMove(key,target)) {
                this.comboStep=(this.comboStep+1)%3;
                this.comboUntil=combatNow()+900;
            }
            return true;
        }
        if (code===c.kickLight) key=this.keys[c.jump]?'grab':'upper';
        if (code===c.kickHeavy) key='crush';
        if (code===c.heavy) {
            if(down) key='protocol';
            else if(up){this.commandEggPawn('weapon',target);return true;}
            else if(toward){this.commandEggPawn('drill',target);return true;}
            else if(backward){this.commandEggPawn('bomb',target);return true;}
            else key='rampage';
        }
        if (code===(blue?'KeyQ':'BracketLeft')) {
            const guard=Boolean(this.keys[c.spinKey]) && combatNow()>=(this.dashChargeUntil??0);
            key=guard && !this.airDash ? 'orbit' : down ? 'low' : 'high';
        }
        if (code===c.spinKey) {
            const horizontal=Number(Boolean(this.keys[c.right]))-Number(Boolean(this.keys[c.left]));
            const vertical=Number(down)-Number(Boolean(this.keys[c.jump]));
            if (horizontal || vertical) { this.startAirDash(horizontal,vertical); return true; }
        }
        if (code===(blue?'KeyE':'BracketRight')) {
            if(up){this.summonBuzzer(target);return true;}
            if(backward){this.summonMotobug(target);return true;}
            key=down?'bomb':toward?'missile':'scrap';
        }
        if (!key) return false;
        this.startMove(key,target);
        return true;
    }

    commandEggPawn(order,target) {
        return startEggmanSupport(this,'pawn',order,target);
    }

    summonMotobug(target) { return startEggmanSupport(this,'motobug',null,target); }
    summonBuzzer(target) { return startEggmanSupport(this,'buzzer',null,target); }

    startAirDash(dx,dy) {
        const now=combatNow();
        if (this.isBusy() || this.isVulnerable || now<(this.dashReady??0)) return false;
        const length=Math.hypot(dx,dy);
        if (!length || this.fuel<DASH_FUEL) return false;
        this.fuel-=DASH_FUEL;
        this.fuelReadyAt=now+FUEL_REFILL_DELAY;
        this.airDash={vx:dx/length*19,vy:dy/length*19,until:now+215,started:now};
        this.dashReady=now+650;
        this.dashChargeUntil=now+330;
        return true;
    }

    initBall(move) {
        const dir=move.direction;
        const lastDash=this.airDash && combatNow()<this.airDash.until ? this.airDash : null;
        const angle=dir>0?.92:Math.PI-.92;
        move.ball={
            x:center(this)+Math.cos(angle)*73,y:hullY(this)+Math.sin(angle)*73,angle,length:73,
            omega:lastDash ? clamp((lastDash.vx*Math.sin(angle)-lastDash.vy*Math.cos(angle))*.018,-.24,.24) : 0,
            flaming:combatNow()<(this.dashChargeUntil??0),lastHit:-Infinity
        };
        this.dashChargeUntil=0;
    }

    stepBall(move,horizontal,vertical) {
        const ball=move.ball;
        const age=combatNow()-move.started;
        const dir=move.direction;
        const orbit=move.spec.ball==='orbit'||move.spec.ball==='rampage';
        const returning=age>move.spec.duration-150;
        const angle=horizontal||vertical?Math.atan2(vertical,horizontal)
            : move.spec.ball==='high' ? (dir>0?-.67:Math.PI+.67)
            : (dir>0?.70:Math.PI-.70);
        const torque=orbit&&!returning?dir*.019:angleDelta(angle,ball.angle)*.035;
        const accelerationX=this.vx-(ball.shipVx??0);
        const accelerationY=this.vy-(ball.shipVy??0);
        const impulse=(accelerationX*Math.sin(ball.angle)-accelerationY*Math.cos(ball.angle))*.004;
        ball.shipVx=this.vx; ball.shipVy=this.vy;
        ball.omega=clamp((ball.omega+torque+impulse)*(orbit?.97:.86),-.26,.26);
        ball.angle+=ball.omega;
        ball.length+=((returning?73:CHAIN_LENGTH)-ball.length)*.17;
        const oldX=ball.x,oldY=ball.y;
        const r=BALL_RADIUS;
        ball.x=clamp(center(this)+Math.cos(ball.angle)*ball.length,left.x+r,right.x-r);
        ball.y=clamp(hullY(this)+Math.sin(ball.angle)*ball.length,24+r,this.feetY-r);
        ball.fromX=oldX; ball.fromY=oldY;
    }

    hitWithBall(move,target,age) {
        const b=move.ball;
        if (age<115 || age>move.spec.duration-130 || combatNow()-b.lastHit<390) return;
        const cap=move.key==='rampage'||move.key==='finish'?3:move.key==='orbit'?2:1;
        if (move.hit.size>=cap) return;
        const top=target.getCurrentY();
        const step=Math.max(1,Math.ceil(Math.hypot(b.x-(b.fromX??b.x),b.y-(b.fromY??b.y))/24));
        for(let i=0;i<=step;i++) {
            const t=i/step;
            const x=(b.fromX??b.x)*(1-t)+b.x*t;
            const y=(b.fromY??b.y)*(1-t)+b.y*t;
            const r=BALL_RADIUS;
            const hitRect={x:x-r,y:y-r,w:2*r,h:2*r};
            if (target.handleMeleeVsEddie?.(hitRect,this)) { b.lastHit=combatNow(); return; }
            const touching=Math.hypot(x-clamp(x,target.x,target.x+target.width),
                y-clamp(y,top,top+target.getCurrentHeight()))<=r;
            if(!touching) continue;
            move.hit.add(move.hit.size);
            b.lastHit=combatNow();
            const damage=dealDamage(target,move.spec.damage+(b.flaming?6:0),
                {attacker:this,attackName:b.flaming?'Bola de demolición en llamas':'Bola de demolición',impactX:x,hitRect});
            if (damage && !target.lastGuardImpact?.front) {
                target.vx=Math.sign((b.x-(b.fromX??b.x))||move.direction)*7;
                target.vy=move.spec.launch??-4;
                target.isGrounded=false;
                target.wasInAirFromKnockback=true;
            }
            return;
        }
    }

    updateFuel(now,vertical, floor) {
        const elapsed=Math.max(0,Math.min(50,now-(this.fuelUpdatedAt??now)))/1000;
        this.fuelUpdatedAt=now;
        if (this.y<floor-1 || vertical<0 || this.airDash) {
            this.fuel=Math.max(0,this.fuel-elapsed*(vertical<0?17:9));
            this.fuelReadyAt=now+FUEL_REFILL_DELAY;
        } else if (now>=(this.fuelReadyAt??0)) {
            this.fuel=Math.min(MAX_FUEL,this.fuel+elapsed*30);
        }
    }

    update(opponentX,self) {
        if (this.isIntroActive) { super.update(opponentX,self); return; }
        const now=combatNow();
        const target=this===game.p1?game.p2:game.p1;
        const interrupted=this.isHitstunned() || this.isVulnerable;
        const move=this.eggMove;
        if (move && (interrupted || now-move.started>=move.spec.duration)) {
            if (move.captured) move.captured.hitstunUntil=Math.min(move.captured.hitstunUntil,now);
            this.eggMove=null;
            if (this.comboQueued && !interrupted && target) this.command(this.controls.attack,target);
            this.comboQueued=false;
        }
        if (this.isVulnerable && --this.vulnerableTimer<=0) this.isVulnerable=false;
        const c=this.controls;
        const keys=this.keys;
        const horizontal=Number(Boolean(keys[c.right]))-Number(Boolean(keys[c.left]));
        const vertical=Number(Boolean(keys[c.crouch]))-Number(Boolean(keys[c.jump]));
        const toward=opponentX>=this.x?1:-1;
        const floor=this.feetY-this.height-12;
        const climb=vertical<0 && this.fuel>=1?vertical:Math.max(0,vertical);
        if (this.airDash && (interrupted || now>=this.airDash.until)) this.airDash=null;
        this.updateFuel(now,climb,floor);
        this.isGuarding=Boolean(keys[c.spinKey] && horizontal!==toward && !this.eggMove && !this.airDash &&
            !interrupted && now>=(this.guardBrokenUntil||0));
        this.guardType=this.isGuarding?(vertical>0?'low':'high'):null;
        this.facingDirection=this.eggMove?.direction ?? (Math.sign(this.airDash?.vx||0) || (this.isGuarding?toward:horizontal||toward));
        this.flightDirection=this.facingDirection;
        if (interrupted) {
            this.vx*=.83;
            this.vy*=.87;
        } else {
            const speed=this.speed/(horizontal&&vertical?Math.SQRT2:1);
            const maneuver=this.eggMove?.spec.capture || this.eggMove?.captured ? 0 : this.eggMove ? .44 : this.isGuarding ? .55 : 1;
            this.vx=this.airDash?.vx??horizontal*speed*maneuver;
            this.vy=this.airDash?.vy??climb*speed*maneuver;
            if (!this.airDash && this.fuel<1 && this.y<floor) {
                this.vx*=.64;
                this.vy=Math.max(this.vy,3.2);
            }
            this.wasInAirFromKnockback=false;
        }
        this.x=Math.max(left.x,Math.min(right.x-this.width,this.x+this.vx));
        this.y=Math.max(36,Math.min(floor,this.y+this.vy));
        this.isGrounded=this.y>=floor;
        if (this.eggMove?.ball) this.stepBall(this.eggMove,horizontal,vertical);
    }


    tryHit(target) {
        const move=this.eggMove;
        if (!move || this.isHitstunned()) return;
        const age=combatNow()-move.started;
        if (move.ball && !move.captured) { this.hitWithBall(move,target,age); return; }
        if (move.captured === target && age < 950) {
            const carry=Math.min(84,36+age*.065);
            target.x=Math.max(left.x,Math.min(right.x-target.width,center(this)+move.direction*83-target.width/2));
            target.y=Math.max(0,this.y-carry);
            target.vx=0;
            target.vy=0;
            target.isGrounded=false;
        }
        const phase=move.spec.hit.findIndex((at,index)=>age>=at && !move.hit.has(index));
        if (phase<0) return;
        if (move.spec.projectile) {
            move.hit.add(phase);
            this.launch(move);
            return;
        }
        const spec=move.spec;
        const upper=move.key==='upper';
        const point=spec.ball?ballPoint(this,move,age):{
            x:center(this)+move.direction*(44+spec.reach*.39),
            y:hullY(this)-(upper?56:0)
        };
        const radius=spec.ball?29:spec.reach*.52;
        const vertical=upper?55:30;
        const rect={x:point.x-radius,y:point.y-vertical,w:2*radius,h:vertical*2};
        if (target.handleMeleeVsEddie?.(rect,this)) { move.hit.add(phase); return; }
        const top=target.getCurrentY();
        const touching=target.pixelBodyIntersectsRect
            ? target.pixelBodyIntersectsRect(rect,center(this))
            : rect.x<target.x+target.width && rect.x+rect.w>target.x && rect.y<top+target.getCurrentHeight() && rect.y+rect.h>top;
        if (!touching && move.captured!==target) {
            if (age>spec.hit[phase]+105) move.hit.add(phase);
            return;
        }
        move.hit.add(phase);
        const damage=dealDamage(target,spec.damage,{attacker:this,attackName:move.key,impactX:point.x,hitRect:rect,ignoreGuard:move.captured===target});
        if (!damage || target.lastGuardImpact?.front) return;
        if (spec.capture) {
            this.eggMove={spec:moves.finish,key:'finish',started:combatNow(),direction:move.direction,hit:new Set(),captured:target};
            target.hitstunUntil=Math.max(target.hitstunUntil||0,combatNow()+950);
            target.vy=-7;
            target.isGrounded=false;
        } else if (move.captured === target && phase===2) {
            target.vy=11;
            target.vx=move.direction*8;
            target.wasInAirFromKnockback=true;
            move.captured=null;
        } else if (spec.launch) {
            target.vy=spec.launch;
            target.isGrounded=false;
            target.wasInAirFromKnockback=true;
        }
    }

    launch(move, origin=this) {
        const kind=move.spec.projectile;
        const created=combatNow();
        const bomb=kind==='bomb';
        const {direction}=move;
        game.projectiles.push({
            owner:this,type:'Eggmobile '+kind,damage:move.spec.damage,active:true,
            x:center(origin)+(bomb?0:direction*67)-10,y:hullY(origin)+(bomb?42:0),width:24,height:23,
            vx:bomb?direction*2:direction*(kind==='missile'?10:13),vy:bomb?2:-1,
            projectileForce:bomb?5:3,
            update(){
                if (kind==='missile' && combatNow()-created<600) {
                    const target=this.owner===game.p1?game.p2:game.p1;
                    if (target) this.vy=Math.max(-4.5,Math.min(4.5,(hullY(target)-this.y)*.03));
                }
                this.x+=this.vx;
                this.y+=this.vy;
                if (bomb) {
                    const floor=this.owner.feetY-this.height;
                    this.vy+=.37;
                    if (this.y>=floor) {
                        this.y=floor;
                        this.vx=0;
                        this.vy=0;
                        this.landedAt??=combatNow();
                    }
                }
                this.active=combatNow()-created<(bomb?1700:1000) && this.x>left.x && this.x<right.x &&
                    (!this.landedAt || combatNow()-this.landedAt<530) && this.y<this.owner.feetY;
            },
            draw(camera){
                const art=bomb?'bombFx':kind==='missile'?'missileFx':'scrap';
                const tick=this.landedAt?0:Math.floor((combatNow()-created)/70);
                const frame=updatedFrame('egg',art,tick,this.x+12,this.y+23,bomb?1.5:kind==='missile'?2:1,direction);
                drawRobotFrame(ctx,frame,camera);
            }
        });
    }

    getEggFrame(opponentX) {
        const now=combatNow();
        const move=this.eggMove;
        const art=this.airDash?'boost':move?.spec.art ?? (this.isGuarding?'guard':this.vy<-.5?'jump':this.vy>.5?'hover':'idle');
        const count=artCounts[art];
        const index=this.airDash?Math.min(count-1,Math.floor((now-this.airDash.started)/43)):move && art!=='idle'
            ? Math.min(count-1,Math.floor((now-move.started)/move.spec.duration*count))
            : Math.floor(now/(this.isGuarding?92:135))%count;
        const direction=this.airDash?this.flightDirection:move?.direction ?? this.flightDirection;
        const feet=this.y+this.height-4-Math.sin(now/140)*3;
        const pivots={ idle:[19,26,33,33],boost:[29,36,34,33,34],jab:[19,19,19,19,19,19,19,19,19,19,19,19,19] };
        const support=art==='jump'||art==='hover'?35:undefined;
        const pivot=pivots[art]?.[index] ?? (art==='guard'?undefined:19);
        return updatedFrame('egg',art,index,center(this),feet,this.height/39,direction,pivot,support);
    }

    draw(opponentX) {
        const move=this.eggMove;
        if (move?.spec.ball) {
            drawBall(this,move,combatNow()-move.started);
        }
        drawRobotFrame(ctx,this.getEggFrame(opponentX),game.cameraX);
    }
}

export function requestEggAssist(side, scrap, chosen = null) {
    const active=game[side];
    const reserve=chosen??game.teamFighters?.[side]?.find(f=>f!==active && f.characterId==='eggman' && f.health>0);
    const now=combatNow();
    if (!reserve || !game.eggAssists || (game.eggAssistReady[side]||0)>now ||
        !['0','go'].includes(game.countdown?.phase)) return false;
    const target=game[side==='p1'?'p2':'p1'];
    const direction=center(target)>=center(active)?1:-1;
    const x=Math.max(left.x,Math.min(right.x-reserve.width,active.x-direction*55));
    const origin={x,y:active.feetY-reserve.height-18,width:reserve.width,height:reserve.height,feetY:active.feetY};
    game.eggAssists[side]={reserve,active,origin,scrap,direction,started:now};
    game.eggAssistReady[side]=now+9200;
    return true;
}

export function updateEggAssists() {
    for (const [side,assist] of Object.entries(game.eggAssists ?? {})) {
        const age=combatNow()-assist.started;
        if (age>=730 || game[side]!==assist.active || assist.reserve.health<=0) {
            delete game.eggAssists[side];
            continue;
        }
        if (age<320 || assist.hit) continue;
        if (assist.scrap) {
            assist.reserve.launch({spec:moves.scrap,direction:assist.direction},assist.origin);
            assist.hit=true;
        } else if (age<430) {
            const rival=game[side==='p1'?'p2':'p1'];
            const {x,y}=ballPoint(assist.origin,{spec:moves.high,direction:assist.direction},age);
            if (Math.abs(center(rival)-x)<rival.width/2+24 &&
                y+27>rival.getCurrentY() && y-27<rival.getCurrentY()+rival.getCurrentHeight()) {
                dealDamage(rival,10,{attacker:assist.reserve,attackName:'Wrecking Ball · asistencia',impactX:x});
                assist.hit=true;
            }
        }
    }
}

export function drawEggAssists() {
    for (const assist of Object.values(game.eggAssists ?? {})) {
        const age=combatNow()-assist.started;
        const fade=Math.max(0,Math.min(1,age/120,(730-age)/180));
        const {origin,direction}=assist;
        const art=assist.scrap?'shot':'idle';
        if (!assist.scrap && age>=320) drawBall(origin,{spec:moves.high,direction},age,fade);
        const frame=updatedFrame('egg',art,Math.floor(age/47),center(origin),
            origin.y+origin.height,origin.height/39,direction,19,38);
        drawRobotFrame(ctx,frame,game.cameraX,fade);
    }
}
