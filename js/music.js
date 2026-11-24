const folder = 'assets/audio/story/';
const wily = folder + 'Wily Stage 1 - Mega Man 8 [OST].mp3';
const tracks = {
    angelIsland: folder + 'Angel Island Zone (Act 2) - Sonic the Hedgehog 3 [OST].mp3',
    eggmanBase: folder + 'Death Egg Robot - Sonic the Hedgehog 2 [OST].mp3',
    metalBattle: folder + 'Sonic CD Stardust Speedway Bad Future JP EU HD.mp3',
    tikalMoment: folder + 'Theme of Tikal - Sonic Adventure [OST].mp3',
    highway: 'assets/audio/highway.mp3',
    wily_intro: wily, wily_final: wily,
    light_lab: folder + "Dr. Light's Laboratory - Mega Man 8 [OST].mp3",
    city_stage: folder + 'Opening Stage (Ruined Street) - Mega Man 7 [OST].mp3',
    museum: folder + 'The Robot Museum - Mega Man 7 [OST].mp3',
    triple_boss: folder + 'Dr. Wily Stage Boss - Mega Man 10 [OST].mp3',
    castle_approach: folder + 'Wily Stage 1 (Entrance) - Mega Man 7 [OST].mp3',
    bass_boss: folder + 'Bass Battle - Mega Man 8 [OST].mp3',
    emerl_boss: folder + 'Final Wily Battle - Mega Man 8 [OST].mp3'
};

const audio = document.getElementById('bgMusic');
let requested = null, playing = null, fade = 450, volume = .42, frozen = false, mix = 0, last = 0, retry = false;
audio.addEventListener('error', () => console.warn('[Historia] Música no disponible:', playing));
function resumeTrack() {
    if (playing && !frozen) audio.play().catch(() => { retry = true; });
}

export const music = {
    play(id, { loop = true, fadeMs = 450, volume: level = volume } = {}) {
        if (!tracks[id]) { console.warn('[Historia] Pista sin archivo:', id); this.stop(fadeMs); return; }
        fade = fadeMs;
        this.setVolume(level);
        requested = tracks[id];
        audio.loop = loop;
    },
    stop(fadeMs = 450) { requested = null; fade = fadeMs; },
    pause() { frozen = true; audio.pause(); },
    resume() { frozen = false; resumeTrack(); },
    setVolume(level) { volume = Math.max(0, Math.min(1, level)); },
    unlock() { if (retry) { retry = false; resumeTrack(); } },
    tick(now) {
        const delta = Math.min(100, Math.max(0, now - (last || now)));
        last = now;
        if (frozen) return;
        const step = fade ? delta / fade : 1;
        if (playing !== requested) {
            mix = playing ? Math.max(0, mix - step) : 0;
            if (!mix) {
                audio.pause();
                playing = requested;
                if (playing) {
                    audio.src = playing;
                    audio.volume = 0;
                    resumeTrack();
                }
            }
        } else if (playing) mix = Math.min(1, mix + step);
        audio.volume = volume * mix;
    }
};
