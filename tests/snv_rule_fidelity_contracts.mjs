import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  advanceDayStage,
  beginNightPhase,
  createNewGame,
  getEffectiveRoleId,
  getHumanNightActionState,
  getPendingStorytellerActionState,
  markPublicDiscussionRound,
  processDayDeath,
  processNightDeath,
  registerClaim,
  runNight,
  setHumanNightActionPlan,
  skipDay,
  withSeededRandom,
} from "../scripts/engine.js";
import { getRoleById } from "../scripts/data.js";
import { SNV_ROLE_ACTION_RULES, SNV_ROLE_DEFINITIONS } from "../scripts/roles/snv.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const canonicalPath = path.join(root, "scripts", "roles", "snv.js");
const unityMirrorPath = path.join(
  root,
  "unity-prototype",
  "Assets",
  "StreamingAssets",
  "BotcJsCore",
  "scripts",
  "roles",
  "snv.js"
);
const canonicalSource = fs.readFileSync(canonicalPath, "utf8");

const EXPECTED_ROLES = [
  "artist",
  "barber",
  "cerenovus",
  "clockmaker",
  "dreamer",
  "evil-twin",
  "fang-gu",
  "flowergirl",
  "juggler",
  "klutz",
  "mathematician",
  "mutant",
  "no-dashii",
  "oracle",
  "philosopher",
  "pit-hag",
  "sage",
  "savant",
  "seamstress",
  "snake-charmer",
  "sweetheart",
  "town-crier",
  "vigormortis",
  "vortox",
  "witch",
].sort();

let mutantSeedCertificate = "";

function fixedRng(seed = 20260720) {
  return withSeededRandom(seed);
}

function human(state) {
  const player = state.players.find((entry) => entry.isHuman);
  assert.ok(player, "fixture should contain a human player");
  return player;
}

function applyRole(state, player, roleId, { preserveTeam = false } = {}) {
  const role = getRoleById(state.scriptId, roleId);
  assert.ok(role, `role ${roleId} should exist`);
  const priorTeam = player.team;
  player.roleId = role.id;
  player.roleName = role.name;
  player.roleIcon = role.icon ?? null;
  player.category = role.category;
  player.team = preserveTeam ? priorTeam : role.team;
  player.tags = [...(role.tags ?? [])];
  player.apparentRoleId = role.id;
  player.apparentRoleName = role.name;
  player.apparentRoleIcon = role.icon ?? null;
  player.apparentCategory = role.category;
  player.apparentTeam = player.team;
}

function finishDay(state, rng) {
  assert.equal(advanceDayStage(state, "public").ok, true);
  markPublicDiscussionRound(state);
  assert.equal(advanceDayStage(state, "nomination").ok, true);
  assert.equal(skipDay(state, rng), true);
}

function projectReplay(state) {
  return {
    players: state.players.map((player) => ({
      id: player.id,
      roleId: player.roleId,
      team: player.team,
      alive: player.alive,
      poisoned: !!player.poisoned,
      publicClaimRoleId: player.publicClaimRoleId ?? null,
    })),
    mutantLedger: { ...(state.snv?.mutantClaimViolationByDay ?? {}) },
    executions: (state.events?.executions ?? []).map(({ day, nomineeId, reason, died }) => ({ day, nomineeId, reason, died })),
    ruleLogs: (state.logs ?? [])
      .filter((entry) => ["day-skill", "night-effect", "death-trigger"].includes(entry.type))
      .map(({ type, message, payload }) => ({ type, message, payload })),
    winner: state.winner ?? null,
  };
}

function withoutEnvelopeFields(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return entry;
  }
  const { id, timestamp, createdAt, resolvedAt, ...semantic } = entry;
  return semantic;
}

