(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const menu = document.getElementById('menu');
  const minimap = document.getElementById('minimap');
  const messageEl = document.getElementById('message');
  const hpEl = document.getElementById('hp');
  const ammoEl = document.getElementById('ammo');
  const classEl = document.getElementById('className');
  const objectiveEl = document.getElementById('objectiveState');
  const missionSubtitle = document.getElementById('missionSubtitle');
  const missionTitle = document.getElementById('missionTitle');
  const missionButtons = document.getElementById('missionButtons');
  const classButtons = document.getElementById('classButtons');
  const startBtn = document.getElementById('startBtn');

  const W = 960;
  const H = 540;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  ctx.scale(dpr, dpr);

  const TAU = Math.PI * 2;
  const FOV = Math.PI / 3.1;
  const RAY_COUNT = W;
  const TILE = 1;
  const EPS = 1e-6;

  const wallPalette = {
    '#': { base: '#9bb1c6', shade: '#7b8fa4', label: 'stone' },
    'W': { base: '#9c6d43', shade: '#7d5633', label: 'wood' },
    'S': { base: '#7f8f9f', shade: '#657482', label: 'steel' },
    'B': { base: '#b76a52', shade: '#8f523f', label: 'brick' },
    'C': { base: '#6f7c85', shade: '#55626b', label: 'cave' },
    'G': { base: '#85b8c9', shade: '#6790a0', label: 'glass' },
  };

  const input = {
    keys: new Set(),
    mouseLocked: false,
    dx: 0,
    firing: false,
    mouseRight: false,
  };

  const state = {
    running: false,
    mapKey: 'bren',
    classKey: 'soldier',
    world: null,
    player: null,
    enemies: [],
    projectiles: [],
    pickups: [],
    objective: null,
    carried: false,
    victory: false,
    gameOver: false,
    lastMessage: 0,
    fogColor: '#0e1720',
    skyColor: '#6f8ba7',
    selectedMission: 'bren',
    selectedClass: 'soldier',
  };

  const classDefs = {
    sniper: {
      name: 'Снайпер',
      desc: 'Головная боль / Электрод',
      hp: 85,
      speed: 2.45,
      weapon: 'sniper',
      ammo: 16,
      ability: 'zoom',
      color: '#d4e4ff',
      loadoutName: 'Головная боль',
    },
    flam: {
      name: 'Огнемётчик',
      desc: 'Огнемёт Звёздный',
      hp: 110,
      speed: 2.35,
      weapon: 'flame',
      ammo: 260,
      ability: 'flare',
      color: '#ff9d59',
      loadoutName: 'Огнемёт Звёздный',
    },
    demo: {
      name: 'Подрывник',
      desc: 'Форвард гранат / Капкан',
      hp: 95,
      speed: 2.4,
      weapon: 'grenade',
      ammo: 5,
      ability: 'mine',
      color: '#ffcc7a',
      loadoutName: 'Форвард гранат',
    },
    jugger: {
      name: 'Джаггернаут',
      desc: 'Дикарь / Зажигалка',
      hp: 155,
      speed: 2.05,
      weapon: 'lmg',
      ammo: 200,
      ability: 'brace',
      color: '#d9d3c3',
      loadoutName: 'Дикарь',
    },
    ninja: {
      name: 'Ниндзя',
      desc: 'Кунай / Шокер',
      hp: 90,
      speed: 3.25,
      weapon: 'ninja',
      ammo: 8,
      ability: 'cloak',
      color: '#9fe8b6',
      loadoutName: 'Кунай',
    },
    medic: {
      name: 'Медик',
      desc: 'Вакцинатор / Забродившая вакцина',
      hp: 100,
      speed: 2.55,
      weapon: 'medgun',
      ammo: 30,
      ability: 'heal',
      color: '#c7f0ff',
      loadoutName: 'Вакцинатор',
    },
    builder: {
      name: 'Строитель',
      desc: 'Чертёж / Сварочный аппарат',
      hp: 100,
      speed: 2.45,
      weapon: 'builder',
      ammo: 20,
      ability: 'shield',
      color: '#ffdba8',
      loadoutName: 'Чертёж',
    },
    parkour: {
      name: 'Паркурщик',
      desc: 'Омерта / Энергетик',
      hp: 92,
      speed: 3.45,
      weapon: 'shotgun',
      ammo: 28,
      ability: 'dash',
      color: '#e7d7ff',
      loadoutName: 'Омерта',
    },
    grenadier: {
      name: 'Гранатомётчик',
      desc: 'Ураган / Чихуахуа',
      hp: 100,
      speed: 2.5,
      weapon: 'blaster',
      ammo: 16,
      ability: 'burst',
      color: '#ffd0cf',
      loadoutName: 'Ураган',
    },
    soldier: {
      name: 'Солдат',
      desc: 'Автомат А-4 / Тепловизор',
      hp: 110,
      speed: 2.7,
      weapon: 'rifle',
      ammo: 120,
      ability: 'thermal',
      color: '#d6e1bf',
      loadoutName: 'Автомат А-4',
    },
  };

  const missions = {
    bren: {
      name: 'Operation Bren',
      subtitle: 'Швейцарская деревушка, золото, башня и узкие улицы.',
      sky: '#86a8c9',
      fog: '#121d27',
      objectiveName: 'Золотая тележка',
      exitName: 'Ворота внизу',
      build: () => buildBren(),
      objectiveText: 'Добыть золото и донести до ворот.',
      spawnText: 'Выход из пещеры',
    },
    stalevar: {
      name: 'Stalevar',
      subtitle: 'Завод, трубы, двор и бой за данные.',
      sky: '#7c92a4',
      fog: '#0e161d',
      objectiveName: 'Папка с данными',
      exitName: 'Грузовик Red',
      build: () => buildStalevar(),
      objectiveText: 'Украсть данные и донести их до грузовика.',
      spawnText: 'Двор Red',
    },
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function normAngle(a) {
    while (a < -Math.PI) a += TAU;
    while (a > Math.PI) a -= TAU;
    return a;
  }
  function now() { return performance.now(); }
  function showMessage(text, ms = 2200) {
    messageEl.textContent = text;
    messageEl.classList.add('show');
    state.lastMessage = now() + ms;
  }
  function hideMessageIfDue() {
    if (messageEl.classList.contains('show') && now() > state.lastMessage) {
      messageEl.classList.remove('show');
    }
  }

  function makeGrid(w, h, fill = '.') {
    return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }
  function rect(grid, x1, y1, x2, y2, ch, hollow = false) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const edge = x === x1 || x === x2 || y === y1 || y === y2;
        if (!hollow || edge) {
          grid[y][x] = ch;
        }
      }
    }
  }
  function carve(grid, x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) grid[y][x] = '.';
  }
  function line(grid, x1, y1, x2, y2, ch) {
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    let x = x1, y = y1;
    grid[y][x] = ch;
    while (x !== x2 || y !== y2) {
      if (x !== x2) x += dx;
      if (y !== y2) y += dy;
      grid[y][x] = ch;
    }
  }

  function buildBren() {
    const w = 24, h = 24;
    const g = makeGrid(w, h, '.');
    for (let y = 0; y < h; y++) {
      g[y][0] = '#'; g[y][w - 1] = '#';
    }
    for (let x = 0; x < w; x++) {
      g[0][x] = '#'; g[h - 1][x] = '#';
    }

    // cave start / upper village
    rect(g, 1, 1, 5, 4, 'C', true);
    carve(g, 2, 2, 4, 3);
    g[4][5] = '.';

    // houses & lanes
    rect(g, 6, 2, 9, 5, 'W', true);
    carve(g, 7, 3, 8, 4);
    rect(g, 11, 2, 14, 5, 'B', true);
    carve(g, 12, 3, 13, 4);
    rect(g, 16, 2, 21, 5, 'W', true);
    carve(g, 17, 3, 20, 4);

    // tower
    rect(g, 9, 8, 14, 13, 'S', true);
    carve(g, 10, 9, 13, 12);
    carve(g, 9, 10, 9, 11); // west opening
    carve(g, 14, 10, 14, 11); // east opening
    g[13][11] = 'S'; g[13][12] = 'S';

    // centre street
    carve(g, 5, 6, 18, 8);
    carve(g, 5, 13, 19, 15);
    carve(g, 4, 16, 21, 20);
    carve(g, 16, 16, 22, 22);

    // lower village blocks / balconies
    rect(g, 2, 8, 4, 12, 'B', true);
    carve(g, 3, 9, 3, 11);
    rect(g, 18, 7, 21, 10, 'W', true);
    carve(g, 19, 8, 20, 9);
    rect(g, 17, 12, 22, 15, 'G', true);
    carve(g, 18, 13, 21, 14);
    rect(g, 1, 16, 4, 21, 'C', true);
    carve(g, 2, 17, 3, 20);

    // winding road hints
    line(g, 5, 4, 7, 4, '.');
    line(g, 9, 4, 11, 4, '.');
    line(g, 14, 4, 16, 4, '.');
    line(g, 21, 5, 21, 7, '.');
    line(g, 16, 8, 16, 13, '.');
    line(g, 14, 15, 16, 15, '.');
    line(g, 11, 13, 11, 15, '.');

    // gate end
    rect(g, 20, 21, 22, 22, 'S', true);
    carve(g, 21, 22, 21, 22);

    return {
      grid: g,
      w, h,
      spawn: { x: 3.5, y: 3.5, dir: 0.15 },
      objective: { x: 12.5, y: 10.5 },
      exit: { x: 21.5, y: 22.1, r: 1.1 },
      wall: (ch) => wallPalette[ch] || wallPalette['#'],
      enemies: [
        { x: 7.5, y: 8.5, type: 'rifle' },
        { x: 18.5, y: 8.5, type: 'rifle' },
        { x: 19.5, y: 14.5, type: 'flame' },
        { x: 6.5, y: 17.5, type: 'sniper' },
        { x: 15.5, y: 19.5, type: 'heavy' },
        { x: 3.5, y: 19.5, type: 'grunt' },
        { x: 12.5, y: 7.5, type: 'grunt' },
      ],
      pickups: [
        { x: 7.5, y: 3.5, kind: 'ammo' },
        { x: 18.5, y: 17.5, kind: 'heal' },
        { x: 3.5, y: 10.5, kind: 'heal' },
      ],
      theme: 'bren',
    };
  }

  function buildStalevar() {
    const w = 24, h = 24;
    const g = makeGrid(w, h, '.');
    for (let y = 0; y < h; y++) {
      g[y][0] = '#'; g[y][w - 1] = '#';
    }
    for (let x = 0; x < w; x++) {
      g[0][x] = '#'; g[h - 1][x] = '#';
    }

    rect(g, 2, 2, 6, 5, 'C', true);
    carve(g, 3, 3, 5, 4);
    rect(g, 8, 2, 13, 5, 'S', true);
    carve(g, 9, 3, 12, 4);
    rect(g, 16, 2, 21, 5, 'B', true);
    carve(g, 17, 3, 20, 4);

    rect(g, 5, 8, 10, 12, 'S', true);
    carve(g, 6, 9, 9, 11);
    rect(g, 13, 8, 18, 12, 'W', true);
    carve(g, 14, 9, 17, 11);
    rect(g, 4, 14, 9, 19, 'B', true);
    carve(g, 5, 15, 8, 18);
    rect(g, 14, 14, 21, 19, 'S', true);
    carve(g, 15, 15, 20, 18);

    // central yard and pipes
    carve(g, 10, 6, 13, 13);
    rect(g, 10, 6, 13, 6, 'S', false);
    rect(g, 10, 13, 13, 13, 'S', false);
    rect(g, 10, 7, 10, 12, 'W', false);
    rect(g, 13, 7, 13, 12, 'W', false);

    // admin / data room
    rect(g, 18, 14, 22, 20, 'G', true);
    carve(g, 19, 15, 21, 19);
    carve(g, 18, 17, 18, 18);

    // tube / lane / truck zone
    carve(g, 1, 10, 4, 10);
    carve(g, 8, 10, 15, 10);
    carve(g, 13, 17, 17, 17);
    carve(g, 16, 20, 22, 20);
    rect(g, 1, 20, 4, 22, 'W', true);
    carve(g, 2, 21, 3, 21);

    // top-left spawn buildings
    rect(g, 1, 1, 4, 8, 'C', true);
    carve(g, 2, 2, 3, 7);
    rect(g, 2, 9, 7, 13, 'B', true);
    carve(g, 3, 10, 6, 12);
    rect(g, 7, 18, 12, 22, 'S', true);
    carve(g, 8, 19, 11, 21);

    return {
      grid: g,
      w, h,
      spawn: { x: 3.5, y: 3.5, dir: 0.2 },
      objective: { x: 20.5, y: 17.5 },
      exit: { x: 3.5, y: 21.5, r: 1.1 },
      wall: (ch) => wallPalette[ch] || wallPalette['#'],
      enemies: [
        { x: 7.5, y: 10.5, type: 'grunt' },
        { x: 12.5, y: 10.5, type: 'heavy' },
        { x: 15.5, y: 4.5, type: 'sniper' },
        { x: 20.5, y: 9.5, type: 'flame' },
        { x: 18.5, y: 16.5, type: 'rifle' },
        { x: 11.5, y: 19.5, type: 'grunt' },
        { x: 4.5, y: 15.5, type: 'rifle' },
      ],
      pickups: [
        { x: 6.5, y: 3.5, kind: 'ammo' },
        { x: 10.5, y: 16.5, kind: 'heal' },
        { x: 19.5, y: 19.5, kind: 'ammo' },
      ],
      theme: 'stalevar',
    };
  }

  function hasWall(world, x, y) {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    if (gx < 0 || gy < 0 || gx >= world.w || gy >= world.h) return true;
    return world.grid[gy][gx] !== '.';
  }

  function worldTile(world, x, y) {
    const gx = Math.floor(x), gy = Math.floor(y);
    if (gx < 0 || gy < 0 || gx >= world.w || gy >= world.h) return '#';
    return world.grid[gy][gx];
  }

  function canWalk(world, x, y, r = 0.18) {
    return !hasWall(world, x - r, y - r) && !hasWall(world, x + r, y - r) && !hasWall(world, x - r, y + r) && !hasWall(world, x + r, y + r);
  }

  function normalizeButtons() {
    [...missionButtons.querySelectorAll('button')].forEach(b => b.classList.toggle('active', b.dataset.key === state.selectedMission));
    [...classButtons.querySelectorAll('button')].forEach(b => b.classList.toggle('active', b.dataset.key === state.selectedClass));
    const m = missions[state.selectedMission];
    const c = classDefs[state.selectedClass];
    missionTitle.textContent = `${m.name} · ${c.name}`;
    missionSubtitle.textContent = `${m.subtitle}  |  ${c.desc}`;
  }

  function buildMenu() {
    const missionsOrder = ['bren', 'stalevar'];
    const classesOrder = ['soldier', 'sniper', 'flam', 'demo', 'jugger', 'ninja', 'medic', 'builder', 'parkour', 'grenadier'];
    missionButtons.innerHTML = '';
    classButtons.innerHTML = '';
    missionsOrder.forEach(k => {
      const b = document.createElement('button');
      b.textContent = missions[k].name;
      b.dataset.key = k;
      b.onclick = () => {
        state.selectedMission = k;
        normalizeButtons();
      };
      missionButtons.appendChild(b);
    });
    classesOrder.forEach(k => {
      const c = classDefs[k];
      const b = document.createElement('button');
      b.innerHTML = `${c.name}<div class="small">${c.loadoutName}</div>`;
      b.dataset.key = k;
      b.onclick = () => {
        state.selectedClass = k;
        normalizeButtons();
      };
      classButtons.appendChild(b);
    });
    normalizeButtons();
  }

  function startGame() {
    state.mapKey = state.selectedMission;
    state.classKey = state.selectedClass;
    state.world = missions[state.mapKey].build();
    state.player = {
      x: state.world.spawn.x,
      y: state.world.spawn.y,
      dir: state.world.spawn.dir,
      health: classDefs[state.classKey].hp,
      maxHealth: classDefs[state.classKey].hp,
      speed: classDefs[state.classKey].speed,
      ammo: classDefs[state.classKey].ammo,
      reserve: classDefs[state.classKey].ammo * 4,
      weapon: classDefs[state.classKey].weapon,
      abilityUntil: 0,
      shieldUntil: 0,
      zoomUntil: 0,
      cloakUntil: 0,
      thermalUntil: 0,
      lastShot: 0,
      lastAbility: 0,
      killed: 0,
      heldObjective: false,
      carrySpeed: 1,
      firingLock: false,
      reloadAt: 0,
    };
    state.enemies = state.world.enemies.map((e, i) => ({
      id: i,
      x: e.x,
      y: e.y,
      spawnX: e.x,
      spawnY: e.y,
      type: e.type,
      hp: enemyStats(e.type).hp,
      dir: Math.random() * TAU,
      cooldown: 0,
      aggroUntil: 0,
      path: [],
      pathIdx: 0,
      stepTimer: 0,
      burnUntil: 0,
    }));
    state.projectiles = [];
    state.pickups = state.world.pickups.map(p => ({ ...p, taken: false }));
    state.objective = {
      x: state.world.objective.x,
      y: state.world.objective.y,
      carried: false,
      holder: null,
      kind: state.mapKey === 'bren' ? 'gold' : 'data',
    };
    state.carried = false;
    state.victory = false;
    state.gameOver = false;
    state.running = true;
    state.fogColor = missions[state.mapKey].fog;
    state.skyColor = missions[state.mapKey].sky;
    menu.style.display = 'none';
    document.body.style.cursor = 'none';
    showMessage(`${missions[state.mapKey].name} — цель: ${missions[state.mapKey].objectiveText}`, 3000);
    pointerLock();
    syncHUD();
    requestAnimationFrame(loop);
  }

  function pointerLock() {
    const el = canvas;
    if (document.pointerLockElement !== el) {
      el.requestPointerLock?.();
    }
  }

  function enemyStats(type) {
    switch (type) {
      case 'sniper': return { hp: 55, speed: 1.65, damage: 24, range: 10, cooldown: 1200, color: '#d5f1ff' };
      case 'flame': return { hp: 70, speed: 1.9, damage: 7, range: 3.0, cooldown: 120, color: '#ff9c59' };
      case 'heavy': return { hp: 110, speed: 1.45, damage: 13, range: 8, cooldown: 260, color: '#e2d0a7' };
      case 'grunt': return { hp: 45, speed: 2.0, damage: 8, range: 7, cooldown: 400, color: '#b7d48a' };
      case 'rifle':
      default: return { hp: 60, speed: 1.8, damage: 10, range: 8, cooldown: 450, color: '#9fd4ff' };
    }
  }

  function projectileStats(kind) {
    switch (kind) {
      case 'grenade': return { speed: 5.2, damage: 55, radius: 1.1, life: 1400, color: '#ffcc72', bounce: 0.6 };
      case 'mine': return { speed: 0, damage: 170, radius: 1.4, life: 999999, color: '#ef6a6a', mine: true };
      case 'shuriken': return { speed: 9.0, damage: 28, radius: 0.2, life: 900, color: '#dff6ff' };
      case 'flame': return { speed: 0, damage: 5, radius: 1.25, life: 120, color: '#ffa056', cone: true };
      case 'syringe': return { speed: 8.5, damage: 3, radius: 0.12, life: 1000, color: '#9cf0ff' };
      case 'bullet':
      default: return { speed: 16, damage: 10, radius: 0.08, life: 500, color: '#f0f4ff' };
    }
  }

  function shootPlayer() {
    const p = state.player;
    const t = now();
    if (state.gameOver || state.victory) return;
    if (t < p.lastShot) return;

    const c = classDefs[state.classKey];
    if (p.ammo <= 0) {
      if (p.reserve > 0 && t > p.reloadAt) {
        const mag = ammoCapacity(p.weapon);
        const needed = Math.min(mag, p.reserve);
        p.ammo = needed;
        p.reserve -= needed;
        p.reloadAt = t + 650;
        showMessage('Перезарядка...', 800);
      }
      return;
    }

    p.lastShot = t + weaponCooldown(p.weapon, state.classKey);
    let weapon = p.weapon;
    if (state.mapKey === 'bren' && state.classKey === 'sniper') weapon = 'sniper';

    if (weapon === 'ninja') {
      // melee if close, otherwise shuriken
      const target = closestEnemyInCone(1.25, 0.55);
      if (target) {
        damageEnemy(target, 42);
        p.ammo -= 1;
      } else {
        spawnProjectile('shuriken', p.x, p.y, p.dir, true);
        p.ammo -= 1;
      }
    } else if (weapon === 'grenade') {
      spawnProjectile('grenade', p.x, p.y, p.dir, true);
      p.ammo -= 1;
    } else if (weapon === 'flame') {
      flameBurst();
      p.ammo -= 6;
    } else if (weapon === 'medgun') {
      spawnProjectile('syringe', p.x, p.y, p.dir, true);
      p.ammo -= 1;
    } else if (weapon === 'shotgun') {
      shotgunBurst();
      p.ammo -= 1;
    } else if (weapon === 'lmg' || weapon === 'rifle' || weapon === 'builder' || weapon === 'blaster') {
      hitscanBurst(weapon);
      p.ammo -= 1;
    } else if (weapon === 'sniper') {
      sniperShot();
      p.ammo -= 1;
    } else {
      hitscanBurst('rifle');
      p.ammo -= 1;
    }

    if (p.ammo < 0) p.ammo = 0;
    syncHUD();
  }

  function ammoCapacity(weapon) {
    switch (weapon) {
      case 'sniper': return 1;
      case 'grenade': return 5;
      case 'lmg': return 40;
      case 'flame': return 200;
      case 'shotgun': return 4;
      case 'builder': return 10;
      case 'medgun': return 30;
      case 'blaster': return 12;
      default: return 30;
    }
  }

  function weaponCooldown(weapon, classKey) {
    if (classKey === 'sniper') return 1200;
    if (weapon === 'shotgun') return 520;
    if (weapon === 'lmg') return 90;
    if (weapon === 'flame') return 60;
    if (weapon === 'grenade') return 980;
    if (weapon === 'medgun') return 160;
    if (weapon === 'builder') return 180;
    if (weapon === 'blaster') return 600;
    return 120;
  }

  function closestEnemyInCone(maxDist, maxAngle) {
    let best = null;
    let bestD = 999;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - state.player.x;
      const dy = e.y - state.player.y;
      const d = Math.hypot(dx, dy);
      if (d > maxDist) continue;
      const a = Math.abs(normAngle(Math.atan2(dy, dx) - state.player.dir));
      if (a > maxAngle) continue;
      if (!lineOfSight(state.world, state.player.x, state.player.y, e.x, e.y)) continue;
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  function damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    enemy.aggroUntil = now() + 3500;
    if (enemy.hp <= 0) {
      state.player.killed += 1;
      maybeDrop(enemy);
      showMessage(`Враг повержен · ${state.player.killed} целей`, 1000);
    }
  }

  function maybeDrop(enemy) {
    if (Math.random() < 0.16) {
      state.pickups.push({ x: enemy.x + (Math.random() - 0.5) * 0.4, y: enemy.y + (Math.random() - 0.5) * 0.4, kind: Math.random() < 0.5 ? 'ammo' : 'heal', taken: false });
    }
  }

  function lineOfSight(world, x1, y1, x2, y2) {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 24);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (hasWall(world, x, y)) return false;
    }
    return true;
  }

  function hitscanBurst(kind) {
    const spread = kind === 'lmg' ? 0.04 : kind === 'blaster' ? 0.03 : 0.015;
    const pellets = kind === 'lmg' ? 1 : kind === 'blaster' ? 1 : 1;
    const dmg = kind === 'lmg' ? 6 : kind === 'builder' ? 12 : 16;
    for (let i = 0; i < pellets; i++) {
      const ang = state.player.dir + (Math.random() - 0.5) * spread;
      const hit = raycastHit(state.player.x, state.player.y, ang, 18);
      if (hit && hit.enemy) {
        damageEnemy(hit.enemy, dmg + (kind === 'blaster' ? 9 : 0));
      }
    }
  }

  function shotgunBurst() {
    for (let i = 0; i < 8; i++) {
      const ang = state.player.dir + (Math.random() - 0.5) * 0.22;
      const hit = raycastHit(state.player.x, state.player.y, ang, 10);
      if (hit && hit.enemy) damageEnemy(hit.enemy, 9);
    }
  }

  function sniperShot() {
    const hit = raycastHit(state.player.x, state.player.y, state.player.dir + (Math.random() - 0.5) * 0.008, 24);
    if (hit && hit.enemy) {
      const e = hit.enemy;
      const dx = e.x - state.player.x;
      const dy = e.y - state.player.y;
      const a = Math.abs(normAngle(Math.atan2(dy, dx) - state.player.dir));
      const dmg = a < 0.06 ? 150 : 5;
      damageEnemy(e, dmg);
    }
  }

  function flameBurst() {
    const dir = state.player.dir;
    const p = state.player;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 3.2) continue;
      const a = Math.abs(normAngle(Math.atan2(dy, dx) - dir));
      if (a < 0.38 && lineOfSight(state.world, p.x, p.y, e.x, e.y)) {
        damageEnemy(e, 7);
        e.burnUntil = now() + 3000;
      }
    }
  }

  function spawnProjectile(kind, x, y, dir, friendly) {
    const s = projectileStats(kind);
    state.projectiles.push({
      kind,
      x,
      y,
      vx: Math.cos(dir) * s.speed,
      vy: Math.sin(dir) * s.speed,
      life: s.life,
      born: now(),
      friendly,
      color: s.color,
      damage: s.damage,
      radius: s.radius,
      bounce: s.bounce || 0,
      mine: !!s.mine,
    });
  }

  function useAbility() {
    const p = state.player;
    const t = now();
    if (t < p.lastAbility) return;
    const c = classDefs[state.classKey];
    if (c.ability === 'zoom') {
      p.zoomUntil = t + 5500;
      p.lastAbility = t + 1200;
      showMessage('Прицеливание: Головная боль', 900);
    } else if (c.ability === 'thermal') {
      p.thermalUntil = t + 6000;
      p.lastAbility = t + 1000;
      showMessage('Тепловизор активен', 900);
    } else if (c.ability === 'cloak') {
      p.cloakUntil = t + 5000;
      p.lastAbility = t + 1400;
      showMessage('Инвиз активирован', 900);
    } else if (c.ability === 'heal') {
      p.health = Math.min(p.maxHealth, p.health + 35);
      p.lastAbility = t + 7000;
      showMessage('Вакцинатор: +35 HP', 900);
    } else if (c.ability === 'dash') {
      p.abilityUntil = t + 3500;
      p.lastAbility = t + 8000;
      showMessage('Энергетик: ускорение', 900);
    } else if (c.ability === 'shield') {
      p.shieldUntil = t + 6500;
      p.lastAbility = t + 10000;
      showMessage('Щит строителя', 900);
    } else if (c.ability === 'mine') {
      const mine = state.projectiles.find(pr => pr.mine && pr.friendly && pr.life > 0);
      if (mine) {
        showMessage('Уже активна одна мина', 900);
        return;
      }
      spawnProjectile('mine', p.x + Math.cos(p.dir) * 0.5, p.y + Math.sin(p.dir) * 0.5, p.dir, true);
      p.lastAbility = t + 2200;
      showMessage('Капкан поставлен', 900);
    } else if (c.ability === 'flare') {
      flameBurst();
      p.lastAbility = t + 2800;
      showMessage('Баллон воздуха: жар', 900);
    } else if (c.ability === 'burst') {
      // quick burst forward
      hitscanBurst('blaster');
      p.lastAbility = t + 2200;
      showMessage('Ураганный выстрел', 900);
    } else if (c.ability === 'brace') {
      p.shieldUntil = t + 3500;
      p.lastAbility = t + 6000;
      showMessage('Джаггернаут: упор', 900);
    }
  }

  function interact() {
    const p = state.player;
    const t = now();
    const o = state.objective;
    if (!p.heldObjective && dist(p.x, p.y, o.x, o.y) < 1.1) {
      p.heldObjective = true;
      o.carried = true;
      o.holder = p;
      state.carried = true;
      showMessage(state.mapKey === 'bren' ? 'Золото у тебя. Неси к воротам.' : 'Данные у тебя. Неси к грузовику.', 1800);
      return;
    }
    if (p.heldObjective && dist(p.x, p.y, state.world.exit.x, state.world.exit.y) < state.world.exit.r) {
      state.victory = true;
      state.running = false;
      showMessage('Миссия выполнена.', 3000);
      setTimeout(() => {
        menu.style.display = 'flex';
        document.body.style.cursor = 'auto';
      }, 1200);
      return;
    }
    // heal pickup / ammo pickup
    for (const pick of state.pickups) {
      if (pick.taken) continue;
      if (dist(p.x, p.y, pick.x, pick.y) < 0.8) {
        pick.taken = true;
        if (pick.kind === 'ammo') {
          p.reserve += 30;
          showMessage('Боеприпасы пополнены', 800);
        } else {
          p.health = Math.min(p.maxHealth, p.health + 25);
          showMessage('Аптечка +25 HP', 800);
        }
        return;
      }
    }
  }

  function raycastHit(px, py, ang, maxDist = 32, stopEnemy = true) {
    const dirX = Math.cos(ang);
    const dirY = Math.sin(ang);
    let mapX = Math.floor(px);
    let mapY = Math.floor(py);
    const deltaDistX = Math.abs(1 / (dirX || EPS));
    const deltaDistY = Math.abs(1 / (dirY || EPS));
    let stepX, sideDistX;
    if (dirX < 0) {
      stepX = -1;
      sideDistX = (px - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - px) * deltaDistX;
    }
    let stepY, sideDistY;
    if (dirY < 0) {
      stepY = -1;
      sideDistY = (py - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - py) * deltaDistY;
    }
    let side = 0;
    let distTravel = 0;
    while (distTravel < maxDist) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      distTravel = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
      const tile = (state.world?.grid[mapY]?.[mapX]) || '#';
      if (tile !== '.') {
        return { dist: distTravel, tile, side, mapX, mapY, enemy: null };
      }
    }
    return null;
  }

  function worldRayHit(px, py, ang, maxDist = 32) {
    const hit = raycastHit(px, py, ang, maxDist);
    return hit;
  }

  function updatePlayer(dt) {
    const p = state.player;
    const world = state.world;
    const keys = input.keys;

    let speed = p.speed;
    if (keys.has('Shift')) speed *= 1.35;
    if (now() < p.abilityUntil && classDefs[state.classKey].ability === 'dash') speed *= 1.4;
    if (now() < p.shieldUntil) speed *= 0.95;
    if (p.heldObjective) speed *= 0.88;
    if (now() < p.cloakUntil) speed *= 1.04;

    if (keys.has('ArrowLeft')) p.dir -= 1.85 * dt;
    if (keys.has('ArrowRight')) p.dir += 1.85 * dt;

    p.dir += input.dx * 0.0027;
    input.dx = 0;

    const forwardX = Math.cos(p.dir);
    const forwardY = Math.sin(p.dir);
    const rightX = Math.cos(p.dir + Math.PI / 2);
    const rightY = Math.sin(p.dir + Math.PI / 2);

    let mx = 0, my = 0;
    if (keys.has('KeyW')) { mx += forwardX; my += forwardY; }
    if (keys.has('KeyS')) { mx -= forwardX; my -= forwardY; }
    if (keys.has('KeyD')) { mx += rightX; my += rightY; }
    if (keys.has('KeyA')) { mx -= rightX; my -= rightY; }

    const len = Math.hypot(mx, my) || 1;
    mx = mx / len * speed * dt;
    my = my / len * speed * dt;

    moveEntity(p, mx, my, 0.18);

    if (input.firing) {
      shootPlayer();
    }

    if (p.ammo <= 0 && p.reserve > 0 && now() > p.reloadAt) {
      // auto reload
      const mag = ammoCapacity(p.weapon);
      const needed = Math.min(mag, p.reserve);
      p.ammo = needed;
      p.reserve -= needed;
      p.reloadAt = now() + 650;
    }

    if (state.carried) {
      state.objective.x = p.x + Math.cos(p.dir) * 0.7;
      state.objective.y = p.y + Math.sin(p.dir) * 0.7;
    }

    // win check every frame
    if (p.heldObjective && dist(p.x, p.y, world.exit.x, world.exit.y) < world.exit.r) {
      state.victory = true;
      state.running = false;
      showMessage('Миссия выполнена.', 3000);
    }

    // pickup objective on E near it or at special zone
    if (keys.has('KeyE')) {
      keys.delete('KeyE');
      interact();
    }
  }

  function moveEntity(ent, mx, my, r) {
    const world = state.world;
    let nx = ent.x + mx;
    let ny = ent.y;
    if (!blockedWithMinesOrWalls(nx, ny, r)) ent.x = nx;
    nx = ent.x;
    ny = ent.y + my;
    if (!blockedWithMinesOrWalls(nx, ny, r)) ent.y = ny;
  }

  function blockedWithMinesOrWalls(x, y, r) {
    if (!canWalk(state.world, x, y, r)) return true;
    for (const pr of state.projectiles) {
      if (!pr.mine || !pr.friendly) continue;
      if (pr.born && pr.life <= 0) continue;
      if (dist(x, y, pr.x, pr.y) < 0.45) return true;
    }
    return false;
  }

  function updateEnemy(e, dt) {
    if (e.hp <= 0) return;
    const p = state.player;
    const stats = enemyStats(e.type);
    const t = now();
    const d = dist(e.x, e.y, p.x, p.y);
    const los = lineOfSight(state.world, e.x, e.y, p.x, p.y);
    const cloaked = t < p.cloakUntil;
    const aggro = t < e.aggroUntil || (d < (cloaked ? 3.8 : 7.5) && los);

    if (aggro) {
      const path = findPath(e.x, e.y, p.x, p.y, state.world, 14, 14);
      if (path.length > 1) {
        const next = path[1];
        const tx = next.x + 0.5;
        const ty = next.y + 0.5;
        const ang = Math.atan2(ty - e.y, tx - e.x);
        e.dir = ang;
        const sp = stats.speed * (e.type === 'grunt' ? 1.06 : 1);
        moveEnemy(e, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt, 0.17);
      }
      if (los && d < stats.range) {
        if (t > e.cooldown) {
          shootEnemy(e);
          e.cooldown = t + stats.cooldown;
        }
      }
    } else {
      // simple drift around spawn
      const wanderAng = e.dir + Math.sin(t * 0.0008 + e.id) * 0.4;
      moveEnemy(e, Math.cos(wanderAng) * stats.speed * 0.35 * dt, Math.sin(wanderAng) * stats.speed * 0.35 * dt, 0.17);
      if (Math.random() < 0.006) e.dir += (Math.random() - 0.5) * 0.8;
    }

    if (e.burnUntil > t) {
      if (Math.random() < 0.35) damageEnemy(e, 1);
    }
  }

  function moveEnemy(ent, mx, my, r) {
    let nx = ent.x + mx;
    let ny = ent.y;
    if (!blockedForEnemy(nx, ny, r)) ent.x = nx;
    nx = ent.x;
    ny = ent.y + my;
    if (!blockedForEnemy(nx, ny, r)) ent.y = ny;
  }

  function blockedForEnemy(x, y, r) {
    if (!canWalk(state.world, x, y, r)) return true;
    return false;
  }

  function shootEnemy(e) {
    const p = state.player;
    const s = enemyStats(e.type);
    const d = dist(e.x, e.y, p.x, p.y);
    if (d > s.range + 1.2) return;
    const t = now();
    const spread = e.type === 'sniper' ? 0.01 : e.type === 'flame' ? 0.26 : 0.06;
    const aim = Math.abs(normAngle(Math.atan2(p.y - e.y, p.x - e.x) - e.dir));
    if (aim > 0.75) return;
    const hitChance = e.type === 'flame' ? 1 : e.type === 'sniper' ? 0.98 : 0.85;
    if (Math.random() > hitChance) return;
    const hit = lineOfSight(state.world, e.x, e.y, p.x, p.y);
    if (!hit) return;
    let dmg = s.damage;
    if (now() < p.shieldUntil) dmg *= 0.72;
    if (state.classKey === 'jugger' && p.shieldUntil > t) dmg *= 0.88;
    p.health -= dmg;
    showMessage(`Попадание: -${Math.round(dmg)} HP`, 600);
    if (p.health <= 0) {
      p.health = 0;
      state.gameOver = true;
      state.running = false;
      showMessage('Ты пал. Нажми Start, чтобы попробовать снова.', 4000);
      setTimeout(() => {
        menu.style.display = 'flex';
        document.body.style.cursor = 'auto';
      }, 1200);
    }
  }

  function findPath(sx, sy, tx, ty, world, maxW, maxH) {
    const w = world.w, h = world.h;
    const start = { x: clamp(Math.floor(sx), 0, w - 1), y: clamp(Math.floor(sy), 0, h - 1) };
    const goal = { x: clamp(Math.floor(tx), 0, w - 1), y: clamp(Math.floor(ty), 0, h - 1) };
    const q = [start];
    const visited = new Set([`${start.x},${start.y}`]);
    const parent = new Map();
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
    ];
    while (q.length) {
      const cur = q.shift();
      if (cur.x === goal.x && cur.y === goal.y) break;
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (visited.has(key)) continue;
        if (world.grid[ny][nx] !== '.') continue;
        visited.add(key);
        parent.set(key, `${cur.x},${cur.y}`);
        q.push({ x: nx, y: ny });
      }
    }
    const goalKey = `${goal.x},${goal.y}`;
    if (!visited.has(goalKey)) {
      // fallback: direct path
      return [{ x: start.x, y: start.y }, { x: goal.x, y: goal.y }];
    }
    const path = [goal];
    let curKey = goalKey;
    while (curKey !== `${start.x},${start.y}` && parent.has(curKey)) {
      curKey = parent.get(curKey);
      const [x, y] = curKey.split(',').map(Number);
      path.push({ x, y });
    }
    path.reverse();
    return path;
  }

  function updateProjectiles(dt) {
    const t = now();
    for (const pr of state.projectiles) {
      if (pr.life <= 0) continue;
      if (pr.mine) continue;
      const step = dt * 0.001;
      pr.x += pr.vx * step;
      pr.y += pr.vy * step;
      pr.life -= dt;
      if (hasWall(state.world, pr.x, pr.y)) {
        if (pr.kind === 'grenade') {
          explode(pr.x, pr.y, pr.radius, pr.damage, pr.friendly);
        }
        pr.life = 0;
        continue;
      }
      if (pr.friendly) {
        for (const e of state.enemies) {
          if (e.hp <= 0) continue;
          if (dist(pr.x, pr.y, e.x, e.y) < 0.35) {
            if (pr.kind === 'syringe') {
              damageEnemy(e, 3);
            } else if (pr.kind === 'shuriken') {
              damageEnemy(e, 28);
            } else if (pr.kind === 'grenade') {
              explode(pr.x, pr.y, pr.radius, pr.damage, true);
            }
            pr.life = 0;
            break;
          }
        }
      } else {
        const p = state.player;
        if (dist(pr.x, pr.y, p.x, p.y) < 0.35) {
          let dmg = pr.damage;
          if (p.shieldUntil > t) dmg *= 0.72;
          p.health -= dmg;
          pr.life = 0;
          if (p.health <= 0) {
            p.health = 0;
            state.gameOver = true;
            state.running = false;
            showMessage('Ты пал. Нажми Start, чтобы попробовать снова.', 4000);
            setTimeout(() => {
              menu.style.display = 'flex';
              document.body.style.cursor = 'auto';
            }, 1200);
          }
        }
      }
    }

    // mines
    for (const mine of state.projectiles) {
      if (!mine.mine || mine.life <= 0) continue;
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        if (dist(mine.x, mine.y, e.x, e.y) < 0.45) {
          explode(mine.x, mine.y, 1.5, 170, true);
          mine.life = 0;
          break;
        }
      }
    }

    state.projectiles = state.projectiles.filter(p => p.life > 0);
  }

  function explode(x, y, radius, damage, friendly) {
    if (friendly) {
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const d = dist(x, y, e.x, e.y);
        if (d <= radius) {
          const mul = 1 - d / radius;
          damageEnemy(e, Math.round(damage * mul));
        }
      }
    } else {
      const p = state.player;
      const d = dist(x, y, p.x, p.y);
      if (d <= radius) {
        p.health -= Math.round(damage * (1 - d / radius));
      }
    }
  }

  function updatePickups() {
    if (!state.player) return;
    const p = state.player;
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (dist(p.x, p.y, pk.x, pk.y) < 0.6) {
        // auto pickup if close
      }
    }
  }

  function syncHUD() {
    if (!state.player) return;
    hpEl.textContent = Math.max(0, Math.round(state.player.health));
    ammoEl.textContent = `${Math.max(0, state.player.ammo)} / ${Math.max(0, state.player.reserve)}`;
    classEl.textContent = `${classDefs[state.classKey].name} · ${classDefs[state.classKey].loadoutName}`;
    if (state.victory) {
      objectiveEl.textContent = 'ПОБЕДА';
    } else if (state.player.heldObjective) {
      objectiveEl.textContent = 'ДОНОСИ К ЦЕЛИ';
    } else {
      objectiveEl.textContent = 'НАЙТИ ОБЪЕКТ';
    }
  }

  function render() {
    const p = state.player;
    const world = state.world;
    if (!p || !world) return;

    // sky / floor
    const sky = state.skyColor;
    const fog = state.fogColor;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky);
    g.addColorStop(0.48, '#40535f');
    g.addColorStop(0.49, fog);
    g.addColorStop(1, '#05080b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // subtle horizon glow
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, H * 0.45, W, 2);

    const depth = new Array(RAY_COUNT);
    const zoom = p.zoomUntil > now() ? 0.65 : 1;
    const fov = FOV * zoom;
    const centerX = W / 2;

    for (let x = 0; x < RAY_COUNT; x++) {
      const cam = (x / RAY_COUNT) - 0.5;
      const ang = p.dir + cam * fov;
      const hit = castRay(world, p.x, p.y, ang, 32);
      depth[x] = hit.dist;
      const distCorr = hit.dist * Math.cos(ang - p.dir);
      const wallH = Math.min(H * 2, (H / Math.max(distCorr, 0.0001)) * 0.9);
      const top = (H - wallH) / 2;
      const bottom = top + wallH;
      const pal = wallPalette[hit.tile] || wallPalette['#'];
      let fill = pal.base;
      const shade = hit.side ? 0.72 : 1.0;
      const fogFactor = clamp(1 - distCorr / 17, 0.18, 1);
      const rgb = shadeColor(fill, shade * fogFactor);
      ctx.fillStyle = rgb;
      ctx.fillRect(x, top, 1.2, wallH);
      if (hit.tile === 'G') {
        ctx.fillStyle = 'rgba(195,245,255,0.09)';
        ctx.fillRect(x, top, 1, wallH);
      }
      // subtle stripe texture by tile type
      if ((x & 7) === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(x, top, 1, wallH);
      }
      // ceiling/floor depth haze near edges
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(x, bottom, 1, H - bottom);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(x, 0, 1, top);
    }

    drawSprites(depth);
    drawWeaponModel();
    drawObjectiveMarker();
    drawWorldUI();
    drawMinimap();
    hideMessageIfDue();
  }

  function castRay(world, px, py, ang, maxDist = 32) {
    const dirX = Math.cos(ang);
    const dirY = Math.sin(ang);
    let mapX = Math.floor(px);
    let mapY = Math.floor(py);
    const deltaDistX = Math.abs(1 / (dirX || EPS));
    const deltaDistY = Math.abs(1 / (dirY || EPS));
    let stepX, sideDistX;
    if (dirX < 0) {
      stepX = -1;
      sideDistX = (px - mapX) * deltaDistX;
    } else {
      stepX = 1;
      sideDistX = (mapX + 1.0 - px) * deltaDistX;
    }
    let stepY, sideDistY;
    if (dirY < 0) {
      stepY = -1;
      sideDistY = (py - mapY) * deltaDistY;
    } else {
      stepY = 1;
      sideDistY = (mapY + 1.0 - py) * deltaDistY;
    }
    let side = 0;
    let tile = '#';
    while (true) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX;
        mapX += stepX;
        side = 0;
      } else {
        sideDistY += deltaDistY;
        mapY += stepY;
        side = 1;
      }
      if (mapX < 0 || mapY < 0 || mapX >= world.w || mapY >= world.h) break;
      tile = world.grid[mapY][mapX];
      if (tile !== '.') {
        const dist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
        return { dist, tile, side };
      }
      const dist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
      if (dist > maxDist) break;
    }
    return { dist: maxDist, tile: '#', side: 0 };
  }

  function shadeColor(hex, factor) {
    const rgb = hex.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16));
    const out = rgb.map(v => clamp(Math.floor(v * factor), 0, 255));
    return `rgb(${out[0]},${out[1]},${out[2]})`;
  }

  function drawSprites(depth) {
    const p = state.player;
    const sprites = [];

    // enemies
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const distVal = Math.hypot(dx, dy);
      const angle = normAngle(Math.atan2(dy, dx) - p.dir);
      if (Math.abs(angle) > FOV / 1.8 && !(now() < p.thermalUntil)) continue;
      sprites.push({
        kind: 'enemy',
        x: e.x, y: e.y, dist: distVal,
        angle,
        color: enemyStats(e.type).color,
        hp: e.hp,
        type: e.type,
        burn: e.burnUntil > now(),
      });
    }

    // objective
    sprites.push({
      kind: 'objective',
      x: state.objective.x,
      y: state.objective.y,
      dist: dist(p.x, p.y, state.objective.x, state.objective.y),
      angle: normAngle(Math.atan2(state.objective.y - p.y, state.objective.x - p.x) - p.dir),
      color: state.mapKey === 'bren' ? '#f0d56b' : '#8df0ff',
    });

    // pickups
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      sprites.push({
        kind: pk.kind,
        x: pk.x,
        y: pk.y,
        dist: dist(p.x, p.y, pk.x, pk.y),
        angle: normAngle(Math.atan2(pk.y - p.y, pk.x - p.x) - p.dir),
        color: pk.kind === 'ammo' ? '#ffd36a' : '#9effb7',
      });
    }

    sprites.sort((a, b) => b.dist - a.dist);

    for (const sp of sprites) {
      const angle = sp.angle;
      if (Math.abs(angle) > FOV / 1.45 && !(sp.kind === 'enemy' && now() < p.thermalUntil)) continue;
      const screenX = ((angle / (FOV / 2)) * 0.5 + 0.5) * W;
      const size = Math.min(H * 1.7, (H / Math.max(sp.dist * Math.cos(angle), 0.01)) * 0.9);
      const x = screenX - size / 2;
      const y = H / 2 - size / 2;
      const col = sp.color;
      const depthIndex = Math.floor(clamp(screenX, 0, W - 1));
      if (sp.dist * Math.cos(angle) > depth[depthIndex] + 0.2) continue;
      if (sp.kind === 'enemy') {
        drawEnemySprite(x, y, size, sp);
      } else if (sp.kind === 'objective') {
        drawObjectiveSprite(x, y, size, col);
      } else if (sp.kind === 'ammo') {
        drawPickupSprite(x, y, size * 0.42, col, 'AMMO');
      } else if (sp.kind === 'heal') {
        drawPickupSprite(x, y, size * 0.42, col, 'HP');
      }
    }

    // carried objective in front of camera
    if (p.heldObjective) {
      ctx.save();
      ctx.globalAlpha = 0.95;
      const x = W / 2 - 26;
      const y = H * 0.62;
      drawObjectiveSprite(x, y, 54, state.mapKey === 'bren' ? '#f0d56b' : '#8df0ff');
      ctx.restore();
    }
  }

  function drawEnemySprite(x, y, s, sp) {
    ctx.save();
    ctx.translate(x, y);
    const body = sp.burn ? '#ff9c59' : sp.color;
    const shadow = 'rgba(0,0,0,0.35)';
    // shadow
    ctx.fillStyle = shadow;
    roundRect(ctx, 6, 10, s * 0.72, s * 0.92, 8);
    ctx.fill();
    // torso
    ctx.fillStyle = body;
    roundRect(ctx, 0, 0, s * 0.68, s * 0.95, 8);
    ctx.fill();
    // head
    ctx.fillStyle = '#f4dbc8';
    ctx.beginPath();
    ctx.arc(s * 0.34, s * 0.17, s * 0.18, 0, TAU);
    ctx.fill();
    // helmet / hat by type
    ctx.fillStyle = sp.type === 'sniper' ? '#334d5c' : sp.type === 'flame' ? '#203040' : sp.type === 'heavy' ? '#6e5c45' : '#2d3c4b';
    ctx.fillRect(s * 0.12, 0, s * 0.44, s * 0.12);
    // gun
    ctx.fillStyle = '#1b2025';
    ctx.fillRect(s * 0.54, s * 0.42, s * 0.24, s * 0.06);
    // hp bar
    const hpW = s * 0.68;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(0, -12, hpW, 5);
    ctx.fillStyle = sp.burn ? '#ff8a3d' : '#8df0c7';
    const maxHp = enemyStats(sp.type).hp;
    ctx.fillRect(0, -12, hpW * clamp(sp.hp / maxHp, 0, 1), 5);
    // label if thermal vision
    if (now() < state.player.thermalUntil) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sp.type.toUpperCase(), hpW * 0.34, s + 14);
    }
    ctx.restore();
  }

  function drawObjectiveSprite(x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    const grad = ctx.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, color);
    grad.addColorStop(1, shadeColor(color, 0.62));
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, s, s * 0.65, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawPickupSprite(x, y, s, color, label) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, 0);
    ctx.lineTo(s, s * 0.5);
    ctx.lineTo(s * 0.5, s);
    ctx.lineTo(0, s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.font = `bold ${Math.max(8, s * 0.24)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, s * 0.5, s * 0.58);
    ctx.restore();
  }

  function drawObjectiveMarker() {
    const p = state.player;
    const o = state.objective;
    const d = dist(p.x, p.y, o.x, o.y);
    const text = state.carried ? (state.mapKey === 'bren' ? 'НЕСИ К ВОРОТАМ' : 'НЕСИ К ГРУЗОВИКУ') : (state.mapKey === 'bren' ? 'ЗОЛОТО ВПЕРЕДИ' : 'ДАННЫЕ ВПЕРЕДИ');
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(W - 270, H - 88, 250, 56);
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.strokeRect(W - 270, H - 88, 250, 56);
    ctx.fillStyle = '#fff';
    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, W - 252, H - 53);
    ctx.fillStyle = '#9cb0c6';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${missions[state.mapKey].objectiveName}: ${d.toFixed(1)} м`, W - 252, H - 33);
  }

  function drawWorldUI() {
    const p = state.player;
    if (!p) return;
    const t = now();
    const status = [];
    if (p.cloakUntil > t) status.push('ИНВИЗ');
    if (p.thermalUntil > t) status.push('ТЕПЛОВИЗОР');
    if (p.zoomUntil > t) status.push('ПРИЦЕЛ');
    if (p.shieldUntil > t) status.push('ЩИТ');
    if (p.abilityUntil > t && state.classKey === 'parkour') status.push('ЭНЕРГЕТИК');
    if (status.length) {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(18, H - 60, 260, 32);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(status.join(' · '), 28, H - 40);
    }

    // weapon silhouette
    ctx.save();
    ctx.translate(W / 2, H - 8);
    ctx.fillStyle = 'rgba(7,10,13,.95)';
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 2;
    if (state.classKey === 'flam') {
      roundRect(ctx, -110, -92, 220, 72, 16); ctx.fill();
      ctx.fillStyle = '#ff944d'; ctx.fillRect(-16, -50, 92, 14);
      ctx.fillStyle = '#20252b'; ctx.fillRect(44, -72, 18, 18);
    } else if (state.classKey === 'ninja') {
      roundRect(ctx, -78, -66, 140, 46, 12); ctx.fill();
      ctx.fillStyle = '#cfefff'; ctx.fillRect(18, -42, 82, 6);
    } else if (state.classKey === 'sniper') {
      roundRect(ctx, -136, -60, 260, 28, 10); ctx.fill();
      ctx.fillStyle = '#d6e9ff'; ctx.fillRect(42, -48, 120, 6);
    } else if (state.classKey === 'jugger') {
      roundRect(ctx, -150, -100, 300, 78, 16); ctx.fill();
      ctx.fillStyle = '#e6d6a4'; ctx.fillRect(-46, -60, 160, 18);
      ctx.fillStyle = '#34414d'; ctx.fillRect(68, -80, 20, 20);
    } else {
      roundRect(ctx, -110, -76, 220, 52, 14); ctx.fill();
      ctx.fillStyle = '#cfd7e1'; ctx.fillRect(-26, -50, 86, 8);
    }
    ctx.restore();
  }

  function drawWeaponModel() {
    // kept inside drawWorldUI for simplicity; placeholder room for future
  }

  function drawMinimap() {
    if (!minimap || minimap.classList.contains('hidden')) return;
    const w = state.world.w, h = state.world.h;
    const size = 220;
    const cell = size / Math.max(w, h);
    const mctx = minimap.getContext('2d');
    minimap.width = size * dpr;
    minimap.height = size * dpr;
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, size, size);
    mctx.fillStyle = 'rgba(0,0,0,.44)';
    mctx.fillRect(0, 0, size, size);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = state.world.grid[y][x];
        if (ch !== '.') {
          const pal = wallPalette[ch] || wallPalette['#'];
          mctx.fillStyle = pal.base;
          mctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
    mctx.fillStyle = state.mapKey === 'bren' ? '#f0d56b' : '#8df0ff';
    mctx.fillRect(state.objective.x * cell - 2, state.objective.y * cell - 2, 4, 4);
    if (state.player.heldObjective) {
      mctx.fillStyle = '#fff';
      mctx.fillRect(state.player.x * cell - 2, state.player.y * cell - 2, 4, 4);
    }
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      mctx.fillStyle = '#ff7474';
      mctx.fillRect(e.x * cell - 2, e.y * cell - 2, 4, 4);
    }
    mctx.fillStyle = '#6dff9c';
    mctx.fillRect(state.player.x * cell - 3, state.player.y * cell - 3, 6, 6);
    const dx = Math.cos(state.player.dir) * 1.2;
    const dy = Math.sin(state.player.dir) * 1.2;
    mctx.strokeStyle = '#6dff9c';
    mctx.beginPath();
    mctx.moveTo(state.player.x * cell, state.player.y * cell);
    mctx.lineTo((state.player.x + dx) * cell, (state.player.y + dy) * cell);
    mctx.stroke();
    mctx.fillStyle = '#fff';
    mctx.font = 'bold 10px sans-serif';
    mctx.fillText(missions[state.mapKey].name, 8, 14);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function loop(ts) {
    if (!state.running) return;
    const dt = Math.min(40, ts - (loop.last || ts));
    loop.last = ts;
    if (state.player) {
      updatePlayer(dt);
      for (const e of state.enemies) updateEnemy(e, dt);
      updateProjectiles(dt);
      updatePickups();
      syncHUD();
      if (state.player.health <= 0 && !state.gameOver) state.gameOver = true;
      if (!state.victory && state.player.heldObjective && dist(state.player.x, state.player.y, state.world.exit.x, state.world.exit.y) < state.world.exit.r) {
        state.victory = true;
        state.running = false;
        showMessage('Миссия выполнена.', 3000);
        setTimeout(() => {
          menu.style.display = 'flex';
          document.body.style.cursor = 'auto';
        }, 1200);
      }
    }
    render();
    requestAnimationFrame(loop);
  }

  // Input
  window.addEventListener('keydown', (e) => {
    input.keys.add(e.code);
    if (e.code === 'Tab') {
      e.preventDefault();
      minimap.classList.toggle('hidden');
    }
    if (e.code === 'KeyQ') {
      e.preventDefault();
      if (state.running) useAbility();
    }
    if (e.code === 'KeyE') {
      e.preventDefault();
      if (state.running) state.keysPress = true;
    }
    if (e.code === 'Space' && state.running && state.classKey === 'parkour') {
      e.preventDefault();
      state.player.abilityUntil = now() + 1500;
    }
    if (e.code === 'Enter' && menu.style.display !== 'none') {
      startGame();
    }
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));

  canvas.addEventListener('click', () => {
    if (!state.running) return;
    pointerLock();
    input.mouseDown = true;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('auxclick', (e) => {
    if (e.button === 2 && state.running) {
      e.preventDefault();
      // alternative ability reserved for sniper zoom / soldier thermal is Q above; right click only toggles zoom if sniper
      if (state.classKey === 'sniper') {
        state.player.zoomUntil = now() + 9000;
      }
    }
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.firing = true;
    if (e.button === 2) input.mouseRight = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.firing = false;
    if (e.button === 2) input.mouseRight = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      input.dx += e.movementX || 0;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    input.mouseLocked = document.pointerLockElement === canvas;
  });

  startBtn.addEventListener('click', startGame);
  buildMenu();
  showMessage('Выберите миссию и класс. Нажмите Start.', 5000);
  syncHUD();

  window.addEventListener('resize', () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  });
})();
