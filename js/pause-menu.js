import { usingXbox, xboxCommand } from './input-labels.js';
import { music } from './music.js';
import { game } from './state.js';
import { applyBattleControllers, returnToCharacterSelect } from './battle.js?v=team3-1';
import { setCombatPaused } from './combat-clock.js';

// J/I/M/K representan los cuatro botones de ataque. Se traducen para cada lado.

export const moves = {
    wily:[['Cambiar Robot Master','Q / Abajo + Q para retroceder'],['Ataques del Robot Master','J / I / M / K'],
        ['Suministro / rayo de Wily','E / Arriba + E'],['Reparar en el taller','Abajo + E'],
        ['Counter de Cut con Guts','Abajo + I'],['Doble salto de Cut','Pulsa salto otra vez en el aire']],
    eggman: [['Egg Fist / Spike Jab / Egg Driver','J en cadena'],
        ['Upper Fist / Iron Crusher','M / K'], ['Bola de demolición','Q y mantén WASD para dirigir; Abajo + Q inicia el barrido bajo'], ['Órbita 360°','Espacio + Q desde reposo'], ['Bola en llamas','Durante o justo después del dash, pulsa Q'],
        ['Dash aéreo','Dirección + Espacio, también en diagonal'], ['Scrap Toss / Missile Launch','E / Hacia el rival + E'],
        ['Egg Bomb','Abajo + E'], ['Agarre Eggmobile','Arriba + M'],
        ['Vuelo','WASD en las cuatro direcciones. Espacio sin dirección para defender'], ['Combustible','El vuelo consume combustible y subir consume más. El dash cuesta 18%. Baja al suelo para recargar'], ['Wrecking Ball Rampage / Egg Crusher Protocol','I / Abajo + I']],
    emerl: [['Puño', 'J'], ['Patada de onda', 'I en el suelo'], ['Patada alta', 'M'], ['Patada giratoria', 'K en el suelo'], ['Patada Rocket', 'K en el aire'], ['Copia de historia · Buster', 'Mantén J y suelta'], ['Sets copiados', 'Sigue automáticamente el set de Rock durante el duelo']],
    x: [['Buster de cuatro niveles', 'Mantén J y suelta, en suelo o aire'],
        ['Sable en suelo o en salto', 'M'], ['Salto de pared', 'Salto junto a la pared'],
        ['Nova Strike', 'K']],
    zero: [
        ['Corte A / B / C', 'J / I / K'], ['Corte de avance', 'Adelante + J'],
        ['Corte ascendente', 'Abajo + I'], ['Corte agachado', 'Abajo + J'],
        ['Corte deslizante', 'Adelante + K'], ['Corte aéreo', 'En el aire + K'],
        ['Buster', 'Mantén M y suelta'], ['Salto de pared', 'Salto junto a la pared'],
        ['Postura baja', 'Mantén abajo'], ['Barrido al ras', 'Abajo + K en suelo'],
        ['Tajo de pared / patada de pared', 'K / I junto a la pared, en el aire'],
        ['Estocada eléctrica / pulso', 'Aux1 + J / Aux2 + J en suelo'],
        ['Ascenso de fuego / eléctrico', 'Aux1 + I / Aux2 + I en suelo'],
        ['Picado de hielo / fuego', 'Aux1 + K / Aux2 + K en aire'],
        ['Giro aéreo', 'Abajo + K en aire'], ['Deslizamiento de hielo', 'Aux1 + K en suelo']
    ],
    'megaman-zero': [['Z-Saber', 'J en cadena, en aire o durante dash'],
        ['Onda del Z-Saber / corte descendente', 'Abajo + J en suelo / en aire'],
        ['Buster Shot', 'Pulsa M o mantén y suelta para cargar'],
        ['Shield Boomerang', 'Mantén I al caminar, saltar o hacer dash aéreo. Suelta I para recargar. Abajo + I para lanzar'],
        ['Triple / Chain / Recoil Rod y Z Knuckle', 'Aux1 / Aux2 cambian de arma. K ejecuta el ataque'],
        ['Triple Rod ascendente', 'Arriba + K con Triple Rod'],
        ['Recoil Rod EX / rebote', 'Abajo + K en suelo / en aire, con Recoil Rod'],
        ['Ráfaga Z Knuckle', 'Abajo + K tras conectar un puño con Z Knuckle'],
        ['Dash terrestre / aéreo', 'Botón Jet, con dirección opcional'],
        ['Salto de pared', 'Pulsa salto mientras tocas una pared en el aire']],
    silver: [['Golpes rápido / medio / fuerte / lanzador', 'J / I / K / M'],
        ['Continuación aérea', 'Salta al conectar M, luego J / I en aire'],
        ['Levitación', 'Botón Jet. Abajo para bajar'],
        ['Psychic Dash', 'Dirección + K en suelo o aire'],
        ['Portal de absorción', 'Aux1 abre o cierra. Cura un 20 % del daño de energía absorbido'],
        ['Psychic Push rápido / fuerte', 'Aux2 / Dirección + Aux2'],
        ['Psychic Grab', 'Abajo + Aux1. Decide con dirección; mantén abajo para estrellar'],
        ['Psychic Throw / Orbit', 'Abajo + J / Abajo + M'],
        ['Psychic Shockwave', 'Abajo + Aux2'],
        ['Psychic Barrage', 'Abajo + K'],
        ['Psychic Catastrophe / Chaos Psychic Storm', 'Abajo + I en suelo'],
        ['Super Silver', 'Abajo dos veces (100 de poder)']],
    chaos: [['Stretch / Elastic / Flexible', 'Pulsa J en cadena'], ['Double Stab / Upper Chaos', 'I / M en suelo'],
        ['Chaos Crush / Air Crush', 'Abajo + I en suelo / I en aire'],
        ['Chaos Dolphin / Rocket / Impact', 'K en suelo / K en aire / Abajo + K en aire'],
        ['Chaos Shot / Chaos Splash', 'Aux1 / Aux2 en suelo o aire'],
        ['Chaos Flight / Curación', 'Mantén Botón Jet en aire / Abajo + Botón Jet en suelo'],
        ['Brazo interdimensional', 'Abajo + Aux1 en suelo'],
        ['Tres charcos', 'Abajo + Aux2 en suelo o Adelante + Aux2 desde media distancia'],
        ['Perfect Chaos · 100 poder', 'Mantén Botón Jet y pulsa Aux1 en suelo'],
        ['Chaos 4 · 100 poder', 'Mantén Botón Jet y pulsa Aux2 en suelo']],
    tails: [['IQ200 / IQ300 / IQ400', 'J en cadena'], ['Magic Hook / Magic Upper', 'I / M en suelo'],
        ['Tails Cyclone / Typhoon / Tails Dunk', 'K en suelo / K en aire / Abajo + K en aire'],
        ['Energy Ball', 'Mantén Aux1 y suelta. Arriba o abajo para apuntar'],
        ['Flick / Chu² Bomb', 'Aux2 / Abajo + Aux2'],
        ['Vuelo / curación', 'Mantén Botón Jet en el aire / Abajo + Botón Jet en suelo']],
    'metal-sonic': [['Metal Jab, Swipe y Kick / Electric Upper / Metal Kick', 'J en cadena / I / M'], ['Fireball Crash / freno','Hacia el rival + K en suelo / K al correr'], ['Metal Rocket / Metal Eagle / Jet Deactivation','K / hacia el rival + K / Abajo + K, en aire'],
        ['Electric Bolt', 'Aux1'], ['Electrical Discharge', 'Abajo + Aux1'], ['Rayo eléctrico','Hacia el rival + Aux1 en suelo'],
        ['Black Shield', 'Aux2 en suelo'], ['Diamond Thunder', 'Aux2 en aire'], ['Plasma Grenade','Abajo + Aux2 en suelo o aire'], ['Metal Thunder Wave', 'Abajo + hacia el rival + Aux2 en suelo'], ['Rebote', 'Pulsa salto junto a una pared en el aire']],
    sonic: [['Sonic Punch / Sonic Kick / Top Kick','J en cadena'],
        ['Sonic Flare / Ráfaga de puños','I / Hacia el rival + I'],
        ['Sonic Updraft / Windmill','M / K en reposo, hacia el rival o durante el dash'],
        ['Patada ciclón / Barrido rasante / Embestida aérea','Abajo + I / Abajo + M / Hacia el rival + K en el aire'],
        ['Sonic Rocket / Sonic Eagle','K en el aire / Hacia el rival + Aux1 en el aire'],
        ['Sonic Wave / Sonic Storm','Aux1 en suelo / Abajo + Aux1 en el aire. Arriba + Aux1 eleva el tiro'],
        ['Homing Attack','Aux1 con mira roja mientras Sonic está hecho bola'],
        ['Sonic Drive / Sonic Meteor','Aux2 en suelo / en el aire'],
        ['Sonic Cracker / Air Cracker','Abajo + Aux2 en suelo / en el aire'],
        ['Sonic Ballet / Curación','Espacio en aire / Atrás + Espacio en suelo'],
        ['Freno / Super Sonic','K al alejarte / Abajo dos veces (100 de poder)']],
    shadow: [['Chop / Upper / Slider', 'J / M / K'], ['Chaos Magic / teletransporte con Rocket', 'Abajo + I / Abajo + K'], ['Freno del teletransporte', 'K otra vez antes de la patada'], ['Chaos Nightmare', 'I'], ['Rocket', 'K en aire'], ['Super Shadow', 'Abajo dos veces (100 de poder)'],
        ['Roaming Chaos', 'Aux1'], ['Curación / Shadow Eagle', 'Abajo + Aux1 en suelo / aire'],
        ['Chaos Burst / Air Chaos Burst', 'Aux2'], ['Shadow Teleport aéreo', 'Abajo + Aux2 en aire']],
    knuckles: [['Puño / segundo puño / upper', 'J / I / M'], ['Golpe al suelo', 'Abajo + J'], ['Agarre', 'Adelante + I'], ['Topo', 'Abajo + K'], ['Planeo / golpe en planeo', 'K en aire']],
    bass: [['Ráfaga horizontal · 8 tiros', 'J'], ['Ráfaga vertical / diagonal', 'Salto + J / Salto + dirección + J'],
        ['Llamar a Treble', 'I'], ['Puño en suelo o aire', 'M'], ['Bass Jet diagonal', 'Botón Jet'], ['Bass Jet horizontal', 'Salto + Aux1/Aux2, o en el aire dirección + Botón Jet'], ['Barrera de proyectiles', 'Abajo + M'], ['Patada ascendente', 'K'], ['Esquiva hacia atrás', 'Atrás + K']],
    protoman: [['Buster / tiro cargado', 'Pulsa J / mantén J y suelta'],
        ['Escudo frontal', 'Mantén I mientras caminas o saltas'],
        ['Carga tras el escudo', 'Mantén I + J y suelta J para disparar'],
        ['Golpe cercano', 'M'], ['Golpe de escudo', 'K'], ['Esquiva hacia atrás', 'Atrás + K']],
    rock: [['Buster base', 'Mantén J y suelta'], ['Selector de armas', 'Abajo dos veces y elige dirección'],
        ['Concrete / serpiente / fuego', 'J según el kit'], ['Rolling Cutter / espada / bomba', 'M según el kit'],
        ['Beat / patrullaje', 'I / izquierda + derecha + I'], ['Rush Coil / Jet', 'K en suelo / dirección + K o K en aire'],
        ['Leaf Shield', 'K con kit verde']],
    espio: [['Puño / golpe fuerte', 'J / I'], ['Patadas', 'M / K'], ['Lengua frontal', 'Adelante + J'],
        ['Lengua hacia arriba', 'Diagonal auxiliar + J'], ['Shuriken', 'Salto + atrás + M'],
        ['Kunai', 'Suelta atrás, luego adelante + K'], ['Trompo ninja', 'Abajo + I'],
        ['Tornado ninja', 'Abajo + M'], ['Corte entre humo', 'Abajo + K']]
};
const buttonNames = { J: 'Coma', I: 'Punto', M: 'Menos', K: '=' };

