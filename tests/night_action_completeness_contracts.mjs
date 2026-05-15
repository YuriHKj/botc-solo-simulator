import assert from "node:assert/strict";

import { beginNightPhase, createNewGame, getHumanNightActionState, getPerceivedRoleId, runNight, setHumanNightActionPlan, withSeededRandom } from "../scripts/engine.js";
import { getScriptRoleActionRules } from "../scripts/roles/index.js";
import { buildUnityViewModel } from "../scripts/unity_viewmodel.js";

const SCRIPT_IDS = ["tb", "bmr", "snv"];
const PLAYER_COUNT = 9;

function rng(seed = 20260509) {
  return withSeededRandom(seed);
}

function makeState(scriptId, roleId, seedOffset = 0) {
  return createNewGame({ scriptId, playerCount: PLAYER_COUNT, preferredHumanRoleId: roleId }, rng(20260509 + seedOffset));
}

function needsSecondNight(rule, roleId) {
  return rule.firstNight === false || (rule.minNight ?? 1) > 1 || roleId === "godfather";
}

function firstOther(state, predicate = () => true) {
  return state.players.find((player) => !player.isHuman && predicate(player)) ?? null;
}

function prepareStateForAction(scriptId, roleId, rule, seedOffset = 0) {
  const state = makeState(scriptId, roleId, seedOffset);
  beginNightPhase(state);
  const firstWindowAction = getHumanNightActionState(state);
  if (needsSecondNight(rule, roleId) || (!firstWindowAction.available && state.night === 1)) {
    runNight(state, rng(20260509 + seedOffset));
    if (scriptId === "bmr" && roleId === "godfather") {
      state.bmr.lastDayOutsiderExecuted = true;
    }
    beginNightPhase(state);
  }

  if (scriptId === "bmr" && roleId === "godfather") {
    state.bmr.lastDayOutsiderExecuted = true;
  }
  if (scriptId === "bmr" && roleId === "professor") {
    const target = firstOther(state, (player) => player.category === "townsfolk") ?? firstOther(state);
    assert.ok(target, "Professor fixture needs a possible dead target");
    target.alive = false;
  }
  return state;
}

function needsTargets(action) {
  return ["player-target", "player-role", "charge-or-targets"].includes(action.inputType);
}

function needsRole(action) {
  return ["role", "player-role"].includes(action.inputType);
}

function planForAction(action, overrides = {}) {
  const minTargets = action.minTargetCount ?? action.targetCount ?? 0;
  const maxTargets = action.maxTargetCount ?? action.targetCount ?? minTargets;
  const targetIds = (action.options ?? []).slice(0, Math.max(0, Math.min(maxTargets, Math.max(1, minTargets)))).map((entry) => entry.id);
  const roleId = action.roleOptions?.find((entry) => entry.id)?.id ?? "";

  if (action.inputType === "role") return { roleId, ...overrides };
  if (action.inputType === "player-role") return { targetIds, roleId, ...overrides };
  if (action.inputType === "question") return { question: "场上是否有恶魔？", ...overrides };
  if (action.inputType === "charge-or-targets") {
    const mode = overrides.mode ?? action.modes?.find((entry) => entry.id === "kill")?.id ?? action.modes?.[0]?.id ?? "kill";
    return mode === "charge" || mode === "none" ? { mode } : { mode, targetIds, ...overrides };
  }
  return { targetIds, ...overrides };
}

function assertActionDescriptorComplete(scriptId, roleId, action) {
  assert.equal(action.available, true, `${scriptId}/${roleId} should expose an available night action`);
  assert.equal(action.roleId, roleId, `${scriptId}/${roleId} should preserve the action role id`);
  assert.ok(action.roleName, `${scriptId}/${roleId} should expose a role name`);
  assert.ok(action.inputType, `${scriptId}/${roleId} should expose an inputType`);
  assert.ok(action.prompt, `${scriptId}/${roleId} should expose a prompt`);
  assert.ok(action.interaction, `${scriptId}/${roleId} should expose rich interaction metadata`);
  assert.ok(action.interaction.title, `${scriptId}/${roleId} should expose an interaction title`);
  assert.ok(action.interaction.confirmText, `${scriptId}/${roleId} should expose confirm text`);
  assert.ok(action.interaction.skipText, `${scriptId}/${roleId} should expose skip text`);

  if (needsTargets(action)) {
    assert.ok((action.options ?? []).length >= (action.minTargetCount ?? action.targetCount ?? 1), `${scriptId}/${roleId} should expose enough player options`);
  }
  if (needsRole(action)) {
    assert.ok((action.roleOptions ?? []).length > 0, `${scriptId}/${roleId} should expose role options`);
  }
}

