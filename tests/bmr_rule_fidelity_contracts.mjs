import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BMR_AGENT_POLICIES,
  BMR_NIGHT_ORDER,
  BMR_ROLE_ACTION_RULES,
  BMR_ROLE_DEFINITIONS,
  BMR_RULE_FIDELITY,
  BMR_RULE_HANDLERS,
  BMR_STORYTELLER_POLICIES,
  countBMRAbilityWakes,
  runBadMoonRisingNight,
} from "../scripts/roles/bmr.js";

const EXPECTED_ROLES = [
  "grandmother",
  "sailor",
  "chambermaid",
  "exorcist",
  "innkeeper",
  "gambler",
  "gossip",
  "courtier",
  "professor",
  "minstrel",
  "tea-lady",
  "pacifist",
  "fool",
  "tinker",
  "moonchild",
  "goon",
  "lunatic",
  "godfather",
  "devil-s-advocate",
  "assassin",
  "mastermind",
  "zombuul",
  "pukka",
  "shabaloth",
  "po",
];

const SHARED_INTERFACE_ROLES = [
  "chambermaid",
  "innkeeper",
  "gambler",
  "courtier",
  "professor",
  "tinker",
  "moonchild",
  "goon",
  "lunatic",
  "godfather",
  "shabaloth",
  "po",
];

function player(id, roleId, category = "townsfolk", team = "good", extra = {}) {
  return {
    id,
    name: id,
    roleId,
    roleName: roleId,
    category,
    team,
    alive: true,
    poisoned: false,
    poisonedTomorrowDay: false,
    isHuman: false,
    ...extra,
  };
}

function bmrState(players, extra = {}) {
  return {
    scriptId: "bmr",
    phase: "night",
    day: 1,
    night: 2,
    players,
    logs: [],
    events: { executions: [], dayDeaths: [], nightDeaths: [], infoPings: [], speeches: [] },
    bmr: {
      exorcisedDemonId: null,
      exorcistLastTargetById: {},
      innkeeperProtectedIds: [],
      innkeeperDrunkId: null,
      sailorDrunkIds: [],
      devilsAdvocateProtectedId: null,
      devilsAdvocateLastTargetById: {},
      assassinUsedByIds: [],
      professorUsedByIds: [],
      courtierUsedByIds: [],
      courtierPlannedRoleById: {},
      suppressedByRoleId: {},
      pukkaPoisonedId: null,
      poCharged: false,
      zombuulRevived: false,
      zombuulHiddenDead: false,
      zombuulHiddenDeadPlayerId: null,
      shabalothLastTargets: [],
      grandmotherChildById: {},
      godfatherBonusKillTonight: false,
      gossipPendingKills: 0,
      moonchildPendingById: {},
      moonchildResolvedById: {},
      foolSavedById: {},
      teaLadyProtectedIds: [],
      pacifistSavedToday: false,
      goonTriggeredNight: 0,
      minstrelAoeDrunkUntilNight: 0,
      mastermindPendingDay: null,
      tinkersToAutoKill: {},
      wokeTonightByPlayerId: {},
      ...extra,
    },
  };
}

