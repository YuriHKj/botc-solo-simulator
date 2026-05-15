using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private sealed class ReminderChoice
        {
            public readonly string label;
            public readonly string icon;
            public readonly string tone;
            public readonly string roleId;
            public readonly string roleName;

            public ReminderChoice(string label, string icon, string tone = "", string roleId = "", string roleName = "")
            {
                this.label = label ?? "";
                this.icon = string.IsNullOrWhiteSpace(icon) ? ReminderShort(label) : icon;
                this.tone = tone ?? "";
                this.roleId = roleId ?? "";
                this.roleName = roleName ?? "";
            }
        }

        private void BuildReminderPickerPanel()
        {
            reminderPickerPanel = AddPanel("Reminder Picker Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-760f, -380f), new Vector2(760f, 380f), new Color(0.001f, 0.004f, 0.007f, 0.965f)).GetComponent<RectTransform>();
            AddFrame(reminderPickerPanel, "Reminder Picker Frame", 1.2f, new Color(0.92f, 0.62f, 0.28f, 0.42f));
            AddImage("Reminder Picker Header Wash", reminderPickerPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -88f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.075f));
            reminderPickerTitle = AddText("Reminder Picker Title", reminderPickerPanel, Vector2.zero, Vector2.one, new Vector2(34f, 688f), new Vector2(-138f, -14f), "选择提醒标记", 36, TextAnchor.UpperCenter, FontStyle.Bold);
            AddToolActionButton("关", "关闭", reminderPickerPanel, new Vector2(1450f, 714f), new Vector2(100f, 36f), CloseReminderPicker, true);
            reminderPickerStatusText = AddText("Reminder Picker Status", reminderPickerPanel, Vector2.zero, Vector2.one, new Vector2(48f, 628f), new Vector2(-48f, -94f), "右键玩家 token 可快速打开此面板。", 16, TextAnchor.UpperCenter, FontStyle.Normal);

            reminderPickerPreviewRoot = AddPanel("Reminder Picker Preview", reminderPickerPanel, Vector2.zero, Vector2.one, new Vector2(34f, 118f), new Vector2(-1224f, -130f), new Color(0.006f, 0.010f, 0.014f, 0.52f)).GetComponent<RectTransform>();
            AddFrame(reminderPickerPreviewRoot, "Reminder Preview Frame", 0.9f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            reminderPickerGridRoot = AddPanel("Reminder Picker Grid", reminderPickerPanel, Vector2.zero, Vector2.one, new Vector2(324f, 118f), new Vector2(-34f, -130f), new Color(0.006f, 0.010f, 0.014f, 0.44f)).GetComponent<RectTransform>();
            AddFrame(reminderPickerGridRoot, "Reminder Grid Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));

            AddText("Reminder Custom Label", reminderPickerPanel, Vector2.zero, Vector2.one, new Vector2(334f, 78f), new Vector2(-1054f, -660f), "自定义注释", 16, TextAnchor.MiddleLeft, FontStyle.Bold);
            reminderCustomInput = AddInputField("Reminder Custom Input", reminderPickerPanel, new Vector2(454f, 42f), new Vector2(936f, 82f), "例如：硬保 5 号 / 第2天口径矛盾 / 可能中毒");
            AddButton("添加", reminderPickerPanel, new Vector2(1004f, 62f), new Vector2(104f, 36f), ApplyCustomReminder);
            AddButton("标记角色", reminderPickerPanel, new Vector2(1132f, 62f), new Vector2(124f, 36f), OpenRoleMarkPickerFromReminderPicker);
            AddButton("清空备注", reminderPickerPanel, new Vector2(1274f, 62f), new Vector2(124f, 36f), ClearActiveReminderNote);
            AddButton("关闭", reminderPickerPanel, new Vector2(1404f, 62f), new Vector2(104f, 36f), CloseReminderPicker);
            reminderPickerPanel.gameObject.SetActive(false);
        }

        private void OpenReminderPickerForSelected()
        {
            var target = SelectedPlayer();
            if (target == null)
            {
                dialogueTitle.text = "提醒标记";
                dialogueBody.text = "请先选择一名玩家 token，或直接右键 token 打开提醒选择器。";
                return;
            }
            OpenReminderPickerForPlayer(target);
        }

        private void OpenReminderPickerForPlayer(PlayerViewModel player)
        {
            if (player == null) return;
            selectedPlayerId = player.id ?? "";
            activeReminderPlayerId = selectedPlayerId;
            activeReminderPage = 0;
            selectionPulseStartTime = Time.realtimeSinceStartup;
            SendUnityAction("select-token", selectedPlayerId, "", "", "", trackPending: false);
            RenderReminderPickerPanel();
            ShowModalPanel(reminderPickerPanel);
            tokenInspectorOpen = true;
            UpdateTokenInspectorText(player);
            ApplyTokenInspectorVisibility();
            RenderGrimoire();
            bottomDockOpen = true;
            ApplyBottomDockVisibility();
        }

        private void CloseReminderPicker()
        {
            if (reminderPickerPanel != null) reminderPickerPanel.gameObject.SetActive(false);
            activeReminderPlayerId = "";
            activeReminderPage = 0;
            ApplyModalBackdropVisibility();
        }

        private PlayerViewModel ActiveReminderPlayer()
        {
            var playerId = string.IsNullOrWhiteSpace(activeReminderPlayerId) ? selectedPlayerId : activeReminderPlayerId;
            if (string.IsNullOrWhiteSpace(playerId)) return null;
            return (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && player.id == playerId);
        }

        private void RenderReminderPickerPanel()
        {
            if (reminderPickerGridRoot == null || reminderPickerPreviewRoot == null) return;
            ClearChildren(reminderPickerGridRoot);
            ClearChildren(reminderPickerPreviewRoot);
            AddFrame(reminderPickerGridRoot, "Reminder Grid Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
            AddFrame(reminderPickerPreviewRoot, "Reminder Preview Frame", 0.9f, new Color(0.86f, 0.58f, 0.26f, 0.20f));

            var target = ActiveReminderPlayer();
            if (reminderPickerTitle != null) reminderPickerTitle.text = target == null ? "选择提醒标记" : $"为 {target.name} 选择提醒标记";
            if (reminderPickerStatusText != null)
            {
                var reminders = target?.reminders ?? Array.Empty<string>();
                var roleSourceCount = VisibleClaimedOrMarkedRoles(target).Count();
                reminderPickerStatusText.text = target == null
                    ? "先选择玩家 token。"
                    : $"官方式提醒 token · 已有提醒 {reminders.Length}/5 · 可用角色来源 {roleSourceCount} 个 · 点击已有标记可移除";
            }

            RenderReminderPreview(target);

            var choices = ReminderChoicesForPlayer(target);
            activeReminderPage = ClampPage(activeReminderPage, choices.Length, ReminderPickerPageSize);
            var pageStart = activeReminderPage * ReminderPickerPageSize;
            var pageChoices = choices.Skip(pageStart).Take(ReminderPickerPageSize).ToArray();
            var columns = 10;
            var startX = 58f;
            var startY = 372f;
            var spacingX = 108f;
            var spacingY = 128f;
            for (var i = 0; i < pageChoices.Length; i++)
            {
                var choice = pageChoices[i];
                var col = i % columns;
                var row = i / columns;
                var active = PlayerHasReminder(target, choice.label);
                AddReminderTokenButton(
                    reminderPickerGridRoot,
                    choice,
                    new Vector2(startX + col * spacingX, startY - row * spacingY),
                    72f,
                    active,
                    () => ApplyReminderChoice(choice.label, active)
                );
            }

            RenderReminderPickerPager(choices.Length);
        }

        private void RenderReminderPreview(PlayerViewModel target)
        {
            AddText("Reminder Preview Title", reminderPickerPreviewRoot, Vector2.zero, Vector2.one, new Vector2(22f, 430f), new Vector2(-22f, -16f), "目标玩家", 22, TextAnchor.UpperLeft, FontStyle.Bold);
            if (target == null)
            {
                AddBlankRoleTokenButton(reminderPickerPreviewRoot, "未选", new Vector2(135f, 270f), 106f, false, () => { });
                AddText("Reminder Preview Empty", reminderPickerPreviewRoot, Vector2.zero, Vector2.one, new Vector2(22f, 74f), new Vector2(-22f, -358f), "选择玩家后，可给他添加提醒、注释或角色相关标记。", 15, TextAnchor.UpperLeft, FontStyle.Normal);
                return;
            }

            var token = AddImage("Reminder Preview Token", reminderPickerPreviewRoot, Vector2.zero, Vector2.one, new Vector2(78f, 254f), new Vector2(-78f, -80f), Color.white);
            token.sprite = SpriteFromResource(target.revealed ? "Botc/ui/token1" : "Botc/ui/vote1") ?? GetCircleFillSprite();
            token.preserveAspect = true;
            token.raycastTarget = false;
            var roleId = target.revealed ? target.roleId : target.markedRoleId;
            if (!string.IsNullOrWhiteSpace(roleId))
            {
                var icon = AddImage("Reminder Preview Role", reminderPickerPreviewRoot, Vector2.zero, Vector2.one, new Vector2(116f, 306f), new Vector2(-116f, -132f), Color.white);
                icon.sprite = SpriteFromResource($"Botc/roles/{roleId}");
                icon.preserveAspect = true;
                icon.raycastTarget = false;
                if (icon.sprite == null) icon.color = new Color(1f, 1f, 1f, 0f);
            }
            AddText("Reminder Preview Seat", reminderPickerPreviewRoot, Vector2.zero, Vector2.one, new Vector2(74f, 184f), new Vector2(-74f, -244f), target.name, 28, TextAnchor.MiddleCenter, FontStyle.Bold);
            var roleName = target.revealed ? target.roleName : string.IsNullOrWhiteSpace(target.markedRoleName) ? "未知身份" : $"标记：{target.markedRoleName}";
            AddText("Reminder Preview Role Text", reminderPickerPreviewRoot, Vector2.zero, Vector2.one, new Vector2(24f, 136f), new Vector2(-24f, -296f), roleName, 18, TextAnchor.MiddleCenter, FontStyle.Normal).color = new Color(0.98f, 0.90f, 0.78f, 0.92f);
            var reminders = target.reminders == null || target.reminders.Length == 0 ? "暂无提醒" : string.Join(" / ", target.reminders.Take(5));
            AddText("Reminder Preview Reminders", reminderPickerPreviewRoot, Vector2.zero, Vector2.one, new Vector2(22f, 22f), new Vector2(-22f, -384f), ClampTextBlock($"当前提醒：{reminders}", 3, 18), 15, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.86f, 0.90f, 0.92f, 0.92f);
        }

        private ReminderChoice[] ReminderChoicesForPlayer(PlayerViewModel target)
        {
            var choices = new List<ReminderChoice>();
            AddReminderChoice(choices, "是学徒", "徒", "good");
            AddReminderChoice(choices, "干扰项", "扰", "info");
            AddReminderChoice(choices, "死于今日", "亡", "death");
            AddReminderChoice(choices, "醉酒", "醉", "info");
            AddReminderChoice(choices, "中毒", "毒", "evil");
            AddReminderChoice(choices, "被选择", "选", "info");
            AddReminderChoice(choices, "得知", "知", "good");
            AddReminderChoice(choices, "已验证", "验", "good");
            AddReminderChoice(choices, "口径矛盾", "矛", "evil");
            AddReminderChoice(choices, "重点怀疑", "疑", "evil");
            AddReminderChoice(choices, "可信", "信", "good");
            AddReminderChoice(choices, "保护", "护", "good");
            AddReminderChoice(choices, "失去能力", "失", "evil");
            AddReminderChoice(choices, "限一次", "一", "info");
            AddReminderChoice(choices, "善良", "善", "good");
            AddReminderChoice(choices, "邪恶", "邪", "evil");

            foreach (var role in VisibleClaimedOrMarkedRoles(target))
            {
                AddRoleReminderChoices(choices, role);
            }
            AddReminderChoice(choices, "自定义", "＋", "custom");
            return choices.ToArray();
        }

        private IEnumerable<ScriptRoleViewModel> VisibleClaimedOrMarkedRoles(PlayerViewModel priorityTarget)
        {
            var orderedIds = new List<string>();

            AddUniqueRoleId(orderedIds, priorityTarget?.markedRoleId);
            AddUniqueRoleId(orderedIds, priorityTarget?.roleId);
            foreach (var player in vm?.players ?? Array.Empty<PlayerViewModel>())
            {
                if (player == null) continue;
                AddUniqueRoleId(orderedIds, player.markedRoleId);
                AddUniqueRoleId(orderedIds, player.roleId);
            }

            foreach (var roleId in orderedIds)
            {
                var role = RoleForId(roleId);
                if (role != null) yield return role;
            }
        }

        private static void AddUniqueRoleId(List<string> orderedIds, string roleId)
        {
            if (orderedIds == null || string.IsNullOrWhiteSpace(roleId)) return;
            if (orderedIds.Any((entry) => entry == roleId)) return;
            orderedIds.Add(roleId);
        }

        private void AddRoleReminderChoices(List<ReminderChoice> choices, ScriptRoleViewModel role)
        {
            if (role == null) return;
            var tone = RoleReminderTone(role);
            foreach (var reminder in (role.reminders ?? Array.Empty<string>()).Concat(role.remindersGlobal ?? Array.Empty<string>()))
            {
                if (string.IsNullOrWhiteSpace(reminder)) continue;
                AddReminderChoice(choices, reminder.Trim(), ReminderShort(reminder), tone, role.id, role.name);
            }
        }

        private static string RoleReminderTone(ScriptRoleViewModel role)
        {
            if (role == null) return "info";
            if (role.team == "evil" || role.category == "minion" || role.category == "demon") return "evil";
            if (role.category == "outsider") return "info";
            return "good";
        }

        private static void AddReminderChoice(List<ReminderChoice> choices, string label, string icon, string tone, string roleId = "", string roleName = "")
        {
            if (choices == null || string.IsNullOrWhiteSpace(label)) return;
            var clean = label.Trim();
            var cleanRoleId = roleId ?? "";
            if (choices.Any((entry) => entry.label == clean && entry.roleId == cleanRoleId)) return;
            choices.Add(new ReminderChoice(clean, icon, tone, cleanRoleId, roleName));
        }

        private bool PlayerHasReminder(PlayerViewModel target, string reminder)
        {
            return target?.reminders != null && target.reminders.Any((entry) => entry == reminder);
        }

        private void ApplyReminderChoice(string reminder, bool remove)
        {
            if (string.IsNullOrWhiteSpace(reminder)) return;
            if (reminder == "自定义")
            {
                if (reminderCustomInput != null) reminderCustomInput.ActivateInputField();
                if (reminderPickerStatusText != null) reminderPickerStatusText.text = "在底部输入自定义注释后点击“添加”。";
                return;
            }
            var target = ActiveReminderPlayer();
            if (target == null)
            {
                if (reminderPickerStatusText != null) reminderPickerStatusText.text = "请先选择一个玩家 token。";
                return;
            }

            SendUnityAction("grimoire-reminder", playerId: target.id, reminder: reminder, mode: remove ? "remove" : "");
            if (reminderPickerStatusText != null)
            {
                reminderPickerStatusText.text = remove
                    ? $"已请求移除 {target.name} 的“{reminder}”。"
                    : $"已请求给 {target.name} 添加“{reminder}”。";
            }
        }

        private void ApplyCustomReminder()
        {
            var text = reminderCustomInput == null ? "" : reminderCustomInput.text.Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                if (reminderPickerStatusText != null) reminderPickerStatusText.text = "自定义注释不能为空。";
                return;
            }
            ApplyReminderChoice(text, false);
            if (reminderCustomInput != null) reminderCustomInput.text = "";
        }

        private void ClearActiveReminderNote()
        {
            var target = ActiveReminderPlayer();
            if (target == null)
            {
                if (reminderPickerStatusText != null) reminderPickerStatusText.text = "请先选择一个玩家 token。";
                return;
            }
            SendUnityAction("grimoire-reminder", playerId: target.id, mode: "clear");
            if (reminderPickerStatusText != null) reminderPickerStatusText.text = $"已请求清空 {target.name} 的魔典备注。";
        }

        private void OpenRoleMarkPickerFromReminderPicker()
        {
            var target = ActiveReminderPlayer();
            if (target == null)
            {
                if (reminderPickerStatusText != null) reminderPickerStatusText.text = "请先选择一个玩家 token。";
                return;
            }

            selectedPlayerId = target.id ?? "";
            activeReminderPlayerId = "";
            reopenReminderPickerAfterRoleMark = true;
            if (reminderPickerPanel != null) reminderPickerPanel.gameObject.SetActive(false);
            OpenGrimoireRoleMarkPicker();
        }

        private void RenderReminderPickerPager(int totalCount)
        {
            if (reminderPickerGridRoot == null) return;
            var totalPages = PageCount(totalCount, ReminderPickerPageSize);
            AddText("Reminder Picker Page", reminderPickerGridRoot, Vector2.zero, Vector2.zero, new Vector2(370f, 20f), new Vector2(790f, 52f), $"第 {activeReminderPage + 1}/{totalPages} 页 · {totalCount} 个提醒", 13, TextAnchor.MiddleCenter, FontStyle.Normal).color = new Color(0.84f, 0.88f, 0.90f, 0.86f);
            if (totalPages <= 1) return;
            var prev = AddToolActionButton("上", "上一页", reminderPickerGridRoot, new Vector2(310f, 36f), new Vector2(96f, 28f), () => ChangeReminderPickerPage(-1), true);
            var next = AddToolActionButton("下", "下一页", reminderPickerGridRoot, new Vector2(850f, 36f), new Vector2(96f, 28f), () => ChangeReminderPickerPage(1), true);
            SetToolButtonEnabled(prev, activeReminderPage > 0);
            SetToolButtonEnabled(next, activeReminderPage < totalPages - 1);
        }

        private void ChangeReminderPickerPage(int delta)
        {
            activeReminderPage = ClampPage(activeReminderPage + delta, ReminderChoicesForPlayer(ActiveReminderPlayer()).Length, ReminderPickerPageSize);
            RenderReminderPickerPanel();
        }

        private Button AddReminderTokenButton(Transform parent, ReminderChoice choice, Vector2 center, float tokenSize, bool selected, UnityEngine.Events.UnityAction onClick)
        {
            var safeChoice = choice ?? new ReminderChoice("未知", "?");
            var width = tokenSize + 24f;
            var height = tokenSize + 38f;
            var root = AddPanel($"Reminder Token {safeChoice.label}", parent, Vector2.zero, Vector2.zero, center - new Vector2(width, height) * 0.5f, center + new Vector2(width, height) * 0.5f, new Color(0f, 0f, 0f, 0f));
            var rootImage = root.GetComponent<Image>();
            rootImage.raycastTarget = true;
            var button = root.AddComponent<Button>();
            button.targetGraphic = rootImage;
            ApplyButtonStyle(button);
            button.onClick.AddListener(onClick);

            var toneColor = ReminderToneColor(safeChoice.tone, selected);
            var tokenBottom = 30f;
            var halo = AddImage("Reminder Halo", root.transform, Vector2.zero, Vector2.zero, new Vector2(4f, tokenBottom - 8f), new Vector2(width - 4f, tokenBottom + tokenSize + 8f), toneColor);
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;

            var token = AddImage("Reminder Parchment", root.transform, Vector2.zero, Vector2.zero, new Vector2(10f, tokenBottom), new Vector2(width - 10f, tokenBottom + tokenSize), Color.white);
            token.sprite = SpriteFromResource("Botc/ui/token1") ?? SpriteFromResource("Botc/ui/reminder1") ?? GetCircleFillSprite();
            token.preserveAspect = true;
            token.raycastTarget = false;

            var roleSprite = string.IsNullOrWhiteSpace(safeChoice.roleId) ? null : SpriteFromResource($"Botc/roles/{safeChoice.roleId}");
            if (roleSprite != null)
            {
                var roleIcon = AddImage("Reminder Role Icon", root.transform, Vector2.zero, Vector2.zero, new Vector2(20f, tokenBottom + 12f), new Vector2(width - 20f, tokenBottom + tokenSize - 18f), Color.white);
                roleIcon.sprite = roleSprite;
                roleIcon.preserveAspect = true;
                roleIcon.raycastTarget = false;
            }
            else
            {
                var icon = AddText("Reminder Icon", root.transform, Vector2.zero, Vector2.zero, new Vector2(20f, tokenBottom + 16f), new Vector2(width - 20f, tokenBottom + tokenSize - 18f), safeChoice.icon, Mathf.RoundToInt(tokenSize * 0.24f), TextAnchor.MiddleCenter, FontStyle.Bold);
                icon.color = ReminderIconColor(safeChoice.tone);
                icon.raycastTarget = false;
            }

            if (selected)
            {
                var selectedBadge = AddImage("Reminder Selected Badge", root.transform, Vector2.zero, Vector2.zero, new Vector2(width - 36f, tokenBottom + tokenSize - 24f), new Vector2(width - 12f, tokenBottom + tokenSize), new Color(0.15f, 0.085f, 0.030f, 0.96f));
                selectedBadge.sprite = GetCircleFillSprite();
                selectedBadge.preserveAspect = true;
                selectedBadge.raycastTarget = false;
                AddText("Reminder Selected Text", selectedBadge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, "✓", 13, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.84f, 0.42f, 1f);
            }

            var label = AddText("Reminder Label", root.transform, Vector2.zero, Vector2.zero, new Vector2(0f, 0f), new Vector2(width, 30f), Ellipsize(safeChoice.label, tokenSize < 70f ? 5 : 6), tokenSize < 70f ? 12 : 13, TextAnchor.MiddleCenter, FontStyle.Bold);
            label.color = selected ? new Color(1f, 0.84f, 0.42f, 1f) : new Color(0.95f, 0.89f, 0.76f, 0.98f);
            return button;
        }

        private static Color ReminderToneColor(string tone, bool selected)
        {
            if (selected) return new Color(1f, 0.74f, 0.22f, 0.82f);
            if (tone == "evil") return new Color(0.86f, 0.10f, 0.12f, 0.62f);
            if (tone == "death") return new Color(0.76f, 0.78f, 0.82f, 0.42f);
            if (tone == "good") return new Color(0.18f, 0.50f, 0.95f, 0.54f);
            if (tone == "custom") return new Color(0.92f, 0.70f, 0.32f, 0.50f);
            return new Color(0.20f, 0.58f, 0.72f, 0.46f);
        }

        private static Color ReminderIconColor(string tone)
        {
            if (tone == "evil") return new Color(0.68f, 0.04f, 0.08f, 1f);
            if (tone == "death") return new Color(0.18f, 0.19f, 0.22f, 1f);
            if (tone == "good") return new Color(0.05f, 0.38f, 0.86f, 1f);
            if (tone == "custom") return new Color(0.54f, 0.34f, 0.08f, 1f);
            return new Color(0.05f, 0.42f, 0.64f, 1f);
        }
    }
}
