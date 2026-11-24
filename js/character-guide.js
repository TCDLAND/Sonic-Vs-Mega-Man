import { padSpinChord, usingXbox, xboxCommand } from './input-labels.js';
import { storyRobotGuide } from './story-robot.js';
import { BUSTER_CONFIGS } from './buster-system.js';
import { getSelectionRoster } from './selection.js';
import { moves } from './pause-menu.js?v=combo-silver-2';
import { BASS_MOVES, PROTO_MOVES } from './robot-combat.js';
import { SPIN_PROFILES } from './spin-system.js';
import { X_SABER, NOVA_DAMAGE } from './x.js';
import { ZERO_TECHNIQUES } from './zero-techniques.js';
import { createAnimationPreview } from './animation-preview.js';

const damageCards = {
    eggman: [['Egg Fist / Spike Jab / Egg Driver','7 / 9 / 12'], ['Bola alta / baja','14 / 15'],
        ['Iron Crusher',19], ['Scrap Toss / misil / bomba','10 / 13 / 14'], ['Rampage','Hasta 27'], ['Protocol','Hasta 38']],
    'megaman-zero': [['Z-Saber por corte', '8 / 10 / 14'], ['Corte aéreo / dash', '11 / 10'],
        ['Buster por carga', '6 / 11 / 18'], ['Shield Boomerang', 8], ['Onda / caída de sable','11 / 14'],
        ['Triple Rod / ascendente', '9 / 10'], ['Chain Rod', 7], ['Recoil Rod / EX', '12 / 9'],
        ['Z Knuckle / ráfaga', '12 / 14']],
    silver: [['Golpes rápido / medio / fuerte', '5 / 8 / 12'], ['Psychic Upper', '11 / 13 en Super'],
        ['Golpes aéreos', '7 / 12'], ['Psychic Push', '8 / 11 en Super; 14 fuerte'],
        ['Psychic Grab', '12 / 14 en Super'], ['Psychic Shockwave', '12 / 14 en Super'],
        ['Fragmento', '5 / 7 en Super'], ['Psychic Catastrophe / Chaos Psychic Storm', '5 o 6 por pulso + 18 o 23 de remate']],
    chaos: [['Stretch / Elastic / Flexible', '6 / 8 / 11'], ['Double Stab / Upper', '14 / 12'],
        ['Chaos Crush / Air Crush', '13 / 13'], ['Dolphin / Rocket / Impact', '12 / 10 / 13'],
        ['Chaos Shot / Splash', '8 / 9'], ['Brazo interdimensional', 12], ['Tres charcos', 18],
        ['Chaos 4', '7 + 7 + 7 + 13'], ['Perfect Chaos', 36]],
    tails: [['IQ200', 5], ['IQ300', 7], ['IQ400', 9], ['Magic Hook', 16], ['Magic Upper', 12],
        ['Tails Cyclone', 10], ['Typhoon', 10], ['Tails Dunk', 12], ['Energy Ball', '7 / 13'], ['Flick', 11], ['Chu² Bomb', 13]],
    'metal-sonic': [['Metal Jab / Swipe / Kick','5 / 7 / 9'], ['Electric Upper',10], ['Fireball Crash',12], ['Metal Rocket / Eagle','10 / 12'], ['Plasma Grenade',13], ['Electric Bolt', 9], ['Electrical Discharge', 14], ['Rayo eléctrico', 16], ['Diamond Thunder', 10], ['Metal Thunder Wave', 13]],
    emerl: [['Puño', 7], ['Patada alta', 12], ['Patada de onda / proyectil', '6 / 8'], ['Patada giratoria', 11], ['Rocket', 13]],
    bass: [['Buster, por bala', 3], ['Puño', BASS_MOVES.punch.damage], ['Patada ascendente', BASS_MOVES.kick.damage],
        ['Treble', '3 / 5 / 10 / 15 según el impacto']],
    protoman: [['Golpe cercano', PROTO_MOVES.punch.damage], ['Escudazo', PROTO_MOVES.bash.damage]],
    x: [['Sable en suelo', X_SABER.ground], ['Sable aéreo', X_SABER.air], ['Nova Strike', NOVA_DAMAGE]],
    sonic: [['Sonic Punch / Kick / Top Kick','5 / 7 / 9'], ['Flare / Updraft / Windmill','15 / 11 / 11'],
        ['Rocket / Eagle','10 / 12'], ['Wave / Storm','8 / 9'], ['Drive / Meteor','14 / 15'],
        ['Cracker / Air Cracker',12], ['Ciclón / Barrido / Embestida','13 / 9 / 11'], ['Ráfaga de puños','3 + 3 + 3 + 6'], ['Homing Attack','10 / 13 en Super']],
    shadow: [['Chop / patada / slider', '5 / 6 / 9'], ['Rocket', 12], ['Chaos Magic', 12],
        ['Chaos Roaming', 12], ['Chaos Burst', 17], ['Shadow Eagle', 13], ['Curación', '+9 vida'], ['Daño acumulado durante Chaos Control', 'Hasta 35']],
    knuckles: [['Puño', 9], ['Segundo puño, inicio / martillo', '3 / 16–18'], ['Upper', 14], ['Agarre', 15],
        ['Golpe al suelo según distancia', '4 / 10 / 18'], ['Planeo con golpe', 11], ['Topo según carga', '10–28']],
    rock: [['Concrete móvil / choque con pared', '8 / +5'], ['Rolling Cutter', 10], ['Search Snake', 7],
        ['Fire Man / Heat Man', '3 / 7'], ['Barrera / columna de fuego', '2 / 12'], ['Flame Sword', 12],
        ['Slash Claw', 7], ['Hyper Bomb según distancia', '5–24'], ['Leaf Shield por hoja', 4],
        ['Rush salto / Jet', '7 / 10'], ['Beat Crescent', 8], ['Cajas de Beat', '5 / 8 / 12']],
    espio: [['Puño', 3], ['Golpe fuerte por fase', '5 / 5 / 8'], ['Patada ligera', 4], ['Patada fuerte por fase', '8 / 12'],
        ['Lengua', 15], ['Kunai', 10], ['Shuriken', 20]],
    zero: [['Cortes A / B / C', '12 / 10 / 18'], ['Aéreo / avance / ascendente', '14 / 10 / 13'],
        ['Agachado / deslizante', '9 / 14'],
        ...['Barrido al ras','Tajo de pared','Patada de pared','Pulso','Estocada eléctrica',
            'Ascenso de fuego','Ascenso eléctrico','Picado de hielo','Picado de fuego','Giro aéreo','Deslizamiento de hielo']
            .map((name, index) => [name, Object.values(ZERO_TECHNIQUES)[index].damage])]
};

