import { canvas, game } from './state.js';
import { GAME_STATE } from './config.js';
import { battleStages, chooseBattleStage, normalizeRoundSeconds } from './battle-stages.js';
import { startBattle } from './battle.js';

const P1_TO_P2 = {
    KeyA: 'ArrowLeft', KeyD: 'ArrowRight', KeyW: 'ArrowUp', KeyS: 'ArrowDown',
    KeyJ: 'Comma', KeyI: 'Period', KeyM: 'Minus', KeyK: 'Equal',
    Space: 'Enter', KeyQ: 'BracketLeft', KeyE: 'BracketRight', KeyL: 'Slash', KeyU: 'Quote'
};

let peer = null;
let connection = null;
let role = null;
let dialog = null;
let statusNode = null;
let stagePickerOpened = false;
let inputSequence = 0;
let roomCode;
let teamSize = 1;
const viewers = new Map();
let broadcast;

function setStatus(message) {
    game.onlineStatus = message;
    if (statusNode) statusNode.textContent = message;
    if (dialog?.isConnected) {
        const node = dialog.querySelector('[data-online-status]');
        if (node) node.textContent = message;
    }
}

function send(message) {
    if (connection?.open) connection.send(message);
}

function setUpOnlineGame(localRole) {
    role = localRole;
    game.onlineRole = localRole;
    game.mode = 'online';
    game.controlOverrides = null;
    game.teamRosters = teamSize===3 ? [[],[]] : null;
    stagePickerOpened = false;
    game.characterSelection.p1Index = game.characterSelection.p1Index ?? 0;
    game.characterSelection.p2Index = game.characterSelection.p2Index ?? 1;
    game.characterSelection.p1Confirmed = false;
    game.characterSelection.p2Confirmed = false;
    game.gameState = GAME_STATE.SELECT;
    setStatus(localRole === 'host' ? `Jugador 1 · Código para espectadores: ${roomCode}` : 'Conectado · tú eres Jugador 2');
    if (dialog?.open) dialog.close();
    if (localRole === 'host') sendSelectionState();
}

function sendSelectionState(reset = false) {
    const s = game.characterSelection;
    send({ type: 'selection-state', p1Index: s.p1Index, p2Index: s.p2Index,
        p1Confirmed: s.p1Confirmed, p2Confirmed: s.p2Confirmed, rosters: game.teamRosters, reset });
}

function maybeChooseStage() {
    const s = game.characterSelection;
    if (role !== 'host' || !s.p1Confirmed || !s.p2Confirmed || stagePickerOpened) return;
    stagePickerOpened = true;
    setStatus('Ambos listos · Jugador 1 elige escenario');
    chooseBattleStage(game, () => {
        send({ type: 'battle-start', stageId: game.battleStage?.id,
            seconds: game.selectedRoundSeconds, rosters: game.teamRosters,
            p1Index: game.characterSelection.p1Index, p2Index: game.characterSelection.p2Index });
        startBattle();
        setStatus(`En línea ${teamSize}v${teamSize} · Código para espectadores: ${roomCode}`);
    }, () => {
        stagePickerOpened = false;
        if (teamSize===3) game.teamRosters = [[],[]];
        sendSelectionState(true);
    });
}

function createRoomDialog() {
    if (dialog?.isConnected) dialog.remove();
    dialog = document.createElement('dialog');
    dialog.className = 'online-room-dialog';
    dialog.innerHTML = `
      <h2>Reta en línea</h2>
      <p>Conexión directa entre navegadores. El creador será Jugador 1; quien se una será Jugador 2 y también jugará con WASD + JIKM.</p>
      <div class="online-room-actions">
        <label>Formato para crear una sala<select data-format>
          <option value="1">1v1</option><option value="3">3v3</option>
        </select></label>
        <button type="button" data-create>Crear sala</button>
        <label>Código de sala<input data-room-code maxlength="8" autocomplete="off" placeholder="Ej. A4F92C"></label>
        <button type="button" data-join>Jugar</button>
        <button type="button" data-watch>Espectar</button>
      </div>
      <p data-online-status>Elige crear una sala o unirte con un código.</p>
      <button type="button" data-close>Cerrar</button>`;
    document.body.append(dialog);
    statusNode = dialog.querySelector('[data-online-status]');
    dialog.querySelector('[data-create]').onclick = createRoom;
    dialog.querySelector('[data-join]').onclick = () => joinRoom(dialog.querySelector('[data-room-code]').value);
    dialog.querySelector('[data-watch]').onclick = () => joinRoom(dialog.querySelector('[data-room-code]').value, true);
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.addEventListener('close', () => {
        if (!role || role.endsWith('-pending')) {
            peer?.destroy(); peer = null; connection = null;
            role = null; game.onlineRole = null;
            game.onlineStatus = '';
        }
        dialog.remove();
    }, { once: true });
    dialog.showModal();
}

