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
            tokenInspectorPanel = AddPanel("Token Inspector", canvas.transform, new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(190f, 180f), new Vector2(650f, 526f), new Color(0.005f, 0.012f, 0.020f, 0.90f)).GetComponent<RectTransform>();
            AddFrame(tokenInspectorPanel, "Token Inspector Frame", 1f, new Color(0.92f, 0.62f, 0.28f, 0.32f));
            AddImage("Token Inspector Header Wash", tokenInspectorPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -78f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            AddImage("Token Inspector Body Wash", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(18f, 80f), new Vector2(-18f, -94f), new Color(0.020f, 0.028f, 0.036f, 0.28f));
            AddFrame(tokenInspectorPanel.GetChild(tokenInspectorPanel.childCount - 1), "Token Inspector Body Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
            tokenInspectorTitle = AddText("Token Inspector Title", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(22f, 286f), new Vector2(-110f, -14f), "目标详情", 26, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Token Inspector Hint", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(302f, 296f), new Vector2(-86f, -20f), "", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddToolActionButton("收", "关闭", tokenInspectorPanel, new Vector2(412f, 306f), new Vector2(76f, 28f), CloseTokenInspector, true);
            tokenInspectorRoleRoot = AddPanel("Token Inspector Role", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(26f, 114f), new Vector2(-328f, -112f), new Color(0.004f, 0.010f, 0.017f, 0.18f)).GetComponent<RectTransform>();
            tokenInspectorBody = AddText("Token Inspector Body", tokenInspectorPanel, Vector2.zero, Vector2.one, new Vector2(154f, 108f), new Vector2(-28f, -106f), "点击 token 查看公开可见信息。", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            AddToolActionButton("私", "私聊", tokenInspectorPanel, new Vector2(68f, 42f), new Vector2(94f, 32f), () => SelectDialoguePreset("private"), true);
            AddToolActionButton("提", "提名", tokenInspectorPanel, new Vector2(172f, 42f), new Vector2(94f, 32f), () => SelectDialoguePreset("nomination"), true);
            AddToolActionButton("标", "标记", tokenInspectorPanel, new Vector2(276f, 42f), new Vector2(94f, 32f), () => SelectDialoguePreset("mark-role"), true);
            AddToolActionButton("行", "行动", tokenInspectorPanel, new Vector2(380f, 42f), new Vector2(94f, 32f), SelectPrimaryAction, true);
            AddToolActionButton("注", "提醒", tokenInspectorPanel, new Vector2(380f, 82f), new Vector2(94f, 30f), OpenReminderPickerForSelected, true);
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
            RenderGrimoireCenterInfo();
            var players = vm.players ?? Array.Empty<PlayerViewModel>();
            var radius = Mathf.Clamp(Mathf.Min(Screen.width, Screen.height) * 0.383f, 372f, 424f);
            for (var i = 0; i < players.Length; i++)
            {
                var angle = Mathf.PI * 0.5f - Mathf.PI * 2f * i / Mathf.Max(1, players.Length);
                RenderPlayerToken(players[i], new Vector2(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius));
            }
            RenderBluffs();
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

            var hint = AddText("Center Hint", panel.transform, Vector2.zero, Vector2.one, new Vector2(36f, 10f), new Vector2(-36f, -204f), "右键玩家 token 添加提醒", 14, TextAnchor.MiddleCenter, FontStyle.Normal);
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
            rt.sizeDelta = new Vector2(176f, 196f);
            root.GetComponent<Image>().color = new Color(0f, 0f, 0f, 0f);
            root.GetComponent<Button>().onClick.AddListener(() =>
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
            if (!string.IsNullOrWhiteSpace(player.markedRoleId) && (!player.revealed || player.markedRoleId != player.roleId))
            {
                RenderMarkedRoleBadge(root.transform, player);
            }
            if (false && !player.alive)
            {
                var shroud = AddImage("Shroud", root.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-38f, -122f), new Vector2(38f, -28f), Color.white);
                shroud.sprite = SpriteFromResource("Botc/ui/shroud1");
                shroud.preserveAspect = true;
                shroud.raycastTarget = false;
            }
            if (player.suspicion > 0)
            {
                var suspicion = AddPanel("Suspicion", root.transform, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(-66f, -28f), new Vector2(-14f, -5f), new Color(0.025f, 0.019f, 0.014f, 0.84f));
                AddFrame(suspicion.transform, "Suspicion Frame", 0.9f, SuspicionColor(player.suspicion));
                AddText("Suspicion Text", suspicion.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, $"{player.suspicion}%", 15, TextAnchor.MiddleCenter, FontStyle.Bold).color = Color.white;
            }
            var namePlate = AddPanel("Name Plate", root.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-78f, 56f), new Vector2(78f, 88f), new Color(0.12f, 0.060f, 0.024f, 0.92f));
            AddFrame(namePlate.transform, "Name Plate Frame", 0.9f, new Color(0.96f, 0.68f, 0.34f, 0.28f));
            AddText("Name", namePlate.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, player.name, 22, TextAnchor.MiddleCenter, FontStyle.Bold);
            var roleLabel = player.revealed ? player.roleName : "未知";
            if (!string.IsNullOrWhiteSpace(player.markedRoleName) && !player.revealed) roleLabel = $"标记：{player.markedRoleName}";
            var role = AddText("Role Label", root.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-112f, 18f), new Vector2(112f, 54f), roleLabel, 19, TextAnchor.MiddleCenter, FontStyle.Normal);
            role.color = new Color(0.98f, 0.90f, 0.78f, player.revealed ? 0.95f : 0.74f);
            RenderReminders(root.transform, player, position);
            RenderTokenStateMarkers(root.transform, player);
        }


        private void RenderMarkedRoleBadge(Transform tokenRoot, PlayerViewModel player)
        {
            var role = RoleForId(player.markedRoleId);
            var badge = AddImage("Marked Role Badge", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-48f, -108f), new Vector2(48f, -18f), new Color(0.018f, 0.014f, 0.010f, 0.84f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            var halo = AddImage("Marked Role Halo", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-54f, -114f), new Vector2(54f, -12f), RoleHaloColor(role?.category, role?.team, true));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            var icon = AddImage("Marked Role Icon", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-38f, -99f), new Vector2(38f, -29f), Color.white);
            icon.sprite = SpriteFromResource($"Botc/roles/{player.markedRoleId}");
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            if (icon.sprite == null)
            {
                icon.color = new Color(1f, 1f, 1f, 0f);
                var label = AddText("Marked Role Fallback", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-42f, -96f), new Vector2(42f, -32f), RoleFallbackLabel(player.markedRoleId, player.markedRoleName), 28, TextAnchor.MiddleCenter, FontStyle.Bold);
                label.color = new Color(1f, 0.88f, 0.56f, 0.98f);
                label.raycastTarget = false;
            }
            var mark = AddPanel("Marked Role Tag", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-38f, -32f), new Vector2(38f, -8f), new Color(0.10f, 0.060f, 0.026f, 0.92f));
            AddFrame(mark.transform, "Marked Role Tag Frame", 0.85f, new Color(1f, 0.72f, 0.34f, 0.42f));
            var markText = AddText("Marked Role Tag Text", mark.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, "标记", 13, TextAnchor.MiddleCenter, FontStyle.Bold);
            markText.color = new Color(0.98f, 0.82f, 0.44f, 1f);
            mark.GetComponent<Image>().raycastTarget = false;
        }


        private void RenderTokenStateMarkers(Transform tokenRoot, PlayerViewModel player)
        {
            var row = 0;
            if (!player.alive)
            {
                AddTokenStatusBadge(tokenRoot, "亡", new Vector2(-70f, -42f - row * 34f), new Color(0.035f, 0.035f, 0.040f, 0.92f), new Color(0.78f, 0.84f, 0.90f, 0.40f));
                row++;
            }

            if (!player.alive && player.ghostVoteAvailable)
            {
                var ghostVote = AddPanel("Ghost Vote Marker", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(30f, -132f), new Vector2(56f, -106f), new Color(0.94f, 0.96f, 0.96f, 0.96f));
                AddFrame(ghostVote.transform, "Ghost Vote Marker Frame", 1f, new Color(0.02f, 0.025f, 0.030f, 0.92f));
                AddText("Ghost Vote Marker Text", ghostVote.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, "✓", 19, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.030f, 0.035f, 0.040f, 1f);
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
            var tangent = new Vector2(-inward.y, inward.x);
            var tokenCenter = new Vector2(0f, -72f);
            var visibleCount = Mathf.Min(reminders.Length, 5);
            var firstRowCount = Mathf.Min(3, visibleCount);

            for (var i = 0; i < visibleCount; i++)
            {
                var row = i < firstRowCount ? 0 : 1;
                var indexInRow = row == 0 ? i : i - firstRowCount;
                var rowCount = row == 0 ? firstRowCount : visibleCount - firstRowCount;
                var center = tokenCenter
                    + inward * (86f + row * 34f)
                    + tangent * ((indexInRow - (rowCount - 1) * 0.5f) * 36f);
                RenderReminderBadge(tokenRoot, reminders[i], center, i);
            }
        }


        private void RenderReminderBadge(Transform tokenRoot, string reminderLabel, Vector2 center, int index)
        {
            var size = 38f;
            var half = new Vector2(size * 0.5f, size * 0.5f);
            var halo = AddImage($"Reminder Halo {index}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half - new Vector2(3f, 3f), center + half + new Vector2(3f, 3f), new Color(0.02f, 0.012f, 0.006f, 0.62f));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            var reminder = AddImage($"Reminder {index}", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), center - half, center + half, Color.white);
            reminder.sprite = SpriteFromResource("Botc/ui/reminder1") ?? SpriteFromResource("Botc/ui/token1") ?? GetCircleFillSprite();
            reminder.preserveAspect = true;
            reminder.raycastTarget = false;
            var text = AddText("Reminder Text", reminder.transform, Vector2.zero, Vector2.one, new Vector2(3f, 4f), new Vector2(-3f, -4f), ReminderShort(reminderLabel), 10, TextAnchor.MiddleCenter, FontStyle.Bold);
            text.color = new Color(0.08f, 0.045f, 0.025f, 0.96f);
            text.raycastTarget = false;
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
                tokenInspectorBody.text = "点击魔典 token 查看公开可见信息。";
                RenderTokenInspectorRole(null);
                return;
            }

            tokenInspectorTitle.text = $"目标 · {player.name}";
            RenderTokenInspectorRole(player);
            var role = player.revealed
                ? string.IsNullOrWhiteSpace(player.roleName) ? "未知" : player.roleName
                : !string.IsNullOrWhiteSpace(player.markedRoleName) ? $"标记：{player.markedRoleName}" : "未知";
            var state = $"{(player.alive ? "存活" : "死亡")} / {(player.ghostVoteAvailable ? "有鬼票" : "无鬼票")}";
            var lines = new List<string>
            {
                $"☷ 身份  {role}",
                $"{(player.alive ? "◉" : "×")} 状态  {state}",
                $"◇ 怀疑  {player.suspicion}%",
            };
            if (!string.IsNullOrWhiteSpace(player.perceivedRoleId) && player.human) lines.Add($"✦ 认知  {RoleNameForId(player.perceivedRoleId)}");
            if (player.reminders != null && player.reminders.Length > 0) lines.Add($"✎ 提醒  {string.Join(" / ", player.reminders.Take(3))}");
            lines.Add(player.human ? "主视角 token。行动会以这个视角提交。" : "快捷工具在下方，可直接私聊、提名、标记或行动。");
            lines.Add(player.revealed ? "身份已公开。" : "未公开身份不会泄露真实底牌。");
            tokenInspectorBody.text = ClampTextLines(lines, 8, 36);
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
            ApplyTokenInspectorVisibility();
        }


        private void ApplyTokenInspectorVisibility()
        {
            var hasSelection = SelectedPlayer() != null;
            if (tokenInspectorPanel != null) tokenInspectorPanel.gameObject.SetActive(tokenInspectorOpen && hasSelection);
        }
    }
}
