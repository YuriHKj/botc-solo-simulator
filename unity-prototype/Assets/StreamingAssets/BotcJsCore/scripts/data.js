import { ROLE_LOCALIZATION } from "./role_localization.js";

export const PLAYER_SETUP = {
  5: { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
  6: { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
  7: { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
  8: { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
  9: { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
  10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
  11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
  12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
  13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
  14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
  15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
};

function role(name, category, team, tags = []) {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    englishName: name,
    category,
    team,
    tags,
    icon: null,
  };
}

const troubleBrewing = {
  id: "tb",
  shortName: "TB",
  name: "暗流涌动 (Trouble Brewing)",
  description: "基础剧本，信息线较清晰，适合建立推理基准。",
  roles: {
    townsfolk: [
      role("Washerwoman", "townsfolk", "good", ["info", "firstNight"]),
      role("Librarian", "townsfolk", "good", ["info", "firstNight"]),
      role("Investigator", "townsfolk", "good", ["info", "firstNight"]),
      role("Chef", "townsfolk", "good", ["info", "firstNight"]),
      role("Empath", "townsfolk", "good", ["info", "recurring"]),
      role("Fortune Teller", "townsfolk", "good", ["info", "recurring"]),
      role("Undertaker", "townsfolk", "good", ["info", "recurring"]),
      role("Monk", "townsfolk", "good", ["protect", "recurring"]),
      role("Ravenkeeper", "townsfolk", "good", ["info", "onDeath"]),
      role("Virgin", "townsfolk", "good", ["social"]),
      role("Slayer", "townsfolk", "good", ["burst"]),
      role("Soldier", "townsfolk", "good", ["defense"]),
      role("Mayor", "townsfolk", "good", ["lateGame"]),
    ],
    outsider: [
      role("Butler", "outsider", "good", ["outsider"]),
      role("Drunk", "outsider", "good", ["drunk", "outsider"]),
      role("Recluse", "outsider", "good", ["outsider", "misregister"]),
      role("Saint", "outsider", "good", ["outsider", "risk"]),
    ],
    minion: [
      role("Poisoner", "minion", "evil", ["poisonSource", "recurring"]),
      role("Spy", "minion", "evil", ["intel", "misregister"]),
      role("Scarlet Woman", "minion", "evil", ["demonBackup"]),
      role("Baron", "minion", "evil", ["setupShift"]),
    ],
    demon: [role("Imp", "demon", "evil", ["demon", "kill", "recurring"])],
  },
};

const badMoonRising = {
  id: "bmr",
  shortName: "BMR",
  name: "黯月初升 (Bad Moon Rising)",
  description: "夜间死亡节奏复杂，重在从死亡模式做逆向推理。",
  roles: {
    townsfolk: [
      role("Grandmother", "townsfolk", "good", ["info", "firstNight"]),
      role("Sailor", "townsfolk", "good", ["protect", "recurring"]),
      role("Chambermaid", "townsfolk", "good", ["info", "recurring"]),
      role("Exorcist", "townsfolk", "good", ["control", "recurring"]),
      role("Innkeeper", "townsfolk", "good", ["protect", "recurring"]),
      role("Gambler", "townsfolk", "good", ["risk", "recurring"]),
      role("Gossip", "townsfolk", "good", ["social", "recurring"]),
      role("Courtier", "townsfolk", "good", ["control"]),
      role("Professor", "townsfolk", "good", ["revive"]),
      role("Minstrel", "townsfolk", "good", ["control"]),
      role("Tea Lady", "townsfolk", "good", ["protect", "recurring"]),
      role("Pacifist", "townsfolk", "good", ["protect"]),
      role("Fool", "townsfolk", "good", ["defense"]),
    ],
    outsider: [
      role("Tinker", "outsider", "good", ["outsider", "risk"]),
      role("Moonchild", "outsider", "good", ["outsider", "onDeath"]),
      role("Goon", "outsider", "good", ["outsider", "chaos"]),
      role("Lunatic", "outsider", "good", ["outsider", "falseInfo"]),
    ],
    minion: [
      role("Godfather", "minion", "evil", ["kill"]),
      role("Devil's Advocate", "minion", "evil", ["protect", "recurring"]),
      role("Assassin", "minion", "evil", ["burst"]),
      role("Mastermind", "minion", "evil", ["lateGame"]),
    ],
    demon: [
      role("Zombuul", "demon", "evil", ["demon", "kill", "recurring"]),
      role("Pukka", "demon", "evil", ["demon", "poisonSource", "kill", "recurring"]),
      role("Shabaloth", "demon", "evil", ["demon", "kill", "doubleKill", "recurring"]),
      role("Po", "demon", "evil", ["demon", "kill", "burst", "recurring"]),
    ],
  },
};

const sectsAndViolets = {
  id: "snv",
  shortName: "SnV",
  name: "梦殒春宵 (Sects & Violets)",
  description: "高信息密度与身份扰动并存，强调冲突信息下的概率推理。",
  roles: {
    townsfolk: [
      role("Clockmaker", "townsfolk", "good", ["info", "firstNight"]),
      role("Dreamer", "townsfolk", "good", ["info", "recurring"]),
      role("Snake Charmer", "townsfolk", "good", ["risk", "control", "recurring"]),
      role("Mathematician", "townsfolk", "good", ["info", "recurring"]),
      role("Flowergirl", "townsfolk", "good", ["info", "recurring"]),
      role("Town Crier", "townsfolk", "good", ["info", "recurring"]),
      role("Oracle", "townsfolk", "good", ["info", "recurring"]),
      role("Savant", "townsfolk", "good", ["info", "recurring"]),
      role("Seamstress", "townsfolk", "good", ["info"]),
      role("Philosopher", "townsfolk", "good", ["control", "chaos"]),
      role("Artist", "townsfolk", "good", ["info"]),
      role("Juggler", "townsfolk", "good", ["info"]),
      role("Sage", "townsfolk", "good", ["info", "onDeath"]),
    ],
    outsider: [
      role("Mutant", "outsider", "good", ["outsider", "social"]),
      role("Sweetheart", "outsider", "good", ["outsider", "drunkOnDeath"]),
      role("Barber", "outsider", "good", ["outsider", "swap"]),
      role("Klutz", "outsider", "good", ["outsider", "onDeath"]),
    ],
    minion: [
      role("Evil Twin", "minion", "evil", ["social", "recurring"]),
      role("Witch", "minion", "evil", ["control", "recurring"]),
      role("Cerenovus", "minion", "evil", ["control", "recurring"]),
      role("Pit-Hag", "minion", "evil", ["transform", "recurring"]),
    ],
    demon: [
      role("Fang Gu", "demon", "evil", ["demon", "kill", "jump", "recurring"]),
      role("Vigormortis", "demon", "evil", ["demon", "kill", "recurring"]),
      role("No Dashii", "demon", "evil", ["demon", "poisonSource", "kill", "recurring"]),
      role("Vortox", "demon", "evil", ["demon", "misinfo", "kill", "recurring"]),
    ],
  },
};

export const SCRIPT_DEFINITIONS = [troubleBrewing, badMoonRising, sectsAndViolets];

function localizeScriptRoles(script) {
  const localRoles = ROLE_LOCALIZATION[script.id] ?? {};
  const categories = ["townsfolk", "outsider", "minion", "demon"];
  categories.forEach((category) => {
    script.roles[category].forEach((entry) => {
      const localized = localRoles[entry.id];
      if (!localized) {
        return;
      }
      entry.name = localized.name ?? entry.name;
      entry.icon = localized.icon ?? entry.icon;
    });
  });
}

SCRIPT_DEFINITIONS.forEach((script) => localizeScriptRoles(script));

export const SCRIPT_MAP = SCRIPT_DEFINITIONS.reduce((acc, script) => {
  acc[script.id] = script;
  return acc;
}, {});

export function getPlayerSetup(playerCount) {
  return PLAYER_SETUP[playerCount] ?? null;
}

export function shuffle(list, rng = Math.random) {
  const cloned = [...list];
  for (let idx = cloned.length - 1; idx > 0; idx -= 1) {
    const swapIdx = Math.floor(rng() * (idx + 1));
    [cloned[idx], cloned[swapIdx]] = [cloned[swapIdx], cloned[idx]];
  }
  return cloned;
}

export function sample(list, amount, rng = Math.random) {
  if (amount <= 0) {
    return [];
  }
  return shuffle(list, rng).slice(0, amount);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function rolePoolByCategory(scriptId, category) {
  const script = SCRIPT_MAP[scriptId];
  if (!script) {
    return [];
  }
  return script.roles[category] ?? [];
}

export function getRoleById(scriptId, roleId) {
  const script = SCRIPT_MAP[scriptId];
  if (!script) {
    return null;
  }
  const categories = ["townsfolk", "outsider", "minion", "demon"];
  for (const category of categories) {
    const hit = script.roles[category].find((entry) => entry.id === roleId);
    if (hit) {
      return hit;
    }
  }
  return null;
}

export function getAllRoles(scriptId) {
  const script = SCRIPT_MAP[scriptId];
  if (!script) {
    return [];
  }
  return [
    ...script.roles.townsfolk,
    ...script.roles.outsider,
    ...script.roles.minion,
    ...script.roles.demon,
  ];
}

export const REASON_SNIPPETS = {
  bluffHit: "ta 的身份声称命中恶魔常用伪装位",
  duplicateClaim: "ta 的身份声称与他人冲突",
  antiGoodVote: "ta 的投票更像在保护邪恶方",
  proGoodVote: "ta 的投票帮助了好人处决",
  suspiciousNomination: "ta 主动推进了高风险提名",
  nightPattern: "夜间死亡节奏和 ta 的白天行为出现关联",
};

