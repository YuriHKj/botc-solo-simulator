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
        private const float BridgeSlowWarningSeconds = 8f;
        private const float BridgeStaleActionSeconds = 75f;
        private const float PendingViewModelPollSeconds = 0.35f;
        private const int ActionChoicePageSize = 10;
        private const int HandbookRolePageSize = 15;
        private const int RolePickerPageSize = 29;
        private const int ReminderPickerPageSize = 30;
        private const int StorytellerQueuePageSize = 4;
        private const int ReasoningScoreTrailPageSize = 2;
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

        private sealed class MoreActionTileState
        {
            public readonly Button button;
            public readonly Image background;
            public readonly Image glow;
            public readonly Image accent;
            public readonly Image suggestedGlow;
            public readonly Image suggestedBadge;
            public readonly Text markerText;
            public readonly Text labelText;
            public readonly Text helperText;

            public MoreActionTileState(Button button, Image background, Image glow, Image accent, Image suggestedGlow, Image suggestedBadge, Text markerText, Text labelText, Text helperText)
            {
                this.button = button;
                this.background = background;
                this.glow = glow;
                this.accent = accent;
                this.suggestedGlow = suggestedGlow;
                this.suggestedBadge = suggestedBadge;
                this.markerText = markerText;
                this.labelText = labelText;
                this.helperText = helperText;
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
        private RectTransform moreActionsSignalRoot;
        private RectTransform moreActionsRouteRoot;
        private Text moreActionsContextText;
        private Text moreActionsSuggestionText;
        private RectTransform proactiveWhisperPanel;
        private RectTransform phaseAssistPanel;
        private RectTransform nominationDebatePanel;
        private RectTransform tokenInspectorPanel;
        private RectTransform tokenInspectorRoleRoot;
        private RectTransform tokenInspectorMetaRoot;
        private RectTransform tokenInspectorSignalRoot;
        private RectTransform tokenInspectorFocusRoot;
        private RectTransform tokenInspectorGuidanceRoot;
        private RectTransform eventPanel;
        private RectTransform infoActivityCardRoot;
        private RectTransform infoQueueCardRoot;
        private RectTransform infoRecapCardRoot;
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
        private RectTransform actionFormSignalRoot;
        private RectTransform actionTargetBar;
        private RectTransform actionOptionRoot;
        private RectTransform storytellerPanel;
        private RectTransform storytellerSignalRoot;
        private RectTransform storytellerQueueListRoot;
        private RectTransform storytellerDetailRoot;
        private RectTransform storytellerTargetRoot;
        private RectTransform handbookPanel;
        private RectTransform handbookModeRoot;
        private RectTransform handbookSignalRoot;
        private RectTransform handbookRoleListRoot;
        private RectTransform handbookDetailTokenRoot;
        private RectTransform handbookDetailSummaryRoot;
        private RectTransform rolePickerPanel;
        private RectTransform rolePickerSignalRoot;
        private RectTransform rolePickerGridRoot;
        private RectTransform reminderPickerPanel;
        private RectTransform reminderPickerGridRoot;
        private RectTransform reminderPickerPreviewRoot;
        private RectTransform reminderPickerCustomRoot;
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
        private RectTransform phaseTransitionRouteRoot;
        private Image phaseTransitionRouteAccent;
        private Image phaseTransitionRouteConnectorA;
        private Image phaseTransitionRouteConnectorB;
        private Text phaseTransitionCueStageText;
        private Text phaseTransitionCueActionText;
        private Text phaseTransitionCueStateText;
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
        private Text stageDialoguePortraitNameText;
        private Text stageDialogueRouteText;
        private RectTransform stageDialogueContextRailRoot;
        private RectTransform stageDialogueQueueStripRoot;
        private Text stageDialogueQueueStatusText;
        private Text stageDialogueQueueNextText;
        private Text stageDialogueQueueOverflowText;
        private Image stageDialogueQueueProgressFill;
        private Image stageDialogueQueueProgressKnob;
        private Image stageDialogueRouteAccentImage;
        private Image stageDialogueSpeakerSpotlightImage;
        private Image stageDialogueSpeakerBeamImage;
        private Image stageDialogueSpeakerBeamCoreImage;
        private Image stageDialogueSpeakerBeamPinImage;
        private Image stageDialoguePortraitAuraImage;
        private RectTransform stageDialoguePortraitAuraRect;
        private Image stageDialoguePortraitGlowImage;
        private Image stageDialoguePortraitTokenImage;
        private Image stageDialoguePortraitRoleImage;
        private Image proactiveWhisperTokenImage;
        private Text proactiveWhisperSeatText;
        private Text proactiveWhisperTitleText;
        private Text proactiveWhisperBodyText;
        private Text proactiveWhisperMetaText;
        private Text proactiveWhisperQueueText;
        private Text proactiveWhisperIntentText;
        private RectTransform proactiveWhisperQueuePipsRoot;
        private RectTransform proactiveWhisperQueueListRoot;
        private Text phaseAssistTitleText;
        private Text phaseAssistHintText;
        private Text phaseAssistBadgeText;
        private Text phaseAssistProgressText;
        private RectTransform phaseAssistSignalRoot;
        private Image phaseAssistBadgeImage;
        private Image phaseAssistProgressTrack;
        private Image phaseAssistProgressFill;
        private Image phaseAssistProgressKnob;
        private Button phaseAssistPrimaryButton;
        private Button phaseAssistSecondaryButton;
        private Button phaseAssistTertiaryButton;
        private Text phaseAssistPrimaryLabel;
        private Text phaseAssistSecondaryLabel;
        private Text phaseAssistTertiaryLabel;
        private Text nominationDebateTitleText;
        private Text nominationDebateBodyText;
        private Text nominationDebateStatusText;
        private RectTransform nominationDebateFocusRoot;
        private RectTransform nominationDebateDuelRoot;
        private RectTransform nominationDebateCardRoot;
        private InputField nominationDebateResponseInput;
        private Button nominationDebateResponseButton;
        private Text tokenInspectorTitle;
        private Text tokenInspectorGuidanceTitleText;
        private Text tokenInspectorGuidanceBadgeText;
        private Text tokenInspectorBody;
        private Text tokenInspectorActionStripText;
        private Image tokenInspectorGuidanceBadgeImage;
        private Button tokenInspectorPrivateButton;
        private Button tokenInspectorNominationButton;
        private Button tokenInspectorMarkButton;
        private Button tokenInspectorReminderButton;
        private Button tokenInspectorActionButton;
        private Text objectiveTitleText;
        private Text objectiveHintText;
        private Text actionSummaryText;
        private Button dockPrivateButton;
        private Button dockPublicButton;
        private Button dockNominationButton;
        private Button dockPrimaryActionButton;
        private Button dockVoteButton;
        private Button dockMoreButton;
        private Text flowGuideText;
        private Text flowStatusBadgeText;
        private Text flowCurrentTitleText;
        private Text flowCurrentHintText;
        private Text flowNextTitleText;
        private Text flowNextHintText;
        private Text flowStateTitleText;
        private Text flowStateHintText;
        private Image flowStatusBadgeImage;
        private Text nextPhaseButtonLabelText;
        private Text eventBody;
        private Text queueBody;
        private Text timelineBody;
        private Text infoDrawerTitle;
        private RectTransform infoNotebookCardRoot;
        private Text privateChannelTitleText;
        private Text privateChannelStatusText;
        private Image privateChannelStatusPill;
        private Text privateTargetText;
        private Text privateClaimRoleText;
        private Text privateHistoryText;
        private Text privateHistoryMetaText;
        private RectTransform privateDialogueStageRoot;
        private RectTransform privateDialogueStageBannerRoot;
        private RectTransform privateComposePreviewRoot;
        private RectTransform privateComposeReadinessRoot;
        private Image privateComposePreviewBadgeImage;
        private Image privateComposeReadinessStepPill;
        private Text privateComposePreviewBadgeText;
        private Text privateComposePreviewTitleText;
        private Text privateComposePreviewBodyText;
        private Text privateComposePreviewMetaText;
        private Text privateComposeReadinessMetaText;
        private Text privateComposeReadinessStepText;
        private RectTransform privateThreadRhythmRoot;
        private RectTransform privateQuickPromptStripRoot;
        private Image privateQuickPromptStatePill;
        private Text privateQuickPromptStateText;
        private Text privateStatusText;
        private Text rolePickerTitle;
        private Text rolePickerStatusText;
        private Text actionTargetBarStatusText;
        private Text actionFormTitle;
        private Text actionFormBody;
        private Text actionFormStatusText;
        private Text actionQuestionStatusText;
        private Text actionQuestionCountText;
        private Image actionQuestionStatusPill;
        private Button nextPhaseButton;
        private Button actionFormAutoButton;
        private Button actionFormSubmitButton;
        private Text storytellerTitle;
        private Text storytellerBody;
        private Text handbookTitle;
        private Text handbookDetailText;
        private Text handbookOrderText;
        private Button handbookAllCategoryButton;
        private Button handbookTownsfolkCategoryButton;
        private Button handbookOutsiderCategoryButton;
        private Button handbookMinionCategoryButton;
        private Button handbookDemonCategoryButton;
        private Text reminderPickerTitle;
        private Text reminderPickerStatusText;
        private Text reminderPickerCustomHintText;
        private Text voteTitle;
        private Text voteBody;
        private Text endgameTitle;
        private Text endgameSubtitleText;
        private Text endgameBody;
        private Text endgameEventsText;
        private RectTransform endgameOutcomeCardRoot;
        private RectTransform endgameEventCardRoot;
        private RectTransform endgameEventRailRoot;
        private RectTransform endgameVerdictFocusRoot;
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
        private Text settingsDisplaySummaryText;
        private Text settingsAudioSummaryText;
        private Text settingsAiSummaryText;
        private Image settingsFullscreenSwitchTrack;
        private Image settingsFullscreenSwitchKnob;
        private Image settingsLocalLlmSwitchTrack;
        private Image settingsLocalLlmSwitchKnob;
        private Image settingsMasterVolumeFill;
        private Image settingsMusicVolumeFill;
        private Image settingsUiVolumeFill;
        private Text settingsStatusText;
        private Text menuSetupScriptText;
        private Text menuSetupPlayerCountText;
        private Text menuSetupRoleText;
        private Text menuSetupSummaryText;
        private Text menuSetupStatusText;
        private Text menuSetupHintTitleText;
        private Image menuSetupStatusImage;
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
        private InputField publicSpeechInput;
        private InputField privateNightInput;
        private Toggle privateSecretToggle;
        private string activeActionFormId = "";
        private readonly List<string> selectedActionTargetIds = new List<string>();
        private string selectedActionRoleId = "";
        private string selectedActionModeId = "";
        private string actionQuestionDraftText = "";
        private readonly List<ActionGuessSelection> selectedActionGuesses = new List<ActionGuessSelection>();
        private int actionTargetPage;
        private int actionRolePage;
        private int storytellerQueuePage;
        private InputField actionQuestionInput;
        private string activeHandbookMode = "roles";
        private string activeHandbookCategory = "all";
        private int activeHandbookRoleIndex;
        private int activeHandbookRolePage;
        private string activeRolePickerMode = "";
        private string activeRolePickerPlayerId = "";
        private string activeRolePickerCategory = "all";
        private int activeRolePickerPage;
        private string activeReminderPlayerId = "";
        private int activeReminderPage;
        private int activeReasoningScoreTrailPage;
        private int activeReasoningScoreTrailExpandedIndex = -1;
        private string activeInfoTimelineAnchorId = "";
        private bool reopenReminderPickerAfterRoleMark;
        private InputField reminderCustomInput;
        private string privateChatStatus = "";
        private string publicSpeechStatus = "";
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
        private readonly Dictionary<string, MoreActionTileState> moreActionTiles = new Dictionary<string, MoreActionTileState>();
        private string queuedPhaseTransitionStage = "";
        private bool queuedPhaseTransitionPending;
        private string lastPhaseTransitionKey = "";
        private string lastTimelineNarrationKey = "";
        private string lastPrivateInfoNarrationKey = "";
        private string lastNightActionNarrationKey = "";
        private string lastNominationDebateNarrationKey = "";
        private string lastVoteCeremonyNarrationKey = "";
        private string lastActionStatusNarrationKey = "";
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
        private readonly List<Image> stageDialogueQueuePipImages = new List<Image>();
        private int stageDialoguePageIndex;
        private bool stageDialogueTyping;
        private string stageDialogueCurrentPageText = "";
        private string stageDialogueBaseTag = "";
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
        private int activeReasoningRecapIndex;
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
            lastNominationDebateNarrationKey = NominationDebateNarrationKey(vm);
            lastVoteCeremonyNarrationKey = VoteCeremonyNarrationKey(vm);
            lastActionStatusNarrationKey = ActionStatusNarrationKey(vm);
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
            UpdateStageDialogueMotion();
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
            AddImage("Top Shadow", canvas.transform, new Vector2(0f, 0.94f), Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.08f));
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
            var hud = AddPanel("Top Hud Root", canvas.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-830f, -78f), new Vector2(830f, -14f), new Color(0f, 0f, 0f, 0f));
            topHudRoot = hud.GetComponent<RectTransform>();
            var hudImage = hud.GetComponent<Image>();
            if (hudImage != null) hudImage.raycastTarget = false;

            var leftPod = AddPanel("Top Left Pod", hud.transform, Vector2.zero, Vector2.zero, new Vector2(0f, 6f), new Vector2(454f, 64f), new Color(0.010f, 0.012f, 0.014f, 0.36f));
            AddFrame(leftPod.transform, "Top Left Frame", 0.8f, new Color(0.85f, 0.62f, 0.32f, 0.08f));
            AddImage("Top Left Warm Strip", leftPod.transform, Vector2.zero, new Vector2(1f, 0.32f), new Vector2(0f, 0f), new Vector2(0f, 1.2f), new Color(0.74f, 0.48f, 0.18f, 0.018f));

            var rightPod = AddPanel("Top Right Pod", hud.transform, Vector2.zero, Vector2.zero, new Vector2(1128f, 6f), new Vector2(1660f, 64f), new Color(0.010f, 0.012f, 0.014f, 0.34f));
            AddFrame(rightPod.transform, "Top Right Frame", 0.8f, new Color(0.85f, 0.62f, 0.32f, 0.075f));
            AddImage("Top Right Warm Strip", rightPod.transform, Vector2.zero, new Vector2(1f, 0.32f), new Vector2(0f, 0f), new Vector2(0f, 1.2f), new Color(0.74f, 0.48f, 0.18f, 0.016f));

            headerText = AddText("Header", leftPod.transform, Vector2.zero, Vector2.one, new Vector2(22f, 25f), new Vector2(-222f, -5f), "BOTC SOLO", 25, TextAnchor.UpperLeft, FontStyle.Bold);
            tickerText = AddText("Ticker", leftPod.transform, Vector2.zero, Vector2.one, new Vector2(22f, 7f), new Vector2(-14f, -36f), "", 12, TextAnchor.UpperLeft, FontStyle.Normal);
            tickerText.color = new Color(0.84f, 0.88f, 0.90f, 0.90f);

            townsfolkBadge = null;
            outsiderBadge = null;
            minionBadge = null;
            demonBadge = null;

            vitalsText = AddText("Vitals", rightPod.transform, Vector2.zero, Vector2.one, new Vector2(16f, 36f), new Vector2(-334f, -4f), "", 13, TextAnchor.MiddleLeft, FontStyle.Bold);
            phaseText = AddText("Phase", rightPod.transform, Vector2.zero, Vector2.one, new Vector2(206f, 36f), new Vector2(-14f, -4f), "", 13, TextAnchor.MiddleRight, FontStyle.Normal);
            syncStatusPill = AddPanel("Sync Status Pill", rightPod.transform, Vector2.zero, Vector2.one, new Vector2(16f, 36f), new Vector2(-342f, -6f), new Color(0.05f, 0.09f, 0.07f, 0.36f)).GetComponent<Image>();
            syncStatusPill.transform.SetAsFirstSibling();
            AddFrame(syncStatusPill.transform, "Sync Status Pill Frame", 0.7f, new Color(0.76f, 0.92f, 0.66f, 0.15f));
            syncStatusText = AddText("Sync Status", rightPod.transform, Vector2.zero, Vector2.one, new Vector2(24f, 36f), new Vector2(-350f, -6f), "", 10, TextAnchor.MiddleRight, FontStyle.Bold);
            AddHudToolButton("新局", rightPod.transform, new Vector2(52f, 20f), new Vector2(76f, 28f), () => SelectDialoguePreset("new-game"));
            AddHudToolButton("帮助", rightPod.transform, new Vector2(140f, 20f), new Vector2(86f, 28f), () => SelectDialoguePreset("help"));
            AddHudToolButton("主菜单", rightPod.transform, new Vector2(240f, 20f), new Vector2(92f, 28f), () => ToggleMainMenu(true));
            AddHudToolButton("设置", rightPod.transform, new Vector2(336f, 20f), new Vector2(76f, 28f), OpenSettingsPanel);
        }

        private Button AddHudToolButton(string label, Transform parent, Vector2 anchoredPosition, Vector2 size, UnityEngine.Events.UnityAction onClick)
        {
            var half = size * 0.5f;
            var panel = AddPanel($"Hud Tool {label}", parent, Vector2.zero, Vector2.zero, anchoredPosition - half, anchoredPosition + half, new Color(0.070f, 0.040f, 0.020f, 0.52f));
            AddImage("Hud Tool Glow", panel.transform, new Vector2(0f, 0.55f), new Vector2(1f, 1f), new Vector2(2f, -2f), new Vector2(-2f, -2f), new Color(1f, 0.72f, 0.30f, 0.035f));
            AddFrame(panel.transform, "Hud Tool Frame", 0.65f, new Color(0.94f, 0.68f, 0.34f, 0.22f));
            var button = panel.AddComponent<Button>();
            button.onClick.AddListener(onClick);
            ApplyButtonStyle(button);
            var text = AddText("Label", panel.transform, Vector2.zero, Vector2.one, new Vector2(3f, 0f), new Vector2(-3f, 0f), label, size.x <= 78f ? 12 : 13, TextAnchor.MiddleCenter, FontStyle.Bold);
            text.color = new Color(1f, 0.92f, 0.74f, 0.96f);
            return button;
        }

        private void BuildSideControls()
        {
            var phaseDock = AddPanel("Phase Rail", canvas.transform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(18f, -248f), new Vector2(230f, 248f), new Color(0.006f, 0.013f, 0.020f, 0.10f)).GetComponent<RectTransform>();
            phaseRailRoot = phaseDock;
            AddFrame(phaseDock, "Phase Rail Frame", 0.7f, new Color(0.82f, 0.56f, 0.25f, 0.07f));
            AddImage("Phase Rail Wash", phaseDock, Vector2.zero, Vector2.one, new Vector2(4f, 4f), new Vector2(-4f, -4f), new Color(0.12f, 0.075f, 0.030f, 0.034f));
            AddText("Phase Dock Title", phaseDock, Vector2.zero, Vector2.one, new Vector2(20f, 440f), new Vector2(-96f, -14f), "阶段", 21, TextAnchor.UpperLeft, FontStyle.Bold);
            var badge = AddPanel("Flow Status Badge", phaseDock, Vector2.zero, Vector2.zero, new Vector2(138f, 402f), new Vector2(198f, 430f), new Color(0.030f, 0.085f, 0.060f, 0.62f));
            flowStatusBadgeImage = badge.GetComponent<Image>();
            AddFrame(badge.transform, "Flow Status Badge Frame", 0.7f, new Color(0.56f, 0.92f, 0.58f, 0.28f));
            flowStatusBadgeText = AddText("Flow Status Badge Text", badge.transform, Vector2.zero, Vector2.one, new Vector2(8f, 0f), new Vector2(-8f, 0f), "就绪", 13, TextAnchor.MiddleCenter, FontStyle.Bold);
            flowStatusBadgeText.color = new Color(0.78f, 1f, 0.72f, 0.98f);
            flowCurrentTitleText = AddFlowTaskCard(phaseDock, "Current", "当前", new Vector2(14f, 300f), new Vector2(198f, 388f), out flowCurrentHintText);
            flowStateTitleText = AddFlowTaskCard(phaseDock, "State", "状态", new Vector2(14f, 208f), new Vector2(198f, 290f), out flowStateHintText);
            flowNextTitleText = AddFlowTaskCard(phaseDock, "Next", "下一步", new Vector2(14f, 118f), new Vector2(198f, 200f), out flowNextHintText);
            flowGuideText = AddText("Flow Guide", phaseDock, Vector2.zero, Vector2.zero, new Vector2(18f, 158f), new Vector2(162f, 159f), "", 1, TextAnchor.UpperLeft, FontStyle.Normal);
            flowGuideText.gameObject.SetActive(false);
            nextPhaseButton = AddNavButton("下一步", phaseDock, new Vector2(106f, 62f), new Vector2(172f, 42f), () => CyclePhase("next"));
            nextPhaseButtonLabelText = nextPhaseButton.GetComponentInChildren<Text>();
            AddNavButton("☀ 公聊", phaseDock, new Vector2(62f, 20f), new Vector2(82f, 32f), () => SelectDialoguePreset("public"));
            AddNavButton("⚖ 提名", phaseDock, new Vector2(150f, 20f), new Vector2(82f, 32f), () => SelectDialoguePreset("nomination"));

            var infoDock = AddPanel("Info Rail", canvas.transform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-174f, -176f), new Vector2(-18f, 176f), new Color(0.006f, 0.013f, 0.020f, 0.13f)).GetComponent<RectTransform>();
            infoRailRoot = infoDock;
            AddFrame(infoDock, "Info Rail Frame", 0.8f, new Color(0.82f, 0.56f, 0.25f, 0.10f));
            AddImage("Info Rail Wash", infoDock, Vector2.zero, Vector2.one, new Vector2(4f, 4f), new Vector2(-4f, -4f), new Color(0.12f, 0.075f, 0.030f, 0.050f));
            AddText("Info Dock Title", infoDock, Vector2.zero, Vector2.one, new Vector2(20f, 294f), new Vector2(-18f, -12f), "资料", 22, TextAnchor.UpperLeft, FontStyle.Bold);
            AddNavButton("☷ 日志", infoDock, new Vector2(78f, 250f), new Vector2(132f, 40f), ToggleEventPanel);
            AddNavButton("@ 私聊", infoDock, new Vector2(78f, 194f), new Vector2(132f, 40f), () => ShowInfoDrawer("whispers"));
            AddNavButton("◎ 公开", infoDock, new Vector2(78f, 138f), new Vector2(132f, 40f), () => ShowInfoDrawer("public"));
            AddNavButton("◉ 全知", infoDock, new Vector2(78f, 82f), new Vector2(132f, 40f), () => SelectDialoguePreset("grimoire"));
        }

        private Text AddFlowTaskCard(Transform parent, string key, string label, Vector2 offsetMin, Vector2 offsetMax, out Text hintText)
        {
            var card = AddPanel($"Flow {key} Card", parent, Vector2.zero, Vector2.zero, offsetMin, offsetMax, new Color(0.004f, 0.010f, 0.017f, 0.26f));
            AddFrame(card.transform, $"Flow {key} Frame", 0.6f, new Color(0.86f, 0.58f, 0.26f, 0.075f));
            AddImage($"Flow {key} Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(3f, 0f), new Color(0.94f, 0.64f, 0.28f, 0.18f));
            var height = Mathf.Max(60f, offsetMax.y - offsetMin.y);
            var labelBottom = Mathf.Max(40f, height - 24f);
            var titleBottom = Mathf.Max(24f, height - 54f);
            var hintTop = Mathf.Max(22f, titleBottom - 4f);
            AddText($"Flow {key} Label", card.transform, Vector2.zero, Vector2.one, new Vector2(12f, labelBottom), new Vector2(-12f, -7f), label, 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.86f);
            var titleText = AddText($"Flow {key} Title", card.transform, Vector2.zero, Vector2.one, new Vector2(12f, titleBottom), new Vector2(-10f, -(height - labelBottom + 3f)), "", height >= 88f ? 15 : 14, TextAnchor.UpperLeft, FontStyle.Bold);
            titleText.color = new Color(0.98f, 0.93f, 0.82f, 0.98f);
            hintText = AddText($"Flow {key} Hint", card.transform, Vector2.zero, Vector2.one, new Vector2(12f, 8f), new Vector2(-10f, -(height - hintTop)), "", 11, TextAnchor.UpperLeft, FontStyle.Normal);
            hintText.color = new Color(0.78f, 0.84f, 0.88f, 0.78f);
            return titleText;
        }

        private void BuildBottomDock()
        {
            bottomDock = AddPanel("Bottom Dock", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-830f, 14f), new Vector2(830f, 152f), new Color(0.006f, 0.014f, 0.024f, 0.46f)).GetComponent<RectTransform>();
            AddFrame(bottomDock, "Bottom Dock Frame", 0.8f, new Color(0.82f, 0.56f, 0.25f, 0.13f));
            AddImage("Bottom Left Wash", bottomDock, Vector2.zero, Vector2.one, new Vector2(18f, 12f), new Vector2(-1122f, -10f), new Color(0.020f, 0.028f, 0.036f, 0.11f));
            AddImage("Bottom Middle Wash", bottomDock, Vector2.zero, Vector2.one, new Vector2(548f, 12f), new Vector2(-570f, -10f), new Color(0.020f, 0.028f, 0.036f, 0.10f));
            AddImage("Bottom Actions Wash", bottomDock, Vector2.zero, Vector2.one, new Vector2(1104f, 12f), new Vector2(-16f, -10f), new Color(0.020f, 0.028f, 0.036f, 0.12f));
            AddImage("Bottom Objective Accent", bottomDock, Vector2.zero, new Vector2(0f, 1f), new Vector2(18f, 14f), new Vector2(22f, -14f), new Color(0.96f, 0.66f, 0.26f, 0.24f));
            AddImage("Bottom Divider Left", bottomDock, Vector2.zero, new Vector2(0f, 1f), new Vector2(532f, 16f), new Vector2(533f, -16f), new Color(0.95f, 0.65f, 0.28f, 0.08f));
            AddImage("Bottom Divider Right", bottomDock, Vector2.zero, new Vector2(0f, 1f), new Vector2(1088f, 16f), new Vector2(1089f, -16f), new Color(0.95f, 0.65f, 0.28f, 0.08f));
            objectiveTitleText = AddText("Objective Title", bottomDock, Vector2.zero, Vector2.one, new Vector2(34f, 104f), new Vector2(-1124f, -8f), "阶段目标", 20, TextAnchor.UpperLeft, FontStyle.Bold);
            objectiveHintText = AddText("Objective Hint", bottomDock, Vector2.zero, Vector2.one, new Vector2(34f, 80f), new Vector2(-1124f, -38f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            dialogueTitle = AddText("Dialogue Title", bottomDock, Vector2.zero, Vector2.one, new Vector2(34f, 54f), new Vector2(-1124f, -70f), "对话舞台", 17, TextAnchor.UpperLeft, FontStyle.Bold);
            dialogueBody = AddText("Dialogue Body", bottomDock, Vector2.zero, Vector2.one, new Vector2(34f, 18f), new Vector2(-1124f, -98f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            actionSummaryText = AddText("Action Summary", bottomDock, Vector2.zero, Vector2.one, new Vector2(574f, 18f), new Vector2(-590f, -18f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            dockPrivateButton = AddToolActionButton("@", "私聊", bottomDock, new Vector2(1180f, 112f), new Vector2(124f, 38f), () => SelectDialoguePreset("private"), true);
            dockPublicButton = AddToolActionButton("◎", "公聊", bottomDock, new Vector2(1320f, 112f), new Vector2(124f, 38f), () => SelectDialoguePreset("public"), true);
            dockNominationButton = AddToolActionButton("⚑", "提名", bottomDock, new Vector2(1460f, 112f), new Vector2(124f, 38f), () => SelectDialoguePreset("nomination"), true);
            dockPrimaryActionButton = AddToolActionButton("✦", "行动", bottomDock, new Vector2(1180f, 58f), new Vector2(124f, 38f), SelectPrimaryAction);
            dockVoteButton = AddToolActionButton("✓", "投票", bottomDock, new Vector2(1320f, 58f), new Vector2(124f, 38f), () => SelectDialoguePreset("vote-panel"), true);
            dockMoreButton = AddToolActionButton("…", "更多", bottomDock, new Vector2(1460f, 58f), new Vector2(124f, 38f), ToggleMoreActionsPanel, true);
            AddButton("收起", bottomDock, new Vector2(1580f, 118f), new Vector2(72f, 26f), ToggleBottomDock);
            bottomDockToggle = AddButton("对话 / 行动", canvas.transform, new Vector2(1810f, 76f), new Vector2(172f, 38f), ToggleBottomDock).GetComponent<RectTransform>();
            bottomDockToggle.gameObject.SetActive(false);
        }

        private void BuildMoreActionsPanel()
        {
            moreActionsPanel = AddPanel("More Actions Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(76f, 184f), new Vector2(744f, 500f), new Color(0.005f, 0.012f, 0.020f, 0.91f)).GetComponent<RectTransform>();
            AddFrame(moreActionsPanel, "More Actions Frame", 1f, new Color(0.92f, 0.62f, 0.28f, 0.36f));
            AddImage("More Actions Header Wash", moreActionsPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -62f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.060f));
            AddText("More Actions Title", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(24f, 268f), new Vector2(-24f, -12f), "更多动作", 25, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("More Actions Hint", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(472f, 278f), new Vector2(-24f, -22f), "工具托盘", 13, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.95f, 0.78f, 0.42f, 0.82f);
            moreActionsSignalRoot = AddPanel("More Actions Signal Strip", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(194f, 232f), new Vector2(-190f, -58f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            moreActionsRouteRoot = AddPanel("More Actions Route Strip", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(486f, 238f), new Vector2(-24f, -52f), new Color(0.006f, 0.012f, 0.016f, 0.50f)).GetComponent<RectTransform>();
            moreActionsRouteRoot.GetComponent<Image>().raycastTarget = false;
            var contextPill = AddPanel("More Actions Context Pill", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(194f, 264f), new Vector2(-190f, -14f), new Color(0.010f, 0.018f, 0.026f, 0.62f));
            AddFrame(contextPill.transform, "More Actions Context Frame", 0.7f, new Color(0.70f, 0.82f, 0.92f, 0.18f));
            moreActionsContextText = AddText("More Actions Context", contextPill.transform, Vector2.zero, Vector2.one, new Vector2(12f, 17f), new Vector2(-12f, -4f), "", 11, TextAnchor.UpperLeft, FontStyle.Bold);
            moreActionsContextText.color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            moreActionsSuggestionText = AddText("More Actions Suggestion", contextPill.transform, Vector2.zero, Vector2.one, new Vector2(12f, 3f), new Vector2(-12f, -18f), "", 10, TextAnchor.UpperLeft, FontStyle.Normal);
            moreActionsSuggestionText.color = new Color(0.70f, 0.84f, 0.88f, 0.82f);
            AddImage("More Actions Body Wash", moreActionsPanel, Vector2.zero, Vector2.one, new Vector2(18f, 18f), new Vector2(-18f, -74f), new Color(0.020f, 0.028f, 0.036f, 0.20f));

            AddMoreActionSectionLabel("社交", "私聊 / 伪装", 206f);
            AddMoreActionButton("询", "询身", "问身份", 0, 0, () => SelectDialoguePreset("ask-claim"));
            AddMoreActionButton("骗", "骗身", "伪装声明", 1, 0, () => SelectDialoguePreset("decept-claim"));
            AddMoreActionButton("密", "保密", "私下承诺", 2, 0, () => SelectDialoguePreset("decept-secret"));
            AddMoreActionButton("信", "编夜信", "补夜信", 3, 0, () => SelectDialoguePreset("decept-night"));

            AddMoreActionSectionLabel("阶段", "流程控制", 148f);
            AddMoreActionButton("夜", "夜间", "夜行动", 0, 1, () => SelectDialoguePreset("night"));
            AddMoreActionButton("昼", "白天", "日间行动", 1, 1, () => SelectDialoguePreset("day"));
            AddMoreActionButton("说", "说书人", "队列", 2, 1, () => SelectDialoguePreset("storyteller"));
            AddMoreActionButton("注", "提醒", "加标记", 3, 1, () => { CloseMoreActionsPanel(); OpenReminderPickerForSelected(); });

            AddMoreActionSectionLabel("资料", "查阅 / 记录", 90f);
            AddMoreActionButton("标", "标记", "角色标记", 0, 2, () => SelectDialoguePreset("mark-role"));
            AddMoreActionButton("册", "手册", "角色/帮助", 1, 2, () => SelectDialoguePreset("handbook"));
            AddMoreActionButton("复", "复盘", "AI 线索", 2, 2, () => { CloseMoreActionsPanel(); ShowInfoDrawer("recap"); });
            AddMoreActionButton("知", "全知", "魔典视角", 3, 2, () => SelectDialoguePreset("grimoire"));

            AddMoreActionSectionLabel("系统", "局外工具", 32f);
            AddMoreActionButton("新", "新局", "重开", 0, 3, () => SelectDialoguePreset("new-game"));
            AddMoreActionButton("菜", "主菜单", "返回入口", 1, 3, () => { CloseMoreActionsPanel(); ToggleMainMenu(true); });
            AddMoreActionButton("设", "设置", "音画", 2, 3, () => { CloseMoreActionsPanel(); OpenSettingsPanel(); });
            AddMoreActionButton("×", "关闭", "收起", 3, 3, CloseMoreActionsPanel);
            moreActionsPanel.gameObject.SetActive(false);
        }

        private void AddMoreActionSectionLabel(string label, string helper, float y)
        {
            var rail = AddPanel($"More Actions Section {label}", moreActionsPanel, Vector2.zero, Vector2.zero, new Vector2(24f, y - 23f), new Vector2(86f, y + 23f), new Color(0.055f, 0.037f, 0.024f, 0.64f));
            AddImage("More Actions Section Accent", rail.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.56f));
            AddFrame(rail.transform, "More Actions Section Frame", 0.7f, new Color(0.94f, 0.68f, 0.34f, 0.20f));
            AddText("More Actions Section Label", rail.transform, Vector2.zero, Vector2.one, new Vector2(8f, 18f), new Vector2(-6f, -5f), label, 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.96f);
            AddText("More Actions Section Helper", rail.transform, Vector2.zero, Vector2.one, new Vector2(8f, 4f), new Vector2(-6f, -24f), helper, 9, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.70f, 0.82f, 0.84f, 0.72f);
        }

        private Button AddMoreActionButton(string icon, string label, string helper, int col, int row, UnityEngine.Events.UnityAction onClick)
        {
            var size = new Vector2(122f, 48f);
            var center = new Vector2(150f + col * 132f, 206f - row * 58f);
            var half = size * 0.5f;
            var tile = AddPanel($"More Action Tile {label}", moreActionsPanel, Vector2.zero, Vector2.zero, center - half, center + half, new Color(0.050f, 0.033f, 0.022f, 0.82f));
            var suggestedGlow = AddImage("More Action Suggested Glow", tile.transform, Vector2.zero, Vector2.one, new Vector2(-4f, -4f), new Vector2(4f, 4f), new Color(1f, 0.76f, 0.24f, 0.24f));
            suggestedGlow.raycastTarget = false;
            suggestedGlow.gameObject.SetActive(false);
            suggestedButtonGlows.Add(suggestedGlow);
            var tileGlow = AddImage("More Action Tile Glow", tile.transform, new Vector2(0f, 0.54f), Vector2.one, new Vector2(2f, -2f), new Vector2(-2f, -2f), new Color(1f, 0.70f, 0.28f, 0.050f));
            var accent = AddImage("More Action Tile Accent", tile.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.38f));
            AddFrame(tile.transform, "More Action Tile Frame", 0.85f, new Color(0.94f, 0.68f, 0.34f, 0.34f));

            var button = tile.AddComponent<Button>();
            tile.AddComponent<CanvasGroup>();
            button.onClick.AddListener(onClick);
            ApplyButtonStyle(button);

            var badge = AddImage("More Action Badge", tile.transform, Vector2.zero, Vector2.zero, new Vector2(9f, 9f), new Vector2(39f, 39f), new Color(0.020f, 0.030f, 0.040f, 0.82f));
            badge.sprite = GetCircleFillSprite();
            AddFrame(badge.transform, "More Action Badge Frame", 0.7f, new Color(0.70f, 0.82f, 0.92f, 0.24f));
            var iconText = AddText("More Action Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, 15, TextAnchor.MiddleCenter, FontStyle.Bold);
            iconText.color = new Color(1f, 0.82f, 0.42f, 0.98f);

            var suggestedBadge = AddImage("More Action Suggested Badge", tile.transform, Vector2.zero, Vector2.zero, new Vector2(92f, 31f), new Vector2(116f, 46f), new Color(0.90f, 0.56f, 0.18f, 0.88f));
            suggestedBadge.raycastTarget = false;
            AddFrame(suggestedBadge.transform, "More Action Suggested Badge Frame", 0.55f, new Color(1f, 0.82f, 0.42f, 0.45f));
            var markerText = AddText("More Action Suggested Marker", suggestedBadge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, "荐", 10, TextAnchor.MiddleCenter, FontStyle.Bold);
            markerText.color = new Color(0.10f, 0.055f, 0.020f, 0.96f);
            markerText.raycastTarget = false;
            suggestedBadge.gameObject.SetActive(false);

            var labelText = AddText("More Action Label", tile.transform, Vector2.zero, Vector2.one, new Vector2(46f, 23f), new Vector2(-8f, -5f), label, label.Length > 3 ? 13 : 14, TextAnchor.UpperLeft, FontStyle.Bold);
            labelText.color = new Color(0.98f, 0.91f, 0.78f, 1f);
            var helperText = AddText("More Action Helper", tile.transform, Vector2.zero, Vector2.one, new Vector2(46f, 7f), new Vector2(-8f, -24f), helper, helper.Length > 4 ? 9 : 10, TextAnchor.UpperLeft, FontStyle.Normal);
            helperText.color = new Color(0.70f, 0.82f, 0.84f, 0.74f);
            moreActionTiles[MoreActionTileKey(col, row)] = new MoreActionTileState(button, tile.GetComponent<Image>(), tileGlow, accent, suggestedGlow, suggestedBadge, markerText, labelText, helperText);
            return button;
        }

        private void BuildProactiveWhisperPanel()
        {
            proactiveWhisperPanel = AddPanel("Proactive Whisper Panel", canvas.transform, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-704f, 154f), new Vector2(-24f, 506f), new Color(0.006f, 0.014f, 0.020f, 0.80f)).GetComponent<RectTransform>();
            AddFrame(proactiveWhisperPanel, "Proactive Whisper Frame", 0.9f, new Color(0.92f, 0.62f, 0.28f, 0.24f));
            AddImage("Proactive Whisper Left Accent", proactiveWhisperPanel, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.96f, 0.62f, 0.24f, 0.44f));
            AddImage("Proactive Whisper Header Wash", proactiveWhisperPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -62f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.050f));
            AddImage("Proactive Whisper Body Wash", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(126f, 204f), new Vector2(-22f, -66f), new Color(0.020f, 0.028f, 0.036f, 0.18f));

            var tokenCard = AddPanel("Proactive Whisper Token Card", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(18f, 192f), new Vector2(-564f, -32f), new Color(0.028f, 0.022f, 0.018f, 0.56f));
            AddFrame(tokenCard.transform, "Proactive Whisper Token Card Frame", 0.7f, new Color(0.92f, 0.66f, 0.34f, 0.20f));
            var tokenGlow = AddImage("Proactive Whisper Token Glow", tokenCard.transform, Vector2.zero, Vector2.one, new Vector2(8f, 22f), new Vector2(-8f, -22f), new Color(1f, 0.70f, 0.30f, 0.085f));
            tokenGlow.sprite = GetCircleFillSprite();
            tokenGlow.preserveAspect = true;
            tokenGlow.raycastTarget = false;
            proactiveWhisperTokenImage = AddImage("Proactive Whisper Token", tokenCard.transform, Vector2.zero, Vector2.one, new Vector2(14f, 26f), new Vector2(-14f, -18f), new Color(0.92f, 0.82f, 0.60f, 0.92f));
            proactiveWhisperTokenImage.sprite = SpriteFromResource("Botc/ui/vote1") ?? GetCircleFillSprite();
            proactiveWhisperTokenImage.preserveAspect = true;
            proactiveWhisperSeatText = AddText("Proactive Whisper Seat", tokenCard.transform, Vector2.zero, Vector2.one, new Vector2(8f, 4f), new Vector2(-8f, -76f), "来访", 13, TextAnchor.MiddleCenter, FontStyle.Bold);
            proactiveWhisperSeatText.color = new Color(1f, 0.82f, 0.48f, 0.96f);

            proactiveWhisperTitleText = AddText("Proactive Whisper Title", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(126f, 304f), new Vector2(-184f, -16f), "私聊邀请", 21, TextAnchor.UpperLeft, FontStyle.Bold);
            proactiveWhisperQueueText = AddText("Proactive Whisper Queue", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(504f, 308f), new Vector2(-22f, -20f), "", 12, TextAnchor.UpperRight, FontStyle.Bold);
            proactiveWhisperQueueText.color = new Color(0.86f, 0.78f, 0.62f, 0.86f);
            proactiveWhisperBodyText = AddText("Proactive Whisper Body", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(140f, 220f), new Vector2(-34f, -76f), "", 15, TextAnchor.MiddleLeft, FontStyle.Normal);
            proactiveWhisperIntentText = AddText("Proactive Whisper Intent", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(126f, 190f), new Vector2(-226f, -140f), "", 12, TextAnchor.MiddleLeft, FontStyle.Bold);
            proactiveWhisperIntentText.color = new Color(1f, 0.74f, 0.34f, 0.92f);
            proactiveWhisperMetaText = AddText("Proactive Whisper Meta", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(126f, 280f), new Vector2(-184f, -50f), "", 12, TextAnchor.MiddleLeft, FontStyle.Normal);
            proactiveWhisperMetaText.color = new Color(0.76f, 0.86f, 0.90f, 0.90f);
            proactiveWhisperQueuePipsRoot = AddPanel("Proactive Whisper Queue Pips", proactiveWhisperPanel, Vector2.zero, Vector2.zero, new Vector2(36f, 26f), new Vector2(102f, 44f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            proactiveWhisperQueueListRoot = AddPanel("Proactive Whisper Queue List", proactiveWhisperPanel, Vector2.zero, Vector2.one, new Vector2(18f, 58f), new Vector2(-18f, -176f), new Color(0.010f, 0.018f, 0.026f, 0.32f)).GetComponent<RectTransform>();
            AddFrame(proactiveWhisperQueueListRoot, "Proactive Whisper Queue List Frame", 0.65f, new Color(0.70f, 0.82f, 0.92f, 0.10f));
            AddToolActionButton("✓", "接受", proactiveWhisperPanel, new Vector2(408f, 30f), new Vector2(104f, 34f), AcceptProactiveWhisperOffer, true);
            AddToolActionButton("…", "稍后", proactiveWhisperPanel, new Vector2(522f, 30f), new Vector2(90f, 34f), SnoozeProactiveWhisperOffer, true);
            AddToolActionButton("×", "拒绝", proactiveWhisperPanel, new Vector2(622f, 30f), new Vector2(90f, 34f), DeclineProactiveWhisperOffer, true);
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
            endgameSubtitleText = AddText("Endgame Subtitle", endgamePanel, Vector2.zero, Vector2.one, new Vector2(36f, 516f), new Vector2(-420f, -80f), "对局已结算", 15, TextAnchor.UpperLeft, FontStyle.Bold);
            endgameSubtitleText.color = new Color(0.96f, 0.82f, 0.52f, 0.92f);
            endgameVerdictFocusRoot = AddPanel("Endgame Verdict Focus Strip", endgamePanel, Vector2.zero, Vector2.one, new Vector2(598f, 500f), new Vector2(-120f, -80f), new Color(0.006f, 0.012f, 0.016f, 0.50f)).GetComponent<RectTransform>();
            AddText("Endgame Hint", endgamePanel, Vector2.zero, Vector2.one, new Vector2(760f, 556f), new Vector2(-144f, -24f), "结算 / 复盘", 13, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.88f);
            AddToolActionButton("×", "关闭", endgamePanel, new Vector2(960f, 560f), new Vector2(104f, 34f), CloseEndgamePanel, true);
            endgameBody = AddText("Endgame Body", endgamePanel, Vector2.zero, Vector2.one, new Vector2(54f, 154f), new Vector2(-540f, -154f), "", 18, TextAnchor.UpperLeft, FontStyle.Normal);
            endgameBody.gameObject.SetActive(false);
            AddText("Endgame Events Label", endgamePanel, Vector2.zero, Vector2.one, new Vector2(562f, 482f), new Vector2(-54f, -124f), "终局事件", 20, TextAnchor.UpperLeft, FontStyle.Bold);
            endgameEventsText = AddText("Endgame Events", endgamePanel, Vector2.zero, Vector2.one, new Vector2(562f, 152f), new Vector2(-54f, -168f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            endgameEventsText.gameObject.SetActive(false);
            endgameOutcomeCardRoot = AddPanel("Endgame Outcome Cards", endgamePanel, Vector2.zero, Vector2.one, new Vector2(48f, 128f), new Vector2(-548f, -126f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            endgameEventRailRoot = AddPanel("Endgame Event Recap Rail", endgamePanel, Vector2.zero, Vector2.one, new Vector2(562f, 434f), new Vector2(-54f, -146f), new Color(0.006f, 0.012f, 0.016f, 0.58f)).GetComponent<RectTransform>();
            endgameEventCardRoot = AddPanel("Endgame Event Cards", endgamePanel, Vector2.zero, Vector2.one, new Vector2(562f, 132f), new Vector2(-54f, -162f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
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
            tickerText.text = Ellipsize(LatestEvent(), 30);
            if (objectiveTitleText != null) objectiveTitleText.text = Ellipsize(string.IsNullOrWhiteSpace(vm.phaseObjectiveTitle) ? "阶段目标" : vm.phaseObjectiveTitle, 18);
            if (objectiveHintText != null) objectiveHintText.text = ClampTextBlock(string.IsNullOrWhiteSpace(vm.phaseObjectiveHint) ? "等待阶段更新。" : vm.phaseObjectiveHint, 2, 38);
            UpdateFlowGuideUi();
            dialogueTitle.text = string.IsNullOrWhiteSpace(vm.dialogueTitle) ? "对话舞台" : vm.dialogueTitle;
            dialogueBody.text = string.IsNullOrWhiteSpace(vm.dialogueText)
                ? "点击任意玩家查看详情；再使用私聊、公聊、提名、夜间行动或标记。"
                : ClampTextLines(new[] { vm.dialogueText }, 3, 60);
            if (actionSummaryText != null) actionSummaryText.text = BuildActionSummaryText();
            UpdateBottomDockActions();
            if (vm.scriptHandbook != null && vm.scriptHandbook.open)
            {
                infoDrawerTab = "handbook";
                eventPanelOpen = true;
            }
            if (infoDrawerTitle != null) infoDrawerTitle.text = InfoDrawerTitle();
            eventBody.text = BuildInfoDrawerMainText();
            queueBody.text = BuildInfoDrawerSubText();
            RenderInfoDrawerVisuals();
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
            else ApplyFocusChromeVisibility();
        }

        private void ApplyUiSmokeMode()
        {
            var mode = CommandLineValue("-botc-ui-smoke").Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(mode)) return;
            Debug.Log($"Unity UI smoke mode requested: {mode}");

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
            if (mode == "endgame" || mode == "game-over" || mode == "gameover")
            {
                endgameDismissed = false;
                dismissedEndgameGameId = "";
                RenderEndgamePanel();
                ApplyModalBackdropVisibility();
                return;
            }
            if (endgamePanel != null)
            {
                endgameDismissed = true;
                dismissedEndgameGameId = CurrentEndgameKey();
                endgamePanel.gameObject.SetActive(false);
            }
            selectedPlayerId = FirstNonEmpty(vm?.action?.selectedPlayerId, FirstSmokeTargetId());

            if (mode == "main" || mode == "main-board" || mode == "board" || mode == "grimoire-reminders")
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
            else if (mode == "recap" || mode == "ai-recap")
            {
                ShowInfoDrawer("recap");
            }
            else if (mode == "recap-suspect2" || mode == "ai-recap-suspect2")
            {
                ShowInfoDrawer("recap");
                CycleReasoningRecap(1);
            }
            else if (mode == "recap-trail-page2" || mode == "ai-recap-trail-page2")
            {
                ShowInfoDrawer("recap");
                ChangeReasoningScoreTrailPage(1);
            }
            else if (mode == "recap-trail-jump" || mode == "ai-recap-trail-jump")
            {
                ShowInfoDrawer("recap");
                var point = vm?.aiReasoningRecap?.FirstOrDefault((entry) => entry != null)?.scoreTrail?.FirstOrDefault((entry) => entry != null);
                JumpToReasoningScoreTrailTimeline(point);
            }
            else if (mode == "private" || mode == "private-chat" || mode == "private-chat-long")
            {
                OpenPrivateChatPanel();
            }
            else if (
                mode == "action" ||
                mode == "action-form" ||
                mode == "action-form-ready" ||
                mode == "action-form-guesses" ||
                mode == "fortune-teller-action-form" ||
                mode == "fortune-teller-action-form-ready")
            {
                OpenActionFormPanel(FirstAvailableActionFormId());
                if (mode == "action-form-ready" || mode == "fortune-teller-action-form-ready") PrimeActionFormSmokeInput();
            }
            else if (mode == "storyteller" || mode == "storyteller-queue")
            {
                OpenStorytellerPanel();
            }
            else if (mode == "storyteller-queue-page2" || mode == "storyteller-page2")
            {
                OpenStorytellerPanel();
                ChangeStorytellerQueuePage(1);
            }
            else if (mode == "help" || mode == "script-help")
            {
                OpenHandbookPanel("help");
            }
            else if (mode == "handbook" || mode == "script-handbook")
            {
                OpenHandbookPanel(vm?.scriptHandbook?.activeTab);
            }
            else if (mode == "vote" || mode == "vote-ceremony")
            {
                OpenVotePanel();
            }
            else if (mode == "role-picker" || mode == "role-picker-paged" || mode == "roles")
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
            else if (mode == "stage-dialogue-queued" || mode == "dialogue-queued")
            {
                ShowStageDialogueStill(
                    "说书人",
                    "公聊开始后，发言会按顺序一条一条播出。当前这条读完后，会继续播放后续队列。",
                    "公聊队列");
                QueueStageDialogue("3号", "我先报一个边界信息：昨晚没有拿到硬确认，但 6 号和 7 号的说法需要互相对照。", "公聊");
                QueueStageDialogue("说书人", "队列里的说书人提示也会在同一个底部对话框里顺序播放。", "说书人提示");
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
            Debug.Log($"Unity UI smoke screenshot requested: {outputPath}");

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
            if (endgameSubtitleText != null) endgameSubtitleText.text = $"结束于 D{vm.day}/N{vm.night} · {DisplayScriptName()}";
            var bodyLines = new List<string>
            {
                $"{OutcomeWinnerLabel()}胜利",
                string.IsNullOrWhiteSpace(reason) ? "胜负条件已经结算。" : reason,
                $"剧本：{DisplayScriptName()}",
                $"结束于 D{vm.day}/N{vm.night} · 存活 {vm.alive} · 死亡 {vm.dead}",
                "对局已结束。你可以查看复盘、继续检查魔典，或直接新开一局。"
            };
            if (endgameBody != null) endgameBody.text = ClampTextLines(bodyLines, 8, 44);
            RenderEndgameOutcomeCards(reason);

            var events = vm?.outcome?.finalEvents;
            if (events == null || events.Length == 0) events = vm?.events ?? Array.Empty<string>();
            var eventLines = events
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Select(PlayerFacingEventLine)
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .TakeLast(7)
                .Select((entry) => $"· {entry}");
            if (endgameEventsText != null) endgameEventsText.text = ClampTextLines(eventLines, 9, 46);
            RenderEndgameVerdictFocusStrip(events);
            RenderEndgameEventRail(events);
            RenderEndgameEventCards(events);
        }

        private void RenderEndgameVerdictFocusStrip(IEnumerable<string> events)
        {
            if (endgameVerdictFocusRoot == null) return;
            endgameVerdictFocusRoot.gameObject.SetActive(true);
            ClearChildren(endgameVerdictFocusRoot);
            AddFrame(endgameVerdictFocusRoot, "Endgame Verdict Focus Frame", 0.55f, new Color(0.96f, 0.68f, 0.30f, 0.18f));
            AddImage("Endgame Verdict Focus Accent", endgameVerdictFocusRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), EndgameWinnerAccent());

            var eventCount = (events ?? Array.Empty<string>())
                .Count((entry) => !string.IsNullOrWhiteSpace(entry));
            AddImage("Endgame Verdict Focus Connector A", endgameVerdictFocusRoot, Vector2.zero, Vector2.zero, new Vector2(100f, 20f), new Vector2(112f, 23f), new Color(1f, 0.70f, 0.28f, 0.30f));
            AddImage("Endgame Verdict Focus Connector B", endgameVerdictFocusRoot, Vector2.zero, Vector2.zero, new Vector2(206f, 20f), new Vector2(218f, 23f), new Color(1f, 0.70f, 0.28f, 0.30f));
            AddEndgameVerdictFocusChip(endgameVerdictFocusRoot, "Winner", new Vector2(10f, 7f), new Vector2(100f, 36f), "胜方", OutcomeWinnerLabel(), true, EndgameWinnerAccent());
            AddEndgameVerdictFocusChip(endgameVerdictFocusRoot, "Cycle", new Vector2(112f, 7f), new Vector2(206f, 36f), "周期", $"D{vm.day}/N{vm.night}", false, new Color(0.20f, 0.46f, 0.54f, 0.88f));
            AddEndgameVerdictFocusChip(endgameVerdictFocusRoot, "Review", new Vector2(218f, 7f), new Vector2(312f, 36f), "复盘", $"{Mathf.Max(eventCount, 1)}条", false, new Color(0.74f, 0.42f, 0.18f, 0.88f));
        }

        private void AddEndgameVerdictFocusChip(Transform parent, string key, Vector2 bottomLeft, Vector2 topRight, string label, string value, bool active, Color accent)
        {
            var chip = AddPanel($"Endgame Verdict Focus Chip {key}", parent, Vector2.zero, Vector2.zero, bottomLeft, topRight, active ? new Color(accent.r, accent.g, accent.b, 0.24f) : new Color(0.010f, 0.016f, 0.022f, 0.62f));
            AddFrame(chip.transform, "Endgame Verdict Focus Chip Frame", 0.5f, active ? new Color(accent.r, accent.g, accent.b, 0.44f) : new Color(0.96f, 0.68f, 0.30f, 0.14f));
            AddImage("Endgame Verdict Focus Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), active ? accent : new Color(accent.r, accent.g, accent.b, 0.42f));
            AddText("Endgame Verdict Focus Chip Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(9f, 17f), new Vector2(-8f, -2f), label, 8, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, active ? 0.94f : 0.70f);
            AddText("Endgame Verdict Focus Chip Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(9f, 3f), new Vector2(-8f, -13f), Ellipsize(value, 9), 11, TextAnchor.UpperLeft, FontStyle.Bold).color = active
                ? new Color(1f, 0.94f, 0.74f, 0.98f)
                : new Color(0.96f, 0.88f, 0.70f, 0.82f);
        }

        private void RenderEndgameOutcomeCards(string reason)
        {
            if (endgameOutcomeCardRoot == null) return;
            ClearChildren(endgameOutcomeCardRoot);
            var winner = OutcomeWinnerLabel();
            var hero = AddPanel("Endgame Result Hero", endgameOutcomeCardRoot, Vector2.zero, Vector2.zero, new Vector2(0f, 222f), new Vector2(444f, 364f), new Color(0.10f, 0.048f, 0.020f, 0.88f));
            AddFrame(hero.transform, "Endgame Result Hero Frame", 0.9f, new Color(0.96f, 0.68f, 0.30f, 0.36f));
            AddImage("Endgame Result Hero Accent", hero.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(6f, 0f), EndgameWinnerAccent());
            var sigil = AddImage("Endgame Result Sigil", hero.transform, Vector2.zero, Vector2.zero, new Vector2(18f, 46f), new Vector2(90f, 118f), EndgameWinnerAccent());
            sigil.sprite = GetCircleFillSprite();
            sigil.preserveAspect = true;
            AddText("Endgame Result Sigil Text", sigil.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, EndgameWinnerShort(), 24, TextAnchor.MiddleCenter, FontStyle.Bold).color = Color.white;
            AddText("Endgame Winner Label", hero.transform, Vector2.zero, Vector2.one, new Vector2(108f, 98f), new Vector2(-18f, -14f), $"{winner}胜利", 28, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.86f, 0.48f, 1f);
            AddText("Endgame Winner Reason", hero.transform, Vector2.zero, Vector2.one, new Vector2(108f, 44f), new Vector2(-18f, -62f), ClampTextBlock(string.IsNullOrWhiteSpace(reason) ? "胜负条件已经结算。" : reason, 2, 34), 14, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.92f);
            AddText("Endgame Winner Meta", hero.transform, Vector2.zero, Vector2.one, new Vector2(108f, 16f), new Vector2(-18f, -110f), "查看复盘可以继续核对 AI 证据链。", 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.72f, 0.88f, 0.82f, 0.86f);

            AddEndgameStatCard(endgameOutcomeCardRoot, 0, "剧本", Ellipsize(DisplayScriptName(), 10), $"{vm.setup}", new Color(0.14f, 0.075f, 0.032f, 0.88f));
            AddEndgameStatCard(endgameOutcomeCardRoot, 1, "周期", $"D{vm.day}/N{vm.night}", "终局节点", new Color(0.055f, 0.11f, 0.12f, 0.88f));
            AddEndgameStatCard(endgameOutcomeCardRoot, 2, "人数", $"存活 {vm.alive}", $"死亡 {vm.dead}", new Color(0.12f, 0.070f, 0.080f, 0.88f));

            var next = AddPanel("Endgame Next Steps", endgameOutcomeCardRoot, Vector2.zero, Vector2.zero, new Vector2(0f, 16f), new Vector2(444f, 128f), new Color(0.020f, 0.028f, 0.036f, 0.48f));
            AddFrame(next.transform, "Endgame Next Steps Frame", 0.8f, new Color(0.94f, 0.64f, 0.28f, 0.24f));
            AddImage("Endgame Next Steps Accent", next.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.44f));
            AddText("Endgame Next Title", next.transform, Vector2.zero, Vector2.one, new Vector2(18f, 76f), new Vector2(-18f, -8f), "下一步", 17, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("Endgame Next Body", next.transform, Vector2.zero, Vector2.one, new Vector2(18f, 20f), new Vector2(-18f, -38f), "先看复盘核对嫌疑链；需要回看魔典就继续查看；准备重开时再点新局。", 13, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.88f);
        }

        private void AddEndgameStatCard(Transform parent, int index, string label, string value, string meta, Color accent)
        {
            const float width = 136f;
            const float gap = 18f;
            var x = index * (width + gap);
            var card = AddPanel($"Endgame Stat {label}", parent, Vector2.zero, Vector2.zero, new Vector2(x, 144f), new Vector2(x + width, 210f), new Color(0.008f, 0.014f, 0.020f, 0.76f));
            AddFrame(card.transform, "Endgame Stat Frame", 0.7f, new Color(0.96f, 0.68f, 0.30f, 0.24f));
            AddImage("Endgame Stat Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), accent);
            AddText("Endgame Stat Label", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 42f), new Vector2(-10f, -6f), label, 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.90f);
            AddText("Endgame Stat Value", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 20f), new Vector2(-10f, -24f), Ellipsize(value, 10), 16, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.94f, 0.78f, 0.98f);
            AddText("Endgame Stat Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 6f), new Vector2(-10f, -46f), Ellipsize(meta, 13), 10, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.86f, 0.66f, 0.72f);
        }

        private void RenderEndgameEventCards(IEnumerable<string> events)
        {
            if (endgameEventCardRoot == null) return;
            ClearChildren(endgameEventCardRoot);
            var lines = (events ?? Array.Empty<string>())
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Select((entry) => entry.Trim())
                .TakeLast(5)
                .Reverse()
                .ToArray();
            if (lines.Length == 0)
            {
                AddEndgameEventRow(endgameEventCardRoot, 252f, "终", "暂无终局事件", "结算已完成，但没有更多事件记录。", new Color(0.10f, 0.070f, 0.045f, 0.88f));
                return;
            }
            for (var i = 0; i < lines.Length; i++)
            {
                AddEndgameEventRow(endgameEventCardRoot, 252f - i * 56f, i == 0 ? "终" : $"{i + 1}", i == 0 ? "最终记录" : "回看记录", lines[i], i == 0 ? EndgameWinnerAccent() : new Color(0.14f, 0.075f, 0.032f, 0.88f));
            }
        }

        private void RenderEndgameEventRail(IEnumerable<string> events)
        {
            if (endgameEventRailRoot == null) return;
            ClearChildren(endgameEventRailRoot);
            var lines = (events ?? Array.Empty<string>())
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Take(8)
                .ToArray();
            AddFrame(endgameEventRailRoot, "Endgame Event Recap Rail Frame", 0.6f, new Color(0.72f, 0.86f, 0.92f, 0.15f));
            AddImage("Endgame Event Recap Accent", endgameEventRailRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), EndgameWinnerAccent());
            AddText("Endgame Event Recap Label", endgameEventRailRoot, Vector2.zero, Vector2.one, new Vector2(14f, 23f), new Vector2(-278f, -4f), "复盘轨", 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddText("Endgame Event Recap Count", endgameEventRailRoot, Vector2.zero, Vector2.one, new Vector2(274f, 23f), new Vector2(-14f, -4f), $"{Mathf.Max(lines.Length, 1)} 条", 11, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.76f, 0.90f, 0.94f, 0.80f);

            const float trackLeft = 28f;
            const float trackRight = 396f;
            const float trackY = 10f;
            AddImage("Endgame Event Recap Track", endgameEventRailRoot, Vector2.zero, Vector2.zero, new Vector2(trackLeft, trackY), new Vector2(trackRight, trackY + 3f), new Color(0.46f, 0.50f, 0.56f, 0.26f));
            AddImage("Endgame Event Recap Fill", endgameEventRailRoot, Vector2.zero, Vector2.zero, new Vector2(trackLeft, trackY), new Vector2(trackRight, trackY + 3f), new Color(1f, 0.70f, 0.28f, 0.56f));
            AddEndgameEventRailNode(endgameEventRailRoot, "Result", trackLeft, "终", true);
            AddEndgameEventRailNode(endgameEventRailRoot, "Review", (trackLeft + trackRight) * 0.5f, "证", false);
            AddEndgameEventRailNode(endgameEventRailRoot, "Replay", trackRight, "局", false);
            AddText("Endgame Event Recap Hint", endgameEventRailRoot, Vector2.zero, Vector2.one, new Vector2(72f, 6f), new Vector2(-72f, -24f), EndgameEventRailHint(lines), 10, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.96f, 0.90f, 0.78f, 0.78f);
        }

        private void AddEndgameEventRailNode(Transform parent, string key, float x, string label, bool active)
        {
            var node = AddCircleImage($"Endgame Event Recap Node {key}", parent, active ? 9f : 7f, active ? EndgameWinnerAccent() : new Color(0.38f, 0.44f, 0.50f, 0.62f), false);
            node.rectTransform.anchoredPosition = new Vector2(x, 11.5f);
            AddText("Endgame Event Recap Node Label", node.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, label, 8, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.92f, 0.72f, 0.98f);
            if (!active) return;
            var ring = AddCircleImage($"Endgame Event Recap Active Ring {key}", parent, 12f, new Color(1f, 0.82f, 0.44f, 0.46f), true);
            ring.rectTransform.anchoredPosition = node.rectTransform.anchoredPosition;
        }

        private static string EndgameEventRailHint(string[] lines)
        {
            if (lines == null || lines.Length == 0) return "查看复盘核对证据链";
            return lines.Length > 1 ? "终局记录已锁定，可继续查证" : "终局记录可进入复盘";
        }

        private void AddEndgameEventRow(Transform parent, float y, string badge, string title, string body, Color accent)
        {
            var card = AddPanel($"Endgame Event {title}", parent, Vector2.zero, Vector2.zero, new Vector2(0f, y), new Vector2(424f, y + 48f), new Color(0.010f, 0.016f, 0.022f, 0.72f));
            AddFrame(card.transform, "Endgame Event Frame", 0.7f, new Color(0.96f, 0.68f, 0.30f, 0.22f));
            AddImage("Endgame Event Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), accent);
            var badgeImage = AddImage("Endgame Event Badge", card.transform, Vector2.zero, Vector2.zero, new Vector2(16f, 11f), new Vector2(48f, 37f), accent);
            AddFrame(badgeImage.transform, "Endgame Event Badge Frame", 0.6f, new Color(1f, 0.82f, 0.44f, 0.24f));
            AddText("Endgame Event Badge Text", badgeImage.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, badge, 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.92f, 0.72f, 0.98f);
            AddText("Endgame Event Title", card.transform, Vector2.zero, Vector2.one, new Vector2(62f, 27f), new Vector2(-12f, -6f), title, 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.94f);
            AddText("Endgame Event Body", card.transform, Vector2.zero, Vector2.one, new Vector2(62f, 6f), new Vector2(-12f, -24f), Ellipsize(body, 42), 11, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.86f);
        }

        private Color EndgameWinnerAccent()
        {
            var winner = (vm?.winner ?? vm?.outcome?.winner ?? "").Trim().ToLowerInvariant();
            if (winner == "good") return new Color(0.10f, 0.36f, 0.42f, 0.92f);
            if (winner == "evil") return new Color(0.54f, 0.055f, 0.070f, 0.92f);
            return new Color(0.72f, 0.44f, 0.16f, 0.92f);
        }

        private string EndgameWinnerShort()
        {
            var winner = (vm?.winner ?? vm?.outcome?.winner ?? "").Trim().ToLowerInvariant();
            if (winner == "good") return "善";
            if (winner == "evil") return "恶";
            return "终";
        }

        private void CloseEndgamePanel()
        {
            endgameDismissed = true;
            dismissedEndgameGameId = CurrentEndgameKey();
            if (endgamePanel != null) endgamePanel.gameObject.SetActive(false);
            ApplyModalBackdropVisibility();
            ApplyBottomDockVisibility();
            ApplyFocusChromeVisibility();
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
                    dialogueBody.text = "先在私聊面板右侧选择目标，或直接点击魔典中的其他玩家。";
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
                if (!SendUnityAction("private-chat", selectedPlayerId, "", "你是什么身份？", "claim")) return;
                dialogueBody.text = string.IsNullOrWhiteSpace(vm.privateDeceptionText)
                    ? "已发送私聊：询问选中玩家的身份说法，等待回复刷新。"
                    : $"已发送私聊：询问选中玩家的身份说法。\n{vm.privateDeceptionText}";
                return;
            }
            if (mode == "public")
            {
                dialogueTitle.text = "公聊请求";
                if (!SendUnityAction("ai-public-step")) return;
                dialogueBody.text = "已请求 AI 按公聊时钟推进一段发言。后续可继续公聊，或开启提名窗口。";
                return;
            }
            if (mode == "nomination")
            {
                dialogueTitle.text = "提名窗口";
                if (vm.phase != "day" || vm.dayStage != "nomination")
                {
                    if (!SendUnityAction("open-nomination-window")) return;
                    dialogueBody.text = vm.dayStage == "private"
                        ? "已请求开启提名窗口；如果当前仍在私聊阶段，需要先进入公聊。"
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
                    ? "已打开夜间行动。当前没有可用夜间行动时，会显示原因。"
                    : vm.nightActionText;
                return;
            }
            if (mode == "day")
            {
                dialogueTitle.text = "白天行动请求";
                OpenActionFormPanel("day-action");
                dialogueBody.text = string.IsNullOrWhiteSpace(vm.dayActionText)
                    ? "已打开白天行动。若当前阶段不可用，会显示原因。"
                    : vm.dayActionText;
                return;
            }
            if (mode == "storyteller")
            {
                dialogueTitle.text = "Storyteller 行动";
                OpenStorytellerPanel();
                dialogueBody.text = string.IsNullOrWhiteSpace(vm.storytellerActionText)
                    ? "已打开 Storyteller 队列面板。当前没有队列时，会显示原因。"
                    : vm.storytellerActionText;
                return;
            }
            if (mode == "grimoire")
            {
                dialogueTitle.text = "魔典视角";
                if (!SendUnityAction("toggle-grimoire")) return;
                dialogueBody.text = "已切换全知魔典视角。注意：非全知且非恶魔时，恶魔伪装会保持隐藏。";
                return;
            }
            if (mode == "help")
            {
                dialogueTitle.text = "教程/帮助";
                if (!SendUnityAction("script-handbook", mode: "open", tab: "help")) return;
                OpenHandbookPanel("help");
                dialogueBody.text = "已打开教程/帮助。主界面只保留当前阶段、下一步和必须处理的事项。";
                return;
            }
            if (mode == "handbook")
            {
                dialogueTitle.text = "剧本手册";
                if (!SendUnityAction("script-handbook", mode: "open", tab: "roles")) return;
                OpenHandbookPanel("roles");
                dialogueBody.text = "已打开剧本手册。";
                return;
            }
            if (mode == "new-game")
            {
                dialogueTitle.text = "新局";
                ClearStageDialogueLifecycle(true);
                if (!SendUnityAction("new-game")) return;
                dialogueBody.text = "已请求创建新局，界面会刷新到干净开局。";
                return;
            }
            if (mode == "reminder")
            {
                dialogueTitle.text = "提醒物编辑";
                if (string.IsNullOrWhiteSpace(selectedPlayerId))
                {
                    dialogueBody.text = "请先点击一名玩家，再添加提醒物。";
                    return;
                }
                if (!SendUnityAction("grimoire-reminder", selectedPlayerId, "", "", "", "Guard", "")) return;
                dialogueBody.text = "已给选中玩家添加“守护”提醒物。下一步会改成正式提醒物选择器。";
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
                dialogueBody.text = $"已发送私聊：向选中玩家私下编造夜间信息。\n{vm.privateDeceptionText}";
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
                dialogueBody.text = $"已发送私聊：请求选中玩家暂时保密。\n{vm.privateDeceptionText}";
                return;
            }
            dialogueTitle.text = "对话时间线";
            dialogueBody.text = BuildTimelineText();
        }

        private void SelectPrimaryAction()
        {
            CloseMoreActionsPanel();
            if (TrySendDefaultNightAction()) return;
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
            var guard = vm?.phaseAdvance;
            var stageTitle = PhaseLabel();
            var objectiveTitle = string.IsNullOrWhiteSpace(vm?.phaseObjectiveTitle) ? "阶段目标" : vm.phaseObjectiveTitle;
            var objectiveHint = string.IsNullOrWhiteSpace(vm?.phaseObjectiveHint) ? "观察可用行动，再决定是否推进。" : vm.phaseObjectiveHint;
            var currentHint = FlowCurrentHint(objectiveTitle, objectiveHint);
            var next = FlowNextLabel();
            var nextHint = FlowNextHint(guard);
            var stateTitle = "畅通";
            var stateHint = FirstNonEmpty(guard?.hint, "没有阻塞。");
            var badgeText = "就绪";
            var badgeFill = new Color(0.030f, 0.085f, 0.060f, 0.76f);
            var badgeTextColor = new Color(0.78f, 1f, 0.72f, 0.98f);
            if (guard != null && guard.blocked)
            {
                stateTitle = "阻塞";
                stateHint = FirstNonEmpty(guard.reason, guard.hint, "当前阶段还有必要事项。");
                badgeText = "阻塞";
                badgeFill = new Color(0.16f, 0.070f, 0.025f, 0.86f);
                badgeTextColor = new Color(1f, 0.72f, 0.38f, 0.98f);
            }
            else if (guard != null && guard.requiresConfirm)
            {
                stateTitle = "确认";
                stateHint = FirstNonEmpty(guard.reason, guard.hint, "再次点击确认继续。");
                badgeText = "确认";
                badgeFill = new Color(0.13f, 0.090f, 0.028f, 0.84f);
                badgeTextColor = new Color(1f, 0.84f, 0.36f, 0.98f);
            }
            else if (guard?.warnings != null && guard.warnings.Length > 0)
            {
                stateTitle = "提示";
                stateHint = guard.warnings[0];
                badgeText = "可选";
                badgeFill = new Color(0.11f, 0.075f, 0.026f, 0.82f);
                badgeTextColor = new Color(1f, 0.82f, 0.42f, 0.98f);
            }

            if (flowStatusBadgeImage != null) flowStatusBadgeImage.color = badgeFill;
            if (flowStatusBadgeText != null)
            {
                flowStatusBadgeText.text = badgeText;
                flowStatusBadgeText.color = badgeTextColor;
            }
            if (flowCurrentTitleText != null) flowCurrentTitleText.text = Ellipsize(stageTitle, 10);
            if (flowCurrentHintText != null) flowCurrentHintText.text = ClampTextBlock(currentHint, 1, 22);
            if (flowStateTitleText != null) flowStateTitleText.text = Ellipsize(stateTitle, 10);
            if (flowStateHintText != null) flowStateHintText.text = ClampTextBlock(stateHint, 2, 22);
            if (flowNextTitleText != null) flowNextTitleText.text = Ellipsize(next, 10);
            if (flowNextHintText != null) flowNextHintText.text = ClampTextBlock(nextHint, 1, 22);
            if (nextPhaseButtonLabelText != null)
            {
                var label = NextPhaseButtonLabel();
                nextPhaseButtonLabelText.text = label;
                nextPhaseButtonLabelText.color = guard != null && guard.blocked
                    ? new Color(1f, 0.68f, 0.36f, 1f)
                    : suggestNextPhase ? new Color(1f, 0.84f, 0.36f, 1f) : new Color(0.98f, 0.91f, 0.78f, 1f);
            }
            SetButtonSuggested(nextPhaseButton, suggestNextPhase);
        }

        private static string FlowCurrentHint(string objectiveTitle, string objectiveHint)
        {
            var title = (objectiveTitle ?? "").Trim();
            var hint = (objectiveHint ?? "").Trim();
            if (string.IsNullOrWhiteSpace(title)) return FlowBriefLine(hint);
            if (title == "阶段目标") return FlowBriefLine(hint);
            return FlowBriefLine(title);
        }

        private string FlowNextHint(PhaseAdvanceViewModel guard)
        {
            if (guard != null && guard.blocked)
            {
                return FlowBriefLine(FirstNonEmpty(guard.hint, guard.reason, "先处理阻塞。"));
            }
            if (guard != null && guard.requiresConfirm)
            {
                return FlowBriefLine(FirstNonEmpty(guard.hint, guard.reason, "再次点击确认。"));
            }
            return FlowBriefLine(FirstNonEmpty(guard?.hint, "按主按钮继续。"));
        }

        private static string FlowBriefLine(string value)
        {
            var line = (value ?? "").Replace("\r", " ").Replace("\n", " ").Trim();
            if (line.EndsWith("。", StringComparison.Ordinal)) line = line.Substring(0, line.Length - 1);
            return line;
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
            if (guard != null && guard.blocked) return FlowBlockedButtonLabel(guard);
            if (guard != null && guard.requiresConfirm) return "确认推进";
            var stage = NextPhaseStageFromViewModel();
            if (stage == "public") return "开始公聊";
            if (stage == "nomination") return "进入提名";
            if (stage == "night") return "结束白天";
            if (stage == "day" || stage == "private") return "结算夜晚";
            return "下一阶段";
        }

        private static string FlowBlockedButtonLabel(PhaseAdvanceViewModel guard)
        {
            var text = $"{guard?.reason} {guard?.hint}";
            if (text.Contains("Storyteller")) return "处理队列";
            if (text.Contains("夜间行动") || text.Contains("下一夜")) return "夜间行动";
            if (text.Contains("白天行动")) return "白天行动";
            if (text.Contains("公聊")) return "推进公聊";
            if (text.Contains("提名")) return "打开提名";
            return "处理事项";
        }

        private string FlowNextLabel()
        {
            var guard = vm?.phaseAdvance;
            if (guard != null && guard.blocked)
            {
                return NextPhaseButtonLabel();
            }
            if (guard != null && guard.requiresConfirm)
            {
                return FirstNonEmpty(guard.label, NextPhaseButtonLabel());
            }
            return NextPhaseButtonLabel();
        }

        private string BuildFlowGuideText(bool compact = false)
        {
            var guard = vm?.phaseAdvance;
            var title = string.IsNullOrWhiteSpace(vm?.phaseObjectiveTitle) ? PhaseLabel() : vm.phaseObjectiveTitle;
            var hint = string.IsNullOrWhiteSpace(vm?.phaseObjectiveHint) ? "观察当前可用行动，再决定是否推进。" : vm.phaseObjectiveHint;
            var next = FlowNextLabel();
            var lines = new List<string>
            {
                $"阶段：{PhaseLabel()}",
                $"任务：{title}",
                compact ? Ellipsize(hint, 34) : hint,
                $"推荐：{next}"
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

        private bool TrySendDefaultNightAction()
        {
            if (vm?.phase != "night" || vm.humanNightAction == null || !vm.humanNightAction.available) return false;
            OpenActionFormPanel("night-action");
            return true;
        }

        private void RequestPhaseStage(string stage, string label)
        {
            if (HasPendingAction() && !PendingActionExpired())
            {
                ShowPendingActionBusyMessage("phase");
                return;
            }
            if (NormalizePhaseTransitionStage(stage) == "day" && TrySendDefaultNightAction()) return;
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
            ShowPhaseGuardMessage(label, "已提交阶段切换；成功后界面会自动刷新。");
            var normalizedStage = NormalizePhaseTransitionStage(stage);
            if (!SendUnityAction("phase", "", stage, "", "", "", "", "", "", false, needsConfirm ? "confirm" : "")) return;
            if (normalizedStage != "private")
            {
                HidePrivateStagePanelsForPhaseExit();
                publicSpeechStatus = "";
                BeginPhaseTransition(stage, true);
            }
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
            var events = PlayerFacingEventLines(vm.events);
            return events.Length == 0 ? "最近事件：等待玩家行动" : $"最近事件：{events[events.Length - 1]}";
        }

        private string BuildEventText()
        {
            var events = PlayerFacingEventLines(vm.events);
            if (events.Length == 0) return "暂无事件。";
            var start = Mathf.Max(0, events.Length - 9);
            var lines = new List<string> { "最近事件", "────────" };
            for (var i = start; i < events.Length; i++) lines.Add($"- {events[i]}");
            return string.Join("\n", lines);
        }

        private static string[] PlayerFacingEventLines(IEnumerable<string> events)
        {
            return (events ?? Array.Empty<string>())
                .Select(PlayerFacingEventLine)
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .ToArray();
        }

        private static string PlayerFacingEventLine(string entry)
        {
            var text = entry == null ? "" : entry.Trim();
            if (string.IsNullOrWhiteSpace(text)) return "";
            var lower = text.ToLowerInvariant();
            if (text.EndsWith("->", StringComparison.Ordinal))
            {
                var prefix = text.Substring(0, text.Length - 2).Trim();
                return string.IsNullOrWhiteSpace(prefix) ? "私聊事件已记录。" : $"{prefix}发起了私聊。";
            }
            if (text.Contains("->") && !text.Contains("：") && !text.Contains(":"))
            {
                return $"{PlayerFacingPrivatePair(text)}：私聊事件已记录。";
            }
            var separator = text.LastIndexOf('：');
            if (separator < 0) separator = text.LastIndexOf(':');
            if (lower.Contains("secret-response-") && separator > 0)
            {
                var prefix = text.Substring(0, separator).Trim();
                var pair = PlayerFacingPrivatePair(prefix);
                return string.IsNullOrWhiteSpace(pair) ? "私聊回应已记录。" : $"{pair}：私聊回应已记录。";
            }
            if (lower.Contains("secret-response-")) return "私聊回应已记录。";
            if (separator > 0 && text.Substring(0, separator).Contains("->"))
            {
                var prefix = text.Substring(0, separator).Trim();
                var body = text.Substring(separator + 1).Trim();
                var pair = PlayerFacingPrivatePair(prefix);
                if (string.IsNullOrWhiteSpace(body)) return string.IsNullOrWhiteSpace(pair) ? "私聊事件已记录。" : $"{pair}：私聊事件已记录。";
                return string.IsNullOrWhiteSpace(pair) ? body : $"{pair}：{body}";
            }
            return text;
        }

        private static string PlayerFacingPrivatePair(string prefix)
        {
            if (string.IsNullOrWhiteSpace(prefix)) return "";
            var parts = prefix.Split(new[] { "->" }, StringSplitOptions.None);
            if (parts.Length == 2)
            {
                var from = parts[0].Trim();
                var to = parts[1].Trim();
                if (!string.IsNullOrWhiteSpace(from) && !string.IsNullOrWhiteSpace(to)) return $"{from} 与 {to}";
            }
            return prefix.Trim();
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
                        ? $"同步：{label}仍在处理 {PendingActionElapsed():0.0}s"
                        : $"同步：{label}仍在处理（{PendingActionElapsed():0.0}s）。完成前会阻止新的流程动作，避免对话顺序错乱。";
                }
                return compact
                    ? $"同步：{label}处理中 {PendingActionElapsed():0.0}s"
                    : $"同步：已提交 {label}，等待界面刷新（{PendingActionElapsed():0.0}s）。";
            }

            if (bridgeLaunchProblem && !string.IsNullOrWhiteSpace(bridgeLaunchStatus)) return bridgeLaunchStatus;
            if (vm?.action == null)
            {
                return string.IsNullOrWhiteSpace(bridgeLaunchStatus) ? "同步：未连接规则服务" : bridgeLaunchStatus;
            }
            var status = string.IsNullOrWhiteSpace(vm.action.status) ? "idle" : vm.action.status;
            if (string.Equals(status, "error", StringComparison.OrdinalIgnoreCase))
            {
                var message = string.IsNullOrWhiteSpace(vm.action.message) ? "规则返回错误" : vm.action.message;
                return compact ? $"同步错误：{Ellipsize(message, 18)}" : $"同步错误：{message}";
            }
            if (string.Equals(status, "ready", StringComparison.OrdinalIgnoreCase))
            {
                return compact ? "同步：就绪" : "同步：已就绪，等待你的操作。";
            }
            var actionLabel = ActionTypeLabel(vm.action.lastActionType);
            return compact
                ? $"同步：{actionLabel}已刷新 r{vm.action.revision}"
                : $"同步：已处理 {actionLabel}，界面版本 r{vm.action.revision}。";
        }

        private static string ActionTypeLabel(string type)
        {
            if (type == "select-token") return "选中";
            if (type == "private-chat" || type == "private-preset") return "私聊";
            if (type == "public-discussion" || type == "public" || type == "ai-public-step" || type == "human-public-speech") return "公聊";
            if (type == "phase") return "阶段";
            if (type == "nomination" || type == "open-nomination-window" || type == "ai-nomination-step" || type == "human-nomination-intent") return "提名";
            if (type == "resolve-nomination-vote") return "投票结算";
            if (type == "accept-proactive-whisper" || type == "decline-proactive-whisper" || type == "ai-proactive-whispers") return "主动私聊";
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
                    .Where((line) => selected == null || (!line.Contains("尚未选中玩家") && !line.TrimStart().StartsWith("选中 ", StringComparison.Ordinal)))
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
            return lines.Count == 0 ? "行动状态：等待同步。" : ClampTextLines(lines, 4, 56);
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
                || StageDialogueOverlayOpen()
                || (storytellerPanel != null && storytellerPanel.gameObject.activeSelf)
                || (handbookPanel != null && handbookPanel.gameObject.activeSelf)
                || (votePanel != null && votePanel.gameObject.activeSelf)
                || (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf)
                || (reminderPickerPanel != null && reminderPickerPanel.gameObject.activeSelf)
                || (settingsPanel != null && settingsPanel.gameObject.activeSelf)
                || (mainMenuRoot != null && mainMenuRoot.gameObject.activeSelf);
        }

        private bool FocusOverlayChromeOpen()
        {
            return (phaseAssistPanel != null && phaseAssistPanel.gameObject.activeSelf)
                || (nominationDebatePanel != null && nominationDebatePanel.gameObject.activeSelf)
                || (privateChatPanel != null && privateChatPanel.gameObject.activeSelf)
                || (actionFormPanel != null && actionFormPanel.gameObject.activeSelf)
                || StageDialogueOverlayOpen()
                || (storytellerPanel != null && storytellerPanel.gameObject.activeSelf)
                || (handbookPanel != null && handbookPanel.gameObject.activeSelf)
                || (votePanel != null && votePanel.gameObject.activeSelf)
                || (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf)
                || (reminderPickerPanel != null && reminderPickerPanel.gameObject.activeSelf)
                || (settingsPanel != null && settingsPanel.gameObject.activeSelf)
                || (endgamePanel != null && endgamePanel.gameObject.activeSelf);
        }

        private void ApplyFocusChromeVisibility()
        {
            var mainMenuOpen = mainMenuRoot != null && mainMenuRoot.gameObject.activeSelf;
            var chromeVisible = gameplayEntered && !mainMenuOpen && !FocusOverlayChromeOpen();
            if (topHudRoot != null) topHudRoot.gameObject.SetActive(chromeVisible);
            if (phaseRailRoot != null) phaseRailRoot.gameObject.SetActive(chromeVisible);
            if (infoRailRoot != null) infoRailRoot.gameObject.SetActive(chromeVisible);
            ApplyGrimoireFocusVisibility();
        }

        private void ApplyGrimoireFocusVisibility()
        {
            if (grimoireRoot == null) return;
            var mainMenuOpen = mainMenuRoot != null && mainMenuRoot.gameObject.activeSelf;
            var voteOpen = votePanel != null && votePanel.gameObject.activeSelf;
            grimoireRoot.gameObject.SetActive(gameplayEntered && !mainMenuOpen && !voteOpen);
        }

        private bool StageDialogueOverlayOpen()
        {
            return stageDialoguePanel != null && stageDialoguePanel.gameObject.activeSelf;
        }

        private bool ProactiveWhisperBlockedByDialogue()
        {
            return StageDialogueOverlayOpen()
                || stageDialogueQueue.Count > 0
                || hasQueuedPhaseTransitionAfterDialogue;
        }

        private void HideProactiveWhisperForStageDialogue()
        {
            if (proactiveWhisperPanel != null) proactiveWhisperPanel.gameObject.SetActive(false);
        }

        private void ScheduleProactiveWhisperRenderAfterDialogue()
        {
            if (proactiveWhisperPanel == null) return;
            StartCoroutine(RenderProactiveWhisperAfterDialogueSettles());
        }

        private IEnumerator RenderProactiveWhisperAfterDialogueSettles()
        {
            for (var i = 0; i < 6; i++)
            {
                yield return null;
                if (!ProactiveWhisperBlockedByDialogue() && !GameplayOverlayOpen()) break;
            }
            RenderProactiveWhisperPanel();
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
            if (PrivateExitPhasePendingOrConfirming()) return;
            if (ProactiveWhisperBlockedByDialogue()) return;
            if (PendingProactiveOffers().Length > 0) return;
            var key = $"{vm.gameId}:{vm.day}:private";
            if (lastProactiveWhisperRequestKey == key) return;
            lastProactiveWhisperRequestKey = key;
            SendUnityAction("ai-proactive-whispers", trackPending: false);
        }

        private bool PrivateExitPhasePendingOrConfirming()
        {
            var confirmActive = !string.IsNullOrWhiteSpace(pendingPhaseConfirmStage)
                && NormalizePhaseTransitionStage(pendingPhaseConfirmStage) != "private"
                && Time.realtimeSinceStartup <= pendingPhaseConfirmUntil;
            var actionExitPending = HasPendingAction()
                && (pendingActionType == "phase" || pendingActionType == "public-discussion" || pendingActionType == "ai-public-step");
            return confirmActive || actionExitPending;
        }

        private void HidePrivateStagePanelsForPhaseExit()
        {
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            if (proactiveWhisperPanel != null) proactiveWhisperPanel.gameObject.SetActive(false);
            snoozedProactiveOfferId = "";
            ApplyModalBackdropVisibility();
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
                && !PrivateExitPhasePendingOrConfirming()
                && !ProactiveWhisperBlockedByDialogue()
                && !GameplayOverlayOpen();
            proactiveWhisperPanel.gameObject.SetActive(visible);
            if (!visible || offer == null) return;

            ApplyProactiveWhisperPanelResponsiveLayout();
            proactiveWhisperPanel.SetAsLastSibling();
            if (proactiveWhisperTokenImage != null)
            {
                proactiveWhisperTokenImage.sprite = SpriteFromResource("Botc/ui/vote1") ?? GetCircleFillSprite();
                proactiveWhisperTokenImage.preserveAspect = true;
            }
            var seat = offer.playerSeat > 0 ? $"{offer.playerSeat}号" : NameForPlayerId(offer.playerId);
            var offers = PendingProactiveOffers();
            var queueIndex = Mathf.Max(0, Array.IndexOf(offers, offer));
            if (proactiveWhisperSeatText != null) proactiveWhisperSeatText.text = string.IsNullOrWhiteSpace(seat) ? "来访" : seat;
            if (proactiveWhisperTitleText != null) proactiveWhisperTitleText.text = "有人想私聊你";
            if (proactiveWhisperBodyText != null)
            {
                var reason = string.IsNullOrWhiteSpace(offer.publicReason) ? "对方只说明想交换信息；接受后才展开具体内容。" : offer.publicReason;
                proactiveWhisperBodyText.text = ClampTextBlock(reason, 2, 32);
            }
            if (proactiveWhisperMetaText != null)
            {
                proactiveWhisperMetaText.text = $"{(offer.isNew ? "新邀请" : "待处理")} · 未接受前不显示私聊内容";
            }
            if (proactiveWhisperIntentText != null) proactiveWhisperIntentText.text = $"公开意图：{FirstNonEmpty(offer.publicIntent, "想交换信息")}";
            if (proactiveWhisperQueueText != null)
            {
                proactiveWhisperQueueText.text = offers.Length <= 1 ? "1 个待处理" : $"{queueIndex + 1}/{offers.Length} 待处理";
            }
            RenderProactiveWhisperQueuePips(offers.Length, queueIndex);
            RenderProactiveWhisperQueueList(offers, offer);
        }

        private void ApplyProactiveWhisperPanelResponsiveLayout()
        {
            if (proactiveWhisperPanel == null) return;
            var narrow = Screen.width <= 1200 || Screen.height <= 800;
            if (narrow)
            {
                proactiveWhisperPanel.offsetMin = new Vector2(-610f, 188f);
                proactiveWhisperPanel.offsetMax = new Vector2(-18f, 500f);
                proactiveWhisperPanel.localScale = new Vector3(0.84f, 0.84f, 1f);
            }
            else
            {
                proactiveWhisperPanel.offsetMin = new Vector2(-704f, 154f);
                proactiveWhisperPanel.offsetMax = new Vector2(-24f, 506f);
                proactiveWhisperPanel.localScale = Vector3.one;
            }
        }

        private void RenderProactiveWhisperQueueList(ProactiveWhisperViewModel[] offers, ProactiveWhisperViewModel activeOffer)
        {
            if (proactiveWhisperQueueListRoot == null) return;
            ClearChildren(proactiveWhisperQueueListRoot);
            AddFrame(proactiveWhisperQueueListRoot, "Proactive Whisper Queue List Frame", 0.65f, new Color(0.70f, 0.82f, 0.92f, 0.10f));
            offers = offers ?? Array.Empty<ProactiveWhisperViewModel>();
            if (offers.Length == 0)
            {
                AddText("Proactive Whisper Queue Empty", proactiveWhisperQueueListRoot, Vector2.zero, Vector2.one, new Vector2(16f, 78f), new Vector2(-16f, -22f), "暂无待处理私聊。", 14, TextAnchor.MiddleCenter, FontStyle.Normal).color = new Color(0.78f, 0.86f, 0.90f, 0.82f);
                return;
            }

            var rowHeight = Mathf.Clamp(128f / Mathf.Max(1, offers.Length), 34f, 56f);
            var top = 132f;
            for (var i = 0; i < offers.Length; i++)
            {
                var rowTop = top - i * rowHeight;
                var rowBottom = rowTop - rowHeight + 5f;
                AddProactiveWhisperQueueRow(proactiveWhisperQueueListRoot, offers[i], i, rowBottom, rowTop, activeOffer != null && offers[i]?.id == activeOffer.id);
            }
        }

        private void AddProactiveWhisperQueueRow(Transform parent, ProactiveWhisperViewModel offer, int index, float bottom, float top, bool active)
        {
            if (offer == null) return;
            var fill = active ? new Color(0.060f, 0.044f, 0.026f, 0.78f) : new Color(0.020f, 0.030f, 0.040f, 0.58f);
            var border = active ? new Color(1f, 0.72f, 0.30f, 0.28f) : new Color(0.70f, 0.82f, 0.92f, 0.10f);
            var row = AddPanel($"Proactive Whisper Queue Row {index + 1}", parent, Vector2.zero, Vector2.zero, new Vector2(12f, bottom), new Vector2(644f, top), fill);
            AddFrame(row.transform, "Proactive Whisper Queue Row Frame", 0.6f, border);
            AddImage("Proactive Whisper Queue Row Accent", row.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), active ? new Color(1f, 0.72f, 0.30f, 0.44f) : new Color(0.70f, 0.82f, 0.92f, 0.18f));

            AddText("Proactive Whisper Queue Row Seat", row.transform, Vector2.zero, Vector2.one, new Vector2(14f, 20f), new Vector2(-530f, -4f), SafeProactiveOfferLabel(offer), 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.86f, 0.54f, 0.98f);
            var statePill = AddPanel("Proactive Whisper Queue Row State", row.transform, Vector2.zero, Vector2.zero, new Vector2(102f, 19f), new Vector2(146f, 38f), offer.isNew ? new Color(0.18f, 0.11f, 0.030f, 0.82f) : new Color(0.034f, 0.052f, 0.066f, 0.70f));
            AddFrame(statePill.transform, "Proactive Whisper Queue Row State Frame", 0.45f, offer.isNew ? new Color(1f, 0.78f, 0.34f, 0.28f) : new Color(0.70f, 0.82f, 0.92f, 0.12f));
            AddText("Proactive Whisper Queue Row State Text", statePill.transform, Vector2.zero, Vector2.one, new Vector2(4f, 0f), new Vector2(-4f, 0f), offer.isNew ? "新" : "待", 10, TextAnchor.MiddleCenter, FontStyle.Bold).color = offer.isNew ? new Color(1f, 0.84f, 0.42f, 0.98f) : new Color(0.76f, 0.86f, 0.90f, 0.90f);
            AddText("Proactive Whisper Queue Row Intent", row.transform, Vector2.zero, Vector2.one, new Vector2(158f, 20f), new Vector2(-214f, -4f), FirstNonEmpty(offer.publicIntent, "想交换信息"), 13, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.92f, 0.96f, 0.96f, 0.94f);
            var reason = string.IsNullOrWhiteSpace(offer.publicReason) ? "未接受前不显示具体内容。" : offer.publicReason;
            AddText("Proactive Whisper Queue Row Reason", row.transform, Vector2.zero, Vector2.one, new Vector2(158f, 4f), new Vector2(-214f, -22f), Ellipsize(reason, 29), 10, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.76f, 0.84f, 0.88f, 0.76f);

            var accept = AddToolActionButton("✓", "接", row.transform, new Vector2(526f, 18f), new Vector2(54f, 26f), () => AcceptProactiveWhisperOffer(offer), true);
            var decline = AddToolActionButton("×", "拒", row.transform, new Vector2(590f, 18f), new Vector2(54f, 26f), () => DeclineProactiveWhisperOffer(offer), true);
            SetToolButtonEnabled(accept, !HasPendingAction());
            SetToolButtonEnabled(decline, !HasPendingAction());
            SetRaycastTargetsExceptButtons(row.transform);
        }

        private string SafeProactiveOfferLabel(ProactiveWhisperViewModel offer)
        {
            if (offer == null) return "来访者";
            if (offer.playerSeat > 0) return $"{offer.playerSeat}号玩家";
            var fallback = FirstNonEmpty(NameForPlayerId(offer.playerId), offer.playerName, "来访者");
            return Ellipsize(fallback, 8);
        }

        private void RenderProactiveWhisperQueuePips(int total, int activeIndex)
        {
            if (proactiveWhisperQueuePipsRoot == null) return;
            ClearChildren(proactiveWhisperQueuePipsRoot);
            var visibleCount = Mathf.Clamp(total <= 0 ? 1 : total, 1, 5);
            var span = visibleCount <= 1 ? 0f : 46f / (visibleCount - 1);
            for (var i = 0; i < visibleCount; i++)
            {
                var active = i == Mathf.Clamp(activeIndex, 0, visibleCount - 1);
                var color = active ? new Color(1f, 0.76f, 0.30f, 0.92f) : new Color(0.48f, 0.54f, 0.58f, 0.38f);
                var pip = AddCircleImage($"Proactive Queue Pip {i}", proactiveWhisperQueuePipsRoot, active ? 4.5f : 3.5f, color, false);
                pip.rectTransform.anchoredPosition = new Vector2(-23f + span * i, 0f);
                if (active)
                {
                    var ring = AddCircleImage($"Proactive Queue Active Ring {i}", proactiveWhisperQueuePipsRoot, 7f, new Color(1f, 0.88f, 0.54f, 0.44f), true);
                    ring.rectTransform.anchoredPosition = pip.rectTransform.anchoredPosition;
                }
            }
        }

        private static string ProactiveWhisperIntentLabel(string intent)
        {
            switch ((intent ?? "").Trim().ToLowerInvariant())
            {
                case "claim": return "想确认身份";
                case "compare": return "想比较视角";
                case "night": return "想对夜讯";
                case "plan": return "想同步策略";
                case "reason": return "想追问依据";
                case "suspect": return "想聊嫌疑";
                case "trust": return "想建立互信";
                case "vote": return "想讨论投票";
                default: return "想交换信息";
            }
        }

        private void AcceptProactiveWhisperOffer()
        {
            AcceptProactiveWhisperOffer(ActiveProactiveOffer());
        }

        private void AcceptProactiveWhisperOffer(ProactiveWhisperViewModel offer)
        {
            if (offer == null) return;
            snoozedProactiveOfferId = "";
            selectedPlayerId = offer.playerId ?? "";
            privateChatStatus = $"已接受 {NameForPlayerId(selectedPlayerId)} 的主动私聊；完整内容会写入私聊时间线。";
            if (!SendUnityAction("accept-proactive-whisper", playerId: selectedPlayerId, trackPending: true, offerId: offer.id ?? "")) return;
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
            DeclineProactiveWhisperOffer(ActiveProactiveOffer());
        }

        private void DeclineProactiveWhisperOffer(ProactiveWhisperViewModel offer)
        {
            if (offer == null) return;
            snoozedProactiveOfferId = offer.id ?? "";
            if (!SendUnityAction("decline-proactive-whisper", playerId: offer.playerId ?? "", trackPending: true, offerId: offer.id ?? "")) return;
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
            if (gameplayEntered && grimoireRoot != null) RenderGrimoire();
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
            var privateChatOpen = privateChatPanel != null && privateChatPanel.gameObject.activeSelf;
            var rolePickerOpen = rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf;
            var reminderPickerOpen = reminderPickerPanel != null && reminderPickerPanel.gameObject.activeSelf;
            var endgameOpen = endgamePanel != null && endgamePanel.gameObject.activeSelf;
            var actionFormOpen = actionFormPanel != null && actionFormPanel.gameObject.activeSelf;
            var storytellerOpen = storytellerPanel != null && storytellerPanel.gameObject.activeSelf;
            var handbookOpen = handbookPanel != null && handbookPanel.gameObject.activeSelf;
            var settingsOpen = settingsPanel != null && settingsPanel.gameObject.activeSelf && (mainMenuRoot == null || !mainMenuRoot.gameObject.activeSelf);
            var visible = privateChatOpen || rolePickerOpen || reminderPickerOpen || endgameOpen || actionFormOpen || storytellerOpen || handbookOpen || settingsOpen;
            modalBackdrop.gameObject.SetActive(visible);
            var backdropImage = modalBackdrop.GetComponent<Image>();
            if (backdropImage != null)
            {
                var privateChannelOnly = privateChatOpen && !rolePickerOpen && !reminderPickerOpen && !endgameOpen && !actionFormOpen && !storytellerOpen && !handbookOpen && !settingsOpen;
                backdropImage.color = privateChannelOnly
                    ? new Color(0.002f, 0.006f, 0.010f, 0.72f)
                    : new Color(0.002f, 0.006f, 0.010f, 0.46f);
            }
        }

        private void ApplyBottomDockVisibility()
        {
            var voteOpen = votePanel != null && votePanel.gameObject.activeSelf;
            var privateChatOpen = privateChatPanel != null && privateChatPanel.gameObject.activeSelf;
            var focusOverlayOpen = FocusOverlayChromeOpen();
            var dockVisible = bottomDockOpen && !voteOpen && !privateChatOpen && !focusOverlayOpen;
            if (bottomDock != null) bottomDock.gameObject.SetActive(dockVisible);
            if (bottomDockToggle != null) bottomDockToggle.gameObject.SetActive(!bottomDockOpen && !voteOpen && !privateChatOpen && !focusOverlayOpen);
            ApplyFocusChromeVisibility();
            ApplyBluffsVisibility();
            if (!dockVisible) CloseMoreActionsPanel();
            else ApplyMoreActionsVisibility();
        }

        private void UpdateBottomDockActions()
        {
            var forms = vm?.actionForms ?? Array.Empty<ActionFormViewModel>();
            var hasNightAction = vm?.phase == "night" || forms.Any((entry) => entry != null && entry.id == "night-action" && entry.available);
            var hasDayAction = forms.Any((entry) => entry != null && entry.id == "day-action" && entry.available);
            var hasStorytellerAction = forms.Any((entry) => entry != null && entry.id == "storyteller-action" && entry.available);
            var isDay = vm?.phase == "day";
            var isPrivateStage = isDay && vm?.dayStage == "private";
            var isPublicStage = isDay && vm?.dayStage == "public";
            var isNominationStage = isDay && (vm?.dayStage == "nomination" || vm?.nominationClock?.active == true || vm?.nominationDebate?.active == true);
            var hasVote = vm?.voteCeremony != null && !string.IsNullOrWhiteSpace(vm.voteCeremony.nomineeId);
            var canPrimaryAction = hasNightAction || hasDayAction || hasStorytellerAction;

            SetDockButtonVisible(dockPrivateButton, isPrivateStage);
            SetDockButtonVisible(dockPublicButton, isPrivateStage || isPublicStage);
            SetDockButtonVisible(dockNominationButton, isPublicStage || isNominationStage);
            SetDockButtonVisible(dockPrimaryActionButton, canPrimaryAction);
            SetDockButtonVisible(dockVoteButton, isNominationStage || hasVote);
            SetDockButtonVisible(dockMoreButton, true);

            SetButtonSuggested(dockPrivateButton, isPrivateStage);
            SetButtonSuggested(dockPublicButton, isPublicStage || (isPrivateStage && !HasPendingAction()));
            SetButtonSuggested(dockNominationButton, isPublicStage && vm?.nominationClock?.active == true);
            SetButtonSuggested(dockPrimaryActionButton, canPrimaryAction);
            SetButtonSuggested(dockVoteButton, isNominationStage || hasVote);
            SetButtonSuggested(dockMoreButton, false);
        }

        private static void SetDockButtonVisible(Button button, bool visible)
        {
            if (button != null) button.gameObject.SetActive(visible);
        }

        private void ApplyMoreActionsVisibility()
        {
            UpdateMoreActionsContext();
            if (moreActionsPanel != null) moreActionsPanel.gameObject.SetActive(bottomDockOpen && moreActionsOpen);
            ApplyBluffsVisibility();
        }

        private void UpdateMoreActionsContext()
        {
            if (moreActionsContextText == null && moreActionsSuggestionText == null && moreActionsSignalRoot == null && moreActionsRouteRoot == null && moreActionTiles.Count == 0) return;
            var selected = SelectedPlayer();
            var suggestedKeys = MoreActionSuggestedKeys(selected);
            UpdateMoreActionSuggestions(selected, suggestedKeys);
            RenderMoreActionsSignalStrip(selected, suggestedKeys);
            RenderMoreActionsRouteStrip(selected, suggestedKeys);
            if (selected == null)
            {
                if (moreActionsContextText != null) moreActionsContextText.text = "目标：未选中玩家";
                if (moreActionsSuggestionText != null) moreActionsSuggestionText.text = "建议：先点选玩家，再使用私聊 / 标记 / 提醒";
                return;
            }

            var targetLabel = MoreActionsTargetLabel(selected);
            var life = selected.alive ? "存活" : selected.ghostVoteAvailable ? "死亡 · 有鬼票" : "死亡";
            var role = MoreActionsRoleLabel(selected);
            if (moreActionsContextText != null)
            {
                moreActionsContextText.text = selected.human
                    ? $"目标：{targetLabel}（你） · {role}"
                    : $"目标：{targetLabel} · {life}";
            }
            if (moreActionsSuggestionText != null)
            {
                moreActionsSuggestionText.text = $"建议：{MoreActionsSuggestedTools(selected)} · {role}";
            }
        }

        private void RenderMoreActionsSignalStrip(PlayerViewModel selected, HashSet<string> suggestedKeys)
        {
            if (moreActionsSignalRoot == null) return;
            ClearChildren(moreActionsSignalRoot);
            var toolCount = suggestedKeys?.Count ?? 0;
            AddMoreActionsSignalChip("段", "阶段", MoreActionsSignalPhaseLabel(), 0f, 58f, new Color(0.035f, 0.048f, 0.060f, 0.74f), new Color(0.62f, 0.78f, 0.92f, 0.20f));
            AddMoreActionsSignalChip(selected?.human == true ? "你" : "标", "目标", MoreActionsSignalTargetLabel(selected), 64f, 74f, new Color(0.056f, 0.042f, 0.026f, 0.76f), new Color(0.96f, 0.68f, 0.30f, 0.25f));
            AddMoreActionsSignalChip("荐", "推荐", MoreActionsSignalToolsLabel(toolCount), 144f, 54f, new Color(0.045f, 0.070f, 0.052f, 0.74f), new Color(0.76f, 0.92f, 0.52f, 0.22f));
            AddMoreActionsSignalChip("视", "视角", MoreActionsSignalViewLabel(), 204f, 70f, new Color(0.040f, 0.052f, 0.070f, 0.74f), new Color(0.52f, 0.72f, 0.96f, 0.22f));
        }

        private void RenderMoreActionsRouteStrip(PlayerViewModel selected, HashSet<string> suggestedKeys)
        {
            if (moreActionsRouteRoot == null) return;
            ClearChildren(moreActionsRouteRoot);
            var toolCount = suggestedKeys?.Count ?? 0;
            var accent = MoreActionsRouteAccent(selected, toolCount);

            AddFrame(moreActionsRouteRoot, "More Actions Route Frame", 0.55f, new Color(accent.r, accent.g, accent.b, 0.18f));
            AddImage("More Actions Route Accent", moreActionsRouteRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(accent.r, accent.g, accent.b, 0.50f));
            AddImage("More Actions Route Connector A", moreActionsRouteRoot, Vector2.zero, Vector2.zero, new Vector2(47f, 13f), new Vector2(56f, 16f), new Color(accent.r, accent.g, accent.b, 0.34f));
            AddImage("More Actions Route Connector B", moreActionsRouteRoot, Vector2.zero, Vector2.zero, new Vector2(99f, 13f), new Vector2(108f, 16f), new Color(accent.r, accent.g, accent.b, 0.34f));

            AddMoreActionsRouteChip("目标", MoreActionsSignalTargetLabel(selected), new Vector2(7f, 3f), new Vector2(47f, 24f), selected != null, accent);
            AddMoreActionsRouteChip("推荐", MoreActionsSignalToolsLabel(toolCount), new Vector2(56f, 3f), new Vector2(99f, 24f), toolCount > 0, accent);
            AddMoreActionsRouteChip("下一", MoreActionsPrimarySuggestedLabel(suggestedKeys), new Vector2(108f, 3f), new Vector2(151f, 24f), toolCount > 0, accent);
            SetRaycastTargetsExceptButtons(moreActionsRouteRoot);
        }

        private void AddMoreActionsRouteChip(string label, string value, Vector2 bottomLeft, Vector2 topRight, bool active, Color accent)
        {
            if (moreActionsRouteRoot == null) return;
            var fill = active ? new Color(accent.r, accent.g, accent.b, 0.22f) : new Color(0.010f, 0.016f, 0.022f, 0.62f);
            var chip = AddPanel($"More Actions Route Chip {label}", moreActionsRouteRoot, Vector2.zero, Vector2.zero, bottomLeft, topRight, fill);
            AddFrame(chip.transform, "More Actions Route Chip Frame", 0.5f, active ? new Color(accent.r, accent.g, accent.b, 0.40f) : new Color(0.72f, 0.82f, 0.88f, 0.12f));
            AddText("More Actions Route Chip Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(6f, 11f), new Vector2(-4f, -2f), label, 7, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.72f, 0.80f, 0.84f, active ? 0.84f : 0.60f);
            AddText("More Actions Route Chip Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(6f, 1f), new Vector2(-4f, -11f), Ellipsize(value, 4), 9, TextAnchor.UpperLeft, FontStyle.Bold).color = active
                ? new Color(1f, 0.92f, 0.74f, 0.96f)
                : new Color(0.72f, 0.82f, 0.86f, 0.66f);
        }

        private Color MoreActionsRouteAccent(PlayerViewModel selected, int toolCount)
        {
            if (selected == null || toolCount <= 0) return new Color(0.50f, 0.64f, 0.74f, 0.72f);
            if (selected.human) return new Color(0.38f, 0.66f, 0.90f, 0.84f);
            if (!selected.alive) return new Color(0.88f, 0.28f, 0.18f, 0.82f);
            if (vm?.phase == "night") return new Color(0.38f, 0.58f, 0.90f, 0.84f);
            if (vm?.phase == "day" && vm?.dayStage == "nomination") return new Color(0.94f, 0.42f, 0.18f, 0.84f);
            return new Color(0.42f, 0.78f, 0.52f, 0.82f);
        }

        private static string MoreActionsPrimarySuggestedLabel(HashSet<string> suggestedKeys)
        {
            if (suggestedKeys == null || suggestedKeys.Count == 0) return "待选";
            var order = new[]
            {
                MoreActionTileKey(0, 0),
                MoreActionTileKey(2, 0),
                MoreActionTileKey(3, 1),
                MoreActionTileKey(0, 2),
                MoreActionTileKey(2, 2),
                MoreActionTileKey(1, 2),
                MoreActionTileKey(2, 3),
                MoreActionTileKey(0, 1),
                MoreActionTileKey(1, 1),
                MoreActionTileKey(2, 1),
                MoreActionTileKey(3, 2),
                MoreActionTileKey(3, 0),
                MoreActionTileKey(0, 3),
                MoreActionTileKey(1, 3),
                MoreActionTileKey(3, 3)
            };
            foreach (var key in order)
            {
                if (!suggestedKeys.Contains(key)) continue;
                if (key == MoreActionTileKey(0, 0)) return "询身";
                if (key == MoreActionTileKey(2, 0)) return "保密";
                if (key == MoreActionTileKey(3, 1)) return "提醒";
                if (key == MoreActionTileKey(0, 2)) return "标记";
                if (key == MoreActionTileKey(2, 2)) return "复盘";
                if (key == MoreActionTileKey(1, 2)) return "剧本";
                if (key == MoreActionTileKey(2, 3)) return "设置";
                if (key == MoreActionTileKey(0, 1)) return "夜间";
                if (key == MoreActionTileKey(1, 1)) return "白天";
                if (key == MoreActionTileKey(2, 1)) return "队列";
                if (key == MoreActionTileKey(3, 2)) return "全知";
                if (key == MoreActionTileKey(3, 0)) return "夜信";
                if (key == MoreActionTileKey(0, 3)) return "新局";
                if (key == MoreActionTileKey(1, 3)) return "菜单";
                if (key == MoreActionTileKey(3, 3)) return "关闭";
            }
            return "工具";
        }

        private void AddMoreActionsSignalChip(string icon, string label, string value, float x, float width, Color fill, Color border)
        {
            if (moreActionsSignalRoot == null) return;
            var chip = AddPanel($"More Actions Signal Chip {label}", moreActionsSignalRoot, Vector2.zero, Vector2.zero, new Vector2(x, 0f), new Vector2(x + width, 24f), fill);
            AddFrame(chip.transform, "More Actions Signal Chip Frame", 0.65f, border);
            var badge = AddImage("More Actions Signal Badge", chip.transform, Vector2.zero, Vector2.zero, new Vector2(5f, 5f), new Vector2(21f, 21f), new Color(0.008f, 0.012f, 0.016f, 0.78f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            AddText("More Actions Signal Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, icon.Length > 1 ? 7 : 9, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("More Actions Signal Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(26f, 12f), new Vector2(-4f, -3f), label, 7, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.70f, 0.78f, 0.82f, 0.76f);
            AddText("More Actions Signal Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(26f, 2f), new Vector2(-4f, -13f), Ellipsize(value, Mathf.Max(3, Mathf.FloorToInt(width / 13f))), 9, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            SetRaycastTargetsExceptButtons(chip.transform);
        }

        private string MoreActionsSignalPhaseLabel()
        {
            if (vm == null) return "--";
            if (vm.phase == "night") return $"N{vm.night}";
            if (vm.phase == "day") return vm.dayStage == "nomination" ? $"D{vm.day}提" : $"D{vm.day}聊";
            if (vm.phase == "ended") return "终局";
            return string.IsNullOrWhiteSpace(vm.phase) ? "--" : Ellipsize(vm.phase, 4);
        }

        private static string MoreActionsSignalTargetLabel(PlayerViewModel selected)
        {
            if (selected == null) return "未选";
            if (selected.human) return "你";
            if (!selected.alive) return selected.seat > 0 ? $"{selected.seat}亡" : "死亡";
            return selected.seat > 0 ? $"{selected.seat}号" : "目标";
        }

        private static string MoreActionsSignalToolsLabel(int count)
        {
            return count <= 0 ? "0项" : $"{count}项";
        }

        private string MoreActionsSignalViewLabel()
        {
            return vm?.grimoireView == true ? "全知" : "公开";
        }

        private static string MoreActionTileKey(int col, int row)
        {
            return $"{row}:{col}";
        }

        private void UpdateMoreActionSuggestions(PlayerViewModel selected, HashSet<string> suggestedKeys = null)
        {
            if (moreActionTiles.Count == 0) return;
            var suggested = suggestedKeys ?? MoreActionSuggestedKeys(selected);
            foreach (var entry in moreActionTiles)
            {
                SetMoreActionTileSuggested(entry.Value, suggested.Contains(entry.Key));
            }
        }

        private HashSet<string> MoreActionSuggestedKeys(PlayerViewModel player)
        {
            var keys = new HashSet<string>();
            if (player == null) return keys;

            if (player.human)
            {
                if (vm?.phase == "night")
                {
                    keys.Add(MoreActionTileKey(0, 1));
                    keys.Add(MoreActionTileKey(1, 2));
                    keys.Add(MoreActionTileKey(2, 3));
                }
                else
                {
                    keys.Add(MoreActionTileKey(1, 2));
                    keys.Add(MoreActionTileKey(2, 2));
                    keys.Add(MoreActionTileKey(2, 3));
                }
                return keys;
            }

            if (!player.alive)
            {
                keys.Add(MoreActionTileKey(2, 2));
                keys.Add(MoreActionTileKey(0, 2));
                keys.Add(MoreActionTileKey(3, 1));
                return keys;
            }

            if (vm?.phase == "day")
            {
                if (vm?.dayStage == "nomination")
                {
                    keys.Add(MoreActionTileKey(0, 2));
                    keys.Add(MoreActionTileKey(2, 2));
                    keys.Add(MoreActionTileKey(3, 1));
                }
                else
                {
                    keys.Add(MoreActionTileKey(0, 0));
                    keys.Add(MoreActionTileKey(2, 0));
                    keys.Add(MoreActionTileKey(3, 1));
                }
                return keys;
            }

            keys.Add(MoreActionTileKey(0, 2));
            keys.Add(MoreActionTileKey(3, 1));
            keys.Add(MoreActionTileKey(1, 2));
            return keys;
        }

        private static void SetMoreActionTileSuggested(MoreActionTileState state, bool suggested)
        {
            if (state == null) return;
            if (state.background != null)
            {
                state.background.color = suggested
                    ? new Color(0.086f, 0.052f, 0.024f, 0.94f)
                    : new Color(0.050f, 0.033f, 0.022f, 0.82f);
            }
            if (state.glow != null)
            {
                state.glow.color = suggested
                    ? new Color(1f, 0.70f, 0.28f, 0.130f)
                    : new Color(1f, 0.70f, 0.28f, 0.050f);
            }
            if (state.accent != null)
            {
                state.accent.color = suggested
                    ? new Color(1f, 0.70f, 0.24f, 0.72f)
                    : new Color(0.96f, 0.64f, 0.24f, 0.38f);
            }
            SetToolButtonFrameColor(
                state.button,
                "More Action Tile Frame",
                suggested ? new Color(1f, 0.76f, 0.34f, 0.70f) : new Color(0.94f, 0.68f, 0.34f, 0.34f));
            if (state.labelText != null)
            {
                state.labelText.color = suggested
                    ? new Color(1f, 0.96f, 0.78f, 1f)
                    : new Color(0.98f, 0.91f, 0.78f, 1f);
            }
            if (state.helperText != null)
            {
                state.helperText.color = suggested
                    ? new Color(0.86f, 0.94f, 0.92f, 0.92f)
                    : new Color(0.70f, 0.82f, 0.84f, 0.74f);
            }
            if (state.suggestedGlow != null) state.suggestedGlow.gameObject.SetActive(suggested);
            if (state.suggestedBadge != null) state.suggestedBadge.gameObject.SetActive(suggested);
            if (state.markerText != null) state.markerText.gameObject.SetActive(suggested);
        }

        private string MoreActionsRoleLabel(PlayerViewModel player)
        {
            if (player == null) return "未知";
            if (player.human) return FirstNonEmpty(player.roleName, "身份未知");
            if (!string.IsNullOrWhiteSpace(player.markedRoleName)) return $"标记 {player.markedRoleName}";
            if (player.revealed && !string.IsNullOrWhiteSpace(player.roleName)) return player.roleName;
            return "身份未知";
        }

        private static string MoreActionsTargetLabel(PlayerViewModel player)
        {
            if (player == null) return "未选中";
            var seat = player.seat > 0 ? $"{player.seat}号" : "";
            var name = player.name ?? "";
            if (string.IsNullOrWhiteSpace(seat)) return string.IsNullOrWhiteSpace(name) ? "未知玩家" : name;
            if (string.IsNullOrWhiteSpace(name) || string.Equals(name, seat, StringComparison.Ordinal) || name.StartsWith(seat, StringComparison.Ordinal)) return seat;
            return $"{seat} {name}";
        }

        private string MoreActionsSuggestedTools(PlayerViewModel player)
        {
            if (player == null) return "先选玩家";
            if (player.human)
            {
                return vm?.phase == "night" ? "夜间 / 剧本 / 设置" : "剧本 / 复盘 / 设置";
            }
            if (!player.alive)
            {
                return "复盘 / 标记 / 提醒";
            }
            if (vm?.phase == "day")
            {
                return vm?.dayStage == "nomination" ? "标记 / 复盘 / 提醒" : "询身 / 保密 / 提醒";
            }
            return "标记 / 提醒 / 剧本";
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
        public AiReasoningRecapViewModel[] aiReasoningRecap;
        public VoteCeremonyViewModel voteCeremony;
        public ExecutionCandidateViewModel executionCandidate;
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
                phaseObjectiveHint = "备用界面已载入；连接规则服务后会显示真实阶段目标。",
                phaseAdvance = new PhaseAdvanceViewModel
                {
                    blocked = true,
                    canAdvance = false,
                    requiresConfirm = false,
                    targetStage = "",
                    label = "阶段推进",
                    reason = "等待规则服务同步。",
                    hint = "连接成功后会显示真实推进状态。",
                    blockers = new[] { "等待规则服务同步。" },
                    warnings = Array.Empty<string>(),
                    confirmText = ""
                },
                actionSummary = "行动状态：尚未连接规则服务。",
                privateInfo = Array.Empty<string>(),
                nightActionText = "夜间行动：等待规则服务同步。",
                dayActionText = "白天行动：等待规则服务同步。",
                storytellerActionText = "Storyteller：等待规则服务同步。",
                nominationText = "提名与投票：等待规则服务同步。",
                privateDeceptionText = "私聊骗人接口：等待规则服务同步。",
                pendingProactiveWhispers = Array.Empty<ProactiveWhisperViewModel>(),
                aiSocialClues = Array.Empty<string>(),
                llmRenderer = new LlmRendererViewModel(),
                publicConversation = new PublicConversationViewModel(),
                nominationClock = new NominationClockViewModel(),
                nominationDebate = null,
                aiRecap = Array.Empty<string>(),
                aiRecapDetails = Array.Empty<AiRecapViewModel>(),
                aiReasoningRecap = Array.Empty<AiReasoningRecapViewModel>(),
                actionForms = Array.Empty<ActionFormViewModel>(),
                dialogueTitle = "对话舞台",
                dialogueText = "点击玩家查看玩家信息。",
                events = new[] { "已载入备用界面。", "如果看到这条信息，说明本地对局数据未找到。" },
                storytellerQueue = new[] { "当前尚未连接规则服务行动。" },
                storytellerQueueDetails = Array.Empty<StorytellerQueueItemViewModel>(),
                timeline = Array.Empty<TimelineEntryViewModel>(),
                players = Array.Empty<PlayerViewModel>()
            };
        }
    }

    [Serializable] public sealed class PhaseAdvanceViewModel { public bool blocked; public bool canAdvance; public bool requiresConfirm; public string targetStage; public string label; public string reason; public string hint; public string[] blockers; public string[] warnings; public string confirmText; }
    [Serializable] public sealed class ProactiveWhisperViewModel { public string id; public string playerId; public string playerName; public int playerSeat; public string publicIntent; public string publicReason; public bool isNew; }
    [Serializable] public sealed class PublicConversationStepViewModel { public int step; public string clock; public string speakerId; public string speakerName; public string targetId; public string targetName; public string stance; public string question; public string reason; public string followUp; public string nominationTendency; public string line; }
    [Serializable] public sealed class PublicConversationViewModel { public bool active; public string clock; public string label; public int step; public float pressure; public string speakerId; public string speakerName; public string focusId; public string focusName; public bool canContinue; public string[] suggestedActions; public PublicConversationStepViewModel lastStep; }
    [Serializable] public sealed class NominationClockViewModel { public bool active; public string status; public int ticksRemaining; public int totalTicks; public float progress; public string lastActorId; public string lastIntent; }
    [Serializable] public sealed class RationaleCardViewModel { public string id; public string kind; public string title; public string summary; public string detail; public string targetId; public string targetName; public string runnerUpId; public string runnerUpName; public string confidenceBand; public string evidenceMode; public string evidenceModeLine; public string evidenceInteractionLine; public string sourceReliabilityLine; public string timelineConsistencyLine; public string incentiveAlignmentLine; public string burdenOfProofLine; public string questionPriorityLine; public string actionThresholdLine; public string memoryContinuityLine; public string expressionDisciplineLine; public string uncertaintyResolutionLine; public string evidenceFreshnessLine; public string falsificationCheckLine; public string causalChainLine; public string assumptionAuditLine; public string mechanicSensitivityLine; public string roleHypothesisLine; public string pressureStageLine; public string timingWindowLine; public string worldBranchLine; public string voteCoalitionLine; public string tableRiskLine; public string informationGainLine; public string tableReactionLine; public string counterEvidenceLine; public string evidenceBoundaryLine; public string responseCriteriaLine; public string runnerUpWatchLine; public string confidenceLine; public string verificationLine; public string responsePlanLine; public string reconsiderationLine; public string reasonKey; public string displayIntent; public float expectedSupport; public float threshold; public float margin; public bool likelyPasses; }
    [Serializable] public sealed class NominationDebateViewModel { public bool active; public string nominationId; public int day; public string nominatorId; public string nominatorName; public string nomineeId; public string nomineeName; public string reason; public string nextAction; public bool canHumanRespond; public string humanSpeakerRole; public string responsePrompt; public RationaleCardViewModel[] rationaleCards; public NominationDebateLineViewModel[] lines; }
    [Serializable] public sealed class NominationDebateLineViewModel { public string speakerId; public string speakerName; public string role; public string text; public bool pending; }
    [Serializable] public sealed class GameOutcomeViewModel { public bool gameOver; public string winner; public string winnerLabel; public string title; public string reason; public string summary; public int alive; public int dead; public string[] finalEvents; }
    [Serializable] public sealed class RoleActionViewModel { public bool available; public string reason; public string type; public string roleId; public string roleName; public string inputType; public string prompt; public int minTargetCount; public int maxTargetCount; public int targetCount; public int minGuessCount; public int maxGuessCount; public bool allowSelf; public bool allowDead; public ActionModeViewModel[] modes; public ActionOptionViewModel[] options; public ActionRoleOptionViewModel[] roleOptions; public string[] selectedTargetIds; public PublicActionInteractionViewModel interaction; }
    [Serializable] public sealed class ActionFormViewModel { public string id; public string title; public bool available; public string reason; public string type; public string roleId; public string roleName; public string inputType; public string prompt; public int minTargetCount; public int maxTargetCount; public int targetCount; public int minGuessCount; public int maxGuessCount; public ActionOptionViewModel[] options; public ActionRoleOptionViewModel[] roleOptions; public ActionModeViewModel[] modes; public string[] selectedTargetIds; public PublicActionInteractionViewModel interaction; }
    [Serializable] public sealed class StorytellerQueueItemViewModel { public string id; public string type; public string roleId; public string roleName; public string inputType; public string prompt; public string phaseLabel; public int createdDay; public int createdNight; public string createdPhase; public int minTargetCount; public int maxTargetCount; public int targetCount; public int optionCount; public bool current; }
    [Serializable] public sealed class ActionModeViewModel { public string id; public string label; }
    [Serializable] public sealed class ActionOptionViewModel { public string id; public string name; public int seat; public string roleId; public string roleName; public bool alive; public string team; public string category; }
    [Serializable] public sealed class ActionRoleOptionViewModel { public string id; public string name; public string category; public string team; }
    [Serializable] public sealed class VoteCeremonyViewModel { public int day; public string nominatorId; public string nominatorName; public string nomineeId; public string nomineeName; public int yesVotes; public int threshold; public bool passed; public string resultText; public VoteViewModel[] voters; }
    [Serializable] public sealed class ExecutionCandidateViewModel { public bool active; public int day; public string nomineeId; public string nomineeName; public int nomineeSeat; public string nominatorId; public string nominatorName; public int yesVotes; public int threshold; public int voteIndex; public string resultText; }
    [Serializable] public sealed class VoteRationaleViewModel { public string kind; public string audience; public bool publicOnly; public string voterId; public string voterName; public string nomineeId; public string nomineeName; public bool vote; public bool canVote; public float suspicion; public float threshold; public float margin; public float evidenceCount; public float memoryShift; public float strategyShift; public string reasonKey; public string confidenceBand; public string line; }
    [Serializable] public sealed class VoteViewModel { public string voterId; public string voterName; public int seat; public bool alive; public bool ghostVote; public bool vote; public bool abstain; public VoteRationaleViewModel voteRationale; }
    [Serializable] public sealed class AiRecapViewModel { public string id; public string name; public string targetId; public string target; public string score; public string reason; public AiRecapTargetViewModel[] targets; }
    [Serializable] public sealed class AiRecapTargetViewModel { public string id; public string name; public string score; public float scoreValue; public string reason; public AiTrailViewModel[] trail; }
    [Serializable] public sealed class AiTrailViewModel { public string reasonKey; public string evidenceKind; public float before; public float after; public float appliedDelta; public string reason; }
    [Serializable] public sealed class AiReasoningEvidenceViewModel { public string kind; public string text; public string source; public float focusEvidenceCount; public float runnerUpEvidenceCount; }
    [Serializable] public sealed class AiReasoningEvidenceRowViewModel { public string id; public string evidenceId; public string observationId; public string timelineEntryId; public int timelineIndex = -1; public string timelineText; public string reasonKey; public string kind; public string source; public string sourceId; public string sourceName; public string visibility; public float reliabilityScore; public float contaminationRisk; public bool canBeFalse; public float before; public float after; public float appliedDelta; public string text; public int day; public int night; public long timestamp; }
    [Serializable] public sealed class AiReasoningComparisonTraceViewModel { public string kind; public bool publicOnly; public string focusId; public string focusName; public float focusScore; public float focusEvidenceCount; public string focusReason; public string focusEvidenceSummary; public string runnerUpId; public string runnerUpName; public float runnerUpScore; public float runnerUpEvidenceCount; public string runnerUpReason; public string runnerUpEvidenceSummary; public float scoreGap; public string reasonKey; public string confidenceBand; public string summary; }
    [Serializable] public sealed class AiReasoningScorePointViewModel { public string timelineEntryId; public int timelineIndex; public string timelineText; public float timestamp; public string mode; public string summary; public float focusScore; public float runnerUpScore; public float scoreGap; public float focusEvidenceCount; public float runnerUpEvidenceCount; public string confidenceBand; public string reasonKey; public AiReasoningComparisonTraceViewModel comparisonTrace; public AiReasoningEvidenceRowViewModel[] evidenceRows; public CrossDayStanceViewModel crossDayStance; public ClaimDisclosureRationaleViewModel claimDisclosureRationale; public int day; public int night; }
    [Serializable] public sealed class AiReasoningRecapViewModel { public string id; public string speakerId; public string speakerName; public string targetId; public string targetName; public int count; public string latestMode; public string latestSummary; public string[] summaries; public AiReasoningEvidenceViewModel[] evidenceSnippets; public AiReasoningScorePointViewModel[] scoreTrail; public float latestScore; public float previousScore; public float scoreDelta; public string scoreTrend; public int day; public int night; }
    [Serializable] public sealed class ScriptHandbookViewModel { public bool open; public string activeTab; public string scriptId; public string scriptName; public ScriptRoleViewModel[] roles; public string[] firstNightOrder; public string[] otherNightOrder; }
    [Serializable] public sealed class ScriptRoleViewModel { public string id; public string name; public string category; public string team; public string ability; public string icon; public string firstNightReminder; public string otherNightReminder; public string[] reminders; public string[] remindersGlobal; public int firstNight; public int otherNight; }
    [Serializable] public sealed class LlmRendererViewModel { public bool enabled; public string provider; public string source; public string model; public int touched; public int fallback; public string reason; public string updatedAt; }
    [Serializable] public sealed class LlmRenderViewModel { public string source; public bool fallbackUsed; public string reason; public string deterministicDraft; public string finalText; }
    [Serializable] public sealed class PublicActionInteractionViewModel { public string title; public string subtitle; public string style; public string badge; public string[] targetLabels; public string helper; public string confirmText; public string skipText; }
    [Serializable] public sealed class ActionStatusViewModel { public int revision; public string lastActionId; public string lastActionType; public string status; public string message; public bool resolvedImmediately; public bool publicAction; public string speechId; public string updatedAt; public string selectedPlayerId; public string selectedPlayerName; public AutoAdvanceViewModel autoAdvance; public LlmRendererViewModel llmRenderer; }
    [Serializable] public sealed class AutoAdvanceViewModel { public string stoppedAt; public AutoAdvanceStepViewModel[] steps; public int stepCount; public bool gameOver; public string phase; public string dayStage; public int pendingStorytellerActions; }
    [Serializable] public sealed class AutoAdvanceStepViewModel { public string type; public bool ok; public string stage; public string message; }
    [Serializable] public sealed class ClaimDisclosureRationaleViewModel { public string kind; public string audience; public bool publicOnly; public string speakerId; public string speakerName; public string level; public string previousLevel; public string previousRoleId; public string previousRoleName; public string previousRangeLabel; public string roleId; public string roleName; public string rangeLabel; public string family; public string exposure; public string reasonKey; public int day; public float trustScore; public float selfHeat; public float pressure; public bool alreadyClaimed; public bool canRevealRole; public string channel; public string continuity; public string continuityLine; public string continuitySummary; public string line; public string spokenLine; }
    [Serializable] public sealed class CrossDayEvidenceAnchorViewModel { public string evidenceId; public string observationId; public string kind; public string source; public string sourceId; public string visibility; public int day; public int night; public long timestamp; public string text; }
    [Serializable] public sealed class CrossDayEventAnchorViewModel { public string eventId; public string timelineEntryId; public string mode; public string source; public string audience; public string speakerId; public string targetId; public string focusId; public string visibility; public int day; public int night; public long timestamp; public float focusScore; public string text; }
    [Serializable] public sealed class CrossDayScoreTrailAnchorViewModel { public string trailId; public string evidenceId; public string observationId; public string reasonKey; public string kind; public string source; public string sourceId; public string visibility; public int day; public int night; public long timestamp; public float before; public float after; public float appliedDelta; public string text; }
    [Serializable] public sealed class CrossDayStanceViewModel { public string kind; public string speakerId; public string targetId; public int previousDay; public int currentDay; public int dayGap; public string previousStance; public string currentStance; public string continuity; public float previousScore; public float currentScore; public string previousReasonSummary; public string currentReasonSummary; public float previousEvidenceCount; public float currentEvidenceCount; public float evidenceDelta; public string changeSummary; public string[] previousEvidenceSnippets; public string[] currentEvidenceSnippets; public CrossDayEvidenceAnchorViewModel[] previousEvidenceAnchors; public CrossDayEvidenceAnchorViewModel[] currentEvidenceAnchors; public CrossDayEventAnchorViewModel[] previousEventAnchors; public CrossDayEventAnchorViewModel[] currentEventAnchors; public CrossDayScoreTrailAnchorViewModel[] previousScoreTrailAnchors; public CrossDayScoreTrailAnchorViewModel[] currentScoreTrailAnchors; public string[] previousSources; public string[] currentSources; public string summary; }
    [Serializable] public sealed class TimelineEntryViewModel { public string id; public string mode; public string speakerId; public string targetId; public string focusId; public string intent; public string evidenceSummary; public string evidenceKind; public string abilityRoleId; public string abilityKind; public string questionToAsk; public string[] followUpPrompts; public string text; public LlmRenderViewModel llmRender; public string rationaleSummary; public RationaleCardViewModel[] rationaleCards; public ClaimDisclosureRationaleViewModel claimDisclosureRationale; public CrossDayStanceViewModel crossDayStance; public int day; public int night; }
    [Serializable] public sealed class PlayerViewModel { public string id; public int seat; public string name; public string roleId; public string roleName; public string actualRoleId; public string perceivedRoleId; public string markedRoleId; public string markedRoleName; public bool revealed; public bool alive; public bool human; public bool ghostVoteAvailable; public int suspicion; public string[] reminders; }
    [Serializable] public sealed class UnitySaveMeta { public string savedAt; public string scriptName; public string phase; public int day; public int night; public int alive; public int dead; }
}