function clearInputs(fighter) {
    for (const key of Object.keys(fighter.keys)) fighter.keys[key] = false;
    if (fighter.lastDirectionState) Object.assign(fighter.lastDirectionState, { left: false, right: false });
    fighter.busterCharging = false;
    fighter.busterChargeStart = 0;
    if (fighter.characterId === 'tails') fighter.chargeAt = null;
}

function playerPanel(fighter, side) {
    const blue = side === 'p1';
    const panel = document.createElement('section');
    panel.className = blue ? 'pause-blue' : 'pause-red';
    const title = document.createElement('h2');
    title.textContent = fighter.characterName || fighter.characterId;
    const label = document.createElement('label');
    label.textContent = blue ? 'Control azul ' : 'Control rojo ';
    const select = document.createElement('select');
    select.ariaLabel = label.textContent.trim();
    select.add(new Option(blue ? 'Jugador 1' : 'Jugador 2', 'human'));
    select.add(new Option('IA', 'cpu'));
    select.value = (blue ? game.cpuAgentP1 : game.cpuAgentP2) ? 'cpu' : 'human';
    select.addEventListener('change', () => {
        game.controlOverrides ??= {};
        game.controlOverrides[side] = select.value === 'cpu';
        clearInputs(fighter);
        applyBattleControllers();
    });
    label.append(select);
    const list = document.createElement('dl');
    const rows = [
        ['Mover / saltar / agacharse', usingXbox(side) ? 'Cruceta o sticks · ↑ salto · ↓ agacharse' : blue ? 'A / D · W · S' : '← / → · ↑ · ↓'],
        ['Guardia / dash', 'Atrás / doble toque de dirección'],
        ...(moves[fighter.characterId] || (fighter.hasBuster ? [['Buster', 'Mantén J y suelta']] : []))
    ];
    if (fighter.supportsSpin) rows.push(['Spin Dash', (blue||usingXbox(side)?'Abajo + Espacio':'Abajo + Enter')+
        ' para cargar. Mantén dirección al soltar abajo. En el suelo, mantén la opuesta para frenar y girar.']);
    if (fighter.characterId === 'espio' || fighter.characterId === 'rock') {
        rows.push(['Diagonales auxiliares', blue||usingXbox(side) ? 'Q / E' : '[ / ]']);
    }
    if (fighter.characterId === 'rock') rows.push(['Pedir Eddie', blue||usingXbox(side) ? 'E + I' : '] + Punto']);
    if (game.teamFighters) {
        const assist = blue?'U':'Apóstrofo';
        rows.push(['Asistencia / relevo', usingXbox(side)
            ? 'LB para el personaje 2 · LT para el personaje 3 · toca para asistencia o mantén para relevo'
            : assist+' para el personaje 2 · Abajo + '+assist+' para el personaje 3 · toca para asistencia o mantén para relevo']);
    }
    for (const [name, command] of rows) {
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = name;
        const withAux = command.replaceAll('Aux1', blue ? 'Q' : '[').replaceAll('Aux2', blue ? 'E' : ']').replaceAll('Botón Jet', blue ? 'Espacio' : 'Enter');
        detail.textContent = usingXbox(side) ? xboxCommand(command) : blue ? withAux : withAux.replace(/\b[JIMK]\b/g, key => buttonNames[key]);
        list.append(term, detail);
    }
    panel.append(title, label, list);
    return panel;
}

