import fs from "node:fs";
import path from "node:path";

import { getAIInsightRows, initializeAI } from "./ai.js";
import { createNewGame, runNight, withSeededRandom } from "./engine.js";
import { buildUnityViewModel, stringifyUnityViewModel } from "./unity_viewmodel.js";

function argValue(name, fallback = "") {
  const hit = process.argv.find((entry) => entry.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : fallback;
}

function readStateFromFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  return parsed?.state ?? parsed;
}

function makeDemoState() {
  const scriptId = argValue("--script", "tb");
  const playerCount = Number(argValue("--players", "9")) || 9;
  const preferredHumanRoleId = argValue("--role", "washerwoman");
  const rng = withSeededRandom(Number(argValue("--seed", "20260505")) || 20260505);
  const state = createNewGame({ scriptId, playerCount, preferredHumanRoleId }, rng);
  initializeAI(state);
  state.phase = "night";
  runNight(state, rng);
  initializeAI(state);
  enrichPrototypeDemoState(state);
  return state;
}

function enrichPrototypeDemoState(state) {
  const players = state.players ?? [];
  if (players.length < 3) return;
  state.phase = "day";
  state.dayStage = "private";
  state.aiDialogue = state.aiDialogue ?? {};
  state.aiDialogue.timeline = state.aiDialogue.timeline?.length
    ? state.aiDialogue.timeline
    : [
        {
          id: "unity-demo-public-1",
          mode: "public",
          speakerId: players[1].id,
          targetId: "",
          text: "我先不急着报死身份，但昨晚信息能给一个方向。",
          day: state.day ?? 1,
          night: state.night ?? 1,
        },
        {
          id: "unity-demo-whisper-1",
          mode: "whisper-in",
          speakerId: players[2].id,
          targetId: players.find((player) => player.isHuman)?.id ?? players[0].id,
          text: "我想私下确认一下，你昨晚的信息有没有指向 2 号附近？",
          day: state.day ?? 1,
          night: state.night ?? 1,
        },
      ];
  state.pendingStorytellerActions = state.pendingStorytellerActions?.length
    ? state.pendingStorytellerActions
    : [
        { prompt: "Storyteller：等待当前主动角色选择目标。" },
        { prompt: "Storyteller：确认夜间信息是否已经展示给主视角。" },
      ];
  state.grimoireNotes = state.grimoireNotes ?? {};
  state.grimoireNotes[players[1].id] = {
    ...(state.grimoireNotes[players[1].id] ?? {}),
    reminders: ["守护"],
  };
  state.grimoireNotes[players[2].id] = {
    ...(state.grimoireNotes[players[2].id] ?? {}),
    reminders: ["中毒"],
  };
}

const inputPath = argValue("--state", "");
const outputPath = path.resolve(
  argValue("--out", "unity-prototype/Assets/StreamingAssets/unity_viewmodel.json")
);

const state = inputPath ? readStateFromFile(path.resolve(inputPath)) : makeDemoState();
initializeAI(state);
const aiInsights = getAIInsightRows(state);
const viewModel = buildUnityViewModel(state, { aiInsights });

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, stringifyUnityViewModel(viewModel), "utf8");
console.log(`Wrote ${outputPath}`);