function peerLibrary() {
    if (typeof window.Peer === 'function') return window.Peer;
    setStatus('No cargó PeerJS. Revisa la conexión a internet y recarga el juego.');
    return null;
}

function attachHostConnection(conn) {
    if (conn.metadata?.spectator) {
        if (viewers.size >= 4) { conn.close(); return; }
        viewers.set(conn, null);
        conn.on('open', () => {
            try {
                broadcast ??= canvas.captureStream(30);
                viewers.set(conn, peer.call(conn.peer, broadcast, { metadata: { spectator: true } }));
            } catch { conn.close(); }
        });
        conn.on('close', () => {
            viewers.get(conn)?.close();
            viewers.delete(conn);
            if (!viewers.size) {
                broadcast?.getTracks().forEach(track => track.stop());
                broadcast = null;
            }
        });
        return;
    }
    if (connection && connection !== conn) { conn.close(); return; }
    connection = conn;
    conn.on('open', () => setStatus('Invitado conectado · preparando selección'));
    conn.on('data', handleHostMessage);
    conn.on('close', () => { connection = null; setStatus('Se perdió la conexión con el Jugador 2'); });
    conn.on('error', error => setStatus(`Conexión: ${error.message || 'error'}`));
}

function makePeer(id) {
    const Peer = peerLibrary();
    if (!Peer) return null;
    try {
        peer = new Peer(id, { debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } });
        peer.on('error', error => {
            const messages = {
                'unavailable-id': 'Ese código ya está ocupado. Crea otra sala.',
                'peer-unavailable': 'No encontramos esa sala. Revisa el código y que tu rival siga conectado.',
                'network': 'No se pudo alcanzar el servidor gratuito de señalización.'
            };
            setStatus(messages[error.type] || `Error de conexión: ${error.message || error.type}`);
        });
        peer.on('disconnected', () => setStatus('Se perdió la señalización; intentando reconectar…'));
        return peer;
    } catch (error) {
        setStatus(`No se pudo iniciar la sala: ${error.message}`);
        return null;
    }
}

function createRoom() {
    if (peer) return;
    const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('');
    roomCode = code;
    teamSize = Number(dialog.querySelector('[data-format]').value)===3 ? 3 : 1;
    const id = `svm-${code}`;
    if (!makePeer(id)) return;
    role = 'host-pending';
    setStatus('Creando sala…');
    peer.on('open', () => {
        setStatus(`Comparte este código con tu rival: ${code}`);
        const copy = document.createElement('button');
        copy.type = 'button'; copy.textContent = 'Copiar código';
        copy.onclick = async () => {
            try { await navigator.clipboard.writeText(code); setStatus(`Código ${code} copiado. Esperando al Jugador 2…`); }
            catch { setStatus(`Código de sala: ${code} · escríbelo a tu rival`); }
        };
        dialog.querySelector('.online-room-actions').append(copy);
        peer.on('connection', attachHostConnection);
    });
}