function projectPriorityReplay(state) {
  return {
    players: state.players.map((player) => ({
      id: player.id,
      roleId: player.roleId,
      effectiveRoleId: getEffectiveRoleId(player),
      category: player.category,
      team: player.team,
      alive: player.alive,
      poisoned: !!player.poisoned,
      poisonedTomorrowDay: !!player.poisonedTomorrowDay,
      publicClaimRoleId: player.publicClaimRoleId ?? null,
    })),
    snv: structuredClone(state.snv ?? null),
    events: {
      nightDeaths: structuredClone(state.events?.nightDeaths ?? []),
      dayDeaths: structuredClone(state.events?.dayDeaths ?? []),
      executions: structuredClone(state.events?.executions ?? []),
      infoPings: structuredClone(
        (state.events?.infoPings ?? []).filter((entry) => ["dreamer", "sage"].includes(entry.type))
      ),
      claims: structuredClone(state.events?.claims ?? []),
    },
    pendingStorytellerActions: (state.pendingStorytellerActions ?? []).map((entry) =>
      structuredClone(withoutEnvelopeFields(entry))
    ),
    logs: (state.logs ?? [])
      .filter((entry) => ["day-skill", "night-effect", "death-trigger", "execution"].includes(entry.type))
      .map((entry) => structuredClone(withoutEnvelopeFields(entry))),
    winner: state.winner ?? null,
  };
}

function runSameSeedScenario(label, seed, scenario) {
  const first = scenario(seed);
  const second = scenario(seed);
  assert.deepEqual(
    projectPriorityReplay(first),
    projectPriorityReplay(second),
    `${label} must reproduce semantic state, events, actions, logs, and winner with the same seed`
  );
  return first;
}

function mutantReplay(seed) {
  const rng = fixedRng(seed);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "mutant" }, rng);
  beginNightPhase(state);
  runNight(state, rng);
  const player = human(state);
  assert.equal(registerClaim(state, player.id, "barber"), true);
  assert.equal(player.alive, true, "claim registration should only record madness evidence");
  finishDay(state, rng);
  return state;
}

function testRoleInventoryAndExecutableObligations() {
  const actual = Object.keys(SNV_ROLE_DEFINITIONS).sort();
  assert.deepEqual(actual, EXPECTED_ROLES, "SnV fidelity inventory must contain exactly 25 roles");

  const obligationResults = actual.map((roleId) => {
    const definition = SNV_ROLE_DEFINITIONS[roleId];
    assert.equal(definition.id, roleId, `${roleId} definition should preserve its role id`);
    const observableWindows = Object.entries(definition.phaseHooks ?? {}).filter(([, owner]) => typeof owner === "string" && owner.length > 0);
    assert.ok(observableWindows.length >= 1, `${roleId} should expose at least one observable lifecycle hook`);
    return { roleId, windows: observableWindows.map(([window]) => window) };
  });
  assert.equal(obligationResults.length, 25);
}

function testActionDomainsMatchOfficialCharacterClasses() {
  assert.equal(SNV_ROLE_ACTION_RULES.seamstress.allowDead, true, "Seamstress may choose dead players");
  assert.deepEqual(
    SNV_ROLE_ACTION_RULES.philosopher.roleCategories,
    ["townsfolk", "outsider"],
    "Philosopher may choose any good character"
  );
  assert.equal(SNV_ROLE_ACTION_RULES.cerenovus.allowDead, true, "Cerenovus may choose dead players");
  assert.deepEqual(
    SNV_ROLE_ACTION_RULES.cerenovus.roleCategories,
    ["townsfolk", "outsider"],
    "Cerenovus madness role must be good"
  );
  assert.equal(SNV_ROLE_ACTION_RULES["pit-hag"].allowSelf, true, "Pit-Hag may choose itself");
  assert.equal(SNV_ROLE_ACTION_RULES["pit-hag"].allowDead, true, "Pit-Hag may choose dead players");
}

function testModuleHasNoAmbientRandomness() {
  assert.equal(/\bMath\.random\b/.test(canonicalSource), false, "snv.js must consume only the supplied RNG");
}

