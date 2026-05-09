using System;
using System.Collections.Generic;
using DiagnosticsProcess = System.Diagnostics.Process;
using DiagnosticsProcessStartInfo = System.Diagnostics.ProcessStartInfo;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed class BotcPrototypeBootstrap : MonoBehaviour
    {
        private const float TokenSize = 128f;
        private const float RoleIconSize = 78f;
        private const float BridgeTimeoutSeconds = 3f;
        private const float PendingViewModelPollSeconds = 0.35f;
        private const int ActionChoicePageSize = 8;
        private const int HandbookRolePageSize = 12;

        private Canvas canvas;
        private Font bodyFont;
        private Font titleFont;
        private Font asciiFont;
        private RectTransform grimoireRoot;
        private RectTransform bottomDock;
        private RectTransform bottomDockToggle;
        private RectTransform moreActionsPanel;
        private RectTransform tokenInspectorPanel;
        private RectTransform eventPanel;
        private RectTransform timelinePanel;
        private RectTransform mainMenuRoot;
        private RectTransform modalBackdrop;
        private RectTransform privateChatPanel;
        private RectTransform privateTargetCardRoot;
        private RectTransform privateDialogueRoot;
        private RectTransform privateTargetPickerRoot;
        private RectTransform privateClaimRoleGridRoot;
        private RectTransform actionFormPanel;
        private RectTransform actionOptionRoot;
        private RectTransform storytellerPanel;
        private RectTransform handbookPanel;
        private RectTransform handbookRoleListRoot;
        private RectTransform rolePickerPanel;
        private RectTransform rolePickerGridRoot;
        private RectTransform votePanel;
        private RectTransform voteAnimationRoot;
        private RectTransform voteAnimationRowsRoot;
        private RectTransform endgamePanel;
        private Text headerText;
        private Text vitalsText;
        private Text phaseText;
        private Text syncStatusText;
        private Text tickerText;
        private Image syncStatusPill;
        private Text dialogueTitle;
        private Text dialogueBody;
        private Text tokenInspectorTitle;
        private Text tokenInspectorBody;
        private Text objectiveTitleText;
        private Text objectiveHintText;
        private Text actionSummaryText;
        private Text eventBody;
        private Text queueBody;
        private Text timelineBody;
        private Text infoDrawerTitle;
        private Text privateTargetText;
        private Text privateClaimRoleText;
        private Text privateHistoryText;
        private Text privateStatusText;
        private Text rolePickerTitle;
        private Text rolePickerStatusText;
        private Text actionFormTitle;
        private Text actionFormBody;
        private Text actionFormStatusText;
        private Text storytellerTitle;
        private Text storytellerBody;
        private Text handbookTitle;
        private Text handbookDetailText;
        private Text handbookOrderText;
        private Text voteTitle;
        private Text voteBody;
        private Text endgameTitle;
        private Text endgameBody;
        private Text endgameEventsText;
        private Text eventTabText;
        private Text timelineTabText;
        private Text handbookTabText;
        private Text recapTabText;
        private Text townsfolkBadge;
        private Text outsiderBadge;
        private Text minionBadge;
        private Text demonBadge;
        private Text menuHint;
        private Image background;
        private AudioSource musicSource;
        private string currentMood = "";
        private Sprite circleFillSprite;
        private Sprite circleRingSprite;
        private PrototypeViewModel vm;
        private DiagnosticsProcess bridgeProcess;
        private string viewModelPath;
        private string actionPath;
        private string statePath;
        private string resultPath;
        private string bridgeLaunchStatus = "";
        private DateTime viewModelLastWriteUtc;
        private bool bridgeProcessStartedByUnity;
        private bool bridgeLaunchProblem;
        private string selectedPlayerId = "";
        private readonly List<string> privateClaimRoleIds = new List<string>();
        private int privateClaimRoleIndex;
        private InputField privateNightInput;
        private Toggle privateSecretToggle;
        private string activeActionFormId = "";
        private readonly List<string> selectedActionTargetIds = new List<string>();
        private string selectedActionRoleId = "";
        private string selectedActionModeId = "";
        private int actionTargetPage;
        private int actionRolePage;
        private InputField actionQuestionInput;
        private string activeHandbookCategory = "all";
        private int activeHandbookRoleIndex;
        private int activeHandbookRolePage;
        private string activeRolePickerMode = "";
        private string activeRolePickerPlayerId = "";
        private string privateChatStatus = "";
        private string pendingActionId = "";
        private string pendingActionType = "";
        private string pendingActionPlayerId = "";
        private float pendingActionStartedAt = -1f;
        private float nextPendingViewModelPollAt = -1f;
        private string pendingPhaseConfirmStage = "";
        private float pendingPhaseConfirmUntil = -1f;
        private string voteAnimationKey = "";
        private float voteAnimationStartTime;
        private int voteAnimationStep = -1;
        private bool bottomDockOpen;
        private bool moreActionsOpen;
        private bool tokenInspectorOpen;
        private bool eventPanelOpen;
        private bool timelinePanelOpen;
        private string infoDrawerTab = "events";
        private bool endgameDismissed;
        private string dismissedEndgameGameId = "";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void AutoCreate()
        {
            if (FindObjectOfType<BotcPrototypeBootstrap>() != null) return;
            var host = new GameObject("BOTC Unity Prototype Bootstrap");
            DontDestroyOnLoad(host);
            host.AddComponent<BotcPrototypeBootstrap>();
        }

        private void Start()
        {
            ConfigureBridgePaths();
            StartUnityBridgeIfAvailable();
            vm = LoadViewModel();
            RememberViewModelTimestamp();
            BuildScene();
            RenderAll();
            SetMood(MoodFromState());
        }

        private void Update()
        {
            UpdateBridgeProcessStatus();
            PollViewModelChanges();
            UpdateVoteAnimationFrame();
            UpdateSyncStatusText();
            if (privateChatPanel != null && privateChatPanel.gameObject.activeSelf && IsPendingPrivateChat()) UpdatePrivateChatPanelText();
            ApplyModalBackdropVisibility();
            if (Input.GetKeyDown(KeyCode.Tab)) ToggleBottomDock();
            if (Input.GetKeyDown(KeyCode.E)) ToggleEventPanel();
            if (Input.GetKeyDown(KeyCode.T)) ToggleTimelinePanel();
            if (Input.GetKeyDown(KeyCode.LeftArrow)) CyclePhase("prev");
            if (Input.GetKeyDown(KeyCode.RightArrow)) CyclePhase("next");
            if (Input.GetKeyDown(KeyCode.Escape)) HandleEscape();
        }

        private void OnApplicationQuit()
        {
            StopUnityBridgeProcess();
        }

        private void OnDestroy()
        {
            StopUnityBridgeProcess();
        }

        private void ConfigureBridgePaths()
        {
            statePath = Path.Combine(Application.streamingAssetsPath, "unity_state.json");
            viewModelPath = Path.Combine(Application.streamingAssetsPath, "unity_viewmodel.json");
            actionPath = Path.Combine(Application.streamingAssetsPath, "unity_action.json");
            resultPath = Path.Combine(Application.streamingAssetsPath, "unity_action_result.json");
        }

        private void StartUnityBridgeIfAvailable()
        {
            if (Application.isEditor)
            {
                bridgeLaunchStatus = "同步：Editor 手动 bridge";
                bridgeLaunchProblem = false;
                return;
            }

            var bridgeScript = FindUnityBridgeScript();
            if (string.IsNullOrWhiteSpace(bridgeScript))
            {
                bridgeLaunchStatus = "同步：未找到 bridge";
                bridgeLaunchProblem = true;
                Debug.LogWarning("Unity action bridge script was not found in StreamingAssets.");
                return;
            }

            try
            {
                var nodeExecutable = FindNodeExecutable();
                var args = string.Join(
                    " ",
                    new[]
                    {
                        QuoteProcessArgument(bridgeScript),
                        "--watch",
                        "--state=" + QuoteProcessArgument(statePath),
                        "--viewmodel=" + QuoteProcessArgument(viewModelPath),
                        "--action=" + QuoteProcessArgument(actionPath),
                        "--result=" + QuoteProcessArgument(resultPath)
                    }
                );
                bridgeProcess = new DiagnosticsProcess
                {
                    StartInfo = new DiagnosticsProcessStartInfo
                    {
                        FileName = nodeExecutable,
                        Arguments = args,
                        WorkingDirectory = BridgeWorkingDirectory(bridgeScript),
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden
                    },
                    EnableRaisingEvents = false
                };
                bridgeProcess.Start();
                bridgeProcessStartedByUnity = true;
                bridgeLaunchProblem = false;
                bridgeLaunchStatus = IsBundledNodeRuntime(nodeExecutable) ? "同步：内置 bridge 已启动" : "同步：bridge 已启动";
                Debug.Log($"Unity action bridge started from {bridgeScript} with {nodeExecutable}");
            }
            catch (Exception ex)
            {
                bridgeLaunchStatus = "同步：bridge 启动失败";
                bridgeLaunchProblem = true;
                Debug.LogWarning($"Failed to start Unity action bridge. Ensure Node.js is available in PATH. {ex.Message}");
                bridgeProcessStartedByUnity = false;
                bridgeProcess?.Dispose();
                bridgeProcess = null;
            }
        }

        private string FindUnityBridgeScript()
        {
            var streamingScript = Path.Combine(Application.streamingAssetsPath, "BotcJsCore", "scripts", "unity_action_bridge.mjs");
            if (File.Exists(streamingScript)) return streamingScript;

            var repoScript = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "scripts", "unity_action_bridge.mjs"));
            if (File.Exists(repoScript)) return repoScript;

            return "";
        }

        private string FindNodeExecutable()
        {
            var bundledNode = Path.Combine(Application.streamingAssetsPath, "BotcJsRuntime", "node.exe");
            return File.Exists(bundledNode) ? bundledNode : "node";
        }

        private bool IsBundledNodeRuntime(string nodeExecutable)
        {
            if (string.IsNullOrWhiteSpace(nodeExecutable)) return false;
            var bundledRoot = Path.Combine(Application.streamingAssetsPath, "BotcJsRuntime");
            return nodeExecutable.StartsWith(bundledRoot, StringComparison.OrdinalIgnoreCase);
        }

        private string BridgeWorkingDirectory(string bridgeScript)
        {
            var scriptsDir = Path.GetDirectoryName(bridgeScript);
            var rootDir = string.IsNullOrWhiteSpace(scriptsDir) ? "" : Path.GetDirectoryName(scriptsDir);
            return !string.IsNullOrWhiteSpace(rootDir) && Directory.Exists(rootDir)
                ? rootDir
                : Application.streamingAssetsPath;
        }

        private void UpdateBridgeProcessStatus()
        {
            if (!bridgeProcessStartedByUnity || bridgeProcess == null) return;

            try
            {
                if (!bridgeProcess.HasExited) return;
                bridgeLaunchStatus = $"同步：bridge 已退出 {bridgeProcess.ExitCode}";
                bridgeLaunchProblem = true;
                bridgeProcess.Dispose();
                bridgeProcess = null;
                bridgeProcessStartedByUnity = false;
            }
            catch (Exception ex)
            {
                bridgeLaunchStatus = "同步：bridge 状态未知";
                Debug.LogWarning($"Failed to inspect Unity action bridge process: {ex.Message}");
            }
        }

        private void StopUnityBridgeProcess()
        {
            if (!bridgeProcessStartedByUnity || bridgeProcess == null) return;

            try
            {
                if (!bridgeProcess.HasExited)
                {
                    bridgeProcess.Kill();
                    bridgeProcess.WaitForExit(600);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to stop Unity action bridge process: {ex.Message}");
            }
            finally
            {
                bridgeProcess.Dispose();
                bridgeProcess = null;
                bridgeProcessStartedByUnity = false;
            }
        }

        private static string QuoteProcessArgument(string value)
        {
            return "\"" + (value ?? "").Replace("\"", "\\\"") + "\"";
        }

        private void BuildScene()
        {
            EnsureEventSystem();
            BuildCanvas();
            BuildTopHud();
            BuildGrimoire();
            BuildSideControls();
            BuildBottomDock();
            BuildMoreActionsPanel();
            BuildTokenInspectorPanel();
            BuildModalBackdrop();
            BuildPrivateChatPanel();
            BuildActionFormPanel();
            BuildStorytellerPanel();
            BuildHandbookPanel();
            BuildVotePanel();
            BuildEndgamePanel();
            BuildRolePickerPanel();
            BuildEventPanel();
            BuildTimelinePanel();
            BuildMainMenu();
            musicSource = gameObject.AddComponent<AudioSource>();
            musicSource.loop = true;
            musicSource.volume = 0.34f;
        }

        private void EnsureEventSystem()
        {
            if (FindObjectOfType<UnityEngine.EventSystems.EventSystem>() != null) return;
            new GameObject("EventSystem", typeof(UnityEngine.EventSystems.EventSystem), typeof(UnityEngine.EventSystems.StandaloneInputModule));
        }

        private void BuildCanvas()
        {
            var canvasGo = new GameObject("Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;

            background = AddImage("Background", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, Color.white);
            AddImage("Dark Vignette", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.28f));
            AddImage("Top Shadow", canvas.transform, new Vector2(0f, 0.86f), Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.30f));
            AddCircleImage("Warm Center Wash", canvas.transform, 660f, new Color(0.95f, 0.78f, 0.44f, 0.028f), false);
            AddImage("Low Fog", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-960f, 0f), new Vector2(960f, 190f), new Color(0.02f, 0.03f, 0.04f, 0.20f));
        }

        private void BuildTopHud()
        {
            var bar = AddPanel("Top Grimoire Bar", canvas.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-780f, -88f), new Vector2(780f, -14f), new Color(0.010f, 0.012f, 0.014f, 0.78f));
            AddFrame(bar.transform, "Top Bar Frame", 1f, new Color(0.85f, 0.62f, 0.32f, 0.26f));
            AddImage("Top Bar Warm Strip", bar.transform, Vector2.zero, new Vector2(1f, 0.36f), new Vector2(0f, 0f), new Vector2(0f, 1.5f), new Color(0.74f, 0.48f, 0.18f, 0.055f));

            headerText = AddText("Header", bar.transform, Vector2.zero, Vector2.one, new Vector2(24f, 34f), new Vector2(-1320f, -8f), "BOTC SOLO", 31, TextAnchor.UpperLeft, FontStyle.Bold);
            tickerText = AddText("Ticker", bar.transform, Vector2.zero, Vector2.one, new Vector2(154f, 10f), new Vector2(-650f, -48f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            tickerText.color = new Color(0.84f, 0.88f, 0.90f, 0.90f);

            townsfolkBadge = AddBadge(bar.transform, new Vector2(196f, 48f), "民", "?", new Color(0.11f, 0.34f, 0.68f, 0.88f));
            outsiderBadge = AddBadge(bar.transform, new Vector2(258f, 48f), "外", "?", new Color(0.09f, 0.22f, 0.42f, 0.88f));
            minionBadge = AddBadge(bar.transform, new Vector2(320f, 48f), "爪", "?", new Color(0.52f, 0.10f, 0.15f, 0.88f));
            demonBadge = AddBadge(bar.transform, new Vector2(382f, 48f), "恶", "?", new Color(0.56f, 0.03f, 0.06f, 0.88f));

            vitalsText = AddText("Vitals", bar.transform, Vector2.zero, Vector2.one, new Vector2(462f, 32f), new Vector2(-870f, -8f), "", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            phaseText = AddText("Phase", bar.transform, Vector2.zero, Vector2.one, new Vector2(730f, 8f), new Vector2(-426f, -8f), "", 17, TextAnchor.MiddleRight, FontStyle.Normal);
            syncStatusPill = AddPanel("Sync Status Pill", bar.transform, Vector2.zero, Vector2.one, new Vector2(730f, 42f), new Vector2(-426f, -8f), new Color(0.05f, 0.09f, 0.07f, 0.46f)).GetComponent<Image>();
            AddFrame(syncStatusPill.transform, "Sync Status Pill Frame", 0.8f, new Color(0.76f, 0.92f, 0.66f, 0.16f));
            syncStatusText = AddText("Sync Status", bar.transform, Vector2.zero, Vector2.one, new Vector2(742f, 42f), new Vector2(-438f, -8f), "", 13, TextAnchor.MiddleRight, FontStyle.Bold);
            AddButton("新局", bar.transform, new Vector2(1206f, 38f), new Vector2(86f, 36f), () => SelectDialoguePreset("new-game"));
            AddButton("剧本手册", bar.transform, new Vector2(1328f, 38f), new Vector2(132f, 36f), () => SelectDialoguePreset("handbook"));
            AddButton("主菜单", bar.transform, new Vector2(1462f, 38f), new Vector2(100f, 36f), () => ToggleMainMenu(true));
        }

        private void BuildGrimoire()
        {
            var board = AddPanel("Grimoire Board", canvas.transform, new Vector2(0.5f, 0.50f), new Vector2(0.5f, 0.50f), new Vector2(-920f, -472f), new Vector2(920f, 458f), new Color(0.36f, 0.32f, 0.24f, 0f));
            grimoireRoot = board.GetComponent<RectTransform>();
            AddFrame(board.transform, "Grimoire Soft Frame", 0.8f, new Color(0.85f, 0.66f, 0.34f, 0.026f));
        }

        private void BuildSideControls()
        {
            var phaseDock = AddPanel("Phase Rail", canvas.transform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(18f, -176f), new Vector2(174f, 176f), new Color(0.006f, 0.013f, 0.020f, 0.22f)).GetComponent<RectTransform>();
            AddFrame(phaseDock, "Phase Rail Frame", 0.8f, new Color(0.82f, 0.56f, 0.25f, 0.18f));
            AddImage("Phase Rail Wash", phaseDock, Vector2.zero, Vector2.one, new Vector2(4f, 4f), new Vector2(-4f, -4f), new Color(0.12f, 0.075f, 0.030f, 0.10f));
            AddText("Phase Dock Title", phaseDock, Vector2.zero, Vector2.one, new Vector2(20f, 294f), new Vector2(-18f, -12f), "流程", 22, TextAnchor.UpperLeft, FontStyle.Bold);
            AddNavButton("‹ 上一阶段", phaseDock, new Vector2(78f, 238f), new Vector2(132f, 44f), () => CyclePhase("prev"));
            AddNavButton("☀ 公聊", phaseDock, new Vector2(78f, 174f), new Vector2(132f, 44f), () => SelectDialoguePreset("public"));
            AddNavButton("⚖ 提名", phaseDock, new Vector2(78f, 110f), new Vector2(132f, 44f), () => SelectDialoguePreset("nomination"));

            var infoDock = AddPanel("Info Rail", canvas.transform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-174f, -176f), new Vector2(-18f, 176f), new Color(0.006f, 0.013f, 0.020f, 0.22f)).GetComponent<RectTransform>();
            AddFrame(infoDock, "Info Rail Frame", 0.8f, new Color(0.82f, 0.56f, 0.25f, 0.18f));
            AddImage("Info Rail Wash", infoDock, Vector2.zero, Vector2.one, new Vector2(4f, 4f), new Vector2(-4f, -4f), new Color(0.12f, 0.075f, 0.030f, 0.10f));
            AddText("Info Dock Title", infoDock, Vector2.zero, Vector2.one, new Vector2(20f, 294f), new Vector2(-18f, -12f), "资料", 22, TextAnchor.UpperLeft, FontStyle.Bold);
            AddNavButton("☷ 日志", infoDock, new Vector2(78f, 238f), new Vector2(132f, 44f), ToggleEventPanel);
            AddNavButton("✦ 时间线", infoDock, new Vector2(78f, 174f), new Vector2(132f, 44f), ToggleTimelinePanel);
            AddNavButton("下一阶段 ›", infoDock, new Vector2(78f, 110f), new Vector2(132f, 44f), () => CyclePhase("next"));
            AddNavButton("◉ 全知", infoDock, new Vector2(78f, 46f), new Vector2(132f, 44f), () => SelectDialoguePreset("grimoire"));
        }

        private void BuildBottomDock()
        {
            bottomDock = AddPanel("Bottom Dock", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-760f, 12f), new Vector2(760f, 170f), new Color(0.006f, 0.014f, 0.024f, 0.72f)).GetComponent<RectTransform>();
            AddFrame(bottomDock, "Bottom Dock Frame", 1f, new Color(0.82f, 0.56f, 0.25f, 0.24f));
            AddImage("Bottom Left Wash", bottomDock, Vector2.zero, Vector2.one, new Vector2(14f, 12f), new Vector2(-1040f, -12f), new Color(0.020f, 0.028f, 0.036f, 0.20f));
            AddImage("Bottom Middle Wash", bottomDock, Vector2.zero, Vector2.one, new Vector2(502f, 12f), new Vector2(-520f, -12f), new Color(0.020f, 0.028f, 0.036f, 0.16f));
            AddImage("Bottom Actions Wash", bottomDock, Vector2.zero, Vector2.one, new Vector2(1014f, 12f), new Vector2(-14f, -12f), new Color(0.020f, 0.028f, 0.036f, 0.18f));
            AddImage("Bottom Divider Left", bottomDock, Vector2.zero, new Vector2(0f, 1f), new Vector2(486f, 16f), new Vector2(487f, -16f), new Color(0.95f, 0.65f, 0.28f, 0.14f));
            AddImage("Bottom Divider Right", bottomDock, Vector2.zero, new Vector2(0f, 1f), new Vector2(1000f, 16f), new Vector2(1001f, -16f), new Color(0.95f, 0.65f, 0.28f, 0.14f));
            objectiveTitleText = AddText("Objective Title", bottomDock, Vector2.zero, Vector2.one, new Vector2(30f, 122f), new Vector2(-1052f, -10f), "阶段目标", 20, TextAnchor.UpperLeft, FontStyle.Bold);
            objectiveHintText = AddText("Objective Hint", bottomDock, Vector2.zero, Vector2.one, new Vector2(30f, 96f), new Vector2(-1052f, -40f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            dialogueTitle = AddText("Dialogue Title", bottomDock, Vector2.zero, Vector2.one, new Vector2(30f, 68f), new Vector2(-1052f, -78f), "对话舞台", 18, TextAnchor.UpperLeft, FontStyle.Bold);
            dialogueBody = AddText("Dialogue Body", bottomDock, Vector2.zero, Vector2.one, new Vector2(30f, 22f), new Vector2(-1052f, -108f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            actionSummaryText = AddText("Action Summary", bottomDock, Vector2.zero, Vector2.one, new Vector2(524f, 24f), new Vector2(-540f, -20f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            AddButton("私聊", bottomDock, new Vector2(1082f, 110f), new Vector2(116f, 36f), () => SelectDialoguePreset("private"));
            AddButton("公聊", bottomDock, new Vector2(1212f, 110f), new Vector2(116f, 36f), () => SelectDialoguePreset("public"));
            AddButton("提名", bottomDock, new Vector2(1342f, 110f), new Vector2(116f, 36f), () => SelectDialoguePreset("nomination"));
            AddButton("行动", bottomDock, new Vector2(1082f, 58f), new Vector2(116f, 36f), SelectPrimaryAction);
            AddButton("投票", bottomDock, new Vector2(1212f, 58f), new Vector2(116f, 36f), () => SelectDialoguePreset("vote-panel"));
            AddButton("更多", bottomDock, new Vector2(1342f, 58f), new Vector2(116f, 36f), ToggleMoreActionsPanel);
            AddButton("收起", bottomDock, new Vector2(1460f, 136f), new Vector2(72f, 26f), ToggleBottomDock);
            bottomDockToggle = AddButton("对话 / 行动", canvas.transform, new Vector2(960f, 40f), new Vector2(172f, 38f), ToggleBottomDock).GetComponent<RectTransform>();
            bottomDockToggle.gameObject.SetActive(false);
        }

        private void BuildMoreActionsPanel()
        {
            moreActionsPanel = AddPanel("More Actions Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(150f, 184f), new Vector2(720f, 416f), new Color(0.005f, 0.012f, 0.020f, 0.90f)).GetComponent<RectTransform>();
            AddFrame(moreActionsPanel, "More Actions Frame", 1f, new Color(0.92f, 0.62f, 0.28f, 0.36f));
            AddImage("More Actions Header Wash", moreActionsPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -62f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.060f));
            AddText("More Actions Title", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(20f, 188f), new Vector2(-20f, -12f), "更多动作", 23, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("More Actions Hint", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(410f, 196f), new Vector2(-18f, -18f), "Esc 关闭", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddText("More Actions Body", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(22f, 152f), new Vector2(-22f, -56f), "低频工具收在这里，底部只保留对局中最高频的入口。", 13, TextAnchor.UpperLeft, FontStyle.Normal);

            AddMoreActionButton("询身", 0, () => SelectDialoguePreset("ask-claim"));
            AddMoreActionButton("骗身", 1, () => SelectDialoguePreset("decept-claim"));
            AddMoreActionButton("保密", 2, () => SelectDialoguePreset("decept-secret"));
            AddMoreActionButton("编夜信", 3, () => SelectDialoguePreset("decept-night"));
            AddMoreActionButton("夜间", 4, () => SelectDialoguePreset("night"));
            AddMoreActionButton("白天", 5, () => SelectDialoguePreset("day"));
            AddMoreActionButton("说书人", 6, () => SelectDialoguePreset("storyteller"));
            AddMoreActionButton("标记", 7, () => SelectDialoguePreset("mark-role"));
            AddMoreActionButton("剧本", 8, () => SelectDialoguePreset("handbook"));
            AddMoreActionButton("复盘", 9, () => { CloseMoreActionsPanel(); ShowInfoDrawer("recap"); });
            AddMoreActionButton("全知", 10, () => SelectDialoguePreset("grimoire"));
            AddMoreActionButton("关闭", 11, CloseMoreActionsPanel);
            moreActionsPanel.gameObject.SetActive(false);
        }

        private void AddMoreActionButton(string label, int index, UnityEngine.Events.UnityAction onClick)
        {
            var col = index % 4;
            var row = index / 4;
            AddButton(label, moreActionsPanel, new Vector2(78f + col * 128f, 112f - row * 44f), new Vector2(112f, 30f), onClick);
        }

        private void BuildTokenInspectorPanel()
        {
            tokenInspectorPanel = AddPanel("Token Inspector", canvas.transform, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(190f, 180f), new Vector2(620f, 506f), new Color(0.005f, 0.012f, 0.020f, 0.88f)).GetComponent<RectTransform>();
            AddFrame(tokenInspectorPanel, "Token Inspector Frame", 1f, new Color(0.92f, 0.62f, 0.28f, 0.32f));
            AddImage("Token Inspector Header Wash", tokenInspectorPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -78f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            AddImage("Token Inspector Body Wash", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(18f, 76f), new Vector2(-18f, -92f), new Color(0.020f, 0.028f, 0.036f, 0.28f));
            AddFrame(tokenInspectorPanel.GetChild(tokenInspectorPanel.childCount - 1), "Token Inspector Body Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
            tokenInspectorTitle = AddText("Token Inspector Title", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(22f, 264f), new Vector2(-22f, -14f), "目标详情", 26, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Token Inspector Hint", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(300f, 274f), new Vector2(-18f, -20f), "Esc 关闭", 12, TextAnchor.UpperRight, FontStyle.Normal);
            tokenInspectorBody = AddText("Token Inspector Body", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(34f, 100f), new Vector2(-34f, -108f), "点击 token 查看公开可见信息。", 16, TextAnchor.UpperLeft, FontStyle.Normal);
            AddButton("私聊", tokenInspectorPanel, new Vector2(62f, 40f), new Vector2(84f, 32f), () => SelectDialoguePreset("private"));
            AddButton("提名", tokenInspectorPanel, new Vector2(160f, 40f), new Vector2(84f, 32f), () => SelectDialoguePreset("nomination"));
            AddButton("行动", tokenInspectorPanel, new Vector2(258f, 40f), new Vector2(84f, 32f), SelectPrimaryAction);
            AddButton("关闭", tokenInspectorPanel, new Vector2(356f, 40f), new Vector2(84f, 32f), CloseTokenInspector);
            tokenInspectorPanel.gameObject.SetActive(false);
        }

        private void BuildModalBackdrop()
        {
            modalBackdrop = AddPanel("Modal Backdrop", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0.002f, 0.006f, 0.010f, 0.46f)).GetComponent<RectTransform>();
            AddImage("Modal Backdrop Top Wash", modalBackdrop, new Vector2(0f, 0.72f), Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.20f));
            AddImage("Modal Backdrop Bottom Wash", modalBackdrop, Vector2.zero, new Vector2(1f, 0.32f), Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.24f));
            var button = modalBackdrop.gameObject.AddComponent<Button>();
            button.transition = Selectable.Transition.None;
            button.onClick.AddListener(CloseActiveModal);
            modalBackdrop.gameObject.SetActive(false);
        }

        private void BuildEventPanel()
        {
            eventPanel = AddPanel("Event Panel", canvas.transform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-516f, -300f), new Vector2(-64f, 286f), new Color(0.004f, 0.010f, 0.017f, 0.82f)).GetComponent<RectTransform>();
            AddFrame(eventPanel, "Event Panel Frame", 1.2f, new Color(0.82f, 0.56f, 0.25f, 0.36f));
            AddImage("Info Drawer Header Wash", eventPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -86f), new Vector2(-1f, -1f), new Color(0.72f, 0.45f, 0.18f, 0.075f));
            AddImage("Info Drawer Content Wash", eventPanel, Vector2.zero, Vector2.one, new Vector2(16f, 66f), new Vector2(-16f, -112f), new Color(0.020f, 0.028f, 0.036f, 0.34f));
            AddImage("Info Drawer Sub Wash", eventPanel, Vector2.zero, Vector2.one, new Vector2(16f, 16f), new Vector2(-16f, -438f), new Color(0.65f, 0.43f, 0.18f, 0.065f));
            infoDrawerTitle = AddText("Info Drawer Title", eventPanel, Vector2.zero, Vector2.one, new Vector2(24f, 534f), new Vector2(-24f, -14f), "资料抽屉", 26, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Info Drawer Hint", eventPanel, Vector2.zero, Vector2.one, new Vector2(336f, 544f), new Vector2(-24f, -20f), "Esc 关闭", 12, TextAnchor.UpperRight, FontStyle.Normal);
            eventTabText = AddButton("日志", eventPanel, new Vector2(68f, 492f), new Vector2(82f, 30f), () => ShowInfoDrawer("events")).GetComponentInChildren<Text>();
            timelineTabText = AddButton("时间", eventPanel, new Vector2(158f, 492f), new Vector2(82f, 30f), () => ShowInfoDrawer("timeline")).GetComponentInChildren<Text>();
            handbookTabText = AddButton("手册", eventPanel, new Vector2(248f, 492f), new Vector2(82f, 30f), () => SelectDialoguePreset("handbook")).GetComponentInChildren<Text>();
            recapTabText = AddButton("复盘", eventPanel, new Vector2(338f, 492f), new Vector2(82f, 30f), () => ShowInfoDrawer("recap")).GetComponentInChildren<Text>();
            eventBody = AddText("Info Drawer Main", eventPanel, Vector2.zero, Vector2.one, new Vector2(26f, 162f), new Vector2(-26f, -106f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            queueBody = AddText("Info Drawer Sub", eventPanel, Vector2.zero, Vector2.one, new Vector2(26f, 42f), new Vector2(-26f, -434f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            eventPanel.gameObject.SetActive(false);
        }

        private void BuildPrivateChatPanel()
        {
            privateChatPanel = AddPanel("Private Chat Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-540f, 132f), new Vector2(540f, 772f), new Color(0.005f, 0.012f, 0.020f, 0.93f)).GetComponent<RectTransform>();
            AddFrame(privateChatPanel, "Private Chat Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.38f));
            AddImage("Private Chat Header Wash", privateChatPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -82f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.075f));
            AddText("Private Chat Title", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(28f, 584f), new Vector2(-28f, -14f), "私聊面板", 30, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Private Chat Hint", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(850f, 594f), new Vector2(-28f, -20f), "Esc 关闭", 12, TextAnchor.UpperRight, FontStyle.Normal);
            privateTargetText = AddText("Private Target", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(30f, 548f), new Vector2(-28f, -70f), "目标：未选择", 19, TextAnchor.UpperLeft, FontStyle.Normal);

            privateTargetCardRoot = AddPanel("Private Target Card", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(28f, 76f), new Vector2(-828f, -108f), new Color(0.020f, 0.028f, 0.036f, 0.34f)).GetComponent<RectTransform>();

            var privateHistoryWash = AddImage("Private History Wash", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(276f, 264f), new Vector2(-28f, -108f), new Color(0.020f, 0.028f, 0.036f, 0.34f));
            AddFrame(privateHistoryWash.transform, "Private History Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.22f));
            AddText("Private History Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(300f, 500f), new Vector2(-52f, -126f), "最近私聊", 18, TextAnchor.UpperLeft, FontStyle.Bold);
            privateHistoryText = AddText("Private History Text", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(300f, 292f), new Vector2(-52f, -176f), "选择一名玩家后显示最近私聊。", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            privateHistoryText.color = new Color(0.90f, 0.84f, 0.72f, 0.96f);
            privateHistoryText.gameObject.SetActive(false);
            privateDialogueRoot = AddPanel("Private Dialogue Bubbles", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(300f, 286f), new Vector2(-52f, -172f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();

            var composeWash = AddImage("Private Compose Wash", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(276f, 76f), new Vector2(-28f, -364f), new Color(0.020f, 0.028f, 0.036f, 0.30f));
            AddFrame(composeWash.transform, "Private Compose Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            AddText("Private Compose Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(300f, 240f), new Vector2(-52f, -378f), "本次私聊内容", 18, TextAnchor.UpperLeft, FontStyle.Bold);
            AddButton("身份范围", privateChatPanel, new Vector2(432f, 224f), new Vector2(112f, 28f), () => SendPrivateQuickQuestion("你愿意给身份范围吗？", "followup-range"));
            AddButton("硬信息", privateChatPanel, new Vector2(554f, 224f), new Vector2(104f, 28f), () => SendPrivateQuickQuestion("你有硬信息能证明自己吗？", "followup-proof"));
            AddButton("昨晚信息", privateChatPanel, new Vector2(676f, 224f), new Vector2(112f, 28f), () => SendPrivateQuickQuestion("你昨晚得到了什么信息？", "followup-night"));
            AddButton("提名意向", privateChatPanel, new Vector2(806f, 224f), new Vector2(120f, 28f), () => SendPrivateQuickQuestion("你现在想提名谁？", "followup-nomination"));
            AddText("Claim Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(300f, 184f), new Vector2(-780f, -438f), "声称身份", 15, TextAnchor.UpperLeft, FontStyle.Bold);
            privateClaimRoleText = AddText("Claim Role", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(396f, 182f), new Vector2(-270f, -438f), "不声称", 18, TextAnchor.UpperLeft, FontStyle.Normal);
            privateClaimRoleGridRoot = AddPanel("Private Claim Role Icon", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(790f, 152f), new Vector2(-206f, -396f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            AddButton("‹", privateChatPanel, new Vector2(880f, 196f), new Vector2(42f, 30f), () => CyclePrivateClaimRole(-1));
            AddButton("›", privateChatPanel, new Vector2(934f, 196f), new Vector2(42f, 30f), () => CyclePrivateClaimRole(1));
            AddText("Night Info Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(300f, 140f), new Vector2(-780f, -482f), "夜间说法", 15, TextAnchor.UpperLeft, FontStyle.Bold);
            privateNightInput = AddInputField("Private Night Input", privateChatPanel, new Vector2(396f, 126f), new Vector2(1010f, 164f), "例如：我昨晚看到 3 号和 7 号不同阵营");
            privateSecretToggle = AddToggle("Private Secret Toggle", privateChatPanel, new Vector2(300f, 86f), "请求对方暂时保密");
            privateStatusText = AddText("Private Status", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(626f, 74f), new Vector2(-276f, -532f), "准备发送给 JS Core。", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            privateStatusText.color = new Color(0.82f, 0.88f, 0.90f, 0.90f);
            AddButton("询问身份", privateChatPanel, new Vector2(732f, 40f), new Vector2(122f, 36f), () => SendPrivateClaimQuestion());
            AddButton("发送私聊", privateChatPanel, new Vector2(870f, 40f), new Vector2(132f, 36f), () => SendPrivatePanelMessage());
            AddButton("关闭", privateChatPanel, new Vector2(984f, 40f), new Vector2(94f, 36f), () => privateChatPanel.gameObject.SetActive(false));
            privateTargetPickerRoot = AddPanel("Private Target Picker", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(276f, 76f), new Vector2(-28f, -108f), new Color(0.004f, 0.010f, 0.017f, 0.95f)).GetComponent<RectTransform>();
            PopulatePrivateClaimRoles();
            privateChatPanel.gameObject.SetActive(false);
        }

        private void BuildActionFormPanel()
        {
            actionFormPanel = AddPanel("Action Form Panel", canvas.transform, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(54f, 150f), new Vector2(734f, 650f), new Color(0.005f, 0.012f, 0.020f, 0.90f)).GetComponent<RectTransform>();
            AddFrame(actionFormPanel, "Action Form Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.38f));
            AddImage("Action Form Header Wash", actionFormPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -78f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.065f));
            actionFormTitle = AddText("Action Form Title", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(22f, 454f), new Vector2(-22f, -14f), "行动表单", 25, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Action Form Hint", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(508f, 462f), new Vector2(-22f, -18f), "Esc 关闭", 12, TextAnchor.UpperRight, FontStyle.Normal);
            actionFormBody = AddText("Action Form Body", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(24f, 358f), new Vector2(-24f, -64f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            actionOptionRoot = AddPanel("Action Option Root", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(22f, 82f), new Vector2(-22f, -174f), new Color(0.020f, 0.028f, 0.036f, 0.24f)).GetComponent<RectTransform>();
            AddFrame(actionOptionRoot, "Action Option Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            actionFormStatusText = AddText("Action Form Status", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(24f, 42f), new Vector2(-250f, -436f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            AddButton("自动合法选择", actionFormPanel, new Vector2(454f, 34f), new Vector2(142f, 30f), () => SendActiveActionFormAuto());
            AddButton("确认发送", actionFormPanel, new Vector2(576f, 34f), new Vector2(116f, 30f), () => SendActionFormComposed());
            AddButton("关闭", actionFormPanel, new Vector2(646f, 34f), new Vector2(82f, 30f), () => actionFormPanel.gameObject.SetActive(false));
            actionFormPanel.gameObject.SetActive(false);
        }

        private void BuildStorytellerPanel()
        {
            storytellerPanel = AddPanel("Storyteller Panel", canvas.transform, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(54f, 204f), new Vector2(590f, 560f), new Color(0.005f, 0.012f, 0.020f, 0.90f)).GetComponent<RectTransform>();
            AddFrame(storytellerPanel, "Storyteller Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.36f));
            AddImage("Storyteller Header Wash", storytellerPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -72f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.065f));
            storytellerTitle = AddText("Storyteller Title", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(22f, 306f), new Vector2(-22f, -14f), "Storyteller 队列", 25, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Storyteller Hint", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(354f, 314f), new Vector2(-22f, -18f), "Esc 关闭", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddImage("Storyteller Body Wash", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(18f, 66f), new Vector2(-18f, -88f), new Color(0.020f, 0.028f, 0.036f, 0.28f));
            storytellerBody = AddText("Storyteller Body", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(30f, 82f), new Vector2(-30f, -108f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            AddButton("处理当前", storytellerPanel, new Vector2(118f, 34f), new Vector2(132f, 30f), () => OpenActionFormPanel("storyteller-action"));
            AddButton("刷新", storytellerPanel, new Vector2(270f, 34f), new Vector2(94f, 30f), RenderStorytellerPanel);
            AddButton("关闭", storytellerPanel, new Vector2(446f, 34f), new Vector2(94f, 30f), () => storytellerPanel.gameObject.SetActive(false));
            storytellerPanel.gameObject.SetActive(false);
        }

        private void BuildHandbookPanel()
        {
            handbookPanel = AddPanel("Handbook Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-500f, -320f), new Vector2(500f, 320f), new Color(0.005f, 0.012f, 0.020f, 0.92f)).GetComponent<RectTransform>();
            AddFrame(handbookPanel, "Handbook Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.38f));
            AddImage("Handbook Header Wash", handbookPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -82f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            handbookTitle = AddText("Handbook Title", handbookPanel, Vector2.zero, Vector2.one, new Vector2(26f, 584f), new Vector2(-26f, -18f), "剧本手册", 28, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Handbook Hint", handbookPanel, Vector2.zero, Vector2.one, new Vector2(760f, 592f), new Vector2(-26f, -24f), "Esc 关闭", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddButton("全部", handbookPanel, new Vector2(74f, 530f), new Vector2(92f, 30f), () => SelectHandbookCategory("all"));
            AddButton("镇民", handbookPanel, new Vector2(174f, 530f), new Vector2(92f, 30f), () => SelectHandbookCategory("townsfolk"));
            AddButton("外来者", handbookPanel, new Vector2(274f, 530f), new Vector2(92f, 30f), () => SelectHandbookCategory("outsider"));
            AddButton("爪牙", handbookPanel, new Vector2(374f, 530f), new Vector2(92f, 30f), () => SelectHandbookCategory("minion"));
            AddButton("恶魔", handbookPanel, new Vector2(474f, 530f), new Vector2(92f, 30f), () => SelectHandbookCategory("demon"));
            handbookRoleListRoot = AddPanel("Handbook Role List", handbookPanel, Vector2.zero, Vector2.one, new Vector2(24f, 84f), new Vector2(-640f, -128f), new Color(0.020f, 0.028f, 0.036f, 0.26f)).GetComponent<RectTransform>();
            AddFrame(handbookRoleListRoot, "Handbook List Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            AddImage("Handbook Detail Wash", handbookPanel, Vector2.zero, Vector2.one, new Vector2(384f, 238f), new Vector2(-24f, -128f), new Color(0.020f, 0.028f, 0.036f, 0.28f));
            handbookDetailText = AddText("Handbook Detail", handbookPanel, Vector2.zero, Vector2.one, new Vector2(406f, 258f), new Vector2(-46f, -148f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            AddImage("Handbook Order Wash", handbookPanel, Vector2.zero, Vector2.one, new Vector2(384f, 84f), new Vector2(-24f, -414f), new Color(0.020f, 0.028f, 0.036f, 0.24f));
            handbookOrderText = AddText("Handbook Order", handbookPanel, Vector2.zero, Vector2.one, new Vector2(406f, 98f), new Vector2(-46f, -430f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            AddButton("关闭", handbookPanel, new Vector2(920f, 38f), new Vector2(94f, 30f), () => handbookPanel.gameObject.SetActive(false));
            handbookPanel.gameObject.SetActive(false);
        }

        private void BuildVotePanel()
        {
            votePanel = AddPanel("Vote Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-520f, 156f), new Vector2(520f, 690f), new Color(0.005f, 0.012f, 0.020f, 0.92f)).GetComponent<RectTransform>();
            AddFrame(votePanel, "Vote Panel Frame", 1.2f, new Color(0.92f, 0.62f, 0.28f, 0.42f));
            AddImage("Vote Header Wash", votePanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -88f), new Vector2(-1f, -1f), new Color(0.78f, 0.48f, 0.18f, 0.070f));
            voteTitle = AddText("Vote Title", votePanel, Vector2.zero, Vector2.one, new Vector2(26f, 486f), new Vector2(-26f, -14f), "投票仪式", 28, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Vote Hint", votePanel, Vector2.zero, Vector2.one, new Vector2(820f, 494f), new Vector2(-26f, -18f), "Esc 关闭", 12, TextAnchor.UpperRight, FontStyle.Normal);
            voteBody = AddText("Vote Body", votePanel, Vector2.zero, Vector2.one, new Vector2(28f, 408f), new Vector2(-28f, -66f), "", 18, TextAnchor.UpperLeft, FontStyle.Normal);
            voteAnimationRoot = AddPanel("Vote Animation Root", votePanel, Vector2.zero, Vector2.one, new Vector2(28f, 104f), new Vector2(-28f, -154f), new Color(0.020f, 0.028f, 0.036f, 0.26f)).GetComponent<RectTransform>();
            AddFrame(voteAnimationRoot, "Vote Animation Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.22f));
            voteAnimationRowsRoot = AddPanel("Vote Animation Rows", votePanel, Vector2.zero, Vector2.one, new Vector2(28f, 62f), new Vector2(-28f, -444f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            AddButton("打开提名", votePanel, new Vector2(128f, 34f), new Vector2(142f, 34f), () => SelectDialoguePreset("nomination"));
            AddButton("重播举手", votePanel, new Vector2(318f, 34f), new Vector2(128f, 34f), () => RestartVoteAnimation());
            AddButton("关闭", votePanel, new Vector2(930f, 34f), new Vector2(94f, 34f), () => votePanel.gameObject.SetActive(false));
            votePanel.gameObject.SetActive(false);
        }

        private void BuildEndgamePanel()
        {
            endgamePanel = AddPanel("Endgame Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-520f, -310f), new Vector2(520f, 310f), new Color(0.004f, 0.009f, 0.014f, 0.94f)).GetComponent<RectTransform>();
            AddFrame(endgamePanel, "Endgame Frame", 1.4f, new Color(0.96f, 0.68f, 0.30f, 0.46f));
            AddImage("Endgame Header Wash", endgamePanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -112f), new Vector2(-1f, -1f), new Color(0.82f, 0.50f, 0.18f, 0.085f));
            AddImage("Endgame Body Wash", endgamePanel, Vector2.zero, Vector2.one, new Vector2(30f, 118f), new Vector2(-520f, -138f), new Color(0.020f, 0.028f, 0.036f, 0.34f));
            AddImage("Endgame Events Wash", endgamePanel, Vector2.zero, Vector2.one, new Vector2(540f, 118f), new Vector2(-30f, -138f), new Color(0.020f, 0.028f, 0.036f, 0.30f));
            endgameTitle = AddText("Endgame Title", endgamePanel, Vector2.zero, Vector2.one, new Vector2(34f, 546f), new Vector2(-34f, -18f), "终局", 36, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Endgame Hint", endgamePanel, Vector2.zero, Vector2.one, new Vector2(820f, 556f), new Vector2(-34f, -24f), "Esc 关闭", 13, TextAnchor.UpperRight, FontStyle.Normal);
            endgameBody = AddText("Endgame Body", endgamePanel, Vector2.zero, Vector2.one, new Vector2(54f, 154f), new Vector2(-540f, -154f), "", 18, TextAnchor.UpperLeft, FontStyle.Normal);
            AddText("Endgame Events Label", endgamePanel, Vector2.zero, Vector2.one, new Vector2(562f, 482f), new Vector2(-54f, -124f), "终局事件", 20, TextAnchor.UpperLeft, FontStyle.Bold);
            endgameEventsText = AddText("Endgame Events", endgamePanel, Vector2.zero, Vector2.one, new Vector2(562f, 152f), new Vector2(-54f, -168f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            AddButton("查看复盘", endgamePanel, new Vector2(230f, 54f), new Vector2(132f, 38f), () =>
            {
                CloseEndgamePanel();
                ShowInfoDrawer("recap");
            });
            AddButton("新局", endgamePanel, new Vector2(520f, 54f), new Vector2(116f, 38f), () =>
            {
                CloseEndgamePanel();
                SendUnityAction("new-game");
            });
            AddButton("继续查看", endgamePanel, new Vector2(810f, 54f), new Vector2(132f, 38f), CloseEndgamePanel);
            endgamePanel.gameObject.SetActive(false);
        }

        private void BuildRolePickerPanel()
        {
            rolePickerPanel = AddPanel("Role Picker Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-680f, -332f), new Vector2(680f, 332f), new Color(0.001f, 0.004f, 0.007f, 0.96f)).GetComponent<RectTransform>();
            AddFrame(rolePickerPanel, "Role Picker Frame", 1.2f, new Color(0.92f, 0.62f, 0.28f, 0.40f));
            AddImage("Role Picker Header Wash", rolePickerPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -82f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            rolePickerTitle = AddText("Role Picker Title", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(30f, 596f), new Vector2(-120f, -14f), "选择角色", 32, TextAnchor.UpperCenter, FontStyle.Bold);
            AddButton("×", rolePickerPanel, new Vector2(1318f, 622f), new Vector2(42f, 34f), CloseRolePicker);
            rolePickerStatusText = AddText("Role Picker Status", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(42f, 536f), new Vector2(-42f, -92f), "选择一个身份 token。", 15, TextAnchor.UpperCenter, FontStyle.Normal);
            rolePickerGridRoot = AddPanel("Role Picker Grid", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(34f, 84f), new Vector2(-34f, -122f), new Color(0.006f, 0.010f, 0.014f, 0.44f)).GetComponent<RectTransform>();
            AddFrame(rolePickerGridRoot, "Role Picker Grid Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
            AddText("Role Picker Category Hint", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(42f, 26f), new Vector2(-42f, -610f), "蓝色：好人阵营    红色：邪恶阵营    金色外圈表示当前选择", 14, TextAnchor.MiddleCenter, FontStyle.Normal);
            rolePickerPanel.gameObject.SetActive(false);
        }

        private void BuildTimelinePanel()
        {
            timelinePanel = AddPanel("Timeline Panel", canvas.transform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(118f, -260f), new Vector2(418f, 220f), new Color(0.004f, 0.010f, 0.017f, 0.70f)).GetComponent<RectTransform>();
            AddFrame(timelinePanel, "Timeline Panel Frame", 1.2f, new Color(0.82f, 0.56f, 0.25f, 0.30f));
            AddText("Timeline Title", timelinePanel, Vector2.zero, Vector2.one, new Vector2(20f, 430f), new Vector2(-20f, -10f), "对话时间线", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            timelineBody = AddText("Timeline Body", timelinePanel, Vector2.zero, Vector2.one, new Vector2(20f, 18f), new Vector2(-20f, -58f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            timelinePanel.gameObject.SetActive(false);
        }

        private void BuildMainMenu()
        {
            mainMenuRoot = AddPanel("Main Menu Overlay", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0.005f, 0.010f, 0.014f, 0.82f)).GetComponent<RectTransform>();
            AddImage("Menu Warm Halo", mainMenuRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-560f, -360f), new Vector2(560f, 360f), new Color(0.95f, 0.72f, 0.38f, 0.10f));
            var card = AddPanel("Main Menu Card", mainMenuRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-460f, -320f), new Vector2(460f, 330f), new Color(0.012f, 0.014f, 0.016f, 0.90f));
            AddFrame(card.transform, "Main Menu Card Frame", 2f, new Color(0.88f, 0.62f, 0.28f, 0.56f));
            AddImage("Menu Inner Glow", card.transform, Vector2.zero, Vector2.one, new Vector2(18f, 18f), new Vector2(-18f, -18f), new Color(0.78f, 0.54f, 0.24f, 0.055f));
            var title = AddText("Menu Title", card.transform, Vector2.zero, Vector2.one, new Vector2(34f, 520f), new Vector2(-34f, -34f), "BOTC SOLO", 58, TextAnchor.UpperLeft, FontStyle.Bold);
            title.color = new Color(1f, 0.86f, 0.58f, 1f);
            AddText("Menu Subtitle", card.transform, Vector2.zero, Vector2.one, new Vector2(38f, 474f), new Vector2(-430f, -114f), "血染钟楼单机模拟器 · Unity 原型", 18, TextAnchor.UpperLeft, FontStyle.Normal);
            AddMenuButton("新游戏 / 进入魔典", card.transform, new Vector2(220f, 390f), () => ToggleMainMenu(false));
            AddMenuButton("继续当前局", card.transform, new Vector2(220f, 326f), () => ToggleMainMenu(false));
            AddMenuButton("设置", card.transform, new Vector2(220f, 262f), () => ShowMenuMessage("设置\n\n分辨率、窗口模式和音量滑条会接入这里。当前音乐已根据白天、夜晚和提名阶段切换。"));
            AddMenuButton("剧本手册", card.transform, new Vector2(220f, 198f), () => SendUnityAction("script-handbook"));
            AddMenuButton("退出原型", card.transform, new Vector2(220f, 134f), () => Application.Quit());
            var info = AddPanel("Menu Info Panel", card.transform, Vector2.zero, Vector2.zero, new Vector2(450f, 112f), new Vector2(870f, 454f), new Color(0.006f, 0.012f, 0.018f, 0.70f));
            AddFrame(info.transform, "Menu Info Frame", 1.2f, new Color(0.82f, 0.56f, 0.25f, 0.32f));
            AddText("Menu Info Title", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 292f), new Vector2(-22f, -12f), "当前对局", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            menuHint = AddText("Menu Hint", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 28f), new Vector2(-22f, -74f), BuildMenuInfoText(), 16, TextAnchor.UpperLeft, FontStyle.Normal);
            AddText("Menu Footer", card.transform, Vector2.zero, Vector2.one, new Vector2(38f, 28f), new Vector2(-38f, -590f), "Unity 负责界面外壳；规则、AI 与行动结算仍由 JS Core 驱动。", 14, TextAnchor.LowerCenter, FontStyle.Normal);
            mainMenuRoot.gameObject.SetActive(true);
        }

        private void RenderAllAndMood()
        {
            RenderAll();
            SetMood(MoodFromState());
        }

        private void RenderAll()
        {
            if (background != null)
            {
                background.sprite = SpriteFromResource(vm.phase == "night" ? "Botc/ui/bg_night" : "Botc/ui/bg_day");
                background.preserveAspect = false;
            }
            headerText.text = IsGameOver() ? "BOTC SOLO · 终局" : "BOTC SOLO";
            if (vitalsText != null) vitalsText.text = IsGameOver()
                ? $"{OutcomeWinnerLabel()}胜利 | 存活 {vm.alive} | 死亡 {vm.dead}"
                : $"存活 {vm.alive} | 死亡 {vm.dead}";
            UpdateSetupBadges();
            phaseText.text = Ellipsize($"{DisplayScriptName()} - D{vm.day}/N{vm.night} - {PhaseLabel()}", 42);
            UpdateSyncStatusText();
            tickerText.text = Ellipsize(LatestEvent(), 72);
            if (objectiveTitleText != null) objectiveTitleText.text = Ellipsize(string.IsNullOrWhiteSpace(vm.phaseObjectiveTitle) ? "阶段目标" : vm.phaseObjectiveTitle, 18);
            if (objectiveHintText != null) objectiveHintText.text = ClampTextBlock(string.IsNullOrWhiteSpace(vm.phaseObjectiveHint) ? "等待 JS Core 更新。" : vm.phaseObjectiveHint, 2, 38);
            dialogueTitle.text = string.IsNullOrWhiteSpace(vm.dialogueTitle) ? "对话舞台" : vm.dialogueTitle;
            dialogueBody.text = string.IsNullOrWhiteSpace(vm.dialogueText)
                ? "点击任意 token 查看玩家；再使用私聊、公聊、提名、夜间行动或标记。"
                : ClampTextLines(new[] { vm.dialogueText }, 3, 60);
            if (actionSummaryText != null) actionSummaryText.text = BuildActionSummaryText();
            if (vm.scriptHandbook != null && vm.scriptHandbook.open)
            {
                infoDrawerTab = "handbook";
                eventPanelOpen = true;
            }
            if (infoDrawerTitle != null) infoDrawerTitle.text = InfoDrawerTitle();
            eventBody.text = BuildInfoDrawerMainText();
            queueBody.text = BuildInfoDrawerSubText();
            UpdateInfoDrawerTabs();
            timelineBody.text = BuildTimelineText();
            UpdateVotePanelText();
            UpdatePrivateChatPanelText();
            UpdateTokenInspectorText();
            RenderStorytellerPanel();
            if (handbookPanel != null && handbookPanel.gameObject.activeSelf) RenderHandbookPanel();
            RenderEndgamePanel();
            ApplyBottomDockVisibility();
            ApplyTokenInspectorVisibility();
            ApplyAuxPanelVisibility();
            ApplyModalBackdropVisibility();
            RenderGrimoire();
        }

        private bool IsGameOver()
        {
            return vm != null
                && (vm.gameOver
                    || string.Equals(vm.phase, "ended", StringComparison.OrdinalIgnoreCase)
                    || (vm.outcome != null && vm.outcome.gameOver));
        }

        private string OutcomeWinnerLabel()
        {
            var label = vm?.outcome?.winnerLabel;
            if (!string.IsNullOrWhiteSpace(label)) return label;
            var winner = vm?.winner ?? vm?.outcome?.winner ?? "";
            if (winner == "good") return "善良阵营";
            if (winner == "evil") return "邪恶阵营";
            return "本局";
        }

        private string OutcomeTitle()
        {
            var title = vm?.outcome?.title;
            return string.IsNullOrWhiteSpace(title) ? $"{OutcomeWinnerLabel()}胜利" : title;
        }

        private string CurrentEndgameKey()
        {
            return $"{vm?.gameId ?? ""}:{vm?.winner ?? vm?.outcome?.winner ?? ""}:{vm?.winnerReason ?? vm?.outcome?.reason ?? ""}";
        }

        private void RenderEndgamePanel()
        {
            if (endgamePanel == null) return;
            if (!IsGameOver())
            {
                endgamePanel.gameObject.SetActive(false);
                endgameDismissed = false;
                dismissedEndgameGameId = "";
                return;
            }

            var key = CurrentEndgameKey();
            if (dismissedEndgameGameId != key) endgameDismissed = false;
            if (endgameDismissed)
            {
                endgamePanel.gameObject.SetActive(false);
                return;
            }

            endgamePanel.gameObject.SetActive(true);
            if (endgameTitle != null) endgameTitle.text = OutcomeTitle();
            var reason = FirstNonEmpty(vm?.winnerReason, vm?.outcome?.reason);
            var bodyLines = new List<string>
            {
                $"{OutcomeWinnerLabel()}胜利",
                string.IsNullOrWhiteSpace(reason) ? "胜负条件已经由 JS Core 结算。" : reason,
                $"剧本：{DisplayScriptName()}",
                $"结束于 D{vm.day}/N{vm.night} · 存活 {vm.alive} · 死亡 {vm.dead}",
                "对局已结束。你可以查看复盘、继续检查魔典，或直接新开一局。"
            };
            if (endgameBody != null) endgameBody.text = ClampTextLines(bodyLines, 8, 44);

            var events = vm?.outcome?.finalEvents;
            if (events == null || events.Length == 0) events = vm?.events ?? Array.Empty<string>();
            var eventLines = events
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .TakeLast(7)
                .Select((entry) => $"· {entry}");
            if (endgameEventsText != null) endgameEventsText.text = ClampTextLines(eventLines, 9, 46);
        }

        private void CloseEndgamePanel()
        {
            endgameDismissed = true;
            dismissedEndgameGameId = CurrentEndgameKey();
            if (endgamePanel != null) endgamePanel.gameObject.SetActive(false);
            ApplyModalBackdropVisibility();
        }

        private void RenderGrimoire()
        {
            for (var i = grimoireRoot.childCount - 1; i >= 0; i--) Destroy(grimoireRoot.GetChild(i).gameObject);
            AddCircleImage("Outer Circle", grimoireRoot, 548f, new Color(1f, 0.78f, 0.36f, 0.14f), true);
            AddCircleImage("Middle Circle", grimoireRoot, 462f, new Color(1f, 0.78f, 0.36f, 0.065f), true);
            AddCircleImage("Inner Mist", grimoireRoot, 396f, new Color(0.05f, 0.04f, 0.035f, 0.085f), false);
            var title = AddText("Script Title", grimoireRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-360f, -56f), new Vector2(360f, 56f), DisplayScriptName(), 52, TextAnchor.MiddleCenter, FontStyle.BoldAndItalic);
            title.color = new Color(1f, 0.72f, 0.30f, 0.94f);
            var players = vm.players ?? Array.Empty<PlayerViewModel>();
            var radius = Mathf.Clamp(Mathf.Min(Screen.width, Screen.height) * 0.383f, 372f, 424f);
            for (var i = 0; i < players.Length; i++)
            {
                var angle = Mathf.PI * 0.5f - Mathf.PI * 2f * i / Mathf.Max(1, players.Length);
                RenderPlayerToken(players[i], new Vector2(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius));
            }
            RenderBluffs();
        }

        private void RenderPlayerToken(PlayerViewModel player, Vector2 position)
        {
            var root = new GameObject($"Player {player.seat}", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
            root.transform.SetParent(grimoireRoot, false);
            var rt = root.GetComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = position;
            rt.sizeDelta = new Vector2(176f, 196f);
            root.GetComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            root.GetComponent<Button>().onClick.AddListener(() => ShowTokenDialogue(player));
            if (!string.IsNullOrWhiteSpace(selectedPlayerId) && player.id == selectedPlayerId)
            {
                var halo = AddImage("Selected Token Halo", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-82f, -150f), new Vector2(82f, 14f), new Color(1f, 0.80f, 0.32f, 0.34f));
                halo.sprite = GetCircleRingSprite();
                halo.preserveAspect = true;
                halo.raycastTarget = false;
            }
            var token = AddImage("Token", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-TokenSize / 2f, -TokenSize - 8f), new Vector2(TokenSize / 2f, -8f), Color.white);
            var tokenSprite = SpriteFromResource(player.revealed ? "Botc/ui/token1" : "Botc/ui/vote1");
            var usingTokenFallback = tokenSprite == null;
            token.sprite = tokenSprite ?? GetCircleFillSprite();
            token.color = usingTokenFallback ? new Color(0.86f, 0.78f, 0.60f, 0.90f) : Color.white;
            token.preserveAspect = true;
            token.raycastTarget = false;
            if (usingTokenFallback)
            {
                var tokenRing = AddImage("Token Fallback Ring", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-TokenSize / 2f, -TokenSize - 8f), new Vector2(TokenSize / 2f, -8f), new Color(1f, 0.82f, 0.48f, 0.36f));
                tokenRing.sprite = GetCircleRingSprite();
                tokenRing.preserveAspect = true;
                tokenRing.raycastTarget = false;
                if (!player.revealed)
                {
                    var tokenMark = AddText("Token Fallback Mark", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-42f, -104f), new Vector2(42f, -34f), "?", 44, TextAnchor.MiddleCenter, FontStyle.Bold);
                    tokenMark.color = new Color(1f, 0.92f, 0.72f, 0.92f);
                    tokenMark.raycastTarget = false;
                }
            }
            if (player.revealed && !string.IsNullOrWhiteSpace(player.roleId))
            {
                var roleSprite = SpriteFromResource($"Botc/roles/{player.roleId}");
                if (roleSprite != null)
                {
                    var roleIcon = AddImage("Role Icon", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-RoleIconSize / 2f, -98f), new Vector2(RoleIconSize / 2f, -24f), Color.white);
                    roleIcon.sprite = roleSprite;
                    roleIcon.preserveAspect = true;
                    roleIcon.raycastTarget = false;
                }
                else
                {
                    var fallback = AddImage("Role Icon Fallback", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-RoleIconSize / 2f, -98f), new Vector2(RoleIconSize / 2f, -24f), new Color(0.10f, 0.070f, 0.040f, 0.48f));
                    fallback.sprite = GetCircleFillSprite();
                    fallback.preserveAspect = true;
                    fallback.raycastTarget = false;
                    var fallbackRing = AddImage("Role Icon Fallback Ring", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-RoleIconSize / 2f, -98f), new Vector2(RoleIconSize / 2f, -24f), new Color(1f, 0.82f, 0.48f, 0.30f));
                    fallbackRing.sprite = GetCircleRingSprite();
                    fallbackRing.preserveAspect = true;
                    fallbackRing.raycastTarget = false;
                    var fallbackText = AddText("Role Icon Fallback Text", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-RoleIconSize / 2f, -93f), new Vector2(RoleIconSize / 2f, -29f), RoleIconFallbackLabel(player), 22, TextAnchor.MiddleCenter, FontStyle.Bold);
                    fallbackText.color = new Color(1f, 0.90f, 0.68f, 0.95f);
                    fallbackText.raycastTarget = false;
                }
            }
            else if (!player.revealed && !string.IsNullOrWhiteSpace(player.markedRoleId))
            {
                RenderMarkedRoleBadge(root.transform, player);
            }
            if (!player.alive)
            {
                var shroud = AddImage("Shroud", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-52f, -112f), new Vector2(12f, -18f), Color.white);
                shroud.sprite = SpriteFromResource("Botc/ui/shroud1");
                shroud.preserveAspect = true;
                shroud.raycastTarget = false;
            }
            var suspicion = AddPanel("Suspicion", root.transform, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-66f, -28f), new Vector2(-14f, -5f), new Color(0.025f, 0.019f, 0.014f, 0.84f));
            AddFrame(suspicion.transform, "Suspicion Frame", 0.9f, SuspicionColor(player.suspicion));
            AddText("Suspicion Text", suspicion.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, player.suspicion > 0 ? $"{player.suspicion}%" : "--", 15, TextAnchor.MiddleCenter, FontStyle.Bold).color = Color.white;
            var namePlate = AddPanel("Name Plate", root.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-78f, 56f), new Vector2(78f, 88f), new Color(0.12f, 0.060f, 0.024f, 0.92f));
            AddFrame(namePlate.transform, "Name Plate Frame", 0.9f, new Color(0.96f, 0.68f, 0.34f, 0.28f));
            AddText("Name", namePlate.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, player.name, 20, TextAnchor.MiddleCenter, FontStyle.Bold);
            var roleLabel = player.revealed ? player.roleName : "未知";
            if (!string.IsNullOrWhiteSpace(player.markedRoleName) && !player.revealed) roleLabel = $"标记：{player.markedRoleName}";
            var role = AddText("Role Label", root.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-104f, 20f), new Vector2(104f, 52f), roleLabel, 17, TextAnchor.MiddleCenter, FontStyle.Normal);
            role.color = new Color(0.98f, 0.90f, 0.78f, player.revealed ? 0.95f : 0.74f);
            RenderReminders(root.transform, player.reminders);
        }

        private void RenderMarkedRoleBadge(Transform tokenRoot, PlayerViewModel player)
        {
            var role = RoleForId(player.markedRoleId);
            var badge = AddImage("Marked Role Badge", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(28f, -120f), new Vector2(82f, -66f), new Color(0.018f, 0.014f, 0.010f, 0.92f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            var halo = AddImage("Marked Role Halo", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(24f, -124f), new Vector2(86f, -62f), RoleHaloColor(role?.category, role?.team, true));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            var icon = AddImage("Marked Role Icon", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(35f, -112f), new Vector2(75f, -74f), Color.white);
            icon.sprite = SpriteFromResource($"Botc/roles/{player.markedRoleId}");
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            if (icon.sprite == null)
            {
                icon.color = new Color(1f, 1f, 1f, 0f);
                var label = AddText("Marked Role Fallback", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(36f, -112f), new Vector2(76f, -74f), RoleFallbackLabel(player.markedRoleId, player.markedRoleName), 16, TextAnchor.MiddleCenter, FontStyle.Bold);
                label.color = new Color(1f, 0.88f, 0.56f, 0.98f);
                label.raycastTarget = false;
            }
            var mark = AddText("Marked Role Tag", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(18f, -75f), new Vector2(50f, -51f), "标", 11, TextAnchor.MiddleCenter, FontStyle.Bold);
            mark.color = new Color(0.98f, 0.82f, 0.44f, 1f);
            mark.raycastTarget = false;
        }

        private void RenderReminders(Transform tokenRoot, string[] reminders)
        {
            if (reminders == null || reminders.Length == 0) return;
            for (var i = 0; i < reminders.Length && i < 5; i++)
            {
                var x = -80f + i * 40f;
                var y = i < 3 ? -140f : -184f;
                var reminder = AddImage($"Reminder {i}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(x - 22f, y - 22f), new Vector2(x + 22f, y + 22f), Color.white);
                reminder.sprite = SpriteFromResource("Botc/ui/reminder1");
                reminder.preserveAspect = true;
                reminder.raycastTarget = false;
                AddText("Reminder Text", reminder.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, ReminderShort(reminders[i]), 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = Color.white;
            }
        }

        private void RenderBluffs()
        {
            var panel = AddPanel("Bluffs", grimoireRoot, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(30f, 42f), new Vector2(380f, 142f), new Color(0.02f, 0.017f, 0.013f, 0.64f));
            AddFrame(panel.transform, "Bluffs Frame", 1f, new Color(0.82f, 0.56f, 0.25f, 0.25f));
            AddText("Bluff Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 104f), new Vector2(-18f, -6f), "恶魔的伪装", 23, TextAnchor.UpperCenter, FontStyle.Bold);
            var body = AddText("Bluff Body", panel.transform, Vector2.zero, Vector2.one, new Vector2(20f, 16f), new Vector2(-20f, -44f), BuildBluffText(), 18, TextAnchor.MiddleCenter, FontStyle.Normal);
            body.color = new Color(0.98f, 0.91f, 0.78f, 0.94f);
        }

        private void ShowTokenDialogue(PlayerViewModel player)
        {
            selectedPlayerId = player.id ?? "";
            SendUnityAction("select-token", selectedPlayerId, "", "", "", trackPending: false);
            tokenInspectorOpen = true;
            UpdateTokenInspectorText(player);
            ApplyTokenInspectorVisibility();
            if (vm.phase == "day" && vm.dayStage == "private" && !player.human)
            {
                OpenPrivateChatPanel();
                dialogueTitle.text = $"私聊 · {player.name}";
                dialogueBody.text = "已打开私聊面板。选中 token 只作为本地目标，不再等待 JS Core 选中同步。";
            }
            else
            {
                dialogueTitle.text = $"已选中 · {player.name}";
                dialogueBody.text = player.human
                    ? "这是主视角 token。详情已移到左下 Inspector；底部继续保留阶段目标和常用行动。"
                    : $"详情见左下 Inspector。可直接使用底部：私聊、提名、投票或行动。";
            }
            if (privateChatPanel != null && privateChatPanel.gameObject.activeSelf) UpdatePrivateChatPanelText();
            bottomDockOpen = true;
            ApplyBottomDockVisibility();
        }

        private void UpdateTokenInspectorText(PlayerViewModel explicitPlayer = null)
        {
            if (tokenInspectorTitle == null || tokenInspectorBody == null) return;
            var player = explicitPlayer ?? SelectedPlayer();
            if (player == null)
            {
                tokenInspectorTitle.text = "目标详情";
                tokenInspectorBody.text = "点击魔典 token 查看公开可见信息。";
                return;
            }

            tokenInspectorTitle.text = $"目标 · {player.name}";
            var role = player.revealed
                ? string.IsNullOrWhiteSpace(player.roleName) ? "未知" : player.roleName
                : !string.IsNullOrWhiteSpace(player.markedRoleName) ? $"标记：{player.markedRoleName}" : "未知";
            var state = $"{(player.alive ? "存活" : "死亡")} / {(player.ghostVoteAvailable ? "有鬼票" : "无鬼票")}";
            var lines = new List<string>
            {
                $"身份：{role}",
                $"状态：{state}",
                $"怀疑：{player.suspicion}%",
            };
            if (!string.IsNullOrWhiteSpace(player.perceivedRoleId) && player.human) lines.Add($"你的认知角色：{RoleNameForId(player.perceivedRoleId)}");
            if (player.reminders != null && player.reminders.Length > 0) lines.Add($"提醒物：{string.Join(" / ", player.reminders.Take(5))}");
            lines.Add("");
            lines.Add(player.human ? "主视角 token：行动会以这个视角提交。" : "快捷：私聊 / 提名 / 行动。");
            lines.Add(player.revealed ? "身份已公开，可在魔典中直接查看。" : "未公开身份不会泄露真实底牌。");
            tokenInspectorBody.text = ClampTextLines(lines, 9, 44);
        }

        private PlayerViewModel SelectedPlayer()
        {
            if (string.IsNullOrWhiteSpace(selectedPlayerId)) return null;
            return (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && player.id == selectedPlayerId);
        }

        private PlayerViewModel SelectedPrivateChatTarget()
        {
            var player = SelectedPlayer();
            return player != null && !player.human ? player : null;
        }

        private void SelectDialoguePreset(string mode)
        {
            CloseMoreActionsPanel();
            if (mode == "private")
            {
                dialogueTitle.text = "私聊面板";
                if (SelectedPrivateChatTarget() == null)
                {
                    OpenPrivateChatPanel();
                    dialogueBody.text = "先在私聊面板右侧选择目标，或直接点击魔典中的非主视角 token。";
                    return;
                }
                OpenPrivateChatPanel();
                dialogueBody.text =
                    $"已打开与 {NameForPlayerId(selectedPlayerId)} 的私聊面板。历史和本次发送内容都在弹窗内。";
                return;
            }
            if (mode == "ask-claim")
            {
                dialogueTitle.text = "私聊：询问身份";
                if (SelectedPrivateChatTarget() == null)
                {
                    OpenPrivateChatPanel();
                    dialogueBody.text = "先选择私聊目标，再询问身份。";
                    return;
                }
                SendUnityAction("private-chat", selectedPlayerId, "", "你是什么身份？", "claim");
                dialogueBody.text = string.IsNullOrWhiteSpace(vm.privateDeceptionText)
                    ? "已发送给 JS Core：询问选中玩家的身份说法，等待视图刷新。"
                    : $"已发送给 JS Core：询问选中玩家的身份说法。\n{vm.privateDeceptionText}";
                return;
            }
            if (mode == "public")
            {
                dialogueTitle.text = "公聊请求";
                SendUnityAction("public-discussion", "", "public", "", "");
                dialogueBody.text = BuildTimelineText();
                return;
            }
            if (mode == "nomination")
            {
                dialogueTitle.text = "提名请求";
                OpenVotePanel();
                if (vm.phase != "day" || vm.dayStage != "nomination")
                {
                    RequestPhaseStage("nomination", "进入提名");
                    return;
                }
                SendUnityAction("nomination", selectedPlayerId, "", "", "");
                dialogueBody.text = string.IsNullOrWhiteSpace(selectedPlayerId)
                    ? "已请求进入提名阶段。请选择一名 token，再次点击提名。"
                    : "已发送给 JS Core：提名选中玩家，等待投票刷新。";
                return;
            }
            if (mode == "vote-panel")
            {
                OpenVotePanel();
                dialogueTitle.text = "投票仪式";
                dialogueBody.text = vm.voteCeremony == null ? "当前还没有投票结果。先进入提名并选择被提名者。" : vm.voteCeremony.resultText;
                return;
            }
            if (mode == "night")
            {
                dialogueTitle.text = "夜间行动请求";
                OpenActionFormPanel("night-action");
                dialogueBody.text = string.IsNullOrWhiteSpace(vm.nightActionText)
                    ? "已打开夜间行动表单。当前没有可用夜间行动时，JS Core 会给出原因。"
                    : vm.nightActionText;
                return;
            }
            if (mode == "day")
            {
                dialogueTitle.text = "白天行动请求";
                OpenActionFormPanel("day-action");
                dialogueBody.text = string.IsNullOrWhiteSpace(vm.dayActionText)
                    ? "已打开白天行动表单。若当前阶段不可用，JS Core 会给出原因。"
                    : vm.dayActionText;
                return;
            }
            if (mode == "storyteller")
            {
                dialogueTitle.text = "Storyteller 行动";
                OpenStorytellerPanel();
                dialogueBody.text = string.IsNullOrWhiteSpace(vm.storytellerActionText)
                    ? "已打开 Storyteller 队列面板。当前没有队列时，JS Core 会给出原因。"
                    : vm.storytellerActionText;
                return;
            }
            if (mode == "grimoire")
            {
                dialogueTitle.text = "魔典视角";
                SendUnityAction("toggle-grimoire");
                dialogueBody.text = "已发送给 JS Core：切换全知魔典视角。注意：非全知且非恶魔时，恶魔伪装会保持隐藏。";
                return;
            }
            if (mode == "handbook")
            {
                dialogueTitle.text = "剧本手册";
                SendUnityAction("script-handbook", "", "", "", "", "", "", "", "", false, "open");
                OpenHandbookPanel();
                dialogueBody.text = "已打开正式剧本手册。";
                return;
            }
            if (mode == "new-game")
            {
                dialogueTitle.text = "新局";
                SendUnityAction("new-game");
                dialogueBody.text = "已发送给 JS Core：创建新局并重新导出 Unity viewmodel。";
                return;
            }
            if (mode == "reminder")
            {
                dialogueTitle.text = "提醒物编辑";
                if (string.IsNullOrWhiteSpace(selectedPlayerId))
                {
                    dialogueBody.text = "请先点击一个 token，再添加提醒物。";
                    return;
                }
                SendUnityAction("grimoire-reminder", selectedPlayerId, "", "", "", "Guard", "");
                dialogueBody.text = "已发送给 JS Core：给选中 token 添加“守护”提醒物。下一步会改成正式提醒物选择器。";
                return;
            }
            if (mode == "mark-role")
            {
                dialogueTitle.text = "魔典标记";
                OpenGrimoireRoleMarkPicker();
                return;
            }
            if (mode == "decept-claim")
            {
                dialogueTitle.text = "私聊骗人：声称身份";
                if (SelectedPrivateChatTarget() == null)
                {
                    OpenPrivateChatPanel();
                    dialogueBody.text = "先选择私聊目标，再选择要私下声称的身份。";
                    return;
                }
                OpenPrivateChatPanel();
                if (string.IsNullOrWhiteSpace(SelectedPrivateClaimRoleId())) SetPrivateClaimRole(DefaultClaimRoleId());
                OpenPrivateClaimRolePicker();
                dialogueBody.text = $"请选择要向 {NameForPlayerId(selectedPlayerId)} 私下声称的身份；确认后回到私聊面板点击“发送私聊”。\n{vm.privateDeceptionText}";
                return;
            }
            if (mode == "decept-night")
            {
                dialogueTitle.text = "私聊骗人：编夜间信息";
                if (SelectedPrivateChatTarget() == null)
                {
                    OpenPrivateChatPanel();
                    dialogueBody.text = "先选择私聊目标，再发送夜间信息说法。";
                    return;
                }
                OpenPrivateChatPanel();
                SendUnityAction("private-chat", selectedPlayerId, "", "我昨晚拿到了一条需要你帮我判断的信息。", "night", nightInfo: "我昨晚的信息指向你和相邻玩家之间至少有一条重要线索。");
                dialogueBody.text = $"已发送给 JS Core：向选中玩家私下编造夜间信息。\n{vm.privateDeceptionText}";
                return;
            }
            if (mode == "decept-secret")
            {
                dialogueTitle.text = "私聊骗人：请求保密";
                if (SelectedPrivateChatTarget() == null)
                {
                    OpenPrivateChatPanel();
                    dialogueBody.text = "先选择私聊目标，再请求对方保密。";
                    return;
                }
                OpenPrivateChatPanel();
                SendUnityAction("private-chat", selectedPlayerId, "", "这条线索先不要公开，我们先互相验证。", "trust", askSecret: true);
                dialogueBody.text = $"已发送给 JS Core：请求选中玩家暂时保密。\n{vm.privateDeceptionText}";
                return;
            }
            dialogueTitle.text = "对话时间线";
            dialogueBody.text = BuildTimelineText();
        }

        private void SelectPrimaryAction()
        {
            CloseMoreActionsPanel();
            var forms = vm.actionForms ?? Array.Empty<ActionFormViewModel>();
            if (forms.Any((entry) => entry != null && entry.id == "storyteller-action" && entry.available))
            {
                SelectDialoguePreset("storyteller");
                return;
            }
            if (vm.phase == "night" || forms.Any((entry) => entry != null && entry.id == "night-action" && entry.available))
            {
                SelectDialoguePreset("night");
                return;
            }
            if (forms.Any((entry) => entry != null && entry.id == "day-action" && entry.available) || vm.phase == "day")
            {
                SelectDialoguePreset("day");
                return;
            }
            SelectDialoguePreset("storyteller");
        }

        private void CyclePhase(string direction)
        {
            if (direction == "prev")
            {
                ShowPhaseGuardMessage("阶段不能回退", "JS Core 当前只支持向前推进。需要复盘时请使用日志、时间线或全知视角。");
                return;
            }
            RequestPhaseStage(NextPhaseStageFromViewModel(), "下一阶段");
        }

        private string NextPhaseStageFromViewModel()
        {
            var guarded = vm?.phaseAdvance?.targetStage;
            if (!string.IsNullOrWhiteSpace(guarded)) return guarded;
            if (vm?.phase == "night") return "day";
            if (vm?.dayStage == "private") return "public";
            if (vm?.dayStage == "public") return "nomination";
            if (vm?.dayStage == "nomination") return "night";
            return "public";
        }

        private void RequestPhaseStage(string stage, string label)
        {
            var guard = vm?.phaseAdvance;
            if (guard != null && !string.IsNullOrWhiteSpace(guard.targetStage) && guard.targetStage != stage)
            {
                ShowPhaseGuardMessage(label, $"不能跳过阶段。下一步应先执行：{FirstNonEmpty(guard.label, guard.targetStage)}。");
                return;
            }
            if (guard != null && guard.blocked)
            {
                ShowPhaseGuardMessage(label, FirstNonEmpty(guard.reason, guard.hint, "当前阶段还不能推进。"));
                FocusPhaseBlocker(guard.reason);
                return;
            }
            var needsConfirm = guard != null && guard.requiresConfirm;
            if (needsConfirm && (pendingPhaseConfirmStage != stage || Time.realtimeSinceStartup > pendingPhaseConfirmUntil))
            {
                pendingPhaseConfirmStage = stage;
                pendingPhaseConfirmUntil = Time.realtimeSinceStartup + 5f;
                ShowPhaseGuardMessage(label, $"{FirstNonEmpty(guard.reason, "还有可选事项未处理。")}\n{FirstNonEmpty(guard.hint, "再次点击确认继续。")}");
                return;
            }
            pendingPhaseConfirmStage = "";
            pendingPhaseConfirmUntil = -1f;
            ShowPhaseGuardMessage(label, "已发送给 JS Core；阶段切换成功后界面会自动刷新。");
            SendUnityAction("phase", "", stage, "", "", "", "", "", "", false, needsConfirm ? "confirm" : "");
        }

        private void ShowPhaseGuardMessage(string title, string body)
        {
            CloseMoreActionsPanel();
            dialogueTitle.text = title;
            dialogueBody.text = ClampTextBlock(body, 4, 54);
            if (objectiveHintText != null) objectiveHintText.text = ClampTextBlock(body, 2, 38);
            UpdateSyncStatusText();
        }

        private void FocusPhaseBlocker(string reason)
        {
            var text = reason ?? "";
            if (text.Contains("Storyteller"))
            {
                OpenStorytellerPanel();
                return;
            }
            if (text.Contains("夜间") || text.Contains("下一夜"))
            {
                OpenActionFormPanel("night-action");
                return;
            }
            if (text.Contains("白天行动"))
            {
                OpenActionFormPanel("day-action");
            }
        }

        private string MoodFromState()
        {
            if (vm.phase == "night") return "night";
            return vm.dayStage == "nomination" ? "ceremony" : "day";
        }

        private void SetMood(string nextMood)
        {
            var clipName = nextMood == "night" ? "Where_Shadows_Scratch_Stone" : nextMood == "ceremony" ? "Gavel_in_the_Square" : "When_the_Clock_Stops";
            var clip = Resources.Load<AudioClip>($"Botc/audio/{clipName}");
            if (clip == null || musicSource == null) return;
            if (currentMood == nextMood && musicSource.clip == clip)
            {
                if (!musicSource.isPlaying) musicSource.Play();
                return;
            }
            currentMood = nextMood;
            musicSource.clip = clip;
            musicSource.Play();
        }

        private string PhaseLabel()
        {
            if (!string.IsNullOrWhiteSpace(vm.phaseLabel)) return vm.phaseLabel;
            if (vm.phase == "night") return "夜间行动";
            if (vm.dayStage == "nomination") return "提名 / 投票 / 处决";
            if (vm.dayStage == "public") return "公聊辩论";
            return "私聊阶段";
        }

        private string LatestEvent()
        {
            var events = vm.events ?? Array.Empty<string>();
            return events.Length == 0 ? "最近事件：等待玩家行动" : $"最近事件：{events[events.Length - 1]}";
        }

        private string BuildEventText()
        {
            var events = vm.events ?? Array.Empty<string>();
            if (events.Length == 0) return "暂无事件。";
            var start = Mathf.Max(0, events.Length - 9);
            var lines = new List<string> { "最近事件", "────────" };
            for (var i = start; i < events.Length; i++) lines.Add($"- {events[i]}");
            return string.Join("\n", lines);
        }

        private string BuildQueueText()
        {
            if (vm.scriptHandbook != null && vm.scriptHandbook.open) return BuildHandbookText();
            var queue = vm.storytellerQueue ?? Array.Empty<string>();
            if (queue.Length == 0) return "说书人队列：暂无待处理行动。";
            var lines = new List<string> { $"说书人队列：{queue.Length} 项" };
            for (var i = 0; i < queue.Length && i < 5; i++) lines.Add($"{i + 1}. {queue[i]}");
            return string.Join("\n", lines);
        }

        private string InfoDrawerTitle()
        {
            if (infoDrawerTab == "timeline") return "资料抽屉 · 时间";
            if (infoDrawerTab == "handbook") return "资料抽屉 · 手册";
            if (infoDrawerTab == "recap") return "资料抽屉 · 复盘";
            return "资料抽屉 · 日志";
        }

        private void UpdateInfoDrawerTabs()
        {
            SetInfoTabStyle(eventTabText, "events", "日志");
            SetInfoTabStyle(timelineTabText, "timeline", "时间");
            SetInfoTabStyle(handbookTabText, "handbook", "手册");
            SetInfoTabStyle(recapTabText, "recap", "复盘");
        }

        private void SetInfoTabStyle(Text label, string tab, string title)
        {
            if (label == null) return;
            var active = infoDrawerTab == tab;
            label.text = active ? $"◆ {title}" : title;
            label.color = active ? new Color(1f, 0.82f, 0.42f, 1f) : new Color(0.86f, 0.78f, 0.64f, 0.86f);
            label.fontStyle = active ? FontStyle.Bold : FontStyle.Normal;
        }

        private string BuildInfoDrawerMainText()
        {
            if (infoDrawerTab == "timeline") return BuildTimelineOnlyText();
            if (infoDrawerTab == "handbook") return BuildHandbookText();
            if (infoDrawerTab == "recap") return BuildRecapText();
            return BuildEventText();
        }

        private string BuildInfoDrawerSubText()
        {
            if (infoDrawerTab == "handbook")
            {
                var roles = vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>();
                var townsfolk = roles.Count((entry) => entry.category == "townsfolk");
                var outsider = roles.Count((entry) => entry.category == "outsider");
                var minion = roles.Count((entry) => entry.category == "minion");
                var demon = roles.Count((entry) => entry.category == "demon");
                return $"角色数：{roles.Length}  民 {townsfolk} / 外 {outsider} / 爪 {minion} / 恶 {demon}";
            }
            if (infoDrawerTab == "recap")
            {
                var count = vm.aiRecapDetails?.Length ?? 0;
                return $"AI 条目：{count}  ·  来源：JS Core belief trail";
            }
            return BuildQueueText();
        }

        private string BuildHandbookText()
        {
            var handbook = vm.scriptHandbook;
            if (handbook == null) return "剧本手册不可用。";
            var lines = new List<string> { $"{handbook.scriptName}", "────────", "首夜顺序" };
            var first = handbook.firstNightOrder ?? Array.Empty<string>();
            lines.Add(ShortOrder(first));
            lines.Add("");
            lines.Add("其他夜晚");
            var other = handbook.otherNightOrder ?? Array.Empty<string>();
            lines.Add(ShortOrder(other));
            lines.Add("");
            lines.Add("角色预览");
            var grouped = (handbook.roles ?? Array.Empty<ScriptRoleViewModel>())
                .GroupBy((role) => role.category ?? "")
                .OrderBy((group) => CategorySort(group.Key));
            foreach (var group in grouped)
            {
                var names = string.Join(" / ", group.Take(4).Select((role) => role.name));
                lines.Add($"{CategoryLabel(group.Key)}：{names}");
            }
            return string.Join("\n", lines);
        }

        private string BuildTimelineText()
        {
            var timeline = vm.timeline ?? Array.Empty<TimelineEntryViewModel>();
            var start = Mathf.Max(0, timeline.Length - 8);
            var lines = new List<string>();
            for (var i = start; i < timeline.Length; i++)
            {
                var item = timeline[i];
                var speaker = NameForPlayerId(item.speakerId);
                var target = NameForPlayerId(item.targetId);
                var arrow = string.IsNullOrWhiteSpace(item.targetId) ? "" : $" -> {target}";
                lines.Add($"[{TimelineModeLabel(item.mode)}] {speaker}{arrow}: {item.text}");
            }
            if (vm.aiRecap != null && vm.aiRecap.Length > 0)
            {
                if (lines.Count > 0) lines.Add("");
                lines.Add("AI 复盘摘要：");
                for (var i = 0; i < vm.aiRecap.Length && i < 4; i++) lines.Add($"- {vm.aiRecap[i]}");
            }
            if (vm.aiRecapDetails != null && vm.aiRecapDetails.Length > 0)
            {
                var detail = vm.aiRecapDetails[0];
                lines.Add("");
                lines.Add($"首位 AI 证据簿：{detail.name} -> {detail.target} {detail.score}");
                var targets = detail.targets ?? Array.Empty<AiRecapTargetViewModel>();
                if (targets.Length > 0)
                {
                    var target = targets[0];
                    lines.Add($"{target.name}：{target.reason}");
                    var trail = target.trail ?? Array.Empty<AiTrailViewModel>();
                    for (var i = 0; i < trail.Length && i < 2; i++)
                    {
                        lines.Add($"  {trail[i].evidenceKind} {trail[i].before:0}%->{trail[i].after:0}% {trail[i].reason}");
                    }
                }
            }
            if (lines.Count == 0) return "暂无公聊 / 私聊时间线。";
            return string.Join("\n", lines);
        }

        private string BuildTimelineOnlyText()
        {
            var timeline = vm.timeline ?? Array.Empty<TimelineEntryViewModel>();
            if (timeline.Length == 0) return "暂无公聊 / 私聊时间线。";
            var start = Mathf.Max(0, timeline.Length - 12);
            var lines = new List<string> { "最近对话", "────────" };
            for (var i = start; i < timeline.Length; i++)
            {
                var item = timeline[i];
                var speaker = NameForPlayerId(item.speakerId);
                var target = NameForPlayerId(item.targetId);
                var arrow = string.IsNullOrWhiteSpace(item.targetId) ? "" : $" -> {target}";
                lines.Add($"[{TimelineModeLabel(item.mode)}] {speaker}{arrow}: {item.text}");
            }
            return ClampTextLines(lines, 14, 48);
        }

        private string BuildPrivateHistoryText()
        {
            if (string.IsNullOrWhiteSpace(selectedPlayerId)) return "选择一名玩家后显示最近私聊。";
            var lines = PrivateTimelineEntriesForSelected().Select(FormatPrivateHistoryLine).ToList();
            if (lines.Count == 0) return $"暂无与 {NameForPlayerId(selectedPlayerId)} 的私聊记录。";
            return ClampTextLines(lines.Skip(Mathf.Max(0, lines.Count - 8)), 8, 86);
        }

        private List<TimelineEntryViewModel> PrivateTimelineEntriesForSelected()
        {
            var entries = new List<TimelineEntryViewModel>();
            if (string.IsNullOrWhiteSpace(selectedPlayerId)) return entries;
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            foreach (var item in vm.timeline ?? Array.Empty<TimelineEntryViewModel>())
            {
                if (item == null || !IsPrivateTimelineEntry(item.mode)) continue;
                var selectedSpeaksToHuman = item.speakerId == selectedPlayerId && (string.IsNullOrWhiteSpace(item.targetId) || item.targetId == humanId);
                var humanSpeaksToSelected = !string.IsNullOrWhiteSpace(humanId) && item.speakerId == humanId && item.targetId == selectedPlayerId;
                var selectedIsTarget = item.targetId == selectedPlayerId;
                if (selectedSpeaksToHuman || humanSpeaksToSelected || selectedIsTarget) entries.Add(item);
            }
            return entries;
        }

        private string FormatPrivateHistoryLine(TimelineEntryViewModel item)
        {
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            var speaker = item.speakerId == humanId ? "你" : NameForPlayerId(item.speakerId);
            var target = string.IsNullOrWhiteSpace(item.targetId) ? "" : item.targetId == humanId ? " -> 你" : $" -> {NameForPlayerId(item.targetId)}";
            return $"{TimelineStamp(item)} {speaker}{target}：{item.text}";
        }

        private static bool IsPrivateTimelineEntry(string mode)
        {
            if (string.IsNullOrWhiteSpace(mode)) return false;
            return mode.IndexOf("whisper", StringComparison.OrdinalIgnoreCase) >= 0
                || mode.IndexOf("private", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string TimelineStamp(TimelineEntryViewModel item)
        {
            if (item == null) return "";
            if (item.day > 0) return $"D{item.day}";
            if (item.night > 0) return $"N{item.night}";
            return "时间线";
        }

        private string BuildRecapText()
        {
            var outcomeLines = new List<string>();
            if (IsGameOver())
            {
                outcomeLines.Add("终局结果");
                outcomeLines.Add("────────");
                outcomeLines.Add($"{OutcomeWinnerLabel()}胜利");
                var reason = FirstNonEmpty(vm?.winnerReason, vm?.outcome?.reason);
                if (!string.IsNullOrWhiteSpace(reason)) outcomeLines.Add(reason);
                outcomeLines.Add($"结束于 D{vm.day}/N{vm.night} · 存活 {vm.alive} · 死亡 {vm.dead}");
                outcomeLines.Add("");
            }
            var details = vm.aiRecapDetails ?? Array.Empty<AiRecapViewModel>();
            if (details.Length == 0)
            {
                var recap = vm.aiRecap != null && vm.aiRecap.Length > 0 ? $"AI 摘要\n────────\n{string.Join("\n", vm.aiRecap.Take(8).Select((entry) => $"- {entry}"))}" : "暂无 AI 复盘摘要。";
                return outcomeLines.Count > 0 ? ClampTextLines(outcomeLines.Concat(new[] { recap }), 14, 52) : recap;
            }
            var lines = new List<string>();
            lines.AddRange(outcomeLines);
            lines.Add("AI 推理摘要");
            lines.Add("────────");
            foreach (var detail in details.Take(3))
            {
                lines.Add($"{detail.name} -> {detail.target} {detail.score}");
                lines.Add($"  {detail.reason}");
                var top = detail.targets?.FirstOrDefault();
                if (top != null)
                {
                    lines.Add($"  关注 {top.name}：{top.reason}");
                    var trail = top.trail ?? Array.Empty<AiTrailViewModel>();
                    foreach (var entry in trail.TakeLast(2))
                    {
                        lines.Add($"    {entry.evidenceKind} {entry.before:0}%->{entry.after:0}% {entry.reason}");
                    }
                }
            }
            return ClampTextLines(lines, 14, 48);
        }

        private static int CategorySort(string category)
        {
            if (category == "townsfolk") return 0;
            if (category == "outsider") return 1;
            if (category == "minion") return 2;
            if (category == "demon") return 3;
            return 9;
        }

        private static string CategoryLabel(string category)
        {
            if (category == "townsfolk") return "镇民";
            if (category == "outsider") return "外来者";
            if (category == "minion") return "爪牙";
            if (category == "demon") return "恶魔";
            return "其他";
        }

        private static string TeamLabel(string team)
        {
            if (team == "good") return "善良";
            if (team == "evil") return "邪恶";
            return string.IsNullOrWhiteSpace(team) ? "未知阵营" : team;
        }

        private string RoleHandbookTag(ScriptRoleViewModel role)
        {
            if (role == null) return "";
            var players = vm.players ?? Array.Empty<PlayerViewModel>();
            if (players.Any((player) => player.human && (player.roleId == role.id || player.perceivedRoleId == role.id))) return " · 你";
            if (players.Any((player) => player.markedRoleId == role.id || player.markedRoleName == role.name)) return " · 标";
            return "";
        }

        private string RoleHandbookUseLine(ScriptRoleViewModel role)
        {
            var tag = RoleHandbookTag(role);
            if (tag.Contains("你")) return "提示：这是主视角相关身份。";
            if (tag.Contains("标")) return "提示：已有 token 使用这个魔典标记。";
            return "提示：点击左侧角色可切换详情；手册不读取隐藏真相。";
        }

        private static string ShortOrder(string[] order)
        {
            if (order == null || order.Length == 0) return "暂无";
            var values = order.Where((item) => !string.IsNullOrWhiteSpace(item)).ToArray();
            if (values.Length == 0) return "暂无";
            var lines = new List<string>();
            for (var i = 0; i < values.Length; i += 5)
            {
                lines.Add(string.Join(" / ", values.Skip(i).Take(5)));
            }
            return string.Join("\n      ", lines);
        }

        private static int CountCategory(Dictionary<string, int> counts, string category)
        {
            return counts != null && counts.TryGetValue(category, out var value) ? value : 0;
        }

        private string BuildBluffText()
        {
            var bluffs = vm.bluffs ?? Array.Empty<string>();
            return bluffs.Length == 0 ? "暂无伪装" : string.Join("     ", bluffs);
        }

        private bool HasPendingAction()
        {
            return !string.IsNullOrWhiteSpace(pendingActionId) && pendingActionStartedAt >= 0f;
        }

        private bool IsPendingPrivateChat()
        {
            return HasPendingAction() && (pendingActionType == "private-chat" || pendingActionType == "private-preset");
        }

        private bool IsPendingPrivateChatForTarget(PlayerViewModel target)
        {
            return target != null
                && IsPendingPrivateChat()
                && (string.IsNullOrWhiteSpace(pendingActionPlayerId) || pendingActionPlayerId == target.id);
        }

        private float PendingActionElapsed()
        {
            return HasPendingAction() ? Mathf.Max(0f, Time.realtimeSinceStartup - pendingActionStartedAt) : 0f;
        }

        private bool PendingActionTimedOut()
        {
            return HasPendingAction() && PendingActionElapsed() >= BridgeTimeoutSeconds;
        }

        private void UpdateSyncStatusText()
        {
            if (syncStatusText == null) return;
            syncStatusText.text = BuildSyncStatusLine(true);
            syncStatusText.color = SyncStatusColor();
            if (syncStatusPill != null) syncStatusPill.color = SyncStatusPillColor();
        }

        private Color SyncStatusColor()
        {
            if (PendingActionTimedOut()) return new Color(1f, 0.48f, 0.32f, 1f);
            if (HasPendingAction()) return new Color(1f, 0.78f, 0.36f, 1f);
            if (vm?.action != null && string.Equals(vm.action.status, "error", StringComparison.OrdinalIgnoreCase)) return new Color(1f, 0.42f, 0.36f, 1f);
            return new Color(0.72f, 0.92f, 0.78f, 0.95f);
        }

        private Color SyncStatusPillColor()
        {
            if (PendingActionTimedOut()) return new Color(0.30f, 0.050f, 0.035f, 0.70f);
            if (HasPendingAction()) return new Color(0.24f, 0.17f, 0.035f, 0.64f);
            if (vm?.action != null && string.Equals(vm.action.status, "error", StringComparison.OrdinalIgnoreCase)) return new Color(0.28f, 0.045f, 0.040f, 0.68f);
            return new Color(0.035f, 0.105f, 0.070f, 0.58f);
        }

        private string BuildSyncStatusLine(bool compact)
        {
            if (HasPendingAction())
            {
                var label = ActionTypeLabel(pendingActionType);
                if (PendingActionTimedOut())
                {
                    return compact
                        ? "同步超时：bridge 未响应"
                        : "同步告警：JS Core bridge 未处理上次操作；如果刚启动 exe，请等待几秒或确认本机 Node.js 可用。";
                }
                return compact
                    ? $"同步：{label}处理中 {PendingActionElapsed():0.0}s"
                    : $"同步：已写入 {label}，等待 JS Core 刷新 viewmodel（{PendingActionElapsed():0.0}s）。";
            }

            if (bridgeLaunchProblem && !string.IsNullOrWhiteSpace(bridgeLaunchStatus)) return bridgeLaunchStatus;
            if (vm?.action == null)
            {
                return string.IsNullOrWhiteSpace(bridgeLaunchStatus) ? "同步：未连接 JS Core" : bridgeLaunchStatus;
            }
            var status = string.IsNullOrWhiteSpace(vm.action.status) ? "idle" : vm.action.status;
            if (string.Equals(status, "error", StringComparison.OrdinalIgnoreCase))
            {
                var message = string.IsNullOrWhiteSpace(vm.action.message) ? "JS Core 返回错误" : vm.action.message;
                return compact ? $"同步错误：{Ellipsize(message, 18)}" : $"同步错误：{message}";
            }
            if (string.Equals(status, "ready", StringComparison.OrdinalIgnoreCase))
            {
                return compact ? "同步：JS Core 就绪" : "同步：JS Core bridge 已就绪，等待 Unity 操作。";
            }
            var actionLabel = ActionTypeLabel(vm.action.lastActionType);
            return compact
                ? $"同步：{actionLabel}已刷新 r{vm.action.revision}"
                : $"同步：JS Core 已处理 {actionLabel}，viewmodel revision {vm.action.revision}。";
        }

        private static string ActionTypeLabel(string type)
        {
            if (type == "select-token") return "选中";
            if (type == "private-chat" || type == "private-preset") return "私聊";
            if (type == "public-discussion" || type == "public") return "公聊";
            if (type == "phase") return "阶段";
            if (type == "nomination") return "提名";
            if (type == "night-action") return "夜间行动";
            if (type == "day-action") return "白天行动";
            if (type == "storyteller-action") return "说书人";
            if (type == "script-handbook") return "剧本手册";
            if (type == "toggle-grimoire") return "全知切换";
            if (type == "new-game") return "新局";
            if (type == "grimoire-reminder" || type == "grimoire-mark-role") return "魔典标记";
            return string.IsNullOrWhiteSpace(type) ? "操作" : type;
        }

        private static string Ellipsize(string value, int maxChars)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length <= maxChars) return value ?? "";
            return $"{value.Substring(0, Mathf.Max(1, maxChars - 1))}…";
        }

        private static string RoleIconFallbackLabel(PlayerViewModel player)
        {
            var roleName = player?.roleName ?? "";
            var paren = roleName.IndexOf("(", StringComparison.Ordinal);
            if (paren > 0) roleName = roleName.Substring(0, paren).Trim();
            if (!string.IsNullOrWhiteSpace(roleName)) return roleName.Substring(0, Mathf.Min(1, roleName.Length));
            var roleId = player?.roleId ?? "";
            return string.IsNullOrWhiteSpace(roleId) ? "?" : roleId.Substring(0, 1).ToUpperInvariant();
        }

        private static string RoleFallbackLabel(string roleId, string roleName)
        {
            if (!string.IsNullOrWhiteSpace(roleName)) return roleName.Substring(0, Mathf.Min(1, roleName.Length));
            return string.IsNullOrWhiteSpace(roleId) ? "?" : roleId.Substring(0, 1).ToUpperInvariant();
        }

        private static Color RoleHaloColor(string category, string team, bool selected)
        {
            if (selected) return new Color(1f, 0.76f, 0.30f, 0.96f);
            if (string.Equals(team, "evil", StringComparison.OrdinalIgnoreCase) || category == "minion" || category == "demon")
            {
                return category == "demon" ? new Color(0.72f, 0.05f, 0.10f, 0.86f) : new Color(0.78f, 0.10f, 0.18f, 0.74f);
            }
            if (category == "outsider") return new Color(0.18f, 0.45f, 0.92f, 0.72f);
            return new Color(0.16f, 0.50f, 0.95f, 0.76f);
        }

        private string BuildActionSummaryText()
        {
            var lines = new List<string>();
            lines.Add(BuildSyncStatusLine(true));
            var selected = SelectedPlayer();
            if (selected != null)
            {
                lines.Add($"当前目标：{selected.name}");
            }
            if (!string.IsNullOrWhiteSpace(vm.actionSummary))
            {
                var summaryLines = vm.actionSummary
                    .Split('\n')
                    .Where((line) => selected == null || (!line.Contains("未选中 token") && !line.TrimStart().StartsWith("选中 ", StringComparison.Ordinal)))
                    .ToArray();
                if (summaryLines.Length > 0) lines.Add(string.Join("\n", summaryLines));
            }
            if (vm.privateInfo != null && vm.privateInfo.Length > 0)
            {
                lines.Add($"私有信息：{vm.privateInfo[0]}");
            }
            var stageLine = FirstNonEmpty(vm.nominationText, vm.nightActionText, vm.dayActionText, vm.storytellerActionText);
            if (!string.IsNullOrWhiteSpace(stageLine)) lines.Add(stageLine);
            if (lines.Count == 0 && vm.action != null && !string.IsNullOrWhiteSpace(vm.action.message))
            {
                lines.Add(vm.action.message);
            }
            return lines.Count == 0 ? "行动状态：等待 Unity / JS Core 同步。" : ClampTextLines(lines, 4, 56);
        }

        private static string FirstNonEmpty(params string[] values)
        {
            return values?.FirstOrDefault((value) => !string.IsNullOrWhiteSpace(value)) ?? "";
        }

        private static string ClampTextLines(IEnumerable<string> chunks, int maxLines, int maxCharsPerLine)
        {
            var lines = new List<string>();
            foreach (var chunk in chunks)
            {
                foreach (var rawLine in (chunk ?? "").Split('\n'))
                {
                    var line = rawLine.TrimEnd();
                    if (line.Length > maxCharsPerLine) line = $"{line.Substring(0, maxCharsPerLine - 1)}…";
                    lines.Add(line);
                    if (lines.Count >= maxLines) return $"{string.Join("\n", lines)}\n…";
                }
            }
            return string.Join("\n", lines);
        }

        private static string ClampTextBlock(string value, int maxLines, int maxCharsPerLine)
        {
            return ClampTextLines(new[] { value ?? "" }, maxLines, maxCharsPerLine);
        }

        private static int PageCount(int itemCount, int pageSize)
        {
            var safePageSize = Mathf.Max(1, pageSize);
            return Mathf.Max(1, Mathf.CeilToInt(Mathf.Max(0, itemCount) / (float)safePageSize));
        }

        private static int ClampPage(int page, int itemCount, int pageSize)
        {
            return Mathf.Clamp(page, 0, PageCount(itemCount, pageSize) - 1);
        }

        private string BuildVoteCeremonyText()
        {
            var vote = vm.voteCeremony;
            if (vote == null || string.IsNullOrWhiteSpace(vote.nomineeId)) return "";
            var voters = vote.voters ?? Array.Empty<VoteViewModel>();
            var raised = voters.Where((entry) => entry.vote).Take(6).Select((entry) => entry.voterName);
            return $"投票仪式：{vote.nominatorName} -> {vote.nomineeName}\n{vote.resultText}\n举手：{string.Join(" / ", raised)}";
        }

        private string BuildActionFormsText()
        {
            var forms = vm.actionForms ?? Array.Empty<ActionFormViewModel>();
            var lines = new List<string>();
            foreach (var form in forms.Where((entry) => entry != null && entry.available).Take(2))
            {
                var options = form.options ?? Array.Empty<ActionOptionViewModel>();
                var roleOptions = form.roleOptions ?? Array.Empty<ActionRoleOptionViewModel>();
                var modes = form.modes ?? Array.Empty<ActionModeViewModel>();
                var selectable = options.Length > 0
                    ? string.Join(" / ", options.Take(4).Select((entry) => entry.name))
                    : roleOptions.Length > 0
                        ? string.Join(" / ", roleOptions.Take(4).Select((entry) => entry.name))
                        : modes.Length > 0
                            ? string.Join(" / ", modes.Take(4).Select((entry) => entry.label))
                            : "无需额外选择";
                lines.Add($"{form.title}表单：{form.roleName} [{form.inputType}] {form.minTargetCount}-{form.maxTargetCount} 项\n{form.prompt}\n可选：{selectable}");
            }
            return lines.Count == 0 ? "" : string.Join("\n", lines);
        }

        private string BuildMenuInfoText()
        {
            var queueCount = vm.storytellerQueue?.Length ?? 0;
            var timelineCount = vm.timeline?.Length ?? 0;
            var bluffs = vm.bluffs == null || vm.bluffs.Length == 0 ? "未知" : string.Join(" / ", vm.bluffs);
            return $"{DisplayScriptName()}\n"
                + $"D{vm.day}/N{vm.night} - {PhaseLabel()}\n"
                + $"存活 {vm.alive} - 死亡 {vm.dead}\n"
                + $"配置 {vm.setup}\n\n"
                + $"说书人队列：{queueCount} 项\n"
                + $"对话时间线：{timelineCount} 条\n"
                + $"恶魔伪装：{bluffs}\n\n"
                + "提示：进入魔典后，先选择 token，再使用行动托盘。";
        }

        private string DisplayScriptName()
        {
            var scriptName = string.IsNullOrWhiteSpace(vm.scriptName) ? "未知剧本" : vm.scriptName;
            var paren = scriptName.IndexOf(" (", StringComparison.Ordinal);
            return paren > 0 ? scriptName.Substring(0, paren) : scriptName;
        }

        private string NameForPlayerId(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return "全场";
            var players = vm.players ?? Array.Empty<PlayerViewModel>();
            foreach (var player in players) if (player.id == playerId) return player.name;
            return playerId == "storyteller" ? "说书人" : playerId;
        }

        private string DefaultClaimRoleId()
        {
            var roles = vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>();
            var human = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human);
            foreach (var role in roles)
            {
                if (string.IsNullOrWhiteSpace(role.id)) continue;
                if (role.id == human?.roleId || role.id == human?.perceivedRoleId) continue;
                if (role.category == "townsfolk" || role.team == "good") return role.id;
            }
            return roles.FirstOrDefault((role) => !string.IsNullOrWhiteSpace(role.id))?.id ?? "";
        }

        private string RoleNameForId(string roleId)
        {
            if (string.IsNullOrWhiteSpace(roleId)) return "未指定身份";
            var roles = vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>();
            foreach (var role in roles) if (role.id == roleId) return string.IsNullOrWhiteSpace(role.name) ? role.id : role.name;
            return roleId;
        }

        private ScriptRoleViewModel RoleForId(string roleId)
        {
            if (string.IsNullOrWhiteSpace(roleId)) return null;
            return (vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>()).FirstOrDefault((role) => role != null && role.id == roleId);
        }

        private void OpenPrivateClaimRolePicker()
        {
            activeRolePickerMode = "private-claim";
            activeRolePickerPlayerId = selectedPlayerId;
            RenderRolePickerPanel();
            if (rolePickerPanel != null) rolePickerPanel.gameObject.SetActive(true);
            ApplyModalBackdropVisibility();
        }

        private void OpenGrimoireRoleMarkPicker()
        {
            var target = SelectedPlayer();
            if (target == null)
            {
                dialogueTitle.text = "标记身份";
                dialogueBody.text = "请先选择一个 token，再打开角色图标标记器。";
                return;
            }
            activeRolePickerMode = "mark-role";
            activeRolePickerPlayerId = target.id;
            RenderRolePickerPanel();
            if (rolePickerPanel != null) rolePickerPanel.gameObject.SetActive(true);
            ApplyModalBackdropVisibility();
        }

        private void CloseRolePicker()
        {
            if (rolePickerPanel != null) rolePickerPanel.gameObject.SetActive(false);
            activeRolePickerMode = "";
            activeRolePickerPlayerId = "";
            ApplyModalBackdropVisibility();
        }

        private void RenderRolePickerPanel()
        {
            if (rolePickerGridRoot == null) return;
            for (var i = rolePickerGridRoot.childCount - 1; i >= 0; i--) Destroy(rolePickerGridRoot.GetChild(i).gameObject);
            AddFrame(rolePickerGridRoot, "Role Picker Grid Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));

            var roles = (vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>())
                .Where((role) => role != null && !string.IsNullOrWhiteSpace(role.id))
                .OrderBy((role) => CategorySort(role.category ?? ""))
                .ThenBy((role) => role.name ?? role.id ?? "")
                .ToArray();
            var target = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && player.id == activeRolePickerPlayerId);
            var selectedRoleId = activeRolePickerMode == "private-claim" ? SelectedPrivateClaimRoleId() : target?.markedRoleId ?? "";

            if (rolePickerTitle != null)
            {
                rolePickerTitle.text = activeRolePickerMode == "mark-role"
                    ? $"为玩家 {target?.name ?? "未选择"} 选择标记身份"
                    : "选择私聊声称身份";
            }
            if (rolePickerStatusText != null)
            {
                var currentRoleName = string.IsNullOrWhiteSpace(selectedRoleId)
                    ? (activeRolePickerMode == "mark-role" ? "未标记" : "不声称")
                    : RoleNameForId(selectedRoleId);
                rolePickerStatusText.text = activeRolePickerMode == "mark-role"
                    ? $"目标：{target?.name ?? "未选择"}  ·  当前标记：{currentRoleName}  ·  只进入你的魔典认知。"
                    : $"当前声称：{currentRoleName}  ·  点击角色 token 切换，也可以选择不声称。";
            }

            var columns = 11;
            var startX = 72f;
            var startY = 356f;
            var spacingX = 112f;
            var spacingY = 128f;
            for (var i = 0; i < roles.Length; i++)
            {
                var role = roles[i];
                var col = i % columns;
                var row = i / columns;
                var roleId = role.id;
                AddRoleTokenButton(
                    rolePickerGridRoot,
                    role.id,
                    role.name,
                    role.category,
                    role.team,
                    new Vector2(startX + col * spacingX, startY - row * spacingY),
                    76f,
                    selectedRoleId == role.id,
                    () => ApplyRolePickerChoice(roleId)
                );
            }

            var blankLabel = activeRolePickerMode == "mark-role" ? "清除" : "不声称";
            AddBlankRoleTokenButton(rolePickerGridRoot, blankLabel, new Vector2(startX + (roles.Length % columns) * spacingX, startY - (roles.Length / columns) * spacingY), 76f, string.IsNullOrWhiteSpace(selectedRoleId), () => ApplyRolePickerChoice(""));
        }

        private void ApplyRolePickerChoice(string roleId)
        {
            if (activeRolePickerMode == "private-claim")
            {
                SetPrivateClaimRole(roleId);
                privateChatStatus = string.IsNullOrWhiteSpace(roleId) ? "本次私聊不会主动声称身份。" : $"本次私聊声称身份：{RoleNameForId(roleId)}。";
                UpdatePrivateChatPanelText();
                CloseRolePicker();
                return;
            }
            if (activeRolePickerMode == "mark-role")
            {
                if (!string.IsNullOrWhiteSpace(activeRolePickerPlayerId))
                {
                    SendUnityAction("grimoire-mark-role", activeRolePickerPlayerId, "", "", "", "", roleId);
                    dialogueTitle.text = "魔典标记";
                    dialogueBody.text = string.IsNullOrWhiteSpace(roleId)
                        ? $"已清除 {NameForPlayerId(activeRolePickerPlayerId)} 的身份标记。"
                        : $"已将 {NameForPlayerId(activeRolePickerPlayerId)} 标记为 {RoleNameForId(roleId)}。";
                }
                CloseRolePicker();
            }
        }

        private void SetPrivateClaimRole(string roleId)
        {
            PopulatePrivateClaimRoles();
            privateClaimRoleIndex = Mathf.Max(0, privateClaimRoleIds.IndexOf(roleId ?? ""));
        }

        private void OpenPrivateChatPanel()
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (actionFormPanel != null) actionFormPanel.gameObject.SetActive(false);
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            if (string.IsNullOrWhiteSpace(privateChatStatus))
            {
                privateChatStatus = SelectedPrivateChatTarget() == null
                    ? "先选择一名私聊目标。"
                    : "选择身份、填写夜间信息或勾选保密后发送。";
            }
            PopulatePrivateClaimRoles();
            UpdatePrivateChatPanelText();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(true);
        }

        private void PopulatePrivateClaimRoles()
        {
            privateClaimRoleIds.Clear();
            privateClaimRoleIds.Add("");
            var roles = vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>();
            foreach (var role in roles)
            {
                if (!string.IsNullOrWhiteSpace(role.id)) privateClaimRoleIds.Add(role.id);
            }
            if (privateClaimRoleIndex < 0 || privateClaimRoleIndex >= privateClaimRoleIds.Count) privateClaimRoleIndex = 0;
            UpdatePrivateChatPanelText();
        }

        private void CyclePrivateClaimRole(int delta)
        {
            PopulatePrivateClaimRoles();
            if (privateClaimRoleIds.Count == 0) return;
            privateClaimRoleIndex = (privateClaimRoleIndex + delta + privateClaimRoleIds.Count) % privateClaimRoleIds.Count;
            UpdatePrivateChatPanelText();
        }

        private string SelectedPrivateClaimRoleId()
        {
            if (privateClaimRoleIds.Count == 0) PopulatePrivateClaimRoles();
            return privateClaimRoleIndex > 0 && privateClaimRoleIndex < privateClaimRoleIds.Count ? privateClaimRoleIds[privateClaimRoleIndex] : "";
        }

        private string PendingPrivateChatStatusText()
        {
            if (!IsPendingPrivateChat()) return "";
            if (PendingActionTimedOut())
            {
                return "仍未收到 JS Core 刷新。请确认 demo 是通过 npm run unity:demo 启动，或另开 npm run unity:bridge:build。";
            }
            return $"已写入私聊 action，等待 JS Core 回复（{PendingActionElapsed():0.0}s）。";
        }

        private void UpdatePrivateChatPanelText()
        {
            var target = SelectedPrivateChatTarget();
            var hasTarget = target != null;
            if (privateTargetText != null) privateTargetText.text = hasTarget ? $"目标：{target.name}" : "目标：未选择 token";
            if (privateClaimRoleText != null)
            {
                var roleId = SelectedPrivateClaimRoleId();
                privateClaimRoleText.text = !hasTarget
                    ? "先选目标"
                    : string.IsNullOrWhiteSpace(roleId) ? "不私下声称" : RoleNameForId(roleId);
            }
            RenderPrivateClaimRoleIcon(hasTarget);
            if (privateHistoryText != null) privateHistoryText.text = BuildPrivateHistoryText();
            if (privateStatusText != null)
            {
                var pendingPrivateStatus = PendingPrivateChatStatusText();
                var status = !hasTarget
                    ? "先在右侧选择目标，或直接点击魔典 token。"
                    : !string.IsNullOrWhiteSpace(pendingPrivateStatus) ? pendingPrivateStatus
                    : string.IsNullOrWhiteSpace(privateChatStatus) ? "准备发送给 JS Core；AI 回复会刷新到 timeline。" : privateChatStatus;
                privateStatusText.text = ClampTextBlock(status, 2, 28);
                privateStatusText.color = PendingActionTimedOut() && IsPendingPrivateChat()
                    ? new Color(1f, 0.56f, 0.38f, 1f)
                    : new Color(0.82f, 0.88f, 0.90f, 0.90f);
            }
            RenderPrivateTargetCard(target);
            RenderPrivateDialogueBubbles(target);
            RenderPrivateTargetPicker();
        }

        private void RenderPrivateClaimRoleIcon(bool hasTarget)
        {
            if (privateClaimRoleGridRoot == null) return;
            for (var i = privateClaimRoleGridRoot.childCount - 1; i >= 0; i--) Destroy(privateClaimRoleGridRoot.GetChild(i).gameObject);
            var roleId = SelectedPrivateClaimRoleId();
            var role = RoleForId(roleId);
            if (!hasTarget || role == null)
            {
                AddBlankRoleTokenButton(privateClaimRoleGridRoot, hasTarget ? "选择" : "未选", new Vector2(31f, 30f), 42f, false, OpenPrivateClaimRolePicker);
                return;
            }
            AddRoleTokenButton(privateClaimRoleGridRoot, role.id, role.name, role.category, role.team, new Vector2(31f, 30f), 42f, true, OpenPrivateClaimRolePicker);
        }

        private void RenderPrivateDialogueBubbles(PlayerViewModel target)
        {
            if (privateDialogueRoot == null) return;
            for (var i = privateDialogueRoot.childCount - 1; i >= 0; i--) Destroy(privateDialogueRoot.GetChild(i).gameObject);

            var width = Mathf.Max(640f, privateDialogueRoot.rect.width);
            var height = Mathf.Max(188f, privateDialogueRoot.rect.height);
            if (target == null)
            {
                AddText("Private Dialogue Empty", privateDialogueRoot, Vector2.zero, Vector2.one, new Vector2(18f, 72f), new Vector2(-18f, -72f), "选择一名玩家后，这里会显示最近私聊。", 16, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var entries = PrivateTimelineEntriesForSelected();
            var showPending = IsPendingPrivateChatForTarget(target);
            if (entries.Count == 0 && !showPending)
            {
                AddText("Private Dialogue None", privateDialogueRoot, Vector2.zero, Vector2.one, new Vector2(18f, 72f), new Vector2(-18f, -72f), $"暂无与 {target.name} 的私聊记录。", 16, TextAnchor.MiddleCenter, FontStyle.Normal);
                AddText("Private Dialogue Prompt", privateDialogueRoot, Vector2.zero, Vector2.one, new Vector2(18f, 34f), new Vector2(-18f, -118f), "点击“询问身份”或发送本次私聊后，对话会刷新到这里。", 13, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var maxRecent = showPending ? 2 : 3;
            var recent = entries.Skip(Mathf.Max(0, entries.Count - maxRecent)).ToArray();
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            for (var i = 0; i < recent.Length; i++)
            {
                var item = recent[i];
                var fromHuman = !string.IsNullOrWhiteSpace(humanId) && item.speakerId == humanId;
                var bubbleWidth = fromHuman ? 470f : 520f;
                var x = fromHuman ? width - bubbleWidth - 10f : 10f;
                var y = height - 58f - i * 58f;
                var color = fromHuman
                    ? new Color(0.18f, 0.090f, 0.032f, 0.86f)
                    : new Color(0.018f, 0.032f, 0.046f, 0.86f);
                var border = fromHuman
                    ? new Color(0.95f, 0.68f, 0.34f, 0.36f)
                    : new Color(0.62f, 0.78f, 0.92f, 0.22f);
                var bubble = AddPanel($"Private Bubble {i}", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(x, y), new Vector2(x + bubbleWidth, y + 48f), color);
                AddFrame(bubble.transform, "Private Bubble Frame", 0.8f, border);
                var speaker = fromHuman ? "你" : NameForPlayerId(item.speakerId);
                var text = ClampTextLines(new[] { $"{speaker}：{item.text}" }, 2, fromHuman ? 42 : 48);
                var label = AddText("Bubble Text", bubble.transform, Vector2.zero, Vector2.one, new Vector2(12f, 4f), new Vector2(-12f, -4f), text, 14, fromHuman ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft, FontStyle.Normal);
                label.color = new Color(0.96f, 0.91f, 0.82f, 0.98f);
            }
            if (showPending) RenderPrivatePendingBubble(width, height, recent.Length);
        }

        private void RenderPrivatePendingBubble(float width, float height, int rowIndex)
        {
            var timedOut = PendingActionTimedOut();
            var bubbleWidth = timedOut ? 600f : 500f;
            var x = (width - bubbleWidth) * 0.5f;
            var y = height - 58f - rowIndex * 58f;
            var color = timedOut ? new Color(0.26f, 0.060f, 0.036f, 0.88f) : new Color(0.16f, 0.120f, 0.040f, 0.88f);
            var border = timedOut ? new Color(1f, 0.36f, 0.26f, 0.58f) : new Color(1f, 0.76f, 0.32f, 0.42f);
            var bubble = AddPanel("Private Pending Bubble", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(x, y), new Vector2(x + bubbleWidth, y + 48f), color);
            AddFrame(bubble.transform, "Private Pending Bubble Frame", 0.8f, border);
            var dots = new string('.', 1 + Mathf.FloorToInt(PendingActionElapsed() * 2f) % 3);
            var text = timedOut
                ? "仍未收到 JS Core 刷新；请确认 bridge 正在运行。"
                : $"等待对方回应{dots} {PendingActionElapsed():0.0}s";
            var label = AddText("Private Pending Text", bubble.transform, Vector2.zero, Vector2.one, new Vector2(12f, 4f), new Vector2(-12f, -4f), text, 14, TextAnchor.MiddleCenter, FontStyle.Bold);
            label.color = timedOut ? new Color(1f, 0.78f, 0.64f, 1f) : new Color(1f, 0.88f, 0.52f, 1f);
        }

        private void RenderPrivateTargetCard(PlayerViewModel target)
        {
            if (privateTargetCardRoot == null) return;
            for (var i = privateTargetCardRoot.childCount - 1; i >= 0; i--) Destroy(privateTargetCardRoot.GetChild(i).gameObject);

            AddFrame(privateTargetCardRoot, "Private Target Card Frame", 0.9f, new Color(0.92f, 0.62f, 0.28f, 0.30f));
            AddImage("Private Target Card Glow", privateTargetCardRoot, new Vector2(0f, 0.52f), new Vector2(1f, 1f), new Vector2(8f, -8f), new Vector2(-8f, -8f), new Color(1f, 0.76f, 0.36f, 0.055f));

            if (target == null)
            {
                AddText("Private Target Card Title", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(18f, 416f), new Vector2(-18f, -18f), "未选择", 24, TextAnchor.UpperLeft, FontStyle.Bold);
                var unknown = AddImage("Private Target Unknown Token", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(42f, 218f), new Vector2(-42f, -98f), new Color(0.86f, 0.78f, 0.62f, 0.78f));
                unknown.sprite = SpriteFromResource("Botc/ui/vote1") ?? GetCircleFillSprite();
                unknown.preserveAspect = true;
                AddText("Private Target Unknown Mark", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(70f, 250f), new Vector2(-70f, -132f), "?", 56, TextAnchor.MiddleCenter, FontStyle.Bold);
                AddText("Private Target Empty Hint", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(22f, 96f), new Vector2(-22f, -312f), "先选择一名玩家，再开始私聊。", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
                AddText("Private Target Empty Style", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(22f, 36f), new Vector2(-22f, -386f), "普通风格", 14, TextAnchor.MiddleCenter, FontStyle.Bold);
                return;
            }

            AddText("Private Target Card Title", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(18f, 416f), new Vector2(-18f, -18f), $"{target.seat}号", 28, TextAnchor.UpperLeft, FontStyle.Bold);
            var state = $"{(target.alive ? "存活" : "死亡")} / {(target.ghostVoteAvailable ? "有鬼票" : "无鬼票")}";
            AddText("Private Target Suspicion", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(96f, 420f), new Vector2(-18f, -24f), $"{target.suspicion}%", 15, TextAnchor.UpperRight, FontStyle.Bold);

            var token = AddImage("Private Target Token", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(34f, 210f), new Vector2(-34f, -88f), new Color(0.92f, 0.82f, 0.60f, 0.92f));
            token.sprite = SpriteFromResource(target.revealed ? "Botc/ui/token1" : "Botc/ui/vote1") ?? GetCircleFillSprite();
            token.preserveAspect = true;

            if (target.revealed && !string.IsNullOrWhiteSpace(target.roleId))
            {
                var roleIcon = AddImage("Private Target Role Icon", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(68f, 242f), new Vector2(-68f, -124f), Color.white);
                roleIcon.sprite = SpriteFromResource($"Botc/roles/{target.roleId}");
                roleIcon.preserveAspect = true;
                if (roleIcon.sprite == null) roleIcon.color = new Color(1f, 1f, 1f, 0f);
            }
            else
            {
                AddText("Private Target Unknown Role", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(70f, 246f), new Vector2(-70f, -130f), "?", 52, TextAnchor.MiddleCenter, FontStyle.Bold);
            }

            AddText("Private Target Name", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(22f, 150f), new Vector2(-22f, -290f), target.name, 26, TextAnchor.MiddleCenter, FontStyle.Bold);
            AddText("Private Target Role", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(18f, 110f), new Vector2(-18f, -334f), PrivateRoleDisplay(target), 17, TextAnchor.MiddleCenter, FontStyle.Normal);
            AddText("Private Target State", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(18f, 72f), new Vector2(-18f, -372f), state, 14, TextAnchor.MiddleCenter, FontStyle.Normal);
            AddText("Private Target Style", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(22f, 36f), new Vector2(-22f, -386f), "普通风格", 14, TextAnchor.MiddleCenter, FontStyle.Bold);
        }

        private string PrivateRoleDisplay(PlayerViewModel player)
        {
            if (player == null) return "未选择";
            if (player.revealed) return string.IsNullOrWhiteSpace(player.roleName) ? "未知" : player.roleName;
            if (!string.IsNullOrWhiteSpace(player.markedRoleName)) return $"标记：{player.markedRoleName}";
            return "未知身份";
        }

        private void RenderPrivateTargetPicker()
        {
            if (privateTargetPickerRoot == null) return;
            var needsTarget = SelectedPrivateChatTarget() == null;
            privateTargetPickerRoot.gameObject.SetActive(needsTarget);
            if (!needsTarget) return;

            for (var i = privateTargetPickerRoot.childCount - 1; i >= 0; i--) Destroy(privateTargetPickerRoot.GetChild(i).gameObject);
            AddFrame(privateTargetPickerRoot, "Private Target Picker Frame", 0.9f, new Color(0.92f, 0.62f, 0.28f, 0.28f));
            AddText("Private Target Picker Title", privateTargetPickerRoot, Vector2.zero, Vector2.one, new Vector2(28f, 402f), new Vector2(-28f, -18f), "选择私聊目标", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Private Target Picker Hint", privateTargetPickerRoot, Vector2.zero, Vector2.one, new Vector2(28f, 360f), new Vector2(-28f, -58f), "点一名玩家后，右侧会切换为本次私聊内容。", 15, TextAnchor.UpperLeft, FontStyle.Normal);

            var targets = (vm.players ?? Array.Empty<PlayerViewModel>())
                .Where((player) => player != null && !player.human)
                .OrderBy((player) => player.seat)
                .Take(9)
                .ToArray();
            if (targets.Length == 0)
            {
                AddText("Private Target Empty", privateTargetPickerRoot, Vector2.zero, Vector2.one, new Vector2(22f, 112f), new Vector2(-22f, -98f), "暂无可私聊目标。", 17, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            for (var i = 0; i < targets.Length; i++)
            {
                var target = targets[i];
                var col = i % 3;
                var row = i / 3;
                var targetId = target.id;
                AddButton($"{target.seat}号", privateTargetPickerRoot, new Vector2(130f + col * 246f, 286f - row * 58f), new Vector2(154f, 38f), () => SelectPrivateChatTarget(targetId));
            }
        }

        private void SelectPrivateChatTarget(string playerId)
        {
            selectedPlayerId = playerId ?? "";
            if (!string.IsNullOrWhiteSpace(selectedPlayerId))
            {
                SendUnityAction("select-token", selectedPlayerId, "", "", "", trackPending: false);
                privateChatStatus = $"已选择 {NameForPlayerId(selectedPlayerId)}；可以询问身份或发送私聊。";
            }
            UpdateTokenInspectorText();
            UpdatePrivateChatPanelText();
        }

        private void SendPrivateClaimQuestion()
        {
            if (SelectedPrivateChatTarget() == null)
            {
                dialogueTitle.text = "私聊：询问身份";
                dialogueBody.text = "请先点击一名非主视角玩家 token。";
                return;
            }
            SendUnityAction("private-chat", selectedPlayerId, "", "你是什么身份？", "claim");
            privateChatStatus = $"已询问 {NameForPlayerId(selectedPlayerId)} 的身份说法，等待 JS Core 刷新回复。";
            UpdatePrivateChatPanelText();
            dialogueTitle.text = "私聊：询问身份";
            dialogueBody.text = "已发送私聊请求。详情与历史保留在私聊面板。";
        }

        private void SendPrivateQuickQuestion(string question, string intent)
        {
            if (SelectedPrivateChatTarget() == null)
            {
                OpenPrivateChatPanel();
                dialogueTitle.text = "私聊：继续追问";
                dialogueBody.text = "请先选择一名非主视角玩家作为私聊目标。";
                return;
            }
            SendUnityAction("private-chat", selectedPlayerId, "", question, intent);
            privateChatStatus = $"已追问 {NameForPlayerId(selectedPlayerId)}，等待 JS Core 写入回复。";
            UpdatePrivateChatPanelText();
            dialogueTitle.text = "私聊：继续追问";
            dialogueBody.text = $"已发送：{question}";
        }

        private void SendPrivatePanelMessage()
        {
            if (SelectedPrivateChatTarget() == null)
            {
                dialogueTitle.text = "私聊发送";
                dialogueBody.text = "请先点击一名非主视角玩家 token。";
                return;
            }
            var claimRoleId = SelectedPrivateClaimRoleId();
            var nightInfo = privateNightInput == null ? "" : privateNightInput.text.Trim();
            var askSecret = privateSecretToggle != null && privateSecretToggle.isOn;
            var intent = !string.IsNullOrWhiteSpace(claimRoleId) ? "claim" : !string.IsNullOrWhiteSpace(nightInfo) ? "night" : askSecret ? "trust" : "generic";
            var line = askSecret ? "这条信息先只在我们之间对齐。" : "我想和你私下交换一下信息。";
            SendUnityAction("private-chat", selectedPlayerId, "", line, intent, claimRoleId: claimRoleId, nightInfo: nightInfo, askSecret: askSecret);
            privateChatStatus = $"已发送给 {NameForPlayerId(selectedPlayerId)}；等待 JS Core 写入私聊历史。";
            UpdatePrivateChatPanelText();
            dialogueTitle.text = "私聊已发送";
            dialogueBody.text = "已发送私聊内容。底部保持简短，后续回复请看私聊面板或时间线。";
        }

        private ActionFormViewModel ActiveActionForm()
        {
            return (vm.actionForms ?? Array.Empty<ActionFormViewModel>()).FirstOrDefault((entry) => entry != null && entry.id == activeActionFormId);
        }

        private void OpenStorytellerPanel()
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            if (actionFormPanel != null) actionFormPanel.gameObject.SetActive(false);
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            RenderStorytellerPanel();
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(true);
        }

        private void RenderStorytellerPanel()
        {
            if (storytellerTitle != null) storytellerTitle.text = "Storyteller 队列";
            if (storytellerBody == null) return;
            var queue = vm.storytellerQueue ?? Array.Empty<string>();
            var action = vm.pendingStorytellerAction;
            var lines = new List<string>
            {
                queue.Length == 0 ? "当前没有待处理 Storyteller 队列。" : $"待处理队列：{queue.Length} 项",
                "────────"
            };
            for (var i = 0; i < queue.Length && i < 7; i++) lines.Add($"{i + 1}. {queue[i]}");
            if (action != null)
            {
                lines.Add("");
                lines.Add(action.available ? $"当前可处理：{action.roleName} [{action.inputType}]" : $"当前不可处理：{action.reason}");
                if (!string.IsNullOrWhiteSpace(action.prompt)) lines.Add(action.prompt);
                var optionCount = (action.options?.Length ?? 0) + (action.roleOptions?.Length ?? 0) + (action.modes?.Length ?? 0);
                lines.Add($"可选项：{optionCount}  ·  目标数：{action.minTargetCount}-{action.maxTargetCount}");
            }
            lines.Add("");
            lines.Add("点击“处理当前”会打开动态行动表单，并继续由 JS Core 结算。");
            storytellerBody.text = ClampTextLines(lines, 14, 52);
        }

        private void OpenActionFormPanel(string formId)
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(false);
            if (handbookPanel != null) handbookPanel.gameObject.SetActive(false);
            activeActionFormId = formId;
            selectedActionTargetIds.Clear();
            selectedActionRoleId = "";
            selectedActionModeId = "";
            actionTargetPage = 0;
            actionRolePage = 0;
            actionQuestionInput = null;
            RenderActionFormPanel();
            if (actionFormPanel != null) actionFormPanel.gameObject.SetActive(true);
        }

        private void OpenHandbookPanel()
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            if (actionFormPanel != null) actionFormPanel.gameObject.SetActive(false);
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(false);
            RenderHandbookPanel();
            if (handbookPanel != null) handbookPanel.gameObject.SetActive(true);
        }

        private void SelectHandbookCategory(string category)
        {
            activeHandbookCategory = string.IsNullOrWhiteSpace(category) ? "all" : category;
            activeHandbookRoleIndex = 0;
            activeHandbookRolePage = 0;
            RenderHandbookPanel();
        }

        private void SelectHandbookRole(int index)
        {
            activeHandbookRoleIndex = index;
            activeHandbookRolePage = Mathf.Max(0, activeHandbookRoleIndex / HandbookRolePageSize);
            RenderHandbookPanel();
        }

        private void ChangeHandbookRolePage(int delta)
        {
            var roles = vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>();
            var count = roles.Count((role) => activeHandbookCategory == "all" || role.category == activeHandbookCategory);
            activeHandbookRolePage = ClampPage(activeHandbookRolePage + delta, count, HandbookRolePageSize);
            if (count > 0) activeHandbookRoleIndex = Mathf.Min(activeHandbookRolePage * HandbookRolePageSize, count - 1);
            RenderHandbookPanel();
        }

        private void RenderHandbookPanel()
        {
            var handbook = vm.scriptHandbook;
            var roles = handbook?.roles ?? Array.Empty<ScriptRoleViewModel>();
            var filtered = roles
                .Where((role) => activeHandbookCategory == "all" || role.category == activeHandbookCategory)
                .OrderBy((role) => CategorySort(role.category ?? ""))
                .ThenBy((role) => role.name ?? role.id ?? "")
                .ToArray();
            if (activeHandbookRoleIndex < 0 || activeHandbookRoleIndex >= filtered.Length) activeHandbookRoleIndex = 0;
            var handbookPages = PageCount(filtered.Length, HandbookRolePageSize);
            activeHandbookRolePage = ClampPage(activeHandbookRolePage, filtered.Length, HandbookRolePageSize);
            if (filtered.Length > 0 && (activeHandbookRoleIndex < activeHandbookRolePage * HandbookRolePageSize || activeHandbookRoleIndex >= (activeHandbookRolePage + 1) * HandbookRolePageSize))
            {
                activeHandbookRoleIndex = Mathf.Min(activeHandbookRolePage * HandbookRolePageSize, filtered.Length - 1);
            }
            var selected = filtered.Length > 0 ? filtered[activeHandbookRoleIndex] : null;

            if (handbookTitle != null) handbookTitle.text = $"剧本手册 · {(string.IsNullOrWhiteSpace(handbook?.scriptName) ? DisplayScriptName() : handbook.scriptName)}";
            if (handbookRoleListRoot != null)
            {
                for (var i = handbookRoleListRoot.childCount - 1; i >= 0; i--) Destroy(handbookRoleListRoot.GetChild(i).gameObject);
                AddFrame(handbookRoleListRoot, "Handbook List Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
                var pageStart = activeHandbookRolePage * HandbookRolePageSize;
                var pageRoles = filtered.Skip(pageStart).Take(HandbookRolePageSize).ToArray();
                for (var i = 0; i < pageRoles.Length; i++)
                {
                    var role = pageRoles[i];
                    var absoluteIndex = pageStart + i;
                    var active = absoluteIndex == activeHandbookRoleIndex;
                    var row = i / 3;
                    var col = i % 3;
                    var index = absoluteIndex;
                    AddRoleTokenButton(handbookRoleListRoot, role.id, role.name, role.category, role.team, new Vector2(58f + col * 110f, 348f - row * 82f), 54f, active, () => SelectHandbookRole(index));
                    if (!string.IsNullOrWhiteSpace(RoleHandbookTag(role)))
                    {
                        AddText("Handbook Role Tag", handbookRoleListRoot, Vector2.zero, Vector2.zero, new Vector2(34f + col * 110f, 384f - row * 82f), new Vector2(82f + col * 110f, 406f - row * 82f), "标", 11, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.78f, 0.36f, 1f);
                    }
                }
                AddText("Handbook Page Label", handbookRoleListRoot, Vector2.zero, Vector2.zero, new Vector2(96f, 28f), new Vector2(240f, 56f), $"第 {activeHandbookRolePage + 1}/{handbookPages} 页 · {filtered.Length} 个角色", 13, TextAnchor.MiddleCenter, FontStyle.Normal);
                AddButton("‹", handbookRoleListRoot, new Vector2(50f, 42f), new Vector2(50f, 28f), () => ChangeHandbookRolePage(-1));
                AddButton("›", handbookRoleListRoot, new Vector2(286f, 42f), new Vector2(50f, 28f), () => ChangeHandbookRolePage(1));
            }

            if (handbookDetailText != null)
            {
                if (selected == null)
                {
                    handbookDetailText.text = "当前剧本手册没有可显示角色。";
                }
                else
                {
                    handbookDetailText.text = ClampTextLines(new[]
                    {
                        $"{selected.name}  ·  {CategoryLabel(selected.category)} / {TeamLabel(selected.team)}",
                        $"ID：{selected.id}",
                        "",
                        string.IsNullOrWhiteSpace(selected.ability) ? "暂无能力文本。" : selected.ability,
                        "",
                        RoleHandbookUseLine(selected),
                    }, 10, 48);
                }
            }

            if (handbookOrderText != null)
            {
                var first = handbook?.firstNightOrder ?? Array.Empty<string>();
                var other = handbook?.otherNightOrder ?? Array.Empty<string>();
                var lines = new List<string> { "夜晚顺序", "首夜：" + ShortOrder(first), "其后：" + ShortOrder(other) };
                var counts = roles.GroupBy((role) => role.category ?? "").ToDictionary((group) => group.Key, (group) => group.Count());
                lines.Add($"角色数：民 {CountCategory(counts, "townsfolk")} / 外 {CountCategory(counts, "outsider")} / 爪 {CountCategory(counts, "minion")} / 恶 {CountCategory(counts, "demon")}");
                handbookOrderText.text = ClampTextLines(lines, 12, 76);
            }
        }

        private void OpenVotePanel()
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            if (actionFormPanel != null) actionFormPanel.gameObject.SetActive(false);
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(false);
            if (handbookPanel != null) handbookPanel.gameObject.SetActive(false);
            if (votePanel != null) votePanel.gameObject.SetActive(true);
            RestartVoteAnimation();
        }

        private void UpdateVotePanelText()
        {
            if (voteTitle != null) voteTitle.text = vm.voteCeremony == null ? "投票仪式" : $"投票仪式 · 第 {vm.voteCeremony.day} 天";
            if (voteBody == null) return;
            var vote = vm.voteCeremony;
            if (vote == null)
            {
                voteBody.text = ClampTextBlock("暂无投票结果。\n\n流程：进入提名阶段 -> 选择被提名者 -> JS Core 结算逐人投票 -> 这里展示举手名单。", 4, 58);
                RenderVoteTokenCeremony(0, true);
                return;
            }
            var voters = vote.voters ?? Array.Empty<VoteViewModel>();
            var key = VoteAnimationKey(vote);
            if (key != voteAnimationKey)
            {
                voteAnimationKey = key;
                voteAnimationStartTime = Time.time;
                voteAnimationStep = -1;
            }
            var visible = Mathf.Clamp(voteAnimationStep, 0, voters.Length);
            var shownYes = voters.OrderBy((entry) => entry.seat).Take(visible).Count((entry) => entry.vote);
            var suffix = visible >= voters.Length ? vote.resultText : $"正在逐个询问：{visible}/{voters.Length}";
            voteBody.text = ClampTextLines(new[]
            {
                $"{vote.nominatorName}  提名  {vote.nomineeName}",
                $"实时计票：{shownYes} / {vote.threshold} 票",
                suffix
            }, 3, 58);
            RenderVoteTokenCeremony(visible, false);
        }

        private void RestartVoteAnimation()
        {
            voteAnimationKey = VoteAnimationKey(vm.voteCeremony);
            voteAnimationStartTime = Time.time;
            voteAnimationStep = -1;
            UpdateVotePanelText();
        }

        private void UpdateVoteAnimationFrame()
        {
            if (votePanel == null || !votePanel.gameObject.activeSelf || vm.voteCeremony == null) return;
            var voters = vm.voteCeremony.voters ?? Array.Empty<VoteViewModel>();
            if (voters.Length == 0) return;
            var nextStep = Mathf.Clamp(Mathf.FloorToInt((Time.time - voteAnimationStartTime) / 0.42f) + 1, 0, voters.Length);
            if (nextStep == voteAnimationStep) return;
            voteAnimationStep = nextStep;
            UpdateVotePanelText();
        }

        private void RenderVoteTokenCeremony(int visibleCount, bool forceEmpty)
        {
            if (voteAnimationRoot == null || voteAnimationRowsRoot == null) return;
            for (var i = voteAnimationRoot.childCount - 1; i >= 0; i--) Destroy(voteAnimationRoot.GetChild(i).gameObject);
            for (var i = voteAnimationRowsRoot.childCount - 1; i >= 0; i--) Destroy(voteAnimationRowsRoot.GetChild(i).gameObject);
            AddFrame(voteAnimationRoot, "Vote Animation Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.22f));
            if (forceEmpty || vm.voteCeremony == null)
            {
                AddText("Vote Empty", voteAnimationRoot, Vector2.zero, Vector2.one, new Vector2(16f, 92f), new Vector2(-16f, -16f), "暂无可播放的投票数据。", 16, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var voters = (vm.voteCeremony.voters ?? Array.Empty<VoteViewModel>()).OrderBy((entry) => entry.seat).Take(12).ToArray();
            for (var i = 0; i < voters.Length; i++)
            {
                var voter = voters[i];
                var revealed = i < visibleCount;
                var raised = revealed && voter.vote;
                var abstain = revealed && voter.abstain;
                var angle = Mathf.PI * 0.5f - Mathf.PI * 2f * i / Mathf.Max(1, voters.Length);
                var radiusX = 420f;
                var radiusY = 98f;
                var center = new Vector2(492f, 136f);
                var pos = new Vector2(center.x + Mathf.Cos(angle) * radiusX, center.y + Mathf.Sin(angle) * radiusY);
                var current = i == Mathf.Clamp(visibleCount - 1, 0, voters.Length - 1);
                var size = current ? 74f : 62f;
                var color = !revealed
                    ? new Color(0.035f, 0.040f, 0.050f, 0.68f)
                    : raised ? new Color(0.48f, 0.31f, 0.10f, 0.88f) : new Color(0.050f, 0.055f, 0.062f, 0.78f);
                var token = AddPanel($"Vote Token {i}", voteAnimationRoot, Vector2.zero, Vector2.zero, pos - new Vector2(size, size) * 0.5f, pos + new Vector2(size, size) * 0.5f, color);
                var image = token.GetComponent<Image>();
                image.sprite = GetCircleFillSprite();
                image.preserveAspect = true;
                AddCircleImage("Vote Token Ring", token.transform, size * 0.50f, raised ? new Color(1f, 0.76f, 0.32f, 0.72f) : new Color(0.72f, 0.55f, 0.34f, revealed ? 0.34f : 0.16f), true);
                var mark = !revealed ? "?" : raised ? "举" : abstain ? "弃" : "落";
                AddText("Vote Token Mark", token.transform, Vector2.zero, Vector2.one, new Vector2(0f, 12f), new Vector2(0f, -8f), mark, current ? 22 : 18, TextAnchor.MiddleCenter, FontStyle.Bold).color = raised ? new Color(1f, 0.86f, 0.48f, 1f) : new Color(0.86f, 0.82f, 0.74f, 0.92f);
                AddText("Vote Token Name", voteAnimationRoot, Vector2.zero, Vector2.zero, pos + new Vector2(-54f, -48f), pos + new Vector2(54f, -18f), $"{voter.seat}号 {voter.voterName}", 12, TextAnchor.MiddleCenter, FontStyle.Normal);
            }
        }

        private static string VoteAnimationKey(VoteCeremonyViewModel vote)
        {
            if (vote == null) return "";
            var voters = vote.voters ?? Array.Empty<VoteViewModel>();
            var voterBits = string.Join(",", voters.OrderBy((entry) => entry.seat).Select((entry) => $"{entry.voterId}:{entry.vote}:{entry.abstain}:{entry.ghostVote}"));
            return $"{vote.day}:{vote.nominatorId}:{vote.nomineeId}:{vote.yesVotes}:{vote.threshold}:{voterBits}";
        }

        private void RenderActionFormPanel()
        {
            if (actionOptionRoot != null)
            {
                for (var i = actionOptionRoot.childCount - 1; i >= 0; i--) Destroy(actionOptionRoot.GetChild(i).gameObject);
                AddFrame(actionOptionRoot, "Action Option Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            }
            var form = ActiveActionForm();
            if (form == null)
            {
                if (actionFormTitle != null) actionFormTitle.text = "行动表单";
                if (actionFormBody != null) actionFormBody.text = "当前 viewmodel 尚未导出这个行动表单。";
                if (actionFormStatusText != null) actionFormStatusText.text = "";
                return;
            }
            if (actionFormTitle != null) actionFormTitle.text = form.title ?? "行动表单";
            if (actionFormBody != null)
            {
                actionFormBody.text = form.available
                    ? ClampTextLines(new[]
                    {
                        $"{form.roleName} [{form.inputType}]",
                        form.prompt,
                        ActionFormInstruction(form),
                        $"当前：{ActionFormSelectionText(form)}"
                    }, 4, 62)
                    : ClampTextBlock($"当前不可用：{form.reason}", 3, 62);
            }
            if (!form.available || actionOptionRoot == null) return;
            actionQuestionInput = null;
            var y = 238f;
            if (NeedsMode(form))
            {
                AddText("Mode Label", actionOptionRoot, Vector2.zero, Vector2.one, new Vector2(18f, y - 20f), new Vector2(-18f, -(260f - y)), "模式", 14, TextAnchor.UpperLeft, FontStyle.Bold);
                RenderActionModeChoices(form, y - 18f);
                y -= 56f;
            }
            if (NeedsTargets(form))
            {
                AddText("Target Label", actionOptionRoot, Vector2.zero, Vector2.one, new Vector2(18f, y - 20f), new Vector2(-18f, -(260f - y)), "目标", 14, TextAnchor.UpperLeft, FontStyle.Bold);
                RenderActionTargetChoices(form, y - 18f);
                y -= (form.options?.Length ?? 0) > ActionChoicePageSize ? 112f : 86f;
            }
            if (NeedsRole(form))
            {
                AddText("Role Label", actionOptionRoot, Vector2.zero, Vector2.one, new Vector2(18f, y - 20f), new Vector2(-18f, -(260f - y)), "身份", 14, TextAnchor.UpperLeft, FontStyle.Bold);
                RenderActionRoleChoices(form, y - 18f, NeedsTargets(form));
                y -= NeedsTargets(form) ? 124f : 160f;
            }
            if (NeedsQuestion(form))
            {
                AddText("Question Label", actionOptionRoot, Vector2.zero, Vector2.one, new Vector2(18f, y - 20f), new Vector2(-18f, -(260f - y)), "问题", 14, TextAnchor.UpperLeft, FontStyle.Bold);
                actionQuestionInput = AddInputField("Action Question Input", actionOptionRoot, new Vector2(86f, Mathf.Max(24f, y - 38f)), new Vector2(600f, Mathf.Max(56f, y - 6f)), "输入要提交给 JS Core 的问题");
            }
            if (!NeedsMode(form) && !NeedsTargets(form) && !NeedsRole(form) && !NeedsQuestion(form))
            {
                AddText("Info Action", actionOptionRoot, Vector2.zero, Vector2.one, new Vector2(20f, 100f), new Vector2(-20f, -80f), "这是信息型行动，无需额外输入。点击确认发送或自动处理。", 16, TextAnchor.MiddleCenter, FontStyle.Normal);
            }
            if (actionFormStatusText != null) actionFormStatusText.text = ClampTextBlock(ActionFormStatus(form), 2, 54);
        }

        private void RenderActionTargetChoices(ActionFormViewModel form, float y)
        {
            var options = form.options ?? Array.Empty<ActionOptionViewModel>();
            actionTargetPage = ClampPage(actionTargetPage, options.Length, ActionChoicePageSize);
            var pageStart = actionTargetPage * ActionChoicePageSize;
            var pageOptions = options.Skip(pageStart).Take(ActionChoicePageSize).ToArray();
            for (var i = 0; i < pageOptions.Length; i++)
            {
                var option = pageOptions[i];
                var col = i % 4;
                var row = i / 4;
                var selected = selectedActionTargetIds.Contains(option.id);
                var label = Ellipsize($"{(selected ? "✓ " : "")}{(string.IsNullOrWhiteSpace(option.name) ? option.id : option.name)}", 9);
                AddButton(label, actionOptionRoot, new Vector2(136f + col * 122f, y - row * 36f), new Vector2(112f, 29f), () => ToggleActionFormTarget(option.id));
            }
            RenderActionChoicePager("Target", actionTargetPage, PageCount(options.Length, ActionChoicePageSize), y - 72f, () => ChangeActionTargetPage(-1), () => ChangeActionTargetPage(1));
        }

        private void RenderActionRoleChoices(ActionFormViewModel form, float y, bool compact)
        {
            var options = ActionRoleChoices(form).ToArray();
            actionRolePage = ClampPage(actionRolePage, options.Length, ActionChoicePageSize);
            var pageStart = actionRolePage * ActionChoicePageSize;
            var pageOptions = options.Skip(pageStart).Take(ActionChoicePageSize).ToArray();
            for (var i = 0; i < pageOptions.Length; i++)
            {
                var option = pageOptions[i];
                var col = i % 4;
                var row = i / 4;
                var selected = selectedActionRoleId == option.id;
                var roleId = option.id;
                AddRoleTokenButton(actionOptionRoot, option.id, option.name, option.category, option.team, new Vector2(112f + col * 138f, y - 10f - row * (compact ? 58f : 78f)), compact ? 40f : 52f, selected, () => SelectActionFormRole(roleId));
            }
            RenderActionChoicePager("Role", actionRolePage, PageCount(options.Length, ActionChoicePageSize), y - (compact ? 112f : 154f), () => ChangeActionRolePage(-1), () => ChangeActionRolePage(1));
        }

        private void RenderActionModeChoices(ActionFormViewModel form, float y)
        {
            var modes = form.modes ?? Array.Empty<ActionModeViewModel>();
            for (var i = 0; i < modes.Length && i < 4; i++)
            {
                var mode = modes[i];
                var selected = selectedActionModeId == mode.id;
                var label = $"{(selected ? "✓ " : "")}{(string.IsNullOrWhiteSpace(mode.label) ? mode.id : mode.label)}";
                AddButton(label, actionOptionRoot, new Vector2(136f + i * 122f, y), new Vector2(112f, 29f), () => SelectActionFormMode(mode.id));
            }
        }

        private void RenderActionChoicePager(string name, int page, int totalPages, float y, UnityEngine.Events.UnityAction prev, UnityEngine.Events.UnityAction next)
        {
            if (actionOptionRoot == null || totalPages <= 1) return;
            AddText($"{name} Page Label", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(354f, y - 14f), new Vector2(492f, y + 12f), $"第 {page + 1}/{totalPages} 页", 12, TextAnchor.MiddleRight, FontStyle.Normal);
            AddButton("‹", actionOptionRoot, new Vector2(514f, y), new Vector2(36f, 26f), prev);
            AddButton("›", actionOptionRoot, new Vector2(558f, y), new Vector2(36f, 26f), next);
        }

        private void ChangeActionTargetPage(int delta)
        {
            var count = ActiveActionForm()?.options?.Length ?? 0;
            actionTargetPage = ClampPage(actionTargetPage + delta, count, ActionChoicePageSize);
            RenderActionFormPanel();
        }

        private void ChangeActionRolePage(int delta)
        {
            var form = ActiveActionForm();
            var count = form == null ? 0 : ActionRoleChoices(form).Count();
            actionRolePage = ClampPage(actionRolePage + delta, count, ActionChoicePageSize);
            RenderActionFormPanel();
        }

        private static bool NeedsTargets(ActionFormViewModel form)
        {
            var type = form?.inputType ?? "";
            return (form?.options?.Length ?? 0) > 0 && (type.Contains("target") || type == "player-role" || type == "guesses" || type == "charge-or-targets");
        }

        private static bool NeedsRole(ActionFormViewModel form)
        {
            var type = form?.inputType ?? "";
            return type == "role" || type == "player-role" || type == "guesses";
        }

        private static bool NeedsMode(ActionFormViewModel form)
        {
            return (form?.modes?.Length ?? 0) > 0 || (form?.inputType ?? "") == "charge-or-targets";
        }

        private static bool NeedsQuestion(ActionFormViewModel form)
        {
            return (form?.inputType ?? "") == "question";
        }

        private IEnumerable<ActionRoleOptionViewModel> ActionRoleChoices(ActionFormViewModel form)
        {
            var direct = form?.roleOptions ?? Array.Empty<ActionRoleOptionViewModel>();
            if (direct.Length > 0) return direct;
            return (vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>())
                .Select((role) => new ActionRoleOptionViewModel { id = role.id, name = role.name, category = role.category, team = role.team });
        }

        private string ActionFormInstruction(ActionFormViewModel form)
        {
            if (form == null) return "";
            if (!form.available) return form.reason ?? "";
            if (form.inputType == "guesses") return "选择一个玩家和一个身份后确认，Unity 会提交 guess 给 JS Core。";
            if (form.inputType == "player-role") return "选择目标和身份后确认。";
            if (form.inputType == "role") return "选择一个身份后确认。";
            if (form.inputType == "question") return "输入问题后确认。";
            if (form.inputType == "charge-or-targets") return "选择模式；若模式需要目标，再选择玩家后确认。";
            if (form.inputType == "info") return "信息型行动无需额外输入。";
            return $"需要 {form.minTargetCount}-{form.maxTargetCount} 项选择。";
        }

        private string ActionFormSelectionText(ActionFormViewModel form)
        {
            var parts = new List<string>();
            if (selectedActionTargetIds.Count > 0) parts.Add($"目标 {string.Join(" / ", selectedActionTargetIds.Select(NameForPlayerId))}");
            if (!string.IsNullOrWhiteSpace(selectedActionRoleId)) parts.Add($"身份 {RoleNameForId(selectedActionRoleId)}");
            if (!string.IsNullOrWhiteSpace(selectedActionModeId)) parts.Add($"模式 {selectedActionModeId}");
            if (form != null && NeedsQuestion(form) && actionQuestionInput != null && !string.IsNullOrWhiteSpace(actionQuestionInput.text)) parts.Add($"问题 {actionQuestionInput.text}");
            return parts.Count == 0 ? "未选择" : string.Join("；", parts);
        }

        private string ActionFormStatus(ActionFormViewModel form)
        {
            if (form == null) return "";
            if (!form.available) return form.reason ?? "当前不可用。";
            if (form.inputType == "guesses" && (selectedActionTargetIds.Count == 0 || string.IsNullOrWhiteSpace(selectedActionRoleId))) return "猜测类行动需要玩家 + 身份。";
            var modeSkipsTargets = form.inputType == "charge-or-targets" && (selectedActionModeId == "charge" || selectedActionModeId == "none");
            if (NeedsTargets(form) && !modeSkipsTargets && selectedActionTargetIds.Count < form.minTargetCount) return $"还需选择至少 {form.minTargetCount} 个目标。";
            if (NeedsRole(form) && string.IsNullOrWhiteSpace(selectedActionRoleId)) return "还需选择身份。";
            if (NeedsMode(form) && string.IsNullOrWhiteSpace(selectedActionModeId) && (form.modes?.Length ?? 0) > 0) return "可选择一个模式，未选则由 JS Core 使用默认模式。";
            return "可以确认发送；规则仍由 JS Core 结算。";
        }

        private void SendActiveActionFormAuto()
        {
            var form = ActiveActionForm();
            if (form == null || string.IsNullOrWhiteSpace(form.id)) return;
            SendUnityAction(form.id);
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = "已发送给 JS Core：自动使用当前合法默认选择。";
        }

        private void ToggleActionFormTarget(string targetId)
        {
            var form = ActiveActionForm();
            if (form == null) return;
            if (selectedActionTargetIds.Contains(targetId))
            {
                selectedActionTargetIds.Remove(targetId);
            }
            else
            {
                if (form.maxTargetCount > 0 && selectedActionTargetIds.Count >= form.maxTargetCount) selectedActionTargetIds.RemoveAt(0);
                selectedActionTargetIds.Add(targetId);
            }
            RenderActionFormPanel();
        }

        private void ClearActionFormTargets()
        {
            selectedActionTargetIds.Clear();
            RenderActionFormPanel();
        }

        private void SelectActionFormRole(string roleId)
        {
            selectedActionRoleId = selectedActionRoleId == roleId ? "" : roleId;
            RenderActionFormPanel();
        }

        private void SelectActionFormMode(string modeId)
        {
            selectedActionModeId = selectedActionModeId == modeId ? "" : modeId;
            RenderActionFormPanel();
        }

        private void SendActionFormComposed()
        {
            var form = ActiveActionForm();
            if (form == null) return;
            if (form.inputType == "guesses")
            {
                if (selectedActionTargetIds.Count == 0 || string.IsNullOrWhiteSpace(selectedActionRoleId))
                {
                    dialogueTitle.text = $"{form.title}未发送";
                    dialogueBody.text = "猜测类行动需要先选择玩家和身份。";
                    return;
                }
                SendUnityAction(form.id, targetIds: selectedActionTargetIds.Take(1), roleId: selectedActionRoleId, guessPlayerId: selectedActionTargetIds[0], guessRoleId: selectedActionRoleId);
            }
            else if (NeedsQuestion(form))
            {
                var question = actionQuestionInput == null ? "" : actionQuestionInput.text.Trim();
                SendUnityAction(form.id, text: string.IsNullOrWhiteSpace(question) ? "Is there a demon in play?" : question);
            }
            else
            {
                var modeSkipsTargets = form.inputType == "charge-or-targets" && (selectedActionModeId == "charge" || selectedActionModeId == "none");
                if (NeedsTargets(form) && !modeSkipsTargets && selectedActionTargetIds.Count < form.minTargetCount)
                {
                    dialogueTitle.text = $"{form.title}未发送";
                    dialogueBody.text = $"还需要选择至少 {form.minTargetCount} 项。";
                    return;
                }
                if (NeedsRole(form) && string.IsNullOrWhiteSpace(selectedActionRoleId))
                {
                    dialogueTitle.text = $"{form.title}未发送";
                    dialogueBody.text = "还需要选择身份。";
                    return;
                }
                SendUnityAction(form.id, roleId: selectedActionRoleId, mode: selectedActionModeId, targetIds: selectedActionTargetIds);
            }
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = $"已发送给 JS Core：{ActionFormSelectionText(form)}。";
        }

        private void SendActionFormSelectedTargets()
        {
            var form = ActiveActionForm();
            if (form == null) return;
            if (selectedActionTargetIds.Count < form.minTargetCount)
            {
                dialogueTitle.text = $"{form.title}未发送";
                dialogueBody.text = $"还需要选择至少 {form.minTargetCount} 项。";
                return;
            }
            SendUnityAction(form.id, targetIds: selectedActionTargetIds);
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = $"已发送给 JS Core：{string.Join(" / ", selectedActionTargetIds.Select(NameForPlayerId))}。";
        }

        private void SendActionFormRole(string roleId)
        {
            var form = ActiveActionForm();
            if (form == null) return;
            SendUnityAction(form.id, roleId: roleId);
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = $"已发送给 JS Core：选择身份 {RoleNameForId(roleId)}。";
        }

        private void SendActionFormMode(string mode)
        {
            var form = ActiveActionForm();
            if (form == null) return;
            SendUnityAction(form.id, mode: mode);
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = $"已发送给 JS Core：选择模式 {mode}。";
        }

        private static string TimelineModeLabel(string mode)
        {
            if (mode == "public") return "公聊";
            if (mode == "whisper-in") return "私聊传入";
            if (mode == "whisper-out") return "私聊传出";
            if (mode == "private") return "私聊";
            if (mode == "nomination") return "提名";
            if (mode == "vote") return "投票";
            return "事件";
        }

        private static string ReminderShort(string reminder)
        {
            if (string.IsNullOrWhiteSpace(reminder)) return "?";
            var lower = reminder.ToLowerInvariant();
            if (lower.Contains("poison") || reminder.Contains("毒")) return "P";
            if (lower.Contains("drunk") || reminder.Contains("醉")) return "D";
            if (lower.Contains("ghost") || reminder.Contains("鬼")) return "G";
            if (lower.Contains("guard") || reminder.Contains("守")) return "S";
            return reminder.Length <= 2 ? reminder : reminder.Substring(0, Mathf.Min(2, reminder.Length));
        }

        private PrototypeViewModel LoadViewModel()
        {
            try
            {
                ConfigureBridgePaths();
                var samplePath = Path.Combine(Application.streamingAssetsPath, "sample_viewmodel.json");
                var path = File.Exists(viewModelPath) ? viewModelPath : samplePath;
                if (File.Exists(path))
                {
                    var json = File.ReadAllText(path);
                    var loaded = JsonUtility.FromJson<PrototypeViewModel>(json);
                    if (loaded != null && loaded.players != null && loaded.players.Length > 0) return loaded;
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to load Unity viewmodel: {ex.Message}");
            }
            return PrototypeViewModel.CreateFallback();
        }

        private void RememberViewModelTimestamp()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(viewModelPath)) ConfigureBridgePaths();
                viewModelLastWriteUtc = File.Exists(viewModelPath) ? File.GetLastWriteTimeUtc(viewModelPath) : DateTime.MinValue;
            }
            catch
            {
                viewModelLastWriteUtc = DateTime.MinValue;
            }
        }

        private void PollViewModelChanges()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(viewModelPath)) ConfigureBridgePaths();
                if (!File.Exists(viewModelPath)) return;
                var modified = File.GetLastWriteTimeUtc(viewModelPath);
                var pendingPollDue = HasPendingAction() && Time.realtimeSinceStartup >= nextPendingViewModelPollAt;
                if (modified <= viewModelLastWriteUtc && !pendingPollDue) return;
                if (pendingPollDue) nextPendingViewModelPollAt = Time.realtimeSinceStartup + PendingViewModelPollSeconds;
                if (modified > viewModelLastWriteUtc) viewModelLastWriteUtc = modified;
                var json = File.ReadAllText(viewModelPath);
                var loaded = JsonUtility.FromJson<PrototypeViewModel>(json);
                if (loaded == null || loaded.players == null || loaded.players.Length == 0) return;
                vm = loaded;
                selectedPlayerId = vm.action != null ? vm.action.selectedPlayerId ?? selectedPlayerId : selectedPlayerId;
                ResolvePendingActionFromViewModel();
                RenderAllAndMood();
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to refresh Unity viewmodel: {ex.Message}");
            }
        }

        private void SendUnityAction(string type, string playerId = "", string stage = "", string text = "", string intent = "", string reminder = "", string roleId = "", string claimRoleId = "", string nightInfo = "", bool askSecret = false, string mode = "", IEnumerable<string> targetIds = null, string guessPlayerId = "", string guessRoleId = "", bool trackPending = true)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(actionPath)) ConfigureBridgePaths();
                var directory = Path.GetDirectoryName(actionPath);
                if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
                var id = $"unity-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{UnityEngine.Random.Range(1000, 9999)}";
                var payload = new List<string>();
                if (!string.IsNullOrWhiteSpace(playerId))
                {
                    payload.Add($"\"playerId\":\"{JsonEscape(playerId)}\"");
                    payload.Add($"\"targetId\":\"{JsonEscape(playerId)}\"");
                    payload.Add($"\"nomineeId\":\"{JsonEscape(playerId)}\"");
                }
                if (!string.IsNullOrWhiteSpace(stage)) payload.Add($"\"stage\":\"{JsonEscape(stage)}\"");
                if (!string.IsNullOrWhiteSpace(text)) payload.Add($"\"text\":\"{JsonEscape(text)}\"");
                if (!string.IsNullOrWhiteSpace(intent)) payload.Add($"\"intent\":\"{JsonEscape(intent)}\"");
                if (!string.IsNullOrWhiteSpace(reminder)) payload.Add($"\"reminder\":\"{JsonEscape(reminder)}\"");
                if (!string.IsNullOrWhiteSpace(roleId)) payload.Add($"\"roleId\":\"{JsonEscape(roleId)}\"");
                if (!string.IsNullOrWhiteSpace(claimRoleId)) payload.Add($"\"claimRoleId\":\"{JsonEscape(claimRoleId)}\"");
                if (!string.IsNullOrWhiteSpace(nightInfo)) payload.Add($"\"nightInfo\":\"{JsonEscape(nightInfo)}\"");
                if (askSecret) payload.Add("\"askSecret\":true");
                if (!string.IsNullOrWhiteSpace(mode)) payload.Add($"\"mode\":\"{JsonEscape(mode)}\"");
                var targetIdList = (targetIds ?? Array.Empty<string>()).Where((entry) => !string.IsNullOrWhiteSpace(entry)).Distinct().ToArray();
                if (targetIdList.Length > 0)
                {
                    payload.Add($"\"targetIds\":[{string.Join(",", targetIdList.Select((entry) => $"\"{JsonEscape(entry)}\""))}]");
                }
                if (!string.IsNullOrWhiteSpace(guessPlayerId) && !string.IsNullOrWhiteSpace(guessRoleId))
                {
                    payload.Add($"\"guesses\":[{{\"playerId\":\"{JsonEscape(guessPlayerId)}\",\"roleId\":\"{JsonEscape(guessRoleId)}\"}}]");
                }
                var json = "{\n"
                    + $"  \"id\": \"{id}\",\n"
                    + $"  \"type\": \"{JsonEscape(type)}\",\n"
                    + $"  \"createdAt\": \"{DateTime.UtcNow:O}\",\n"
                    + "  \"payload\": { " + string.Join(", ", payload) + " }\n"
                    + "}\n";
                File.WriteAllText(actionPath, json);
                if (trackPending)
                {
                    TrackPendingAction(id, type, playerId);
                }
                else
                {
                    UpdateSyncStatusText();
                }
            }
            catch (Exception ex)
            {
                pendingActionId = "";
                pendingActionType = "";
                pendingActionPlayerId = "";
                pendingActionStartedAt = -1f;
                nextPendingViewModelPollAt = -1f;
                privateChatStatus = $"写入 Unity action 失败：{ex.Message}";
                UpdatePrivateChatPanelText();
                UpdateSyncStatusText();
                Debug.LogWarning($"Failed to write Unity action: {ex.Message}");
            }
        }

        private void TrackPendingAction(string id, string type, string playerId)
        {
            pendingActionId = id;
            pendingActionType = type;
            pendingActionPlayerId = playerId ?? "";
            pendingActionStartedAt = Time.realtimeSinceStartup;
            nextPendingViewModelPollAt = Time.realtimeSinceStartup + 0.2f;
            UpdateSyncStatusText();
        }

        private void ResolvePendingActionFromViewModel()
        {
            if (!HasPendingAction() || vm?.action == null || vm.action.lastActionId != pendingActionId) return;
            var completedType = pendingActionType;
            var ok = !string.Equals(vm.action.status, "error", StringComparison.OrdinalIgnoreCase);
            var message = string.IsNullOrWhiteSpace(vm.action.message) ? "JS Core 已刷新 viewmodel。" : vm.action.message;
            pendingActionId = "";
            pendingActionType = "";
            pendingActionPlayerId = "";
            pendingActionStartedAt = -1f;
            nextPendingViewModelPollAt = -1f;

            if (completedType == "private-chat" || completedType == "private-preset")
            {
                privateChatStatus = ok ? "JS Core 已刷新；AI 回复已写入最近私聊和时间线。" : $"JS Core 返回错误：{message}";
                UpdatePrivateChatPanelText();
            }
        }

        private static string JsonEscape(string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
        }

        private Image AddImage(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            go.transform.SetParent(parent, false);
            SetRect(go.GetComponent<RectTransform>(), anchorMin, anchorMax, offsetMin, offsetMax);
            var image = go.GetComponent<Image>();
            image.color = color;
            return image;
        }

        private Image AddCircleImage(string name, Transform parent, float radius, Color color, bool ring)
        {
            var image = AddImage(name, parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-radius, -radius), new Vector2(radius, radius), color);
            image.sprite = ring ? GetCircleRingSprite() : GetCircleFillSprite();
            image.preserveAspect = true;
            image.raycastTarget = false;
            return image;
        }

        private GameObject AddPanel(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax, Color color)
        {
            return AddImage(name, parent, anchorMin, anchorMax, offsetMin, offsetMax, color).gameObject;
        }

        private Text AddText(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax, string text, int size, TextAnchor anchor, FontStyle style)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            go.transform.SetParent(parent, false);
            SetRect(go.GetComponent<RectTransform>(), anchorMin, anchorMax, offsetMin, offsetMax);
            var label = go.GetComponent<Text>();
            label.font = GetUiFont(text, size, style);
            label.text = text;
            label.fontSize = size;
            label.alignment = anchor;
            label.fontStyle = style;
            label.color = new Color(0.98f, 0.91f, 0.78f, 1f);
            label.horizontalOverflow = HorizontalWrapMode.Wrap;
            label.verticalOverflow = VerticalWrapMode.Truncate;
            if (size >= 22 || style != FontStyle.Normal)
            {
                var shadow = go.AddComponent<Shadow>();
                shadow.effectColor = new Color(0f, 0f, 0f, 0.72f);
                shadow.effectDistance = new Vector2(2f, -2f);
            }
            return label;
        }

        private InputField AddInputField(string name, Transform parent, Vector2 offsetMin, Vector2 offsetMax, string placeholderText)
        {
            var panel = AddPanel(name, parent, Vector2.zero, Vector2.zero, offsetMin, offsetMax, new Color(0.020f, 0.026f, 0.032f, 0.92f));
            AddFrame(panel.transform, $"{name} Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.34f));
            var input = panel.AddComponent<InputField>();
            var text = AddText("Text", panel.transform, Vector2.zero, Vector2.one, new Vector2(10f, 2f), new Vector2(-10f, -2f), "", 14, TextAnchor.MiddleLeft, FontStyle.Normal);
            text.color = new Color(0.98f, 0.93f, 0.82f, 1f);
            text.supportRichText = false;
            var placeholder = AddText("Placeholder", panel.transform, Vector2.zero, Vector2.one, new Vector2(10f, 2f), new Vector2(-10f, -2f), placeholderText, 13, TextAnchor.MiddleLeft, FontStyle.Italic);
            placeholder.color = new Color(0.76f, 0.70f, 0.62f, 0.72f);
            input.textComponent = text;
            input.placeholder = placeholder;
            input.lineType = InputField.LineType.SingleLine;
            input.characterLimit = 120;
            input.caretColor = new Color(1f, 0.82f, 0.48f, 1f);
            input.selectionColor = new Color(0.8f, 0.55f, 0.25f, 0.36f);
            return input;
        }

        private Toggle AddToggle(string name, Transform parent, Vector2 anchoredPosition, string label)
        {
            var root = new GameObject(name, typeof(RectTransform), typeof(Toggle));
            root.transform.SetParent(parent, false);
            SetRect(root.GetComponent<RectTransform>(), Vector2.zero, Vector2.zero, anchoredPosition, anchoredPosition + new Vector2(320f, 32f));
            var box = AddImage("Box", root.transform, Vector2.zero, Vector2.zero, new Vector2(0f, 4f), new Vector2(20f, 24f), new Color(0.020f, 0.026f, 0.032f, 0.95f));
            AddFrame(box.transform, "Box Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.45f));
            var check = AddImage("Checkmark", box.transform, Vector2.zero, Vector2.one, new Vector2(4f, 4f), new Vector2(-4f, -4f), new Color(1f, 0.76f, 0.32f, 0.95f));
            AddText("Label", root.transform, Vector2.zero, Vector2.one, new Vector2(36f, 0f), Vector2.zero, label, 14, TextAnchor.MiddleLeft, FontStyle.Normal);
            var toggle = root.GetComponent<Toggle>();
            toggle.targetGraphic = box;
            toggle.graphic = check;
            toggle.isOn = false;
            return toggle;
        }

        private void AddFrame(Transform parent, string name, float thickness, Color color)
        {
            AddImage($"{name} Top", parent, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -thickness), new Vector2(0f, 0f), color);
            AddImage($"{name} Bottom", parent, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 0f), new Vector2(0f, thickness), color);
            AddImage($"{name} Left", parent, new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(thickness, 0f), color);
            AddImage($"{name} Right", parent, new Vector2(1f, 0f), new Vector2(1f, 1f), new Vector2(-thickness, 0f), new Vector2(0f, 0f), color);
        }

        private Button AddButton(string label, Transform parent, Vector2 anchoredPosition, Vector2 size, UnityEngine.Events.UnityAction onClick)
        {
            var half = size * 0.5f;
            var panel = AddPanel($"Button {label}", parent, Vector2.zero, Vector2.zero, anchoredPosition - half, anchoredPosition + half, new Color(0.18f, 0.095f, 0.036f, 0.82f));
            AddImage("Button Glow", panel.transform, new Vector2(0f, 0.55f), new Vector2(1f, 1f), new Vector2(3f, -3f), new Vector2(-3f, -3f), new Color(1f, 0.76f, 0.36f, 0.075f));
            AddImage("Button Left Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(3f, 0f), new Color(0.96f, 0.65f, 0.26f, 0.38f));
            AddFrame(panel.transform, "Button Frame", 0.9f, new Color(0.94f, 0.68f, 0.34f, 0.44f));
            var button = panel.AddComponent<Button>();
            button.onClick.AddListener(onClick);
            ApplyButtonStyle(button);
            var fontSize = size.y <= 28f ? 13 : label.Length > 8 ? 15 : 17;
            AddText("Label", panel.transform, Vector2.zero, Vector2.one, new Vector2(3f, 0f), new Vector2(-3f, 0f), label, fontSize, TextAnchor.MiddleCenter, FontStyle.Bold);
            return button;
        }

        private Button AddRoleTokenButton(Transform parent, string roleId, string roleName, string category, string team, Vector2 center, float tokenSize, bool selected, UnityEngine.Events.UnityAction onClick)
        {
            var width = tokenSize + 22f;
            var height = tokenSize + 36f;
            var root = AddPanel($"Role Token {roleId}", parent, Vector2.zero, Vector2.zero, center - new Vector2(width, height) * 0.5f, center + new Vector2(width, height) * 0.5f, new Color(0f, 0f, 0f, 0f));
            var rootImage = root.GetComponent<Image>();
            rootImage.raycastTarget = true;

            var button = root.AddComponent<Button>();
            button.targetGraphic = rootImage;
            ApplyButtonStyle(button);
            button.onClick.AddListener(onClick);

            var tokenBottom = 28f;
            var halo = AddImage("Role Halo", root.transform, Vector2.zero, Vector2.zero, new Vector2(5f, tokenBottom - 7f), new Vector2(width - 5f, tokenBottom + tokenSize + 7f), RoleHaloColor(category, team, selected));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;

            var token = AddImage("Role Parchment", root.transform, Vector2.zero, Vector2.zero, new Vector2(11f, tokenBottom), new Vector2(width - 11f, tokenBottom + tokenSize), Color.white);
            token.sprite = SpriteFromResource("Botc/ui/token1") ?? GetCircleFillSprite();
            token.preserveAspect = true;
            token.raycastTarget = false;

            var icon = AddImage("Role Icon", root.transform, Vector2.zero, Vector2.zero, new Vector2(18f, tokenBottom + 10f), new Vector2(width - 18f, tokenBottom + tokenSize - 14f), Color.white);
            icon.sprite = string.IsNullOrWhiteSpace(roleId) ? null : SpriteFromResource($"Botc/roles/{roleId}");
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            if (icon.sprite == null)
            {
                icon.color = new Color(1f, 1f, 1f, 0f);
                AddText("Role Fallback", root.transform, Vector2.zero, Vector2.zero, new Vector2(18f, tokenBottom + 10f), new Vector2(width - 18f, tokenBottom + tokenSize - 14f), RoleFallbackLabel(roleId, roleName), Mathf.RoundToInt(tokenSize * 0.30f), TextAnchor.MiddleCenter, FontStyle.Bold);
            }

            var label = AddText("Role Label", root.transform, Vector2.zero, Vector2.zero, new Vector2(0f, 0f), new Vector2(width, 30f), Ellipsize(string.IsNullOrWhiteSpace(roleName) ? roleId : roleName, tokenSize < 58f ? 4 : 7), tokenSize < 58f ? 11 : 13, TextAnchor.MiddleCenter, FontStyle.Bold);
            label.color = selected ? new Color(1f, 0.84f, 0.42f, 1f) : new Color(0.95f, 0.89f, 0.76f, 0.98f);
            return button;
        }

        private Button AddBlankRoleTokenButton(Transform parent, string label, Vector2 center, float tokenSize, bool selected, UnityEngine.Events.UnityAction onClick)
        {
            var button = AddRoleTokenButton(parent, "", label, "", "", center, tokenSize, selected, onClick);
            return button;
        }

        private Button AddNavButton(string label, Transform parent, Vector2 anchoredPosition, Vector2 size, UnityEngine.Events.UnityAction onClick)
        {
            var half = size * 0.5f;
            var panel = AddPanel($"Nav Button {label}", parent, Vector2.zero, Vector2.zero, anchoredPosition - half, anchoredPosition + half, new Color(0.060f, 0.036f, 0.018f, 0.56f));
            AddImage("Nav Button Wash", panel.transform, new Vector2(0f, 0.52f), new Vector2(1f, 1f), new Vector2(2f, -2f), new Vector2(-2f, -2f), new Color(0.85f, 0.54f, 0.20f, 0.065f));
            AddImage("Nav Button Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(3f, 0f), new Color(0.95f, 0.64f, 0.26f, 0.36f));
            AddFrame(panel.transform, "Nav Button Frame", 0.8f, new Color(0.88f, 0.60f, 0.28f, 0.26f));
            var button = panel.AddComponent<Button>();
            button.onClick.AddListener(onClick);
            ApplyButtonStyle(button);
            AddText("Label", panel.transform, Vector2.zero, Vector2.one, new Vector2(4f, 0f), new Vector2(-4f, 0f), label, label.Length > 5 ? 15 : 17, TextAnchor.MiddleCenter, FontStyle.Bold);
            return button;
        }

        private void AddMenuButton(string label, Transform parent, Vector2 anchoredPosition, UnityEngine.Events.UnityAction onClick)
        {
            AddButton(label, parent, anchoredPosition, new Vector2(350f, 46f), onClick);
        }

        private static void ApplyButtonStyle(Button button)
        {
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1f, 0.94f, 0.70f, 1f);
            colors.pressedColor = new Color(0.82f, 0.56f, 0.30f, 1f);
            colors.selectedColor = colors.highlightedColor;
            colors.disabledColor = new Color(0.25f, 0.23f, 0.22f, 0.55f);
            colors.fadeDuration = 0.12f;
            button.colors = colors;
        }

        private Text AddBadge(Transform parent, Vector2 position, string label, string count, Color color)
        {
            var panel = AddPanel($"Badge {label}", parent, Vector2.zero, Vector2.zero, position, position + new Vector2(50f, 22f), color);
            AddFrame(panel.transform, "Badge Frame", 0.7f, new Color(1f, 0.88f, 0.68f, 0.18f));
            var text = AddText("Badge Text", panel.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, $"{label}{count}", 14, TextAnchor.MiddleCenter, FontStyle.Bold);
            text.color = Color.white;
            return text;
        }

        private void UpdateSetupBadges()
        {
            var counts = ParseSetupCounts(vm.setup);
            if (townsfolkBadge != null) townsfolkBadge.text = $"民{counts[0]}";
            if (outsiderBadge != null) outsiderBadge.text = $"外{counts[1]}";
            if (minionBadge != null) minionBadge.text = $"爪{counts[2]}";
            if (demonBadge != null) demonBadge.text = $"恶{counts[3]}";
        }

        private static string[] ParseSetupCounts(string setup)
        {
            var result = new[] { "?", "?", "?", "?" };
            var text = setup ?? "";
            var labels = new[] { "民", "外", "爪", "恶" };
            for (var i = 0; i < labels.Length; i++)
            {
                var index = text.IndexOf(labels[i], StringComparison.Ordinal);
                if (index <= 0) continue;
                var start = index - 1;
                while (start >= 0 && char.IsDigit(text[start])) start--;
                var number = text.Substring(start + 1, index - start - 1);
                if (!string.IsNullOrWhiteSpace(number)) result[i] = number;
            }
            return result;
        }

        private void ToggleEventPanel()
        {
            if (eventPanelOpen && infoDrawerTab == "events")
            {
                eventPanelOpen = false;
            }
            else
            {
                ShowInfoDrawer("events");
            }
        }

        private void ToggleTimelinePanel()
        {
            if (eventPanelOpen && infoDrawerTab == "timeline")
            {
                eventPanelOpen = false;
                ApplyAuxPanelVisibility();
            }
            else
            {
                ShowInfoDrawer("timeline");
            }
        }

        private void ShowInfoDrawer(string tab)
        {
            CloseMoreActionsPanel();
            infoDrawerTab = string.IsNullOrWhiteSpace(tab) ? "events" : tab;
            eventPanelOpen = true;
            timelinePanelOpen = false;
            if (infoDrawerTitle != null) infoDrawerTitle.text = InfoDrawerTitle();
            if (eventBody != null) eventBody.text = BuildInfoDrawerMainText();
            if (queueBody != null) queueBody.text = BuildInfoDrawerSubText();
            UpdateInfoDrawerTabs();
            ApplyAuxPanelVisibility();
        }

        private void ToggleBottomDock()
        {
            bottomDockOpen = !bottomDockOpen;
            if (!bottomDockOpen) CloseMoreActionsPanel();
            ApplyBottomDockVisibility();
        }

        private void ToggleMoreActionsPanel()
        {
            moreActionsOpen = !moreActionsOpen;
            ApplyMoreActionsVisibility();
        }

        private void CloseMoreActionsPanel()
        {
            moreActionsOpen = false;
            ApplyMoreActionsVisibility();
        }

        private void CloseAuxPanels()
        {
            eventPanelOpen = false;
            timelinePanelOpen = false;
            ApplyAuxPanelVisibility();
        }

        private void HandleEscape()
        {
            if (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf)
            {
                CloseRolePicker();
                return;
            }
            if (endgamePanel != null && endgamePanel.gameObject.activeSelf)
            {
                CloseEndgamePanel();
                return;
            }
            if (moreActionsPanel != null && moreActionsPanel.gameObject.activeSelf)
            {
                CloseMoreActionsPanel();
                return;
            }
            if (privateChatPanel != null && privateChatPanel.gameObject.activeSelf)
            {
                privateChatPanel.gameObject.SetActive(false);
                return;
            }
            if (actionFormPanel != null && actionFormPanel.gameObject.activeSelf)
            {
                actionFormPanel.gameObject.SetActive(false);
                return;
            }
            if (storytellerPanel != null && storytellerPanel.gameObject.activeSelf)
            {
                storytellerPanel.gameObject.SetActive(false);
                return;
            }
            if (handbookPanel != null && handbookPanel.gameObject.activeSelf)
            {
                handbookPanel.gameObject.SetActive(false);
                return;
            }
            if (votePanel != null && votePanel.gameObject.activeSelf)
            {
                votePanel.gameObject.SetActive(false);
                return;
            }
            if (tokenInspectorPanel != null && tokenInspectorPanel.gameObject.activeSelf)
            {
                CloseTokenInspector();
                return;
            }
            if (eventPanelOpen || timelinePanelOpen)
            {
                eventPanelOpen = false;
                timelinePanelOpen = false;
                ApplyAuxPanelVisibility();
                return;
            }
            if (mainMenuRoot != null) ToggleMainMenu(!mainMenuRoot.gameObject.activeSelf);
        }

        private void CloseActiveModal()
        {
            if (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf)
            {
                CloseRolePicker();
                return;
            }
            if (endgamePanel != null && endgamePanel.gameObject.activeSelf)
            {
                CloseEndgamePanel();
                return;
            }
            if (privateChatPanel != null && privateChatPanel.gameObject.activeSelf)
            {
                privateChatPanel.gameObject.SetActive(false);
                ApplyModalBackdropVisibility();
                return;
            }
            if (actionFormPanel != null && actionFormPanel.gameObject.activeSelf)
            {
                actionFormPanel.gameObject.SetActive(false);
                ApplyModalBackdropVisibility();
                return;
            }
            if (storytellerPanel != null && storytellerPanel.gameObject.activeSelf)
            {
                storytellerPanel.gameObject.SetActive(false);
                ApplyModalBackdropVisibility();
                return;
            }
            if (handbookPanel != null && handbookPanel.gameObject.activeSelf)
            {
                handbookPanel.gameObject.SetActive(false);
                ApplyModalBackdropVisibility();
                return;
            }
            if (votePanel != null && votePanel.gameObject.activeSelf)
            {
                votePanel.gameObject.SetActive(false);
                ApplyModalBackdropVisibility();
            }
        }

        private void ApplyModalBackdropVisibility()
        {
            if (modalBackdrop == null) return;
            var visible =
                (privateChatPanel != null && privateChatPanel.gameObject.activeSelf)
                || (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf)
                || (endgamePanel != null && endgamePanel.gameObject.activeSelf)
                || (actionFormPanel != null && actionFormPanel.gameObject.activeSelf)
                || (storytellerPanel != null && storytellerPanel.gameObject.activeSelf)
                || (handbookPanel != null && handbookPanel.gameObject.activeSelf)
                || (votePanel != null && votePanel.gameObject.activeSelf);
            modalBackdrop.gameObject.SetActive(visible);
        }

        private void ApplyBottomDockVisibility()
        {
            if (bottomDock != null) bottomDock.gameObject.SetActive(bottomDockOpen);
            if (bottomDockToggle != null) bottomDockToggle.gameObject.SetActive(!bottomDockOpen);
            if (!bottomDockOpen) CloseMoreActionsPanel();
            else ApplyMoreActionsVisibility();
        }

        private void ApplyMoreActionsVisibility()
        {
            if (moreActionsPanel != null) moreActionsPanel.gameObject.SetActive(bottomDockOpen && moreActionsOpen);
        }

        private void CloseTokenInspector()
        {
            tokenInspectorOpen = false;
            ApplyTokenInspectorVisibility();
        }

        private void ApplyTokenInspectorVisibility()
        {
            var hasSelection = SelectedPlayer() != null;
            if (tokenInspectorPanel != null) tokenInspectorPanel.gameObject.SetActive(tokenInspectorOpen && hasSelection);
        }

        private void ApplyAuxPanelVisibility()
        {
            if (eventPanel != null) eventPanel.gameObject.SetActive(eventPanelOpen);
            if (timelinePanel != null) timelinePanel.gameObject.SetActive(false);
        }

        private void ToggleMainMenu(bool visible)
        {
            if (mainMenuRoot != null) mainMenuRoot.gameObject.SetActive(visible);
        }

        private void ShowMenuMessage(string message)
        {
            if (menuHint != null) menuHint.text = message;
        }

        private static void SetRect(RectTransform rt, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax)
        {
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = offsetMin;
            rt.offsetMax = offsetMax;
        }

        private Sprite SpriteFromResource(string path)
        {
            var texture = Resources.Load<Texture2D>(path);
            if (texture == null) return null;
            return Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(0.5f, 0.5f), 100f);
        }

        private Sprite GetCircleFillSprite()
        {
            if (circleFillSprite == null) circleFillSprite = CreateCircleSprite(false);
            return circleFillSprite;
        }

        private Sprite GetCircleRingSprite()
        {
            if (circleRingSprite == null) circleRingSprite = CreateCircleSprite(true);
            return circleRingSprite;
        }

        private static Sprite CreateCircleSprite(bool ring)
        {
            const int size = 512;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            var pixels = new Color32[size * size];
            var center = (size - 1) * 0.5f;
            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    var dx = (x - center) / center;
                    var dy = (y - center) / center;
                    var distance = Mathf.Sqrt(dx * dx + dy * dy);
                    var alpha = ring
                        ? Mathf.Clamp01((1f - SmoothStep(0.965f, 1.01f, distance)) * SmoothStep(0.925f, 0.965f, distance))
                        : 1f - SmoothStep(0.46f, 1.0f, distance);
                    pixels[y * size + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(alpha * 255f));
                }
            }
            texture.SetPixels32(pixels);
            texture.Apply(false, true);
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
        }

        private static float SmoothStep(float edge0, float edge1, float value)
        {
            var t = Mathf.Clamp01((value - edge0) / (edge1 - edge0));
            return t * t * (3f - 2f * t);
        }

        private Font GetUiFont(string text, int size, FontStyle style)
        {
            if (asciiFont == null) asciiFont = Resources.Load<Font>("Botc/fonts/piratesbay");
            if (size >= 34 && !ContainsCjk(text) && asciiFont != null) return asciiFont;
            if (size >= 22 || style != FontStyle.Normal)
            {
                if (titleFont == null) titleFont = Font.CreateDynamicFontFromOSFont(new[] { "KaiTi", "FZYaoti", "FZShuTi", "Microsoft YaHei", "SimHei", "Arial" }, 20);
                if (titleFont != null) return titleFont;
            }
            if (bodyFont == null) bodyFont = Font.CreateDynamicFontFromOSFont(new[] { "Microsoft YaHei", "SimHei", "KaiTi", "Arial" }, 18);
            return bodyFont != null ? bodyFont : Resources.GetBuiltinResource<Font>("Arial.ttf");
        }

        private static bool ContainsCjk(string text)
        {
            if (string.IsNullOrEmpty(text)) return false;
            foreach (var ch in text) if (ch >= 0x4E00 && ch <= 0x9FFF) return true;
            return false;
        }

        private static Color SuspicionColor(int suspicion)
        {
            if (suspicion >= 65) return new Color(0.78f, 0.14f, 0.11f, 0.68f);
            if (suspicion >= 42) return new Color(0.86f, 0.55f, 0.18f, 0.62f);
            return new Color(0.50f, 0.62f, 0.78f, 0.44f);
        }
    }

    [Serializable]
    public sealed class PrototypeViewModel
    {
        public int version;
        public string generatedAt;
        public string gameId;
        public string scriptId;
        public string scriptName;
        public string phase;
        public string dayStage;
        public string phaseLabel;
        public bool gameOver;
        public string winner;
        public string winnerReason;
        public GameOutcomeViewModel outcome;
        public int day;
        public int night;
        public int alive;
        public int dead;
        public string setup;
        public bool grimoireView;
        public string[] bluffs;
        public string phaseObjectiveTitle;
        public string phaseObjectiveHint;
        public PhaseAdvanceViewModel phaseAdvance;
        public string actionSummary;
        public string[] privateInfo;
        public string nightActionText;
        public string dayActionText;
        public string storytellerActionText;
        public string nominationText;
        public string privateDeceptionText;
        public string[] aiRecap;
        public AiRecapViewModel[] aiRecapDetails;
        public VoteCeremonyViewModel voteCeremony;
        public ActionFormViewModel[] actionForms;
        public string dialogueTitle;
        public string dialogueText;
        public string[] events;
        public string[] storytellerQueue;
        public TimelineEntryViewModel[] timeline;
        public ActionStatusViewModel action;
        public RoleActionViewModel humanNightAction;
        public RoleActionViewModel humanDayAction;
        public RoleActionViewModel pendingStorytellerAction;
        public ScriptHandbookViewModel scriptHandbook;
        public PlayerViewModel[] players;

        public static PrototypeViewModel CreateFallback()
        {
            return new PrototypeViewModel
            {
                version = 1,
                scriptName = "暗流涌动",
                phase = "day",
                dayStage = "private",
                phaseLabel = "私聊阶段",
                gameOver = false,
                winner = "",
                winnerReason = "",
                outcome = new GameOutcomeViewModel(),
                day = 1,
                night = 1,
                alive = 9,
                dead = 0,
                setup = "5T/2O/1M/1D",
                bluffs = new[] { "未知", "未知", "未知" },
                phaseObjectiveTitle = "私聊收集线索",
                phaseObjectiveHint = "备用视图模型已载入；连接 JS Core 后会显示真实阶段目标。",
                phaseAdvance = new PhaseAdvanceViewModel
                {
                    blocked = true,
                    canAdvance = false,
                    requiresConfirm = false,
                    targetStage = "",
                    label = "阶段推进",
                    reason = "等待 JS Core 同步。",
                    hint = "启动 bridge 后会显示真实推进状态。",
                    blockers = new[] { "等待 JS Core 同步。" },
                    warnings = Array.Empty<string>(),
                    confirmText = ""
                },
                actionSummary = "行动状态：尚未连接 JS Core。",
                privateInfo = Array.Empty<string>(),
                nightActionText = "夜间行动：等待 JS Core 同步。",
                dayActionText = "白天行动：等待 JS Core 同步。",
                storytellerActionText = "Storyteller：等待 JS Core 同步。",
                nominationText = "提名与投票：等待 JS Core 同步。",
                privateDeceptionText = "私聊骗人接口：等待 JS Core 同步。",
                aiRecap = Array.Empty<string>(),
                aiRecapDetails = Array.Empty<AiRecapViewModel>(),
                actionForms = Array.Empty<ActionFormViewModel>(),
                dialogueTitle = "对话舞台",
                dialogueText = "点击 token 查看玩家信息。",
                events = new[] { "已载入备用视图模型。", "如果看到这条信息，说明 unity_viewmodel.json 未找到。" },
                storytellerQueue = new[] { "当前尚未连接 JS Core 行动。" },
                timeline = Array.Empty<TimelineEntryViewModel>(),
                players = Array.Empty<PlayerViewModel>()
            };
        }
    }

    [Serializable] public sealed class PhaseAdvanceViewModel { public bool blocked; public bool canAdvance; public bool requiresConfirm; public string targetStage; public string label; public string reason; public string hint; public string[] blockers; public string[] warnings; public string confirmText; }
    [Serializable] public sealed class GameOutcomeViewModel { public bool gameOver; public string winner; public string winnerLabel; public string title; public string reason; public string summary; public int alive; public int dead; public string[] finalEvents; }
    [Serializable] public sealed class RoleActionViewModel { public bool available; public string reason; public string roleId; public string roleName; public string inputType; public string prompt; public int minTargetCount; public int maxTargetCount; public int targetCount; public bool allowSelf; public bool allowDead; public ActionModeViewModel[] modes; public ActionOptionViewModel[] options; public ActionRoleOptionViewModel[] roleOptions; public string[] selectedTargetIds; }
    [Serializable] public sealed class ActionFormViewModel { public string id; public string title; public bool available; public string reason; public string roleId; public string roleName; public string inputType; public string prompt; public int minTargetCount; public int maxTargetCount; public int targetCount; public ActionOptionViewModel[] options; public ActionRoleOptionViewModel[] roleOptions; public ActionModeViewModel[] modes; public string[] selectedTargetIds; }
    [Serializable] public sealed class ActionModeViewModel { public string id; public string label; }
    [Serializable] public sealed class ActionOptionViewModel { public string id; public string name; public int seat; public string roleId; public string roleName; public bool alive; public string team; public string category; }
    [Serializable] public sealed class ActionRoleOptionViewModel { public string id; public string name; public string category; public string team; }
    [Serializable] public sealed class VoteCeremonyViewModel { public int day; public string nominatorId; public string nominatorName; public string nomineeId; public string nomineeName; public int yesVotes; public int threshold; public bool passed; public string resultText; public VoteViewModel[] voters; }
    [Serializable] public sealed class VoteViewModel { public string voterId; public string voterName; public int seat; public bool alive; public bool ghostVote; public bool vote; public bool abstain; }
    [Serializable] public sealed class AiRecapViewModel { public string id; public string name; public string targetId; public string target; public string score; public string reason; public AiRecapTargetViewModel[] targets; }
    [Serializable] public sealed class AiRecapTargetViewModel { public string id; public string name; public string score; public float scoreValue; public string reason; public AiTrailViewModel[] trail; }
    [Serializable] public sealed class AiTrailViewModel { public string reasonKey; public string evidenceKind; public float before; public float after; public float appliedDelta; public string reason; }
    [Serializable] public sealed class ScriptHandbookViewModel { public bool open; public string activeTab; public string scriptId; public string scriptName; public ScriptRoleViewModel[] roles; public string[] firstNightOrder; public string[] otherNightOrder; }
    [Serializable] public sealed class ScriptRoleViewModel { public string id; public string name; public string category; public string team; public string ability; public string icon; }
    [Serializable] public sealed class ActionStatusViewModel { public int revision; public string lastActionId; public string lastActionType; public string status; public string message; public string updatedAt; public string selectedPlayerId; public string selectedPlayerName; }
    [Serializable] public sealed class TimelineEntryViewModel { public string id; public string mode; public string speakerId; public string targetId; public string text; public int day; public int night; }
    [Serializable] public sealed class PlayerViewModel { public string id; public int seat; public string name; public string roleId; public string roleName; public string actualRoleId; public string perceivedRoleId; public string markedRoleId; public string markedRoleName; public bool revealed; public bool alive; public bool human; public bool ghostVoteAvailable; public int suspicion; public string[] reminders; }
}
