using System;
using System.Collections;
using System.Collections.Generic;
using DiagnosticsProcess = System.Diagnostics.Process;
using DiagnosticsProcessStartInfo = System.Diagnostics.ProcessStartInfo;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap : MonoBehaviour
    {
        private const float TokenSize = 128f;
        private const float RoleIconSize = 78f;
        private const float BridgeTimeoutSeconds = 3f;
        private const float PendingViewModelPollSeconds = 0.35f;
        private const int ActionChoicePageSize = 10;
        private const int HandbookRolePageSize = 15;
        private const int RolePickerPageSize = 29;
        private const int ReminderPickerPageSize = 30;
        private const int StorytellerQueuePageSize = 4;
        private const int StageDialogueQueueLimit = 24;
        private static readonly Vector2Int[] ResolutionPresets =
        {
            new Vector2Int(1280, 720),
            new Vector2Int(1600, 900),
            new Vector2Int(1920, 1080),
            new Vector2Int(2560, 1440),
        };

        private const string SettingsResolutionKey = "BotcSolo.Unity.ResolutionIndex";
        private const string SettingsFullscreenKey = "BotcSolo.Unity.Fullscreen";
        private const string SettingsMasterVolumeKey = "BotcSolo.Unity.MasterVolume";
        private const string SettingsMusicVolumeKey = "BotcSolo.Unity.MusicVolume";
        private const string SettingsUiVolumeKey = "BotcSolo.Unity.UiVolume";
        private const string SettingsLocalLlmRendererKey = "BotcSolo.Unity.ExperimentalLocalLlmRenderer";

        private sealed class StageDialogueEntry
        {
            public readonly string speaker;
            public readonly string body;
            public readonly string tag;
            public readonly string speakerId;
            public readonly string targetId;

            public StageDialogueEntry(string speaker, string body, string tag, string speakerId = "", string targetId = "")
            {
                this.speaker = speaker ?? "";
                this.body = body ?? "";
                this.tag = tag ?? "";
                this.speakerId = speakerId ?? "";
                this.targetId = targetId ?? "";
            }
        }

        private Canvas canvas;
        private Font bodyFont;
        private Font titleFont;
        private Font asciiFont;
        private RectTransform grimoireRoot;
        private RectTransform topHudRoot;
        private RectTransform phaseRailRoot;
        private RectTransform infoRailRoot;
        private RectTransform bottomDock;
        private RectTransform bottomDockToggle;
        private RectTransform stageDialoguePanel;
        private RectTransform moreActionsPanel;
        private RectTransform proactiveWhisperPanel;
        private RectTransform phaseAssistPanel;
        private RectTransform nominationDebatePanel;
        private RectTransform tokenInspectorPanel;
        private RectTransform tokenInspectorRoleRoot;
        private RectTransform eventPanel;
        private Vector2 eventPanelTargetOffsetMin;
        private Vector2 eventPanelTargetOffsetMax;
        private RectTransform timelinePanel;
        private RectTransform mainMenuRoot;
        private RectTransform settingsPanel;
        private RectTransform modalBackdrop;
        private RectTransform ambientFogA;
        private RectTransform ambientFogB;
        private RectTransform ambientGlowRoot;
        private RectTransform privateChatPanel;
        private RectTransform privateTargetCardRoot;
        private RectTransform privateDialogueRoot;
        private RectTransform privateTargetPickerRoot;
        private RectTransform privateClaimRoleGridRoot;
        private ScrollRect privateDialogueScroll;
        private RectTransform actionFormPanel;
        private RectTransform actionTargetBar;
        private RectTransform actionOptionRoot;
        private RectTransform storytellerPanel;
        private RectTransform storytellerQueueListRoot;
        private RectTransform storytellerDetailRoot;
        private RectTransform storytellerTargetRoot;
        private RectTransform handbookPanel;
        private RectTransform handbookRoleListRoot;
        private RectTransform handbookDetailTokenRoot;
        private RectTransform rolePickerPanel;
        private RectTransform rolePickerGridRoot;
        private RectTransform reminderPickerPanel;
        private RectTransform reminderPickerGridRoot;
        private RectTransform reminderPickerPreviewRoot;
        private RectTransform votePanel;
        private RectTransform voteAnimationRoot;
        private RectTransform voteAnimationRowsRoot;
        private RectTransform endgamePanel;
        private RectTransform phaseTransitionRoot;
        private RectTransform phaseTransitionContent;
        private CanvasGroup phaseTransitionGroup;
        private Image phaseTransitionTint;
        private Image phaseTransitionGlow;
        private Image phaseTransitionHorizon;
        private Text phaseTransitionKickerText;
        private Text phaseTransitionTitleText;
        private Text phaseTransitionSubtitleText;
        private Text phaseTransitionHintText;
        private Text headerText;
        private Text vitalsText;
        private Text phaseText;
        private Text syncStatusText;
        private Text tickerText;
        private Image syncStatusPill;
        private Text dialogueTitle;
        private Text dialogueBody;
        private Text stageDialogueSpeakerText;
        private Text stageDialogueBodyText;
        private Text stageDialogueTagText;
        private Text stageDialoguePortraitText;
        private Text stageDialogueMetaText;
        private Text stageDialogueContinueText;
        private Text stageDialogueSourceText;
        private Image stageDialoguePortraitTokenImage;
        private Image stageDialoguePortraitRoleImage;
        private Image proactiveWhisperTokenImage;
        private Text proactiveWhisperTitleText;
        private Text proactiveWhisperBodyText;
        private Text proactiveWhisperMetaText;
        private Text proactiveWhisperQueueText;
        private Text phaseAssistTitleText;
        private Text phaseAssistHintText;
        private Image phaseAssistProgressFill;
        private Button phaseAssistPrimaryButton;
        private Button phaseAssistSecondaryButton;
        private Button phaseAssistTertiaryButton;
        private Text phaseAssistPrimaryLabel;
        private Text phaseAssistSecondaryLabel;
        private Text phaseAssistTertiaryLabel;
        private Text nominationDebateTitleText;
        private Text nominationDebateBodyText;
        private InputField nominationDebateResponseInput;
        private Button nominationDebateResponseButton;
        private Text tokenInspectorTitle;
        private Text tokenInspectorBody;
        private Text objectiveTitleText;
        private Text objectiveHintText;
        private Text actionSummaryText;
        private Text flowGuideText;
        private Text nextPhaseButtonLabelText;
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
        private Text actionTargetBarStatusText;
        private Text actionFormTitle;
        private Text actionFormBody;
        private Text actionFormStatusText;
        private Button nextPhaseButton;
        private Button actionFormAutoButton;
        private Button actionFormSubmitButton;
        private Text storytellerTitle;
        private Text storytellerBody;
        private Text handbookTitle;
        private Text handbookDetailText;
        private Text handbookOrderText;
        private Text reminderPickerTitle;
        private Text reminderPickerStatusText;
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
        private Text settingsResolutionText;
        private Text settingsFullscreenText;
        private Text settingsMasterVolumeText;
        private Text settingsMusicVolumeText;
        private Text settingsUiVolumeText;
        private Text settingsLocalLlmRendererText;
        private Text settingsStatusText;
        private Text menuSetupScriptText;
        private Text menuSetupPlayerCountText;
        private Text menuSetupRoleText;
        private Text menuSetupSummaryText;
        private Image background;
        private Image ambientFogAImage;
        private Image ambientFogBImage;
        private Image ambientGlowImage;
        private Image ambientMoonImage;
        private AudioSource musicSource;
        private AudioSource uiAudioSource;
        private AudioClip typeTickClip;
        private string currentMood = "";
        private Sprite circleFillSprite;
        private Sprite circleRingSprite;
        private PrototypeViewModel vm;
        private DiagnosticsProcess bridgeProcess;
        private DiagnosticsProcess localLlmProcess;
        private string viewModelPath;
        private string actionPath;
        private string statePath;
        private string resultPath;
        private string localLlmEndpoint = "";
        private string localLlmModelPath = "";
        private string bridgeLaunchStatus = "";
        private DateTime viewModelLastWriteUtc;
        private bool bridgeProcessStartedByUnity;
        private bool localLlmProcessStartedByUnity;
        private bool bridgeLaunchProblem;
        private int settingsResolutionIndex = 2;
        private bool settingsFullscreen = true;
        private float settingsMasterVolume = 1f;
        private float settingsMusicVolume = 0.34f;
        private float settingsUiVolume = 0.22f;
        private bool settingsLocalLlmRenderer;
        private string menuSetupScriptId = "tb";
        private int menuSetupPlayerCount = 9;
        private int menuSetupRoleIndex;
        private MenuSetupCatalog menuSetupCatalog;
        private bool gameplayEntered;
        private bool entryDialogueShown;
        private Coroutine delayedEntryDialogueRoutine;
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
        private int storytellerQueuePage;
        private InputField actionQuestionInput;
        private string activeHandbookCategory = "all";
        private int activeHandbookRoleIndex;
        private int activeHandbookRolePage;
        private string activeRolePickerMode = "";
        private string activeRolePickerPlayerId = "";
        private string activeRolePickerCategory = "all";
        private int activeRolePickerPage;
        private string activeReminderPlayerId = "";
        private int activeReminderPage;
        private bool reopenReminderPickerAfterRoleMark;
        private InputField reminderCustomInput;
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
        private Coroutine phaseTransitionRoutine;
        private Coroutine delayedPhaseActionRoutine;
        private Coroutine stageDialogueRoutine;
        private string queuedPhaseTransitionStage = "";
        private bool queuedPhaseTransitionPending;
        private string lastPhaseTransitionKey = "";
        private string lastTimelineNarrationKey = "";
        private string lastPrivateInfoNarrationKey = "";
        private string lastNightActionNarrationKey = "";
        private bool hasPendingPostPhaseNarration;
        private string pendingPostPhaseTimelinePreviousKey = "";
        private string pendingPostPhaseTimelineNextKey = "";
        private string pendingPostPhasePrivateInfoPreviousKey = "";
        private string pendingPostPhasePrivateInfoNextKey = "";
        private string pendingPostPhaseNightActionPreviousKey = "";
        private string pendingPostPhaseNightActionNextKey = "";
        private bool hasQueuedPhaseTransitionAfterDialogue;
        private string queuedPhaseTransitionAfterDialogueStage = "";
        private bool queuedPhaseTransitionAfterDialoguePending;
        private readonly List<string> stageDialoguePages = new List<string>();
        private readonly Queue<StageDialogueEntry> stageDialogueQueue = new Queue<StageDialogueEntry>();
        private int stageDialoguePageIndex;
        private bool stageDialogueTyping;
        private string stageDialogueCurrentPageText = "";
        private string stageDialogueSourceMode = "events";
        private string stageDialogueFocusPlayerId = "";
        private string lastProactiveOfferQueueKey = "";
        private string snoozedProactiveOfferId = "";
        private string lastProactiveWhisperRequestKey = "";
        private readonly Dictionary<RectTransform, Coroutine> panelMotionRoutines = new Dictionary<RectTransform, Coroutine>();
        private readonly List<Image> selectedTokenPulseImages = new List<Image>();
        private readonly List<RectTransform> selectedTokenPulseRects = new List<RectTransform>();
        private readonly List<Image> dialogueTokenPulseImages = new List<Image>();
        private readonly List<RectTransform> dialogueTokenPulseRects = new List<RectTransform>();
        private readonly List<Image> suggestedButtonGlows = new List<Image>();
        private readonly List<Text> suggestedButtonMarkers = new List<Text>();
        private float selectionPulseStartTime = -10f;
        private float dialoguePulseStartTime = -10f;
        private string stageDialogueSpeakerPlayerId = "";
        private string stageDialogueTargetPlayerId = "";
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
            LoadLocalSettings();
            ApplyDisplaySettings();
            ConfigureBridgePaths();
            StartUnityBridgeIfAvailable();
            vm = LoadViewModel();
            lastPhaseTransitionKey = PhaseTransitionKey(vm);
            lastTimelineNarrationKey = LatestTimelineNarrationKey(vm);
            lastPrivateInfoNarrationKey = PrivateInfoNarrationKey(vm);
            lastNightActionNarrationKey = NightActionNarrationKey(vm);
            RememberViewModelTimestamp();
            BuildScene();
            RenderAll();
            ApplyMainMenuState(true);
            ApplyUiSmokeMode();
            StartCoroutine(CaptureUiSmokeScreenshotIfRequested());
            SetMood(MoodFromState());
            ApplyAudioSettings();
        }

        private void Update()
        {
            UpdateBridgeProcessStatus();
            PollViewModelChanges();
            UpdateVoteAnimationFrame();
            UpdateSelectedTokenPulse();
            UpdateDialogueTokenPulse();
            UpdateSuggestedButtonPulse();
            UpdateAmbientMotion();
            UpdatePhaseAssistProgress();
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
            StopLocalLlmProcess();
        }

        private void OnDestroy()
        {
            StopUnityBridgeProcess();
            StopLocalLlmProcess();
        }

        private void BuildScene()
        {
            EnsureEventSystem();
            BuildCanvas();
            BuildTopHud();
            BuildGrimoire();
            BuildSideControls();
            BuildBottomDock();
            BuildStageDialoguePanel();
            BuildMoreActionsPanel();
            BuildProactiveWhisperPanel();
            BuildPhaseAssistPanel();
            BuildNominationDebatePanel();
            BuildTokenInspectorPanel();
            BuildModalBackdrop();
            BuildPrivateChatPanel();
            BuildActionFormPanel();
            BuildStorytellerPanel();
            BuildHandbookPanel();
            BuildVotePanel();
            BuildEndgamePanel();
            BuildRolePickerPanel();
            BuildReminderPickerPanel();
            BuildEventPanel();
            BuildTimelinePanel();
            BuildSettingsPanel();
            BuildMainMenu();
            BuildPhaseTransitionOverlay();
            musicSource = gameObject.AddComponent<AudioSource>();
            musicSource.loop = true;
            musicSource.volume = 0.34f;
            uiAudioSource = gameObject.AddComponent<AudioSource>();
            uiAudioSource.loop = false;
            uiAudioSource.playOnAwake = false;
            uiAudioSource.volume = 0.22f;
            typeTickClip = CreateTypeTickClip();
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
            BuildAmbientLayer();
        }

        private void BuildAmbientLayer()
        {
            ambientGlowImage = AddCircleImage("Ambient Breathing Glow", canvas.transform, 620f, new Color(1f, 0.78f, 0.38f, 0.035f), false);
            ambientGlowRoot = ambientGlowImage.rectTransform;
            ambientMoonImage = AddCircleImage("Ambient Moon Veil", canvas.transform, 210f, new Color(0.78f, 0.86f, 1f, 0.050f), false);
            ambientMoonImage.rectTransform.anchorMin = ambientMoonImage.rectTransform.anchorMax = new Vector2(0.63f, 0.78f);
            ambientFogAImage = AddImage("Ambient Fog A", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-1120f, 28f), new Vector2(1120f, 238f), new Color(0.62f, 0.72f, 0.78f, 0.040f));
            ambientFogA = ambientFogAImage.rectTransform;
            ambientFogBImage = AddImage("Ambient Fog B", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-980f, 148f), new Vector2(980f, 330f), new Color(0.50f, 0.58f, 0.66f, 0.030f));
            ambientFogB = ambientFogBImage.rectTransform;
            foreach (var image in new[] { ambientGlowImage, ambientMoonImage, ambientFogAImage, ambientFogBImage })
            {
                if (image != null) image.raycastTarget = false;
            }
        }

        private void BuildTopHud()
        {
            var hud = AddPanel("Top Hud Root", canvas.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-830f, -88f), new Vector2(830f, -14f), new Color(0f, 0f, 0f, 0f));
            topHudRoot = hud.GetComponent<RectTransform>();
            var hudImage = hud.GetComponent<Image>();
            if (hudImage != null) hudImage.raycastTarget = false;

            var leftPod = AddPanel("Top Left Pod", hud.transform, Vector2.zero, Vector2.zero, new Vector2(0f, 0f), new Vector2(560f, 74f), new Color(0.010f, 0.012f, 0.014f, 0.78f));
            AddFrame(leftPod.transform, "Top Left Frame", 1f, new Color(0.85f, 0.62f, 0.32f, 0.26f));
            AddImage("Top Left Warm Strip", leftPod.transform, Vector2.zero, new Vector2(1f, 0.36f), new Vector2(0f, 0f), new Vector2(0f, 1.5f), new Color(0.74f, 0.48f, 0.18f, 0.055f));

            var rightPod = AddPanel("Top Right Pod", hud.transform, Vector2.zero, Vector2.zero, new Vector2(1014f, 0f), new Vector2(1660f, 74f), new Color(0.010f, 0.012f, 0.014f, 0.78f));
            AddFrame(rightPod.transform, "Top Right Frame", 1f, new Color(0.85f, 0.62f, 0.32f, 0.26f));
            AddImage("Top Right Warm Strip", rightPod.transform, Vector2.zero, new Vector2(1f, 0.36f), new Vector2(0f, 0f), new Vector2(0f, 1.5f), new Color(0.74f, 0.48f, 0.18f, 0.055f));

            headerText = AddText("Header", leftPod.transform, Vector2.zero, Vector2.one, new Vector2(24f, 34f), new Vector2(-326f, -8f), "BOTC SOLO", 31, TextAnchor.UpperLeft, FontStyle.Bold);
            tickerText = AddText("Ticker", leftPod.transform, Vector2.zero, Vector2.one, new Vector2(24f, 8f), new Vector2(-16f, -48f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            tickerText.color = new Color(0.84f, 0.88f, 0.90f, 0.90f);

            townsfolkBadge = null;
            outsiderBadge = null;
            minionBadge = null;
            demonBadge = null;

            vitalsText = AddText("Vitals", rightPod.transform, Vector2.zero, Vector2.one, new Vector2(18f, 44f), new Vector2(-420f, -6f), "", 15, TextAnchor.MiddleLeft, FontStyle.Bold);
            phaseText = AddText("Phase", rightPod.transform, Vector2.zero, Vector2.one, new Vector2(196f, 44f), new Vector2(-16f, -6f), "", 16, TextAnchor.MiddleRight, FontStyle.Normal);
            syncStatusPill = AddPanel("Sync Status Pill", rightPod.transform, Vector2.zero, Vector2.one, new Vector2(18f, 44f), new Vector2(-420f, -6f), new Color(0.05f, 0.09f, 0.07f, 0.46f)).GetComponent<Image>();
            syncStatusPill.transform.SetAsFirstSibling();
            AddFrame(syncStatusPill.transform, "Sync Status Pill Frame", 0.8f, new Color(0.76f, 0.92f, 0.66f, 0.16f));
            syncStatusText = AddText("Sync Status", rightPod.transform, Vector2.zero, Vector2.one, new Vector2(28f, 44f), new Vector2(-430f, -6f), "", 12, TextAnchor.MiddleRight, FontStyle.Bold);
            AddButton("新局", rightPod.transform, new Vector2(58f, 22f), new Vector2(92f, 32f), () => SelectDialoguePreset("new-game"));
            AddButton("剧本手册", rightPod.transform, new Vector2(190f, 22f), new Vector2(132f, 32f), () => SelectDialoguePreset("handbook"));
            AddButton("主菜单", rightPod.transform, new Vector2(326f, 22f), new Vector2(104f, 32f), () => ToggleMainMenu(true));
            AddButton("设置", rightPod.transform, new Vector2(448f, 22f), new Vector2(82f, 32f), OpenSettingsPanel);
        }

        private void BuildSideControls()
        {
            var phaseDock = AddPanel("Phase Rail", canvas.transform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(18f, -176f), new Vector2(174f, 176f), new Color(0.006f, 0.013f, 0.020f, 0.22f)).GetComponent<RectTransform>();
            phaseRailRoot = phaseDock;
            AddFrame(phaseDock, "Phase Rail Frame", 0.8f, new Color(0.82f, 0.56f, 0.25f, 0.18f));
            AddImage("Phase Rail Wash", phaseDock, Vector2.zero, Vector2.one, new Vector2(4f, 4f), new Vector2(-4f, -4f), new Color(0.12f, 0.075f, 0.030f, 0.10f));
            AddText("Phase Dock Title", phaseDock, Vector2.zero, Vector2.one, new Vector2(20f, 294f), new Vector2(-18f, -12f), "流程", 22, TextAnchor.UpperLeft, FontStyle.Bold);
            flowGuideText = AddText("Flow Guide", phaseDock, Vector2.zero, Vector2.one, new Vector2(18f, 196f), new Vector2(-16f, -72f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            AddNavButton("☀ 公聊", phaseDock, new Vector2(78f, 110f), new Vector2(132f, 44f), () => SelectDialoguePreset("public"));
            AddNavButton("⚖ 提名", phaseDock, new Vector2(78f, 46f), new Vector2(132f, 44f), () => SelectDialoguePreset("nomination"));

            var infoDock = AddPanel("Info Rail", canvas.transform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-174f, -176f), new Vector2(-18f, 176f), new Color(0.006f, 0.013f, 0.020f, 0.22f)).GetComponent<RectTransform>();
            infoRailRoot = infoDock;
            AddFrame(infoDock, "Info Rail Frame", 0.8f, new Color(0.82f, 0.56f, 0.25f, 0.18f));
            AddImage("Info Rail Wash", infoDock, Vector2.zero, Vector2.one, new Vector2(4f, 4f), new Vector2(-4f, -4f), new Color(0.12f, 0.075f, 0.030f, 0.10f));
            AddText("Info Dock Title", infoDock, Vector2.zero, Vector2.one, new Vector2(20f, 294f), new Vector2(-18f, -12f), "资料", 22, TextAnchor.UpperLeft, FontStyle.Bold);
            AddNavButton("☷ 日志", infoDock, new Vector2(78f, 238f), new Vector2(132f, 44f), ToggleEventPanel);
            AddNavButton("✦ 时间线", infoDock, new Vector2(78f, 174f), new Vector2(132f, 44f), ToggleTimelinePanel);
            nextPhaseButton = AddNavButton("下一阶段", infoDock, new Vector2(78f, 110f), new Vector2(132f, 44f), () => CyclePhase("next"));
            nextPhaseButtonLabelText = nextPhaseButton.GetComponentInChildren<Text>();
            AddNavButton("◉ 全知", infoDock, new Vector2(78f, 46f), new Vector2(132f, 44f), () => SelectDialoguePreset("grimoire"));
        }

        private void BuildBottomDock()
        {
            bottomDock = AddPanel("Bottom Dock", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-830f, 14f), new Vector2(830f, 174f), new Color(0.006f, 0.014f, 0.024f, 0.70f)).GetComponent<RectTransform>();
            AddFrame(bottomDock, "Bottom Dock Frame", 1f, new Color(0.82f, 0.56f, 0.25f, 0.24f));
            AddImage("Bottom Left Wash", bottomDock, Vector2.zero, Vector2.one, new Vector2(16f, 12f), new Vector2(-1110f, -12f), new Color(0.020f, 0.028f, 0.036f, 0.20f));
            AddImage("Bottom Middle Wash", bottomDock, Vector2.zero, Vector2.one, new Vector2(548f, 12f), new Vector2(-570f, -12f), new Color(0.020f, 0.028f, 0.036f, 0.16f));
            AddImage("Bottom Actions Wash", bottomDock, Vector2.zero, Vector2.one, new Vector2(1104f, 12f), new Vector2(-16f, -12f), new Color(0.020f, 0.028f, 0.036f, 0.18f));
            AddImage("Bottom Divider Left", bottomDock, Vector2.zero, new Vector2(0f, 1f), new Vector2(532f, 16f), new Vector2(533f, -16f), new Color(0.95f, 0.65f, 0.28f, 0.14f));
            AddImage("Bottom Divider Right", bottomDock, Vector2.zero, new Vector2(0f, 1f), new Vector2(1088f, 16f), new Vector2(1089f, -16f), new Color(0.95f, 0.65f, 0.28f, 0.14f));
            objectiveTitleText = AddText("Objective Title", bottomDock, Vector2.zero, Vector2.one, new Vector2(34f, 124f), new Vector2(-1124f, -10f), "阶段目标", 21, TextAnchor.UpperLeft, FontStyle.Bold);
            objectiveHintText = AddText("Objective Hint", bottomDock, Vector2.zero, Vector2.one, new Vector2(34f, 96f), new Vector2(-1124f, -42f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            dialogueTitle = AddText("Dialogue Title", bottomDock, Vector2.zero, Vector2.one, new Vector2(34f, 68f), new Vector2(-1124f, -78f), "对话舞台", 19, TextAnchor.UpperLeft, FontStyle.Bold);
            dialogueBody = AddText("Dialogue Body", bottomDock, Vector2.zero, Vector2.one, new Vector2(34f, 24f), new Vector2(-1124f, -110f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            actionSummaryText = AddText("Action Summary", bottomDock, Vector2.zero, Vector2.one, new Vector2(574f, 24f), new Vector2(-590f, -20f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            AddToolActionButton("私", "私聊", bottomDock, new Vector2(1180f, 112f), new Vector2(124f, 38f), () => SelectDialoguePreset("private"));
            AddToolActionButton("公", "公聊", bottomDock, new Vector2(1320f, 112f), new Vector2(124f, 38f), () => SelectDialoguePreset("public"));
            AddToolActionButton("提", "提名", bottomDock, new Vector2(1460f, 112f), new Vector2(124f, 38f), () => SelectDialoguePreset("nomination"));
            AddToolActionButton("行", "行动", bottomDock, new Vector2(1180f, 58f), new Vector2(124f, 38f), SelectPrimaryAction);
            AddToolActionButton("票", "投票", bottomDock, new Vector2(1320f, 58f), new Vector2(124f, 38f), () => SelectDialoguePreset("vote-panel"));
            AddToolActionButton("多", "更多", bottomDock, new Vector2(1460f, 58f), new Vector2(124f, 38f), ToggleMoreActionsPanel);
            AddButton("收起", bottomDock, new Vector2(1580f, 138f), new Vector2(72f, 28f), ToggleBottomDock);
            bottomDockToggle = AddButton("对话 / 行动", canvas.transform, new Vector2(960f, 40f), new Vector2(172f, 38f), ToggleBottomDock).GetComponent<RectTransform>();
            bottomDockToggle.gameObject.SetActive(false);
        }

        private void BuildMoreActionsPanel()
        {
            moreActionsPanel = AddPanel("More Actions Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(150f, 184f), new Vector2(720f, 416f), new Color(0.005f, 0.012f, 0.020f, 0.90f)).GetComponent<RectTransform>();
            AddFrame(moreActionsPanel, "More Actions Frame", 1f, new Color(0.92f, 0.62f, 0.28f, 0.36f));
            AddImage("More Actions Header Wash", moreActionsPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -62f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.060f));
            AddText("More Actions Title", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(20f, 188f), new Vector2(-20f, -12f), "更多动作", 23, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("More Actions Hint", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(410f, 196f), new Vector2(-18f, -18f), "", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddText("More Actions Body", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(22f, 152f), new Vector2(-22f, -56f), "低频工具收在这里，底部只保留对局中最高频的入口。", 13, TextAnchor.UpperLeft, FontStyle.Normal);

            AddMoreActionButton("询", "询身", 0, () => SelectDialoguePreset("ask-claim"));
            AddMoreActionButton("骗", "骗身", 1, () => SelectDialoguePreset("decept-claim"));
            AddMoreActionButton("密", "保密", 2, () => SelectDialoguePreset("decept-secret"));
            AddMoreActionButton("信", "编夜信", 3, () => SelectDialoguePreset("decept-night"));
            AddMoreActionButton("夜", "夜间", 4, () => SelectDialoguePreset("night"));
            AddMoreActionButton("昼", "白天", 5, () => SelectDialoguePreset("day"));
            AddMoreActionButton("说", "说书人", 6, () => SelectDialoguePreset("storyteller"));
            AddMoreActionButton("标", "标记", 7, () => SelectDialoguePreset("mark-role"));
            AddMoreActionButton("册", "剧本", 8, () => SelectDialoguePreset("handbook"));
            AddMoreActionButton("复", "复盘", 9, () => { CloseMoreActionsPanel(); ShowInfoDrawer("recap"); });
            AddMoreActionButton("知", "全知", 10, () => SelectDialoguePreset("grimoire"));
            AddMoreActionButton("收", "关闭", 11, CloseMoreActionsPanel);
            moreActionsPanel.gameObject.SetActive(false);
        }

        private void AddMoreActionButton(string icon, string label, int index, UnityEngine.Events.UnityAction onClick)
        {
            var col = index % 4;
            var row = index / 4;
            AddToolActionButton(icon, label, moreActionsPanel, new Vector2(78f + col * 128f, 112f - row * 44f), new Vector2(112f, 30f), onClick, true);
        }

        private void BuildProactiveWhisperPanel()
        {
            proactiveWhisperPanel = AddPanel("Proactive Whisper Panel", canvas.transform, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-594f, 198f), new Vector2(-24f, 374f), new Color(0.004f, 0.010f, 0.016f, 0.91f)).GetComponent<RectTransform>();
            AddFrame(proactiveWhisperPanel, "Proactive Whisper Frame", 1f, new Color(0.92f, 0.62f, 0.28f, 0.36f));
            AddImage("Proactive Whisper Header Wash", proactiveWhisperPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -48f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            proactiveWhisperTokenImage = AddImage("Proactive Whisper Token", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(22f, 62f), new Vector2(-462f, -20f), new Color(0.92f, 0.82f, 0.60f, 0.92f));
            proactiveWhisperTokenImage.sprite = SpriteFromResource("Botc/ui/vote1") ?? GetCircleFillSprite();
            proactiveWhisperTokenImage.preserveAspect = true;
            proactiveWhisperTitleText = AddText("Proactive Whisper Title", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(116f, 132f), new Vector2(-168f, -14f), "私聊邀请", 22, TextAnchor.UpperLeft, FontStyle.Bold);
            proactiveWhisperQueueText = AddText("Proactive Whisper Queue", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(410f, 136f), new Vector2(-18f, -18f), "", 13, TextAnchor.UpperRight, FontStyle.Bold);
            proactiveWhisperBodyText = AddText("Proactive Whisper Body", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(116f, 82f), new Vector2(-20f, -58f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            proactiveWhisperMetaText = AddText("Proactive Whisper Meta", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(116f, 54f), new Vector2(-20f, -92f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            proactiveWhisperMetaText.color = new Color(0.76f, 0.86f, 0.90f, 0.90f);
            AddToolActionButton("✓", "接受", proactiveWhisperPanel, new Vector2(292f, 28f), new Vector2(98f, 32f), AcceptProactiveWhisperOffer, true);
            AddToolActionButton("…", "稍后", proactiveWhisperPanel, new Vector2(400f, 28f), new Vector2(86f, 32f), SnoozeProactiveWhisperOffer, true);
            AddToolActionButton("×", "拒绝", proactiveWhisperPanel, new Vector2(498f, 28f), new Vector2(86f, 32f), DeclineProactiveWhisperOffer, true);
            proactiveWhisperPanel.gameObject.SetActive(false);
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

        private void BuildEndgamePanel()
        {
            endgamePanel = AddPanel("Endgame Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-520f, -310f), new Vector2(520f, 310f), new Color(0.004f, 0.009f, 0.014f, 0.94f)).GetComponent<RectTransform>();
            AddFrame(endgamePanel, "Endgame Frame", 1.4f, new Color(0.96f, 0.68f, 0.30f, 0.46f));
            AddImage("Endgame Header Wash", endgamePanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -112f), new Vector2(-1f, -1f), new Color(0.82f, 0.50f, 0.18f, 0.085f));
            AddImage("Endgame Body Wash", endgamePanel, Vector2.zero, Vector2.one, new Vector2(30f, 118f), new Vector2(-520f, -138f), new Color(0.020f, 0.028f, 0.036f, 0.34f));
            AddImage("Endgame Events Wash", endgamePanel, Vector2.zero, Vector2.one, new Vector2(540f, 118f), new Vector2(-30f, -138f), new Color(0.020f, 0.028f, 0.036f, 0.30f));
            endgameTitle = AddText("Endgame Title", endgamePanel, Vector2.zero, Vector2.one, new Vector2(34f, 546f), new Vector2(-34f, -18f), "终局", 36, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Endgame Hint", endgamePanel, Vector2.zero, Vector2.one, new Vector2(802f, 556f), new Vector2(-144f, -24f), "", 13, TextAnchor.UpperRight, FontStyle.Normal);
            AddToolActionButton("关", "关闭", endgamePanel, new Vector2(960f, 560f), new Vector2(104f, 34f), CloseEndgamePanel, true);
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
            if (vitalsText != null) vitalsText.text = "";
            UpdateSetupBadges();
            phaseText.text = Ellipsize(PhaseLabel(), 18);
            UpdateSyncStatusText();
            tickerText.text = Ellipsize(LatestEvent(), 72);
            if (objectiveTitleText != null) objectiveTitleText.text = Ellipsize(string.IsNullOrWhiteSpace(vm.phaseObjectiveTitle) ? "阶段目标" : vm.phaseObjectiveTitle, 18);
            if (objectiveHintText != null) objectiveHintText.text = ClampTextBlock(string.IsNullOrWhiteSpace(vm.phaseObjectiveHint) ? "等待 JS Core 更新。" : vm.phaseObjectiveHint, 2, 38);
            UpdateFlowGuideUi();
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
            EnsureActiveActionFormStillValid();
            UpdateVotePanelText();
            UpdatePrivateChatPanelText();
            UpdateTokenInspectorText();
            RenderProactiveWhisperPanel();
            RenderPhaseAssistPanel();
            RenderNominationDebatePanel();
            RenderStorytellerPanel();
            if (handbookPanel != null && handbookPanel.gameObject.activeSelf) RenderHandbookPanel();
            if (reminderPickerPanel != null && reminderPickerPanel.gameObject.activeSelf) RenderReminderPickerPanel();
            RenderEndgamePanel();
            ApplyBottomDockVisibility();
            ApplyTokenInspectorVisibility();
            ApplyAuxPanelVisibility();
            ApplyModalBackdropVisibility();
            RenderGrimoire();
            if (mainMenuRoot != null && mainMenuRoot.gameObject.activeSelf) SetGameplayChromeVisible(false);
        }

        private void ApplyUiSmokeMode()
        {
            var mode = CommandLineValue("-botc-ui-smoke").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(mode)) return;

            if (mode == "main-menu" || mode == "menu")
            {
                ApplyMainMenuState(true);
                return;
            }

            if (mainMenuRoot != null) mainMenuRoot.gameObject.SetActive(false);
            gameplayEntered = true;
            SetGameplayChromeVisible(true);

            if (mode == "settings" || mode == "settings-panel")
            {
                OpenSettingsPanel();
                return;
            }
            if (endgamePanel != null)
            {
                endgameDismissed = true;
                dismissedEndgameGameId = CurrentEndgameKey();
                endgamePanel.gameObject.SetActive(false);
            }
            selectedPlayerId = FirstNonEmpty(vm?.action?.selectedPlayerId, FirstSmokeTargetId());

            if (mode == "main" || mode == "main-board" || mode == "board")
            {
                ApplyModalBackdropVisibility();
                return;
            }

            if (mode == "inspector" || mode == "token-inspector")
            {
                tokenInspectorOpen = true;
                bottomDockOpen = true;
                UpdateTokenInspectorText();
                ApplyTokenInspectorVisibility();
                ApplyBottomDockVisibility();
            }
            else if (mode == "actions" || mode == "more-actions")
            {
                bottomDockOpen = true;
                moreActionsOpen = true;
                ApplyBottomDockVisibility();
                ApplyMoreActionsVisibility();
            }
            else if (mode == "info" || mode == "info-drawer")
            {
                ShowInfoDrawer("events");
            }
            else if (mode == "intel" || mode == "information" || mode == "information-drawer")
            {
                ShowInfoDrawer("intel");
            }
            else if (mode == "private" || mode == "private-chat")
            {
                OpenPrivateChatPanel();
            }
            else if (mode == "action" || mode == "action-form")
            {
                OpenActionFormPanel(FirstAvailableActionFormId());
            }
            else if (mode == "storyteller" || mode == "storyteller-queue")
            {
                OpenStorytellerPanel();
            }
            else if (mode == "handbook" || mode == "script-handbook")
            {
                OpenHandbookPanel();
            }
            else if (mode == "vote" || mode == "vote-ceremony")
            {
                OpenVotePanel();
            }
            else if (mode == "role-picker" || mode == "roles")
            {
                activeRolePickerMode = "mark-role";
                activeRolePickerPlayerId = selectedPlayerId;
                RenderRolePickerPanel();
                ShowModalPanel(rolePickerPanel);
            }
            else if (mode == "reminder-picker" || mode == "reminders")
            {
                var target = SelectedPlayer() ?? (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && !player.human);
                if (target != null) OpenReminderPickerForPlayer(target);
            }
            else if (mode == "stage-dialogue" || mode == "dialogue-toast")
            {
                ShowStageDialogueStill(
                    "说书人",
                    "天亮了。昨夜的结果已经写入日志；如果有私聊、公聊或说书人提示，它们会从底部弹出，并保留到你读完。\n新的正式对话框支持分页、跳过打字、打开来源。长句不会再挤在资料抽屉里，也不会一闪而过。\n点击继续可以翻到下一段；点击来源会打开日志、时间线或私聊面板。",
                    "流程提示");
            }
            else if (mode == "phase-transition" || mode == "transition" || mode == "transition-day")
            {
                ShowPhaseTransitionStill("private");
            }
            else if (mode == "transition-night")
            {
                ShowPhaseTransitionStill("night");
            }
            else if (mode == "transition-nomination")
            {
                ShowPhaseTransitionStill("nomination");
            }

            ApplyModalBackdropVisibility();
        }

        private string FirstSmokeTargetId()
        {
            var players = vm?.players ?? Array.Empty<PlayerViewModel>();
            return players.FirstOrDefault((player) => player != null && !player.human)?.id
                ?? players.FirstOrDefault((player) => player != null)?.id
                ?? "";
        }

        private IEnumerator CaptureUiSmokeScreenshotIfRequested()
        {
            var outputPath = CommandLineValue("-botc-ui-smoke-output");
            if (string.IsNullOrWhiteSpace(outputPath)) yield break;

            yield return null;
            yield return new WaitForEndOfFrame();

            try
            {
                var directory = Path.GetDirectoryName(outputPath);
                if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
                var texture = new Texture2D(Screen.width, Screen.height, TextureFormat.RGB24, false);
                texture.ReadPixels(new Rect(0f, 0f, Screen.width, Screen.height), 0, 0);
                texture.Apply();
                File.WriteAllBytes(outputPath, texture.EncodeToPNG());
                Destroy(texture);
                Debug.Log($"Unity UI smoke screenshot written: {outputPath}");
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"Failed to request Unity UI smoke screenshot: {ex.Message}");
                yield break;
            }

            yield return new WaitForSeconds(0.25f);
            Application.Quit();
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

            if (!endgamePanel.gameObject.activeSelf) ShowModalPanel(endgamePanel);
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

        private void RenderStageDialogueTokenHint(Transform tokenRoot, PlayerViewModel player)
        {
            if (stageDialoguePanel == null || !stageDialoguePanel.gameObject.activeSelf || player == null) return;
            var isSpeaker = !string.IsNullOrWhiteSpace(stageDialogueSpeakerPlayerId) && player.id == stageDialogueSpeakerPlayerId;
            var isTarget = !string.IsNullOrWhiteSpace(stageDialogueTargetPlayerId) && player.id == stageDialogueTargetPlayerId && !isSpeaker;
            if (!isSpeaker && !isTarget) return;

            var halo = AddImage(
                isSpeaker ? "Dialogue Speaker Halo" : "Dialogue Target Halo",
                tokenRoot,
                new Vector2(0.5f, 1f),
                new Vector2(0.5f, 1f),
                new Vector2(-94f, -162f),
                new Vector2(94f, 26f),
                isSpeaker ? new Color(1f, 0.78f, 0.28f, 0.42f) : new Color(0.48f, 0.74f, 1f, 0.36f));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            dialogueTokenPulseImages.Add(halo);
            dialogueTokenPulseRects.Add(halo.rectTransform);
            AddTokenStatusBadge(
                tokenRoot,
                isSpeaker ? "说" : "听",
                new Vector2(isSpeaker ? -70f : 70f, -42f),
                isSpeaker ? new Color(0.22f, 0.11f, 0.025f, 0.96f) : new Color(0.025f, 0.070f, 0.13f, 0.94f),
                isSpeaker ? new Color(1f, 0.78f, 0.30f, 0.66f) : new Color(0.42f, 0.72f, 1f, 0.54f));
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
                SendUnityAction("ai-public-step");
                dialogueBody.text = "已请求 AI 按公聊时钟推进一段发言。后续可继续公聊，或开启提名窗口。";
                return;
            }
            if (mode == "nomination")
            {
                dialogueTitle.text = "提名窗口";
                if (vm.phase != "day" || vm.dayStage != "nomination")
                {
                    SendUnityAction("open-nomination-window");
                    dialogueBody.text = vm.dayStage == "private"
                        ? "已请求开启提名窗口；如果当前仍在私聊阶段，JS Core 会要求先进入公聊。"
                        : "已请求开启提名窗口。窗口中可以由你或 AI 主动提名。";
                    return;
                }
                var nominationTarget = SelectedPlayer();
                if (nominationTarget == null || nominationTarget.human)
                {
                    SendHumanNominationIntent();
                    return;
                }
                SendHumanNominationIntent();
                dialogueBody.text = "已提交提名意图；接下来会进入双方互辩，再进入投票仪式。";
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
                ShowPhaseGuideMessage();
                return;
            }
            RequestPhaseStage(NextPhaseStageFromViewModel(), "下一阶段");
        }

        private void ShowPhaseGuideMessage()
        {
            ShowPhaseGuardMessage("当前流程", BuildFlowGuideText());
        }

        private void UpdateFlowGuideUi()
        {
            if (flowGuideText != null) flowGuideText.text = BuildFlowGuideText(true);
            var suggestNextPhase = ShouldHighlightNextPhaseButton();
            if (nextPhaseButtonLabelText != null)
            {
                var label = NextPhaseButtonLabel();
                nextPhaseButtonLabelText.text = suggestNextPhase ? $"> {label}" : label;
                var guard = vm?.phaseAdvance;
                nextPhaseButtonLabelText.color = guard != null && guard.blocked
                    ? new Color(1f, 0.68f, 0.36f, 1f)
                    : suggestNextPhase ? new Color(1f, 0.84f, 0.36f, 1f) : new Color(0.98f, 0.91f, 0.78f, 1f);
            }
            SetButtonSuggested(nextPhaseButton, suggestNextPhase);
        }

        private bool ShouldHighlightNextPhaseButton()
        {
            var guard = vm?.phaseAdvance;
            if (guard == null) return true;
            if (guard.blocked) return true;
            if (guard.requiresConfirm) return true;
            return guard.canAdvance || !string.IsNullOrWhiteSpace(guard.targetStage);
        }

        private string NextPhaseButtonLabel()
        {
            var guard = vm?.phaseAdvance;
            if (guard != null && guard.blocked) return "处理事项";
            if (guard != null && guard.requiresConfirm) return "确认推进";
            var stage = NextPhaseStageFromViewModel();
            if (stage == "public") return "开始公聊";
            if (stage == "nomination") return "进入提名";
            if (stage == "night") return "结束白天";
            if (stage == "day" || stage == "private") return "结算夜晚";
            return "下一阶段";
        }

        private string BuildFlowGuideText(bool compact = false)
        {
            var guard = vm?.phaseAdvance;
            var title = string.IsNullOrWhiteSpace(vm?.phaseObjectiveTitle) ? PhaseLabel() : vm.phaseObjectiveTitle;
            var hint = string.IsNullOrWhiteSpace(vm?.phaseObjectiveHint) ? "观察当前可用行动，再决定是否推进。" : vm.phaseObjectiveHint;
            var next = FirstNonEmpty(guard?.label, PhaseTransitionStageName(NormalizePhaseTransitionStage(NextPhaseStageFromViewModel())));
            var lines = new List<string>
            {
                title,
                compact ? Ellipsize(hint, 34) : hint,
                $"下一步：{next}"
            };
            if (guard != null && guard.blocked) lines.Add($"需处理：{FirstNonEmpty(guard.reason, "当前阶段还有必要事项。")}");
            else if (guard != null && guard.requiresConfirm) lines.Add($"确认：{FirstNonEmpty(guard.hint, guard.reason, "再次点击继续。")}");
            else if (guard?.warnings != null && guard.warnings.Length > 0) lines.Add($"提示：{guard.warnings[0]}");
            return ClampTextLines(lines, compact ? 5 : 7, compact ? 18 : 54);
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
            if (NormalizePhaseTransitionStage(stage) == "night")
            {
                ShowPhaseGuardMessage("夜幕降临", "所有人闭眼。夜间顺序开始流动，稍后自动结算并天亮。");
                if (delayedPhaseActionRoutine != null) StopCoroutine(delayedPhaseActionRoutine);
                BeginPhaseTransition("night", false);
                delayedPhaseActionRoutine = StartCoroutine(SendPhaseActionAfterInterlude(stage, needsConfirm));
                return;
            }
            ShowPhaseGuardMessage(label, "已发送给 JS Core；阶段切换成功后界面会自动刷新。");
            var normalizedStage = NormalizePhaseTransitionStage(stage);
            if (normalizedStage != "private") BeginPhaseTransition(stage, true);
            SendUnityAction("phase", "", stage, "", "", "", "", "", "", false, needsConfirm ? "confirm" : "");
        }

        private IEnumerator SendPhaseActionAfterInterlude(string stage, bool needsConfirm)
        {
            yield return new WaitForSecondsRealtime(UiMotionDisabled() ? 0.05f : 3.25f);
            SendUnityAction("phase", "", stage, "", "", "", "", "", "", false, needsConfirm ? "confirm" : "");
            delayedPhaseActionRoutine = null;
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

        private static int CategorySort(string category)
        {
            if (category == "townsfolk") return 0;
            if (category == "outsider") return 1;
            if (category == "minion") return 2;
            if (category == "demon") return 3;
            return 9;
        }

        private static int CountCategory(Dictionary<string, int> counts, string category)
        {
            return counts != null && counts.TryGetValue(category, out var value) ? value : 0;
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

        private bool GameplayOverlayOpen()
        {
            return (privateChatPanel != null && privateChatPanel.gameObject.activeSelf)
                || (actionFormPanel != null && actionFormPanel.gameObject.activeSelf)
                || (storytellerPanel != null && storytellerPanel.gameObject.activeSelf)
                || (handbookPanel != null && handbookPanel.gameObject.activeSelf)
                || (votePanel != null && votePanel.gameObject.activeSelf)
                || (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf)
                || (reminderPickerPanel != null && reminderPickerPanel.gameObject.activeSelf)
                || (settingsPanel != null && settingsPanel.gameObject.activeSelf)
                || (mainMenuRoot != null && mainMenuRoot.gameObject.activeSelf);
        }

        private ProactiveWhisperViewModel[] PendingProactiveOffers()
        {
            return vm?.pendingProactiveWhispers ?? Array.Empty<ProactiveWhisperViewModel>();
        }

        private ProactiveWhisperViewModel ActiveProactiveOffer()
        {
            var offers = PendingProactiveOffers();
            if (offers.Length == 0) return null;
            var key = string.Join("|", offers.Select((offer) => offer?.id ?? ""));
            if (key != lastProactiveOfferQueueKey)
            {
                lastProactiveOfferQueueKey = key;
                if (!offers.Any((offer) => offer != null && offer.id == snoozedProactiveOfferId)) snoozedProactiveOfferId = "";
            }
            return offers.FirstOrDefault((offer) => offer != null && offer.id != snoozedProactiveOfferId)
                ?? offers.FirstOrDefault((offer) => offer != null && string.IsNullOrWhiteSpace(snoozedProactiveOfferId));
        }

        private void MaybeRequestProactiveWhispers()
        {
            if (!gameplayEntered || HasPendingAction() || vm == null || vm.gameOver) return;
            if (vm.phase != "day" || vm.dayStage != "private") return;
            if (PendingProactiveOffers().Length > 0) return;
            var key = $"{vm.gameId}:{vm.day}:private";
            if (lastProactiveWhisperRequestKey == key) return;
            lastProactiveWhisperRequestKey = key;
            SendUnityAction("ai-proactive-whispers", trackPending: false);
        }

        private void RenderProactiveWhisperPanel()
        {
            MaybeRequestProactiveWhispers();
            if (proactiveWhisperPanel == null) return;
            var offer = ActiveProactiveOffer();
            var visible = gameplayEntered
                && offer != null
                && vm?.phase == "day"
                && vm?.dayStage == "private"
                && !GameplayOverlayOpen();
            proactiveWhisperPanel.gameObject.SetActive(visible);
            if (!visible || offer == null) return;

            proactiveWhisperPanel.SetAsLastSibling();
            if (proactiveWhisperTokenImage != null)
            {
                proactiveWhisperTokenImage.sprite = SpriteFromResource("Botc/ui/vote1") ?? GetCircleFillSprite();
                proactiveWhisperTokenImage.preserveAspect = true;
            }
            var playerName = string.IsNullOrWhiteSpace(offer.playerName) ? NameForPlayerId(offer.playerId) : offer.playerName;
            if (proactiveWhisperTitleText != null) proactiveWhisperTitleText.text = $"AI 来访 · {playerName}";
            if (proactiveWhisperBodyText != null)
            {
                var reason = string.IsNullOrWhiteSpace(offer.reason) ? "对方想和你私下交换一条信息。" : offer.reason;
                proactiveWhisperBodyText.text = ClampTextBlock(reason, 2, 34);
            }
            if (proactiveWhisperMetaText != null)
            {
                var seat = offer.playerSeat > 0 ? $"{offer.playerSeat}号" : NameForPlayerId(offer.playerId);
                var persona = string.IsNullOrWhiteSpace(offer.personaLabel) ? "普通风格" : offer.personaLabel;
                proactiveWhisperMetaText.text = $"{seat} · {persona}";
            }
            if (proactiveWhisperQueueText != null)
            {
                var offers = PendingProactiveOffers();
                proactiveWhisperQueueText.text = offers.Length <= 1 ? "1 条邀请" : $"队列 {Array.IndexOf(offers, offer) + 1}/{offers.Length}";
            }
        }

        private void AcceptProactiveWhisperOffer()
        {
            var offer = ActiveProactiveOffer();
            if (offer == null) return;
            snoozedProactiveOfferId = "";
            selectedPlayerId = offer.playerId ?? "";
            privateChatStatus = $"已接受 {NameForPlayerId(selectedPlayerId)} 的主动私聊；完整内容会写入私聊时间线。";
            SendUnityAction("accept-proactive-whisper", playerId: selectedPlayerId, trackPending: true, offerId: offer.id ?? "");
            OpenPrivateChatPanel();
        }

        private void SnoozeProactiveWhisperOffer()
        {
            var offer = ActiveProactiveOffer();
            if (offer == null) return;
            snoozedProactiveOfferId = offer.id ?? "";
            if (proactiveWhisperPanel != null) proactiveWhisperPanel.gameObject.SetActive(false);
        }

        private void DeclineProactiveWhisperOffer()
        {
            var offer = ActiveProactiveOffer();
            if (offer == null) return;
            snoozedProactiveOfferId = offer.id ?? "";
            SendUnityAction("decline-proactive-whisper", playerId: offer.playerId ?? "", trackPending: true, offerId: offer.id ?? "");
            if (proactiveWhisperPanel != null) proactiveWhisperPanel.gameObject.SetActive(false);
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
            if (settingsPanel != null && settingsPanel.gameObject.activeSelf)
            {
                CloseSettingsPanel();
                return;
            }
            if (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf)
            {
                CloseRolePicker();
                return;
            }
            if (reminderPickerPanel != null && reminderPickerPanel.gameObject.activeSelf)
            {
                CloseReminderPicker();
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
                ClosePrivateChatPanel();
                return;
            }
            if (actionFormPanel != null && actionFormPanel.gameObject.activeSelf)
            {
                CloseActionFormPanel();
                return;
            }
            if (actionTargetBar != null && actionTargetBar.gameObject.activeSelf)
            {
                CloseActionFormPanel();
                return;
            }
            if (storytellerPanel != null && storytellerPanel.gameObject.activeSelf)
            {
                CloseStorytellerPanel();
                return;
            }
            if (handbookPanel != null && handbookPanel.gameObject.activeSelf)
            {
                CloseHandbookPanel();
                return;
            }
            if (votePanel != null && votePanel.gameObject.activeSelf)
            {
                CloseVotePanel();
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
            if (settingsPanel != null && settingsPanel.gameObject.activeSelf)
            {
                CloseSettingsPanel();
                return;
            }
            if (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf)
            {
                CloseRolePicker();
                return;
            }
            if (reminderPickerPanel != null && reminderPickerPanel.gameObject.activeSelf)
            {
                CloseReminderPicker();
                return;
            }
            if (endgamePanel != null && endgamePanel.gameObject.activeSelf)
            {
                CloseEndgamePanel();
                return;
            }
            if (privateChatPanel != null && privateChatPanel.gameObject.activeSelf)
            {
                ClosePrivateChatPanel();
                return;
            }
            if (actionFormPanel != null && actionFormPanel.gameObject.activeSelf)
            {
                CloseActionFormPanel();
                return;
            }
            if (storytellerPanel != null && storytellerPanel.gameObject.activeSelf)
            {
                CloseStorytellerPanel();
                return;
            }
            if (handbookPanel != null && handbookPanel.gameObject.activeSelf)
            {
                CloseHandbookPanel();
                return;
            }
            if (votePanel != null && votePanel.gameObject.activeSelf)
            {
                CloseVotePanel();
            }
        }

        private void ApplyModalBackdropVisibility()
        {
            if (modalBackdrop == null) return;
            var visible =
                (privateChatPanel != null && privateChatPanel.gameObject.activeSelf)
                || (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf)
                || (reminderPickerPanel != null && reminderPickerPanel.gameObject.activeSelf)
                || (endgamePanel != null && endgamePanel.gameObject.activeSelf)
                || (actionFormPanel != null && actionFormPanel.gameObject.activeSelf)
                || (storytellerPanel != null && storytellerPanel.gameObject.activeSelf)
                || (handbookPanel != null && handbookPanel.gameObject.activeSelf)
                || (settingsPanel != null && settingsPanel.gameObject.activeSelf && (mainMenuRoot == null || !mainMenuRoot.gameObject.activeSelf));
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

        private void ApplyAuxPanelVisibility()
        {
            if (eventPanel != null)
            {
                if (!eventPanelOpen && panelMotionRoutines.TryGetValue(eventPanel, out var existing) && existing != null)
                {
                    StopCoroutine(existing);
                    panelMotionRoutines.Remove(eventPanel);
                }
                eventPanel.offsetMin = eventPanelTargetOffsetMin;
                eventPanel.offsetMax = eventPanelTargetOffsetMax;
                eventPanel.gameObject.SetActive(eventPanelOpen);
                var group = eventPanel.GetComponent<CanvasGroup>();
                if (group != null) group.alpha = 1f;
            }
            if (timelinePanel != null) timelinePanel.gameObject.SetActive(false);
        }

    }

    [Serializable]
    public sealed class MenuSetupCatalog
    {
        public MenuScriptOption[] scripts;
    }

    [Serializable]
    public sealed class MenuScriptOption
    {
        public string id;
        public string name;
        public MenuRoleOption[] roles;
    }

    [Serializable]
    public sealed class MenuRoleOption
    {
        public string id;
        public string name;
        public string team;
        public string category;
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
        public ProactiveWhisperViewModel[] pendingProactiveWhispers;
        public string[] aiSocialClues;
        public LlmRendererViewModel llmRenderer;
        public PublicConversationViewModel publicConversation;
        public NominationClockViewModel nominationClock;
        public NominationDebateViewModel nominationDebate;
        public string[] aiRecap;
        public AiRecapViewModel[] aiRecapDetails;
        public VoteCeremonyViewModel voteCeremony;
        public ActionFormViewModel[] actionForms;
        public string dialogueTitle;
        public string dialogueText;
        public string[] events;
        public string[] storytellerQueue;
        public StorytellerQueueItemViewModel[] storytellerQueueDetails;
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
                pendingProactiveWhispers = Array.Empty<ProactiveWhisperViewModel>(),
                aiSocialClues = Array.Empty<string>(),
                llmRenderer = new LlmRendererViewModel(),
                publicConversation = new PublicConversationViewModel(),
                nominationClock = new NominationClockViewModel(),
                nominationDebate = null,
                aiRecap = Array.Empty<string>(),
                aiRecapDetails = Array.Empty<AiRecapViewModel>(),
                actionForms = Array.Empty<ActionFormViewModel>(),
                dialogueTitle = "对话舞台",
                dialogueText = "点击 token 查看玩家信息。",
                events = new[] { "已载入备用视图模型。", "如果看到这条信息，说明 unity_viewmodel.json 未找到。" },
                storytellerQueue = new[] { "当前尚未连接 JS Core 行动。" },
                storytellerQueueDetails = Array.Empty<StorytellerQueueItemViewModel>(),
                timeline = Array.Empty<TimelineEntryViewModel>(),
                players = Array.Empty<PlayerViewModel>()
            };
        }
    }

    [Serializable] public sealed class PhaseAdvanceViewModel { public bool blocked; public bool canAdvance; public bool requiresConfirm; public string targetStage; public string label; public string reason; public string hint; public string[] blockers; public string[] warnings; public string confirmText; }
    [Serializable] public sealed class ProactiveWhisperViewModel { public string id; public string playerId; public string playerName; public int playerSeat; public string personaLabel; public string reason; public string prompt; public string intent; public string focusId; public long createdAt; }
    [Serializable] public sealed class PublicConversationViewModel { public bool active; public string clock; public string label; public int step; public float pressure; public string speakerId; public string speakerName; public string focusId; public string focusName; public bool canContinue; public string[] suggestedActions; }
    [Serializable] public sealed class NominationClockViewModel { public bool active; public string status; public int ticksRemaining; public int totalTicks; public float progress; public string lastActorId; public string lastIntent; }
    [Serializable] public sealed class NominationDebateViewModel { public bool active; public string nominationId; public int day; public string nominatorId; public string nominatorName; public string nomineeId; public string nomineeName; public string reason; public string nextAction; public bool canHumanRespond; public string humanSpeakerRole; public string responsePrompt; public NominationDebateLineViewModel[] lines; }
    [Serializable] public sealed class NominationDebateLineViewModel { public string speakerId; public string speakerName; public string role; public string text; public bool pending; }
    [Serializable] public sealed class GameOutcomeViewModel { public bool gameOver; public string winner; public string winnerLabel; public string title; public string reason; public string summary; public int alive; public int dead; public string[] finalEvents; }
    [Serializable] public sealed class RoleActionViewModel { public bool available; public string reason; public string type; public string roleId; public string roleName; public string inputType; public string prompt; public int minTargetCount; public int maxTargetCount; public int targetCount; public bool allowSelf; public bool allowDead; public ActionModeViewModel[] modes; public ActionOptionViewModel[] options; public ActionRoleOptionViewModel[] roleOptions; public string[] selectedTargetIds; }
    [Serializable] public sealed class ActionFormViewModel { public string id; public string title; public bool available; public string reason; public string type; public string roleId; public string roleName; public string inputType; public string prompt; public int minTargetCount; public int maxTargetCount; public int targetCount; public ActionOptionViewModel[] options; public ActionRoleOptionViewModel[] roleOptions; public ActionModeViewModel[] modes; public string[] selectedTargetIds; }
    [Serializable] public sealed class StorytellerQueueItemViewModel { public string id; public string type; public string roleId; public string roleName; public string inputType; public string prompt; public string phaseLabel; public int createdDay; public int createdNight; public string createdPhase; public int minTargetCount; public int maxTargetCount; public int targetCount; public int optionCount; public bool current; }
    [Serializable] public sealed class ActionModeViewModel { public string id; public string label; }
    [Serializable] public sealed class ActionOptionViewModel { public string id; public string name; public int seat; public string roleId; public string roleName; public bool alive; public string team; public string category; }
    [Serializable] public sealed class ActionRoleOptionViewModel { public string id; public string name; public string category; public string team; }
    [Serializable] public sealed class VoteCeremonyViewModel { public int day; public string nominatorId; public string nominatorName; public string nomineeId; public string nomineeName; public int yesVotes; public int threshold; public bool passed; public string resultText; public VoteViewModel[] voters; }
    [Serializable] public sealed class VoteViewModel { public string voterId; public string voterName; public int seat; public bool alive; public bool ghostVote; public bool vote; public bool abstain; }
    [Serializable] public sealed class AiRecapViewModel { public string id; public string name; public string targetId; public string target; public string score; public string reason; public AiRecapTargetViewModel[] targets; }
    [Serializable] public sealed class AiRecapTargetViewModel { public string id; public string name; public string score; public float scoreValue; public string reason; public AiTrailViewModel[] trail; }
    [Serializable] public sealed class AiTrailViewModel { public string reasonKey; public string evidenceKind; public float before; public float after; public float appliedDelta; public string reason; }
    [Serializable] public sealed class ScriptHandbookViewModel { public bool open; public string activeTab; public string scriptId; public string scriptName; public ScriptRoleViewModel[] roles; public string[] firstNightOrder; public string[] otherNightOrder; }
    [Serializable] public sealed class ScriptRoleViewModel { public string id; public string name; public string category; public string team; public string ability; public string icon; public string firstNightReminder; public string otherNightReminder; public string[] reminders; public string[] remindersGlobal; public int firstNight; public int otherNight; }
    [Serializable] public sealed class LlmRendererViewModel { public bool enabled; public string provider; public string source; public string model; public int touched; public int fallback; public string reason; public string updatedAt; }
    [Serializable] public sealed class LlmRenderViewModel { public string source; public bool fallbackUsed; public string reason; }
    [Serializable] public sealed class ActionStatusViewModel { public int revision; public string lastActionId; public string lastActionType; public string status; public string message; public string updatedAt; public string selectedPlayerId; public string selectedPlayerName; public LlmRendererViewModel llmRenderer; }
    [Serializable] public sealed class TimelineEntryViewModel { public string id; public string mode; public string speakerId; public string targetId; public string focusId; public string intent; public string evidenceSummary; public string evidenceKind; public string questionToAsk; public string[] followUpPrompts; public string text; public LlmRenderViewModel llmRender; public int day; public int night; }
    [Serializable] public sealed class PlayerViewModel { public string id; public int seat; public string name; public string roleId; public string roleName; public string actualRoleId; public string perceivedRoleId; public string markedRoleId; public string markedRoleName; public bool revealed; public bool alive; public bool human; public bool ghostVoteAvailable; public int suspicion; public string[] reminders; }
    [Serializable] public sealed class UnitySaveMeta { public string savedAt; public string scriptName; public string phase; public int day; public int night; public int alive; public int dead; }
}