function testMutantSameSeedReplayAndSingleAdjudication() {
  const firstState = runSameSeedScenario("Mutant", 70201, mutantReplay);
  const first = projectReplay(firstState);
  mutantSeedCertificate = crypto.createHash("sha256").update(JSON.stringify(first)).digest("hex");
  assert.ok(
    first.executions.filter((entry) => entry.reason === "mutant-claim-break").length <= 1,
    "one Mutant violation must be adjudicated at most once"
  );
}

function testMutantPriorDayClaimIsNotReadjudicated() {
  const rng = fixedRng(70210);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "mutant" }, rng);
  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon);
  applyRole(state, demon, "fang-gu");
  beginNightPhase(state);
  runNight(state, rng);
  const mutant = human(state);
  assert.equal(registerClaim(state, mutant.id, "barber"), true);
  finishDay(state, () => 0.99);
  assert.equal(state.snv.mutantClaimViolationByDay[1][mutant.id].adjudicated, true);
  assert.equal(mutant.alive, true, "the first-day discretionary roll is forced to spare the Mutant");

  beginNightPhase(state);
  runNight(state, rng);
  const executionsBefore = state.events.executions.filter((entry) => entry.reason === "mutant-claim-break").length;
  finishDay(state, () => 0);
  const executionsAfter = state.events.executions.filter((entry) => entry.reason === "mutant-claim-break").length;
  assert.equal(executionsAfter, executionsBefore, "a prior-day public claim must not create fresh madness evidence");
  assert.equal(state.snv.mutantClaimViolationByDay[2]?.[mutant.id], undefined);
}

function testCerenovusOffersOnlyGoodCharacters() {
  runSameSeedScenario("Cerenovus", 70202, (seed) => {
    const rng = fixedRng(seed);
    const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "cerenovus" }, rng);
    beginNightPhase(state);
    const action = getHumanNightActionState(state);
    assert.equal(action.inputType, "player-role");
    assert.ok(action.roleOptions.length > 0);
    assert.equal(action.options.some((option) => option.id === human(state).id), true, "Cerenovus may choose itself");
    action.roleOptions.forEach((option) => {
      const role = getRoleById("snv", option.id);
      assert.equal(role?.team, "good", `Cerenovus role option ${option.id} must be good`);
    });

    const target = state.players.find((entry) => !entry.isHuman && entry.alive);
    assert.ok(target);
    assert.equal(setHumanNightActionPlan(state, { targetIds: [target.id], roleId: "artist" }).ok, true);
    runNight(state, rng);
    assert.equal(registerClaim(state, target.id, "clockmaker"), true);
    finishDay(state, rng);
    assert.equal(target.alive, false, "an explicit final claim mismatch is the deterministic Cerenovus product boundary");
    assert.equal(state.events.executions.some((entry) => entry.reason === "cerenovus-break"), true);
    return state;
  });
}

function testCerenovusDeadTargetFrozenEngineBoundary() {
  const rng = fixedRng(70211);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "cerenovus" }, rng);
  const demon = state.players.find((entry) => entry.category === "demon");
  const deadTarget = state.players.find((entry) => !entry.isHuman && entry.id !== demon?.id);
  assert.ok(demon && deadTarget);
  applyRole(state, demon, "fang-gu");
  deadTarget.alive = false;
  beginNightPhase(state);
  const action = getHumanNightActionState(state);
  assert.equal(action.options.some((option) => option.id === deadTarget.id && option.alive === false), true);
  assert.equal(setHumanNightActionPlan(state, { targetIds: [deadTarget.id], roleId: "artist" }).ok, true);
  runNight(state, rng);
  assert.equal(registerClaim(state, deadTarget.id, "clockmaker"), true);
  finishDay(state, rng);
  assert.equal(deadTarget.alive, false, "the frozen engine does not execute an already-dead Cerenovus target again");
  assert.equal(
    state.events.executions.some((entry) => entry.nomineeId === deadTarget.id && entry.reason === "cerenovus-break"),
    false,
    "dead-target madness enforcement remains a documented frozen engine gap"
  );
}

