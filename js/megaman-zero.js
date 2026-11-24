import { configureCombatant, dealDamage } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { combatNow } from './combat-clock.js';
import { ctx, game } from './state.js';
import { HIGHWAY_WALLS, getTouchedWall } from './wall-system.js';
import { beginRobotMove, updateRobotMove, hitRobotMove } from './robot-combat.js';
import { drawRobotFrame } from './robot-sprites.js';
import { opaqueInRect } from './pixel-collision.js';
import { MM_ZERO_FRAMES } from './mm-zero-frames.js';

const atlas = new Image();
atlas.src = 'assets/images/mm-zero/atlas.png';
const bound = (v,a,b) => Math.min(b,Math.max(a,v));
const center = f => f.x + f.width/2;
const feet = f => f.y + f.height;
const weapons = ['Triple Rod','Chain Rod','Recoil Rod','Z Knuckle'];
const saberCombo=['saberA','saberB','saberC'];
const tripleCombo=['triple','tripleExtend','tripleMax'];
let nextIntro=0;
let hologramAtlas;

function hologramFrame(sprite) {
    if (!hologramAtlas) {
        hologramAtlas=document.createElement('canvas');
        hologramAtlas.width=atlas.naturalWidth;
        hologramAtlas.height=atlas.naturalHeight;
        const tint=hologramAtlas.getContext('2d');
        tint.drawImage(atlas,0,0);
        tint.globalCompositeOperation='source-atop';
        tint.fillStyle='#41dcecaa';
        tint.fillRect(0,0,hologramAtlas.width,hologramAtlas.height);
    }
    return {...sprite,img:hologramAtlas};
}

function renderFrame(key,i,x,y,scale,direction) {
    if (!atlas.complete || !atlas.naturalWidth) return null;
    const list=MM_ZERO_FRAMES[key];
    const [sx,sy,sw,sh,pad]=list[bound(i,0,list.length-1)];
    let pivot=sw/2;
    if (['saberA','saberB','saberC','saberAir','saberDash','saberWave','triple','tripleUp',
        'tripleAir','tripleUpAir','tripleExtend','tripleMax','recoil','recoilEX','shieldThrow','buster','busterReady','busterAir','busterRun','busterDash'].includes(key)) {
        pivot=Math.min(centerPivot(key,sw),sw*.57);
    }
    const flipX=direction<0;
    return {img:atlas,sx,sy,sw,sh,flipX,dx:x-(flipX?sw-pivot:pivot)*scale,dy:y-(sh-pad)*scale,dw:sw*scale,dh:sh*scale,key};
}

function centerPivot(key,width) {
    if (key==='saberC' && width>60) return 36;
    if (key==='saberAir' && width>53) return 25;
    if (key==='busterRun' || key==='busterDash') return 24;
    return 21;
}

const moves={
    saberA:{ms:43,active:[1,2],damage:8,range:110,top:119},
    saberB:{ms:46,active:[0,2],damage:10,range:123,top:125},
    saberC:{ms:49,active:[3,4],damage:14,range:135,top:130,launch:-8},
    saberDash:{ms:46,active:[0,2],damage:10,range:133,top:122,speed:11},
    saberAir:{ms:38,active:[1,4],damage:11,range:114,top:135},
    saberWave:{ms:61,shot:3},
    saberDive:{ms:56,drop:true},
    shieldThrow:{ms:62,shot:2},
    shieldWallThrow:{ms:64,shot:2},
    triple:{ms:49,active:[1,5],damage:9,range:149,top:98},
    tripleUp:{ms:50,active:[2,5],damage:10,range:126,top:175,launch:-8},
    tripleAir:{ms:53,active:[0,3],damage:8,range:137,top:105},
    tripleUpAir:{ms:53,active:[0,3],damage:9,range:119,top:172,launch:-7},
    tripleExtend:{ms:58,active:[0,3],damage:7,range:177,top:101},
    tripleMax:{ms:55,active:[0,3],damage:9,range:209,top:104},
    chain:{ms:82,active:[1,2],damage:7,range:222,top:90},
    chainAir:{ms:82,active:[1,2],damage:7,range:230,top:107},
    recoil:{ms:51,active:[1,4],damage:12,range:137,top:106},
    recoilDown:{ms:52,drop:true},
    recoilEX:{ms:57,shot:1},
    knuckle:{ms:54,active:[1,3],damage:12,range:84,top:103},
    knuckleAir:{ms:54,active:[1,3],damage:11,range:88,top:109},
    gunBurst:{pose:'knuckle',ms:65,shot:2},
};
for (const [key,spec] of Object.entries(moves)) {
    Object.assign(spec,{key,pose:spec.pose??key,frames:MM_ZERO_FRAMES[spec.pose??key].length});
}
const SHIELD_MAX = 28;
const SHIELD_BREAK_MS = 2800;
const SHIELD_STOW_MS = 180;
const SHIELD_REGEN_PER_MS = .024;
const shotSpecs={
    bullet:{damage:6,w:37,h:24,v:16,force:2},
    charged:{damage:18,w:77,h:50,v:18,force:7},
    gunBurst:{damage:14,w:112,h:83,v:13,force:5},
    wave:{damage:11,w:58,h:64,v:12,force:4},
    shield:{damage:8,w:62,h:49,v:13,force:4},
    recoilEX:{damage:9,w:53,h:33,v:15,force:4}
};

