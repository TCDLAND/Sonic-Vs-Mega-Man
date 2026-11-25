import { game } from './state.js';
import { GAME_STATE } from './config.js';
import { combatNow, setSimulatedCombatTime } from './combat-clock.js';
import { startBattle } from './battle.js';
import { battleStages } from './battle-stages.js';
import { music } from './music.js';
import { addWinDamage, beginTournamentDamage, endTournamentDamage } from './tournament-damage.js';

const statsKey='svmm-tournament-results-v1';
const TURN_SECONDS=99;
const SIM_SECONDS=28;
const SIMULATION_STALL_TIMEOUT_MS=120000;
const IS_SIMULATION_LANE = new URLSearchParams(location.search).has('simulationLane');
let current, overlay;
let memoryProbe = null;

function beginMemoryProbe() {
    memoryProbe = {
        metric: 'performance.memory.usedJSHeapSize',
        available: Boolean(performance.memory && Number.isFinite(performance.memory.usedJSHeapSize)),
        samples: 0, totalBytes: 0, peakBytes: 0, lastSampleAt: 0
    };
}

export function sampleTournamentMemory(now = performance.now()) {
    if ((!current?.simulate && !current?.parallel) || !memoryProbe || now - memoryProbe.lastSampleAt < 500) return;
    memoryProbe.lastSampleAt = now;
    const bytes = performance.memory?.usedJSHeapSize;
    if (!Number.isFinite(bytes)) return;
    memoryProbe.samples++;
    memoryProbe.totalBytes += bytes;
    memoryProbe.peakBytes = Math.max(memoryProbe.peakBytes, bytes);
}

function finishMemoryProbe() {
    if (!memoryProbe) return null;
    const result = memoryProbe.available && memoryProbe.samples ? {
        metric: memoryProbe.metric,
        samples: memoryProbe.samples,
        averageMB: Math.round(memoryProbe.totalBytes / memoryProbe.samples / 10485.76) / 100,
        peakMB: Math.round(memoryProbe.peakBytes / 10485.76) / 100,
        scope: 'heap JavaScript informado por el documento principal mientras corren los iframes; el conteo de iframes depende del navegador y no incluye RAM total del proceso ni GPU'
    } : {
        metric: memoryProbe.metric, samples: memoryProbe.samples,
        available: false,
        reason: 'Este navegador no expone performance.memory; no se inventa una cifra.'
    };
    memoryProbe = null;
    return result;
}

function loadStats() {
    if (IS_SIMULATION_LANE) return {version:1,fighters:{},matchups:{},teams:{},completed:{singles:0,teams:0},recent:[]};
    try {
        const data=JSON.parse(localStorage.getItem(statsKey));
        if (data?.version===1) return data;
    } catch {}
    return {version:1,fighters:{},matchups:{},teams:{},completed:{singles:0,teams:0},recent:[]};
}
let stats=loadStats();

function shuffle(values) {
    const result=[...values];
    for(let i=result.length-1;i>0;i--) {
        const j=Math.floor(Math.random()*(i+1));
        [result[i],result[j]]=[result[j],result[i]];
    }
    return result;
}
function poolList(){return [...game.characterSelection.chars];}
function keyOf(entry){return entry.roster.join(' + ');}
function randomRoster(size,pool){ return shuffle(pool).slice(0,size); }

function emptyRoundRobinReport() {
    return {fighters:{},matchups:{},teams:{},recent:[],completedBatches:0,tools:{},toolUses:{},mirrors:{},endings:{},winsByEnding:{},winDamage:{}};
}

function beginRoundRobinRun(options) {
    if(IS_SIMULATION_LANE || options.kind!=='roundRobin') return;
    const roster=[...options.roster];
    const rosterSize=roster.length;
    const expectedMatches=(options.total||1)*(options.mirrors?rosterSize*rosterSize:rosterSize*(rosterSize-1));
    stats.roundRobinLatest=emptyRoundRobinReport();
    stats.roundRobinLatest.run={
        roster, mirrors:Boolean(options.mirrors), repetitions:options.total||1,
        concurrency:options.concurrency||1, expectedMatches, completedMatches:0,
        status:'in-progress', startedAt:new Date().toISOString()
    };
    delete stats.lastSimulationError;
    persist();
}