function testSnakeCharmerSwapAndAlignmentTransition() {
  runSameSeedScenario("Snake Charmer", 70206, (seed) => {
    const rng = fixedRng(seed);
    const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "snake-charmer" }, rng);
    const demon = state.players.find((entry) => entry.category === "demon");
    assert.ok(demon);
    const oldDemonTeam = demon.team;
    beginNightPhase(state);
    assert.equal(setHumanNightActionPlan(state, { targetIds: [demon.id] }).ok, true);
    runNight(state, rng);
    assert.equal(human(state).category, "demon");
    assert.equal(human(state).team, oldDemonTeam);
    assert.equal(demon.roleId, "snake-charmer");
    assert.equal(demon.team, "good");
    assert.equal(demon.poisoned, true);
    assert.equal(state.snv.snakeCharmerPoisonedIds.includes(demon.id), true);
    return state;
  });
}

function testFangGuJumpChangesRoleAlignmentAndDeathState() {
  runSameSeedScenario("Fang Gu", 70207, (seed) => {
    const rng = fixedRng(seed);
    const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "fang-gu" }, rng);
    runNight(state, rng);
    beginNightPhase(state);
    const outsider = state.players.find((entry) => !entry.isHuman && entry.alive && entry.category === "outsider");
    assert.ok(outsider, "Fang Gu setup should expose an Outsider jump target");
    assert.equal(setHumanNightActionPlan(state, { targetIds: [outsider.id] }).ok, true);
    runNight(state, rng);
    assert.equal(state.snv.fangGuJumpUsed, true);
    assert.equal(outsider.roleId, "fang-gu");
    assert.equal(outsider.team, "evil");
    assert.equal(outsider.alive, true);
    assert.equal(human(state).alive, false);
    assert.equal(state.events.nightDeaths.some((entry) => entry.reason === "fang-gu-jump"), true);
    return state;
  });
}

function testBarberQueueAllowsDeadAndActingDemonTargets() {
  runSameSeedScenario("Barber", 70208, (seed) => {
    const rng = fixedRng(seed);
    const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "vortox" }, rng);
    runNight(state, rng);
    const barber = state.players.find((entry) => !entry.isHuman && entry.alive && entry.team === "good");
    assert.ok(barber);
    applyRole(state, barber, "barber");
    processDayDeath(state, barber, "contract-barber-death", {}, rng);
    const action = getPendingStorytellerActionState(state);
    assert.equal(action.type, "barber-swap");
    assert.equal(action.options.some((entry) => entry.id === barber.id && entry.alive === false), true);
    assert.equal(action.options.some((entry) => entry.id === human(state).id), true);
    assert.equal(
      action.options.some((entry) => entry.category === "demon" && entry.id !== human(state).id),
      false,
      "Barber must not offer another Demon"
    );
    return state;
  });
}

function testVortoxDreamerDatumIsSemanticallyFalse() {
  runSameSeedScenario("Vortox", 70209, (seed) => {
    const rng = fixedRng(seed);
    const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "dreamer" }, rng);
    const demon = state.players.find((entry) => entry.category === "demon");
    const target = state.players.find((entry) => !entry.isHuman && entry.id !== demon?.id && entry.alive);
    assert.ok(demon && target);
    applyRole(state, demon, "vortox");
    applyRole(state, target, "witch");
    state.players
      .filter((entry) => !entry.isHuman && ["pit-hag", "snake-charmer", "philosopher"].includes(entry.roleId))
      .forEach((entry) => {
        entry.poisoned = true;
      });
    beginNightPhase(state);
    assert.equal(setHumanNightActionPlan(state, { targetIds: [target.id] }).ok, true);
    runNight(state, rng);
    const ping = state.events.infoPings.find((entry) => entry.actorId === human(state).id && entry.type === "dreamer");
    assert.ok(ping);
    assert.equal(ping.polluted, true);
    assert.equal(`${ping.reported}`.includes(target.roleName), false, "active Vortox must exclude the true Dreamer character");
    return state;
  });
}