const summaries = {
    eggman: 'Mantén la distancia con los barridos de bola y cambia a misiles cuando el rival se aleje.',
    sonic: 'Pulsa Q al saltar o rodar cuando aparezca la mira roja para lanzarte hacia el rival.',
    'megaman-zero': 'Encadena el sable, carga el Buster en movimiento y cambia el arma secundaria según la distancia.',
    silver: 'Controla el espacio con levitación, redirige objetos y recupera vida con energía compatible.',
    chaos: 'Estira sus brazos, ataca desde el agua y cambia de forma durante sus ultimates.',
    'metal-sonic': 'Frena o gira después de acelerar. Usa el cañón para presionar y reserva el escudo para los proyectiles.',
    tails: 'Encadena golpes con J, controla el aire con el vuelo y alterna Energy Ball con Chu² Bomb para cubrir la distancia.',
    bass: 'Presiona a distancia con ráfagas y Treble. Usa la patada si el rival consigue acercarse.',
    protoman: 'Avanza con el escudo, carga detrás de él y devuelve el tiro. El escudo protege de proyectiles frontales y acumula presión.',
    x: 'Carga mientras caminas, dispara al saltar o desde la pared y usa el sable para resolver el corto alcance.',
    rock: 'Cambia de kit para controlar el suelo, ganar altura con Concrete o pedir apoyo a Rush y Beat.',
    zero: 'Combina cortes terrestres, aéreos y de pared. El Buster cubre distancia mientras eliges por dónde entrar.'
};

const dialog = document.createElement('dialog');
dialog.className = 'battle-pause character-guide';
dialog.setAttribute('aria-labelledby', 'guide-title');
document.body.append(dialog);

export function isCharacterGuideOpen() { return dialog.open; }
export function guideButtonAt(x, y) { return x >= 145 && x <= 445 && y >= 637 && y <= 677; }

function element(tag, value, className) {
    const node = document.createElement(tag);
    if (value) node.textContent = value;
    if (className) node.className = className;
    return node;
}

