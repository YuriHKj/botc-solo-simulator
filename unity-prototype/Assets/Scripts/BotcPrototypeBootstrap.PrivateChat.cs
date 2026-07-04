using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private const int PrivateDialogueMaxRenderedEntries = 24;

        private void BuildPrivateChatPanel()
        {
            privateChatPanel = AddPanel("Private Chat Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-760f, 90f), new Vector2(760f, 860f), new Color(0.005f, 0.012f, 0.020f, 0.94f)).GetComponent<RectTransform>();
            AddFrame(privateChatPanel, "Private Chat Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.38f));
            AddImage("Private Chat Header Wash", privateChatPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -82f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.075f));
            privateChannelTitleText = AddText("Private Chat Title", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(30f, 710f), new Vector2(-360f, -14f), "私密频道", 34, TextAnchor.UpperLeft, FontStyle.Bold);
            var privacyPill = AddPanel("Private Chat Privacy Pill", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(1222f, 698f), new Vector2(-112f, -28f), new Color(0.020f, 0.036f, 0.048f, 0.68f));
            privateChannelStatusPill = privacyPill.GetComponent<Image>();
            AddFrame(privacyPill.transform, "Private Chat Privacy Pill Frame", 0.8f, new Color(0.62f, 0.78f, 0.92f, 0.32f));
            privateChannelStatusText = AddText("Private Chat Privacy Pill", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(1240f, 716f), new Vector2(-112f, -22f), "未选目标", 14, TextAnchor.MiddleCenter, FontStyle.Bold);
            privateChannelStatusText.color = new Color(0.88f, 0.93f, 0.96f, 0.96f);
            AddText("Private Chat Hint", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(1330f, 720f), new Vector2(-148f, -24f), "", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddToolActionButton("×", "关闭", privateChatPanel, new Vector2(1450f, 724f), new Vector2(104f, 34f), ClosePrivateChatPanel, true);
            privateTargetText = AddText("Private Target", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(32f, 668f), new Vector2(-30f, -78f), "目标：未选择", 20, TextAnchor.UpperLeft, FontStyle.Normal);

            privateTargetCardRoot = AddPanel("Private Target Card", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(30f, 86f), new Vector2(-1260f, -126f), new Color(0.020f, 0.028f, 0.036f, 0.28f)).GetComponent<RectTransform>();

            var privateHistoryWash = AddImage("Private History Wash", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(282f, 238f), new Vector2(-34f, -128f), new Color(0.020f, 0.028f, 0.036f, 0.34f));
            AddFrame(privateHistoryWash.transform, "Private History Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.22f));
            AddText("Private History Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(310f, 600f), new Vector2(-58f, -132f), "对话记录", 20, TextAnchor.UpperLeft, FontStyle.Bold);
            privateHistoryMetaText = AddText("Private History Meta", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(444f, 602f), new Vector2(-250f, -134f), "选择目标后显示记录", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            privateHistoryMetaText.color = new Color(0.72f, 0.80f, 0.84f, 0.82f);
            privateThreadRhythmRoot = AddPanel("Private Thread Rhythm", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(310f, 560f), new Vector2(-58f, -174f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            privateThreadRhythmRoot.gameObject.SetActive(false);
            privateDialogueStageBannerRoot = AddPanel("Private Dialogue Stage Banner", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(310f, 514f), new Vector2(-58f, -220f), new Color(0.006f, 0.014f, 0.022f, 0.64f)).GetComponent<RectTransform>();
            privateDialogueStageBannerRoot.gameObject.SetActive(false);
            privateHistoryText = AddText("Private History Text", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(310f, 548f), new Vector2(-58f, -186f), "选择一名玩家后显示最近私聊。", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            privateHistoryText.color = new Color(0.90f, 0.84f, 0.72f, 0.96f);
            privateHistoryText.gameObject.SetActive(false);
            privateDialogueStageRoot = AddPanel("Private Dialogue Stage Frame", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(294f, 246f), new Vector2(-46f, -176f), new Color(0.002f, 0.008f, 0.014f, 0.42f)).GetComponent<RectTransform>();
            privateDialogueStageRoot.GetComponent<Image>().raycastTarget = false;
            AddFrame(privateDialogueStageRoot, "Private Dialogue Stage Frame Border", 0.7f, new Color(0.62f, 0.78f, 0.92f, 0.14f));
            AddImage("Private Dialogue Stage Floor", privateDialogueStageRoot, new Vector2(0f, 0f), Vector2.one, new Vector2(6f, 6f), new Vector2(-6f, -6f), new Color(0.70f, 0.82f, 0.92f, 0.030f));
            AddImage("Private Dialogue Stage Vignette", privateDialogueStageRoot, Vector2.zero, new Vector2(1f, 0f), new Vector2(6f, 6f), new Vector2(-6f, 38f), new Color(0f, 0f, 0f, 0.22f));
            var privateDialogueScrollRoot = AddPanel("Private Dialogue Scroll", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(306f, 246f), new Vector2(-58f, -182f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            var privateDialogueViewport = AddPanel("Private Dialogue Viewport", privateDialogueScrollRoot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            privateDialogueViewport.gameObject.AddComponent<RectMask2D>();
            privateDialogueRoot = AddPanel("Private Dialogue Content", privateDialogueViewport, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -280f), Vector2.zero, new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            privateDialogueRoot.pivot = new Vector2(0.5f, 1f);
            privateDialogueScroll = privateDialogueScrollRoot.gameObject.AddComponent<ScrollRect>();
            privateDialogueScroll.viewport = privateDialogueViewport;
            privateDialogueScroll.content = privateDialogueRoot;
            privateDialogueScroll.horizontal = false;
            privateDialogueScroll.vertical = true;
            privateDialogueScroll.movementType = ScrollRect.MovementType.Clamped;
            privateDialogueScroll.scrollSensitivity = 34f;
            var composeWash = AddImage("Private Compose Wash", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(282f, 86f), new Vector2(-34f, -538f), new Color(0.020f, 0.028f, 0.036f, 0.30f));
            AddFrame(composeWash.transform, "Private Compose Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            AddText("Private Compose Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(310f, 200f), new Vector2(-58f, -548f), "本次私聊", 19, TextAnchor.UpperLeft, FontStyle.Bold);
            privateQuickPromptStripRoot = AddPanel("Private Quick Prompt Strip", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(454f, 190f), new Vector2(-420f, -546f), new Color(0.010f, 0.018f, 0.026f, 0.66f)).GetComponent<RectTransform>();
            AddFrame(privateQuickPromptStripRoot, "Private Quick Prompt Strip Frame", 0.7f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
            var quickStatePill = AddPanel("Private Quick Prompt State Pill", privateQuickPromptStripRoot, Vector2.zero, Vector2.zero, new Vector2(12f, 6f), new Vector2(108f, 30f), new Color(0.030f, 0.076f, 0.052f, 0.80f));
            privateQuickPromptStatePill = quickStatePill.GetComponent<Image>();
            privateQuickPromptStateText = AddText("Private Quick Prompt State Text", quickStatePill.transform, Vector2.zero, Vector2.one, new Vector2(4f, 0f), new Vector2(-4f, 0f), "可追问", 12, TextAnchor.MiddleCenter, FontStyle.Bold);
            AddPrivateQuickPromptButton("?", "问身份", new Vector2(604f, 208f), 92f, () => SendPrivateClaimQuestion());
            AddPrivateQuickPromptButton("≡", "讲理由", new Vector2(708f, 208f), 92f, () => SendPrivateQuickQuestion("你为什么这样判断？", "reason"));
            AddPrivateQuickPromptButton("✓", "聊票型", new Vector2(812f, 208f), 92f, () => SendPrivateQuickQuestion("你怎么看刚才的票型？", "vote"));
            AddText("Night Info Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(310f, 146f), new Vector2(-1018f, -608f), "说法", 16, TextAnchor.UpperLeft, FontStyle.Bold);
            privateNightInput = AddInputField("Private Night Input", privateChatPanel, new Vector2(380f, 132f), new Vector2(1378f, 176f), "例如：我昨晚看到 3 号和 7 号不同阵营");
            privateNightInput.onValueChanged.AddListener((_) => UpdatePrivateComposeSurface(SelectedPrivateChatTarget()));
            privateSecretToggle = AddToggle("Private Secret Toggle", privateChatPanel, new Vector2(310f, 94f), "请求对方暂时保密");
            privateSecretToggle.onValueChanged.AddListener((_) => UpdatePrivateComposeSurface(SelectedPrivateChatTarget()));
            AddToolActionButton("?", "询问身份", privateChatPanel, new Vector2(1080f, 58f), new Vector2(132f, 40f), () => SendPrivateClaimQuestion());
            AddToolActionButton("→", "发送私聊", privateChatPanel, new Vector2(1230f, 58f), new Vector2(142f, 40f), () => SendPrivatePanelMessage());
            AddToolActionButton("×", "关闭", privateChatPanel, new Vector2(1370f, 58f), new Vector2(96f, 40f), ClosePrivateChatPanel);
            privateTargetPickerRoot = AddPanel("Private Target Picker", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(282f, 86f), new Vector2(-34f, -126f), new Color(0.004f, 0.010f, 0.017f, 0.95f)).GetComponent<RectTransform>();
            PopulatePrivateClaimRoles();
            privateChatPanel.gameObject.SetActive(false);
        }

        private void AddPrivateLaneBadge(string label, Vector2 center, Vector2 size, Color fill, Color border)
        {
            var half = size * 0.5f;
            var badge = AddPanel($"Private Lane {label}", privateChatPanel, Vector2.zero, Vector2.zero, center - half, center + half, fill);
            AddFrame(badge.transform, "Private Lane Frame", 0.7f, border);
            AddText("Private Lane Label", badge.transform, Vector2.zero, Vector2.one, new Vector2(4f, 0f), new Vector2(-4f, 0f), label, 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.96f, 0.91f, 0.82f, 0.96f);
        }

        private void AddPrivateQuickPromptButton(string icon, string label, Vector2 center, float width, UnityEngine.Events.UnityAction onClick)
        {
            AddToolActionButton(icon, label, privateChatPanel, center, new Vector2(width, 30f), onClick, true);
        }

        private void ClosePrivateChatPanel()
        {
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            ApplyModalBackdropVisibility();
            ApplyBottomDockVisibility();
            ApplyFocusChromeVisibility();
            ScheduleProactiveWhisperRenderAfterDialogue();
        }

        private PlayerViewModel SelectedPrivateChatTarget()
        {
            var player = SelectedPlayer();
            return player != null && !player.human ? player : null;
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

        private static string TimelineStamp(TimelineEntryViewModel item)
        {
            if (item == null) return "";
            if (item.day > 0) return $"D{item.day}";
            if (item.night > 0) return $"N{item.night}";
            return "时间线";
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

        private void SetPrivateClaimRole(string roleId)
        {
            PopulatePrivateClaimRoles();
            privateClaimRoleIndex = Mathf.Max(0, privateClaimRoleIds.IndexOf(roleId ?? ""));
        }

        private void OpenPrivateChatPanel()
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            CloseActionFormPanel();
            if (stageDialoguePanel != null && stageDialoguePanel.gameObject.activeSelf) HideStageDialogue(false);
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            if (string.IsNullOrWhiteSpace(privateChatStatus))
            {
                privateChatStatus = SelectedPrivateChatTarget() == null
                    ? "先选择一名私聊目标。"
                    : "选择身份、填写夜间信息或勾选保密后发送。";
            }
            PopulatePrivateClaimRoles();
            UpdatePrivateChatPanelText();
            ShowModalPanel(privateChatPanel);
            ApplyBottomDockVisibility();
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
                return $"仍在等待对方回应（{PendingActionElapsed():0.0}s）。本地语言模型可能还在润色，请先不要连续发送。";
            }
            return $"等待对方回应（{PendingActionElapsed():0.0}s）。";
        }

        private void UpdatePrivateComposeSurface(PlayerViewModel target)
        {
            UpdatePrivateQuickPromptStrip(target);
            UpdatePrivateComposePreview(target);
            UpdatePrivateComposeReadiness(target);
        }

        private void UpdatePrivateQuickPromptStrip(PlayerViewModel target)
        {
            if (privateQuickPromptStripRoot == null) return;
            var pending = target != null && IsPendingPrivateChatForTarget(target);
            var timedOut = pending && PendingActionTimedOut();
            var stripImage = privateQuickPromptStripRoot.GetComponent<Image>();
            if (stripImage != null)
            {
                stripImage.color = timedOut
                    ? new Color(0.18f, 0.044f, 0.032f, 0.70f)
                    : pending ? new Color(0.14f, 0.100f, 0.036f, 0.68f)
                    : target == null ? new Color(0.010f, 0.018f, 0.026f, 0.58f)
                    : new Color(0.010f, 0.018f, 0.026f, 0.66f);
            }
            if (privateQuickPromptStatePill != null)
            {
                privateQuickPromptStatePill.color = timedOut
                    ? new Color(0.28f, 0.070f, 0.040f, 0.88f)
                    : pending ? new Color(0.22f, 0.150f, 0.040f, 0.84f)
                    : target == null ? new Color(0.036f, 0.054f, 0.068f, 0.78f)
                    : new Color(0.030f, 0.076f, 0.052f, 0.80f);
            }
            if (privateQuickPromptStateText != null)
            {
                privateQuickPromptStateText.text = PrivateQuickPromptStateLabel(target);
                privateQuickPromptStateText.color = timedOut
                    ? new Color(1f, 0.70f, 0.52f, 1f)
                    : pending ? new Color(1f, 0.86f, 0.48f, 0.98f)
                    : target == null ? new Color(0.72f, 0.84f, 0.92f, 0.96f)
                    : new Color(0.72f, 0.92f, 0.78f, 0.96f);
            }
        }

        private string PrivateQuickPromptStateLabel(PlayerViewModel target)
        {
            if (target == null) return "选目标";
            if (IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut() ? "先等" : "等回应";
            return "可追问";
        }

        private void UpdatePrivateComposePreview(PlayerViewModel target)
        {
            if (privateComposePreviewRoot == null) return;

            var pending = target != null && IsPendingPrivateChatForTarget(target);
            var timedOut = pending && PendingActionTimedOut();
            var hasPayload = PrivateComposeHasPayload();
            var tint = timedOut
                ? new Color(0.20f, 0.046f, 0.032f, 0.78f)
                : pending ? new Color(0.16f, 0.120f, 0.040f, 0.76f)
                : hasPayload ? new Color(0.12f, 0.065f, 0.030f, 0.72f)
                : target == null ? new Color(0.018f, 0.028f, 0.036f, 0.60f)
                : new Color(0.014f, 0.024f, 0.032f, 0.70f);
            var panelImage = privateComposePreviewRoot.GetComponent<Image>();
            if (panelImage != null) panelImage.color = tint;

            if (privateComposePreviewBadgeImage != null)
            {
                privateComposePreviewBadgeImage.color = timedOut
                    ? new Color(0.30f, 0.10f, 0.045f, 0.96f)
                    : pending ? new Color(0.23f, 0.15f, 0.040f, 0.94f)
                    : hasPayload ? new Color(0.16f, 0.080f, 0.030f, 0.94f)
                    : new Color(0.032f, 0.050f, 0.064f, 0.90f);
            }
            if (privateComposePreviewBadgeText != null)
            {
                privateComposePreviewBadgeText.text = PrivateComposePreviewBadge(target);
                privateComposePreviewBadgeText.color = timedOut
                    ? new Color(1f, 0.72f, 0.54f, 1f)
                    : pending || hasPayload ? new Color(1f, 0.82f, 0.42f, 1f)
                    : new Color(0.72f, 0.84f, 0.92f, 0.96f);
            }
            if (privateComposePreviewTitleText != null)
            {
                privateComposePreviewTitleText.text = PrivateComposePreviewTitle(target);
                privateComposePreviewTitleText.color = timedOut
                    ? new Color(1f, 0.66f, 0.46f, 1f)
                    : pending || hasPayload ? new Color(1f, 0.82f, 0.44f, 0.98f)
                    : new Color(0.80f, 0.88f, 0.92f, 0.88f);
            }
            if (privateComposePreviewMetaText != null) privateComposePreviewMetaText.text = Ellipsize(PrivateComposePreviewMeta(target), 18);
            if (privateComposePreviewBodyText != null) privateComposePreviewBodyText.text = Ellipsize(PrivateComposePreviewBody(target), 38);
        }

        private void UpdatePrivateComposeReadiness(PlayerViewModel target)
        {
            if (privateComposeReadinessRoot == null) return;

            var pending = target != null && IsPendingPrivateChatForTarget(target);
            var timedOut = pending && PendingActionTimedOut();
            var hasPayload = PrivateComposeHasPayload();
            var panelImage = privateComposeReadinessRoot.GetComponent<Image>();
            if (panelImage != null)
            {
                panelImage.color = timedOut
                    ? new Color(0.20f, 0.046f, 0.032f, 0.76f)
                    : pending ? new Color(0.16f, 0.120f, 0.040f, 0.72f)
                    : hasPayload ? new Color(0.12f, 0.065f, 0.030f, 0.72f)
                    : target == null ? new Color(0.016f, 0.028f, 0.038f, 0.64f)
                    : new Color(0.014f, 0.024f, 0.032f, 0.70f);
            }

            if (privateStatusText != null)
            {
                privateStatusText.text = Ellipsize(PrivateComposeReadinessTitle(target), 30);
                privateStatusText.color = timedOut
                    ? new Color(1f, 0.64f, 0.46f, 1f)
                    : pending || hasPayload ? new Color(1f, 0.84f, 0.46f, 0.98f)
                    : new Color(0.82f, 0.88f, 0.90f, 0.90f);
            }
            if (privateComposeReadinessMetaText != null)
            {
                privateComposeReadinessMetaText.text = Ellipsize(PrivateComposeReadinessMeta(target), 42);
                privateComposeReadinessMetaText.color = timedOut
                    ? new Color(1f, 0.74f, 0.58f, 0.90f)
                    : new Color(0.72f, 0.82f, 0.86f, 0.84f);
            }
            if (privateComposeReadinessStepPill != null)
            {
                privateComposeReadinessStepPill.color = timedOut
                    ? new Color(0.28f, 0.070f, 0.040f, 0.90f)
                    : pending ? new Color(0.22f, 0.150f, 0.040f, 0.88f)
                    : target == null ? new Color(0.036f, 0.054f, 0.068f, 0.86f)
                    : new Color(0.12f, 0.065f, 0.030f, 0.88f);
            }
            if (privateComposeReadinessStepText != null)
            {
                privateComposeReadinessStepText.text = PrivateComposeReadinessStep(target);
                privateComposeReadinessStepText.color = timedOut
                    ? new Color(1f, 0.70f, 0.52f, 1f)
                    : target == null ? new Color(0.72f, 0.84f, 0.92f, 0.96f)
                    : new Color(1f, 0.88f, 0.52f, 0.98f);
            }
        }

        private bool PrivateComposeHasPayload()
        {
            return !string.IsNullOrWhiteSpace(SelectedPrivateClaimRoleId())
                || !string.IsNullOrWhiteSpace(privateNightInput == null ? "" : privateNightInput.text)
                || (privateSecretToggle != null && privateSecretToggle.isOn);
        }

        private string PrivateComposePreviewBadge(PlayerViewModel target)
        {
            if (target == null) return "待";
            if (IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut() ? "久" : "等";
            if (!string.IsNullOrWhiteSpace(SelectedPrivateClaimRoleId())) return "身";
            if (!string.IsNullOrWhiteSpace(privateNightInput == null ? "" : privateNightInput.text)) return "夜";
            if (privateSecretToggle != null && privateSecretToggle.isOn) return "密";
            return "草";
        }

        private string PrivateComposePreviewTitle(PlayerViewModel target)
        {
            if (target == null) return "待发送";
            if (IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut() ? "上一条仍在等待" : "已发出，等回应";
            return $"待发送给 {target.seat}号";
        }

        private string PrivateComposePreviewBody(PlayerViewModel target)
        {
            if (target == null) return "选择玩家后预览本次私聊。";
            if (IsPendingPrivateChatForTarget(target))
            {
                return PendingActionTimedOut() ? "先别重复发送；等对方回应或检查同步。" : "上一条私聊正在生成回应。";
            }

            var claimRoleId = SelectedPrivateClaimRoleId();
            var claimRole = string.IsNullOrWhiteSpace(claimRoleId) ? "" : RoleNameForId(claimRoleId);
            var nightInfo = privateNightInput == null ? "" : privateNightInput.text.Trim();
            var askSecret = privateSecretToggle != null && privateSecretToggle.isOn;
            if (!string.IsNullOrWhiteSpace(claimRole) && !string.IsNullOrWhiteSpace(nightInfo)) return $"声称 {claimRole}；夜间说法：{nightInfo}";
            if (!string.IsNullOrWhiteSpace(claimRole)) return $"我声称自己是 {claimRole}。";
            if (!string.IsNullOrWhiteSpace(nightInfo)) return $"夜间说法：{nightInfo}";
            if (askSecret) return "这条信息先只在我们之间对齐。";
            return "我想和你私下交换一下信息。";
        }

        private string PrivateComposePreviewMeta(PlayerViewModel target)
        {
            if (target == null) return "未选目标";
            if (IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut() ? "避免重复发送" : "处理中";
            var privacy = privateSecretToggle != null && privateSecretToggle.isOn ? "保密" : "公开口径";
            return $"{PrivateComposeIntentLabel()} · {privacy}";
        }

        private string PrivateComposeIntentLabel()
        {
            if (!string.IsNullOrWhiteSpace(SelectedPrivateClaimRoleId())) return "身份声称";
            if (!string.IsNullOrWhiteSpace(privateNightInput == null ? "" : privateNightInput.text)) return "夜间线索";
            if (privateSecretToggle != null && privateSecretToggle.isOn) return "保密对齐";
            return "普通私聊";
        }

        private string PrivateComposeReadinessTitle(PlayerViewModel target)
        {
            if (target == null) return "先选择私聊目标";
            if (IsPendingPrivateChatForTarget(target))
            {
                return PendingActionTimedOut()
                    ? $"上一条等待 {PendingActionElapsed():0.0}s"
                    : $"等待 {target.seat}号回应 {PendingActionElapsed():0.0}s";
            }
            return PrivateComposeHasPayload() ? "草稿已准备" : "可发送默认私聊";
        }

        private string PrivateComposeReadinessMeta(PlayerViewModel target)
        {
            if (target == null) return "从魔典点选玩家，或在右侧目标选择器里接入频道。";
            if (IsPendingPrivateChatForTarget(target))
            {
                return PendingActionTimedOut()
                    ? "对方回复未返回；先查看同步状态，避免重复发送。"
                    : "请求已发出；回复会进入上方记录和时间线。";
            }
            var privacy = privateSecretToggle != null && privateSecretToggle.isOn ? "保密" : "公开口径";
            return PrivateComposeHasPayload()
                ? $"{PrivateComposeIntentLabel()} · {privacy} · 发给 {target.seat}号"
                : $"未填草稿时会发送默认交换信息 · 发给 {target.seat}号";
        }

        private string PrivateComposeReadinessStep(PlayerViewModel target)
        {
            if (target == null) return "选目标";
            if (IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut() ? "先等待" : "处理中";
            return PrivateComposeHasPayload() ? "发送草稿" : "可发送";
        }

        private void UpdatePrivateChatPanelText()
        {
            var target = SelectedPrivateChatTarget();
            var hasTarget = target != null;
            if (privateChannelTitleText != null)
            {
                privateChannelTitleText.text = hasTarget ? $"私密频道 · {target.seat}号" : "私密频道";
            }
            if (privateChannelStatusText != null)
            {
                privateChannelStatusText.text = hasTarget ? PrivateThreadStateLabel(target) : "未选目标";
                privateChannelStatusText.color = hasTarget && IsPendingPrivateChatForTarget(target) && PendingActionTimedOut()
                    ? new Color(1f, 0.62f, 0.44f, 1f)
                    : new Color(0.88f, 0.93f, 0.96f, 0.96f);
            }
            if (privateChannelStatusPill != null)
            {
                privateChannelStatusPill.color = hasTarget
                    ? PrivateThreadStateFill(target)
                    : new Color(0.020f, 0.036f, 0.048f, 0.68f);
            }
            if (privateTargetText != null)
            {
                privateTargetText.text = hasTarget
                    ? $"你 ↔ {target.name} · {PrivateThreadCountLabel(target)}"
                    : "尚未连接到玩家";
                privateTargetText.color = hasTarget
                    ? new Color(0.90f, 0.84f, 0.72f, 0.96f)
                    : new Color(0.74f, 0.82f, 0.86f, 0.82f);
            }
            if (privateClaimRoleText != null)
            {
                var roleId = SelectedPrivateClaimRoleId();
                privateClaimRoleText.text = !hasTarget
                    ? "先选目标"
                    : string.IsNullOrWhiteSpace(roleId) ? "不私下声称" : RoleNameForId(roleId);
            }
            RenderPrivateClaimRoleIcon(hasTarget);
            if (privateHistoryText != null) privateHistoryText.text = BuildPrivateHistoryText();
            if (privateHistoryMetaText != null) privateHistoryMetaText.text = PrivateHistoryMetaLabel(target);
            RenderPrivateThreadRhythm(target);
            RenderPrivateDialogueStageBanner(target);
            RenderPrivateTargetCard(target);
            UpdatePrivateComposeSurface(target);
            RenderPrivateDialogueBubbles(target);
            RenderPrivateTargetPicker();
        }

        private void RenderPrivateThreadRhythm(PlayerViewModel target)
        {
            if (privateThreadRhythmRoot == null) return;
            ClearChildren(privateThreadRhythmRoot);

            var entries = target == null ? new List<TimelineEntryViewModel>() : PrivateTimelineEntriesForSelected();
            AddPrivateRhythmField(
                "频道",
                target == null ? "未选择" : $"你 ↔ {target.name}",
                target == null ? "先选玩家" : "私密线",
                new Vector2(0f, 2f),
                new Vector2(226f, 34f),
                new Color(0.38f, 0.66f, 0.94f, 0.34f)
            );
            AddPrivateRhythmField(
                "最新",
                PrivateThreadLatestLabel(target, entries),
                entries.Count == 0 ? "尚无历史" : $"{entries.Count} 条",
                new Vector2(238f, 2f),
                new Vector2(464f, 34f),
                PrivateThreadLatestAccent(target, entries)
            );
            AddPrivateRhythmField(
                "下一步",
                PrivateThreadSuggestedStep(target, entries),
                PrivateThreadSuggestedHelper(target, entries),
                new Vector2(476f, 2f),
                new Vector2(742f, 34f),
                new Color(0.92f, 0.68f, 0.30f, 0.38f)
            );
            AddPrivateRhythmField(
                "边界",
                "不进入公聊",
                "只写私聊记录",
                new Vector2(754f, 2f),
                new Vector2(930f, 34f),
                new Color(0.54f, 0.82f, 0.64f, 0.32f)
            );
            RenderPrivateRhythmTurnTrack(target, entries);
        }

        private void RenderPrivateRhythmTurnTrack(PlayerViewModel target, List<TimelineEntryViewModel> entries)
        {
            if (privateThreadRhythmRoot == null) return;
            var track = AddPanel("Private Rhythm Turn Track", privateThreadRhythmRoot, Vector2.zero, Vector2.zero, new Vector2(942f, 2f), new Vector2(1038f, 34f), new Color(0.004f, 0.010f, 0.016f, 0.62f));
            AddFrame(track.transform, "Private Rhythm Turn Track Frame", 0.6f, new Color(0.70f, 0.82f, 0.92f, 0.18f));
            AddText("Private Rhythm Turn Label", track.transform, Vector2.zero, Vector2.one, new Vector2(8f, 16f), new Vector2(-8f, -2f), target == null ? "回合" : "来回", 9, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.88f, 0.92f, 0.96f, 0.70f);

            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            var recent = (entries ?? new List<TimelineEntryViewModel>()).Skip(Mathf.Max(0, (entries?.Count ?? 0) - 6)).ToArray();
            if (recent.Length == 0 && target == null)
            {
                AddText("Private Rhythm Turn Empty", track.transform, Vector2.zero, Vector2.one, new Vector2(36f, 0f), new Vector2(-8f, -14f), "选目标", 10, TextAnchor.MiddleRight, FontStyle.Bold).color = new Color(0.72f, 0.82f, 0.86f, 0.72f);
                return;
            }

            var startX = 32f;
            for (var i = 0; i < recent.Length; i++)
            {
                var fromHuman = !string.IsNullOrWhiteSpace(humanId) && recent[i].speakerId == humanId;
                AddPrivateRhythmTurnPip(track.transform, i, new Vector2(startX + i * 9f, 9f), fromHuman, false);
            }
            if (target != null && IsPendingPrivateChatForTarget(target))
            {
                AddPrivateRhythmTurnPip(track.transform, 7, new Vector2(86f, 9f), false, true);
            }
        }

        private void AddPrivateRhythmTurnPip(Transform parent, int index, Vector2 center, bool fromHuman, bool pending)
        {
            var fill = pending
                ? new Color(1f, 0.72f, 0.30f, 0.86f)
                : fromHuman ? new Color(0.95f, 0.62f, 0.28f, 0.78f) : new Color(0.54f, 0.78f, 0.94f, 0.72f);
            var pip = AddCircleImage($"Private Rhythm Turn Pip {index}", parent, pending ? 8f : 6f, fill, false);
            pip.rectTransform.anchoredPosition = center;
            if (pending)
            {
                var ring = AddCircleImage("Private Rhythm Pending Ring", parent, 12f, new Color(1f, 0.82f, 0.42f, 0.34f), true);
                ring.rectTransform.anchoredPosition = center;
            }
        }

        private void AddPrivateRhythmField(string label, string value, string helper, Vector2 offsetMin, Vector2 offsetMax, Color accent)
        {
            if (privateThreadRhythmRoot == null) return;
            var field = AddPanel($"Private Rhythm {label}", privateThreadRhythmRoot, Vector2.zero, Vector2.zero, offsetMin, offsetMax, new Color(0.004f, 0.010f, 0.016f, 0.62f));
            AddImage("Private Rhythm Accent", field.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), accent);
            AddFrame(field.transform, "Private Rhythm Frame", 0.6f, new Color(accent.r, accent.g, accent.b, 0.24f));
            AddText("Private Rhythm Label", field.transform, Vector2.zero, Vector2.one, new Vector2(10f, 12f), new Vector2(-126f, -3f), label, 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.92f);
            AddText("Private Rhythm Value", field.transform, Vector2.zero, Vector2.one, new Vector2(60f, 10f), new Vector2(-8f, -2f), Ellipsize(value, 12), 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.96f, 0.91f, 0.82f, 0.98f);
            AddText("Private Rhythm Helper", field.transform, Vector2.zero, Vector2.one, new Vector2(10f, 2f), new Vector2(-8f, -20f), Ellipsize(helper, 14), 9, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.72f, 0.82f, 0.86f, 0.76f);
        }

        private string PrivateThreadLatestLabel(PlayerViewModel target, List<TimelineEntryViewModel> entries)
        {
            if (target == null) return "未选择";
            if (IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut() ? "等待过久" : "等待回应";
            if (entries == null || entries.Count == 0) return "尚未开口";
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            var latest = entries[entries.Count - 1];
            return !string.IsNullOrWhiteSpace(humanId) && latest.speakerId == humanId ? "你刚发言" : "对方已回应";
        }

        private Color PrivateThreadLatestAccent(PlayerViewModel target, List<TimelineEntryViewModel> entries)
        {
            if (target != null && IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut()
                ? new Color(1f, 0.42f, 0.28f, 0.42f)
                : new Color(1f, 0.76f, 0.32f, 0.36f);
            if (entries == null || entries.Count == 0) return new Color(0.92f, 0.68f, 0.30f, 0.32f);
            return new Color(0.48f, 0.86f, 0.58f, 0.32f);
        }

        private string PrivateThreadSuggestedStep(PlayerViewModel target, List<TimelineEntryViewModel> entries)
        {
            if (target == null) return "选择目标";
            if (IsPendingPrivateChatForTarget(target)) return "等回复";
            if (entries == null || entries.Count == 0) return "询问身份";
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            var latest = entries[entries.Count - 1];
            if (!string.IsNullOrWhiteSpace(humanId) && latest.speakerId == humanId) return "等待对方";
            if (string.IsNullOrWhiteSpace(target.markedRoleId) && !target.revealed) return "记录身份";
            return "继续追问";
        }

        private string PrivateThreadSuggestedHelper(PlayerViewModel target, List<TimelineEntryViewModel> entries)
        {
            if (target == null) return "右侧列表或玩家";
            if (IsPendingPrivateChatForTarget(target)) return "避免重复发送";
            if (entries == null || entries.Count == 0) return "先建立口径";
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            var latest = entries[entries.Count - 1];
            if (!string.IsNullOrWhiteSpace(humanId) && latest.speakerId == humanId) return "看对方回应";
            if (string.IsNullOrWhiteSpace(target.markedRoleId) && !target.revealed) return "回魔典标记";
            return "用上方追问";
        }

        private void RenderPrivateClaimRoleIcon(bool hasTarget)
        {
            if (privateClaimRoleGridRoot == null) return;
            for (var i = privateClaimRoleGridRoot.childCount - 1; i >= 0; i--) Destroy(privateClaimRoleGridRoot.GetChild(i).gameObject);
            var roleId = SelectedPrivateClaimRoleId();
            var role = RoleForId(roleId);
            if (!hasTarget || role == null)
            {
                AddBlankRoleTokenButton(privateClaimRoleGridRoot, hasTarget ? "选择" : "未选", new Vector2(48f, 44f), 46f, false, OpenPrivateClaimRolePicker);
                return;
            }
            AddRoleTokenButton(privateClaimRoleGridRoot, role.id, role.name, role.category, role.team, new Vector2(48f, 44f), 46f, true, OpenPrivateClaimRolePicker);
        }

        private string PrivateHistoryMetaLabel(PlayerViewModel target)
        {
            if (target == null) return "选择目标后显示记录";
            var count = PrivateTimelineEntriesForSelected().Count;
            if (count <= 0) return "暂无记录；发送后会停在最新消息";
            var rendered = Mathf.Min(count, PrivateDialogueMaxRenderedEntries);
            var start = count - rendered + 1;
            var range = rendered == count ? $"{count} 条记录" : $"最近 {start}-{count}/{count} 条";
            return rendered < count
                ? $"{range} · 更早内容在日志/时间线"
                : count <= 2 ? $"{range} · 已在最新位置" : $"{range} · 滚轮上滑看更早";
        }

        private void RenderPrivateDialogueBubbles(PlayerViewModel target)
        {
            if (privateDialogueRoot == null) return;
            for (var i = privateDialogueRoot.childCount - 1; i >= 0; i--) Destroy(privateDialogueRoot.GetChild(i).gameObject);

            var viewportRect = privateDialogueScroll != null && privateDialogueScroll.viewport != null ? privateDialogueScroll.viewport.rect : privateDialogueRoot.rect;
            var width = Mathf.Max(720f, viewportRect.width);
            var viewportHeight = Mathf.Max(260f, viewportRect.height);
            if (target == null)
            {
                SetPrivateDialogueContentHeight(viewportHeight);
                RenderPrivateDialogueLaneBackdrop(width, viewportHeight);
                AddText("Private Dialogue Empty", privateDialogueRoot, Vector2.zero, Vector2.one, new Vector2(18f, 72f), new Vector2(-18f, -72f), "选择一名玩家后，这里会显示最近私聊。", 16, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var entries = PrivateTimelineEntriesForSelected();
            var showPending = IsPendingPrivateChatForTarget(target);
            if (entries.Count == 0 && !showPending)
            {
                SetPrivateDialogueContentHeight(viewportHeight);
                RenderPrivateDialogueLaneBackdrop(width, viewportHeight);
                AddText("Private Dialogue None", privateDialogueRoot, Vector2.zero, Vector2.one, new Vector2(18f, 72f), new Vector2(-18f, -72f), $"暂无与 {target.name} 的私聊记录。", 16, TextAnchor.MiddleCenter, FontStyle.Normal);
                AddText("Private Dialogue Prompt", privateDialogueRoot, Vector2.zero, Vector2.one, new Vector2(18f, 34f), new Vector2(-18f, -118f), "点击“询问身份”或发送本次私聊后，对话会刷新到这里。", 13, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var visibleEntries = entries.Skip(Mathf.Max(0, entries.Count - PrivateDialogueMaxRenderedEntries)).ToArray();
            var hiddenOlderCount = Mathf.Max(0, entries.Count - visibleEntries.Length);
            var rowCount = visibleEntries.Length + (showPending ? 1 : 0);
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            var bubbleHeights = visibleEntries
                .Select((entry) => PrivateBubbleHeight(entry, !string.IsNullOrWhiteSpace(humanId) && entry.speakerId == humanId ? 34 : 36))
                .ToArray();
            var pendingBubbleHeight = showPending ? 58f : 0f;
            var showScrollHint = visibleEntries.Length > 2 || hiddenOlderCount > 0;
            var scrollHintHeight = showScrollHint ? 34f : 0f;
            var contentHeight = Mathf.Max(viewportHeight, 36f + scrollHintHeight + bubbleHeights.Sum() + pendingBubbleHeight + Mathf.Max(0, rowCount - 1) * 14f);
            SetPrivateDialogueContentHeight(contentHeight);
            RenderPrivateDialogueLaneBackdrop(width, contentHeight);

            var yTop = contentHeight - 18f;
            if (showScrollHint)
            {
                var hint = hiddenOlderCount > 0
                    ? $"仅显示最近 {visibleEntries.Length}/{entries.Count} 条；完整历史在日志/时间线。"
                    : "当前停在最新消息；滚轮上滑查看较早对话。";
                var hintPanel = AddPanel("Private Dialogue Scroll Hint", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(14f, yTop - scrollHintHeight), new Vector2(width - 14f, yTop), new Color(0.036f, 0.046f, 0.052f, 0.72f));
                AddFrame(hintPanel.transform, "Private Dialogue Scroll Hint Frame", 0.6f, new Color(0.62f, 0.78f, 0.92f, 0.18f));
                AddText("Private Dialogue Scroll Hint Text", hintPanel.transform, Vector2.zero, Vector2.one, new Vector2(14f, 2f), new Vector2(-14f, -2f), hint, 12, TextAnchor.MiddleCenter, FontStyle.Normal).color = new Color(0.82f, 0.88f, 0.90f, 0.88f);
                yTop -= scrollHintHeight + 14f;
            }
            const float laneInset = 64f;
            for (var i = 0; i < visibleEntries.Length; i++)
            {
                var item = visibleEntries[i];
                var fromHuman = !string.IsNullOrWhiteSpace(humanId) && item.speakerId == humanId;
                var isLatestVisible = i == visibleEntries.Length - 1 && !showPending;
                var bubbleWidth = Mathf.Min(fromHuman ? 600f : 660f, width * 0.70f);
                var x = fromHuman ? width - bubbleWidth - laneInset : laneInset;
                var bubbleHeight = bubbleHeights[i];
                var color = fromHuman
                    ? new Color(0.18f, 0.090f, 0.032f, 0.86f)
                    : new Color(0.018f, 0.032f, 0.046f, 0.86f);
                var border = fromHuman
                    ? new Color(0.95f, 0.68f, 0.34f, 0.36f)
                    : new Color(0.62f, 0.78f, 0.92f, 0.22f);
                AddPrivateDialogueTurnCue(width, yTop, bubbleHeight, fromHuman, i, x, bubbleWidth);
                var bubble = AddPanel($"Private Bubble {i}", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(x, yTop - bubbleHeight), new Vector2(x + bubbleWidth, yTop), color);
                AddFrame(bubble.transform, "Private Bubble Frame", 0.8f, border);
                var speaker = fromHuman ? "你" : NameForPlayerId(item.speakerId);
                var intentLabel = PrivateBubbleIntentLabel(item.intent);
                var speakerLine = $"{i + 1}/{visibleEntries.Length} · {speaker} · {TimelineStamp(item)}{(string.IsNullOrWhiteSpace(intentLabel) ? "" : $" · {intentLabel}")}";
                AddText("Bubble Speaker", bubble.transform, Vector2.zero, Vector2.one, new Vector2(14f, bubbleHeight - 28f), new Vector2(-14f, -6f), Ellipsize(speakerLine, 42), 12, fromHuman ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Bold).color = fromHuman ? new Color(1f, 0.78f, 0.38f, 0.94f) : new Color(0.70f, 0.84f, 0.96f, 0.92f);
                var contextText = PrivateBubbleContextText(item);
                var contextHeight = PrivateBubbleContextHeight(contextText);
                var text = WrapUiTextBlock(item.text, fromHuman ? 34 : 36);
                var label = AddText("Bubble Text", bubble.transform, Vector2.zero, Vector2.one, new Vector2(14f, contextHeight > 0f ? contextHeight + 14f : 12f), new Vector2(-14f, -34f), text, 14, fromHuman ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Normal);
                label.color = new Color(0.96f, 0.91f, 0.82f, 0.98f);
                if (contextHeight > 0f)
                {
                    AddPrivateBubbleContextRail(bubble.transform, item, contextText, bubbleWidth, contextHeight, fromHuman);
                }
                yTop -= bubbleHeight + 14f;
            }
            if (showPending) RenderPrivatePendingBubble(width, yTop, pendingBubbleHeight);
            if (privateDialogueScroll != null) privateDialogueScroll.verticalNormalizedPosition = 0f;
        }

        private void RenderPrivateDialogueStageBanner(PlayerViewModel target)
        {
            if (privateDialogueStageBannerRoot == null) return;
            ClearChildren(privateDialogueStageBannerRoot);
            privateDialogueStageBannerRoot.gameObject.SetActive(true);
            var entries = target == null ? new List<TimelineEntryViewModel>() : PrivateTimelineEntriesForSelected();
            var entryCount = entries.Count;
            var showPending = target != null && IsPendingPrivateChatForTarget(target);
            var hiddenOlderCount = Mathf.Max(0, entryCount - PrivateDialogueMaxRenderedEntries);
            var accent = target == null
                ? new Color(0.58f, 0.74f, 0.94f, 0.48f)
                : showPending ? new Color(1f, 0.72f, 0.30f, 0.58f) : PrivateTargetPressureAccent(target);
            var background = privateDialogueStageBannerRoot.GetComponent<Image>();
            if (background != null) background.color = new Color(0.006f, 0.014f, 0.022f, 0.64f);
            AddFrame(privateDialogueStageBannerRoot, "Private Dialogue Stage Banner Frame", 0.65f, new Color(accent.r, accent.g, accent.b, 0.22f));
            AddImage("Private Dialogue Stage Accent", privateDialogueStageBannerRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(accent.r, accent.g, accent.b, 0.50f));
            var title = target == null ? "你 -> 未选目标" : $"你 -> {target.seat}号 {target.name}";
            AddText("Private Dialogue Stage Label", privateDialogueStageBannerRoot, Vector2.zero, Vector2.one, new Vector2(14f, 20f), new Vector2(-520f, -3f), "私聊舞台", 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.94f);
            AddText("Private Dialogue Stage Title", privateDialogueStageBannerRoot, Vector2.zero, Vector2.one, new Vector2(14f, 3f), new Vector2(-430f, -17f), Ellipsize(title, 26), 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.96f, 0.91f, 0.82f, 0.98f);
            AddText("Private Dialogue Stage Meta", privateDialogueStageBannerRoot, Vector2.zero, Vector2.one, new Vector2(360f, 20f), new Vector2(-176f, -3f), PrivateDialogueStageMetaLabel(target, entryCount, showPending, hiddenOlderCount), 10, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.72f, 0.84f, 0.90f, 0.86f);

            var bannerWidth = Mathf.Max(300f, privateDialogueStageBannerRoot.rect.width > 10f ? privateDialogueStageBannerRoot.rect.width : 1030f);
            AddImage("Private Dialogue Stage Track", privateDialogueStageBannerRoot, Vector2.zero, Vector2.zero, new Vector2(bannerWidth - 150f, 21f), new Vector2(bannerWidth - 54f, 24f), new Color(accent.r, accent.g, accent.b, 0.26f));
            var humanNode = AddCircleImage("Private Dialogue Stage Human Node", privateDialogueStageBannerRoot, 9f, new Color(0.95f, 0.68f, 0.34f, 0.70f), false);
            humanNode.rectTransform.anchoredPosition = new Vector2(bannerWidth - 158f, 25f);
            var targetNode = AddCircleImage("Private Dialogue Stage Target Node", privateDialogueStageBannerRoot, 9f, new Color(0.62f, 0.78f, 0.92f, target == null ? 0.38f : 0.70f), false);
            targetNode.rectTransform.anchoredPosition = new Vector2(bannerWidth - 46f, 25f);
            AddText("Private Dialogue Stage Human Label", privateDialogueStageBannerRoot, Vector2.zero, Vector2.one, new Vector2(bannerWidth - 176f, 3f), new Vector2(-124f, -22f), "你", 9, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.86f, 0.54f, 0.88f);
            AddText("Private Dialogue Stage Target Label", privateDialogueStageBannerRoot, Vector2.zero, Vector2.one, new Vector2(bannerWidth - 74f, 3f), new Vector2(-18f, -22f), target == null ? "目标" : $"{target.seat}号", 9, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.82f, 0.92f, 1f, 0.88f);
        }

        private static string PrivateDialogueStageMetaLabel(PlayerViewModel target, int entryCount, bool showPending, int hiddenOlderCount)
        {
            if (target == null) return "选择目标建立私聊线";
            var count = entryCount <= 0 ? "暂无记录" : $"{entryCount} 条";
            var pending = showPending ? " · 等回应" : " · 已同步";
            var hidden = hiddenOlderCount > 0 ? $" · 隐藏 {hiddenOlderCount} 条旧记录" : "";
            return $"{count}{pending}{hidden}";
        }

        private void RenderPrivateDialogueLaneBackdrop(float width, float contentHeight)
        {
            if (privateDialogueRoot == null) return;
            var laneWidth = 50f;
            AddPanel("Private Dialogue Lane Backdrop", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(0f, 0f), new Vector2(width, contentHeight), new Color(0.002f, 0.006f, 0.010f, 0.12f));
            AddPanel("Private Dialogue Inbound Lane", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(0f, 8f), new Vector2(laneWidth, contentHeight - 8f), new Color(0.018f, 0.036f, 0.050f, 0.18f));
            AddPanel("Private Dialogue Outbound Lane", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(width - laneWidth, 8f), new Vector2(width, contentHeight - 8f), new Color(0.15f, 0.075f, 0.026f, 0.14f));
            AddPanel("Private Dialogue Inbound Lane Rule", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(laneWidth, 10f), new Vector2(laneWidth + 1.5f, contentHeight - 10f), new Color(0.62f, 0.78f, 0.92f, 0.18f));
            AddPanel("Private Dialogue Outbound Lane Rule", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(width - laneWidth - 1.5f, 10f), new Vector2(width - laneWidth, contentHeight - 10f), new Color(0.95f, 0.68f, 0.34f, 0.20f));
        }

        private void AddPrivateDialogueTurnCue(float width, float yTop, float bubbleHeight, bool fromHuman, int index, float bubbleX, float bubbleWidth)
        {
            if (privateDialogueRoot == null) return;
            var markerX = fromHuman ? width - 21f : 21f;
            var markerY = yTop - Mathf.Min(30f, bubbleHeight * 0.36f);
            var accent = fromHuman ? new Color(0.95f, 0.68f, 0.34f, 0.54f) : new Color(0.62f, 0.78f, 0.92f, 0.48f);
            var stemStart = fromHuman ? bubbleX + bubbleWidth + 4f : markerX + 14f;
            var stemEnd = fromHuman ? markerX - 14f : bubbleX - 4f;
            if (stemEnd > stemStart)
            {
                AddPanel($"Private Dialogue Turn Stem {index}", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(stemStart, markerY - 1f), new Vector2(stemEnd, markerY + 1f), accent);
            }
            var ring = AddCircleImage($"Private Dialogue Turn Ring {index}", privateDialogueRoot, 9f, accent, true);
            ring.rectTransform.anchoredPosition = new Vector2(markerX, markerY);
            var dot = AddCircleImage($"Private Dialogue Turn Dot {index}", privateDialogueRoot, 4f, fromHuman ? new Color(1f, 0.78f, 0.38f, 0.92f) : new Color(0.70f, 0.84f, 0.96f, 0.88f), false);
            dot.rectTransform.anchoredPosition = new Vector2(markerX, markerY);
            var tagX = fromHuman ? markerX - 38f : markerX + 14f;
            var tag = AddPanel($"Private Dialogue Turn Tag {index}", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(tagX, markerY - 9f), new Vector2(tagX + 24f, markerY + 9f), fromHuman ? new Color(0.18f, 0.090f, 0.032f, 0.74f) : new Color(0.018f, 0.032f, 0.046f, 0.74f));
            AddFrame(tag.transform, "Private Dialogue Turn Tag Frame", 0.45f, accent);
            AddText("Private Dialogue Turn Tag Text", tag.transform, Vector2.zero, Vector2.one, new Vector2(2f, 0f), new Vector2(-2f, 0f), fromHuman ? "发" : "收", 10, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.96f, 0.91f, 0.82f, 0.94f);
        }

        private void RenderPrivatePendingBubble(float width, float yTop, float bubbleHeight)
        {
            var timedOut = PendingActionTimedOut();
            var bubbleWidth = timedOut ? 600f : 500f;
            var x = (width - bubbleWidth) * 0.5f;
            var color = timedOut ? new Color(0.26f, 0.060f, 0.036f, 0.88f) : new Color(0.16f, 0.120f, 0.040f, 0.88f);
            var border = timedOut ? new Color(1f, 0.36f, 0.26f, 0.58f) : new Color(1f, 0.76f, 0.32f, 0.42f);
            var bubble = AddPanel("Private Pending Bubble", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(x, yTop - bubbleHeight), new Vector2(x + bubbleWidth, yTop), color);
            AddFrame(bubble.transform, "Private Pending Bubble Frame", 0.8f, border);
            var dots = new string('.', 1 + Mathf.FloorToInt(PendingActionElapsed() * 2f) % 3);
            var text = timedOut
                ? $"仍在等待回复；语言模型润色中 {PendingActionElapsed():0.0}s"
                : $"等待对方回应{dots} {PendingActionElapsed():0.0}s";
            var label = AddText("Private Pending Text", bubble.transform, Vector2.zero, Vector2.one, new Vector2(12f, 4f), new Vector2(-12f, -4f), text, 14, TextAnchor.MiddleCenter, FontStyle.Bold);
            label.color = timedOut ? new Color(1f, 0.78f, 0.64f, 1f) : new Color(1f, 0.88f, 0.52f, 1f);
        }

        private static float PrivateBubbleHeight(TimelineEntryViewModel item, int maxCharsPerLine)
        {
            var lines = WrappedUiLineCount(item?.text, maxCharsPerLine);
            return Mathf.Max(82f, 58f + lines * 23f + PrivateBubbleContextHeight(PrivateBubbleContextText(item)));
        }

        private static float PrivateBubbleContextHeight(string context)
        {
            if (string.IsNullOrWhiteSpace(context)) return 0f;
            return Mathf.Max(38f, 24f + WrappedUiLineCount(context, 38) * 16f);
        }

        private void AddPrivateBubbleContextRail(Transform parent, TimelineEntryViewModel item, string contextText, float bubbleWidth, float contextHeight, bool fromHuman)
        {
            var rail = AddPanel("Private Bubble Context", parent, Vector2.zero, Vector2.zero, new Vector2(12f, 10f), new Vector2(bubbleWidth - 12f, 10f + contextHeight), fromHuman ? new Color(0.10f, 0.055f, 0.030f, 0.70f) : new Color(0.020f, 0.040f, 0.052f, 0.74f));
            AddFrame(rail.transform, "Private Bubble Context Frame", 0.6f, fromHuman ? new Color(0.95f, 0.68f, 0.34f, 0.20f) : new Color(0.62f, 0.78f, 0.92f, 0.18f));
            AddImage("Private Bubble Context Accent", rail.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), PrivateBubbleContextAccent(item));
            var badge = AddPanel("Private Bubble Context Badge", rail.transform, Vector2.zero, Vector2.one, new Vector2(12f, contextHeight - 26f), new Vector2(60f, -8f), PrivateBubbleContextAccent(item));
            AddFrame(badge.transform, "Private Bubble Context Badge Frame", 0.5f, new Color(1f, 0.88f, 0.68f, 0.18f));
            AddText("Private Bubble Context Badge Text", badge.transform, Vector2.zero, Vector2.one, new Vector2(3f, 0f), new Vector2(-3f, 0f), PrivateBubbleContextBadge(item), 10, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.92f, 0.72f, 0.96f);
            var text = AddText("Private Bubble Context Text", rail.transform, Vector2.zero, Vector2.one, new Vector2(72f, 6f), new Vector2(-12f, -6f), ClampTextBlock(contextText, 2, 38), 11, TextAnchor.MiddleLeft, FontStyle.Normal);
            text.color = new Color(0.88f, 0.92f, 0.88f, 0.90f);
        }

        private static Color PrivateBubbleContextAccent(TimelineEntryViewModel item)
        {
            var badge = PrivateBubbleContextBadge(item);
            if (badge == "口径") return new Color(0.54f, 0.82f, 0.64f, 0.52f);
            if (badge == "理由") return new Color(0.92f, 0.68f, 0.30f, 0.52f);
            if (badge == "追问") return new Color(0.74f, 0.56f, 0.92f, 0.48f);
            return new Color(0.58f, 0.74f, 0.94f, 0.44f);
        }

        private static string PrivateBubbleContextBadge(TimelineEntryViewModel item)
        {
            if (item?.claimDisclosureRationale != null) return "口径";
            if (!string.IsNullOrWhiteSpace(item?.rationaleSummary)) return "理由";
            if (!string.IsNullOrWhiteSpace(item?.questionToAsk)) return "追问";
            return "线索";
        }

        private static string PrivateBubbleContextText(TimelineEntryViewModel item)
        {
            if (item == null) return "";
            var claim = item.claimDisclosureRationale;
            var claimLine = FirstNonEmpty(claim?.continuitySummary, claim?.continuityLine, claim?.spokenLine, claim?.line);
            var line = FirstNonEmpty(item.rationaleSummary, claimLine, item.evidenceSummary, item.questionToAsk);
            if (string.IsNullOrWhiteSpace(line)) return "";
            return line.Trim();
        }

        private static string PrivateBubbleIntentLabel(string intent)
        {
            if (string.IsNullOrWhiteSpace(intent)) return "";
            if (intent == "claim") return "身份";
            if (intent == "reason") return "理由";
            if (intent == "night") return "夜间";
            if (intent == "vote") return "票意";
            if (intent == "trust") return "保密";
            if (intent == "focus") return "焦点";
            return intent;
        }

        private static string WrapUiTextBlock(string value, int maxCharsPerLine)
        {
            var lines = new List<string>();
            foreach (var raw in (value ?? "").Split('\n'))
            {
                var wrapped = WrapDialogueLine(raw, maxCharsPerLine).ToArray();
                if (wrapped.Length == 0) lines.Add("");
                else lines.AddRange(wrapped);
            }
            return string.Join("\n", lines);
        }

        private static int WrappedUiLineCount(string value, int maxCharsPerLine)
        {
            var wrapped = WrapUiTextBlock(value, maxCharsPerLine);
            if (string.IsNullOrWhiteSpace(wrapped)) return 1;
            return Mathf.Max(1, wrapped.Split('\n').Length);
        }

        private void SetPrivateDialogueContentHeight(float height)
        {
            if (privateDialogueRoot == null) return;
            privateDialogueRoot.anchorMin = new Vector2(0f, 1f);
            privateDialogueRoot.anchorMax = new Vector2(1f, 1f);
            privateDialogueRoot.pivot = new Vector2(0.5f, 1f);
            privateDialogueRoot.offsetMin = new Vector2(0f, -height);
            privateDialogueRoot.offsetMax = Vector2.zero;
        }

        private void RenderPrivateTargetCard(PlayerViewModel target)
        {
            if (privateTargetCardRoot == null) return;
            for (var i = privateTargetCardRoot.childCount - 1; i >= 0; i--) Destroy(privateTargetCardRoot.GetChild(i).gameObject);

            AddFrame(privateTargetCardRoot, "Private Target Card Frame", 0.9f, new Color(0.92f, 0.62f, 0.28f, 0.30f));
            AddImage("Private Target Card Glow", privateTargetCardRoot, new Vector2(0f, 0.52f), new Vector2(1f, 1f), new Vector2(8f, -8f), new Vector2(-8f, -8f), new Color(1f, 0.76f, 0.36f, 0.055f));
            var compactTargetCard = true;
            if (compactTargetCard)
            {
                RenderCompactPrivateTargetCard(target);
                return;
            }
            RenderPrivateTargetPortraitStage(target);

            if (target == null)
            {
                AddText("Private Target Card Title", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(18f, 416f), new Vector2(-18f, -18f), "未选择", 24, TextAnchor.UpperLeft, FontStyle.Bold);
                var unknown = AddImage("Private Target Unknown Token", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(42f, 218f), new Vector2(-42f, -98f), new Color(0.86f, 0.78f, 0.62f, 0.78f));
                unknown.sprite = SpriteFromResource("Botc/ui/vote1") ?? GetCircleFillSprite();
                unknown.preserveAspect = true;
                AddText("Private Target Unknown Mark", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(70f, 250f), new Vector2(-70f, -132f), "?", 56, TextAnchor.MiddleCenter, FontStyle.Bold);
                AddText("Private Target Empty Hint", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(22f, 96f), new Vector2(-22f, -312f), "先选择一名玩家，再开始私聊。", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
                AddPrivateTargetChip(privateTargetCardRoot, "等待选择", new Vector2(122f, 42f), new Vector2(140f, 28f), new Color(0.12f, 0.065f, 0.030f, 0.78f), new Color(0.94f, 0.68f, 0.34f, 0.30f));
                return;
            }

            AddText("Private Target Card Title", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(18f, 416f), new Vector2(-18f, -18f), $"{target.seat}号", 28, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Private Target Card Subtitle", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(78f, 420f), new Vector2(-132f, -24f), "私密频道", 13, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.72f, 0.80f, 0.84f, 0.82f);
            AddPrivateTargetChip(privateTargetCardRoot, $"{target.suspicion}%", new Vector2(222f, 424f), new Vector2(66f, 24f), new Color(0.035f, 0.048f, 0.060f, 0.82f), new Color(0.62f, 0.78f, 0.92f, 0.26f));

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
            AddPrivateTargetChip(privateTargetCardRoot, target.alive ? "存活" : "死亡", new Vector2(66f, 74f), new Vector2(76f, 26f), target.alive ? new Color(0.040f, 0.115f, 0.070f, 0.82f) : new Color(0.12f, 0.035f, 0.030f, 0.84f), target.alive ? new Color(0.48f, 0.86f, 0.58f, 0.30f) : new Color(1f, 0.42f, 0.28f, 0.36f));
            AddPrivateTargetChip(privateTargetCardRoot, PrivateThreadCountLabel(target), new Vector2(166f, 74f), new Vector2(112f, 26f), new Color(0.035f, 0.048f, 0.060f, 0.82f), new Color(0.62f, 0.78f, 0.92f, 0.22f));
            AddPrivateTargetChip(privateTargetCardRoot, PrivateThreadStateLabel(target), new Vector2(122f, 38f), new Vector2(164f, 26f), PrivateThreadStateFill(target), PrivateThreadStateBorder(target));
        }

        private void RenderCompactPrivateTargetCard(PlayerViewModel target)
        {
            if (privateTargetCardRoot == null) return;
            if (target == null)
            {
                AddText("Private Target Compact Title", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(16f, 510f), new Vector2(-16f, -18f), "未选择", 22, TextAnchor.UpperLeft, FontStyle.Bold);
                AddText("Private Target Compact Hint", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(16f, 382f), new Vector2(-16f, -92f), "先点一名玩家，再开始私聊。", 15, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.80f, 0.88f, 0.92f, 0.86f);
                AddPrivateTargetChip(privateTargetCardRoot, "等待选择", new Vector2(100f, 44f), new Vector2(148f, 28f), new Color(0.12f, 0.065f, 0.030f, 0.78f), new Color(0.94f, 0.68f, 0.34f, 0.30f));
                return;
            }

            AddText("Private Target Compact Title", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(16f, 510f), new Vector2(-16f, -18f), $"{target.seat}号", 26, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Private Target Compact Subtitle", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(16f, 468f), new Vector2(-16f, -58f), target.name, 18, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.92f, 0.84f, 0.72f, 0.96f);
            AddText("Private Target Compact Role", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(16f, 434f), new Vector2(-16f, -92f), PrivateRoleDisplay(target), 14, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.78f, 0.86f, 0.90f, 0.88f);

            var token = AddImage("Private Target Compact Token", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(42f, 270f), new Vector2(-42f, -210f), new Color(0.92f, 0.82f, 0.60f, 0.86f));
            token.sprite = SpriteFromResource(target.revealed ? "Botc/ui/token1" : "Botc/ui/vote1") ?? GetCircleFillSprite();
            token.preserveAspect = true;
            if (target.revealed && !string.IsNullOrWhiteSpace(target.roleId))
            {
                var roleIcon = AddImage("Private Target Compact Role Icon", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(72f, 296f), new Vector2(-72f, -236f), Color.white);
                roleIcon.sprite = SpriteFromResource($"Botc/roles/{target.roleId}");
                roleIcon.preserveAspect = true;
                if (roleIcon.sprite == null) roleIcon.color = new Color(1f, 1f, 1f, 0f);
            }
            else
            {
                AddText("Private Target Compact Unknown Role", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(68f, 292f), new Vector2(-68f, -232f), "?", 42, TextAnchor.MiddleCenter, FontStyle.Bold);
            }

            AddPrivateTargetChip(privateTargetCardRoot, target.alive ? "存活" : "死亡", new Vector2(60f, 164f), new Vector2(76f, 26f), target.alive ? new Color(0.040f, 0.115f, 0.070f, 0.82f) : new Color(0.12f, 0.035f, 0.030f, 0.84f), target.alive ? new Color(0.48f, 0.86f, 0.58f, 0.30f) : new Color(1f, 0.42f, 0.28f, 0.36f));
            AddPrivateTargetChip(privateTargetCardRoot, PrivateThreadCountLabel(target), new Vector2(142f, 164f), new Vector2(90f, 26f), new Color(0.035f, 0.048f, 0.060f, 0.82f), new Color(0.62f, 0.78f, 0.92f, 0.22f));
            AddPrivateTargetChip(privateTargetCardRoot, PrivateThreadStateLabel(target), new Vector2(100f, 126f), new Vector2(148f, 26f), PrivateThreadStateFill(target), PrivateThreadStateBorder(target));
        }

        private void RenderPrivateTargetPortraitStage(PlayerViewModel target)
        {
            if (privateTargetCardRoot == null) return;
            var accent = PrivateTargetPressureAccent(target);
            var stage = AddPanel("Private Target Portrait Stage", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(22f, 182f), new Vector2(-22f, -74f), target == null ? new Color(0.018f, 0.024f, 0.030f, 0.48f) : new Color(0.020f, 0.028f, 0.036f, 0.56f));
            AddFrame(stage.transform, "Private Target Portrait Stage Frame", 0.75f, new Color(accent.r, accent.g, accent.b, 0.22f));
            AddImage("Private Target Portrait Stage Wash", stage.transform, new Vector2(0f, 0.58f), Vector2.one, new Vector2(2f, -2f), new Vector2(-2f, -2f), new Color(accent.r, accent.g, accent.b, target == null ? 0.035f : 0.060f));
            var aura = AddCircleImage("Private Target Portrait Aura", privateTargetCardRoot, 140f, new Color(accent.r, accent.g, accent.b, target == null ? 0.050f : 0.090f), false);
            aura.rectTransform.anchoredPosition = new Vector2(0f, 56f);
            var halo = AddCircleImage("Private Target Portrait Halo", privateTargetCardRoot, 148f, new Color(accent.r, accent.g, accent.b, target == null ? 0.18f : 0.30f), true);
            halo.rectTransform.anchoredPosition = new Vector2(0f, 56f);
            var inner = AddCircleImage("Private Target Portrait Inner Ring", privateTargetCardRoot, 118f, new Color(1f, 0.86f, 0.56f, target == null ? 0.10f : 0.16f), true);
            inner.rectTransform.anchoredPosition = new Vector2(0f, 56f);
            AddImage("Private Target Spotlight Floor", privateTargetCardRoot, Vector2.zero, Vector2.one, new Vector2(68f, 184f), new Vector2(-68f, -352f), new Color(accent.r, accent.g, accent.b, target == null ? 0.050f : 0.080f));
        }

        private static Color PrivateTargetPressureAccent(PlayerViewModel target)
        {
            if (target == null) return new Color(0.70f, 0.82f, 0.92f, 1f);
            if (target.suspicion >= 65) return new Color(1f, 0.38f, 0.26f, 1f);
            if (target.suspicion >= 35) return new Color(1f, 0.72f, 0.30f, 1f);
            return new Color(0.58f, 0.82f, 0.70f, 1f);
        }

        private string PrivateThreadCountLabel(PlayerViewModel target)
        {
            if (target == null) return "暂无记录";
            var count = PrivateTimelineEntriesForSelected().Count;
            if (count <= 0) return "暂无记录";
            return $"最近 {count} 条";
        }

        private string PrivateThreadStateLabel(PlayerViewModel target)
        {
            if (target == null) return "未选择";
            if (IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut() ? "等待过久" : "等待回应";
            var entries = PrivateTimelineEntriesForSelected();
            if (entries.Count == 0) return "尚未开口";
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            var latest = entries[entries.Count - 1];
            return !string.IsNullOrWhiteSpace(humanId) && latest.speakerId == humanId ? "你刚发言" : "对方已回应";
        }

        private Color PrivateThreadStateFill(PlayerViewModel target)
        {
            if (target != null && IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut()
                ? new Color(0.26f, 0.060f, 0.036f, 0.86f)
                : new Color(0.16f, 0.120f, 0.040f, 0.84f);
            var entries = target == null ? new List<TimelineEntryViewModel>() : PrivateTimelineEntriesForSelected();
            if (entries.Count == 0) return new Color(0.12f, 0.065f, 0.030f, 0.78f);
            return new Color(0.020f, 0.070f, 0.055f, 0.82f);
        }

        private Color PrivateThreadStateBorder(PlayerViewModel target)
        {
            if (target != null && IsPendingPrivateChatForTarget(target)) return PendingActionTimedOut()
                ? new Color(1f, 0.36f, 0.26f, 0.58f)
                : new Color(1f, 0.76f, 0.32f, 0.42f);
            var entries = target == null ? new List<TimelineEntryViewModel>() : PrivateTimelineEntriesForSelected();
            if (entries.Count == 0) return new Color(0.94f, 0.68f, 0.34f, 0.30f);
            return new Color(0.48f, 0.86f, 0.58f, 0.32f);
        }

        private void AddPrivateTargetChip(Transform parent, string label, Vector2 center, Vector2 size, Color fill, Color border)
        {
            var half = size * 0.5f;
            var chip = AddPanel($"Private Target Chip {label}", parent, Vector2.zero, Vector2.zero, center - half, center + half, fill);
            AddFrame(chip.transform, "Private Target Chip Frame", 0.65f, border);
            AddText("Private Target Chip Text", chip.transform, Vector2.zero, Vector2.one, new Vector2(4f, 0f), new Vector2(-4f, 0f), label, 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.96f, 0.91f, 0.82f, 0.96f);
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
            selectionPulseStartTime = Time.realtimeSinceStartup;
            if (!string.IsNullOrWhiteSpace(selectedPlayerId))
            {
                SendUnityAction("select-token", selectedPlayerId, "", "", "", trackPending: false);
                privateChatStatus = $"已选择 {NameForPlayerId(selectedPlayerId)}；可以询问身份或发送私聊。";
            }
            RenderGrimoire();
            UpdateTokenInspectorText();
            UpdatePrivateChatPanelText();
        }

        private void SendPrivateClaimQuestion()
        {
            if (SelectedPrivateChatTarget() == null)
            {
                dialogueTitle.text = "私聊：询问身份";
                dialogueBody.text = "请先点击一名非主视角玩家。";
                return;
            }
            if (!SendUnityAction("private-chat", selectedPlayerId, "", "你是什么身份？", "claim")) return;
            privateChatStatus = $"已询问 {NameForPlayerId(selectedPlayerId)} 的身份，等待对方回应。";
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
            if (!SendUnityAction("private-chat", selectedPlayerId, "", question, intent)) return;
            privateChatStatus = $"已追问 {NameForPlayerId(selectedPlayerId)}，等待对方回应。";
            UpdatePrivateChatPanelText();
            dialogueTitle.text = "私聊：继续追问";
            dialogueBody.text = $"已发送：{question}";
        }

        private void SendPrivatePanelMessage()
        {
            if (SelectedPrivateChatTarget() == null)
            {
                dialogueTitle.text = "私聊发送";
                dialogueBody.text = "请先点击一名非主视角玩家。";
                return;
            }
            var claimRoleId = SelectedPrivateClaimRoleId();
            var nightInfo = privateNightInput == null ? "" : privateNightInput.text.Trim();
            var askSecret = privateSecretToggle != null && privateSecretToggle.isOn;
            var intent = !string.IsNullOrWhiteSpace(claimRoleId) ? "claim" : !string.IsNullOrWhiteSpace(nightInfo) ? "night" : askSecret ? "trust" : "generic";
            var line = askSecret ? "这条信息先只在我们之间对齐。" : "我想和你私下交换一下信息。";
            if (!SendUnityAction("private-chat", selectedPlayerId, "", line, intent, claimRoleId: claimRoleId, nightInfo: nightInfo, askSecret: askSecret)) return;
            privateChatStatus = $"已发送给 {NameForPlayerId(selectedPlayerId)}；等待对方回应。";
            UpdatePrivateChatPanelText();
            dialogueTitle.text = "私聊已发送";
            dialogueBody.text = "已发送私聊内容。底部保持简短，后续回复请看私聊面板或时间线。";
        }
    }
}
