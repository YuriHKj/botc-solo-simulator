using System;
using System.Collections;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {

        private void BuildSettingsPanel()
        {
            settingsPanel = AddPanel("Settings Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-460f, -330f), new Vector2(460f, 330f), new Color(0.005f, 0.012f, 0.020f, 0.96f)).GetComponent<RectTransform>();
            AddFrame(settingsPanel, "Settings Frame", 1.2f, new Color(0.92f, 0.62f, 0.28f, 0.42f));
            AddImage("Settings Header Wash", settingsPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -82f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.080f));
            AddText("Settings Title", settingsPanel, Vector2.zero, Vector2.one, new Vector2(34f, 586f), new Vector2(-34f, -18f), "设置", 34, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Settings Subtitle", settingsPanel, Vector2.zero, Vector2.one, new Vector2(154f, 598f), new Vector2(-590f, -28f), "显示、音频、AI 与存档", 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.95f, 0.78f, 0.42f, 0.82f);
            AddSettingsSummaryCard("显示", new Vector2(396f, 602f), new Vector2(138f, 34f), out settingsDisplaySummaryText);
            AddSettingsSummaryCard("音量", new Vector2(548f, 602f), new Vector2(138f, 34f), out settingsAudioSummaryText);
            AddSettingsSummaryCard("AI", new Vector2(700f, 602f), new Vector2(138f, 34f), out settingsAiSummaryText);
            AddToolActionButton("×", "关闭", settingsPanel, new Vector2(846f, 604f), new Vector2(104f, 34f), CloseSettingsPanel, true);

            AddImage("Settings Body Wash", settingsPanel, Vector2.zero, Vector2.one, new Vector2(36f, 98f), new Vector2(-36f, -118f), new Color(0.012f, 0.018f, 0.024f, 0.22f));
            AddSettingsSectionLabel("显示", "窗口与分辨率", 534f);
            AddSettingsRow("分辨率", "立即切换窗口尺寸", 500f, out settingsResolutionText, () => ChangeResolutionPreset(-1), () => ChangeResolutionPreset(1));
            AddSettingsToggleRow("全屏", "窗口 / 全屏模式", 430f, out settingsFullscreenText, out settingsFullscreenSwitchTrack, out settingsFullscreenSwitchKnob, ToggleFullscreenSetting);
            AddSettingsSectionLabel("音频", "即时预览音量", 376f);
            AddSettingsMeterRow("主音量", "整体输出", 342f, out settingsMasterVolumeText, out settingsMasterVolumeFill, () => AdjustVolume("master", -0.05f), () => AdjustVolume("master", 0.05f));
            AddSettingsMeterRow("音乐音量", "BGM 与气氛", 272f, out settingsMusicVolumeText, out settingsMusicVolumeFill, () => AdjustVolume("music", -0.05f), () => AdjustVolume("music", 0.05f));
            AddSettingsMeterRow("界面音效", "按钮与提示", 202f, out settingsUiVolumeText, out settingsUiVolumeFill, () => AdjustVolume("ui", -0.05f), () => AdjustVolume("ui", 0.05f));
            AddSettingsSectionLabel("AI", "实验选项", 154f);
            AddSettingsToggleRow("发言润色", "保存后重启", 132f, out settingsLocalLlmRendererText, out settingsLocalLlmSwitchTrack, out settingsLocalLlmSwitchKnob, ToggleLocalLlmRendererSetting);
            AddSettingsSectionLabel("存档", "本地文件", 94f);

            AddButton("保存设置", settingsPanel, new Vector2(236f, 64f), new Vector2(160f, 38f), SaveLocalSettings);
            AddButton("保存当前局", settingsPanel, new Vector2(460f, 64f), new Vector2(160f, 38f), SaveCurrentGame);
            AddButton("读取存档", settingsPanel, new Vector2(684f, 64f), new Vector2(160f, 38f), LoadGameFromSave);
            settingsStatusText = AddText("Settings Status", settingsPanel, Vector2.zero, Vector2.one, new Vector2(42f, 28f), new Vector2(-42f, -594f), "", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
            settingsStatusText.color = new Color(0.86f, 0.90f, 0.92f, 0.92f);
            settingsPanel.gameObject.SetActive(false);
            RefreshSettingsPanelText();
        }


        private void AddSettingsSummaryCard(string label, Vector2 center, Vector2 size, out Text valueText)
        {
            var half = size * 0.5f;
            var card = AddPanel($"Settings Summary {label}", settingsPanel, Vector2.zero, Vector2.zero, center - half, center + half, new Color(0.010f, 0.018f, 0.026f, 0.58f));
            AddFrame(card.transform, "Settings Summary Frame", 0.7f, new Color(0.70f, 0.82f, 0.92f, 0.18f));
            AddImage("Settings Summary Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.34f));
            AddText("Settings Summary Label", card.transform, Vector2.zero, Vector2.one, new Vector2(10f, 15f), new Vector2(-82f, -2f), label, 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.92f);
            valueText = AddText("Settings Summary Value", card.transform, Vector2.zero, Vector2.one, new Vector2(46f, 4f), new Vector2(-8f, -4f), "", 12, TextAnchor.MiddleRight, FontStyle.Bold);
            valueText.color = new Color(0.92f, 0.97f, 1f, 0.94f);
        }


        private void AddSettingsSectionLabel(string label, string helper, float y)
        {
            var rail = AddPanel($"Settings Section Rail {label}", settingsPanel, Vector2.zero, Vector2.zero, new Vector2(54f, y - 15f), new Vector2(164f, y + 17f), new Color(0.055f, 0.037f, 0.024f, 0.64f));
            AddImage("Settings Section Accent", rail.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.52f));
            AddFrame(rail.transform, "Settings Section Frame", 0.7f, new Color(0.94f, 0.68f, 0.34f, 0.18f));
            AddText($"Settings Section {label}", rail.transform, Vector2.zero, Vector2.one, new Vector2(10f, 8f), new Vector2(-10f, -4f), label, 13, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.96f);
            AddText($"Settings Section Helper {label}", settingsPanel, Vector2.zero, Vector2.zero, new Vector2(178f, y - 8f), new Vector2(360f, y + 14f), helper, 11, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.70f, 0.82f, 0.84f, 0.72f);
            AddImage($"Settings Section Rule {label}", settingsPanel, Vector2.zero, Vector2.zero, new Vector2(370f, y + 2f), new Vector2(806f, y + 3f), new Color(0.94f, 0.68f, 0.34f, 0.16f));
        }


        private void AddSettingsRow(string label, string helper, float y, out Text valueText, UnityEngine.Events.UnityAction onPrev, UnityEngine.Events.UnityAction onNext)
        {
            AddSettingsRowChrome(label, helper, y);
            valueText = AddSettingsValueText(label, y);
            AddButton("‹", settingsPanel, new Vector2(306f, y), new Vector2(44f, 34f), onPrev);
            AddButton("›", settingsPanel, new Vector2(660f, y), new Vector2(44f, 34f), onNext);
        }


        private void AddSettingsMeterRow(string label, string helper, float y, out Text valueText, out Image fillImage, UnityEngine.Events.UnityAction onPrev, UnityEngine.Events.UnityAction onNext)
        {
            var well = AddSettingsRowChrome(label, helper, y);
            fillImage = AddImage($"Settings Meter Fill {label}", well, Vector2.zero, Vector2.one, new Vector2(4f, 5f), new Vector2(-4f, -5f), new Color(0.86f, 0.58f, 0.26f, 0.36f));
            AddImage($"Settings Meter Shine {label}", well, new Vector2(0f, 0.52f), Vector2.one, new Vector2(4f, -4f), new Vector2(-4f, -5f), new Color(1f, 0.88f, 0.52f, 0.055f));
            valueText = AddSettingsValueText(label, y);
            AddButton("‹", settingsPanel, new Vector2(306f, y), new Vector2(44f, 34f), onPrev);
            AddButton("›", settingsPanel, new Vector2(660f, y), new Vector2(44f, 34f), onNext);
        }


        private void AddSettingsToggleRow(string label, string helper, float y, out Text valueText, out Image trackImage, out Image knobImage, UnityEngine.Events.UnityAction onToggle)
        {
            var well = AddSettingsRowChrome(label, helper, y);
            trackImage = AddImage($"Settings Switch Track {label}", well, Vector2.zero, Vector2.one, new Vector2(5f, 6f), new Vector2(-5f, -6f), new Color(0.10f, 0.060f, 0.030f, 0.76f));
            AddFrame(trackImage.transform, "Settings Switch Frame", 0.5f, new Color(0.94f, 0.68f, 0.34f, 0.18f));
            knobImage = AddImage($"Settings Switch Knob {label}", well, Vector2.zero, Vector2.zero, new Vector2(12f, 7f), new Vector2(40f, 29f), new Color(0.94f, 0.82f, 0.60f, 0.96f));
            knobImage.sprite = GetCircleFillSprite();
            knobImage.preserveAspect = true;
            valueText = AddSettingsValueText(label, y);
            AddButton("切换", settingsPanel, new Vector2(660f, y), new Vector2(92f, 34f), onToggle);
        }


        private RectTransform AddSettingsRowChrome(string label, string helper, float y)
        {
            var row = AddPanel($"Settings Row {label}", settingsPanel, Vector2.zero, Vector2.zero, new Vector2(54f, y - 26f), new Vector2(806f, y + 26f), new Color(0.020f, 0.028f, 0.036f, 0.34f));
            AddImage("Settings Row Accent", row.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.28f));
            AddFrame(row.transform, "Settings Row Frame", 0.55f, new Color(0.86f, 0.58f, 0.26f, 0.12f));
            AddText($"Settings Label {label}", settingsPanel, Vector2.zero, Vector2.zero, new Vector2(76f, y + 2f), new Vector2(258f, y + 24f), label, 17, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText($"Settings Helper {label}", settingsPanel, Vector2.zero, Vector2.zero, new Vector2(76f, y - 18f), new Vector2(258f, y + 2f), helper, 11, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.70f, 0.82f, 0.84f, 0.72f);
            var well = AddPanel($"Settings Value Well {label}", settingsPanel, Vector2.zero, Vector2.zero, new Vector2(346f, y - 18f), new Vector2(594f, y + 18f), new Color(0.004f, 0.010f, 0.017f, 0.72f)).GetComponent<RectTransform>();
            AddFrame(well, "Settings Value Well Frame", 0.55f, new Color(0.70f, 0.82f, 0.92f, 0.10f));
            return well;
        }


        private Text AddSettingsValueText(string label, float y)
        {
            var text = AddText($"Settings Value {label}", settingsPanel, Vector2.zero, Vector2.zero, new Vector2(346f, y - 16f), new Vector2(594f, y + 16f), "", 18, TextAnchor.MiddleCenter, FontStyle.Bold);
            text.color = new Color(0.98f, 0.91f, 0.78f, 1f);
            return text;
        }


        private void BuildMainMenu()
        {
            mainMenuRoot = AddPanel("Main Menu Overlay", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0.005f, 0.010f, 0.014f, 0.42f)).GetComponent<RectTransform>();
            var menuBg = AddImage("Menu Background", mainMenuRoot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, Color.white);
            menuBg.sprite = SpriteFromResource("Botc/ui/menu_bg") ?? SpriteFromResource("Botc/ui/bg_night");
            menuBg.color = menuBg.sprite == null ? new Color(0.010f, 0.018f, 0.026f, 1f) : new Color(0.98f, 1f, 1f, 1f);
            menuBg.preserveAspect = false;
            menuBg.raycastTarget = false;
            AddImage("Menu Background Shade", mainMenuRoot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.24f));
            AddImage("Menu Background Bottom Vignette", mainMenuRoot, Vector2.zero, new Vector2(1f, 0.58f), Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.18f));
            AddImage("Menu Warm Halo", mainMenuRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-560f, -360f), new Vector2(560f, 360f), new Color(0.95f, 0.72f, 0.38f, 0.070f));
            var card = AddPanel("Main Menu Card", mainMenuRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-460f, -320f), new Vector2(460f, 330f), new Color(0.012f, 0.014f, 0.016f, 0.82f));
            AddFrame(card.transform, "Main Menu Card Frame", 2f, new Color(0.88f, 0.62f, 0.28f, 0.56f));
            AddImage("Menu Inner Glow", card.transform, Vector2.zero, Vector2.one, new Vector2(18f, 18f), new Vector2(-18f, -18f), new Color(0.78f, 0.54f, 0.24f, 0.055f));
            var title = AddText("Menu Title", card.transform, Vector2.zero, Vector2.one, new Vector2(34f, 520f), new Vector2(-34f, -34f), "BOTC SOLO", 58, TextAnchor.UpperLeft, FontStyle.Bold);
            title.color = new Color(1f, 0.86f, 0.58f, 1f);
            AddText("Menu Subtitle", card.transform, Vector2.zero, Vector2.one, new Vector2(38f, 474f), new Vector2(-430f, -114f), "血染钟楼单机模拟器 · Unity 原型", 18, TextAnchor.UpperLeft, FontStyle.Normal);
            AddMenuButton("新游戏 / 进入魔典", card.transform, new Vector2(220f, 390f), StartNewGameFromMenu);
            AddMenuButton("继续当前局", card.transform, new Vector2(220f, 326f), () => EnterGameplayFromMenu(true));
            AddMenuButton("读取最近存档", card.transform, new Vector2(220f, 262f), LoadGameFromSave);
            AddMenuButton("保存当前局", card.transform, new Vector2(220f, 198f), SaveCurrentGame);
            AddMenuButton("设置", card.transform, new Vector2(220f, 134f), OpenSettingsPanel);
            AddMenuButton("退出游戏", card.transform, new Vector2(220f, 70f), () => Application.Quit());
            var info = AddPanel("Menu Info Panel", card.transform, Vector2.zero, Vector2.zero, new Vector2(450f, 112f), new Vector2(870f, 454f), new Color(0.006f, 0.012f, 0.018f, 0.70f));
            AddFrame(info.transform, "Menu Info Frame", 1.2f, new Color(0.82f, 0.56f, 0.25f, 0.32f));
            AddImage("Menu Info Header Wash", info.transform, new Vector2(0f, 1f), Vector2.one, new Vector2(1f, -64f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.060f));
            var status = AddPanel("Menu Setup Status", info.transform, Vector2.zero, Vector2.one, new Vector2(284f, 292f), new Vector2(-22f, -18f), new Color(0.030f, 0.085f, 0.060f, 0.78f));
            AddFrame(status.transform, "Menu Setup Status Frame", 0.7f, new Color(0.60f, 0.95f, 0.58f, 0.22f));
            menuSetupStatusImage = status.GetComponent<Image>();
            menuSetupStatusText = AddText("Menu Setup Status Text", status.transform, Vector2.zero, Vector2.one, new Vector2(8f, 0f), new Vector2(-8f, 0f), "就绪", 12, TextAnchor.MiddleCenter, FontStyle.Bold);
            menuSetupStatusText.color = new Color(0.78f, 1f, 0.72f, 0.98f);
            AddPanel("Menu Script Row", info.transform, Vector2.zero, Vector2.one, new Vector2(16f, 216f), new Vector2(-16f, -80f), new Color(0.010f, 0.018f, 0.026f, 0.42f));
            AddPanel("Menu Count Row", info.transform, Vector2.zero, Vector2.one, new Vector2(16f, 166f), new Vector2(-16f, -130f), new Color(0.010f, 0.018f, 0.026f, 0.34f));
            AddPanel("Menu Role Row", info.transform, Vector2.zero, Vector2.one, new Vector2(16f, 116f), new Vector2(-16f, -180f), new Color(0.010f, 0.018f, 0.026f, 0.42f));
            AddText("Menu Info Title", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 292f), new Vector2(-22f, -12f), "新游戏初设", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Menu Script Label", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 232f), new Vector2(-302f, -66f), "剧本", 17, TextAnchor.MiddleLeft, FontStyle.Bold);
            menuSetupScriptText = AddText("Menu Script Value", info.transform, Vector2.zero, Vector2.one, new Vector2(86f, 232f), new Vector2(-124f, -66f), "", 18, TextAnchor.MiddleCenter, FontStyle.Normal);
            menuSetupScriptText.color = new Color(0.98f, 0.91f, 0.78f, 0.98f);
            AddButton("<", info.transform, new Vector2(320f, 276f), new Vector2(38f, 30f), () => CycleMenuScript(-1));
            AddButton(">", info.transform, new Vector2(368f, 276f), new Vector2(38f, 30f), () => CycleMenuScript(1));
            AddText("Menu Count Label", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 182f), new Vector2(-302f, -116f), "人数", 17, TextAnchor.MiddleLeft, FontStyle.Bold);
            menuSetupPlayerCountText = AddText("Menu Count Value", info.transform, Vector2.zero, Vector2.one, new Vector2(86f, 182f), new Vector2(-124f, -116f), "", 18, TextAnchor.MiddleCenter, FontStyle.Normal);
            menuSetupPlayerCountText.color = new Color(0.98f, 0.91f, 0.78f, 0.98f);
            AddButton("-", info.transform, new Vector2(320f, 226f), new Vector2(38f, 30f), () => AdjustMenuPlayerCount(-1));
            AddButton("+", info.transform, new Vector2(368f, 226f), new Vector2(38f, 30f), () => AdjustMenuPlayerCount(1));
            AddText("Menu Role Label", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 132f), new Vector2(-302f, -166f), "自选", 17, TextAnchor.MiddleLeft, FontStyle.Bold);
            menuSetupRoleText = AddText("Menu Role Value", info.transform, Vector2.zero, Vector2.one, new Vector2(86f, 132f), new Vector2(-124f, -166f), "", 18, TextAnchor.MiddleCenter, FontStyle.Normal);
            menuSetupRoleText.color = new Color(0.98f, 0.91f, 0.78f, 0.98f);
            AddButton("<", info.transform, new Vector2(320f, 176f), new Vector2(38f, 30f), () => CycleMenuRole(-1));
            AddButton(">", info.transform, new Vector2(368f, 176f), new Vector2(38f, 30f), () => CycleMenuRole(1));
            var summaryCard = AddPanel("Menu Setup Summary Card", info.transform, Vector2.zero, Vector2.one, new Vector2(18f, 58f), new Vector2(-18f, -234f), new Color(0.014f, 0.022f, 0.030f, 0.56f));
            AddImage("Menu Setup Summary Accent", summaryCard.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(1f, 0.76f, 0.34f, 0.42f));
            menuSetupSummaryText = AddText("Menu Setup Summary", info.transform, Vector2.zero, Vector2.one, new Vector2(28f, 64f), new Vector2(-28f, -236f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            menuSetupSummaryText.color = new Color(0.86f, 0.92f, 0.92f, 0.92f);
            menuSetupHintTitleText = AddText("Menu Hint Title", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 34f), new Vector2(-22f, -286f), "当前存档", 11, TextAnchor.UpperLeft, FontStyle.Bold);
            menuSetupHintTitleText.color = new Color(1f, 0.82f, 0.44f, 0.86f);
            menuHint = AddText("Menu Hint", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 8f), new Vector2(-22f, -312f), BuildMenuInfoText(), 12, TextAnchor.UpperLeft, FontStyle.Normal);
            menuHint.color = new Color(0.76f, 0.84f, 0.88f, 0.84f);
            AddText("Menu Footer", card.transform, Vector2.zero, Vector2.one, new Vector2(38f, 28f), new Vector2(-38f, -590f), "单机魔典、角色规则、AI 发言与行动结算都在本地运行。", 14, TextAnchor.LowerCenter, FontStyle.Normal);
            RenderMenuSetup();
            mainMenuRoot.gameObject.SetActive(true);
        }


        private string BuildMenuInfoText()
        {
            var queueCount = vm.storytellerQueue?.Length ?? 0;
            var timelineCount = vm.timeline?.Length ?? 0;
            return $"{DisplayScriptName()} · D{vm.day}/N{vm.night} · {PhaseLabel()}\n"
                + $"存活 {vm.alive} / 死亡 {vm.dead} · 队列 {queueCount} · 日志 {timelineCount}";
        }


        private void AddMenuButton(string label, Transform parent, Vector2 anchoredPosition, UnityEngine.Events.UnityAction onClick)
        {
            AddButton(label, parent, anchoredPosition, new Vector2(350f, 46f), onClick);
        }


        private void ToggleMainMenu(bool visible)
        {
            ApplyMainMenuState(visible);
        }


        private void ShowMenuMessage(string message)
        {
            if (menuHint != null) menuHint.text = message;
        }


        private void ApplyMainMenuState(bool visible)
        {
            if (mainMenuRoot != null)
            {
                mainMenuRoot.gameObject.SetActive(visible);
                if (visible)
                {
                    gameplayEntered = false;
                    ClearStageDialogueLifecycle(true);
                    if (settingsPanel != null) settingsPanel.gameObject.SetActive(false);
                    if (delayedEntryDialogueRoutine != null)
                    {
                        StopCoroutine(delayedEntryDialogueRoutine);
                        delayedEntryDialogueRoutine = null;
                    }
                    mainMenuRoot.SetAsLastSibling();
                    if (menuHint != null) menuHint.text = BuildMenuInfoText();
                }
            }
            SetGameplayChromeVisible(!visible);
            if (visible) ClearStageDialogueLifecycle(true);
        }


        private void SetGameplayChromeVisible(bool visible)
        {
            if (topHudRoot != null) topHudRoot.gameObject.SetActive(visible);
            if (grimoireRoot != null) grimoireRoot.gameObject.SetActive(visible);
            if (phaseRailRoot != null) phaseRailRoot.gameObject.SetActive(visible);
            if (infoRailRoot != null) infoRailRoot.gameObject.SetActive(visible);
            if (!visible)
            {
                CloseMoreActionsPanel();
                CloseTokenInspector();
                ClosePrivateChatPanel();
                CloseActionFormPanel();
                CloseStorytellerPanel();
                CloseHandbookPanel();
                CloseVotePanel();
                CloseEndgamePanel();
                if (rolePickerPanel != null) rolePickerPanel.gameObject.SetActive(false);
                if (reminderPickerPanel != null) reminderPickerPanel.gameObject.SetActive(false);
                if (proactiveWhisperPanel != null) proactiveWhisperPanel.gameObject.SetActive(false);
                if (phaseAssistPanel != null) phaseAssistPanel.gameObject.SetActive(false);
                if (nominationDebatePanel != null) nominationDebatePanel.gameObject.SetActive(false);
                eventPanelOpen = false;
                timelinePanelOpen = false;
                bottomDockOpen = false;
                if (bottomDock != null) bottomDock.gameObject.SetActive(false);
                if (bottomDockToggle != null) bottomDockToggle.gameObject.SetActive(false);
                ApplyAuxPanelVisibility();
                ApplyModalBackdropVisibility();
            }
            else
            {
                ApplyBottomDockVisibility();
                ApplyTokenInspectorVisibility();
                ApplyAuxPanelVisibility();
                RenderProactiveWhisperPanel();
                RenderPhaseAssistPanel();
                RenderNominationDebatePanel();
            }
        }


        private void LoadMenuSetupCatalog()
        {
            if (menuSetupCatalog != null && menuSetupCatalog.scripts != null && menuSetupCatalog.scripts.Length > 0) return;
            var asset = Resources.Load<TextAsset>("Botc/data/menu_setup");
            if (asset != null)
            {
                try
                {
                    menuSetupCatalog = JsonUtility.FromJson<MenuSetupCatalog>(asset.text);
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"Failed to read menu setup catalog: {ex.Message}");
                }
            }
            if (menuSetupCatalog == null || menuSetupCatalog.scripts == null || menuSetupCatalog.scripts.Length == 0)
            {
                menuSetupCatalog = new MenuSetupCatalog
                {
                    scripts = new[]
                    {
                        new MenuScriptOption { id = "tb", name = "暗流涌动", roles = Array.Empty<MenuRoleOption>() },
                        new MenuScriptOption { id = "bmr", name = "黯月初升", roles = Array.Empty<MenuRoleOption>() },
                        new MenuScriptOption { id = "snv", name = "梦殒春宵", roles = Array.Empty<MenuRoleOption>() },
                    }
                };
            }
        }


        private MenuScriptOption[] MenuScripts()
        {
            LoadMenuSetupCatalog();
            return menuSetupCatalog?.scripts ?? Array.Empty<MenuScriptOption>();
        }


        private MenuScriptOption CurrentMenuScript()
        {
            var scripts = MenuScripts();
            return scripts.FirstOrDefault((entry) => entry.id == menuSetupScriptId) ?? scripts.FirstOrDefault();
        }


        private MenuRoleOption[] CurrentMenuRoles()
        {
            return CurrentMenuScript()?.roles ?? Array.Empty<MenuRoleOption>();
        }


        private MenuRoleOption CurrentMenuRole()
        {
            var roles = CurrentMenuRoles();
            if (menuSetupRoleIndex <= 0 || roles.Length == 0) return null;
            return roles[Mathf.Clamp(menuSetupRoleIndex - 1, 0, roles.Length - 1)];
        }


        private void CycleMenuScript(int delta)
        {
            var scripts = MenuScripts();
            if (scripts.Length == 0) return;
            var current = Array.FindIndex(scripts, (entry) => entry.id == menuSetupScriptId);
            if (current < 0) current = 0;
            var next = WrapIndex(current + delta, scripts.Length);
            menuSetupScriptId = scripts[next].id;
            menuSetupRoleIndex = 0;
            RenderMenuSetup();
        }


        private void AdjustMenuPlayerCount(int delta)
        {
            menuSetupPlayerCount = Mathf.Clamp(menuSetupPlayerCount + delta, 5, 15);
            RenderMenuSetup();
        }


        private void CycleMenuRole(int delta)
        {
            var count = CurrentMenuRoles().Length + 1;
            if (count <= 1) return;
            menuSetupRoleIndex = WrapIndex(menuSetupRoleIndex + delta, count);
            RenderMenuSetup();
        }


        private void RenderMenuSetup()
        {
            var script = CurrentMenuScript();
            var role = CurrentMenuRole();
            if (menuSetupScriptText != null) menuSetupScriptText.text = script?.name ?? menuSetupScriptId;
            if (menuSetupPlayerCountText != null) menuSetupPlayerCountText.text = $"{menuSetupPlayerCount} 人";
            if (menuSetupRoleText != null) menuSetupRoleText.text = role == null ? "随机身份" : role.name;
            if (menuSetupSummaryText != null)
            {
                var roleText = role == null ? "身份由系统随机分配" : $"优先身份：{role.name}";
                menuSetupSummaryText.text = $"{script?.name ?? "暗流涌动"} · {menuSetupPlayerCount} 人\n{roleText} · 点击“新游戏”后生效";
            }
            if (menuSetupStatusImage != null)
            {
                menuSetupStatusImage.color = role == null
                    ? new Color(0.030f, 0.085f, 0.060f, 0.78f)
                    : new Color(0.13f, 0.090f, 0.028f, 0.84f);
            }
            if (menuSetupStatusText != null)
            {
                menuSetupStatusText.text = role == null ? "随机" : "自选";
                menuSetupStatusText.color = role == null
                    ? new Color(0.78f, 1f, 0.72f, 0.98f)
                    : new Color(1f, 0.82f, 0.42f, 0.98f);
            }
            if (menuHint != null && mainMenuRoot != null && mainMenuRoot.gameObject.activeSelf)
            {
                menuHint.text = BuildMenuInfoText();
            }
        }


        private static int WrapIndex(int value, int count)
        {
            if (count <= 0) return 0;
            var mod = value % count;
            return mod < 0 ? mod + count : mod;
        }


        private void StartNewGameFromMenu()
        {
            entryDialogueShown = false;
            ClearStageDialogueLifecycle(true);
            var role = CurrentMenuRole();
            SendUnityAction("new-game", roleId: role?.id ?? "", scriptId: menuSetupScriptId, playerCount: menuSetupPlayerCount);
            EnterGameplayFromMenu(false);
            ScheduleEntryDialogue(0.75f);
        }


        private void EnterGameplayFromMenu(bool showEntryDialogue)
        {
            gameplayEntered = true;
            if (mainMenuRoot != null) mainMenuRoot.gameObject.SetActive(false);
            if (settingsPanel != null) settingsPanel.gameObject.SetActive(false);
            SetGameplayChromeVisible(true);
            ApplyModalBackdropVisibility();
            if (showEntryDialogue) ScheduleEntryDialogue(0.15f);
        }


        private void ScheduleEntryDialogue(float delay)
        {
            if (!string.IsNullOrWhiteSpace(CommandLineValue("-botc-ui-smoke"))) return;
            if (delayedEntryDialogueRoutine != null) StopCoroutine(delayedEntryDialogueRoutine);
            delayedEntryDialogueRoutine = StartCoroutine(ShowEntryDialogueAfterDelay(delay));
        }


        private IEnumerator ShowEntryDialogueAfterDelay(float delay)
        {
            yield return new WaitForSecondsRealtime(Mathf.Max(0.01f, delay));
            if (!StageDialogueLifecycleAllowed())
            {
                delayedEntryDialogueRoutine = null;
                yield break;
            }
            PollViewModelChanges();
            ShowEntryDialogue();
            delayedEntryDialogueRoutine = null;
        }


        private void ShowEntryDialogue()
        {
            if (entryDialogueShown || !StageDialogueLifecycleAllowed()) return;
            entryDialogueShown = true;
            if (vm != null && vm.phase == "night" && vm.night == 1 && vm.day == 0)
            {
                BeginPhaseTransition("night", false);
                return;
            }
            var stage = NormalizePhaseTransitionStage(PhaseTransitionKey(vm));
            ShowStageDialogue("说书人", PhaseNarrationBody(stage), PhaseTransitionStageName(stage));
        }


        private void OpenSettingsPanel()
        {
            RefreshSettingsPanelText();
            if (settingsPanel == null) return;
            settingsPanel.gameObject.SetActive(true);
            if (modalBackdrop != null && (mainMenuRoot == null || !mainMenuRoot.gameObject.activeSelf)) modalBackdrop.SetAsLastSibling();
            settingsPanel.SetAsLastSibling();
            var group = EnsureCanvasGroup(settingsPanel);
            if (group != null)
            {
                group.alpha = 1f;
                group.blocksRaycasts = true;
                group.interactable = true;
            }
            ApplyModalBackdropVisibility();
        }


        private void CloseSettingsPanel()
        {
            if (settingsPanel != null) settingsPanel.gameObject.SetActive(false);
            ApplyModalBackdropVisibility();
        }


        private void LoadLocalSettings()
        {
            settingsResolutionIndex = Mathf.Clamp(PlayerPrefs.GetInt(SettingsResolutionKey, 2), 0, ResolutionPresets.Length - 1);
            settingsFullscreen = PlayerPrefs.GetInt(SettingsFullscreenKey, 1) != 0;
            settingsMasterVolume = Mathf.Clamp01(PlayerPrefs.GetFloat(SettingsMasterVolumeKey, 1f));
            settingsMusicVolume = Mathf.Clamp01(PlayerPrefs.GetFloat(SettingsMusicVolumeKey, 0.34f));
            settingsUiVolume = Mathf.Clamp01(PlayerPrefs.GetFloat(SettingsUiVolumeKey, 0.22f));
            var packageRequiresExplicitLocalLlmOptIn = PackageRequiresExplicitLocalLlmOptIn();
            var defaultLocalLlmRenderer = !packageRequiresExplicitLocalLlmOptIn && PackageEnablesLocalLlmRenderer() ? 1 : 0;
            settingsLocalLlmRenderer = packageRequiresExplicitLocalLlmOptIn
                ? false
                : PlayerPrefs.GetInt(SettingsLocalLlmRendererKey, defaultLocalLlmRenderer) != 0;
            if (CommandLineFlag("-botc-llm-renderer") || CommandLineFlag("-botc-ai-polish")) settingsLocalLlmRenderer = true;
            if (CommandLineFlag("-botc-no-llm-renderer")) settingsLocalLlmRenderer = false;
        }


        private void SaveLocalSettings()
        {
            PlayerPrefs.SetInt(SettingsResolutionKey, settingsResolutionIndex);
            PlayerPrefs.SetInt(SettingsFullscreenKey, settingsFullscreen ? 1 : 0);
            PlayerPrefs.SetFloat(SettingsMasterVolumeKey, settingsMasterVolume);
            PlayerPrefs.SetFloat(SettingsMusicVolumeKey, settingsMusicVolume);
            PlayerPrefs.SetFloat(SettingsUiVolumeKey, settingsUiVolume);
            PlayerPrefs.SetInt(SettingsLocalLlmRendererKey, settingsLocalLlmRenderer ? 1 : 0);
            PlayerPrefs.Save();
            ApplyDisplaySettings();
            ApplyAudioSettings();
            RestartBridgeAfterLLMSettingChange();
            SetSettingsStatus(settingsLocalLlmRenderer ? "设置已保存。发言润色已开启（实验）。" : "设置已保存。发言润色已关闭。");
        }


        private void ApplyDisplaySettings()
        {
            if (ApplyCommandLineDisplaySettings()) return;

            var resolution = ResolutionPresets[Mathf.Clamp(settingsResolutionIndex, 0, ResolutionPresets.Length - 1)];
            Screen.SetResolution(resolution.x, resolution.y, settingsFullscreen ? FullScreenMode.FullScreenWindow : FullScreenMode.Windowed);
        }


        private bool ApplyCommandLineDisplaySettings()
        {
            var widthArg = CommandLineValue("-screen-width");
            var heightArg = CommandLineValue("-screen-height");
            var fullscreenArg = CommandLineValue("-screen-fullscreen");
            if (string.IsNullOrWhiteSpace(widthArg) && string.IsNullOrWhiteSpace(heightArg) && string.IsNullOrWhiteSpace(fullscreenArg)) return false;

            var resolution = ResolutionPresets[Mathf.Clamp(settingsResolutionIndex, 0, ResolutionPresets.Length - 1)];
            var width = resolution.x;
            var height = resolution.y;
            if (!string.IsNullOrWhiteSpace(widthArg) && int.TryParse(widthArg, out var parsedWidth)) width = parsedWidth;
            if (!string.IsNullOrWhiteSpace(heightArg) && int.TryParse(heightArg, out var parsedHeight)) height = parsedHeight;
            width = Mathf.Clamp(width, 320, 3840);
            height = Mathf.Clamp(height, 240, 2160);

            var fullscreen = settingsFullscreen;
            if (!string.IsNullOrWhiteSpace(fullscreenArg))
            {
                fullscreen = fullscreenArg != "0"
                    && !fullscreenArg.Equals("false", StringComparison.OrdinalIgnoreCase)
                    && !fullscreenArg.Equals("windowed", StringComparison.OrdinalIgnoreCase);
            }

            Screen.SetResolution(width, height, fullscreen ? FullScreenMode.FullScreenWindow : FullScreenMode.Windowed);
            return true;
        }


        private void ApplyAudioSettings()
        {
            if (musicSource != null) musicSource.volume = settingsMasterVolume * settingsMusicVolume;
            if (uiAudioSource != null) uiAudioSource.volume = settingsMasterVolume * settingsUiVolume;
        }


        private void ChangeResolutionPreset(int delta)
        {
            settingsResolutionIndex = (settingsResolutionIndex + delta + ResolutionPresets.Length) % ResolutionPresets.Length;
            ApplyDisplaySettings();
            RefreshSettingsPanelText();
        }


        private void ToggleFullscreenSetting()
        {
            settingsFullscreen = !settingsFullscreen;
            ApplyDisplaySettings();
            RefreshSettingsPanelText();
        }


        private void ToggleLocalLlmRendererSetting()
        {
            settingsLocalLlmRenderer = !settingsLocalLlmRenderer;
            RefreshSettingsPanelText();
        }


        private void AdjustVolume(string channel, float delta)
        {
            if (channel == "master") settingsMasterVolume = Mathf.Clamp01(settingsMasterVolume + delta);
            else if (channel == "music") settingsMusicVolume = Mathf.Clamp01(settingsMusicVolume + delta);
            else if (channel == "ui") settingsUiVolume = Mathf.Clamp01(settingsUiVolume + delta);
            ApplyAudioSettings();
            RefreshSettingsPanelText();
        }


        private void RefreshSettingsPanelText()
        {
            var resolution = ResolutionPresets[Mathf.Clamp(settingsResolutionIndex, 0, ResolutionPresets.Length - 1)];
            if (settingsResolutionText != null) settingsResolutionText.text = $"{resolution.x} x {resolution.y}";
            if (settingsFullscreenText != null) settingsFullscreenText.text = settingsFullscreen ? "全屏" : "窗口";
            if (settingsMasterVolumeText != null) settingsMasterVolumeText.text = PercentText(settingsMasterVolume);
            if (settingsMusicVolumeText != null) settingsMusicVolumeText.text = PercentText(settingsMusicVolume);
            if (settingsUiVolumeText != null) settingsUiVolumeText.text = PercentText(settingsUiVolume);
            if (settingsLocalLlmRendererText != null) settingsLocalLlmRendererText.text = settingsLocalLlmRenderer ? "开启 · 实验" : "关闭";
            if (settingsDisplaySummaryText != null) settingsDisplaySummaryText.text = settingsFullscreen ? $"{resolution.y}p 全屏" : $"{resolution.y}p 窗口";
            if (settingsAudioSummaryText != null) settingsAudioSummaryText.text = $"{PercentText(settingsMasterVolume)} / {PercentText(settingsMusicVolume)}";
            if (settingsAiSummaryText != null) settingsAiSummaryText.text = settingsLocalLlmRenderer ? "润色开" : "基础";
            SetSettingsMeterFill(settingsMasterVolumeFill, settingsMasterVolume);
            SetSettingsMeterFill(settingsMusicVolumeFill, settingsMusicVolume);
            SetSettingsMeterFill(settingsUiVolumeFill, settingsUiVolume);
            SetSettingsSwitch(settingsFullscreenSwitchTrack, settingsFullscreenSwitchKnob, settingsFullscreen);
            SetSettingsSwitch(settingsLocalLlmSwitchTrack, settingsLocalLlmSwitchKnob, settingsLocalLlmRenderer);
        }


        private static string PercentText(float value)
        {
            return $"{Mathf.RoundToInt(Mathf.Clamp01(value) * 100f)}%";
        }


        private static void SetSettingsMeterFill(Image fill, float value)
        {
            if (fill == null) return;
            var rect = fill.rectTransform;
            rect.anchorMin = new Vector2(0f, 0f);
            rect.anchorMax = new Vector2(Mathf.Clamp01(value), 1f);
            rect.offsetMin = new Vector2(4f, 5f);
            rect.offsetMax = new Vector2(-4f, -5f);
            fill.color = value <= 0.01f
                ? new Color(0.18f, 0.075f, 0.036f, 0.34f)
                : new Color(0.86f, 0.58f, 0.26f, 0.36f);
        }


        private static void SetSettingsSwitch(Image track, Image knob, bool active)
        {
            if (track != null)
            {
                track.color = active
                    ? new Color(0.030f, 0.085f, 0.060f, 0.78f)
                    : new Color(0.10f, 0.060f, 0.030f, 0.76f);
            }
            if (knob == null) return;
            knob.color = active
                ? new Color(0.78f, 1f, 0.72f, 0.98f)
                : new Color(0.94f, 0.82f, 0.60f, 0.96f);
            var rect = knob.rectTransform;
            rect.anchorMin = new Vector2(0f, 0.5f);
            rect.anchorMax = new Vector2(0f, 0.5f);
            var x = active ? 206f : 12f;
            rect.offsetMin = new Vector2(x, -11f);
            rect.offsetMax = new Vector2(x + 28f, 11f);
        }


        private void SetSettingsStatus(string message)
        {
            if (settingsStatusText != null) settingsStatusText.text = message;
            if (menuHint != null && mainMenuRoot != null && mainMenuRoot.gameObject.activeSelf) menuHint.text = BuildMenuInfoText();
        }


        private string SaveDirectory()
        {
            return Path.Combine(Application.persistentDataPath, "BotcSoloUnitySave");
        }


        private string SaveFilePath(string filename)
        {
            return Path.Combine(SaveDirectory(), filename);
        }


        private bool HasLocalSave()
        {
            return File.Exists(SaveFilePath("unity_state.json")) && File.Exists(SaveFilePath("unity_viewmodel.json"));
        }


        private void SaveCurrentGame()
        {
            try
            {
                if (!File.Exists(statePath) || !File.Exists(viewModelPath))
                {
                    SetSettingsStatus("保存失败：当前局文件尚未就绪。");
                    return;
                }
                Directory.CreateDirectory(SaveDirectory());
                CopyIfExists(statePath, SaveFilePath("unity_state.json"));
                CopyIfExists(viewModelPath, SaveFilePath("unity_viewmodel.json"));
                CopyIfExists(resultPath, SaveFilePath("unity_action_result.json"));
                var meta = new UnitySaveMeta
                {
                    savedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    scriptName = DisplayScriptName(),
                    phase = PhaseLabel(),
                    day = vm?.day ?? 0,
                    night = vm?.night ?? 0,
                    alive = vm?.alive ?? 0,
                    dead = vm?.dead ?? 0,
                };
                File.WriteAllText(SaveFilePath("save_meta.json"), JsonUtility.ToJson(meta, true));
                SetSettingsStatus($"已保存：{meta.scriptName} D{meta.day}/N{meta.night}");
                ShowMenuMessage(BuildMenuInfoText());
            }
            catch (Exception ex)
            {
                SetSettingsStatus($"保存失败：{ex.Message}");
            }
        }


        private void LoadGameFromSave()
        {
            try
            {
                if (!HasLocalSave())
                {
                    SetSettingsStatus("没有找到本地存档。");
                    ShowMenuMessage("没有找到本地存档。可以先进入当前局，然后在菜单或设置中保存。");
                    return;
                }
                CopyIfExists(SaveFilePath("unity_state.json"), statePath);
                CopyIfExists(SaveFilePath("unity_viewmodel.json"), viewModelPath);
                CopyIfExists(SaveFilePath("unity_action_result.json"), resultPath);
                vm = LoadViewModel();
                lastPhaseTransitionKey = PhaseTransitionKey(vm);
                lastTimelineNarrationKey = LatestTimelineNarrationKey(vm);
                RememberViewModelTimestamp();
                entryDialogueShown = false;
                RenderAllAndMood();
                SetSettingsStatus("存档已读取。");
                EnterGameplayFromMenu(true);
            }
            catch (Exception ex)
            {
                SetSettingsStatus($"读取失败：{ex.Message}");
            }
        }


        private static void CopyIfExists(string source, string destination)
        {
            if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(destination) || !File.Exists(source)) return;
            var directory = Path.GetDirectoryName(destination);
            if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);
            File.Copy(source, destination, true);
        }
    }
}