const dialog = document.createElement('dialog');
dialog.className = 'battle-pause';
dialog.setAttribute('aria-labelledby', 'battle-pause-title');
document.body.append(dialog);

export function toggleBattlePause() {
    if (game.paused) {
        game.paused = false;
        setCombatPaused(false);
        music.resume();
        dialog.close();
        return;
    }
    game.paused = true;
    setCombatPaused(true);
    music.pause();
    clearInputs(game.p1);
    clearInputs(game.p2);
    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.id = 'battle-pause-title';
    title.textContent = 'Pausa';
    const resume = document.createElement('button');
    resume.type = 'button';
    resume.textContent = usingXbox() ? 'Continuar · B' : 'Continuar · Esc';
    resume.addEventListener('click', toggleBattlePause);
    header.append(title, resume);
    if(game.mode==='practice'){
        const exit=document.createElement('button');
        exit.type='button';
        exit.textContent='Elegir personajes';
        exit.addEventListener('click',()=>{toggleBattlePause();returnToCharacterSelect();});
        header.append(exit);
    }
    const panels = document.createElement('div');
    panels.className = 'pause-panels';
    panels.append(playerPanel(game.p1, 'p1'), playerPanel(game.p2, 'p2'));
    dialog.replaceChildren(header, panels);
    dialog.showModal();
}

dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (game.paused) toggleBattlePause();
});