function weaponShot(owner,key,direction,shotAt,level=1){
    const spec=shotSpecs[key];
    const now=combatNow();
    const shield=key==='shield';
    const art=key==='wave'||shield?'saberWave':key==='recoilEX'?'bullet':key;
    const x=shotAt.x-spec.w/2,y=shotAt.y-spec.h/2;
    const shot={
        owner,active:true,basicShot:key==='bullet'&&level===1,
        type:key==='bullet'||key==='charged'?'buster-megaman-zero-'+level:'mmzero-'+key,damage:key==='bullet'&&level===2?11:spec.damage,
        x,y,width:spec.w,height:spec.h,vx:direction*spec.v,vy:0,projectileForce:spec.force,
        hitFighters:shield?new WeakSet():null,
        update() {
            const age=combatNow()-now;
            if (shield && age>325) {
                const gap=center(owner)-(this.x+this.width/2);
                const dy=feet(owner)-89-(this.y+this.height/2);
                if (Math.abs(gap)<24 && Math.abs(dy)<34) {this.active=false;return;}
                this.vx=bound(gap*.28,-18,18);
                this.vy=bound(dy*.21,-15,15);
            }
            this.x+=this.vx;
            this.y+=this.vy;
            if (age>(shield?1350:1050) || this.x<HIGHWAY_WALLS[0].x-200 || this.x>HIGHWAY_WALLS[1].x+200) this.active=false;
        },
        draw(camera) {
            const age=combatNow()-now;
            const dir=Math.sign(this.vx)||direction;
            const cellIndex=art==='gunBurst'?Math.min(3,Math.floor(age/45)):art==='charged'?1+Math.floor(age/50)%4:3+Math.floor(age/58)%4;
            const key=shield?'shieldDisc':art==='saberWave'?'waveFx':art;
            const index=Math.min(cellIndex,MM_ZERO_FRAMES[key].length-1);
            const cell=MM_ZERO_FRAMES[key][index];
            const scale=Math.min(this.width/cell[2],this.height/cell[3]);
            drawRobotFrame(ctx,renderFrame(key,index,this.x+this.width/2,this.y+(this.height+cell[3]*scale)/2,scale,dir),camera);
        }
    };
    game.projectiles.push(shot);
    return shot;
}

export class MegaManZero extends PrototypeFighter {
    constructor(x,y,controls) {
        super(x,y,controls,{name:'MM ZERO',color:'#ca343e',hasSonicJump:false,speed:7.35});
        configureCombatant(this,'megaman-zero','MM ZERO');
        this.dashSpeed=18.5;
        this.dashAnimationSpeed=.19;
        this.pose={key:'idle',at:combatNow(),dir:1};
        this.weaponIndex=0;
        this.trail=[];
        this.busterChargeStart=null;
        this.shieldIntegrity=SHIELD_MAX;
        this.shieldMaxIntegrity=SHIELD_MAX;
        this.shieldBrokenUntil=0;
        this.aux1=controls.attack==='KeyJ'?'KeyQ':'BracketLeft';
        this.aux2=controls.attack==='KeyJ'?'KeyE':'BracketRight';
    }

