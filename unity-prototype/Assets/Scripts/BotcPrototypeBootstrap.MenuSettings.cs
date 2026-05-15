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
            AddToolActionButton("关", "关闭", settingsPanel, new Vector2(846f, 604f), new Vector2(104f, 34f), CloseSettingsPanel, true);

            AddSettingsRow("分辨率", 500f, out settingsResolutionText, () => ChangeResolutionPreset(-1), () => ChangeResolutionPreset(1));
            AddSettingsToggleRow("全屏", 430f, out settingsFullscreenText, ToggleFullscreenSetting);
            AddSettingsRow("主音量", 342f, out settingsMasterVolumeText, () => AdjustVolume("master", -0.05f), () => AdjustVolume("master", 0.05f));
            AddSettingsRow("音乐音量", 272f, out settingsMusicVolumeText, () => AdjustVolume("music", -0.05f), () => AdjustVolume("music", 0.05f));
            AddSettingsRow("界面音效", 202f, out settingsUiVolumeText, () => AdjustVolume("ui", -0.05f), () => AdjustVolume("ui", 0.05f));
            AddSettingsToggleRow("本地 LLM 润色", 132f, out settingsLocalLlmRendererText, ToggleLocalLlmRendererSetting);

            AddButton("保存设置", settingsPanel, new Vector2(236f, 64f), new Vector2(160f, 38f), SaveLocalSettings);
            AddButton("保存当前局", settingsPanel, new Vector2(460f, 64f), new Vector2(160f, 38f), SaveCurrentGame);
            AddButton("读取存档", settingsPanel, new Vector2(684f, 64f), new Vector2(160f, 38f), LoadGameFromSave);
            settingsStatusText = AddText("Settings Status", settingsPanel, Vector2.zero, Vector2.one, new Vector2(42f, 28f), new Vector2(-42f, -594f), "", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
            settingsStatusText.color = new Color(0.86f, 0.90f, 0.92f, 0.92f);
            settingsPanel.gameObject.SetActive(false);
            RefreshSettingsPanelText();
        }


        private void AddSettingsRow(string label, float y, out Text valueText, UnityEngine.Events.UnityAction onPrev, UnityEngine.Events.UnityAction onNext)
        {
            AddText($"Settings Label {label}", settingsPanel, Vector2.zero, Vector2.one, new Vector2(58f, y - 16f), new Vector2(-650f, -(660f - y - 32f)), label, 19, TextAnchor.MiddleLeft, FontStyle.Bold);
            valueText = AddText($"Settings Value {label}", settingsPanel, Vector2.zero, Vector2.one, new Vector2(326f, y - 16f), new Vector2(-286f, -(660f - y - 32f)), "", 18, TextAnchor.MiddleCenter, FontStyle.Normal);
            AddButton("‹", settingsPanel, new Vector2(274f, y), new Vector2(44f, 34f), onPrev);
            AddButton("›", settingsPanel, new Vector2(646f, y), new Vector2(44f, 34f), onNext);
        }


        private void AddSettingsToggleRow(string label, float y, out Text valueText, UnityEngine.Events.UnityAction onToggle)
        {
            AddText($"Settings Label {label}", settingsPanel, Vector2.zero, Vector2.one, new Vector2(58f, y - 16f), new Vector2(-650f, -(660f - y - 32f)), label, 19, TextAnchor.MiddleLeft, FontStyle.Bold);
            valueText = AddText($"Settings Value {label}", settingsPanel, Vector2.zero, Vector2.one, new Vector2(326f, y - 16f), new Vector2(-286f, -(660f - y - 32f)), "", 18, TextAnchor.MiddleCenter, FontStyle.Normal);
            AddButton("切换", settingsPanel, new Vector2(646f, y), new Vector2(92f, 34f), onToggle);
        }


        private void BuildMainMenu()
        {
            mainMenuRoot = AddPanel("Main Menu Overlay", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0.005f, 0.010f, 0.014f, 0.68f)).GetComponent<RectTransform>();
            var menuBg = AddImage("Menu Background", mainMenuRoot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, Color.white);
            menuBg.sprite = SpriteFromResource("Botc/ui/menu_bg") ?? SpriteFromResource("Botc/ui/bg_night");
            menuBg.color = menuBg.sprite == null ? new Color(0.006f, 0.010f, 0.016f, 1f) : new Color(0.82f, 0.90f, 1f, 1f);
            menuBg.preserveAspect = false;
            menuBg.raycastTarget = false;
            AddImage("Menu Background Shade", mainMenuRoot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.46f));
            AddImage("Menu Background Bottom Vignette", mainMenuRoot, Vector2.zero, new Vector2(1f, 0.58f), Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.28f));
            AddImage("Menu Warm Halo", mainMenuRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-560f, -360f), new Vector2(560f, 360f), new Color(0.95f, 0.72f, 0.38f, 0.10f));
            var card = AddPanel("Main Menu Card", mainMenuRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-460f, -320f), new Vector2(460f, 330f), new Color(0.012f, 0.014f, 0.016f, 0.90f));
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
            AddText("Menu Info Title", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 292f), new Vector2(-22f, -12f), "新游戏初设", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Menu Script Label", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 232f), new Vector2(-302f, -66f), "剧本", 17, TextAnchor.MiddleLeft, FontStyle.Bold);
            menuSetupScriptText = AddText("Menu Script Value", info.transform, Vector2.zero, Vector2.one, new Vector2(86f, 232f), new Vector2(-124f, -66f), "", 18, TextAnchor.MiddleCenter, FontStyle.Normal);
            AddButton("<", info.transform, new Vector2(320f, 276f), new Vector2(38f, 30f), () => CycleMenuScript(-1));
            AddButton(">", info.transform, new Vector2(368f, 276f), new Vector2(38f, 30f), () => CycleMenuScript(1));
            AddText("Menu Count Label", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 182f), new Vector2(-302f, -116f), "人数", 17, TextAnchor.MiddleLeft, FontStyle.Bold);
            menuSetupPlayerCountText = AddText("Menu Count Value", info.transform, Vector2.zero, Vector2.one, new Vector2(86f, 182f), new Vector2(-124f, -116f), "", 18, TextAnchor.MiddleCenter, FontStyle.Normal);
            AddButton("-", info.transform, new Vector2(320f, 226f), new Vector2(38f, 30f), () => AdjustMenuPlayerCount(-1));
            AddButton("+", info.transform, new Vector2(368f, 226f), new Vector2(38f, 30f), () => AdjustMenuPlayerCount(1));
            AddText("Menu Role Label", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 132f), new Vector2(-302f, -166f), "自选", 17, TextAnchor.MiddleLeft, FontStyle.Bold);
            menuSetupRoleText = AddText("Menu Role Value", info.transform, Vector2.zero, Vector2.one, new Vector2(86f, 132f), new Vector2(-124f, -166f), "", 18, TextAnchor.MiddleCenter, FontStyle.Normal);
            AddButton("<", info.transform, new Vector2(320f, 176f), new Vector2(38f, 30f), () => CycleMenuRole(-1));
            AddButton(">", info.transform, new Vector2(368f, 176f), new Vector2(38f, 30f), () => CycleMenuRole(1));
            menuSetupSummaryText = AddText("Menu Setup Summary", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 76f), new Vector2(-22f, -242f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            menuHint = AddText("Menu Hint", info.transform, Vector2.zero, Vector2.one, new Vector2(22f, 14f), new Vector2(-22f, -294f), BuildMenuInfoText(), 13, TextAnchor.UpperLeft, FontStyle.Normal);
            AddText("Menu Footer", card.transform, Vector2.zero, Vector2.one, new Vector2(38f, 28f), new Vector2(-38f, -590f), "Unity 负责界面外壳；规则、AI 与行动结算仍由 JS Core 驱动。", 14, TextAnchor.LowerCenter, FontStyle.Normal);
            RenderMenuSetup();
            mainMenuRoot.gameObject.SetActive(true);
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
            if (visible) HideStageDialogue();
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
                var roleText = role == null ? "系统随机分配你的身份" : $"你将优先成为：{role.name}";
                menuSetupSummaryText.text = $"{script?.name ?? "暗流涌动"} · {menuSetupPlayerCount} 人\n{roleText}\n点击左侧“新游戏”后生效。";
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
            if (!gameplayEntered || (mainMenuRoot != null && mainMenuRoot.gameObject.activeSelf))
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
            if (entryDialogueShown || !gameplayEntered) return;
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
            settingsLocalLlmRenderer = PlayerPrefs.GetInt(SettingsLocalLlmRendererKey, 0) != 0;
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
            SetSettingsStatus(settingsLocalLlmRenderer ? "设置已保存。本地 LLM 润色已开启（实验）。" : "设置已保存。本地 LLM 润色已关闭。");
        }


        private void ApplyDisplaySettings()
        {
            var resolution = ResolutionPresets[Mathf.Clamp(settingsResolutionIndex, 0, ResolutionPresets.Length - 1)];
            Screen.SetResolution(resolution.x, resolution.y, settingsFullscreen ? FullScreenMode.FullScreenWindow : FullScreenMode.Windowed);
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
        }


        private static string PercentText(float value)
        {
            return $"{Mathf.RoundToInt(Mathf.Clamp01(value) * 100f)}%";
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