export function buildBracket(entries) {
    const size=2**Math.ceil(Math.log2(entries.length));
    const playIns=entries.length-size/2;
    let pairs=[],idx=0;
    for(let i=0;i<size/2;i++) {
        const needPair=Math.floor((i+1)*playIns/(size/2))>Math.floor(i*playIns/(size/2));
        pairs.push([entries[idx++],needPair?entries[idx++]:null]);
    }
    return pairs;
}
function createEntries(state) {
    const pool=poolList();
    const player=state.playerRoster;
    if(state.kind==='roster') return shuffle(pool).map(id=>({roster:[id],human:player?.[0]===id}));
    const poolWithoutPlayer=player?pool.filter(id=>!player.includes(id)):pool;
    let singles=[];
    if(state.teamSize===1) {
        while(singles.length<state.size) singles.push(...shuffle(poolWithoutPlayer));
    }
    return shuffle(Array.from({length:state.size},(_,i)=>{
        if(i===0&&player) return {roster:player,human:true};
        const source=poolWithoutPlayer.length>=state.teamSize?poolWithoutPlayer:pool;
        return {roster:state.teamSize===1?[singles.pop()]:randomRoster(state.teamSize,source),human:false};
    }));
}
function newBracket() {
    current.round=1;
    current.pairs=buildBracket(createEntries(current));
    current.advancers=[];
    current.bracketMatch=0;
}
function persist() {
    if (IS_SIMULATION_LANE) return;
    try { localStorage.setItem(statsKey,JSON.stringify(stats)); }
    catch { if(current) current.storageFailed=true; }
}
function record(a,b,winner,reason) {
    const aKey=keyOf(a),bKey=keyOf(b);
    const elapsed=Math.round((combatNow()-current.matchAt)/1000);
    const defeated=winner==='p1'?game.p2:game.p1;
    const damage=endTournamentDamage(winner,reason,defeated);
    if(a.human||b.human) return;
    const isLab = current.kind==='roundRobin';
    const report = isLab
        ? stats.roundRobin ??= {fighters:{},matchups:{},teams:{},recent:[],completedBatches:0,tools:{},mirrors:{}}
        : stats;
    const reports=isLab
        ? [report,...(!IS_SIMULATION_LANE&&stats.roundRobinLatest?[stats.roundRobinLatest]:[])]
        : [report];
    const tools = {p1:game.cpuAgentP1?.actionCounts ?? {},p2:game.cpuAgentP2?.actionCounts ?? {}};
    if (isLab) damage.cpuActions = tools;
    const tally=winner==='draw'?null:winner==='p1'?aKey:bKey;
    for(const targetReport of reports) {
      if (isLab) {
        const endings = targetReport.endings ??= {};
        endings[reason]=(endings[reason]??0)+1;
        for (const [side,id] of [['p1',aKey],['p2',bKey]]) {
            const counts = targetReport.tools[id] ??= {};
            for (const [action,total] of Object.entries(tools[side])) counts[action]=(counts[action]??0)+total;
            const uses = (targetReport.toolUses ??= {})[id] ??= {};
            for (const [tool,total] of Object.entries(damage[side].toolUses)) uses[tool]=(uses[tool]??0)+total;
        }
        if (aKey===bKey) {
            const mirror=targetReport.mirrors[aKey]??={blueWins:0,redWins:0,draws:0,lowDamage:0};
            mirror[winner==='draw'?'draws':winner==='p1'?'blueWins':'redWins']++;
            const totalDamage=[...damage.p1.attacks,...damage.p2.attacks].reduce((sum,hit)=>sum+hit.damage,0);
            if (reason==='time' && totalDamage<15) mirror.lowDamage++;
        }
      }
      if(current.teamSize===1 && tally!==null && (reason==='ko'||reason==='time')) {
        const endingsByFighter=targetReport.winsByEnding??={};
        const row=endingsByFighter[tally]??={ko:0,time:0};
        row[reason]=(row[reason]??0)+1;
      }
      const table=current.teamSize===1?targetReport.fighters:targetReport.teams;
      for(const [side,id] of isLab && aKey===bKey?[]:[['p1',aKey],['p2',bKey]]) {
        const row=table[id]??={wins:0,losses:0,draws:0};
        row[tally===null?'draws':winner===side?'wins':'losses']++;
      }
      if(current.teamSize===1 && (!isLab || aKey!==bKey)) {
        for(const [actor,enemy,side] of [[aKey,bKey,'p1'],[bKey,aKey,'p2']]) {
            const row=targetReport.matchups[actor]??={};
            const entry=row[enemy]??={wins:0,losses:0,draws:0};
            entry[tally===null?'draws':winner===side?'wins':'losses']++;
        }
      }
      if (damage && tally !== null && current.teamSize===1 && (!isLab || aKey!==bKey)) {
        const byFighter = targetReport.winDamage ??= {};
        const row = byFighter[tally] ??= {
            trackedWins: 0, winsWithoutLeadingCategory: 0, winsLedBy: {}, attacks: {}, finishingAttacks: {}
        };
        addWinDamage(row, damage[winner].attacks, damage.finishingHit);
      }
      targetReport.recent.push({blue:aKey,red:bKey,winner:tally,winnerSide:winner,reason,seconds:elapsed,damage});
      if(targetReport.recent.length>(isLab?60:150))targetReport.recent.shift();
    }
    if(isLab && stats.roundRobinLatest?.run) stats.roundRobinLatest.run.completedMatches++;
    persist();
}
function showStatus() {
    if(!overlay || !current)return;
    const {status,next,bracket}=overlay;
    const isLab=current.kind==='roundRobin';
    status.textContent=(isLab?'Todos contra todos · '+current.matches+'/'+(current.pairs.length*current.total)+' combates'
        :'Torneo '+(current.finished+1)+'/'+current.total+' · ronda '+current.round
        +' · '+current.matches+' combates')
        +(current.activePair?' · '+current.activePair.map(keyOf).join(' vs. '):'')
        +(current.storageFailed?' · Sesión sin guardar':'');
    next.hidden=!current.waiting;
    if (!isLab) bracket.textContent=current.pairs.map(([a,b])=>b?keyOf(a)+' vs. '+keyOf(b):keyOf(a)+' · pasa de ronda').join('\n')
        || 'Último cruce de la ronda';
}
function launch([first,second],swap=false) {
    const pair=swap?[second,first]:[first,second];
    current.activePair=pair;
    current.waiting=false;
    game.battleStage=battleStages[0];
    game.mode=current.teamSize===3?'team':'cpu';
    game.controlOverrides={p1:!pair[0].human,p2:!pair[1].human};
    game.tournamentSeconds=current.simulate?SIM_SECONDS:TURN_SECONDS;
    startBattle({rosters:pair.map(entry=>entry.roster),isolateCpu:current.simulate});
    if (pair.every(entry=>!entry.human)) beginTournamentDamage(game.teamFighters);
    if(current.simulate) {
        for(const fighter of [game.p1,game.p2]) {
            fighter.isIntroActive=false;fighter.introDone=true;
            if(fighter.state==='intro') fighter.setState?.('idle');
        }
        game.countdown={phase:'go',phaseStartedAt:combatNow()};
    } else music.play(game.battleStage.track);
    current.matchAt=combatNow();
    showStatus();
}
function advance() {
    if(!current || current.activePair)return;
    while(current.pairs.length) {
        const pair=current.pairs.shift();
        if(pair[1]) { launch(pair,pair[1].human || !pair[0].human&&Math.random()<.5); return; }
        current.advancers.push(pair[0]);
    }
    if(current.advancers.length===1) {
        const champion=current.advancers[0];
        if(current.simulate) {
            stats.completed[current.teamSize===1?'singles':'teams']++;
            const table=current.teamSize===1?stats.fighters:stats.teams;
            const row=table[keyOf(champion)]??={wins:0,losses:0,draws:0};
            row.titles=(row.titles||0)+1;
            persist();
        }
        current.finished++;
        if(current.finished>=current.total) {finish('Campeón: '+keyOf(champion));return;}
        newBracket();
        advance();
        return;
    }
    current.pairs=buildBracket(current.advancers);
    current.advancers=[];
    current.round++;
    advance();
}
export function tournamentResult(winner,reason) {
    if(!current?.activePair)return false;
    const pair=current.activePair;
    record(...pair,winner,reason);
    current.matches++;
    if (current.kind==='roundRobin') {
        if (IS_SIMULATION_LANE && window.parent !== window) {
            window.parent.postMessage({type:'svmm-simulation-progress',laneId:current.laneId,
                matches:current.matches,total:current.pairs.length*current.total},location.origin);
        }
        if(current.matches===current.pairs.length*current.total) {
            stats.roundRobin.completedBatches++;
            if(!IS_SIMULATION_LANE&&stats.roundRobinLatest) {
                stats.roundRobinLatest.completedBatches=1;
                Object.assign(stats.roundRobinLatest.run,{completedMatches:current.matches,status:'complete',finishedAt:new Date().toISOString()});
            }
            persist();
            finish('Todos contra todos completo');
        } else launch(current.pairs[current.matches%current.pairs.length]);
        return true;
    }
    if(winner==='draw' && !current.replaying) {
        current.replaying=true; launch(pair,true); return true;
    }
    // Both draws are kept in the statistics. This only selects the advancing entry.
    const idx=winner==='draw'?Number(Math.random()<.5):winner==='p2'?1:0;
    current.advancers.push(pair[idx]);
    current.activePair=null;
    current.replaying=false;
    if(current.simulate) advance();
    else {
        current.waiting=true;
        game.gameState=GAME_STATE.MODE;
        showStatus();
    }
    return true;
}
function finish(message) {
    const done=current;
    if (done?.simulate) {
        if(done.kind==='roundRobin'&&stats.roundRobinLatest?.run?.status==='in-progress') {
            const expected=done.pairs.length*done.total;
            Object.assign(stats.roundRobinLatest.run,{completedMatches:done.matches,
                status:done.matches>=expected?'complete':'interrupted',finishedAt:new Date().toISOString()});
            stats.roundRobinLatest.completedBatches=done.matches>=expected?1:0;
        }
        const measurement = finishMemoryProbe();
        stats.lastSimulationMemory = {
            concurrency: done.parallel ? 2 : 1,
            matches: done.matches,
            measurement
        };
        if (measurement?.averageMB != null) {
            const aggregate = stats.simulationMemoryAggregate ??= { runs: 0, samples: 0, totalAverageMB: 0, peakMB: 0 };
            aggregate.runs++;
            aggregate.samples += measurement.samples;
            aggregate.totalAverageMB += measurement.averageMB;
            aggregate.peakMB = Math.max(aggregate.peakMB, measurement.peakMB);
            aggregate.averageMB = Math.round(aggregate.totalAverageMB / aggregate.runs * 100) / 100;
        }
        if(stats.roundRobinLatest?.run) stats.roundRobinLatest.run.memory=measurement;
        persist();
    }
    if (IS_SIMULATION_LANE && window.parent !== window) {
        current=null;
        endTournamentDamage();
        setSimulatedCombatTime(null);
        game.tournamentSeconds=null;game.isolateCpu=false;game.controlOverrides=null;
        game.quietSimulation=false;game.gameState=GAME_STATE.MODE;
        if(overlay) {overlay.box.remove();overlay=null;}
        window.parent.postMessage({type:'svmm-simulation-lane-finished',laneId:done?.laneId,
            report:stats.roundRobin ?? null,matches:done?.matches ?? 0,
            error:stats.lastSimulationError ?? null,
            memory:stats.lastSimulationMemory?.measurement ?? null},location.origin);
        return;
    }
    if(done?.parallel) {
        window.removeEventListener('message',done.laneMessageHandler);
        window.clearTimeout(done.startTimeout);window.clearTimeout(done.stopFallback);
        window.clearInterval(done.memoryStatusTimer);
        current=null;
        endTournamentDamage();
        setSimulatedCombatTime(null);
        game.tournamentSeconds=null;game.isolateCpu=false;game.controlOverrides=null;
        game.quietSimulation=false;game.gameState=GAME_STATE.MODE;
        if(overlay) {overlay.box.remove();overlay=null;}
        music.stop();
        showReport(message+' · '+done.matches+' combates',true);
        return;
    }
    current=null;
    endTournamentDamage();
    setSimulatedCombatTime(null);
    game.tournamentSeconds=null;
    game.isolateCpu=false;
    game.controlOverrides=null;
    game.quietSimulation=false;
    game.gameState=GAME_STATE.MODE;
    if(overlay) {overlay.box.remove();overlay=null;}
    music.stop();
    showReport(message+(done?.simulate?' · '+done.matches+' combates':''),done?.kind==='roundRobin');
}