    get weaponLabel() { return weapons[this.weaponIndex]; }
    isBusy() { return super.isBusy() || Boolean(this.robotMove); }
    isAttacking() { return super.isAttacking() || Boolean(this.robotMove); }
    canAct() { return !this.isIntroActive && !this.isVulnerable && !this.isHitstunned() && !(this.tagLockedUntil>combatNow()); }

    startMMZeroIntro() {
        this.entry=nextIntro++%2===0?'beam':'cloak';
        this.entryAt=combatNow();
        this.isIntroActive=true;
        this.introDone=false;
    }

    startWallHop(side) {
        this.wallSide=side;
        this.wallHopAt=combatNow();
        this.wallHopDir=side==='left'?1:-1;
        this.wallDetachUntil=this.wallHopAt+185;
        this.x=side==='left'?HIGHWAY_WALLS[0].x+18:HIGHWAY_WALLS[1].x-this.width-18;
        this.vy=this.jumpForce;
        this.shieldUp=false;
        this.trailUntil=this.wallHopAt+190;
        this.airDashUsed=false;
    }

    checkDoubleTap(direction,targetX) {
        if (this.canAct() && this.isGrounded && !this.isBusy()) super.checkDoubleTap(direction,targetX);
    }

    startDash(dir) {
        if (!this.canAct() || this.isBusy() || (!this.isGrounded && this.airDashUsed)) return false;
        if (this.isGrounded) {
            this.isDashing=true;
            this.dashFrame=this.dashTimer=0;
            this.dashDirection=dir;
        } else {
            this.airDashUsed=true;
            this.airDashUntil=combatNow()+155;
            this.airDashDir=dir;
            this.trailUntil=combatNow()+220;
        }
        this.isCrouching=false;
        return true;
    }

    chooseAttack(code,target) {
        const c=this.controls, down=this.keys[c.crouch], air=!this.isGrounded, wall=getTouchedWall(this);
        const dir=wall?(wall.side==='left'?1:-1):target.x>=this.x?1:-1;
        if (!this.canAct()) return;
        if (code===this.aux1 || code===this.aux2) {
            this.weaponIndex=(this.weaponIndex+(code===this.aux2?1:3))%weapons.length;
            return;
        }
        if (code===c.kickLight) {
            if (!this.robotMove && this.busterChargeStart==null) {
                this.busterCharging=true;
                this.busterChargeStart=combatNow();
            }
            return;
        }
        if (code===c.spinKey) {
            const direction=Number(Boolean(this.keys[c.right]))-Number(Boolean(this.keys[c.left]));
            this.startDash(direction||dir);
            return;
        }
        if (code===c.heavy) {
            if (down && !this.shieldProjectile?.active) this.beginWeapon(wall?'shieldWallThrow':'shieldThrow',target,dir);
            return;
        }
        if (code===c.attack) {
            if (this.robotMove && saberCombo.includes(this.robotMove.spec.key)) {
                const move=this.robotMove;
                if (combatNow()-move.started>=move.spec.ms) move.chain=true;
                return;
            }
            this.beginWeapon(down?(air?'saberDive':'saberWave'):air?'saberAir':this.isDashing?'saberDash':'saberA',target,dir);
        }
        if (code===c.kickHeavy) {
            if (this.weaponIndex===0 && this.robotMove && tripleCombo.includes(this.robotMove.spec.key)) {
                if (combatNow()-this.robotMove.started>=this.robotMove.spec.ms) this.robotMove.chain=true;
                return;
            }
            const key=[
                this.keys[c.jump]?(air?'tripleUpAir':'tripleUp'):(air?'tripleAir':'triple'),
                air?'chainAir':'chain',
                air&&down?'recoilDown':down?'recoilEX':'recoil',
                down&&this.knuckleCharge?'gunBurst':air?'knuckleAir':'knuckle'
            ][this.weaponIndex];
            this.beginWeapon(key,target,dir);
        }
    }

    beginWeapon(key,target,dir=target.x>=this.x?1:-1) {
        const dashCancel=key==='saberDash'&&this.isDashing;
        if (!this.canAct() || (this.isBusy()&&!dashCancel) || (key.startsWith('shield')&&!this.shieldAvailable())) return false;
        if (dashCancel) this.isDashing=false;
        if (!beginRobotMove(this,moves[key],dir)) return false;
        this.robotMove.target=target;
        if (key.startsWith('shield')) this.shieldReleaseRequired=true;
        return true;
    }

