const fighters={
    espio:{reach:175,pace:'flank',entry:'jump',threat:'ranged'},
    bass:{reach:380,pace:'space',entry:'ground',threat:'projectile'},
    sonic:{reach:150,pace:'rush',entry:'jump',threat:'rush'},
    shadow:{reach:240,pace:'flank',entry:'jump',threat:'teleport'},
    knuckles:{reach:140,pace:'rush',entry:'jump',threat:'close'},
    silver:{reach:290,pace:'space',entry:'jump',threat:'field'},
    x:{reach:350,pace:'space',entry:'jump',threat:'charge'},
    zero:{reach:175,pace:'rush',entry:'jump',threat:'saber'},
    rock:{reach:385,pace:'space',entry:'jump',threat:'projectile'},
    protoman:{reach:290,pace:'space',entry:'ground',threat:'shield'},
    eggman:{reach:265,pace:'space',entry:'jump',threat:'flight'},
    wily:{reach:160,pace:'guard',entry:'ground',threat:'close'},
    emerl:{reach:178,pace:'flank',entry:'jump',threat:'copy'},
    'megaman-zero':{reach:185,pace:'rush',entry:'jump',threat:'saber'},
    'metal-sonic':{reach:186,pace:'flank',entry:'jump',threat:'beam'},
    tails:{reach:240,pace:'flank',entry:'jump',threat:'flight'},
    chaos:{reach:205,pace:'guard',entry:'ground',threat:'trap'},
    cut:{reach:165,pace:'flank',entry:'jump',threat:'projectile'},
    guts:{reach:150,pace:'guard',entry:'ground',threat:'close'},
    heat:{reach:185,pace:'rush',entry:'jump',threat:'beam'}
};
const counters={
    ranged:{distance:-22,air:.16,heavy:1.10},projectile:{distance:-45,air:.30,spin:.81},
    rush:{distance:40,air:.08,heavy:1.34,retreat:true},
    teleport:{distance:14,air:.10,jab:1.44,spin:.64},
    close:{distance:51,air:.12,kick:1.24,retreat:true},
    field:{distance:-37,air:.23,kick:1.34,spin:.73},
    charge:{distance:-46,air:.23,jab:1.29,spin:1.23},
    saber:{distance:35,air:.09,kick:1.35,retreat:true},
    shield:{distance:-15,air:.30,kick:1.56,jab:.65},
    flight:{distance:-22,air:.50,kick:1.35,spin:.51},
    copy:{distance:-40,air:.11,jab:1.30,heavy:1.18},
    beam:{distance:-11,air:.29,jab:1.22},trap:{distance:21,air:.33,heavy:1.19,spin:.71}
};
const rivalOverrides={
    'bass/protoman':{distance:315,heavy:1.6},
    'shadow/x':{distance:235,heavy:1.36},
    'rock/eggman':{distance:285,air:.62},
    'sonic/chaos':{distance:165,air:.48,spin:.42},
    'metal-sonic/bass':{distance:263,air:.42,spin:.70},
    'knuckles/sonic':{distance:139,heavy:1.64},
    'silver/bass':{distance:350,retreat:false},
    'x/emerl':{distance:280,jab:1.8},
    'rock/emerl':{distance:296,heavy:1.35}
};
const names=Object.keys(fighters);
function buildPlan(actor,enemy) {
    const a=fighters[actor], d=fighters[enemy], c=counters[d.threat];
    const agile=a.entry==='jump';
    const guard=a.pace==='guard';
    return Object.freeze({
        distance:Math.max(110,a.reach+c.distance),
        air:agile?c.air:Math.min(.14,c.air*.45),
        retreat:Boolean(c.retreat && (a.pace==='space'||guard)),
        jab:(c.jab??1)*(a.pace==='rush'?1.18:1),
        heavy:(c.heavy??1)*(guard?1.17:1),
        kick:(c.kick??1)*(a.pace==='flank'?1.13:1),
        spin:(c.spin??1)*(a.pace==='rush'?1.19:1),
        ...rivalOverrides[actor+'/'+enemy]
    });
}
export const matchupMatrix=Object.freeze(Object.fromEntries(names.map(actor=>[actor,
    Object.freeze(Object.fromEntries(names.map(enemy=>[enemy,buildPlan(actor,enemy)])))])));
export function matchupFor(actor,enemy) {
    return matchupMatrix[actor]?.[enemy]??matchupMatrix[actor]?.wily??matchupMatrix.wily.wily;
}
