using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private void BuildRolePickerPanel()
        {
            rolePickerPanel = AddPanel("Role Picker Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-760f, -380f), new Vector2(760f, 380f), new Color(0.001f, 0.004f, 0.007f, 0.96f)).GetComponent<RectTransform>();
            AddFrame(rolePickerPanel, "Role Picker Frame", 1.2f, new Color(0.92f, 0.62f, 0.28f, 0.40f));
            AddImage("Role Picker Header Wash", rolePickerPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -82f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            rolePickerTitle = AddText("Role Picker Title", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(34f, 690f), new Vector2(-124f, -14f), "选择角色", 36, TextAnchor.UpperCenter, FontStyle.Bold);
            AddToolActionButton("关", "关闭", rolePickerPanel, new Vector2(1450f, 714f), new Vector2(100f, 36f), CloseRolePicker, true);
            rolePickerStatusText = AddText("Role Picker Status", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(48f, 628f), new Vector2(-48f, -94f), "选择一个身份标记。", 16, TextAnchor.UpperCenter, FontStyle.Normal);
            rolePickerGridRoot = AddPanel("Role Picker Grid", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(40f, 96f), new Vector2(-40f, -132f), new Color(0.006f, 0.010f, 0.014f, 0.44f)).GetComponent<RectTransform>();
            AddFrame(rolePickerGridRoot, "Role Picker Grid Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
            rolePickerSignalRoot = AddPanel("Role Picker Signal Strip", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(260f, 60f), new Vector2(-260f, -672f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            AddText("Role Picker Category Hint", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(48f, 30f), new Vector2(-48f, -706f), "蓝色：好人阵营    红色：邪恶阵营    金色外圈表示当前选择", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
            rolePickerPanel.gameObject.SetActive(false);
        }

        private void OpenPrivateClaimRolePicker()
        {
            activeRolePickerMode = "private-claim";
            activeRolePickerPlayerId = selectedPlayerId;
            activeRolePickerCategory = "all";
            activeRolePickerPage = 0;
            RenderRolePickerPanel();
            ShowModalPanel(rolePickerPanel);
        }

        private void OpenGrimoireRoleMarkPicker()
        {
            var target = SelectedPlayer();
            if (target == null)
            {
                dialogueTitle.text = "标记身份";
                dialogueBody.text = "请先选择一名玩家，再打开角色图标标记器。";
                return;
            }
            activeRolePickerMode = "mark-role";
            activeRolePickerPlayerId = target.id;
            activeRolePickerCategory = "all";
            activeRolePickerPage = 0;
            RenderRolePickerPanel();
            ShowModalPanel(rolePickerPanel);
        }

        private void OpenActionFormRolePicker()
        {
            var form = ActiveActionForm();
            if (form == null || !NeedsRole(form))
            {
                dialogueTitle.text = "选择身份";
                dialogueBody.text = "当前行动不需要选择身份。";
                return;
            }
            activeRolePickerMode = "action-form-role";
            activeRolePickerPlayerId = "";
            activeRolePickerCategory = "all";
            activeRolePickerPage = 0;
            RenderRolePickerPanel();
            ShowModalPanel(rolePickerPanel);
        }

        private void CloseRolePicker()
        {
            if (rolePickerPanel != null) rolePickerPanel.gameObject.SetActive(false);
            activeRolePickerMode = "";
            activeRolePickerPlayerId = "";
            activeRolePickerCategory = "all";
            activeRolePickerPage = 0;
            reopenReminderPickerAfterRoleMark = false;
            ApplyModalBackdropVisibility();
        }

        private void RenderRolePickerPanel()
        {
            if (rolePickerGridRoot == null) return;
            for (var i = rolePickerGridRoot.childCount - 1; i >= 0; i--) Destroy(rolePickerGridRoot.GetChild(i).gameObject);
            AddFrame(rolePickerGridRoot, "Role Picker Grid Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));

            var allRoles = RolePickerSourceRoles();
            var roles = allRoles
                .Where((role) => RolePickerCategoryMatches(role, activeRolePickerCategory))
                .ToArray();
            activeRolePickerPage = ClampPage(activeRolePickerPage, roles.Length, RolePickerPageSize);
            var target = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && player.id == activeRolePickerPlayerId);
            var selectedRoleId = activeRolePickerMode == "private-claim"
                ? SelectedPrivateClaimRoleId()
                : activeRolePickerMode == "action-form-role" ? selectedActionRoleId : target?.markedRoleId ?? "";
            var pageStart = activeRolePickerPage * RolePickerPageSize;
            var pageRoles = roles.Skip(pageStart).Take(RolePickerPageSize).ToArray();
            var pageRange = RolePickerPageRangeLabel(roles.Length, pageStart, pageRoles.Length);
            RenderRolePickerSignalStrip(allRoles.Length, roles.Length, pageStart, pageRoles.Length, selectedRoleId, target);

            if (rolePickerTitle != null)
            {
                rolePickerTitle.text = activeRolePickerMode == "action-form-role"
                    ? $"为行动选择身份 · {ActiveActionForm()?.title ?? "行动"}"
                    : activeRolePickerMode == "mark-role"
                    ? $"为玩家 {target?.name ?? "未选择"} 选择标记身份"
                    : "选择私聊声称身份";
            }
            if (rolePickerStatusText != null)
            {
                var currentRoleName = string.IsNullOrWhiteSpace(selectedRoleId)
                    ? (activeRolePickerMode == "mark-role" ? "未标记" : "不声称")
                    : RoleNameForId(selectedRoleId);
                if (activeRolePickerMode == "action-form-role" && string.IsNullOrWhiteSpace(selectedRoleId)) currentRoleName = "未选择";
                rolePickerStatusText.text = activeRolePickerMode == "action-form-role"
                    ? $"当前行动身份：{currentRoleName}  ·  {RolePickerCategoryLabel(activeRolePickerCategory)} {roles.Length}/{allRoles.Length}  ·  {pageRange}"
                    : activeRolePickerMode == "mark-role"
                    ? $"目标：{target?.name ?? "未选择"}  ·  当前标记：{currentRoleName}  ·  {RolePickerCategoryLabel(activeRolePickerCategory)} {roles.Length}/{allRoles.Length}  ·  {pageRange}"
                    : $"当前声称：{currentRoleName}  ·  {RolePickerCategoryLabel(activeRolePickerCategory)} {roles.Length}/{allRoles.Length}  ·  {pageRange}";
            }

            RenderRolePickerCategoryTabs(allRoles);

            var columns = 10;
            var startX = 78f;
            var startY = 350f;
            var spacingX = 132f;
            var spacingY = 124f;
            RenderRolePickerSelectionSummary(target, selectedRoleId, roles, pageStart, pageRoles.Length);
            for (var i = 0; i < pageRoles.Length; i++)
            {
                var role = pageRoles[i];
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
                    78f,
                    selectedRoleId == role.id,
                    () => ApplyRolePickerChoice(roleId)
                );
            }

            var blankLabel = activeRolePickerMode == "mark-role" ? "清除" : "不声称";
            if (activeRolePickerMode == "action-form-role") blankLabel = "清空";
            RenderRolePickerBottomActionStrip(selectedRoleId, blankLabel);
            AddBlankRoleTokenButton(rolePickerGridRoot, blankLabel, new Vector2(1376f, 48f), 72f, string.IsNullOrWhiteSpace(selectedRoleId), () => ApplyRolePickerChoice(""));
            RenderRolePickerPager(roles.Length, pageStart, pageRoles.Length);
        }

        private void RenderRolePickerSignalStrip(int totalCount, int filteredCount, int pageStart, int pageCount, string selectedRoleId, PlayerViewModel target)
        {
            if (rolePickerSignalRoot == null) return;
            ClearChildren(rolePickerSignalRoot);
            AddRolePickerSignalChip("M", "Mode", RolePickerModeSignalLabel(target), 0f, 150f, new Color(0.040f, 0.052f, 0.064f, 0.74f), new Color(0.62f, 0.78f, 0.92f, 0.20f));
            AddRolePickerSignalChip("F", "Filter", RolePickerFilterSignalLabel(totalCount, filteredCount), 160f, 170f, new Color(0.052f, 0.042f, 0.028f, 0.76f), new Color(0.96f, 0.68f, 0.30f, 0.25f));
            AddRolePickerSignalChip("P", "Page", RolePickerPageSignalLabel(filteredCount, pageStart, pageCount), 340f, 166f, new Color(0.040f, 0.060f, 0.072f, 0.74f), new Color(0.52f, 0.76f, 1f, 0.22f));
            AddRolePickerSignalChip("S", "Pick", RolePickerSelectionSignalLabel(selectedRoleId), 516f, 220f, new Color(0.044f, 0.064f, 0.048f, 0.74f), new Color(0.76f, 0.92f, 0.52f, 0.22f));
        }

        private void AddRolePickerSignalChip(string icon, string label, string value, float x, float width, Color fill, Color border)
        {
            if (rolePickerSignalRoot == null) return;
            var chip = AddPanel($"Role Picker Signal Chip {label}", rolePickerSignalRoot, Vector2.zero, Vector2.zero, new Vector2(x, 0f), new Vector2(x + width, 26f), fill);
            AddFrame(chip.transform, "Role Picker Signal Chip Frame", 0.65f, border);
            var badge = AddImage("Role Picker Signal Badge", chip.transform, Vector2.zero, Vector2.zero, new Vector2(6f, 5f), new Vector2(22f, 21f), new Color(0.008f, 0.012f, 0.016f, 0.78f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            AddText("Role Picker Signal Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, 9, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("Role Picker Signal Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(28f, 13f), new Vector2(-6f, -3f), label, 8, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.70f, 0.78f, 0.82f, 0.76f);
            AddText("Role Picker Signal Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(28f, 2f), new Vector2(-6f, -14f), Ellipsize(value, Mathf.Max(4, Mathf.FloorToInt(width / 12f))), 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            SetRaycastTargetsExceptButtons(chip.transform);
        }

        private string RolePickerModeSignalLabel(PlayerViewModel target)
        {
            if (activeRolePickerMode == "action-form-role") return "Action role";
            if (activeRolePickerMode == "mark-role") return target == null || target.seat <= 0 ? "Mark target" : $"Mark S{target.seat}";
            return "Private claim";
        }

        private string RolePickerFilterSignalLabel(int totalCount, int filteredCount)
        {
            var category = RolePickerCategoryLabel(activeRolePickerCategory);
            return $"{category} {filteredCount}/{Mathf.Max(0, totalCount)}";
        }

        private string RolePickerPageSignalLabel(int filteredCount, int pageStart, int pageCount)
        {
            var totalPages = PageCount(filteredCount, RolePickerPageSize);
            if (filteredCount <= 0 || pageCount <= 0) return "0/0";
            return $"{activeRolePickerPage + 1}/{totalPages} {pageStart + 1}-{pageStart + pageCount}";
        }

        private string RolePickerSelectionSignalLabel(string selectedRoleId)
        {
            if (string.IsNullOrWhiteSpace(selectedRoleId))
            {
                if (activeRolePickerMode == "mark-role") return "Unmarked";
                if (activeRolePickerMode == "action-form-role") return "None";
                return "No claim";
            }
            return RoleNameForId(selectedRoleId);
        }

        private ScriptRoleViewModel[] RolePickerSourceRoles()
        {
            if (activeRolePickerMode == "action-form-role")
            {
                return ActionRoleChoices(ActiveActionForm())
                    .Where((role) => role != null && !string.IsNullOrWhiteSpace(role.id))
                    .Select((role) =>
                    {
                        var handbookRole = RoleForId(role.id);
                        return new ScriptRoleViewModel
                        {
                            id = role.id,
                            name = string.IsNullOrWhiteSpace(role.name) ? handbookRole?.name : role.name,
                            category = string.IsNullOrWhiteSpace(role.category) ? handbookRole?.category : role.category,
                            team = string.IsNullOrWhiteSpace(role.team) ? handbookRole?.team : role.team,
                            ability = handbookRole?.ability,
                            icon = handbookRole?.icon
                        };
                    })
                    .OrderBy((role) => CategorySort(role.category ?? ""))
                    .ThenBy((role) => role.name ?? role.id ?? "")
                    .ToArray();
            }

            return (vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>())
                .Where((role) => role != null && !string.IsNullOrWhiteSpace(role.id))
                .OrderBy((role) => CategorySort(role.category ?? ""))
                .ThenBy((role) => role.name ?? role.id ?? "")
                .ToArray();
        }

        private void RenderRolePickerCategoryTabs(ScriptRoleViewModel[] allRoles)
        {
            if (rolePickerGridRoot == null) return;
            AddText("Role Picker Filter Label", rolePickerGridRoot, Vector2.zero, Vector2.one, new Vector2(26f, 486f), new Vector2(-26f, -20f), "身份类别", 15, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddRolePickerFilterButton("all", "全", "全部", new Vector2(164f, 500f), allRoles.Length);
            AddRolePickerFilterButton("townsfolk", "民", "镇民", new Vector2(286f, 500f), allRoles.Count((role) => role.category == "townsfolk"));
            AddRolePickerFilterButton("outsider", "外", "外来者", new Vector2(420f, 500f), allRoles.Count((role) => role.category == "outsider"));
            AddRolePickerFilterButton("minion", "爪", "爪牙", new Vector2(554f, 500f), allRoles.Count((role) => role.category == "minion"));
            AddRolePickerFilterButton("demon", "恶", "恶魔", new Vector2(676f, 500f), allRoles.Count((role) => role.category == "demon"));
        }

        private void AddRolePickerFilterButton(string category, string icon, string label, Vector2 center, int count)
        {
            var selected = activeRolePickerCategory == category;
            var button = AddToolActionButton(icon, $"{label} {count}", rolePickerGridRoot, center, new Vector2(label.Length > 2 ? 122f : 112f, 30f), () => SelectRolePickerCategory(category), true);
            if (selected)
            {
                AddFrame(button.transform, "Role Picker Filter Selected", 1.2f, new Color(1f, 0.76f, 0.32f, 0.64f));
            }
        }

        private void RenderRolePickerSelectionSummary(PlayerViewModel target, string selectedRoleId, ScriptRoleViewModel[] filteredRoles, int pageStart, int pageCount)
        {
            if (rolePickerGridRoot == null) return;
            var filteredCount = filteredRoles?.Length ?? 0;
            var selectedName = string.IsNullOrWhiteSpace(selectedRoleId)
                ? activeRolePickerMode == "mark-role" ? "未标记" : activeRolePickerMode == "action-form-role" ? "未选择" : "不声称"
                : RoleNameForId(selectedRoleId);
            var modeLabel = activeRolePickerMode == "action-form-role"
                ? "行动身份"
                : activeRolePickerMode == "mark-role" ? $"目标 {(target != null ? target.seat.ToString() : "?")}号" : "私聊声称";
            var selectedInFilter = string.IsNullOrWhiteSpace(selectedRoleId)
                || (filteredRoles ?? Array.Empty<ScriptRoleViewModel>()).Any((role) => role != null && role.id == selectedRoleId);
            var hint = selectedInFilter
                ? "点击身份标记会立即应用；右下角可清空当前选择。"
                : "当前选择不在此筛选中；切回“全部”可查看。";
            var panel = AddPanel("Role Picker Selection Summary", rolePickerGridRoot, Vector2.zero, Vector2.zero, new Vector2(720f, 438f), new Vector2(1158f, 478f), new Color(0.020f, 0.028f, 0.036f, 0.64f));
            AddFrame(panel.transform, "Role Picker Selection Summary Frame", 0.7f, selectedInFilter ? new Color(0.86f, 0.58f, 0.26f, 0.22f) : new Color(1f, 0.62f, 0.28f, 0.32f));
            AddText("Role Picker Summary Mode", panel.transform, Vector2.zero, Vector2.one, new Vector2(14f, 18f), new Vector2(-306f, -4f), modeLabel, 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddText("Role Picker Summary Selection", panel.transform, Vector2.zero, Vector2.one, new Vector2(110f, 18f), new Vector2(-118f, -4f), Ellipsize($"当前：{selectedName}", 18), 12, TextAnchor.UpperLeft, FontStyle.Normal).color = selectedInFilter ? new Color(0.90f, 0.94f, 0.96f, 0.92f) : new Color(1f, 0.74f, 0.38f, 0.94f);
            AddText("Role Picker Summary Range", panel.transform, Vector2.zero, Vector2.one, new Vector2(322f, 18f), new Vector2(-12f, -4f), RolePickerPageRangeLabel(filteredCount, pageStart, pageCount), 12, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.84f, 0.88f, 0.90f, 0.86f);
            AddText("Role Picker Summary Hint", panel.transform, Vector2.zero, Vector2.one, new Vector2(14f, 2f), new Vector2(-12f, -20f), Ellipsize(hint, 46), 10, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.72f, 0.80f, 0.84f, 0.78f);
        }

        private void RenderRolePickerPager(int filteredCount, int pageStart, int pageCount)
        {
            if (rolePickerGridRoot == null) return;
            var totalPages = PageCount(filteredCount, RolePickerPageSize);
            AddText("Role Picker Page", rolePickerGridRoot, Vector2.zero, Vector2.zero, new Vector2(922f, 486f), new Vector2(1158f, 516f), $"第 {activeRolePickerPage + 1}/{totalPages} 页 · {RolePickerPageRangeLabel(filteredCount, pageStart, pageCount)}", 13, TextAnchor.MiddleCenter, FontStyle.Normal).color = new Color(0.84f, 0.88f, 0.90f, 0.86f);
            if (totalPages <= 1) return;
            var prev = AddToolActionButton("上", "上一页", rolePickerGridRoot, new Vector2(1228f, 500f), new Vector2(96f, 28f), () => ChangeRolePickerPage(-1), true);
            var next = AddToolActionButton("下", "下一页", rolePickerGridRoot, new Vector2(1340f, 500f), new Vector2(96f, 28f), () => ChangeRolePickerPage(1), true);
            SetToolButtonEnabled(prev, activeRolePickerPage > 0);
            SetToolButtonEnabled(next, activeRolePickerPage < totalPages - 1);
        }

        private void RenderRolePickerBottomActionStrip(string selectedRoleId, string blankLabel)
        {
            if (rolePickerGridRoot == null) return;

            var hasSelection = !string.IsNullOrWhiteSpace(selectedRoleId);
            var actionLabel = activeRolePickerMode == "mark-role"
                ? "清除当前标记"
                : activeRolePickerMode == "action-form-role" ? "清空行动身份" : "本次不声称身份";
            var helper = hasSelection
                ? $"点击右侧“{blankLabel}”会移除当前选择；点击任意身份标记会立即应用。"
                : $"当前已经是“{blankLabel}”状态；点击身份标记可重新选择。";
            var accent = hasSelection ? new Color(1f, 0.68f, 0.30f, 0.44f) : new Color(0.54f, 0.82f, 0.92f, 0.28f);

            var strip = AddPanel("Role Picker Bottom Action Strip", rolePickerGridRoot, Vector2.zero, Vector2.zero, new Vector2(1000f, 8f), new Vector2(1450f, 96f), new Color(0.004f, 0.010f, 0.017f, 0.62f));
            AddFrame(strip.transform, "Role Picker Bottom Action Frame", 0.75f, new Color(accent.r, accent.g, accent.b, 0.22f));
            AddImage("Role Picker Bottom Action Accent", strip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), accent);
            AddText("Role Picker Bottom Action Title", strip.transform, Vector2.zero, Vector2.one, new Vector2(16f, 52f), new Vector2(-120f, -8f), actionLabel, 14, TextAnchor.UpperLeft, FontStyle.Bold).color = hasSelection ? new Color(1f, 0.82f, 0.44f, 0.98f) : new Color(0.78f, 0.88f, 0.92f, 0.92f);
            AddText("Role Picker Bottom Action Helper", strip.transform, Vector2.zero, Vector2.one, new Vector2(16f, 22f), new Vector2(-120f, -36f), Ellipsize(helper, 38), 11, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.72f, 0.82f, 0.86f, 0.82f);
            AddText("Role Picker Bottom Action State", strip.transform, Vector2.zero, Vector2.one, new Vector2(16f, 6f), new Vector2(-120f, -66f), hasSelection ? "当前：已有选择" : "当前：空选择", 10, TextAnchor.UpperLeft, FontStyle.Bold).color = hasSelection ? new Color(1f, 0.74f, 0.36f, 0.92f) : new Color(0.70f, 0.84f, 0.92f, 0.86f);
        }

        private static string RolePickerPageRangeLabel(int filteredCount, int pageStart, int pageCount)
        {
            if (filteredCount <= 0 || pageCount <= 0) return "无可选身份";
            var first = Mathf.Clamp(pageStart + 1, 1, filteredCount);
            var last = Mathf.Clamp(pageStart + pageCount, first, filteredCount);
            return $"显示 {first}-{last}/{filteredCount}";
        }

        private static bool RolePickerCategoryMatches(ScriptRoleViewModel role, string category)
        {
            return role != null && (string.IsNullOrWhiteSpace(category) || category == "all" || role.category == category);
        }

        private static string RolePickerCategoryLabel(string category)
        {
            if (category == "townsfolk") return "镇民";
            if (category == "outsider") return "外来者";
            if (category == "minion") return "爪牙";
            if (category == "demon") return "恶魔";
            return "全部身份";
        }

        private void SelectRolePickerCategory(string category)
        {
            activeRolePickerCategory = string.IsNullOrWhiteSpace(category) ? "all" : category;
            activeRolePickerPage = 0;
            RenderRolePickerPanel();
        }

        private void ChangeRolePickerPage(int delta)
        {
            var count = RolePickerSourceRoles().Count((role) => RolePickerCategoryMatches(role, activeRolePickerCategory));
            activeRolePickerPage = ClampPage(activeRolePickerPage + delta, count, RolePickerPageSize);
            RenderRolePickerPanel();
        }

        private void ApplyRolePickerChoice(string roleId)
        {
            if (activeRolePickerMode == "action-form-role")
            {
                selectedActionRoleId = roleId ?? "";
                CloseRolePicker();
                RenderActiveActionSurface();
                return;
            }
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
                var targetId = activeRolePickerPlayerId;
                var shouldReopenReminderPicker = reopenReminderPickerAfterRoleMark;
                if (!string.IsNullOrWhiteSpace(targetId))
                {
                    ApplyLocalRoleMark(targetId, roleId);
                    SendUnityAction("grimoire-mark-role", targetId, "", "", "", "", roleId, trackPending: false);
                    dialogueTitle.text = "魔典标记";
                    dialogueBody.text = string.IsNullOrWhiteSpace(roleId)
                        ? $"已清除 {NameForPlayerId(targetId)} 的身份标记。"
                        : $"已将 {NameForPlayerId(targetId)} 标记为 {RoleNameForId(roleId)}。";
                }
                CloseRolePicker();
                if (shouldReopenReminderPicker && !string.IsNullOrWhiteSpace(targetId))
                {
                    var target = (vm?.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && player.id == targetId);
                    if (target != null)
                    {
                        OpenReminderPickerForPlayer(target);
                        if (reminderPickerStatusText != null)
                        {
                            reminderPickerStatusText.text = string.IsNullOrWhiteSpace(roleId)
                                ? "身份标记已清除；角色专属提醒会在同步后收起。"
                                : $"已请求标记为 {RoleNameForId(roleId)}；同步后会出现对应角色的 reminders。";
                        }
                    }
                }
            }
        }

        private void ApplyLocalRoleMark(string targetId, string roleId)
        {
            if (vm?.players == null || string.IsNullOrWhiteSpace(targetId)) return;
            var target = vm.players.FirstOrDefault((player) => player != null && player.id == targetId);
            if (target == null) return;

            var cleanRoleId = roleId ?? "";
            var role = RoleForId(cleanRoleId);
            target.markedRoleId = cleanRoleId;
            target.markedRoleName = string.IsNullOrWhiteSpace(cleanRoleId) ? "" : role?.name ?? cleanRoleId;

            RenderGrimoire();
            if (target.id == selectedPlayerId) UpdateTokenInspectorText(target);
            if (eventPanelOpen) ShowInfoDrawer(infoDrawerTab);
        }
    }
}