export function tournamentSimulationActive(){return Boolean(current?.simulate);}
export function tournamentSimulationPaused(){return Boolean(current?.paused);}
export function tournamentRunning(){return Boolean(current);}
export function tournamentWaiting(){return Boolean(current?.waiting);}
export function cancelTournament(){
    if(!current)return;
    if(current.parallel) {
        current.stopRequested=true;
        if(current.status)current.status.textContent='Deteniendo ambos combates…';
        for(const frame of current.frames ?? [])frame.contentWindow?.postMessage({type:'svmm-simulation-stop'},location.origin);
        return;
    }
    finish('Torneo detenido');
}
export function interruptTournamentSimulation(error){
    if(!current?.simulate)return;
    const [blue,red]=current.activePair?.map(keyOf) ?? [];
    stats.lastSimulationError={
        format:current.kind, match:current.matches+1, blue, red,
        message:error instanceof Error?error.message:String(error)
    };
    if(stats.roundRobinLatest?.run) Object.assign(stats.roundRobinLatest.run,{
        completedMatches:current.matches,status:'interrupted',finishedAt:new Date().toISOString(),error:stats.lastSimulationError
    });
    persist();
    finish('Simulación detenida en el combate '+(current.matches+1)+
        (blue&&red?' · '+blue+' vs. '+red:''));
}
export function startTournament(options) {
    if(current)return;
    beginRoundRobinRun(options);
    if(options.kind==='roundRobin'&&options.concurrency===2&&!IS_SIMULATION_LANE) {
        startParallelRoundRobin(options);
        return;
    }
    current={...options,finished:0,matches:0};
    if(current.simulate) { setSimulatedCombatTime(combatNow()); beginMemoryProbe(); }
    const box=document.createElement('aside');
    box.className='tournament-status';
    const status=document.createElement('span');
    const next=document.createElement('button');next.textContent='Continuar';next.onclick=advance;
    const stop=document.createElement('button');stop.textContent='Detener';stop.onclick=cancelTournament;
    const details=document.createElement('details'),summary=document.createElement('summary'),bracket=document.createElement('pre');
    summary.textContent='Cuadro de esta ronda';details.append(summary,bracket);
    box.append(status,next,stop,details);document.body.append(box);
    overlay={box,status,next,bracket};
    if (options.kind==='roundRobin') {
        game.quietSimulation=!IS_SIMULATION_LANE;
        music.stop();
        const pause=button('Pausar',()=>{
            current.paused=!current.paused;
            pause.textContent=current.paused?'Reanudar':'Pausar';
        });
        box.insertBefore(pause,stop);
        const entries=options.roster.map(id=>({roster:[id]}));
        current.pairs=options.lanePairs
            ? options.lanePairs.map(([a,b])=>[{roster:[a]},{roster:[b]}])
            : entries.flatMap((a,i)=>entries.slice(i).flatMap(b=>a===b?
                options.mirrors?[[a,b]]:[]:[[a,b],[b,a]]));
        details.hidden=true;
        if(current.pairs.length) launch(current.pairs[0]);
        else finish('Carril sin combates');
    } else {
        newBracket();
        advance();
    }
}