function mockContext(state, { rng = () => 0.99, plans = {}, targets = {} } = {}) {
  const log = (gameState, type, message, payload = {}) => gameState.logs.push({ type, message, payload });
  const byId = (id) => state.players.find((entry) => entry.id === id) ?? null;
  const death = (gameState, victim, reason, payload = {}, passedRng, options = {}) => {
    if (!victim?.alive) return false;
    const prevention = BMR_RULE_HANDLERS.onBeforeNightDeath?.(mock, {
      victim,
      reason,
      payload,
      unstoppable: !!options.unstoppable,
    });
    if (prevention?.prevented) return false;
    victim.alive = false;
    gameState.events.nightDeaths.push({ night: gameState.night, playerId: victim.id, reason });
    BMR_RULE_HANDLERS.onAfterNightDeath?.(mock, { victim, reason, payload });
    BMR_RULE_HANDLERS.onAfterDeath?.(mock, { victim, reason, payload, phase: "night" });
    return true;
  };
  const mock = {
    state,
    rng,
    addAbilityInterference: () => {},
    addLog: log,
    addPrivateInfo: (gameState, actor, text) => {
      actor.privateInfo = [...(actor.privateInfo ?? []), text];
    },
    aliveNeighbors: () => [],
    chooseOne: (list) => list?.[0] ?? null,
    chooseRandomAliveExcluding: (gameState, excluded) =>
      gameState.players.find((entry) => entry.alive && !excluded.includes(entry.id)) ?? null,
    consumeHumanNightPlan: (gameState, actor) => plans[actor.id] ?? null,
    consumeHumanNightPlanTargets: (gameState, actor) => plans[actor.id]?.targets ?? null,
    enqueueStorytellerAction: null,
    finalizeWinner: (gameState, winner, reason) => {
      gameState.gameOver = true;
      gameState.winner = winner;
      gameState.winReason = reason;
    },
    getAliveDemons: (gameState) => gameState.players.filter((entry) => entry.alive && entry.category === "demon"),
    getAlivePlayers: (gameState) => gameState.players.filter((entry) => entry.alive),
    getAllRoles: () => [],
    getEffectiveRoleId: (entry) => entry.roleId,
    getNightOrderRoleIds: () => [],
    getPlayerById: (gameState, id) => byId(id),
    getPubliclyAlivePlayers: (gameState) => gameState.players.filter((entry) => entry.alive),
    getRoleById: () => null,
    playerChoiceOptions: () => [],
    isAbilityBlocked: (entry) => !!entry?.poisoned,
    isRoleNightWindowOpen: () => true,
    markWokeTonight: (gameState, actor, reason) => {
      gameState.bmr.wokeTonightByPlayerId[actor.id] = reason;
    },
    pickNightTargets: (gameState, actor, count) => (targets[actor.id] ?? []).slice(0, count),
    processDayDeath: death,
    processNightDeath: death,
    sample: (list, amount) => list.slice(0, amount),
  };
  return mock;
}

function testAuditLedgerIsComplete() {
  assert.deepEqual(Object.keys(BMR_ROLE_DEFINITIONS).sort(), [...EXPECTED_ROLES].sort());
  assert.deepEqual(Object.keys(BMR_RULE_FIDELITY).sort(), [...EXPECTED_ROLES].sort());
  Object.entries(BMR_RULE_FIDELITY).forEach(([roleId, entry]) => {
    assert.equal(entry.roleId, roleId);
    assert.ok(entry.officialRule, `${roleId} needs an official-rule summary`);
    assert.ok(entry.coverage, `${roleId} needs a coverage classification`);
    assert.ok(Array.isArray(entry.contracts) && entry.contracts.length > 0, `${roleId} needs executable contract ids`);
    assert.ok(Array.isArray(entry.dimensions) && entry.dimensions.length > 0, `${roleId} needs audited dimensions`);
  });
  SHARED_INTERFACE_ROLES.forEach((roleId) => {
    assert.equal(BMR_RULE_FIDELITY[roleId].coverage, "shared-interface-required", `${roleId} must not overclaim local completion`);
  });
}