    releaseWeapon(code,target) {
        if (code===this.controls.heavy) this.shieldReleaseRequired=false;
        if (code!==this.controls.kickLight || this.busterChargeStart==null) return;
        const now=combatNow(), held=now-this.busterChargeStart;
        this.busterChargeStart=null;
        this.busterCharging=false;
        if (!this.canAct() || this.robotMove) return;
        const wall=getTouchedWall(this);
        const direction=wall?(wall.side==='left'?1:-1):target.x>=this.x?1:-1;
        const level=game.mode==='practice'||held>=1180?3:held>=480?2:1;
        this.shotUntil=now+(level===3?285:215);
        this.shotAt=now;
        this.shotDir=direction;
        weaponShot(this,level===3?'charged':'bullet',direction,
            {x:center(this)+direction*36,y:this.y+this.height*.48},level);
    }

    shieldAvailable(now=combatNow()) {
        return now>=this.shieldBrokenUntil && (this.shieldIntegrity>0 || this.shieldBrokenUntil>0) &&
            !this.shieldReleaseRequired && !this.shieldProjectile?.active;
    }

    interceptIncomingHit(damage,options) {
        if (!this.shieldUp || !options.projectile || options.ignoreGuard || damage<=0) return false;
        const point=options.impactX??options.attacker?.x??center(this);
        if ((point-center(this))*this.shieldDir < -10) return false;
        this.shieldIntegrity=Math.max(0,this.shieldIntegrity-Math.max(5,damage));
        if (this.shieldIntegrity===0) {
            this.shieldUp=false;
            this.shieldBrokenUntil=combatNow()+SHIELD_BREAK_MS;
        }
        return 'shield';
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (this.lastGuardImpact?.blocked) return;
        this.cancelMMZeroMoves();
        this.hurtAt=combatNow();
    }

    cancelMMZeroMoves() {
        this.robotMove=null;
        this.busterCharging=false;
        this.busterChargeStart=null;
        this.airDashUntil=0;
        this.shieldUp=false;
        this.shotUntil=0;
        this.trail=[];
    }

    overlaps(target,x,y,w,h) {
        const rect={x,y,w,h};
        if (target.shieldIntersects?.(rect)) return true;
        if (target.pixelBodyIntersectsRect) return target.pixelBodyIntersectsRect(rect,center(this));
        const ry=target.getCurrentY();
        return x<target.x+target.width&&x+w>target.x&&y<ry+target.getCurrentHeight()&&y+h>ry;
    }

    tryHit(target) {
        const move=this.robotMove;
        if (!move || move.hit || this.shadowFrozenBy || this.health<=0 || target.health<=0 ||
            this.isHitstunned() || target.minerPhase==='under' || target.minerPhase==='warning') return;
        const {key}=move.spec;
        const i=Math.floor((combatNow()-move.started)/move.spec.ms);
        if (move.spec.drop && i>=2 && i<7) {
            const x=center(this)-38,y=feet(this)-54;
            if (this.overlaps(target,x,y,76,121)) {
                move.hit=true;
                dealDamage(target,key==='recoilDown'?12:14,{attacker:this,attackName:key,impactX:center(this)});
                if (!target.lastGuardImpact?.blocked) {
                    target.vx=move.direction*8;
                    target.vy=7;
                    if (key==='recoilDown') {this.isGrounded=false;this.vy=-14;move.bounced=true;}
                }
            }
            return;
        }
        hitRobotMove(this,target);
        if (!move.hit || target.lastGuardImpact?.blocked || target.lastGuardImpact?.broken) return;
        if (key.startsWith('chain')) {
            target.vx=-move.direction*15;
            target.vy=-4;
            target.isGrounded=false;
            target.wasInAirFromKnockback=true;
            target.knockbackAirTimer=0;
        }
        if (key==='recoil') target.vx=move.direction*15;
        if (key==='knuckle' || key==='knuckleAir') this.knuckleCharge=true;
    }