function mergeObjectCounts(target,source) {
    for(const [key,value] of Object.entries(source ?? {})) {
        if(key==='recent' && Array.isArray(value)) {
            target.recent=[...(target.recent ?? []),...value].slice(-60);
        } else if(Number.isFinite(value)) {
            if(key!=='completedBatches') target[key]=(target[key] ?? 0)+value;
        } else if(value && typeof value==='object' && !Array.isArray(value)) {
            target[key] ??= {};
            mergeObjectCounts(target[key],value);
        } else if(!(key in target)) target[key]=value;
    }
}

function startParallelRoundRobin(options) {
    const matches=[];
    for(let repeat=0;repeat<options.total;repeat++) {
        for(let i=0;i<options.roster.length;i++) {
            for(let j=options.mirrors?i:i+1;j<options.roster.length;j++) {
                if(i===j) matches.push([options.roster[i],options.roster[i]]);
                else matches.push([options.roster[i],options.roster[j]],[options.roster[j],options.roster[i]]);
            }
        }
    }
    const lanePairs=[[],[]];
    matches.forEach((pair,index)=>lanePairs[index%2].push(pair));
    const previousBatches=stats.roundRobin?.completedBatches ?? 0;
    current={...options,kind:'roundRobin',simulate:false,parallel:true,matches:0,totalMatches:matches.length,
        previousBatches,laneDone:[false,false],laneMatches:[0,0],laneReports:[null,null],frames:[]};
    if(stats.roundRobinLatest?.run) stats.roundRobinLatest.run.lanes=lanePairs.map((pairs,index)=>({
        lane:index+1,expectedMatches:pairs.length,completedMatches:0,status:'starting'
    }));
    beginMemoryProbe();
    const box=document.createElement('aside');box.className='tournament-status tournament-parallel';
    const status=document.createElement('span');status.textContent='Preparando los dos combates…';
    const stop=button('Detener',()=>{
        if(!current?.parallel)return;
        current.stopRequested=true;status.textContent='Deteniendo ambos combates…';
        for(const frame of current.frames) frame.contentWindow?.postMessage({type:'svmm-simulation-stop'},location.origin);
    });
    const lanes=document.createElement('div');lanes.className='simulation-lanes';
    const frames=lanePairs.map((pairs,index)=>{
        const panel=document.createElement('section');panel.className='simulation-lane';
        const title=document.createElement('strong');title.textContent='Combate '+(index+1)+' · 0/'+pairs.length;
        const frame=document.createElement('iframe');frame.title='Simulación de combate '+(index+1);
        frame.src='simulation-lane.html?simulationLane&lane='+index;
        frame.addEventListener('error',()=>onLaneFinished(index,null,0),{once:true});
        panel.append(title,frame);lanes.append(panel);
        return {frame,title,pairs};
    });
    current.frames=frames.map(entry=>entry.frame);current.status=status;
    box.append(status,stop,lanes);document.body.append(box);overlay={box,status,next:{hidden:true},bracket:{textContent:''}};
    current.memoryStatusTimer=window.setInterval(()=>sampleTournamentMemory(performance.now()),500);
    function armLaneWatchdog() {
        if(!current?.parallel || current.laneDone.every(Boolean)) return;
        window.clearTimeout(current.startTimeout);
        current.startTimeout=window.setTimeout(()=>{
            if(!current?.parallel)return;
            current.stopRequested=true;
            const completed=current.laneMatches.reduce((sum,count)=>sum+count,0);
            stats.lastSimulationError={format:'roundRobin',completedMatches:completed,
                expectedMatches:current.totalMatches,
                message:'Los carriles no reportaron avance durante 120 segundos; se detuvieron y se guardaron los combates terminados.'};
            if(stats.roundRobinLatest?.run) Object.assign(stats.roundRobinLatest.run,{
                completedMatches:completed,status:'interrupted',finishedAt:new Date().toISOString(),error:stats.lastSimulationError
            });
            persist();
            status.textContent='Sin avance durante 120 s; deteniendo y guardando los combates terminados…';
            for(const frame of current.frames) frame.contentWindow?.postMessage({type:'svmm-simulation-stop'},location.origin);
            current.stopFallback=window.setTimeout(()=>{
                if(!current?.parallel)return;
                for(let i=0;i<2;i++) if(!current.laneDone[i])
                    onLaneFinished(i,null,current.laneMatches[i]);
            },5000);
        },SIMULATION_STALL_TIMEOUT_MS);
    }

    function onLaneFinished(index,report,matchesDone,laneError=null) {
        if(!current?.parallel || current.laneDone[index])return;
        const lane=stats.roundRobinLatest?.run?.lanes?.[index];
        if(lane) Object.assign(lane,{completedMatches:matchesDone,status:laneError?'interrupted':report?'complete':'closed-without-report',
            ...(laneError?{error:laneError}:{})});
        if(laneError&&!stats.lastSimulationError) {
            stats.lastSimulationError={...laneError,failedLane:index+1,completedMatches:matchesDone,
                cause:'combat-runtime-error'};
            if(stats.roundRobinLatest?.run) Object.assign(stats.roundRobinLatest.run,{
                completedMatches:current.laneMatches.reduce((sum,count)=>sum+count,0)+matchesDone,
                status:'interrupted',finishedAt:new Date().toISOString(),error:stats.lastSimulationError
            });
            current.stopRequested=true;
            for(let laneIndex=0;laneIndex<2;laneIndex++) if(laneIndex!==index&&!current.laneDone[laneIndex])
                current.frames[laneIndex]?.contentWindow?.postMessage({type:'svmm-simulation-stop'},location.origin);
            persist();
        }
        if(!report && !stats.lastSimulationError) {
            stats.lastSimulationError={format:'roundRobin',failedLane:index+1,completedMatches:matchesDone,
                cause:'iframe-closed-without-report',
                message:'El carril '+(index+1)+' se cerró sin entregar su informe. El navegador pudo reiniciar el iframe por recursos, o el documento pudo fallar.'};
            if(stats.roundRobinLatest?.run) Object.assign(stats.roundRobinLatest.run,{
                completedMatches:current.laneMatches.reduce((sum,count)=>sum+count,0),status:'interrupted',
                finishedAt:new Date().toISOString(),error:stats.lastSimulationError
            });
            current.stopRequested=true;
            for(let lane=0;lane<2;lane++) if(lane!==index&&!current.laneDone[lane])
                current.frames[lane]?.contentWindow?.postMessage({type:'svmm-simulation-stop'},location.origin);
            persist();
        }
        current.laneDone[index]=true;current.laneReports[index]=report;current.laneMatches[index]=matchesDone;
        frames[index].title.textContent='Combate '+(index+1)+' · '+matchesDone+'/'+frames[index].pairs.length+
            (report?' · terminado':' · sin completar');
        if(!current.laneDone.every(Boolean))return;
        window.clearTimeout(current.startTimeout);window.clearTimeout(current.stopFallback);
        window.clearInterval(current.memoryStatusTimer);
        const combined=stats.roundRobin ?? {fighters:{},matchups:{},teams:{},recent:[],completedBatches:0,tools:{},mirrors:{}};
        const latest=stats.roundRobinLatest ??= emptyRoundRobinReport();
        for(const laneReport of current.laneReports)if(laneReport) {
            mergeObjectCounts(combined,laneReport);
            mergeObjectCounts(latest,laneReport);
        }
        const completedAll=current.laneMatches.reduce((sum,count)=>sum+count,0)===current.totalMatches;
        combined.completedBatches=current.previousBatches+(completedAll?1:0);
        latest.completedBatches=completedAll?1:0;
        stats.roundRobin=combined;
        current.matches=current.laneMatches.reduce((a,b)=>a+b,0);
        const measurement=finishMemoryProbe();
        stats.lastSimulationMemory={concurrency:2,matches:current.matches,measurement};
        if(latest.run) Object.assign(latest.run,{completedMatches:current.matches,status:completedAll?'complete':'interrupted',
            finishedAt:new Date().toISOString(),memory:measurement,
            ...(!completedAll&&stats.lastSimulationError?{error:stats.lastSimulationError}:{})});
        if(measurement?.averageMB!=null) {
            const aggregate=stats.simulationMemoryAggregate ??= {runs:0,samples:0,totalAverageMB:0,peakMB:0};
            aggregate.runs++;aggregate.samples+=measurement.samples;aggregate.totalAverageMB+=measurement.averageMB;
            aggregate.peakMB=Math.max(aggregate.peakMB,measurement.peakMB);
            aggregate.averageMB=Math.round(aggregate.totalAverageMB/aggregate.runs*100)/100;
        }
        persist();
        finish(current.stopRequested?'Simulación detenida':'Todos contra todos completo');
    }

    current.laneMessageHandler=event=>{
        if(event.origin!==location.origin||!current?.parallel)return;
        const data=event.data;
        if(data?.type==='svmm-simulation-lane-ready') {
            const entry=frames[data.laneId];
            if(!entry||event.source!==entry.frame.contentWindow||current.laneDone[data.laneId])return;
            entry.frame.contentWindow.postMessage({type:'svmm-simulation-start',laneId:data.laneId,
                roster:options.roster,lanePairs:entry.pairs},location.origin);
        } else if(data?.type==='svmm-simulation-progress') {
            const lane=data.laneId;if(!Number.isInteger(lane)||!frames[lane]||event.source!==frames[lane].frame.contentWindow)return;
            current.laneMatches[lane]=Math.max(current.laneMatches[lane],data.matches);
            const laneRun=stats.roundRobinLatest?.run?.lanes?.[lane];
            if(laneRun) Object.assign(laneRun,{completedMatches:current.laneMatches[lane],status:'running'});
            armLaneWatchdog();
            frames[lane].title.textContent='Combate '+(lane+1)+' · '+data.matches+'/'+data.total;
            status.textContent='Progreso: '+current.laneMatches.reduce((a,b)=>a+b,0)+'/'+current.totalMatches+
                ' · 2 combates simultáneos';
        } else if(data?.type==='svmm-simulation-lane-finished') {
            if(!Number.isInteger(data.laneId)||!frames[data.laneId]||event.source!==frames[data.laneId].frame.contentWindow)return;
            onLaneFinished(data.laneId,data.report,data.matches,data.error);
        }
    };
    window.addEventListener('message',current.laneMessageHandler);
    armLaneWatchdog();
}

