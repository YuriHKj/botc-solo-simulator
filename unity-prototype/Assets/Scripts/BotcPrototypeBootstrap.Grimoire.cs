using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {

        private void BuildGrimoire()
        {
            var board = AddPanel("Grimoire Board", canvas.transform, new Vector2(0.5f, 0.50f), new Vector2(0.5f, 0.50f), new Vector2(-920f, -472f), new Vector2(920f, 458f), new Color(0.36f, 0.32f, 0.24f, 0f));
            grimoireRoot = board.GetComponent<RectTransform>();
            AddFrame(board.transform, "Grimoire Soft Frame", 0.8f, new Color(0.85f, 0.66f, 0.34f, 0.026f));
        }


        private void BuildTokenInspectorPanel()
        {
            tokenInspectorPanel = AddPanel("Token Inspector", canvas.transform, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(190f, 180f), new Vector2(670f, 536f), new Color(0.005f, 0.012f, 0.020f, 0.90f)).GetComponent<RectTransform>();
            AddFrame(tokenInspectorPanel, "Token Inspector Frame", 1f, new Color(0.92f, 0.62f, 0.28f, 0.32f));
            AddImage("Token Inspector Header Wash", tokenInspectorPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -78f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            AddImage("Token Inspector Body Wash", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(18f, 68f), new Vector2(-18f, -94f), new Color(0.020f, 0.028f, 0.036f, 0.28f));
            AddFrame(tokenInspectorPanel.GetChild(tokenInspectorPanel.childCount - 1), "Token Inspector Body Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
            tokenInspectorTitle = AddText("Token Inspector Title", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(22f, 296f), new Vector2(-112f, -14f), "目标档案", 27, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Token Inspector Hint", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(312f, 306f), new Vector2(-88f, -22f), "公开视角", 12, TextAnchor.UpperRight, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.86f, 0.82f);
            AddToolActionButton("×", "关闭", tokenInspectorPanel, new Vector2(432f, 316f), new Vector2(76f, 28f), CloseTokenInspector, true);
            tokenInspectorSignalRoot = AddPanel("Token Inspector Signal Strip", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(22f, 256f), new Vector2(-22f, -74f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            tokenInspectorRoleRoot = AddPanel("Token Inspector Role", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(26f, 126f), new Vector2(-348f, -104f), new Color(0.004f, 0.010f, 0.017f, 0.18f)).GetComponent<RectTransform>();
            tokenInspectorMetaRoot = AddPanel("Token Inspector Meta", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(146f, 126f), new Vector2(-26f, -104f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            tokenInspectorFocusRoot = AddPanel("Token Inspector Target Focus Rail", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(22f, 118f), new Vector2(-22f, -104f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            tokenInspectorFocusRoot.GetComponent<Image>().raycastTarget = false;
            tokenInspectorGuidanceRoot = AddPanel("Token Inspector Guidance", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(26f, 70f), new Vector2(-26f, -222f), new Color(0.010f, 0.018f, 0.026f, 0.66f)).GetComponent<RectTransform>();
            AddImage("Token Inspector Guidance Accent", tokenInspectorGuidanceRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.48f));
            AddFrame(tokenInspectorGuidanceRoot, "Token Inspector Guidance Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            tokenInspectorGuidanceBadgeImage = AddImage("Token Inspector Guidance Badge", tokenInspectorGuidanceRoot, Vector2.zero, Vector2.zero, new Vector2(14f, 16f), new Vector2(46f, 48f), new Color(0.14f, 0.095f, 0.035f, 0.88f));
            tokenInspectorGuidanceBadgeImage.sprite = GetCircleFillSprite();
            tokenInspectorGuidanceBadgeImage.preserveAspect = true;
            AddFrame(tokenInspectorGuidanceBadgeImage.transform, "Token Inspector Guidance Badge Frame", 0.7f, new Color(1f, 0.76f, 0.34f, 0.28f));
            tokenInspectorGuidanceBadgeText = AddText("Token Inspector Guidance Badge Text", tokenInspectorGuidanceBadgeImage.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, "看", 13, TextAnchor.MiddleCenter, FontStyle.Bold);
            tokenInspectorGuidanceBadgeText.color = new Color(1f, 0.84f, 0.42f, 0.98f);
            tokenInspectorGuidanceTitleText = AddText("Token Inspector Guidance Title", tokenInspectorGuidanceRoot, Vector2.zero, Vector2.one, new Vector2(58f, 40f), new Vector2(-12f, -7f), "下一步：查看公开信息", 14, TextAnchor.UpperLeft, FontStyle.Bold);
            tokenInspectorGuidanceTitleText.color = new Color(1f, 0.82f, 0.44f, 0.96f);
            tokenInspectorBody = AddText("Token Inspector Body", tokenInspectorGuidanceRoot, Vector2.zero, Vector2.one, new Vector2(58f, 8f), new Vector2(-12f, -30f), "点击玩家查看公开可见信息。", 11, TextAnchor.UpperLeft, FontStyle.Normal);
            tokenInspectorBody.color = new Color(0.86f, 0.90f, 0.90f, 0.90f);
            var actionTray = AddPanel("Token Inspector Action Tray", tokenInspectorPanel, Vector2.zero, Vector2.zero, new Vector2(18f, 12f), new Vector2(462f, 68f), new Color(0.010f, 0.018f, 0.026f, 0.56f));
            AddImage("Token Inspector Action Tray Accent", actionTray.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.44f));
            AddFrame(actionTray.transform, "Token Inspector Action Tray Frame", 0.75f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            tokenInspectorActionStripText = AddText("Token Inspector Action Strip", actionTray.transform, Vector2.zero, Vector2.zero, new Vector2(14f, 3f), new Vector2(430f, 19f), "推荐：先选择一名玩家", 10, TextAnchor.MiddleLeft, FontStyle.Normal);
            tokenInspectorActionStripText.color = new Color(0.78f, 0.86f, 0.88f, 0.78f);
            tokenInspectorPrivateButton = AddToolActionButton("@", "私聊", tokenInspectorPanel, new Vector2(62f, 42f), new Vector2(82f, 32f), () => SelectDialoguePreset("private"), true);
            tokenInspectorNominationButton = AddToolActionButton("⚑", "提名", tokenInspectorPanel, new Vector2(151f, 42f), new Vector2(82f, 32f), () => SelectDialoguePreset("nomination"), true);
            tokenInspectorMarkButton = AddToolActionButton("ID", "标记", tokenInspectorPanel, new Vector2(240f, 42f), new Vector2(82f, 32f), () => SelectDialoguePreset("mark-role"), true);
            tokenInspectorReminderButton = AddToolActionButton("+", "提醒", tokenInspectorPanel, new Vector2(329f, 42f), new Vector2(82f, 32f), OpenReminderPickerForSelected, true);
            tokenInspectorActionButton = AddToolActionButton("✦", "行动", tokenInspectorPanel, new Vector2(418f, 42f), new Vector2(82f, 32f), SelectPrimaryAction, true);
            tokenInspectorPanel.gameObject.SetActive(false);
        }


        private void RenderGrimoire()
        {
            for (var i = grimoireRoot.childCount - 1; i >= 0; i--) Destroy(grimoireRoot.GetChild(i).gameObject);
            selectedTokenPulseImages.Clear();
            selectedTokenPulseRects.Clear();
            dialogueTokenPulseImages.Clear();
            dialogueTokenPulseRects.Clear();
            AddCircleImage("Outer Circle", grimoireRoot, 548f, new Color(1f, 0.78f, 0.36f, 0.14f), true);
            AddCircleImage("Middle Circle", grimoireRoot, 462f, new Color(1f, 0.78f, 0.36f, 0.065f), true);
            AddCircleImage("Inner Mist", grimoireRoot, 396f, new Color(0.05f, 0.04f, 0.035f, 0.085f), false);
            var voteOpen = votePanel != null && votePanel.gameObject.activeSelf;
            var phaseAssistOwnsFocus = PhaseAssistOwnsBoardFocus();
            var stageDialogueOwnsFocus = StageDialogueOverlayOpen();
            if (!voteOpen && !phaseAssistOwnsFocus && !stageDialogueOwnsFocus) RenderGrimoireCenterInfo();
            var players = vm.players ?? Array.Empty<PlayerViewModel>();
            var dockSafeYOffset = bottomDockOpen ? 146f : 36f;
            var radius = Mathf.Clamp(Mathf.Min(Screen.width, Screen.height) * (bottomDockOpen ? 0.335f : 0.360f), bottomDockOpen ? 326f : 348f, bottomDockOpen ? 374f : 408f);
            for (var i = 0; i < players.Length; i++)
            {
                var angle = Mathf.PI * 0.5f - Mathf.PI * 2f * i / Mathf.Max(1, players.Length);
                RenderPlayerToken(players[i], new Vector2(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius + dockSafeYOffset));
            }
            if (!voteOpen) RenderBluffs();
            ApplyBluffsVisibility();
        }


        private bool PhaseAssistOwnsBoardFocus()
        {
            var conversation = vm?.publicConversation;
            var clock = vm?.nominationClock;
            return conversation != null && conversation.active
                || clock != null && (clock.active || vm?.dayStage == "nomination");
        }


        private void RenderGrimoireCenterInfo()
        {
            var panel = AddPanel("Center Grimoire Info", grimoireRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-240f, -112f), new Vector2(240f, 124f), new Color(0.004f, 0.010f, 0.016f, 0.36f));
            AddImage("Center Info Warm Wash", panel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 12f), new Vector2(-12f, -12f), new Color(0.78f, 0.52f, 0.22f, 0.060f));
            AddCircleImage("Center Info Ring", panel.transform, 108f, new Color(1f, 0.78f, 0.36f, 0.12f), true);
            AddCircleImage("Center Info Core", panel.transform, 92f, new Color(0.02f, 0.018f, 0.014f, 0.30f), false);

            var title = AddText("Center Script Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(28f, 146f), new Vector2(-28f, -18f), DisplayScriptName(), 42, TextAnchor.MiddleCenter, FontStyle.BoldAndItalic);
            title.color = new Color(1f, 0.74f, 0.32f, 0.96f);

            var phase = AddText("Center Phase", panel.transform, Vector2.zero, Vector2.one, new Vector2(30f, 112f), new Vector2(-30f, -84f), $"D{vm.day}/N{vm.night} · {PhaseLabel()}", 17, TextAnchor.MiddleCenter, FontStyle.Bold);
            phase.color = new Color(0.88f, 0.92f, 0.94f, 0.92f);

            var counts = ParseSetupCounts(vm.setup);
            AddCenterInfoPill(panel.transform, new Vector2(92f, 86f), "民", counts[0], new Color(0.11f, 0.34f, 0.68f, 0.86f));
            AddCenterInfoPill(panel.transform, new Vector2(178f, 86f), "外", counts[1], new Color(0.09f, 0.22f, 0.42f, 0.86f));
            AddCenterInfoPill(panel.transform, new Vector2(264f, 86f), "爪", counts[2], new Color(0.52f, 0.10f, 0.15f, 0.86f));
            AddCenterInfoPill(panel.transform, new Vector2(350f, 86f), "恶", counts[3], new Color(0.56f, 0.03f, 0.06f, 0.86f));

            var life = AddText("Center Life", panel.transform, Vector2.zero, Vector2.one, new Vector2(40f, 32f), new Vector2(-40f, -174f), $"存活 {vm.alive}  |  死亡 {vm.dead}", 23, TextAnchor.MiddleCenter, FontStyle.Bold);
            life.color = IsGameOver() ? new Color(1f, 0.74f, 0.34f, 0.98f) : new Color(0.98f, 0.92f, 0.78f, 0.96f);

            var hint = AddText("Center Hint", panel.transform, Vector2.zero, Vector2.one, new Vector2(36f, 10f), new Vector2(-36f, -204f), "右键玩家添加提醒", 14, TextAnchor.MiddleCenter, FontStyle.Normal);
            hint.color = new Color(0.78f, 0.84f, 0.88f, 0.76f);
            SetRaycastTargetsExceptButtons(panel.transform);
        }


        private void AddCenterInfoPill(Transform parent, Vector2 center, string label, string count, Color color)
        {
            var half = new Vector2(32f, 18f);
            var panel = AddPanel($"Center Pill {label}", parent, Vector2.zero, Vector2.zero, center - half, center + half, color);
            AddFrame(panel.transform, "Center Pill Frame", 0.8f, new Color(1f, 0.88f, 0.68f, 0.24f));
            var text = AddText("Center Pill Text", panel.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, $"{label}{count}", 15, TextAnchor.MiddleCenter, FontStyle.Bold);
            text.color = Color.white;
        }


        private void RenderPlayerToken(PlayerViewModel player, Vector2 position)
        {
            var root = new GameObject($"Player {player.seat}", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
            root.transform.SetParent(grimoireRoot, false);
            var rt = root.GetComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = position;
            rt.sizeDelta = new Vector2(176f, 220f);
            root.GetComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            var tokenButton = root.GetComponent<Button>();
            ApplyButtonStyle(tokenButton);
            tokenButton.onClick.AddListener(() =>
            {
                if (TryToggleGrimoireActionTarget(player)) return;
                ShowTokenDialogue(player);
            });
            AddRightClickHandler(root, () => OpenReminderPickerForPlayer(player));
            if (!string.IsNullOrWhiteSpace(selectedPlayerId) && player.id == selectedPlayerId)
            {
                var pulse = AddImage("Selected Token Pulse", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-92f, -160f), new Vector2(92f, 24f), new Color(1f, 0.80f, 0.32f, 0.18f));
                pulse.sprite = GetCircleRingSprite();
                pulse.preserveAspect = true;
                pulse.raycastTarget = false;
                selectedTokenPulseImages.Add(pulse);
                selectedTokenPulseRects.Add(pulse.rectTransform);
                var halo = AddImage("Selected Token Halo", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-82f, -150f), new Vector2(82f, 14f), new Color(1f, 0.80f, 0.32f, 0.34f));
                halo.sprite = GetCircleRingSprite();
                halo.preserveAspect = true;
                halo.raycastTarget = false;
            }
            RenderStageDialogueTokenHint(root.transform, player);
            RenderGrimoireActionTargetHint(root.transform, player);
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
            else if (!player.revealed && !usingTokenFallback)
            {
                var unknownMark = AddText("Unknown Token Mark", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-40f, -100f), new Vector2(40f, -28f), "?", 42, TextAnchor.MiddleCenter, FontStyle.Bold);
                unknownMark.color = new Color(0.18f, 0.12f, 0.055f, 0.86f);
                unknownMark.raycastTarget = false;
            }
            if (!string.IsNullOrWhiteSpace(player.markedRoleId) && (!player.revealed || player.markedRoleId != player.roleId))
            {
                RenderMarkedRoleBadge(root.transform, player);
            }
            if (!player.alive)
            {
                RenderDeathShroud(root.transform);
            }
            if (player.suspicion > 0)
            {
                var suspicion = AddPanel("Suspicion", root.transform, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-66f, -28f), new Vector2(-14f, -5f), new Color(0.025f, 0.019f, 0.014f, 0.84f));
                AddFrame(suspicion.transform, "Suspicion Frame", 0.9f, SuspicionColor(player.suspicion));
                AddText("Suspicion Text", suspicion.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, $"{player.suspicion}%", 15, TextAnchor.MiddleCenter, FontStyle.Bold).color = Color.white;
            }
            var namePlate = AddPanel("Name Plate", root.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-74f, 26f), new Vector2(74f, 54f), new Color(0.12f, 0.060f, 0.024f, 0.78f));
            AddFrame(namePlate.transform, "Name Plate Frame", 0.9f, new Color(0.96f, 0.68f, 0.34f, 0.28f));
            AddText("Name", namePlate.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, player.name, 19, TextAnchor.MiddleCenter, FontStyle.Bold);
            var roleLabel = player.revealed ? player.roleName : "未知";
            var role = AddText("Role Label", root.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-112f, 0f), new Vector2(112f, 24f), roleLabel, 16, TextAnchor.MiddleCenter, FontStyle.Normal);
            role.color = new Color(0.98f, 0.90f, 0.78f, player.revealed ? 0.95f : 0.74f);
            RenderReminders(root.transform, player, position);
            RenderTokenStateMarkers(root.transform, player);
        }


        private void RenderDeathShroud(Transform tokenRoot)
        {
            var dim = AddImage("Death Token Dim", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-60f, -132f), new Vector2(60f, -12f), new Color(0f, 0f, 0f, 0.18f));
            dim.sprite = GetCircleFillSprite();
            dim.preserveAspect = true;
            dim.raycastTarget = false;

            var rim = AddImage("Death Shroud Rim", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-51f, -134f), new Vector2(51f, -10f), new Color(0.03f, 0.025f, 0.020f, 0.58f));
            rim.sprite = GetCircleRingSprite();
            rim.preserveAspect = true;
            rim.raycastTarget = false;

            var shroud = AddImage("Death Shroud", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-44f, -136f), new Vector2(44f, -8f), new Color(1f, 1f, 1f, 0.96f));
            shroud.sprite = SpriteFromResource("Botc/ui/shroud1");
            shroud.preserveAspect = true;
            shroud.raycastTarget = false;
        }


        private void RenderMarkedRoleBadge(Transform tokenRoot, PlayerViewModel player)
        {
            var role = RoleForId(player.markedRoleId);
            var sideBadge = player.revealed && !string.Equals(player.markedRoleId, player.roleId, StringComparison.OrdinalIgnoreCase);
            var center = sideBadge ? new Vector2(52f, -112f) : new Vector2(0f, -64f);
            var size = sideBadge ? 52f : 94f;
            var half = new Vector2(size * 0.5f, size * 0.5f);
            var badge = AddImage("Marked Role Badge", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half, center + half, Color.white);
            badge.sprite = SpriteFromResource(sideBadge ? "Botc/ui/reminder1" : "Botc/ui/token1") ?? GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            if (badge.sprite == circleFillSprite) badge.color = new Color(0.055f, 0.040f, 0.024f, 0.94f);
            var halo = AddImage("Marked Role Halo", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half - new Vector2(5f, 5f), center + half + new Vector2(5f, 5f), RoleHaloColor(role?.category, role?.team, true));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            var iconInset = sideBadge ? 9f : 11f;
            var icon = AddImage("Marked Role Icon", badge.transform, Vector2.zero, Vector2.one, new Vector2(iconInset, iconInset), new Vector2(-iconInset, -iconInset), Color.white);
            icon.sprite = SpriteFromResource($"Botc/roles/{player.markedRoleId}");
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            if (icon.sprite == null)
            {
                icon.color = new Color(1f, 1f, 1f, 0f);
                var label = AddText("Marked Role Fallback", badge.transform, Vector2.zero, Vector2.one, new Vector2(iconInset, iconInset + 3f), new Vector2(-iconInset, -iconInset - 3f), RoleFallbackLabel(player.markedRoleId, player.markedRoleName), sideBadge ? 17 : 28, TextAnchor.MiddleCenter, FontStyle.Bold);
                label.color = new Color(1f, 0.88f, 0.56f, 0.98f);
                label.raycastTarget = false;
            }
            var pinCenter = sideBadge ? center + new Vector2(-19f, 19f) : center + new Vector2(-40f, 34f);
            var pinHalf = new Vector2(11f, 11f);
            var mark = AddImage("Marked Role Pin", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), pinCenter - pinHalf, pinCenter + pinHalf, new Color(0.10f, 0.060f, 0.026f, 0.94f));
            mark.sprite = GetCircleFillSprite();
            mark.preserveAspect = true;
            mark.raycastTarget = false;
            var pinRing = AddImage("Marked Role Pin Ring", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), pinCenter - pinHalf - new Vector2(2f, 2f), pinCenter + pinHalf + new Vector2(2f, 2f), new Color(1f, 0.72f, 0.34f, 0.56f));
            pinRing.sprite = GetCircleRingSprite();
            pinRing.preserveAspect = true;
            pinRing.raycastTarget = false;
            var markText = AddText("Marked Role Pin Text", mark.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, "标", 12, TextAnchor.MiddleCenter, FontStyle.Bold);
            markText.color = new Color(0.98f, 0.82f, 0.44f, 1f);
            markText.raycastTarget = false;
        }


        private void RenderTokenStateMarkers(Transform tokenRoot, PlayerViewModel player)
        {
            var row = 0;
            if (!player.alive)
            {
                row++;
            }

            if (!player.alive && player.ghostVoteAvailable)
            {
                RenderGhostVoteSticker(tokenRoot);
            }

            var vote = vm?.voteCeremony;
            if (vote != null)
            {
                if (!string.IsNullOrWhiteSpace(vote.nominatorId) && vote.nominatorId == player.id)
                {
                    AddTokenStatusBadge(tokenRoot, "名", new Vector2(-70f, -42f - row * 34f), new Color(0.10f, 0.09f, 0.20f, 0.94f), new Color(0.58f, 0.68f, 1f, 0.46f));
                    row++;
                }
                if (!string.IsNullOrWhiteSpace(vote.nomineeId) && vote.nomineeId == player.id)
                {
                    AddTokenStatusBadge(tokenRoot, vote.passed ? "决" : "提", new Vector2(70f, -42f), new Color(0.24f, 0.035f, 0.030f, 0.95f), new Color(1f, 0.34f, 0.24f, 0.56f));
                }

                var voter = (vote.voters ?? Array.Empty<VoteViewModel>()).FirstOrDefault((entry) => entry != null && entry.voterId == player.id);
                if (voter != null && voter.vote)
                {
                    AddTokenStatusBadge(tokenRoot, voter.ghostVote ? "鬼" : "举", new Vector2(70f, -78f), new Color(0.025f, 0.085f, 0.18f, 0.94f), new Color(0.42f, 0.72f, 1f, 0.54f));
                }
            }

            var locked = (selectedActionTargetIds != null && selectedActionTargetIds.Contains(player.id))
                || (!string.IsNullOrWhiteSpace(pendingActionPlayerId) && pendingActionPlayerId == player.id && HasPendingAction());
            if (locked)
            {
                AddTokenStatusBadge(tokenRoot, "锁", new Vector2(0f, -154f), new Color(0.18f, 0.095f, 0.030f, 0.94f), new Color(1f, 0.78f, 0.30f, 0.54f));
            }
        }


        private void RenderGhostVoteSticker(Transform tokenRoot)
        {
            var center = new Vector2(42f, -124f);
            var half = new Vector2(15f, 15f);
            var halo = AddImage("Ghost Vote Sticker Halo", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half - new Vector2(3f, 3f), center + half + new Vector2(3f, 3f), new Color(0.96f, 0.92f, 0.82f, 0.46f));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            var sticker = AddImage("Ghost Vote Sticker", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half, center + half, new Color(0.92f, 0.86f, 0.68f, 0.96f));
            sticker.sprite = GetCircleFillSprite();
            sticker.preserveAspect = true;
            sticker.raycastTarget = false;
            var mark = AddText("Ghost Vote Sticker Text", sticker.transform, Vector2.zero, Vector2.one, new Vector2(3f, 3f), new Vector2(-3f, -3f), "✓", 16, TextAnchor.MiddleCenter, FontStyle.Bold);
            mark.color = new Color(0.035f, 0.030f, 0.026f, 0.96f);
            mark.raycastTarget = false;
        }


        private void AddTokenStatusBadge(Transform tokenRoot, string label, Vector2 center, Color fill, Color border)
        {
            var half = new Vector2(16f, 16f);
            var badge = AddImage($"Token Status {label}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half, center + half, fill);
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            var ring = AddImage($"Token Status Ring {label}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half - new Vector2(3f, 3f), center + half + new Vector2(3f, 3f), border);
            ring.sprite = GetCircleRingSprite();
            ring.preserveAspect = true;
            ring.raycastTarget = false;
            var text = AddText($"Token Status Text {label}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half, center + half, label, 14, TextAnchor.MiddleCenter, FontStyle.Bold);
            text.color = new Color(1f, 0.90f, 0.68f, 0.98f);
            text.raycastTarget = false;
        }


        private void RenderReminders(Transform tokenRoot, PlayerViewModel player, Vector2 boardPosition)
        {
            var reminders = player?.reminders;
            if (reminders == null || reminders.Length == 0) return;

            var inward = boardPosition.sqrMagnitude > 1f ? -boardPosition.normalized : Vector2.up;
            if (inward.sqrMagnitude < 0.001f) inward = Vector2.up;
            inward.Normalize();
            var tangent = new Vector2(-inward.y, inward.x).normalized;
            var tokenCenter = new Vector2(0f, -72f);
            var hasOverflow = reminders.Length > 4;
            var reminderCount = hasOverflow ? 3 : Mathf.Min(reminders.Length, 4);
            var slotCount = reminderCount + (hasOverflow ? 1 : 0);
            var dockCenter = tokenCenter + inward * ReminderDockDistance(inward);
            var spacing = slotCount <= 3 ? 34f : 32f;

            for (var i = 0; i < slotCount; i++)
            {
                var center = dockCenter + tangent * ((i - (slotCount - 1) * 0.5f) * spacing);
                if (hasOverflow && i == slotCount - 1)
                {
                    RenderReminderOverflowBadge(tokenRoot, reminders.Length - reminderCount, center, i);
                }
                else
                {
                    RenderReminderBadge(tokenRoot, reminders[i], center, i);
                }
            }
        }


        private static float ReminderDockDistance(Vector2 inward)
        {
            if (inward.y < -0.35f) return 88f;
            if (inward.y > 0.35f) return 76f;
            return 84f;
        }


        private void RenderReminderBadge(Transform tokenRoot, string reminderLabel, Vector2 center, int index)
        {
            var role = RoleForReminderLabel(reminderLabel);
            var roleSprite = role == null ? null : SpriteFromResource($"Botc/roles/{role.id}");
            var size = 34f;
            var half = new Vector2(size * 0.5f, size * 0.5f);
            var haloColor = role == null ? new Color(0.92f, 0.68f, 0.34f, 0.54f) : RoleHaloColor(role.category, role.team, false);
            var halo = AddImage($"Reminder Halo {index}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half - new Vector2(2f, 2f), center + half + new Vector2(2f, 2f), haloColor);
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            var reminder = AddImage($"Reminder {index}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half, center + half, Color.white);
            reminder.sprite = SpriteFromResource("Botc/ui/reminder1") ?? SpriteFromResource("Botc/ui/token1") ?? GetCircleFillSprite();
            reminder.preserveAspect = true;
            reminder.raycastTarget = false;
            if (roleSprite != null)
            {
                var icon = AddImage("Reminder Role Icon", reminder.transform, Vector2.zero, Vector2.one, new Vector2(6f, 7f), new Vector2(-6f, -6f), new Color(1f, 1f, 1f, 0.88f));
                icon.sprite = roleSprite;
                icon.preserveAspect = true;
                icon.raycastTarget = false;
                var label = AddText("Reminder Caption", reminder.transform, Vector2.zero, Vector2.one, new Vector2(3f, 1f), new Vector2(-3f, -24f), ReminderShort(reminderLabel), 7, TextAnchor.MiddleCenter, FontStyle.Bold);
                label.color = new Color(0.07f, 0.040f, 0.020f, 0.92f);
                label.raycastTarget = false;
                return;
            }
            var text = AddText("Reminder Text", reminder.transform, Vector2.zero, Vector2.one, new Vector2(4f, 4f), new Vector2(-4f, -4f), ReminderShort(reminderLabel), 10, TextAnchor.MiddleCenter, FontStyle.Bold);
            text.color = new Color(0.08f, 0.045f, 0.025f, 0.96f);
            text.raycastTarget = false;
        }


        private void RenderReminderOverflowBadge(Transform tokenRoot, int overflowCount, Vector2 center, int index)
        {
            var size = 34f;
            var half = new Vector2(size * 0.5f, size * 0.5f);
            var halo = AddImage($"Reminder Overflow Halo {index}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half - new Vector2(2f, 2f), center + half + new Vector2(2f, 2f), new Color(1f, 0.76f, 0.34f, 0.44f));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            var badge = AddImage($"Reminder Overflow {index}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half, center + half, Color.white);
            badge.sprite = SpriteFromResource("Botc/ui/reminder1") ?? SpriteFromResource("Botc/ui/token1") ?? GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            var text = AddText("Reminder Overflow Text", badge.transform, Vector2.zero, Vector2.one, new Vector2(3f, 3f), new Vector2(-3f, -3f), $"+{overflowCount}", 12, TextAnchor.MiddleCenter, FontStyle.Bold);
            text.color = new Color(0.08f, 0.045f, 0.025f, 0.96f);
            text.raycastTarget = false;
        }


        private ScriptRoleViewModel RoleForReminderLabel(string reminderLabel)
        {
            if (string.IsNullOrWhiteSpace(reminderLabel)) return null;
            var clean = reminderLabel.Trim();
            return (vm?.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>())
                .FirstOrDefault((role) => role != null
                    && ((role.reminders ?? Array.Empty<string>()).Any((entry) => string.Equals(entry?.Trim(), clean, StringComparison.OrdinalIgnoreCase))
                        || (role.remindersGlobal ?? Array.Empty<string>()).Any((entry) => string.Equals(entry?.Trim(), clean, StringComparison.OrdinalIgnoreCase))));
        }


        private void RenderBluffs()
        {
            var bluffs = NormalizedBluffLabels();
            if (bluffs.All(IsHiddenBluffLabel)) return;

            var panel = AddPanel("Bluffs", grimoireRoot, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(30f, 42f), new Vector2(404f, 174f), new Color(0.010f, 0.014f, 0.018f, 0.70f));
            AddFrame(panel.transform, "Bluffs Frame", 1f, new Color(0.82f, 0.56f, 0.25f, 0.25f));
            AddImage("Bluffs Header Wash", panel.transform, new Vector2(0f, 1f), Vector2.one, new Vector2(1f, -38f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            AddText("Bluff Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 98f), new Vector2(-164f, -8f), "恶魔伪装", 21, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Bluff Scope", panel.transform, Vector2.zero, Vector2.one, new Vector2(210f, 101f), new Vector2(-16f, -10f), BluffScopeLabel(), 11, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.78f, 0.88f, 0.82f, 0.86f);

            for (var i = 0; i < bluffs.Length; i++)
            {
                AddBluffChip(panel.transform, bluffs[i], i);
            }

            var helper = bluffs.All(IsHiddenBluffLabel)
                ? "隐藏中：全知或恶魔视角会显示可声称身份。"
                : "可作为私聊、公开发言或假跳身份参考。";
            AddText("Bluff Helper", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 10f), new Vector2(-18f, -108f), Ellipsize(helper, 28), 11, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.72f, 0.80f, 0.84f, 0.78f);
        }

        private void ApplyBluffsVisibility()
        {
            if (grimoireRoot == null) return;
            var voteOpen = votePanel != null && votePanel.gameObject.activeSelf;
            var focusOverlayOpen = FocusOverlayChromeOpen();
            var dockVisible = bottomDockOpen || (bottomDock != null && bottomDock.gameObject.activeSelf);
            var moreActionsVisible = moreActionsOpen || (moreActionsPanel != null && moreActionsPanel.gameObject.activeSelf);
            var visible = !voteOpen && !focusOverlayOpen && !dockVisible && !moreActionsVisible;
            for (var i = 0; i < grimoireRoot.childCount; i++)
            {
                var child = grimoireRoot.GetChild(i);
                if (child != null && child.name == "Bluffs") child.gameObject.SetActive(visible);
            }
        }

        private string[] NormalizedBluffLabels()
        {
            var values = (vm?.bluffs ?? Array.Empty<string>())
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Select((entry) => entry.Trim())
                .Take(3)
                .ToList();
            while (values.Count < 3) values.Add("隐藏");
            return values.ToArray();
        }

        private string BluffScopeLabel()
        {
            var hidden = NormalizedBluffLabels().All(IsHiddenBluffLabel);
            if (!hidden) return vm != null && vm.grimoireView ? "全知可见" : "仅特定视角";
            return vm != null && vm.grimoireView ? "等待同步" : "视角隐藏";
        }

        private void AddBluffChip(Transform parent, string label, int index)
        {
            var hidden = IsHiddenBluffLabel(label);
            var role = RoleForBluffLabel(label);
            var x = 18f + index * 116f;
            var fill = hidden ? new Color(0.018f, 0.028f, 0.036f, 0.74f) : new Color(0.13f, 0.070f, 0.028f, 0.84f);
            var border = hidden ? new Color(0.62f, 0.78f, 0.92f, 0.20f) : new Color(0.94f, 0.68f, 0.34f, 0.38f);
            var chip = AddPanel($"Bluff Chip {index}", parent, Vector2.zero, Vector2.zero, new Vector2(x, 44f), new Vector2(x + 104f, 88f), fill);
            AddFrame(chip.transform, "Bluff Chip Frame", 0.75f, border);
            AddImage("Bluff Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), hidden ? new Color(0.46f, 0.62f, 0.74f, 0.30f) : new Color(0.96f, 0.64f, 0.24f, 0.48f));

            var badge = AddImage("Bluff Chip Badge", chip.transform, Vector2.zero, Vector2.zero, new Vector2(10f, 10f), new Vector2(34f, 34f), hidden ? new Color(0.020f, 0.034f, 0.044f, 0.90f) : new Color(0.18f, 0.090f, 0.032f, 0.92f));
            badge.sprite = GetCircleFillSprite();
            AddFrame(badge.transform, "Bluff Chip Badge Frame", 0.6f, border);
            if (role != null)
            {
                var icon = AddImage("Bluff Chip Role Icon", badge.transform, Vector2.zero, Vector2.one, new Vector2(3f, 3f), new Vector2(-3f, -3f), Color.white);
                icon.sprite = SpriteFromResource($"Botc/roles/{role.id}");
                icon.preserveAspect = true;
                icon.raycastTarget = false;
                if (icon.sprite == null) icon.color = new Color(1f, 1f, 1f, 0f);
            }
            AddText("Bluff Chip Badge Text", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, hidden || role == null ? "隐" : "", 11, TextAnchor.MiddleCenter, FontStyle.Bold).color = hidden ? new Color(0.72f, 0.84f, 0.92f, 0.95f) : new Color(1f, 0.82f, 0.44f, 0.98f);

            var title = hidden ? "隐藏中" : FirstNonEmpty(role?.name, label);
            var meta = hidden ? $"伪装 {index + 1}" : FirstNonEmpty(RoleCategoryLabel(role?.category), "可声称");
            AddText("Bluff Chip Title", chip.transform, Vector2.zero, Vector2.one, new Vector2(42f, 21f), new Vector2(-6f, -4f), Ellipsize(title, 5), 13, TextAnchor.UpperLeft, FontStyle.Bold).color = hidden ? new Color(0.80f, 0.88f, 0.92f, 0.88f) : new Color(1f, 0.84f, 0.44f, 0.98f);
            AddText("Bluff Chip Meta", chip.transform, Vector2.zero, Vector2.one, new Vector2(42f, 6f), new Vector2(-6f, -24f), Ellipsize(meta, 7), 9, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.72f, 0.82f, 0.86f, 0.74f);
        }

        private ScriptRoleViewModel RoleForBluffLabel(string label)
        {
            if (string.IsNullOrWhiteSpace(label)) return null;
            var clean = label.Trim();
            return (vm?.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>())
                .FirstOrDefault((role) => role != null
                    && (string.Equals(role.id, clean, StringComparison.OrdinalIgnoreCase)
                        || string.Equals(role.name, clean, StringComparison.OrdinalIgnoreCase)));
        }

        private static bool IsHiddenBluffLabel(string label)
        {
            var clean = (label ?? "").Trim();
            return string.IsNullOrWhiteSpace(clean)
                || clean == "未知"
                || clean == "隐藏"
                || clean == "暂无伪装";
        }

        private static string RoleCategoryLabel(string category)
        {
            switch ((category ?? "").Trim().ToLowerInvariant())
            {
                case "townsfolk": return "镇民";
                case "outsider": return "外来者";
                case "minion": return "爪牙";
                case "demon": return "恶魔";
                default: return "";
            }
        }


        private void ShowTokenDialogue(PlayerViewModel player)
        {
            selectedPlayerId = player.id ?? "";
            selectionPulseStartTime = Time.realtimeSinceStartup;
            SendUnityAction("select-token", selectedPlayerId, "", "", "", trackPending: false);
            RenderGrimoire();
            tokenInspectorOpen = true;
            UpdateTokenInspectorText(player);
            ApplyTokenInspectorVisibility();
            if (vm.phase == "day" && vm.dayStage == "private" && !player.human)
            {
                OpenPrivateChatPanel();
                dialogueTitle.text = $"私聊 · {player.name}";
                dialogueBody.text = "已打开私聊面板。你可以继续查看对话记录、追问身份或发送本次私聊。";
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
                RenderTokenInspectorSignalStrip(null);
                RenderTokenInspectorRole(null);
                RenderTokenInspectorMeta(null);
                RenderTokenInspectorTargetFocus(null);
                UpdateTokenInspectorGuidance(null);
                UpdateTokenInspectorActionSuggestions(null);
                UpdateTokenInspectorActionStrip(null);
                return;
            }

            tokenInspectorTitle.text = $"{player.name} 档案";
            RenderTokenInspectorSignalStrip(player);
            RenderTokenInspectorRole(player);
            RenderTokenInspectorMeta(player);
            RenderTokenInspectorTargetFocus(player);
            UpdateTokenInspectorGuidance(player);
            UpdateTokenInspectorActionSuggestions(player);
            UpdateTokenInspectorActionStrip(player);
        }

        private void UpdateTokenInspectorGuidance(PlayerViewModel player)
        {
            var action = TokenInspectorRecommendedAction(player);
            if (tokenInspectorGuidanceBadgeImage != null) tokenInspectorGuidanceBadgeImage.color = TokenInspectorGuidanceBadgeColor(action);
            if (tokenInspectorGuidanceBadgeText != null)
            {
                tokenInspectorGuidanceBadgeText.text = TokenInspectorGuidanceBadge(action);
                tokenInspectorGuidanceBadgeText.color = action == "private" || action == "action"
                    ? new Color(0.76f, 1f, 0.82f, 0.98f)
                    : new Color(1f, 0.84f, 0.42f, 0.98f);
            }
            if (tokenInspectorGuidanceTitleText != null) tokenInspectorGuidanceTitleText.text = TokenInspectorGuidanceTitle(player, action);
            if (tokenInspectorBody != null) tokenInspectorBody.text = ClampTextBlock(TokenInspectorGuidanceLine(player), 2, 42);
        }

        private void RenderTokenInspectorSignalStrip(PlayerViewModel player)
        {
            if (tokenInspectorSignalRoot == null) return;
            ClearChildren(tokenInspectorSignalRoot);
            if (player == null)
            {
                AddTokenInspectorSignalChip("点", "状态", "未选择", 0f, 116f, new Color(0.12f, 0.080f, 0.040f, 0.72f), new Color(0.88f, 0.62f, 0.30f, 0.26f));
                AddTokenInspectorSignalChip("看", "建议", "选择 token", 124f, 132f, new Color(0.032f, 0.044f, 0.054f, 0.70f), new Color(0.62f, 0.78f, 0.92f, 0.18f));
                return;
            }

            AddTokenInspectorSignalChip("座", "座位", TokenInspectorSeatLabel(player), 0f, 66f, new Color(0.032f, 0.044f, 0.054f, 0.74f), new Color(0.62f, 0.78f, 0.92f, 0.20f));
            AddTokenInspectorSignalChip(player.human ? "你" : "AI", "视角", player.human ? "主视角" : "AI", 74f, 82f, new Color(0.035f, 0.060f, 0.072f, 0.72f), new Color(0.46f, 0.78f, 0.92f, 0.24f));
            AddTokenInspectorSignalChip(player.revealed ? "开" : "身", "身份", TokenInspectorIdentitySignalLabel(player), 164f, 112f, player.revealed ? new Color(0.035f, 0.066f, 0.086f, 0.74f) : new Color(0.095f, 0.064f, 0.030f, 0.74f), player.revealed ? new Color(0.50f, 0.74f, 0.94f, 0.28f) : new Color(1f, 0.70f, 0.30f, 0.26f));
            AddTokenInspectorSignalChip("荐", "建议", TokenInspectorActionSignalLabel(TokenInspectorRecommendedAction(player)), 284f, 146f, new Color(0.050f, 0.070f, 0.052f, 0.74f), new Color(0.76f, 0.92f, 0.52f, 0.22f));
        }

        private void RenderTokenInspectorTargetFocus(PlayerViewModel player)
        {
            if (tokenInspectorFocusRoot == null) return;
            ClearChildren(tokenInspectorFocusRoot);
            if (player == null) return;

            var action = TokenInspectorRecommendedAction(player);
            var accent = TokenInspectorFocusAccent(player, action);
            AddFrame(tokenInspectorFocusRoot, "Token Inspector Target Focus Frame", 0.55f, new Color(accent.r, accent.g, accent.b, 0.20f));
            AddImage("Token Inspector Target Focus Accent", tokenInspectorFocusRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(accent.r, accent.g, accent.b, 0.50f));

            var halo = AddImage("Token Inspector Target Halo", tokenInspectorFocusRoot, Vector2.zero, Vector2.zero, new Vector2(2f, 8f), new Vector2(126f, 132f), new Color(accent.r, accent.g, accent.b, 0.070f));
            halo.sprite = GetCircleFillSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            var ring = AddImage("Token Inspector Target Ring", tokenInspectorFocusRoot, Vector2.zero, Vector2.zero, new Vector2(10f, 16f), new Vector2(118f, 124f), new Color(accent.r, accent.g, accent.b, 0.32f));
            ring.sprite = GetCircleRingSprite();
            ring.preserveAspect = true;
            ring.raycastTarget = false;

            AddImage("Token Inspector Target Route Track", tokenInspectorFocusRoot, Vector2.zero, Vector2.zero, new Vector2(92f, 68f), new Vector2(414f, 72f), new Color(0.62f, 0.72f, 0.80f, 0.22f));
            var pressureTraceRight = Mathf.Lerp(132f, 414f, Mathf.Clamp01(player.suspicion / 100f));
            AddImage("Token Inspector Target Pressure Trace", tokenInspectorFocusRoot, Vector2.zero, Vector2.zero, new Vector2(92f, 63f), new Vector2(pressureTraceRight, 66f), new Color(accent.r, accent.g, accent.b, 0.46f));

            var sourceNode = AddImage("Token Inspector Target Source Node", tokenInspectorFocusRoot, Vector2.zero, Vector2.zero, new Vector2(54f, 60f), new Vector2(76f, 82f), new Color(accent.r, accent.g, accent.b, 0.58f));
            sourceNode.sprite = GetCircleFillSprite();
            sourceNode.preserveAspect = true;
            var actionNode = AddImage("Token Inspector Target Action Node", tokenInspectorFocusRoot, Vector2.zero, Vector2.zero, new Vector2(407f, 57f), new Vector2(433f, 83f), new Color(accent.r, accent.g, accent.b, 0.70f));
            actionNode.sprite = GetCircleFillSprite();
            actionNode.preserveAspect = true;
            AddFrame(actionNode.transform, "Token Inspector Target Action Node Frame", 0.6f, new Color(1f, 0.86f, 0.52f, 0.26f));
            AddText("Token Inspector Target Action Glyph", actionNode.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, TokenInspectorGuidanceBadge(action), 11, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.92f, 0.72f, 0.98f);

            var pin = AddPanel("Token Inspector Target Seat Pin", tokenInspectorFocusRoot, Vector2.zero, Vector2.zero, new Vector2(14f, 104f), new Vector2(82f, 128f), new Color(0.010f, 0.016f, 0.020f, 0.84f));
            AddFrame(pin.transform, "Token Inspector Target Seat Pin Frame", 0.65f, new Color(accent.r, accent.g, accent.b, 0.38f));
            AddImage("Token Inspector Target Seat Pin Accent", pin.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(accent.r, accent.g, accent.b, 0.72f));
            AddText("Token Inspector Target Seat Pin Label", pin.transform, Vector2.zero, Vector2.one, new Vector2(8f, 12f), new Vector2(-8f, -2f), "目标", 7, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.74f, 0.82f, 0.86f, 0.78f);
            AddText("Token Inspector Target Seat Pin Value", pin.transform, Vector2.zero, Vector2.one, new Vector2(8f, 2f), new Vector2(-8f, -12f), TokenInspectorSeatLabel(player), 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.92f, 0.72f, 0.96f);

            SetRaycastTargetsExceptButtons(tokenInspectorFocusRoot);
        }

        private static Color TokenInspectorFocusAccent(PlayerViewModel player, string action)
        {
            if (player != null && player.suspicion >= 65) return new Color(0.88f, 0.22f, 0.12f, 0.84f);
            if (action == "action") return new Color(0.30f, 0.62f, 0.86f, 0.84f);
            if (action == "private") return new Color(0.34f, 0.78f, 0.50f, 0.82f);
            if (action == "nomination") return new Color(0.94f, 0.42f, 0.18f, 0.84f);
            if (action == "mark") return new Color(0.96f, 0.66f, 0.24f, 0.84f);
            if (action == "reminder") return new Color(0.90f, 0.68f, 0.34f, 0.80f);
            return new Color(0.62f, 0.76f, 0.86f, 0.72f);
        }

        private void AddTokenInspectorSignalChip(string icon, string label, string value, float x, float width, Color fill, Color border)
        {
            if (tokenInspectorSignalRoot == null) return;
            var chip = AddPanel($"Token Inspector Signal Chip {label}", tokenInspectorSignalRoot, Vector2.zero, Vector2.zero, new Vector2(x, 0f), new Vector2(x + width, 26f), fill);
            AddFrame(chip.transform, "Token Inspector Signal Chip Frame", 0.65f, border);
            var badge = AddImage("Token Inspector Signal Badge", chip.transform, Vector2.zero, Vector2.zero, new Vector2(6f, 5f), new Vector2(24f, 23f), new Color(0.008f, 0.012f, 0.016f, 0.78f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            AddText("Token Inspector Signal Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, icon.Length > 1 ? 8 : 10, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("Token Inspector Signal Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(30f, 13f), new Vector2(-4f, -3f), label, 8, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.70f, 0.78f, 0.82f, 0.76f);
            AddText("Token Inspector Signal Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(30f, 2f), new Vector2(-4f, -14f), Ellipsize(value, Mathf.Max(4, Mathf.FloorToInt(width / 12f))), 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            SetRaycastTargetsExceptButtons(chip.transform);
        }

        private static string TokenInspectorSeatLabel(PlayerViewModel player)
        {
            if (player == null || player.seat <= 0) return "#?";
            return $"#{player.seat}";
        }

        private static string TokenInspectorIdentitySignalLabel(PlayerViewModel player)
        {
            if (player == null) return "未知";
            if (player.revealed) return "已公开";
            return string.IsNullOrWhiteSpace(player.markedRoleId) ? "未标记" : "有标记";
        }

        private static string TokenInspectorActionSignalLabel(string action)
        {
            if (action == "action") return "处理行动";
            if (action == "private") return "私聊";
            if (action == "nomination") return "提名";
            if (action == "mark") return "标记身份";
            if (action == "reminder") return "加提醒";
            return "继续观察";
        }

        private void RenderTokenInspectorMeta(PlayerViewModel player)
        {
            if (tokenInspectorMetaRoot == null) return;
            ClearChildren(tokenInspectorMetaRoot);
            if (player == null)
            {
                AddTokenInspectorMetaCard("点", "未选择", "点击玩家", new Vector2(0f, 68f), new Color(0.12f, 0.080f, 0.040f, 0.78f), new Color(0.88f, 0.62f, 0.30f, 0.30f));
                return;
            }

            var roleColor = player.revealed
                ? new Color(0.10f, 0.16f, 0.20f, 0.82f)
                : new Color(0.16f, 0.105f, 0.045f, 0.82f);
            AddTokenInspectorMetaCard("身", player.revealed ? "公开身份" : "身份标记", TokenInspectorRoleSummary(player), new Vector2(0f, 68f), roleColor, player.revealed ? new Color(0.50f, 0.74f, 0.94f, 0.34f) : new Color(1f, 0.70f, 0.30f, 0.34f));

            var state = $"{(player.alive ? "存活" : "死亡")} · {(player.ghostVoteAvailable ? "有鬼票" : "无鬼票")}";
            AddTokenInspectorMetaCard(player.alive ? "生" : "亡", "状态", state, new Vector2(154f, 68f), player.alive ? new Color(0.040f, 0.115f, 0.070f, 0.82f) : new Color(0.12f, 0.035f, 0.030f, 0.84f), player.alive ? new Color(0.48f, 0.86f, 0.58f, 0.30f) : new Color(1f, 0.42f, 0.28f, 0.36f));

            var suspicionColor = SuspicionColor(player.suspicion);
            AddTokenInspectorMetaCard("疑", "压力", TokenInspectorSuspicionLabel(player.suspicion), new Vector2(0f, 0f), new Color(0.040f, 0.042f, 0.050f, 0.82f), suspicionColor);

            AddTokenInspectorMetaCard("注", "提醒", TokenInspectorReminderSummary(player), new Vector2(154f, 0f), new Color(0.055f, 0.045f, 0.030f, 0.82f), new Color(0.90f, 0.68f, 0.34f, 0.28f));
        }

        private void AddTokenInspectorMetaCard(string icon, string label, string value, Vector2 origin, Color fill, Color border)
        {
            if (tokenInspectorMetaRoot == null) return;
            var card = AddPanel($"Token Inspector Card {label}", tokenInspectorMetaRoot, Vector2.zero, Vector2.zero, origin, origin + new Vector2(144f, 58f), fill);
            AddFrame(card.transform, "Token Inspector Card Frame", 0.7f, border);
            var badge = AddImage("Token Inspector Card Badge", card.transform, Vector2.zero, Vector2.zero, new Vector2(10f, 25f), new Vector2(34f, 49f), new Color(0.010f, 0.014f, 0.018f, 0.78f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            AddText("Token Inspector Card Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("Token Inspector Card Label", card.transform, Vector2.zero, Vector2.one, new Vector2(42f, 32f), new Vector2(-8f, -4f), label, 12, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.74f, 0.78f, 0.78f, 0.92f);
            AddText("Token Inspector Card Value", card.transform, Vector2.zero, Vector2.one, new Vector2(12f, 5f), new Vector2(-10f, -26f), Ellipsize(value, 12), 14, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.98f);
            SetRaycastTargetsExceptButtons(card.transform);
        }

        private static string TokenInspectorSuspicionLabel(int suspicion)
        {
            var clamped = Mathf.Clamp(suspicion, 0, 100);
            if (clamped >= 65) return $"{clamped}% · 高";
            if (clamped >= 42) return $"{clamped}% · 中";
            return $"{clamped}% · 低";
        }

        private static string TokenInspectorReminderSummary(PlayerViewModel player)
        {
            if (player?.reminders == null || player.reminders.Length == 0) return "暂无";
            var visible = string.Join(" / ", player.reminders.Take(2));
            return player.reminders.Length > 2 ? $"{visible} +{player.reminders.Length - 2}" : visible;
        }

        private static string TokenInspectorRoleSummary(PlayerViewModel player)
        {
            if (player == null) return "未知";
            if (player.revealed) return string.IsNullOrWhiteSpace(player.roleName) ? "未知" : player.roleName;
            return string.IsNullOrWhiteSpace(player.markedRoleName) ? "未知" : player.markedRoleName;
        }

        private string TokenInspectorGuidanceTitle(PlayerViewModel player, string action)
        {
            if (player == null) return "下一步：选择一名玩家";
            if (action == "action") return "下一步：处理可用行动";
            if (action == "private") return $"下一步：和 {player.name} 私聊";
            if (action == "nomination") return $"下一步：围绕 {player.name} 提名";
            if (action == "mark") return "下一步：先标记身份";
            if (action == "reminder") return "下一步：添加提醒";
            return "下一步：继续观察";
        }

        private string TokenInspectorGuidanceLine(PlayerViewModel player)
        {
            if (player == null) return "点击魔典上的玩家，查看公开视角下可用的信息和快捷操作。";
            var secondary = !string.IsNullOrWhiteSpace(player.perceivedRoleId) && player.human
                ? $"主视角认知：{RoleNameForId(player.perceivedRoleId)}。"
                : TokenInspectorReminderLine(player);
            return $"{TokenInspectorVisibilityLine(player)} {secondary}";
        }

        private static string TokenInspectorGuidanceBadge(string action)
        {
            if (action == "action") return "行";
            if (action == "private") return "私";
            if (action == "nomination") return "提";
            if (action == "mark") return "标";
            if (action == "reminder") return "注";
            return "看";
        }

        private static Color TokenInspectorGuidanceBadgeColor(string action)
        {
            if (action == "private") return new Color(0.030f, 0.115f, 0.070f, 0.90f);
            if (action == "action") return new Color(0.045f, 0.100f, 0.145f, 0.90f);
            if (action == "nomination") return new Color(0.18f, 0.070f, 0.030f, 0.90f);
            if (action == "mark") return new Color(0.14f, 0.095f, 0.035f, 0.90f);
            if (action == "reminder") return new Color(0.12f, 0.085f, 0.050f, 0.90f);
            return new Color(0.075f, 0.080f, 0.088f, 0.88f);
        }

        private string TokenInspectorActionHint(PlayerViewModel player)
        {
            if (player == null) return "点击魔典玩家查看公开可见信息。";
            if (player.human) return "这是主视角；可从底部行动区处理夜间或白天技能。";
            if (vm.phase == "day" && vm.dayStage == "private") return "当前可私聊；标记和提醒会直接写回魔典。";
            if (vm.phase == "day" && vm.dayStage == "nomination") return "当前可提名、投票前核对标记，或补充提醒。";
            if (vm.phase == "night") return "夜间先处理可用行动；白天再私聊或提名。";
            return "可标记身份、添加提醒，并从底部继续阶段流程。";
        }

        private string TokenInspectorRecommendation(PlayerViewModel player)
        {
            var action = TokenInspectorRecommendedAction(player);
            if (action == "action") return "打开行动，处理当前可用技能。";
            if (action == "private") return $"和 {player.name} 私聊，补身份或信息。";
            if (action == "nomination") return $"围绕 {player.name} 提名或核对票型。";
            if (action == "mark") return "先标记身份，角色提醒会更好找。";
            if (action == "reminder") return "添加提醒，让魔典更可扫读。";
            return TokenInspectorActionHint(player);
        }

        private static string TokenInspectorReminderLine(PlayerViewModel player)
        {
            var count = player?.reminders?.Length ?? 0;
            if (count <= 0) return "提醒：暂无；右键玩家可快速添加。";
            return $"提醒：{count}/5 · {TokenInspectorReminderSummary(player)}";
        }

        private string TokenInspectorRecommendedAction(PlayerViewModel player)
        {
            if (player == null) return "";
            var forms = vm?.actionForms ?? Array.Empty<ActionFormViewModel>();
            if (forms.Any((entry) => entry != null && entry.available) && (player.human || vm?.phase == "night")) return "action";
            if (!player.human && vm?.phase == "day" && vm?.dayStage == "private") return "private";
            if (!player.human && vm?.phase == "day" && vm?.dayStage == "nomination") return "nomination";
            if (!player.revealed && string.IsNullOrWhiteSpace(player.markedRoleId)) return "mark";
            if (player.reminders == null || player.reminders.Length == 0) return "reminder";
            return "";
        }

        private void UpdateTokenInspectorActionSuggestions(PlayerViewModel player)
        {
            var action = TokenInspectorRecommendedAction(player);
            SetTokenInspectorButtonSuggested(tokenInspectorPrivateButton, action == "private");
            SetTokenInspectorButtonSuggested(tokenInspectorNominationButton, action == "nomination");
            SetTokenInspectorButtonSuggested(tokenInspectorMarkButton, action == "mark");
            SetTokenInspectorButtonSuggested(tokenInspectorReminderButton, action == "reminder");
            SetTokenInspectorButtonSuggested(tokenInspectorActionButton, action == "action");
        }

        private void UpdateTokenInspectorActionStrip(PlayerViewModel player)
        {
            if (tokenInspectorActionStripText == null) return;
            tokenInspectorActionStripText.text = player == null
                ? "推荐：先选中玩家，再使用快捷操作"
                : $"推荐：{Ellipsize(TokenInspectorRecommendation(player), 30)}";
            tokenInspectorActionStripText.color = player == null
                ? new Color(0.92f, 0.78f, 0.54f, 0.82f)
                : new Color(0.78f, 0.88f, 0.86f, 0.84f);
        }

        private void SetTokenInspectorButtonSuggested(Button button, bool suggested)
        {
            var root = button == null ? null : button.transform as RectTransform;
            if (root == null) return;
            var glow = root.Find("Inspector Suggested Glow")?.GetComponent<Image>();
            if (glow == null)
            {
                glow = AddImage("Inspector Suggested Glow", root, Vector2.zero, Vector2.one, new Vector2(-4f, -4f), new Vector2(4f, 4f), new Color(1f, 0.76f, 0.28f, 0.26f));
                glow.raycastTarget = false;
                glow.transform.SetAsFirstSibling();
            }
            glow.gameObject.SetActive(suggested);

            var edge = root.Find("Inspector Suggested Edge")?.GetComponent<Image>();
            if (edge == null)
            {
                edge = AddImage("Inspector Suggested Edge", root, new Vector2(1f, 0f), new Vector2(1f, 1f), new Vector2(-4f, 4f), new Vector2(-1f, -4f), new Color(1f, 0.82f, 0.34f, 0.82f));
                edge.raycastTarget = false;
            }
            edge.gameObject.SetActive(suggested);
        }

        private static string TokenInspectorVisibilityLine(PlayerViewModel player)
        {
            if (player == null) return "";
            if (player.revealed) return "身份已公开，可作为公开信息处理。";
            return player.human ? "你的认知只显示给主视角。" : "未公开身份不会泄露真实底牌。";
        }


        private void RenderTokenInspectorRole(PlayerViewModel player)
        {
            if (tokenInspectorRoleRoot == null) return;
            ClearChildren(tokenInspectorRoleRoot);
            AddFrame(tokenInspectorRoleRoot, "Token Inspector Role Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            if (player == null)
            {
                AddBlankRoleTokenButton(tokenInspectorRoleRoot, "未选", new Vector2(56f, 70f), 58f, false, () => { });
                return;
            }

            var roleId = player.revealed ? player.roleId : player.markedRoleId;
            var roleName = player.revealed ? player.roleName : player.markedRoleName;
            if (string.IsNullOrWhiteSpace(roleId))
            {
                AddBlankRoleTokenButton(tokenInspectorRoleRoot, "未知", new Vector2(56f, 70f), 58f, false, () => SelectDialoguePreset("mark-role"));
                return;
            }

            var role = RoleForId(roleId);
            AddRoleTokenButton(tokenInspectorRoleRoot, roleId, string.IsNullOrWhiteSpace(roleName) ? role?.name : roleName, role?.category ?? "", role?.team ?? "", new Vector2(56f, 70f), 58f, true, () => SelectDialoguePreset("mark-role"));
        }


        private PlayerViewModel SelectedPlayer()
        {
            if (string.IsNullOrWhiteSpace(selectedPlayerId)) return null;
            return (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && player.id == selectedPlayerId);
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


        private void CloseTokenInspector()
        {
            tokenInspectorOpen = false;
            UpdateTokenInspectorActionSuggestions(null);
            ApplyTokenInspectorVisibility();
        }


        private void ApplyTokenInspectorVisibility()
        {
            var hasSelection = SelectedPlayer() != null;
            if (tokenInspectorPanel != null) tokenInspectorPanel.gameObject.SetActive(tokenInspectorOpen && hasSelection);
        }
    }
}