export function openCharacterGuide() {
    if (dialog.open) return;
    const roster = getSelectionRoster();
    const header = element('header');
    const title = element('h1', 'Guía de personajes');
    title.id = 'guide-title';
    const close = element('button', 'Volver');
    close.type = 'button';
    close.onclick = () => dialog.close();
    header.append(title, close);
    const layout = element('div', '', 'guide-layout');
    const info = element('section', '', 'guide-info');
    const stats = element('section', '', 'guide-stats');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Personaje');
    for (const entry of roster) select.add(new Option(entry.label, entry.id));
    select.value = 'x';
    const masterSelect = document.createElement('select');
    masterSelect.setAttribute('aria-label', 'Robot Master de Wily');
    for (const [id, entry] of Object.entries(storyRobotGuide)) masterSelect.add(new Option(entry.name, id));
    const commandLabel = text => usingXbox() ? xboxCommand(text) : text;
    const render = () => {
        const entry = roster.find(item => item.id === select.value);
        if (entry.id === 'wily') {
            const robot = storyRobotGuide[masterSelect.value];
            const list = element('dl', '', 'guide-commands');
            for (const [name, description] of moves.wily) list.append(element('dt',name),element('dd',commandLabel(description)));
            for (const [name, description, damage] of robot.moves) {
                list.append(element('dt', name), element('dd', commandLabel(description) + ' Daño base: ' + damage + '.'));
            }
            if (masterSelect.value === 'cut') {
                list.append(element('dt', 'Entrada'), element('dd', 'Oscurece la arena y entra por la esquina superior derecha.'));
            }
            info.replaceChildren(select, element('h2', 'Robot Masters de Wily'), masterSelect, createAnimationPreview(masterSelect.value));
            stats.replaceChildren(element('h2', robot.name), list);
            return;
        }
        const id = entry.id;
        const rows = moves[id] || (BUSTER_CONFIGS[id] ? [['Buster', 'Mantén J y suelta']] : []);
        const list = element('dl', '', 'guide-commands');
        const commands = [...rows];
        if (SPIN_PROFILES[id] || ['emerl', 'metal-sonic'].includes(id)) commands.push(['Spin Dash', usingXbox() ? padSpinChord() : 'Abajo + Espacio']);
        for (const [name, command] of commands) list.append(element('dt', name),
            element('dd', (() => {
                const label=commandLabel(command.replaceAll('Aux1', 'Q').replaceAll('Aux2', 'E').replaceAll('Botón Jet', 'Espacio'));
                if (!usingXbox() || name==='Spin Dash' || !(SPIN_PROFILES[id] || ['emerl','metal-sonic'].includes(id))) return label;
                const chord=padSpinChord();
                return label.replaceAll(chord,chord==='Abajo + A'?'Abajo + RT + A':'Abajo + R2 + ✕');
            })()));
        info.replaceChildren(select, element('h2', entry.label), createAnimationPreview(id),
            element('p', summaries[id]), element('h3', 'Habilidades · Jugador 1'),
            commands.length ? list : element('p', 'Este personaje todavía tiene un kit provisional.'));
        const cards = [...(damageCards[id] || [])];
        if (BUSTER_CONFIGS[id]) cards.unshift(['Buster por nivel', BUSTER_CONFIGS[id].damage.slice(1).join(' / ')]);
        if (SPIN_PROFILES[id]) cards.push(['Spin Dash por nivel', SPIN_PROFILES[id].damage.slice(1).join(' / ')]);
        const grid = element('div', '', 'guide-cards');
        for (const [name, damage] of cards) {
            const card = element('article');
            card.append(element('h3', name), element('strong', String(damage)));
            grid.append(card);
        }
        stats.replaceChildren(element('h2', 'Daño de los ataques'),
            element('p', 'Daño base antes de defensa, guardia y otros multiplicadores.'),
            cards.length ? grid : element('p', 'Este kit aún no tiene ataques propios con daño registrado.'));
    };
    select.addEventListener('change', render);
    masterSelect.addEventListener('change', render);
    layout.append(info, stats);
    dialog.replaceChildren(header, layout);
    window.addEventListener('input-device-change',render);
    dialog.addEventListener('close',()=>window.removeEventListener('input-device-change',render),{once:true});
    render();
    dialog.showModal();
}