function assertUnityViewModelCarriesFullNightAction(scriptId, roleId, state, action) {
  const vm = buildUnityViewModel(state);
  assert.equal(vm.humanNightAction.available, true, `${scriptId}/${roleId} viewmodel should expose the human night action`);
  assert.equal(vm.humanNightAction.roleId, action.roleId);
  assert.equal(vm.humanNightAction.inputType, action.inputType);
  assert.equal(vm.humanNightAction.options.length, (action.options ?? []).length, `${scriptId}/${roleId} humanNightAction should not drop player options`);
  assert.equal(vm.humanNightAction.roleOptions.length, (action.roleOptions ?? []).length, `${scriptId}/${roleId} humanNightAction should not drop role options`);

  const form = vm.actionForms.find((entry) => entry.id === "night-action");
  assert.ok(form, `${scriptId}/${roleId} should export a night action form`);
  assert.equal(form.available, true, `${scriptId}/${roleId} night action form should be available`);
  assert.equal(form.options.length, (action.options ?? []).length, `${scriptId}/${roleId} action form should not truncate player options`);
  assert.equal(form.roleOptions.length, (action.roleOptions ?? []).length, `${scriptId}/${roleId} action form should not truncate role options`);
  assert.deepEqual(form.modes, action.modes ?? [], `${scriptId}/${roleId} action form should preserve mode choices`);
}

function testEveryScriptNightActionHasCompleteDescriptorAndUnityForm() {
  const checked = [];
  for (const scriptId of SCRIPT_IDS) {
    const rules = getScriptRoleActionRules(scriptId);
    for (const [roleId, rule] of Object.entries(rules)) {
      if (scriptId === "bmr" && roleId === "lunatic") {
        continue;
      }
      const state = prepareStateForAction(scriptId, roleId, rule, checked.length);
      const action = getHumanNightActionState(state);
      assertActionDescriptorComplete(scriptId, roleId, action);
      assertUnityViewModelCarriesFullNightAction(scriptId, roleId, state, action);

      const planned = setHumanNightActionPlan(state, planForAction(action));
      assert.equal(planned.ok, true, `${scriptId}/${roleId} should accept a complete legal plan: ${planned.reason ?? ""}`);
      assert.equal(state.humanNightPlan.roleId, roleId, `${scriptId}/${roleId} should persist the planned role id`);
      checked.push(`${scriptId}/${roleId}`);
    }
  }
  const expectedCount = SCRIPT_IDS.reduce((sum, scriptId) => sum + Object.keys(getScriptRoleActionRules(scriptId)).length, 0) - 1;
  assert.equal(checked.length, expectedCount, "expected to check every concrete non-Lunatic night action rule across TB/BMR/SnV");
}

function testLunaticNightActionUsesPerceivedDemonDescriptor() {
  const state = prepareStateForAction("bmr", "lunatic", getScriptRoleActionRules("bmr").lunatic);
  const human = state.players.find((player) => player.isHuman);
  assert.equal(human.roleId, "lunatic");
  const perceivedRoleId = getPerceivedRoleId(human);
  assert.notEqual(perceivedRoleId, "lunatic", "Lunatic should act through a perceived demon role");

  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.roleId, perceivedRoleId, "Lunatic action should expose the perceived demon role");
  assertActionDescriptorComplete("bmr", action.roleId, action);
  assertUnityViewModelCarriesFullNightAction("bmr", action.roleId, state, action);

  const planned = setHumanNightActionPlan(state, planForAction(action));
  assert.equal(planned.ok, true, planned.reason);
}

function testPoChargedNightActionKeepsAllModeAndTargetData() {
  const state = prepareStateForAction("bmr", "po", getScriptRoleActionRules("bmr").po, 901);
  state.bmr.poCharged = true;
  const action = getHumanNightActionState(state);
  assert.equal(action.available, true, action.reason);
  assert.equal(action.inputType, "charge-or-targets");
  assert.equal(action.maxTargetCount, 3);
  assert.ok((action.modes ?? []).some((entry) => entry.id === "kill"), "charged Po should expose kill mode");
  assertUnityViewModelCarriesFullNightAction("bmr", "po", state, action);

  const planned = setHumanNightActionPlan(state, planForAction(action, { mode: "kill" }));
  assert.equal(planned.ok, true, planned.reason);
  assert.ok(state.humanNightPlan.targetIds.length >= 1);
  assert.ok(state.humanNightPlan.targetIds.length <= 3);
}

testEveryScriptNightActionHasCompleteDescriptorAndUnityForm();
testLunaticNightActionUsesPerceivedDemonDescriptor();
testPoChargedNightActionKeepsAllModeAndTargetData();

console.log("night action completeness contracts ok");