function joinRoom(rawCode, watch = false) {
    if (peer) return;
    const code = String(rawCode || '').trim().toUpperCase().replace(/^SVM-/, '');
    if (!/^[A-HJ-NP-Z2-9]{4,8}$/.test(code)) {
        setStatus('Escribe el código de sala (4 a 8 letras o números).'); return;
    }
    if (!makePeer()) return;
    role = 'guest-pending';
    if (watch) peer.on('call', call => {
        if (call.peer !== `svm-${code}` || !call.metadata?.spectator) return;
        call.on('stream', stream => {
            role = 'spectator';
            const screen = document.createElement('dialog');
            screen.className = 'online-room-dialog online-spectator';
            const video = document.createElement('video');
            video.autoplay = true; video.playsInline = true; video.muted = true; video.srcObject = stream;
            const close = document.createElement('button');
            close.textContent = 'Salir de espectador';
            close.onclick = () => screen.close();
            screen.onclose = () => {
                screen.remove(); peer?.destroy(); peer = null; connection = null; role = null;
            };
            call.on('close', () => { close.textContent = 'Transmisión terminada · Salir'; });
            if (dialog?.open) dialog.close();
            screen.append(video, close); document.body.append(screen); screen.showModal();
        });
        call.answer();
    });
    setStatus('Conectando con el anfitrión…');
    peer.on('open', () => {
        connection = peer.connect(`svm-${code}`, { reliable: true, metadata: { spectator: watch } });
        connection.on('open', () => {
            setStatus('Sala encontrada · esperando al anfitrión');
            if (!watch) send({ type: 'hello' });
        });
        connection.on('data', handleGuestMessage);
        connection.on('close', () => { connection = null; setStatus('Se perdió la conexión con el anfitrión'); });
        connection.on('error', error => setStatus(`Conexión: ${error.message || 'error'}`));
    });
}

function handleHostMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hello') {
        setUpOnlineGame('host');
        send({ type: 'ready', teamSize });
        sendSelectionState();
    } else if (message.type === 'selection') {
        const s = game.characterSelection;
        s.p2Index = Math.max(0, Math.min(s.chars.length - 1, Number(message.index) || 0));
        if (teamSize===3) {
            game.teamRosters[1] = validRoster(message.roster);
            s.p2Confirmed = game.teamRosters[1].length===3;
        } else s.p2Confirmed = Boolean(message.confirmed);
        sendSelectionState();
        maybeChooseStage();
    } else if (message.type === 'input' && typeof message.code === 'string') {
        dispatchKey(message.down ? 'keydown' : 'keyup', P1_TO_P2[message.code], message.sequence,message.slot);
    } else if (message.type === 'rematch' && game.gameState === GAME_STATE.RESULT) {
        startBattle();
    }
}

function handleGuestMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ready') {
        teamSize = message.teamSize===3 ? 3 : 1;
        setUpOnlineGame('guest');
    } else if (message.type === 'selection-state') {
        const s = game.characterSelection;
        s.p1Index = Math.max(0, Math.min(s.chars.length - 1, Number(message.p1Index) || 0));
        s.p1Confirmed = Boolean(message.p1Confirmed);
        if (message.reset) s.p2Confirmed = false;
        if (teamSize===3) {
            game.teamRosters[0] = validRoster(message.rosters?.[0]);
            if (message.reset) game.teamRosters[1] = [];
        }
    } else if (message.type === 'battle-start') {
        const stage = battleStages.find(item => item.id === message.stageId);
        if (!stage) { setStatus('El anfitrión eligió un escenario que no cargó en esta versión.'); return; }
        if (teamSize===3) {
            const rosters = [validRoster(message.rosters?.[0]),validRoster(message.rosters?.[1])];
            if (rosters.some(roster=>roster.length!==3)) return;
            game.teamRosters = rosters;
        }
        game.battleStage = stage;
        game.selectedRoundSeconds = normalizeRoundSeconds(message.seconds);
        game.characterSelection.p1Index = message.p1Index;
        game.characterSelection.p2Index = message.p2Index;
        startBattle();
        setStatus('En línea · usa tu WASD y JIKM para manejar al Jugador 2');
    } else if (message.type === 'input' && typeof message.code === 'string') {
        dispatchKey(message.down ? 'keydown' : 'keyup', message.code, message.sequence,message.slot);
    } else if (message.type === 'rematch' && game.gameState === GAME_STATE.RESULT) {
        startBattle();
    }
}