function testVortoxSageCandidatesAreBothNonDemons() {
  const rng = fixedRng(70212);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "sage" }, rng);
  const demon = state.players.find((entry) => entry.category === "demon");
  assert.ok(demon);
  applyRole(state, demon, "vortox");
  beginNightPhase(state);
  assert.equal(processNightDeath(state, human(state), "demon-kill", { by: demon.id }, rng), true);
  const action = getPendingStorytellerActionState(state);
  const targetIds = state.pendingStorytellerActions[0]?.targetIds ?? [];
  assert.equal(action.type, "sage-info");
  assert.equal(targetIds.length, 2);
  targetIds.forEach((playerId) => {
    assert.notEqual(state.players.find((entry) => entry.id === playerId)?.category, "demon");
  });
}

function testPhilosopherCanCopyOutsiderAndMaintainCarrierDrunkenness() {
  runSameSeedScenario("Philosopher", 70203, (seed) => {
    const rng = fixedRng(seed);
    const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "philosopher" }, rng);
    const demon = state.players.find((entry) => entry.category === "demon");
    const carrier = state.players.find((entry) => !entry.isHuman && entry.category !== "demon");
    assert.ok(demon && carrier);
    applyRole(state, demon, "fang-gu");
    applyRole(state, carrier, "dreamer");
    beginNightPhase(state);
    const planned = setHumanNightActionPlan(state, { roleId: "dreamer" });
    assert.equal(planned.ok, true, planned.reason);
    runNight(state, rng);
    assert.equal(getEffectiveRoleId(human(state)), "dreamer");
    assert.equal(carrier.poisoned, true, "the original copied-role carrier should be drunk");
    finishDay(state, rng);
    beginNightPhase(state);
    runNight(state, rng);
    assert.equal(carrier.poisoned, true, "carrier drunkenness should be reapplied before the next relevant night action");
    const carrierPing = state.events.infoPings.find(
      (entry) => entry.night === 2 && entry.actorId === carrier.id && entry.type === "dreamer"
    );
    assert.ok(carrierPing, "the original Dreamer carrier should still reach its next night information seam");
    assert.equal(carrierPing.polluted, true, "the original Dreamer carrier must act drunk on that next seam");
    return state;
  });
}

function testPitHagFrozenHumanCompatibilityIsDeterministic() {
  runSameSeedScenario("Pit-Hag", 70204, (seed) => {
    const rng = fixedRng(seed);
    const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "pit-hag" }, rng);
    runNight(state, rng);
    beginNightPhase(state);
    const target = state.players.find((entry) => !entry.isHuman && entry.category !== "demon");
    const inPlayRole = state.players.find((entry) => entry.id !== target?.id && entry.roleId !== target?.roleId)?.roleId;
    assert.ok(target && inPlayRole);
    const planned = setHumanNightActionPlan(state, { targetIds: [target.id], roleId: inPlayRole });
    assert.equal(planned.ok, true, planned.reason);
    runNight(state, rng);
    assert.equal(target.roleId, inPlayRole, "the frozen human action contract must honor its accepted role plan");
    assert.equal(state.snv.pitHagTransformHistory.at(-1)?.playerId, target.id);
    return state;
  });
}

