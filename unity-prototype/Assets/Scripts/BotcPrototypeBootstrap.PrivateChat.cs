using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private void BuildPrivateChatPanel()
        {
            privateChatPanel = AddPanel("Private Chat Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-760f, 90f), new Vector2(760f, 860f), new Color(0.005f, 0.012f, 0.020f, 0.94f)).GetComponent<RectTransform>();
            AddFrame(privateChatPanel, "Private Chat Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.38f));
            AddImage("Private Chat Header Wash", privateChatPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -82f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.075f));
            AddText("Private Chat Title", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(30f, 710f), new Vector2(-30f, -14f), "私聊", 34, TextAnchor.UpperLeft, FontStyle.Bold);
            var privacyPill = AddPanel("Private Chat Privacy Pill", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(1222f, 698f), new Vector2(-112f, -28f), new Color(0.020f, 0.036f, 0.048f, 0.68f));
            AddFrame(privacyPill.transform, "Private Chat Privacy Pill Frame", 0.8f, new Color(0.62f, 0.78f, 0.92f, 0.32f));
            AddText("Private Chat Privacy Pill", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(1240f, 716f), new Vector2(-112f, -22f), "不会进入公聊", 14, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.88f, 0.93f, 0.96f, 0.96f);
            AddText("Private Chat Hint", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(1330f, 720f), new Vector2(-148f, -24f), "", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddToolActionButton("关", "关闭", privateChatPanel, new Vector2(1450f, 724f), new Vector2(104f, 34f), ClosePrivateChatPanel, true);
            privateTargetText = AddText("Private Target", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(32f, 668f), new Vector2(-30f, -78f), "目标：未选择", 20, TextAnchor.UpperLeft, FontStyle.Normal);

            privateTargetCardRoot = AddPanel("Private Target Card", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(30f, 86f), new Vector2(-1160f, -126f), new Color(0.020f, 0.028f, 0.036f, 0.34f)).GetComponent<RectTransform>();

            var privateHistoryWash = AddImage("Private History Wash", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(388f, 310f), new Vector2(-34f, -128f), new Color(0.020f, 0.028f, 0.036f, 0.34f));
            AddFrame(privateHistoryWash.transform, "Private History Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.22f));
            AddText("Private History Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(414f, 600f), new Vector2(-58f, -132f), "对话记录", 20, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Private History Meta", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(548f, 602f), new Vector2(-58f, -134f), "滚轮查看更早内容", 13, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.72f, 0.80f, 0.84f, 0.82f);
            privateHistoryText = AddText("Private History Text", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(414f, 548f), new Vector2(-58f, -186f), "选择一名玩家后显示最近私聊。", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            privateHistoryText.color = new Color(0.90f, 0.84f, 0.72f, 0.96f);
            privateHistoryText.gameObject.SetActive(false);
            var privateDialogueScrollRoot = AddPanel("Private Dialogue Scroll", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(414f, 332f), new Vector2(-58f, -188f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
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

            var composeWash = AddImage("Private Compose Wash", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(388f, 86f), new Vector2(-34f, -486f), new Color(0.020f, 0.028f, 0.036f, 0.30f));
            AddFrame(composeWash.transform, "Private Compose Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            AddText("Private Compose Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(414f, 250f), new Vector2(-58f, -504f), "本次私聊", 19, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Private Followup Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(526f, 252f), new Vector2(-58f, -506f), "继续追问", 13, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.72f, 0.80f, 0.84f, 0.82f);
            AddButton("大概身份", privateChatPanel, new Vector2(670f, 238f), new Vector2(118f, 30f), () => SendPrivateQuickQuestion("你愿意先给个大概身份吗？", "claim"));
            AddButton("能自证吗", privateChatPanel, new Vector2(800f, 238f), new Vector2(108f, 30f), () => SendPrivateQuickQuestion("你有什么别人能对得上的信息吗？", "reason"));
            AddButton("昨晚信息", privateChatPanel, new Vector2(932f, 238f), new Vector2(118f, 30f), () => SendPrivateQuickQuestion("你昨晚得到了什么信息？", "night"));
            AddButton("提名意向", privateChatPanel, new Vector2(1078f, 238f), new Vector2(128f, 30f), () => SendPrivateQuickQuestion("你现在想提名谁？", "vote"));
            AddText("Claim Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(414f, 196f), new Vector2(-1018f, -558f), "声称", 16, TextAnchor.UpperLeft, FontStyle.Bold);
            privateClaimRoleText = AddText("Claim Role", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(476f, 194f), new Vector2(-628f, -558f), "不声称", 18, TextAnchor.UpperLeft, FontStyle.Normal);
            privateClaimRoleGridRoot = AddPanel("Private Claim Role Icon", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(1188f, 142f), new Vector2(-230f, -520f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            AddButton("‹", privateChatPanel, new Vector2(1308f, 204f), new Vector2(42f, 30f), () => CyclePrivateClaimRole(-1));
            AddButton("›", privateChatPanel, new Vector2(1362f, 204f), new Vector2(42f, 30f), () => CyclePrivateClaimRole(1));
            AddText("Night Info Label", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(414f, 146f), new Vector2(-1018f, -608f), "夜间说法", 16, TextAnchor.UpperLeft, FontStyle.Bold);
            privateNightInput = AddInputField("Private Night Input", privateChatPanel, new Vector2(520f, 132f), new Vector2(1160f, 176f), "例如：我昨晚看到 3 号和 7 号不同阵营");
            privateSecretToggle = AddToggle("Private Secret Toggle", privateChatPanel, new Vector2(414f, 94f), "请求对方暂时保密");
            privateStatusText = AddText("Private Status", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(414f, 46f), new Vector2(-540f, -684f), "准备发送。", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            privateStatusText.color = new Color(0.82f, 0.88f, 0.90f, 0.90f);
            AddButton("询问身份", privateChatPanel, new Vector2(1080f, 58f), new Vector2(132f, 40f), () => SendPrivateClaimQuestion());
            AddButton("发送私聊", privateChatPanel, new Vector2(1230f, 58f), new Vector2(142f, 40f), () => SendPrivatePanelMessage());
            AddButton("关闭", privateChatPanel, new Vector2(1370f, 58f), new Vector2(96f, 40f), ClosePrivateChatPanel);
            privateTargetPickerRoot = AddPanel("Private Target Picker", privateChatPanel, Vector2.zero, Vector2.one, new Vector2(388f, 86f), new Vector2(-34f, -126f), new Color(0.004f, 0.010f, 0.017f, 0.95f)).GetComponent<RectTransform>();
            PopulatePrivateClaimRoles();
            privateChatPanel.gameObject.SetActive(false);
        }

        private void ClosePrivateChatPanel()
        {
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            ApplyModalBackdropVisibility();
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
                return "暂时没有收到回复。请看左上同步状态，若持续超时可重启本局。";
            }
            return $"等待对方回应（{PendingActionElapsed():0.0}s）。";
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
                    : string.IsNullOrWhiteSpace(privateChatStatus) ? "准备发送；对方回复会出现在上方对话记录。" : privateChatStatus;
                privateStatusText.text = ClampTextBlock(status, 3, 26);
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
                AddBlankRoleTokenButton(privateClaimRoleGridRoot, hasTarget ? "选择" : "未选", new Vector2(48f, 44f), 46f, false, OpenPrivateClaimRolePicker);
                return;
            }
            AddRoleTokenButton(privateClaimRoleGridRoot, role.id, role.name, role.category, role.team, new Vector2(48f, 44f), 46f, true, OpenPrivateClaimRolePicker);
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
                AddText("Private Dialogue Empty", privateDialogueRoot, Vector2.zero, Vector2.one, new Vector2(18f, 72f), new Vector2(-18f, -72f), "选择一名玩家后，这里会显示最近私聊。", 16, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var entries = PrivateTimelineEntriesForSelected();
            var showPending = IsPendingPrivateChatForTarget(target);
            if (entries.Count == 0 && !showPending)
            {
                SetPrivateDialogueContentHeight(viewportHeight);
                AddText("Private Dialogue None", privateDialogueRoot, Vector2.zero, Vector2.one, new Vector2(18f, 72f), new Vector2(-18f, -72f), $"暂无与 {target.name} 的私聊记录。", 16, TextAnchor.MiddleCenter, FontStyle.Normal);
                AddText("Private Dialogue Prompt", privateDialogueRoot, Vector2.zero, Vector2.one, new Vector2(18f, 34f), new Vector2(-18f, -118f), "点击“询问身份”或发送本次私聊后，对话会刷新到这里。", 13, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var visibleEntries = entries.Skip(Mathf.Max(0, entries.Count - 12)).ToArray();
            var rowCount = visibleEntries.Length + (showPending ? 1 : 0);
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            var bubbleHeights = visibleEntries
                .Select((entry) => PrivateBubbleHeight(entry.text, !string.IsNullOrWhiteSpace(humanId) && entry.speakerId == humanId ? 34 : 36))
                .ToArray();
            var pendingBubbleHeight = showPending ? 58f : 0f;
            var contentHeight = Mathf.Max(viewportHeight, 36f + bubbleHeights.Sum() + pendingBubbleHeight + Mathf.Max(0, rowCount - 1) * 14f);
            SetPrivateDialogueContentHeight(contentHeight);

            var yTop = contentHeight - 18f;
            for (var i = 0; i < visibleEntries.Length; i++)
            {
                var item = visibleEntries[i];
                var fromHuman = !string.IsNullOrWhiteSpace(humanId) && item.speakerId == humanId;
                var bubbleWidth = Mathf.Min(fromHuman ? 600f : 660f, width * 0.74f);
                var x = fromHuman ? width - bubbleWidth - 14f : 14f;
                var bubbleHeight = bubbleHeights[i];
                var color = fromHuman
                    ? new Color(0.18f, 0.090f, 0.032f, 0.86f)
                    : new Color(0.018f, 0.032f, 0.046f, 0.86f);
                var border = fromHuman
                    ? new Color(0.95f, 0.68f, 0.34f, 0.36f)
                    : new Color(0.62f, 0.78f, 0.92f, 0.22f);
                var bubble = AddPanel($"Private Bubble {i}", privateDialogueRoot, Vector2.zero, Vector2.zero, new Vector2(x, yTop - bubbleHeight), new Vector2(x + bubbleWidth, yTop), color);
                AddFrame(bubble.transform, "Private Bubble Frame", 0.8f, border);
                var speaker = fromHuman ? "你" : NameForPlayerId(item.speakerId);
                var speakerLine = $"{speaker} · {TimelineStamp(item)}";
                AddText("Bubble Speaker", bubble.transform, Vector2.zero, Vector2.one, new Vector2(14f, bubbleHeight - 28f), new Vector2(-14f, -6f), speakerLine, 12, fromHuman ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Bold).color = fromHuman ? new Color(1f, 0.78f, 0.38f, 0.94f) : new Color(0.70f, 0.84f, 0.96f, 0.92f);
                var text = WrapUiTextBlock(item.text, fromHuman ? 34 : 36);
                var label = AddText("Bubble Text", bubble.transform, Vector2.zero, Vector2.one, new Vector2(14f, 12f), new Vector2(-14f, -34f), text, 14, fromHuman ? TextAnchor.UpperRight : TextAnchor.UpperLeft, FontStyle.Normal);
                label.color = new Color(0.96f, 0.91f, 0.82f, 0.98f);
                yTop -= bubbleHeight + 14f;
            }
            if (showPending) RenderPrivatePendingBubble(width, yTop, pendingBubbleHeight);
            if (privateDialogueScroll != null) privateDialogueScroll.verticalNormalizedPosition = 0f;
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
                ? "暂时没有收到回复；请留意左上同步状态。"
                : $"等待对方回应{dots} {PendingActionElapsed():0.0}s";
            var label = AddText("Private Pending Text", bubble.transform, Vector2.zero, Vector2.one, new Vector2(12f, 4f), new Vector2(-12f, -4f), text, 14, TextAnchor.MiddleCenter, FontStyle.Bold);
            label.color = timedOut ? new Color(1f, 0.78f, 0.64f, 1f) : new Color(1f, 0.88f, 0.52f, 1f);
        }

        private static float PrivateBubbleHeight(string value, int maxCharsPerLine)
        {
            var lines = WrappedUiLineCount(value, maxCharsPerLine);
            return Mathf.Max(82f, 58f + lines * 23f);
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
                dialogueBody.text = "请先点击一名非主视角玩家 token。";
                return;
            }
            SendUnityAction("private-chat", selectedPlayerId, "", "你是什么身份？", "claim");
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
            SendUnityAction("private-chat", selectedPlayerId, "", question, intent);
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
                dialogueBody.text = "请先点击一名非主视角玩家 token。";
                return;
            }
            var claimRoleId = SelectedPrivateClaimRoleId();
            var nightInfo = privateNightInput == null ? "" : privateNightInput.text.Trim();
            var askSecret = privateSecretToggle != null && privateSecretToggle.isOn;
            var intent = !string.IsNullOrWhiteSpace(claimRoleId) ? "claim" : !string.IsNullOrWhiteSpace(nightInfo) ? "night" : askSecret ? "trust" : "generic";
            var line = askSecret ? "这条信息先只在我们之间对齐。" : "我想和你私下交换一下信息。";
            SendUnityAction("private-chat", selectedPlayerId, "", line, intent, claimRoleId: claimRoleId, nightInfo: nightInfo, askSecret: askSecret);
            privateChatStatus = $"已发送给 {NameForPlayerId(selectedPlayerId)}；等待对方回应。";
            UpdatePrivateChatPanelText();
            dialogueTitle.text = "私聊已发送";
            dialogueBody.text = "已发送私聊内容。底部保持简短，后续回复请看私聊面板或时间线。";
        }
    }
}