    update(opponentX,self) {
        const now=combatNow();
        if (this.isIntroActive) {
            const duration=this.entry==='beam'?900:1160;
            this.pose.dir=opponentX>=this.x?1:-1;
            if (now-this.entryAt>=duration) {this.isIntroActive=false;this.introDone=true;}
            return;
        }
        if (!this.busterCharging) this.busterChargeStart=null;
        if (!this.keys[this.controls.heavy]) this.shieldReleaseRequired=false;
        const beforeGround=this.isGrounded;
        const beforeX=this.x;
        const move=this.robotMove;
        if (move) {
            const i=Math.floor((now-move.started)/move.spec.ms);
            const {key}=move.spec;
            if (i>=move.spec.shot && !move.sent) {
                move.sent=true;
                const type=key.startsWith('shield')?'shield':key==='saberWave'?'wave':key;
                const shot=weaponShot(this,type,move.direction,{x:center(this)+move.direction*42,y:this.y+this.height*.49});
                if (type==='shield') this.shieldProjectile=shot;
                if (type==='gunBurst') this.knuckleCharge=false;
            }
            if (move.spec.drop && !move.bounced && !this.isGrounded && i>=2) this.vy=Math.max(this.vy,12);
            if (key==='chainAir' && i>=1 && !move.anchor) {
                const wall=move.direction>0?HIGHWAY_WALLS[1].x:HIGHWAY_WALLS[0].x;
                if (Math.abs(wall-center(this))<220) {
                    move.anchor=wall;
                    this.vy=-8;
                }
            }
            updateRobotMove(this);
            if (!this.robotMove && move.chain && this.isGrounded) {
                const sequence=tripleCombo.includes(key)?tripleCombo:saberCombo;
                const next=sequence[sequence.indexOf(key)+1];
                if (next) this.beginWeapon(next,move.target,move.direction);
            }
        }
        const contact=getTouchedWall(this);
        const away=contact?.side==='left'?this.controls.right:this.controls.left;
        if (this.shieldBrokenUntil && now>=this.shieldBrokenUntil) {
            this.shieldBrokenUntil=0;
            this.shieldIntegrity=SHIELD_MAX/2;
        }
        const holdingShield=this.keys[this.controls.heavy] && this.shieldAvailable(now);
        const slide=contact && this.canAct() && !(this.wallDetachUntil>now) &&
            (!this.keys[away] || holdingShield || this.busterCharging);
        const airborneDash=!this.isGrounded && this.airDashUntil>now;
        if (slide && !airborneDash && !move?.spec.drop) this.vy=2.35-this.gravity;
        if (airborneDash) this.vy=-this.gravity;
        super.update(opponentX,self);
        if (airborneDash) this.x=bound(beforeX+this.airDashDir*15,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-this.width);
        else if (!this.isGrounded && now-(this.wallHopAt??-Infinity)<105) {
            this.x=bound(beforeX+this.wallHopDir*7,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-this.width);
            this.wallSliding=false;
        } else if (slide && !this.isGrounded && !move?.spec.drop) {
            this.x=contact.side==='left'?HIGHWAY_WALLS[0].x:HIGHWAY_WALLS[1].x-this.width;
            this.vx=0;
            this.wallSliding=true;
        } else if (move?.anchor && this.robotMove===move) {
            this.x=bound(this.x+move.direction*11,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-this.width);
        } else if (move?.spec.speed && this.robotMove===move) updateRobotMove(this,true);
        if (!beforeGround && this.isGrounded && move?.spec.key==='recoilDown' && !move.bounced) {
            this.isGrounded=false;
            this.vy=-16.25;
            move.bounced=true;
        }
        if (this.isGrounded) this.airDashUsed=false;
        if (beforeGround && !this.isGrounded) this.trailUntil=now+190;
        const wall=getTouchedWall(this);
        const dir=wall?(wall.side==='left'?1:-1):opponentX>=this.x?1:-1;
        this.shieldDir=dir;
        this.shieldUp=Boolean(holdingShield && !this.robotMove && !(this.shotUntil>now) && this.canAct());
        if (this.shieldUp || this.shieldProjectile?.active || this.shieldBrokenUntil) this.shieldStowedAt=now;
        else {
            const since=Math.max(this.shieldTickAt??now,(this.shieldStowedAt??now)+SHIELD_STOW_MS);
            this.shieldIntegrity=Math.min(SHIELD_MAX,this.shieldIntegrity+
                Math.max(0,now-since)*SHIELD_REGEN_PER_MS);
        }
        this.shieldTickAt=now;
        if (this.shieldUp && this.isGrounded && !this.isDashing) {
            this.vx *= .65;
            this.x=bound(beforeX+this.vx,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-this.width);
        }
        const moving=Math.abs(this.vx)>.2;
        let key='idle', facing=moving&&!this.isGuarding?Math.sign(this.vx):dir;
        if (this.wasInAirFromKnockback) key='knock';
        else if (now-(this.hurtAt??-Infinity)<145) key='hurt';
        else if (this.isVulnerable) key='rise';
        else if (this.shieldUp) {key=wall?'guardWall':this.isGrounded?'guard':'guardAir';facing=dir;}
        else if (this.shotUntil>now) {
            key=wall?'busterWall':airborneDash||this.isDashing?'busterDash':!this.isGrounded?'busterAir':moving?'busterRun':'buster';
            facing=wall?dir:this.shotDir;
        } else if (airborneDash) {key='airDash';facing=this.airDashDir;}
        else if (!this.isGrounded && now-(this.wallHopAt??-Infinity)<175) {key='wallKick';facing=this.wallHopDir;}
        else if (wall) {key=this.busterCharging?'busterWallReady':'wall';facing=dir;}
        else if (!this.isGrounded) key=this.vy<0?'jump':'fall';
        else if (this.isDashing) {key='dash';facing=this.dashDirection;}
        else if (this.isCrouching) key='crouch';
        else if (moving) key='run';
        else if (this.busterCharging) key='busterReady';
        if (key!==this.pose.key || facing!==this.pose.dir) this.pose={key,at:now,dir:facing};
        if (now>=this.trailSampleAt || this.trailSampleAt==null) {
            this.trailSampleAt=now+31;
            if (now<this.trailUntil || (this.busterCharging&&moving)) {
                const sprite=this.getPixelBodyFrame();
                if (sprite) this.trail.push({sprite:hologramFrame(sprite),at:now});
            }
            this.trail=this.trail.filter(ghost=>now-ghost.at<148);
        }
    }