function testPitHagSuccessfulMultiDemonTransformQueuesBalance() {
  const rng = fixedRng(70213);
  const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "pit-hag" }, rng);
  runNight(state, rng);
  beginNightPhase(state);
  const target = state.players.find((entry) => !entry.isHuman && entry.category !== "demon");
  const inPlay = new Set(state.players.map((entry) => entry.roleId));
  const demonRole = ["fang-gu", "no-dashii", "vigormortis", "vortox"].find((roleId) => !inPlay.has(roleId));
  assert.ok(target && demonRole);
  assert.equal(setHumanNightActionPlan(state, { targetIds: [target.id], roleId: demonRole }).ok, true);
  runNight(state, rng);
  assert.equal(target.roleId, demonRole);
  const action = getPendingStorytellerActionState(state);
  const queuedAction = state.pendingStorytellerActions[0];
  assert.equal(action.type, "pit-hag-demon-balance");
  assert.equal(queuedAction.balanceMode, "extra-demons");
  assert.equal(action.options.filter((entry) => entry.category === "demon").length, 2);
}

function testLivingSameAlignmentEvilTwinPairRepairsSeededly() {
  runSameSeedScenario("Evil Twin", 70205, (seed) => {
    const rng = fixedRng(seed);
    const state = createNewGame({ scriptId: "snv", playerCount: 9, preferredHumanRoleId: "pit-hag" }, rng);
    runNight(state, rng);
    beginNightPhase(state);
    const firstTarget = state.players.find((entry) => !entry.isHuman && entry.alive && entry.team === "good" && entry.category !== "demon");
    assert.ok(firstTarget);
    assert.equal(setHumanNightActionPlan(state, { targetIds: [firstTarget.id], roleId: "evil-twin" }).ok, true);
    runNight(state, rng);
    const firstPair = { ...state.snv.evilTwinPair };
    const firstOpposite = state.players.find((entry) => entry.id === firstPair.opposingTwinId);
    assert.ok(firstOpposite?.alive);
    firstOpposite.team = firstTarget.team;

    beginNightPhase(state);
    const secondTarget = state.players.find(
      (entry) => !entry.isHuman && entry.alive && entry.id !== firstTarget.id && entry.category !== "demon"
    );
    assert.ok(secondTarget);
    const inPlay = new Set(state.players.map((entry) => getEffectiveRoleId(entry)));
    const replacementRole = getHumanNightActionState(state).roleOptions.find((entry) => !inPlay.has(entry.id));
    assert.ok(replacementRole);
    assert.equal(setHumanNightActionPlan(state, { targetIds: [secondTarget.id], roleId: replacementRole.id }).ok, true);
    runNight(state, rng);

    const repaired = state.snv.evilTwinPair;
    assert.equal(repaired.evilTwinId, firstTarget.id);
    const repairedOpposite = state.players.find((entry) => entry.id === repaired.opposingTwinId);
    assert.notEqual(repairedOpposite.id, firstOpposite.id, "living same-alignment twin should be replaced");
    assert.notEqual(repairedOpposite.team, firstTarget.team, "repaired twins must have opposing alignments");
    return state;
  });
}

function testUnityMirrorParity() {
  assert.equal(fs.readFileSync(unityMirrorPath, "utf8"), canonicalSource, "Unity SnV mirror must match canonical source");
}

testRoleInventoryAndExecutableObligations();
testActionDomainsMatchOfficialCharacterClasses();
testModuleHasNoAmbientRandomness();
testMutantSameSeedReplayAndSingleAdjudication();
testMutantPriorDayClaimIsNotReadjudicated();
testCerenovusOffersOnlyGoodCharacters();
testCerenovusDeadTargetFrozenEngineBoundary();
testSnakeCharmerSwapAndAlignmentTransition();
testFangGuJumpChangesRoleAlignmentAndDeathState();
testBarberQueueAllowsDeadAndActingDemonTargets();
testVortoxDreamerDatumIsSemanticallyFalse();
testVortoxSageCandidatesAreBothNonDemons();
testPhilosopherCanCopyOutsiderAndMaintainCarrierDrunkenness();
testPitHagFrozenHumanCompatibilityIsDeterministic();
testPitHagSuccessfulMultiDemonTransformQueuesBalance();
testLivingSameAlignmentEvilTwinPairRepairsSeededly();
testUnityMirrorParity();

console.log(`snv rule fidelity contracts passed (seed 70201: ${mutantSeedCertificate})`);