function validRoster(roster) {
    if (!Array.isArray(roster)) return [];
    const chars = game.characterSelection.chars;
    return [...new Set(roster.filter(id=>chars.includes(id)))].slice(0,3);
}

function dispatchKey(type, code, sequence, slot) {
    if (!code) return;
    const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true });
    Object.defineProperty(event, '__onlineForwarded', { value: true });
    Object.defineProperty(event, '__onlineSequence', { value: sequence });
    if (slot===0 || slot===1) Object.defineProperty(event, 'assistSlot', { value: slot });
    window.dispatchEvent(event);
}

export function openOnlineLobby() { createRoomDialog(); }
export function onlineRole() { return role; }
export function isForwardedOnlineKey(event) { return Boolean(event.__onlineForwarded); }

export function routeOnlineKey(event) {
    if (role === 'spectator') return true;
    if (game.mode !== 'online' || !['host', 'guest'].includes(role)) return false;
    const inBattle = game.gameState === GAME_STATE.BATTLE;
    const inResult = game.gameState === GAME_STATE.RESULT;
    if (!inBattle && !inResult) return false;

    if (inResult && event.type==='keydown' && ['KeyR', 'Enter', 'KeyJ'].includes(event.code) && !event.repeat) {
        send({ type: 'rematch' });
        startBattle();
        event.preventDefault(); return true;
    }
    if (!inBattle) return false;
    if (!event.__onlineForwarded && !Object.hasOwn(P1_TO_P2,event.code) && event.code !== 'Escape') return true;
    if (event.code === 'Escape') { event.preventDefault(); return true; }

    if (role === 'host') {
        if (Object.hasOwn(P1_TO_P2, event.code) && !event.__onlineForwarded && !event.repeat) {
            send({ type: 'input', code: event.code, down: event.type === 'keydown', sequence: ++inputSequence, slot: event.assistSlot });
        }
        return false;
    }

    if (event.__onlineForwarded) return false;
    const mapped = P1_TO_P2[event.code];
    if (!mapped) return false;
    if (event.repeat) { event.preventDefault(); return true; }
    send({ type: 'input', code: event.code, down: event.type === 'keydown', sequence: ++inputSequence, slot: event.assistSlot });
    event.preventDefault();
    dispatchKey(event.type, mapped, undefined, event.assistSlot);
    return true;
}

export function handleOnlineSelectionKey(event) {
    if (game.mode !== 'online' || !['host', 'guest'].includes(role) || game.gameState !== GAME_STATE.SELECT) return false;
    if (event.repeat || !['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ'].includes(event.code)) return true;
    event.preventDefault();
    const s = game.characterSelection;
    const side = role === 'host' ? 'p1' : 'p2';
    const indexKey = `${side}Index`, confirmedKey = `${side}Confirmed`;
    if (s[confirmedKey]) return true;
    const i = s[indexKey], row = Math.floor(i / 4), col = i % 4;
    const count = s.chars.length, rows = Math.ceil(count / 4);
    if (event.code === 'KeyA') {
        const width = Math.min(4, count - row * 4);
        s[indexKey] = row * 4 + (col + width - 1) % width;
    } else if (event.code === 'KeyD') {
        const width = Math.min(4, count - row * 4);
        s[indexKey] = row * 4 + (col + 1) % width;
    } else if (event.code === 'KeyW' || event.code === 'KeyS') {
        const nextRow = (row + (event.code === 'KeyW' ? rows - 1 : 1)) % rows;
        let next = nextRow * 4 + col;
        if (next >= count) next = nextRow * 4 + (col % (count - nextRow * 4));
        s[indexKey] = next;
    } else if (event.code === 'KeyJ') {
        if (teamSize===3) {
            const roster = game.teamRosters[side==='p1'?0:1];
            const fighter = s.chars[s[indexKey]];
            if (!roster.includes(fighter)) roster.push(fighter);
            s[confirmedKey] = roster.length===3;
        } else s[confirmedKey] = true;
    }

    if (role === 'host') {
        sendSelectionState();
        maybeChooseStage();
    } else send({ type: 'selection', index: s.p2Index, confirmed: s.p2Confirmed, roster: game.teamRosters?.[1] });
    return true;
}