function testTrackedAuditArtifactsCoverEveryRoleAndBoundary() {
  const matrix = readFileSync(new URL("../docs/design/BMR_RULE_FIDELITY_MATRIX.md", import.meta.url), "utf8");
  const verification = readFileSync(new URL("../docs/verification/BMR_RULE_FIDELITY_2026-07-20.md", import.meta.url), "utf8");
  const roleRows = matrix.split(/\r?\n/).filter((line) => /^\| \[[^#]/.test(line));
  assert.equal(roleRows.length, 25, "the design matrix must contain exactly 25 linked role rows");
  assert.match(matrix, /Mandatory official clauses audited/);
  assert.match(matrix, /Simulator Storyteller\/agent policy/);
  for (let issue = 7; issue <= 12; issue += 1) {
    assert.match(matrix, new RegExp(`issues/${issue}\\b`), `matrix must link shared interface issue #${issue}`);
    assert.match(verification, new RegExp(`issues/${issue}\\b`), `verification must link shared interface issue #${issue}`);
  }
  assert.match(verification, /0c32bf6d13ee2497305e9d4d2146b0673acfd388/);
  assert.match(verification, /does not provide an export named 'BMR_NIGHT_ORDER'/);
}

function testOfficialNightOrderIsExplicit() {
  assert.deepEqual(BMR_NIGHT_ORDER.first, [
    "lunatic", "sailor", "courtier", "godfather", "devil-s-advocate", "pukka", "grandmother", "chambermaid",
  ]);
  assert.deepEqual(BMR_NIGHT_ORDER.other, [
    "sailor", "innkeeper", "courtier", "gambler", "devil-s-advocate", "lunatic", "exorcist", "zombuul",
    "pukka", "shabaloth", "po", "assassin", "godfather", "professor", "gossip", "tinker", "moonchild",
    "grandmother", "chambermaid",
  ]);
}

function testStorytellerPoliciesAreNamedAndAuditable() {
  ["pacifist", "tinker", "shabaloth-regurgitation", "gossip-unparsed"].forEach((id) => {
    const policy = BMR_STORYTELLER_POLICIES[id];
    assert.ok(policy, `missing policy ${id}`);
    assert.ok(policy.id && policy.rule && policy.determinism, `policy ${id} is incomplete`);
    assert.equal(/0\.\d+|percent|probability/i.test(JSON.stringify(policy)), false, `${id} must not hide a probability`);
  });
  Object.values(BMR_STORYTELLER_POLICIES).forEach((policy) => {
    assert.ok(policy.id && policy.rule && policy.determinism);
    assert.equal(/0\.\d+|percent|probability/i.test(JSON.stringify(policy)), false, `${policy.id} must not hide a probability`);
  });
  Object.values(BMR_AGENT_POLICIES).forEach((policy) => {
    assert.ok(policy.id && policy.rule && policy.determinism);
    assert.equal(/0\.\d+|percent|probability/i.test(JSON.stringify(policy)), false, `${policy.id} must not hide a probability`);
  });
  const source = readFileSync(new URL("../scripts/roles/bmr.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /rng\(\)\s*[<>]=?\s*0\./, "BMR decisions must not hide inline probability thresholds");
  assert.doesNotMatch(source, /Math\.random/, "BMR must use the caller-provided RNG only");
}

function testOfficialTargetDescriptors() {
  assert.equal(BMR_ROLE_ACTION_RULES.pukka.minNight, 1, "Pukka acts on the first night");
  assert.equal(BMR_ROLE_ACTION_RULES.sailor.allowSelf, true, "Sailor may choose themself");
  assert.equal(BMR_ROLE_ACTION_RULES.pukka.allowDead, true, "Pukka may choose a dead player");
  assert.equal(BMR_ROLE_ACTION_RULES.shabaloth.allowDead, true, "Shabaloth may choose dead players");
  assert.equal(BMR_ROLE_ACTION_RULES.exorcist.allowDead, true, "Exorcist may choose a dead player");
  assert.equal(BMR_ROLE_ACTION_RULES.gambler.allowSelf, true, "Gambler may choose themself");
  assert.equal(BMR_ROLE_ACTION_RULES.gambler.allowDead, true, "Gambler may choose a dead player");
}

function testPukkaSelectsThenResolvesPreviousPoison() {
  const pukka = player("pukka", "pukka", "demon", "evil");
  const oldTarget = player("old", "chambermaid");
  const newTarget = player("new", "gossip");
  const state = bmrState([pukka, oldTarget, newTarget], { pukkaPoisonedId: oldTarget.id });
  oldTarget.poisoned = true;
  runBadMoonRisingNight(mockContext(state, { targets: { [pukka.id]: [newTarget] } }));

  assert.equal(oldTarget.alive, false);
  assert.equal(oldTarget.poisoned, false, "the previous target becomes healthy after the Pukka death attempt");
  assert.equal(newTarget.poisoned, true);
  assert.equal(state.bmr.pukkaPoisonedId, newTarget.id);
  const selectIndex = state.logs.findIndex((entry) => entry.payload?.targetId === newTarget.id && entry.payload?.policyId === "pukka-select-before-death");
  const deathIndex = state.events.nightDeaths.findIndex((entry) => entry.playerId === oldTarget.id);
  assert.ok(
    selectIndex >= 0 && deathIndex >= 0,
    "Pukka selection and delayed death must both be observable"
  );
}

function testShabalothRegurgitationUsesNamedPolicyNotChance() {
  const shabaloth = player("shab", "shabaloth", "demon", "evil");
  const previous = player("previous", "fool", "townsfolk", "good", { alive: false });
  const a = player("a", "gossip");
  const b = player("b", "tinker", "outsider");
  const state = bmrState([shabaloth, previous, a, b], { shabalothLastTargets: [previous.id] });
  runBadMoonRisingNight(mockContext(state, { rng: () => 0.99, targets: { [shabaloth.id]: [a, b] } }));

  assert.equal(previous.alive, true, "eligible prior victim is deterministically regurgitated by policy");
  assert.deepEqual(state.bmr.shabalothLastTargets, [a.id, b.id]);
  assert.ok(state.logs.some((entry) => entry.payload?.policyId === "shabaloth-regurgitate-first-seat"));
}

function testChargedPoCompletesThreeSequentialSelections() {
  const po = player("po", "po", "demon", "evil", { isHuman: true });
  const targets = [player("a", "gossip"), player("b", "chambermaid"), player("c", "tinker", "outsider")];
  const state = bmrState([po, ...targets], { poCharged: true });
  runBadMoonRisingNight(mockContext(state, {
    plans: { [po.id]: { mode: "kill", targets: targets.slice(0, 2) } },
    targets: { [po.id]: targets },
  }));
  assert.equal(state.bmr.poCharged, false);
  assert.deepEqual(state.events.nightDeaths.map((entry) => entry.playerId), targets.map((entry) => entry.id));
}

function testPacifistPolicyIsDeterministicAndLogged() {
  const pacifist = player("pacifist", "pacifist");
  const victim = player("victim", "gossip");
  const state = bmrState([pacifist, victim]);
  const ctx = mockContext(state, { rng: () => 0.99 });
  const result = BMR_RULE_HANDLERS.onBeforeExecutionDeath(ctx, { victim, reason: "execution" });
  assert.equal(result.prevented, true);
  assert.ok(state.logs.some((entry) => entry.payload?.policyId === "pacifist-first-eligible-good-execution"));
}

function testTinkerOnlyDiesAtExplicitPolicyCheckpoint() {
  const tinker = player("tinker", "tinker", "outsider");
  const state = bmrState([tinker]);
  runBadMoonRisingNight(mockContext(state, { rng: () => 0 }));
  assert.equal(tinker.alive, true, "passed RNG alone must not secretly decide Tinker death");

  state.bmr.tinkersToAutoKill[tinker.id] = state.night;
  runBadMoonRisingNight(mockContext(state, { rng: () => 0.99 }));
  assert.equal(tinker.alive, false, "an explicit scheduled checkpoint must deterministically kill Tinker");
}

function testMoonchildSnapshotsAlignmentAndChecksAbilityAtResolution() {
  const moonchild = player("moonchild", "moonchild", "outsider", "good", { alive: false });
  const target = player("target", "goon", "outsider", "good");
  const state = bmrState([moonchild, target], {
    moonchildPendingById: {
      [moonchild.id]: { targetId: target.id, selectedTeam: "good", selectedNight: 1 },
    },
  });
  target.team = "evil";
  runBadMoonRisingNight(mockContext(state));
  assert.equal(target.alive, false, "Moonchild uses alignment at selection, not current alignment");

  const blockedTarget = player("blocked-target", "gossip");
  const blockedMoonchild = player("blocked-moonchild", "moonchild", "outsider", "good", { alive: false, poisoned: true });
  const blockedState = bmrState([blockedMoonchild, blockedTarget], {
    moonchildPendingById: {
      [blockedMoonchild.id]: { targetId: blockedTarget.id, selectedTeam: "good", selectedNight: 1 },
    },
  });
  runBadMoonRisingNight(mockContext(blockedState));
  assert.equal(blockedTarget.alive, true, "a blocked Moonchild has no ability when the delayed effect resolves");
}

function testInnkeeperProtectionCoversEveryNightDeathExceptUnstoppable() {
  const innkeeper = player("inn", "innkeeper");
  const victim = player("victim", "gambler");
  const state = bmrState([innkeeper, victim], { innkeeperProtectedIds: [victim.id], innkeeperProtectionNight: 2 });
  const ctx = mockContext(state);
  assert.equal(BMR_RULE_HANDLERS.onBeforeNightDeath(ctx, { victim, reason: "gambler-fail", unstoppable: false }).prevented, true);
  assert.equal(BMR_RULE_HANDLERS.onBeforeNightDeath(ctx, { victim, reason: "assassin-kill", unstoppable: true }).prevented, false);
}

function testChambermaidCountsActualWakeReceipts() {
  const state = bmrState([player("awake", "gambler"), player("asleep", "courtier")], {
    wokeTonightByPlayerId: { awake: "gambler" },
  });
  assert.equal(countBMRAbilityWakes(state, ["awake", "asleep"]), 1);
}

function testMastermindArmsOnlyWhenDemonDeathWouldEndTheGame() {
  const mastermind = player("mastermind", "mastermind", "minion", "evil");
  const victim = player("victim", "pukka", "demon", "evil", { alive: false });
  const otherDemon = player("other-demon", "po", "demon", "evil");
  const state = bmrState([mastermind, victim, otherDemon]);
  const ctx = mockContext(state);

  BMR_RULE_HANDLERS.onAfterExecutionDeath(ctx, { victim });
  assert.equal(state.bmr.mastermindPendingDay, null, "another living Demon means the game would not end");

  otherDemon.alive = false;
  BMR_RULE_HANDLERS.onAfterExecutionDeath(ctx, { victim });
  assert.equal(state.bmr.mastermindPendingDay, state.day + 1);
  assert.ok(state.logs.some((entry) => entry.payload?.wouldEndByNoLivingDemon === true));
}

const tests = [
  testAuditLedgerIsComplete,
  testTrackedAuditArtifactsCoverEveryRoleAndBoundary,
  testOfficialNightOrderIsExplicit,
  testStorytellerPoliciesAreNamedAndAuditable,
  testOfficialTargetDescriptors,
  testPukkaSelectsThenResolvesPreviousPoison,
  testShabalothRegurgitationUsesNamedPolicyNotChance,
  testChargedPoCompletesThreeSequentialSelections,
  testPacifistPolicyIsDeterministicAndLogged,
  testTinkerOnlyDiesAtExplicitPolicyCheckpoint,
  testMoonchildSnapshotsAlignmentAndChecksAbilityAtResolution,
  testInnkeeperProtectionCoversEveryNightDeathExceptUnstoppable,
  testChambermaidCountsActualWakeReceipts,
  testMastermindArmsOnlyWhenDemonDeathWouldEndTheGame,
];

for (const test of tests) {
  test();
  console.log(`ok - ${test.name}`);
}

console.log(`BMR rule fidelity contracts passed (${tests.length}).`);