    bodyPose() {
        const now=combatNow();
        let {key,at,dir}=this.pose;
        let ms=key==='idle'?118:key==='run'?62:55;
        if (this.robotMove) {
            const {spec,started,direction}=this.robotMove;
            key=spec.pose;at=started;dir=direction;ms=spec.ms;
        }
        if (this.isIntroActive) {
            const age=now-this.entryAt;
            key=this.entry==='cloak'&&age>730?'idle':this.entry;at=this.entryAt;ms=key==='beam'?62:49;
        }
        const count=MM_ZERO_FRAMES[key].length;
        const tick=Math.floor((now-at)/ms);
        const index=['idle','run','guard','guardAir','guardWall','busterRun'].includes(key)?tick%count:tick;
        if (['wall','guardWall','busterWall','busterWallReady','shieldWallThrow','airDash'].includes(key)) dir=-dir;
        return {key,index,dir};
    }

    getPixelBodyFrame() {
        const {key,index,dir}=this.bodyPose();
        const scale=this.height/45;
        const wall=getTouchedWall(this);
        let x=center(this);
        if (wall && ['wall','guardWall','busterWall','busterWallReady','shieldWallThrow'].includes(key)) {
            x=wall.x+(wall.side==='left'?1:-1)*18*scale;
        }
        return renderFrame(key,index,x,feet(this),scale,dir);
    }
    pixelBodyIntersectsRect(rect) { return opaqueInRect(this.getPixelBodyFrame(),rect); }

