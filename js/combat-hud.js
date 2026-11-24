import { deviceFor, usingXbox } from './input-labels.js';
import { canAssist } from './team-assists.js';
import { ctx, game } from './state.js';

const files = {
    rock:'Mega Man', protoman:'Proto Man', 'metal-sonic':'Metal Sonic', 'megaman-zero':'MMZero',
    zero:'zero', x:'X', sonic:'Sonic', shadow:'Shadow', silver:'Silver', bass:'Bass',
    emerl:'Emerl', espio:'Espio', knuckles:'Knuckles', eggman:'Eggman', chaos:'Chaos', tails:'Tails', wily:'Wily'
};
const leftFacing = new Set(['silver','zero','emerl','megaman-zero']);
const load = name => {
    const image = new Image();
    image.src = 'assets/hud/' + encodeURIComponent(name) + '.png';
    return image;
};
const faces = Object.fromEntries(Object.entries(files).map(([id,name]) => [id,load(name)]));
const frames = [load('marcoP1'),load('marcoP2')];
const display = new WeakMap();
const clamp = value => Math.max(0,Math.min(1,value));
export const RESERVE_HEAL_PER_SECOND = 5;

export function tickReserveHealth(now) {
    const elapsed = Math.max(0,now-(game.reserveRecoveryAt ?? now))/1000;
    game.reserveRecoveryAt = now;
    for (const side of ['p1','p2']) for (const fighter of game.teamFighters?.[side] ?? []) {
        if (fighter.health <= 0 || fighter === game[side] || game.teamAssists?.[side]?.reserve === fighter ||
            game.silverAssist?.[side]?.silver === fighter || game.eggAssists?.[side]?.reserve === fighter) continue;
        const heal = Math.max(0, Math.min(fighter.recoverableHealth || 0, fighter.maxHealth-fighter.health, elapsed*RESERVE_HEAL_PER_SECOND));
        fighter.health += heal;
        fighter.recoverableHealth = Math.max(0,(fighter.recoverableHealth || 0)-heal);
    }
}

function polygon(x,y,w,h,inset=12) {
    ctx.beginPath();
    ctx.moveTo(x+inset,y); ctx.lineTo(x+w-inset,y); ctx.lineTo(x+w,y+h/2);
    ctx.lineTo(x+w-inset,y+h); ctx.lineTo(x+inset,y+h); ctx.lineTo(x,y+h/2); ctx.closePath();
}

function plate(x,y,w,h,color,inset) {
    polygon(x,y,w,h,inset);
    const fill=ctx.createLinearGradient(0,y,0,y+h);
    fill.addColorStop(0,'#365477'); fill.addColorStop(.22,'#071022'); fill.addColorStop(.8,'#0b1431'); fill.addColorStop(1,'#25334e');
    ctx.fillStyle=fill; ctx.fill();
    ctx.strokeStyle=color; ctx.lineWidth=5; ctx.stroke();
    ctx.strokeStyle='#edf6ff'; ctx.lineWidth=1.4; ctx.stroke();
}

function portrait(f,x,y,size,right,unavailable) {
    const img=faces[f.characterId];
    ctx.save();
    ctx.imageSmoothingEnabled=true;
    if (f.health<=0) { ctx.filter='grayscale(1)'; ctx.globalAlpha=.43; }
    else if (unavailable) ctx.globalAlpha=.48;
    ctx.save();
    polygon(x+3,y+7,size-6,size-14,size*.23); ctx.clip();
    if (img?.naturalWidth) {
        if (right !== leftFacing.has(f.characterId)) {
            ctx.translate(2*x+size,0); ctx.scale(-1,1);
        }
        ctx.drawImage(img,x,y,size,size);
    } else {
        ctx.fillStyle='#90b2d0'; ctx.font='900 18px system-ui'; ctx.textAlign='center';
        ctx.fillText((f.characterName || f.characterId).slice(0,2).toUpperCase(),x+size/2,y+size/2);
    }
    ctx.restore();
    const frame=frames[Number(right)];
    if(frame.naturalWidth) {
        const height=size*frame.naturalHeight/frame.naturalWidth;
        ctx.drawImage(frame,x,y+(size-height)/2,size,height);
    }
    ctx.restore();
}

