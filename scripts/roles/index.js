import { BMR_DAY_ACTION_RULES, BMR_ROLE_ACTION_RULES, BMR_ROLE_DEFINITIONS, BMR_RULE_HANDLERS, runBadMoonRisingNight } from "./bmr.js";
import { SNV_DAY_ACTION_RULES, SNV_ROLE_ACTION_RULES, SNV_ROLE_DEFINITIONS, SNV_RULE_HANDLERS, runSectsAndVioletsNight } from "./snv.js";
import { TB_DAY_ACTION_RULES, TB_ROLE_ACTION_RULES, TB_ROLE_DEFINITIONS, TB_RULE_HANDLERS, runTroubleBrewingNight } from "./tb.js";

export const ROLE_DEFINITIONS_BY_SCRIPT = {
  tb: TB_ROLE_DEFINITIONS,
  bmr: BMR_ROLE_DEFINITIONS,
  snv: SNV_ROLE_DEFINITIONS,
};

export const ROLE_ACTION_RULES_BY_SCRIPT = {
  tb: TB_ROLE_ACTION_RULES,
  bmr: BMR_ROLE_ACTION_RULES,
  snv: SNV_ROLE_ACTION_RULES,
};

export const ROLE_DAY_ACTION_RULES_BY_SCRIPT = {
  tb: TB_DAY_ACTION_RULES,
  bmr: BMR_DAY_ACTION_RULES,
  snv: SNV_DAY_ACTION_RULES,
};

export const NIGHT_RUNNERS_BY_SCRIPT = {
  tb: runTroubleBrewingNight,
  bmr: runBadMoonRisingNight,
  snv: runSectsAndVioletsNight,
};

export const ROLE_RULE_HANDLERS_BY_SCRIPT = {
  tb: TB_RULE_HANDLERS,
  bmr: BMR_RULE_HANDLERS,
  snv: SNV_RULE_HANDLERS,
};

export function getRoleDefinition(scriptId, roleId) {
  return ROLE_DEFINITIONS_BY_SCRIPT[scriptId]?.[roleId] ?? null;
}

export function getScriptRoleDefinitions(scriptId) {
  return ROLE_DEFINITIONS_BY_SCRIPT[scriptId] ?? {};
}

export function getRoleActionRule(scriptId, roleId) {
  return ROLE_ACTION_RULES_BY_SCRIPT[scriptId]?.[roleId] ?? null;
}

export function getScriptRoleActionRules(scriptId) {
  return ROLE_ACTION_RULES_BY_SCRIPT[scriptId] ?? {};
}

export function getRoleDayActionRule(scriptId, roleId) {
  return ROLE_DAY_ACTION_RULES_BY_SCRIPT[scriptId]?.[roleId] ?? null;
}

export function getScriptRoleDayActionRules(scriptId) {
  return ROLE_DAY_ACTION_RULES_BY_SCRIPT[scriptId] ?? {};
}

export function getNightRunner(scriptId) {
  return NIGHT_RUNNERS_BY_SCRIPT[scriptId] ?? null;
}

export function getScriptRuleHandlers(scriptId) {
  return ROLE_RULE_HANDLERS_BY_SCRIPT[scriptId] ?? {};
}