export function tournamentStats(){
    const report = structuredClone(stats);
    for (const row of [...Object.values(report.winDamage ?? {}),...Object.values(report.roundRobin?.winDamage ?? {}),
        ...Object.values(report.roundRobinLatest?.winDamage ?? {})]) {
        row.winPercentByLeadingCategory = Object.fromEntries(Object.entries(row.winsLedBy).map(
            ([category, wins]) => [category, Math.round(1000 * wins / row.trackedWins) / 10]
        ));
    }
    return report;
}
function downloadStats() {
    const blob=new Blob([JSON.stringify(tournamentStats(),null,2),'\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='resultados-torneo.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function makeDialog(title) {
    const d=document.createElement('dialog');d.className='tournament-dialog';
    const h=document.createElement('h2');h.textContent=title;d.append(h);
    d.addEventListener('close',()=>d.remove());
    for(const name of ['keydown','keyup']) d.addEventListener(name,event=>event.stopPropagation());
    document.body.append(d);
    return d;
}
function button(text,click) {
    const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=click;return b;
}
function addSelect(box,label,choices) {
    const field=document.createElement('label');field.textContent=label;
    const select=document.createElement('select');
    select.replaceChildren(...choices.map(([key,title])=>new Option(title,key)));
    field.append(select);box.append(field);return select;
}
function fighterLabel(id) {
    return ({rock:'Mega Man',protoman:'Proto Man','megaman-zero':'MM Zero',zero:'Zero',
        x:'X',bass:'Bass',wily:'Wily',eggman:'Eggman',espio:'Espio',sonic:'Sonic',
        shadow:'Shadow',knuckles:'Knuckles',tails:'Tails',silver:'Silver',chaos:'Chaos',
        emerl:'Emerl','metal-sonic':'Metal Sonic'})[id] ?? id;
}
function showReport(message, showLab = false) {
    const d=makeDialog(message||'Resultados de la CPU');
    const data=document.createElement('pre');
    const opponent=addSelect(d,'Cruces: consultar derrotas por rival',[]);
    const opponentDetails=document.createElement('pre');
    opponentDetails.className='tournament-matchup-details';
    d.append(opponentDetails);
    opponent.parentElement.hidden=true;
    opponentDetails.hidden=true;
    let activeOpponentReport=null;
    const renderOpponentDetails=()=>{
        if(!activeOpponentReport)return;
        const fighter=opponent.value;
        const matches=activeOpponentReport.matchups?.[fighter]??{};
        const rows=Object.entries(matches).sort((a,b)=>
            b[1].losses-a[1].losses||b[1].wins-a[1].wins||a[0].localeCompare(b[0]));
        opponentDetails.textContent=rows.length
            ?[`Derrotas de ${fighterLabel(fighter)} por rival`,`G / P / E = victorias / derrotas / empates`,'',
                ...rows.map(([rival,result])=>`${fighterLabel(rival).padEnd(14)} ${result.wins} G / ${result.losses} P / ${result.draws} E`+
                    (result.losses?` · ${fighterLabel(rival)} le ganó ${result.losses} ${result.losses===1?'vez':'veces'}`:''))].join('\n')
            :`Aún no hay cruces guardados para ${fighterLabel(fighter)} en este reporte.`;
    };
    const rank=(table)=>Object.entries(table).sort((a,b)=>{
        const ratio=s=>s.wins/Math.max(1,s.wins+s.losses+s.draws);
        return ratio(b[1])-ratio(a[1])||b[1].wins-a[1].wins;
    });
    const classification=table=>rank(table).map(([id,s])=>
        id.padEnd(13)+' '+s.wins+' G / '+s.losses+' P / '+s.draws+' E · '+(s.titles||0)+' títulos').join('\n')
        || 'Todavía no hay resultados en este formato.';
    const endingClassification=report=>{
        const rows=Object.entries(report?.winsByEnding??{}).sort((a,b)=>
            (b[1].ko+b[1].time)-(a[1].ko+a[1].time));
        return rows.length
            ?['Victorias por personaje','KO / tiempo / total','',
                ...rows.map(([id,result])=>`${fighterLabel(id).padEnd(14)} ${result.ko??0} KO / ${result.time??0} tiempo / ${(result.ko??0)+(result.time??0)} total`)].join('\n')
            :'Este reporte aún no tiene el desglose por personaje. Se contará en las partidas que terminen después de esta actualización.';
    };
    const match=addSelect(d,'Resultados',[
        ['','Clasificación 1v1'],['teams','Clasificación 3v3'],
        ...(stats.roundRobinLatest ? [['roundRobinLatest','Última simulación · todos contra todos']] : []),
        ...(stats.roundRobinLatest ? [['endingLatest','Victorias por KO/tiempo · última simulación']] : []),
        ...(stats.roundRobin ? [['roundRobin','Historial acumulado · todos contra todos']] : []),
        ...(stats.roundRobin ? [['endingRoundRobin','Victorias por KO/tiempo · historial acumulado']] : []),
        ...(stats.winsByEnding ? [['endingGeneral','Victorias por KO/tiempo · historial 1v1']] : []),
        ...Object.keys(stats.matchups).sort().map(id=>[id,'Cruces · '+id])
    ]);
    match.onchange=()=>{
        if(match.value==='endingLatest'||match.value==='endingRoundRobin'||match.value==='endingGeneral') {
            activeOpponentReport=null;
            opponent.parentElement.hidden=true;
            opponentDetails.hidden=true;
            const report=match.value==='endingLatest'?stats.roundRobinLatest:
                match.value==='endingRoundRobin'?stats.roundRobin:stats;
            data.textContent=endingClassification(report);
            return;
        }
        if (match.value==='roundRobin' || match.value==='roundRobinLatest') {
            const isLatest=match.value==='roundRobinLatest';
            const report=isLatest?stats.roundRobinLatest:stats.roundRobin;
            activeOpponentReport=report;
            const roster=report.run?.roster??Object.keys(report.fighters??{});
            const selectedOpponent=roster.includes(opponent.value)?opponent.value:roster[0];
            opponent.replaceChildren(...roster.map(id=>new Option(fighterLabel(id),id)));
            if(selectedOpponent)opponent.value=selectedOpponent;
            opponent.parentElement.hidden=roster.length===0;
            opponentDetails.hidden=roster.length===0;
            renderOpponentDetails();
            const {fighters,mirrors,completedBatches,endings}=report;
            const run=report.run;
            data.textContent=[
                ...(isLatest&&run?[
                    'Estado: '+({complete:'completo','in-progress':'en curso',interrupted:'interrumpido'}[run.status]??run.status),
                    'Roster: '+(run.roster??[]).join(', '),
                    'Repeticiones: '+(run.repetitions??1)+' · Espejos: '+(run.mirrors?'sí':'no'),
                    'Combates: '+(run.completedMatches??0)+'/'+(run.expectedMatches??0),''
                ]:[]),
                'Ejecuciones completas: '+completedBatches,
                'Por nocaut: '+(endings?.ko??0)+' · Por tiempo: '+(endings?.time??0),classification(fighters),'',
                'Espejos · azul / rojo / empate · por tiempo con menos de 15 PV de daño',
                '', 'Memoria de la última simulación', JSON.stringify(run?.memory ?? stats.lastSimulationMemory?.measurement ??
                    {available:false,reason:'Aún no hay una medición.'}),
                ...Object.entries(mirrors??{}).map(([id,s])=>id+' · '+s.blueWins+' / '+s.redWins+' / '+s.draws+' · '+s.lowDamage),
                ...(isLatest&&run?.error?['','Motivo de interrupción: '+run.error.message]:[])
            ].join('\n');
            return;
        }
        activeOpponentReport=null;
        opponent.parentElement.hidden=true;
        opponentDetails.hidden=true;
        if (!match.value || match.value==='teams') {
            data.textContent=classification(match.value==='teams'?stats.teams:stats.fighters);
            return;
        }
        const fighter = match.value;
        const row = stats.winDamage?.[fighter];
        const lines = Object.entries(stats.matchups[fighter]).map(([id,v])=>
            id.padEnd(13)+' '+v.wins+' G / '+v.losses+' P / '+v.draws+' E');
        if (row) {
            lines.push('', 'Victorias con daño registrado: '+row.trackedWins);
            for (const [category,wins] of Object.entries(row.winsLedBy).sort((a,b)=>b[1]-a[1])) {
                lines.push('Mayor daño de '+category+': '+wins+'/'+row.trackedWins+' ('+
                    (100*wins/row.trackedWins).toFixed(1)+' %)');
            }
        }
        data.textContent=lines.join('\n');
    };
    opponent.onchange=renderOpponentDetails;
    if (showLab && stats.roundRobinLatest) match.value='roundRobinLatest';
    else if (showLab && stats.roundRobin) match.value='roundRobin';
    match.onchange();
    d.append(data,button('Descargar resultados JSON',downloadStats),button('Cerrar',()=>d.close()));
    d.showModal();
}

function openRoundRobinMenu() {
    const d=makeDialog('Todos contra todos');
    const pool=poolList();
    const size=addSelect(d,'Luchadores',[['4','Elegir 4'],['8','Elegir 8'],['all','Todos ('+pool.length+')']]);
    const grid=document.createElement('div');grid.className='tournament-roster';d.append(grid);
    const checked=pool.map((id,i)=>{
        const field=document.createElement('label');
        const input=document.createElement('input');
        input.type='checkbox';input.checked=i<4;
        field.append(input,' '+id);grid.append(field);
        return {id,input,field};
    });
    size.onchange=()=>{for (const item of checked) item.field.hidden=size.value==='all';};
    const repeat=addSelect(d,'Repeticiones',[['1','1'],['2','2'],['4','4'],['8','8']]);
    const concurrency=addSelect(d,'Combates simultáneos',[['1','1 combate'],['2','2 combates (experimental)']]);
    concurrency.value='2';
    const mirrors=addSelect(d,'Combates espejo',[['yes','Incluir'],['no','Omitir']]);
    const msg=document.createElement('p');
    msg.textContent='Las repeticiones cuentan vueltas completas. Con 2 combates se usan dos instancias aisladas; la medición de memoria se guarda en el JSON.';
    d.append(msg,button('Simular cruces',()=>{
        const roster=size.value==='all'?pool:checked.filter(item=>item.input.checked).map(item=>item.id);
        if (size.value!=='all' && roster.length!==Number(size.value)) {
            msg.textContent='Selecciona exactamente '+size.value+' luchadores.';
            return;
        }
        const reportedRam=Number(navigator.deviceMemory);
        const heap=performance.memory;
        const lowHeadroom=heap&&Number.isFinite(heap.jsHeapSizeLimit)&&
            heap.jsHeapSizeLimit-heap.usedJSHeapSize<256*1024*1024;
        if(Number(concurrency.value)===2&&((Number.isFinite(reportedRam)&&reportedRam<=4)||lowHeadroom)) {
            concurrency.value='1';
            msg.textContent='Para cuidar la memoria, el navegador reporta poca capacidad disponible. Dejé 1 combate seleccionado; puedes iniciar así.';
            return;
        }
        d.close();
        startTournament({kind:'roundRobin',roster,mirrors:mirrors.value==='yes',
            total:Number(repeat.value),teamSize:1,simulate:true,concurrency:Number(concurrency.value)});
    }),button('Volver',()=>{d.close();openTournamentMenu();}));
    d.showModal();
}

export function openTournamentMenu() {
    if(current)return;
    const d=makeDialog('Torneos');
    const kind=addSelect(d,'Formato',[['single','1v1'],['team','Equipos de tres'],['roster','Reparto completo · 1v1']]);
    const size=addSelect(d,'Participantes',[]);
    const mode=addSelect(d,'Modo',[['watch','Ver torneo CPU'],['play','Jugar contra CPU'],['simulate','Simular torneos']]);
    const picks=document.createElement('div');d.append(picks);
    const total=document.createElement('input');total.type='number';total.min='1';total.step='1';total.value='10';
    const amount=document.createElement('label');amount.textContent='Cantidad de torneos';amount.append(total);d.append(amount);
    const msg=document.createElement('p');
    function update() {
        const sizes=kind.value==='single'?[32,16,8,4]:kind.value==='team'?[8,4,2]:[poolList().length];
        const selected=size.value;
        size.replaceChildren(...sizes.map(n=>new Option(String(n),n)));
        if(sizes.includes(Number(selected)))size.value=selected;
        size.disabled=kind.value==='roster';
        amount.hidden=mode.value!=='simulate';
        picks.replaceChildren();
        if(mode.value==='play') for(let i=0;i<(kind.value==='team'?3:1);i++) {
            const choose=addSelect(picks,'Luchador '+(i+1),poolList().map(id=>[id,id]));
            choose.selectedIndex=i;
        }
        msg.textContent=mode.value==='simulate'?'Combates CPU de hasta 28 s simulados. Puedes detener el lote en cualquier momento.':'';
    }
    kind.onchange=mode.onchange=update;
    d.append(msg,button('Empezar',()=>{
        const n=mode.value==='simulate'?Number(total.value):1;
        const playerRoster=mode.value==='play'?[...picks.querySelectorAll('select')].map(s=>s.value):null;
        if(!Number.isSafeInteger(n)||n<1){msg.textContent='Introduce una cantidad entera de torneos.';return;}
        if(playerRoster && new Set(playerRoster).size!==playerRoster.length){msg.textContent='Elige tres luchadores distintos.';return;}
        const options={kind:kind.value,size:Number(size.value),teamSize:kind.value==='team'?3:1,
            total:n,playerRoster,simulate:mode.value==='simulate'};
        d.close();
        startTournament(options);
    }),button('Todos contra todos',()=>{d.close();openRoundRobinMenu();}),
    button('Datos de CPU',()=>{d.close();showReport();}),button('Volver',()=>d.close()));
    update();d.showModal();
}
