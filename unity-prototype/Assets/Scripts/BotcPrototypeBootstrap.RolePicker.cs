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
            rolePickerStatusText = AddText("Role Picker Status", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(48f, 628f), new Vector2(-48f, -94f), "选择一个身份 token。", 16, TextAnchor.UpperCenter, FontStyle.Normal);
            rolePickerGridRoot = AddPanel("Role Picker Grid", rolePickerPanel, Vector2.zero, Vector2.one, new Vector2(40f, 96f), new Vector2(-40f, -132f), new Color(0.006f, 0.010f, 0.014f, 0.44f)).GetComponent<RectTransform>();
            AddFrame(rolePickerGridRoot, "Role Picker Grid Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
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
                dialogueBody.text = "请先选择一个 token，再打开角色图标标记器。";
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
                    ? $"当前行动身份：{currentRoleName}  ·  {RolePickerCategoryLabel(activeRolePickerCategory)} {roles.Length}/{allRoles.Length}"
                    : activeRolePickerMode == "mark-role"
                    ? $"目标：{target?.name ?? "未选择"}  ·  当前标记：{currentRoleName}  ·  {RolePickerCategoryLabel(activeRolePickerCategory)} {roles.Length}/{allRoles.Length}"
                    : $"当前声称：{currentRoleName}  ·  {RolePickerCategoryLabel(activeRolePickerCategory)} {roles.Length}/{allRoles.Length}";
            }

            RenderRolePickerCategoryTabs(allRoles);

            var columns = 10;
            var startX = 78f;
            var startY = 350f;
            var spacingX = 132f;
            var spacingY = 124f;
            var pageStart = activeRolePickerPage * RolePickerPageSize;
            var pageRoles = roles.Skip(pageStart).Take(RolePickerPageSize).ToArray();
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
            AddBlankRoleTokenButton(rolePickerGridRoot, blankLabel, new Vector2(1376f, 48f), 72f, string.IsNullOrWhiteSpace(selectedRoleId), () => ApplyRolePickerChoice(""));
            RenderRolePickerPager(roles.Length);
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

        private void RenderRolePickerPager(int filteredCount)
        {
            if (rolePickerGridRoot == null) return;
            var totalPages = PageCount(filteredCount, RolePickerPageSize);
            AddText("Role Picker Page", rolePickerGridRoot, Vector2.zero, Vector2.zero, new Vector2(528f, 20f), new Vector2(912f, 50f), $"第 {activeRolePickerPage + 1}/{totalPages} 页 · {filteredCount} 个身份", 13, TextAnchor.MiddleCenter, FontStyle.Normal).color = new Color(0.84f, 0.88f, 0.90f, 0.86f);
            if (totalPages <= 1) return;
            var prev = AddToolActionButton("上", "上一页", rolePickerGridRoot, new Vector2(462f, 34f), new Vector2(96f, 28f), () => ChangeRolePickerPage(-1), true);
            var next = AddToolActionButton("下", "下一页", rolePickerGridRoot, new Vector2(978f, 34f), new Vector2(96f, 28f), () => ChangeRolePickerPage(1), true);
            SetToolButtonEnabled(prev, activeRolePickerPage > 0);
            SetToolButtonEnabled(next, activeRolePickerPage < totalPages - 1);
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