export function drawCombatHud(now,remaining) {
    for (const [index,side] of ['p1','p2'].entries()) {
        const right=Boolean(index), color=right?'#ff4878':'#29aaff', active=game[side];
        const reflect=(x,w)=>right?1280-x-w:x;
        const team=game.teamFighters?.[side] ?? [active];
        const fighters=[active,...team.filter(f=>f!==active)];
        const rival = game[right?'p1':'p2'];
        const assistOnScreen = game.teamAssists?.[side] || game.silverAssist?.[side] || game.eggAssists?.[side];
        const locked = Boolean(assistOnScreen || active.health<=0 || active.tagLockedUntil>now);
        const tag= game.tagEffects?.findLast(effect=>effect.side===side);
        fighters.forEach((f,i)=>{
            const main=i===0, y=main?39:116+(i-1)*35, w=main?473:260, h=main?62:28;
            const bx=main?88:83, x=reflect(bx,w);
            plate(x,y,w,h,color);
            const barY=y+(main?34:7), barH=main?20:13, barW=w-(main?32:26), barX=x+(w-barW)/2;
            const green=clamp(f.health/f.maxHealth), red=f.health>0?clamp((f.health+(f.recoverableHealth||0))/f.maxHealth):0;
            const prev=display.get(f) ?? {green,power:f.power || 0,at:now};
            const dt=Math.max(0,now-prev.at), shown=f.health>0?Math.min(red,green+(prev.green-green)*Math.exp(-dt/55)):0;
            display.set(f,{green:shown,power:prev.power,at:now,dt});
            ctx.save();
            polygon(barX,barY,barW,barH,8); ctx.clip();
            for (const [ratio,light,dark] of [[1,'#222941','#101324'],[red,'#ff7991','#ae082c'],[shown,'#baff64','#24ac18']]) {
                const g=ctx.createLinearGradient(0,barY,0,barY+barH);
                g.addColorStop(0,light); g.addColorStop(.42,light); g.addColorStop(.49,dark); g.addColorStop(1,dark);
                ctx.fillStyle=g; ctx.fillRect(right?barX+barW*(1-ratio):barX,barY,barW*ratio,barH);
            }
            ctx.strokeStyle='#ffffff38'; ctx.lineWidth=1;
            for(let k=0;k<barW;k+=30) {
                ctx.beginPath();ctx.moveTo(barX+k+14,barY);ctx.lineTo(barX+k,barY+barH);ctx.stroke();
            }
            ctx.restore();
            const size=main?110:55;
            const py=y+(h-size)/2;
            const slide=tag && (main || f===tag.outgoing)? Math.max(0,1-(now-tag.startedAt)/220)*14 : 0;
            const assistWait = Math.max(0,(f.teamAssistReadyAt || 0)-now);
            const tagWait = Math.max(0,(game.tagCooldowns?.[side] || 0)-now);
            const assistReady = !locked && !active.shadowFrozenBy && canAssist(f) && !assistWait &&
                ['0','go'].includes(game.countdown?.phase);
            const tagReady = !locked && f.health>0 && !tagWait &&
                !(rival?.grabConnected && !rival.grabThrown && rival.grabTarget===active);
            portrait(f,reflect((main?14:42)-slide,size),py,size,right,
                !main && (!assistReady || !tagReady));
            ctx.textAlign=right?'right':'left';
            ctx.fillStyle='#fff'; ctx.font='italic 900 20px system-ui';
            if(main) ctx.fillText((f.characterId==='megaman-zero'?'MM Zero':f.characterName || f.characterId).toUpperCase(),right?x+w-44:x+44,y+24,w-86);
            else {
                ctx.font='800 9px system-ui';
                const status = f.health<=0 ? 'KO' : [
                    'ASIST. '+(assistReady?'✓':assistWait?Math.ceil(assistWait/1000)+' s':'—'),
                    'RELEVO '+(tagReady?'✓':tagWait?Math.ceil(tagWait/1000)+' s':'—')
                ].join(' · ');
                const textX = right ? x+20 : x+w-20;
                ctx.strokeStyle='#081022'; ctx.lineWidth=3; ctx.strokeText(status,textX,y+24);
                ctx.fillText(status,textX,y+24);
            }
        });
        const power=active.power || 0, level=Math.floor(power/100), max=active.maxPower||100;
        const visual=display.get(active);
        visual.power=power+(visual.power-power)*Math.exp(-visual.dt/80);
        plate(reflect(81,410),666,410,31,color);
        for(let j=0;j<5;j++){
            const x=reflect(115+j*70,64), y=674;
            ctx.save(); polygon(x,y,64,15,6); ctx.clip();
            ctx.fillStyle='#242c46';ctx.fillRect(x,y,64,15);
            const amount=64*clamp((visual.power-j*100)/100);
            ctx.fillStyle=color;ctx.shadowColor=color; ctx.shadowBlur=level*2;
            ctx.fillRect(right?x+64-amount:x,y,amount,15);
            ctx.restore();
        }
        plate(reflect(22,97),646,97,65,color,22);
        ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='italic 950 31px system-ui';
        const cx=right?1209:71;
        ctx.fillText(level,cx,678);
        ctx.font='italic 900 11px system-ui';ctx.fillText('NIVEL',cx,696);
        ctx.textAlign=right?'right':'left';ctx.fillStyle='#e4f3ff';ctx.font='800 11px system-ui';
        const labels=[];
        if(active.maxFuel) labels.push('COMBUSTIBLE '+Math.floor(active.fuel)+'%');
        if(active.weaponLabel) labels.push(active.weaponLabel);
        if(active.weaponAmmo?.[active.weaponSet]!=null) labels.push('MUNICIÓN '+Math.floor(active.weaponAmmo[active.weaponSet]));
        if(active.shieldMaxIntegrity) labels.push(active.shieldBrokenUntil>now?'ESCUDO ROTO':'ESCUDO '+Math.ceil(100*active.shieldIntegrity/active.shieldMaxIntegrity)+'%');
        if(active.leafShield?.active&&!active.leafShield.thrown) labels.push('HOJAS '+active.leafShield.leaves.filter(leaf=>leaf.alive).length+'/4');
        if(active.characterId==='emerl') labels.push('PODER '+Math.floor(power)+'/'+max);
        if(active.superSilver||active.superSonic||active.isSuperShadow) labels.push('SUPER');
        if(team.length>1) labels.push(usingXbox(side)
            ? (deviceFor(side)==='playstation'?'L1 PERSONAJE 2 · L2 PERSONAJE 3':'LB PERSONAJE 2 · LT PERSONAJE 3')+' · MANTÉN PARA RELEVO'
            : (right?'’':'U')+' PERSONAJE 2 · ABAJO + '+(right?'’':'U')+' PERSONAJE 3 · MANTÉN PARA RELEVO');
        ctx.fillText(labels.join('  ·  '),right?1254:26,637,560);
    }
    plate(557,46,88,60,'#299aff',16); plate(635,46,88,60,'#ff4878',16);
    plate(578,32,124,91,'#bddeff',30);
    ctx.textAlign='center'; ctx.fillStyle=typeof remaining==='number'&&remaining<=10?'#ff87a0':'#fff';
    ctx.font='italic 950 52px system-ui';ctx.fillText(remaining,640,98);
}