    draw() {
        const now=combatNow(), x=center(this), y=feet(this);
        for (const ghost of this.trail) drawRobotFrame(ctx,ghost.sprite,game.cameraX,.37*(1-(now-ghost.at)/148));
        drawRobotFrame(ctx,this.getPixelBodyFrame(),game.cameraX);
        if (this.busterCharging && (game.mode==='practice'||now-this.busterChargeStart>135)) {
            const age=now-this.busterChargeStart;
            const level=game.mode==='practice'||age>=1180?3:age>=480?2:1;
            const phase=Math.floor(Math.max(0,age)/50);
            for(let i=0;i<level;i++) {
                const t=(phase+i*3)%9;
                const dir=i%2?1:-1;
                drawRobotFrame(ctx,renderFrame('chargeFx',(phase+i)%5,
                    x+dir*(36-t*3),y-this.height*.27-t*7,2.55,dir),game.cameraX);
            }
        }
        const move=this.robotMove;
        if (move?.spec.key.startsWith('chain')) {
            const age=now-move.started, extent=age<164?Math.min(1,age/133):Math.max(0,1-(age-164)/125);
            const start=x+move.direction*35, end=move.anchor??start+move.direction*180*extent;
            const baseY=this.y+this.height*.47;
            ctx.save();ctx.strokeStyle='#88ebbc';ctx.lineWidth=3;ctx.setLineDash([6,4]);
            ctx.beginPath();ctx.moveTo(start-game.cameraX,baseY);ctx.lineTo(end-game.cameraX,baseY-(move.anchor?56:0));ctx.stroke();
            ctx.restore();
        }
        if (this.isIntroActive && this.entry==='cloak') {
            const age=now-this.entryAt;
            if (age>=705) {
                const t=(age-705)/455,dir=this.pose.dir;
                drawRobotFrame(ctx,renderFrame('cape',0,x-dir*(31+t*150),y-24-t*67,this.height/45,dir),
                    game.cameraX,Math.max(0,1-t));
                ctx.save();ctx.fillStyle='#bda277';
                for (let i=0;i<8;i++) {
                    ctx.globalAlpha=Math.max(0,.45*(1-t));
                    ctx.beginPath();ctx.arc(x-game.cameraX+(i-4)*(13+t*18),y-2-Math.sin(i)*10-t*16,4+t*7,0,Math.PI*2);ctx.fill();
                }
                ctx.restore();
            }
        }
    }
}

export function mmZeroAnimations() {
    const names={idle:'Reposo',run:'Carrera',jump:'Salto',fall:'Caída',crouch:'Postura baja',dash:'Dash',airDash:'Dash aéreo',
        wall:'Deslizamiento de pared',wallKick:'Salto de pared',hurt:'Impacto',knock:'Derribo',rise:'Recuperación',
        beam:'Intro de rayo',cloak:'Intro de gabardina',cape:'Tela al soltarse',buster:'Buster Shot',busterAir:'Buster en aire',
        busterRun:'Buster corriendo',busterDash:'Buster en dash',busterWall:'Buster en pared',busterReady:'Buster preparado',
        busterWallReady:'Carga Buster en pared',guard:'Shield Boomerang',guardAir:'Escudo en aire',guardWall:'Escudo en pared',
        shieldThrow:'Lanzamiento del escudo',shieldWallThrow:'Escudo lanzado desde pared',saberA:'Z-Saber · corte 1',
        saberB:'Z-Saber · corte 2',saberC:'Z-Saber · corte 3',saberDash:'Corte en dash',saberAir:'Corte aéreo',
        triple:'Triple Rod',tripleUp:'Triple Rod ascendente',tripleAir:'Triple Rod en aire',tripleUpAir:'Triple Rod ascendente en aire',
        tripleExtend:'Triple Rod · segunda extensión',tripleMax:'Triple Rod · extensión máxima',chain:'Chain Rod',chainAir:'Chain Rod aéreo',
        recoil:'Recoil Rod',recoilDown:'Salto con Recoil Rod',knuckle:'Z Knuckle',knuckleAir:'Z Knuckle aéreo',
        saberWave:'Onda del Z-Saber',saberDive:'Corte descendente',recoilEX:'Disparo Recoil EX',bullet:'Disparo Buster',
        charged:'Buster cargado',chargeFx:'Chispas nativas de carga',gunBurst:'Ráfaga de Z Knuckle',shieldDisc:'Disco Shield Boomerang',waveFx:'Onda separada del sable'};
    return Object.entries(names).map(([id,name])=>({
        id,name,count:MM_ZERO_FRAMES[id].length,ms:moves[id]?.ms??(id==='idle'?118:65),
        frame(index){return renderFrame(id,index,0,0,1,1);}
    }));
}
