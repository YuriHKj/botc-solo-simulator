using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private void BuildHandbookPanel()
        {
            handbookPanel = AddPanel("Handbook Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-740f, -380f), new Vector2(740f, 380f), new Color(0.005f, 0.012f, 0.020f, 0.92f)).GetComponent<RectTransform>();
            AddFrame(handbookPanel, "Handbook Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.38f));
            AddImage("Handbook Header Wash", handbookPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -82f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            handbookTitle = AddText("Handbook Title", handbookPanel, Vector2.zero, Vector2.one, new Vector2(34f, 704f), new Vector2(-34f, -18f), "角色图鉴", 31, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Handbook Hint", handbookPanel, Vector2.zero, Vector2.one, new Vector2(820f, 712f), new Vector2(-150f, -24f), "公开剧本角色 · 不显示隐藏真相", 13, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.95f, 0.78f, 0.42f, 0.82f);
            AddToolActionButton("关", "关闭", handbookPanel, new Vector2(1410f, 716f), new Vector2(104f, 34f), CloseHandbookPanel, true);
            handbookAllCategoryButton = AddToolActionButton("全", "全部", handbookPanel, new Vector2(84f, 646f), new Vector2(98f, 32f), () => SelectHandbookCategory("all"), true);
            handbookTownsfolkCategoryButton = AddToolActionButton("民", "镇民", handbookPanel, new Vector2(192f, 646f), new Vector2(98f, 32f), () => SelectHandbookCategory("townsfolk"), true);
            handbookOutsiderCategoryButton = AddToolActionButton("外", "外来者", handbookPanel, new Vector2(306f, 646f), new Vector2(110f, 32f), () => SelectHandbookCategory("outsider"), true);
            handbookMinionCategoryButton = AddToolActionButton("爪", "爪牙", handbookPanel, new Vector2(426f, 646f), new Vector2(98f, 32f), () => SelectHandbookCategory("minion"), true);
            handbookDemonCategoryButton = AddToolActionButton("恶", "恶魔", handbookPanel, new Vector2(534f, 646f), new Vector2(98f, 32f), () => SelectHandbookCategory("demon"), true);
            handbookModeRoot = AddPanel("Handbook Mode Strip", handbookPanel, Vector2.zero, Vector2.one, new Vector2(650f, 626f), new Vector2(-132f, -92f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            RenderHandbookModeChips();
            handbookSignalRoot = AddPanel("Handbook Signal Strip", handbookPanel, Vector2.zero, Vector2.one, new Vector2(326f, 48f), new Vector2(-326f, -688f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            handbookRoleListRoot = AddPanel("Handbook Role List", handbookPanel, Vector2.zero, Vector2.one, new Vector2(30f, 100f), new Vector2(-850f, -134f), new Color(0.020f, 0.028f, 0.036f, 0.26f)).GetComponent<RectTransform>();
            AddFrame(handbookRoleListRoot, "Handbook List Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            var detailWash = AddImage("Handbook Detail Wash", handbookPanel, Vector2.zero, Vector2.one, new Vector2(666f, 318f), new Vector2(-32f, -134f), new Color(0.020f, 0.028f, 0.036f, 0.28f));
            AddFrame(detailWash.transform, "Handbook Detail Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
            AddText("Handbook Detail Label", handbookPanel, Vector2.zero, Vector2.one, new Vector2(850f, 594f), new Vector2(-60f, -128f), "角色详情 · 公开能力", 16, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            handbookDetailTokenRoot = AddPanel("Handbook Detail Token", handbookPanel, Vector2.zero, Vector2.one, new Vector2(690f, 454f), new Vector2(-648f, -174f), new Color(0.004f, 0.010f, 0.017f, 0.24f)).GetComponent<RectTransform>();
            handbookDetailSummaryRoot = AddPanel("Handbook Detail Summary", handbookPanel, Vector2.zero, Vector2.one, new Vector2(850f, 502f), new Vector2(-60f, -178f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            handbookDetailText = AddText("Handbook Detail", handbookPanel, Vector2.zero, Vector2.one, new Vector2(850f, 342f), new Vector2(-60f, -276f), "", 16, TextAnchor.UpperLeft, FontStyle.Normal);
            var orderWash = AddImage("Handbook Order Wash", handbookPanel, Vector2.zero, Vector2.one, new Vector2(666f, 100f), new Vector2(-32f, -456f), new Color(0.020f, 0.028f, 0.036f, 0.24f));
            AddFrame(orderWash.transform, "Handbook Order Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.14f));
            AddText("Handbook Order Label", handbookPanel, Vector2.zero, Vector2.one, new Vector2(694f, 274f), new Vector2(-60f, -472f), "官方表参考 · 夜晚顺序", 15, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.92f);
            handbookOrderText = AddText("Handbook Order", handbookPanel, Vector2.zero, Vector2.one, new Vector2(694f, 118f), new Vector2(-60f, -500f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            AddButton("关闭", handbookPanel, new Vector2(1376f, 46f), new Vector2(100f, 34f), CloseHandbookPanel);
            handbookPanel.gameObject.SetActive(false);
        }

        private Button AddHandbookModeChip(string icon, string title, string helper, Vector2 center, Vector2 size, bool active, UnityEngine.Events.UnityAction onClick)
        {
            var half = size * 0.5f;
            var parent = handbookModeRoot == null ? handbookPanel : handbookModeRoot;
            var chip = AddPanel($"Handbook Mode {title}", parent, Vector2.zero, Vector2.zero, center - half, center + half, active ? new Color(0.12f, 0.065f, 0.030f, 0.84f) : new Color(0.035f, 0.026f, 0.020f, 0.64f));
            AddFrame(chip.transform, "Handbook Mode Frame", 0.8f, active ? new Color(0.94f, 0.68f, 0.34f, 0.42f) : new Color(0.86f, 0.58f, 0.26f, 0.22f));
            AddImage("Handbook Mode Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), active ? new Color(0.96f, 0.64f, 0.24f, 0.52f) : new Color(0.60f, 0.72f, 0.82f, 0.22f));
            Button button = null;
            if (onClick != null)
            {
                button = chip.AddComponent<Button>();
                chip.AddComponent<CanvasGroup>();
                button.onClick.AddListener(onClick);
                ApplyButtonStyle(button);
            }

            var badge = AddImage("Handbook Mode Badge", chip.transform, Vector2.zero, Vector2.zero, new Vector2(8f, 7f), new Vector2(32f, 31f), new Color(0.020f, 0.030f, 0.040f, 0.76f));
            AddFrame(badge.transform, "Handbook Mode Badge Frame", 0.6f, new Color(0.70f, 0.82f, 0.92f, 0.20f));
            AddText("Handbook Mode Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("Handbook Mode Title", chip.transform, Vector2.zero, Vector2.one, new Vector2(40f, 18f), new Vector2(-8f, -4f), title, 13, TextAnchor.UpperLeft, FontStyle.Bold).color = active ? new Color(1f, 0.86f, 0.46f, 1f) : new Color(0.90f, 0.84f, 0.72f, 0.92f);
            AddText("Handbook Mode Helper", chip.transform, Vector2.zero, Vector2.one, new Vector2(40f, 5f), new Vector2(-8f, -22f), helper, 9, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.70f, 0.82f, 0.84f, 0.72f);
            return button;
        }

        private void RenderHandbookModeChips()
        {
            if (handbookModeRoot == null) return;
            ClearChildren(handbookModeRoot);
            AddHandbookModeChip("图", "角色", "公开能力", new Vector2(78f, 20f), new Vector2(136f, 36f), activeHandbookMode == "roles", () => SelectHandbookMode("roles"));
            AddHandbookModeChip("表", "夜晚", "行动顺序", new Vector2(226f, 20f), new Vector2(136f, 36f), activeHandbookMode == "order", () => SelectHandbookMode("order"));
            AddHandbookModeChip("记", "资料", "玩家笔记", new Vector2(374f, 20f), new Vector2(136f, 36f), false, OpenHandbookInformationSummary);
            AddHandbookModeChip("?", "帮助", "流程提示", new Vector2(522f, 20f), new Vector2(136f, 36f), activeHandbookMode == "help", () => SelectHandbookMode("help"));
        }

        private void RenderHandbookSignalStrip(ScriptHandbookViewModel handbook, ScriptRoleViewModel[] roles, int filteredCount, ScriptRoleViewModel selected)
        {
            if (handbookSignalRoot == null) return;
            ClearChildren(handbookSignalRoot);
            AddHandbookSignalChip("A", "Atlas", "Primary", 0f, 120f, new Color(0.040f, 0.052f, 0.064f, 0.74f), new Color(0.62f, 0.78f, 0.92f, 0.20f));
            AddHandbookSignalChip("S", "Script", HandbookSignalScriptLabel(handbook), 128f, 180f, new Color(0.052f, 0.042f, 0.028f, 0.76f), new Color(0.96f, 0.68f, 0.30f, 0.25f));
            AddHandbookSignalChip("F", "Filter", HandbookSignalFilterLabel(roles, filteredCount), 316f, 172f, new Color(0.040f, 0.060f, 0.072f, 0.74f), new Color(0.52f, 0.76f, 1f, 0.22f));
            AddHandbookSignalChip("N", "Order", HandbookSignalOrderLabel(handbook), 496f, 144f, new Color(0.070f, 0.046f, 0.030f, 0.76f), new Color(1f, 0.74f, 0.32f, 0.28f));
            AddHandbookSignalChip("I", "Notes", HandbookSignalNotesLabel(selected), 648f, 176f, new Color(0.044f, 0.064f, 0.048f, 0.74f), new Color(0.76f, 0.92f, 0.52f, 0.22f));
        }

        private void AddHandbookSignalChip(string icon, string label, string value, float x, float width, Color fill, Color border)
        {
            if (handbookSignalRoot == null) return;
            var chip = AddPanel($"Handbook Signal Chip {label}", handbookSignalRoot, Vector2.zero, Vector2.zero, new Vector2(x, 0f), new Vector2(x + width, 26f), fill);
            AddFrame(chip.transform, "Handbook Signal Chip Frame", 0.65f, border);
            var badge = AddImage("Handbook Signal Badge", chip.transform, Vector2.zero, Vector2.zero, new Vector2(6f, 5f), new Vector2(22f, 21f), new Color(0.008f, 0.012f, 0.016f, 0.78f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            AddText("Handbook Signal Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, 9, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("Handbook Signal Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(28f, 13f), new Vector2(-6f, -3f), label, 8, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.70f, 0.78f, 0.82f, 0.76f);
            AddText("Handbook Signal Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(28f, 2f), new Vector2(-6f, -14f), Ellipsize(value, Mathf.Max(4, Mathf.FloorToInt(width / 12f))), 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            SetRaycastTargetsExceptButtons(chip.transform);
        }

        private string HandbookSignalScriptLabel(ScriptHandbookViewModel handbook)
        {
            var scriptName = string.IsNullOrWhiteSpace(handbook?.scriptName) ? DisplayScriptName() : handbook.scriptName;
            return Ellipsize(string.IsNullOrWhiteSpace(scriptName) ? "Script" : scriptName, 16);
        }

        private string HandbookSignalFilterLabel(ScriptRoleViewModel[] roles, int filteredCount)
        {
            var total = roles == null ? 0 : roles.Length;
            return $"{HandbookCategorySignalLabel(activeHandbookCategory)} {filteredCount}/{total}";
        }

        private static string HandbookSignalOrderLabel(ScriptHandbookViewModel handbook)
        {
            var first = handbook?.firstNightOrder?.Length ?? 0;
            var other = handbook?.otherNightOrder?.Length ?? 0;
            return first == 0 && other == 0 ? "No order" : $"FN {first} / ON {other}";
        }

        private static string HandbookSignalNotesLabel(ScriptRoleViewModel selected)
        {
            return selected == null ? "Drawer" : $"Drawer / {Ellipsize(selected.name, 10)}";
        }

        private static string HandbookCategorySignalLabel(string category)
        {
            if (category == "townsfolk") return "Townsfolk";
            if (category == "outsider") return "Outsider";
            if (category == "minion") return "Minion";
            if (category == "demon") return "Demon";
            return "All";
        }

        private void OpenHandbookInformationSummary()
        {
            CloseHandbookPanel();
            ShowInfoDrawer("intel");
        }

        private void CloseHandbookPanel()
        {
            if (handbookPanel != null) handbookPanel.gameObject.SetActive(false);
            ApplyModalBackdropVisibility();
        }

        private string BuildHandbookText()
        {
            var handbook = vm.scriptHandbook;
            if (handbook == null) return "剧本手册不可用。";
            var lines = new List<string> { $"{handbook.scriptName}", "────────", "首夜顺序" };
            var first = handbook.firstNightOrder ?? Array.Empty<string>();
            lines.Add(ShortOrder(first));
            lines.Add("");
            lines.Add("其他夜晚");
            var other = handbook.otherNightOrder ?? Array.Empty<string>();
            lines.Add(ShortOrder(other));
            lines.Add("");
            lines.Add("角色预览");
            var grouped = (handbook.roles ?? Array.Empty<ScriptRoleViewModel>())
                .GroupBy((role) => role.category ?? "")
                .OrderBy((group) => CategorySort(group.Key));
            foreach (var group in grouped)
            {
                var names = string.Join(" / ", group.Take(4).Select((role) => role.name));
                lines.Add($"{CategoryLabel(group.Key)}：{names}");
            }
            return string.Join("\n", lines);
        }

        private static string CategoryLabel(string category)
        {
            if (category == "townsfolk") return "镇民";
            if (category == "outsider") return "外来者";
            if (category == "minion") return "爪牙";
            if (category == "demon") return "恶魔";
            return "其他";
        }

        private static string TeamLabel(string team)
        {
            if (team == "good") return "善良";
            if (team == "evil") return "邪恶";
            return string.IsNullOrWhiteSpace(team) ? "未知阵营" : team;
        }

        private string RoleHandbookTag(ScriptRoleViewModel role)
        {
            if (role == null) return "";
            var players = vm.players ?? Array.Empty<PlayerViewModel>();
            if (players.Any((player) => player.human && (player.roleId == role.id || player.perceivedRoleId == role.id))) return " · 你";
            if (players.Any((player) => player.markedRoleId == role.id || player.markedRoleName == role.name)) return " · 标";
            return "";
        }

        private string RoleHandbookUseLine(ScriptRoleViewModel role)
        {
            var tag = RoleHandbookTag(role);
            if (tag.Contains("你")) return "提示：这是主视角相关身份。";
            if (tag.Contains("标")) return "提示：已有 token 使用这个魔典标记。";
            return "提示：点击左侧角色可切换详情；手册不读取隐藏真相。";
        }

        private static string HandbookReminderLine(string label, int order, string reminder)
        {
            if (order <= 0 && string.IsNullOrWhiteSpace(reminder)) return $"{label}：无";
            var prefix = order > 0 ? $"{label} #{order}" : label;
            return string.IsNullOrWhiteSpace(reminder) ? $"{prefix}：有行动顺序" : $"{prefix}：{reminder}";
        }

        private static string HandbookReminderTokens(ScriptRoleViewModel role)
        {
            if (role == null) return "无";
            var values = new List<string>();
            if (role.reminders != null) values.AddRange(role.reminders.Where((entry) => !string.IsNullOrWhiteSpace(entry)));
            if (role.remindersGlobal != null) values.AddRange(role.remindersGlobal.Where((entry) => !string.IsNullOrWhiteSpace(entry)).Select((entry) => $"全局：{entry}"));
            return values.Count == 0 ? "无" : string.Join(" / ", values.Distinct());
        }

        private static string ShortOrder(string[] order)
        {
            if (order == null || order.Length == 0) return "暂无";
            var values = order.Where((item) => !string.IsNullOrWhiteSpace(item)).ToArray();
            if (values.Length == 0) return "暂无";
            var lines = new List<string>();
            for (var i = 0; i < values.Length; i += 5)
            {
                lines.Add(string.Join(" / ", values.Skip(i).Take(5)));
            }
            return string.Join("\n      ", lines);
        }

        private void OpenHandbookPanel(string mode = "")
        {
            if (!string.IsNullOrWhiteSpace(mode)) activeHandbookMode = NormalizeHandbookMode(mode);
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            CloseActionFormPanel();
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(false);
            RenderHandbookPanel();
            ShowModalPanel(handbookPanel);
        }

        private void SelectHandbookMode(string mode)
        {
            activeHandbookMode = NormalizeHandbookMode(mode);
            RenderHandbookPanel();
        }

        private static string NormalizeHandbookMode(string mode)
        {
            var value = (mode ?? "").Trim().ToLowerInvariant();
            if (value == "help" || value == "tutorial" || value == "guide") return "help";
            if (value == "order" || value == "night" || value == "night-order") return "order";
            if (value == "notes" || value == "intel" || value == "clues") return "roles";
            return "roles";
        }

        private void SelectHandbookCategory(string category)
        {
            activeHandbookMode = "roles";
            activeHandbookCategory = string.IsNullOrWhiteSpace(category) ? "all" : category;
            activeHandbookRoleIndex = 0;
            activeHandbookRolePage = 0;
            RenderHandbookPanel();
        }

        private void SelectHandbookRole(int index)
        {
            activeHandbookMode = "roles";
            activeHandbookRoleIndex = index;
            activeHandbookRolePage = Mathf.Max(0, activeHandbookRoleIndex / HandbookRolePageSize);
            RenderHandbookPanel();
        }

        private void ChangeHandbookRolePage(int delta)
        {
            var roles = vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>();
            var count = roles.Count((role) => activeHandbookCategory == "all" || role.category == activeHandbookCategory);
            activeHandbookRolePage = ClampPage(activeHandbookRolePage + delta, count, HandbookRolePageSize);
            if (count > 0) activeHandbookRoleIndex = Mathf.Min(activeHandbookRolePage * HandbookRolePageSize, count - 1);
            RenderHandbookPanel();
        }

        private void RenderHandbookPanel()
        {
            var handbook = vm.scriptHandbook;
            var roles = handbook?.roles ?? Array.Empty<ScriptRoleViewModel>();
            var filtered = roles
                .Where((role) => activeHandbookCategory == "all" || role.category == activeHandbookCategory)
                .OrderBy((role) => CategorySort(role.category ?? ""))
                .ThenBy((role) => role.name ?? role.id ?? "")
                .ToArray();
            if (activeHandbookRoleIndex < 0 || activeHandbookRoleIndex >= filtered.Length) activeHandbookRoleIndex = 0;
            var handbookPages = PageCount(filtered.Length, HandbookRolePageSize);
            activeHandbookRolePage = ClampPage(activeHandbookRolePage, filtered.Length, HandbookRolePageSize);
            if (filtered.Length > 0 && (activeHandbookRoleIndex < activeHandbookRolePage * HandbookRolePageSize || activeHandbookRoleIndex >= (activeHandbookRolePage + 1) * HandbookRolePageSize))
            {
                activeHandbookRoleIndex = Mathf.Min(activeHandbookRolePage * HandbookRolePageSize, filtered.Length - 1);
            }
            var selected = filtered.Length > 0 ? filtered[activeHandbookRoleIndex] : null;

            RenderHandbookModeChips();
            if (activeHandbookMode == "help")
            {
                RenderHandbookHelpMode(handbook, roles);
                return;
            }
            if (activeHandbookMode == "order")
            {
                RenderHandbookOrderMode(handbook, roles);
                return;
            }

            if (handbookTitle != null) handbookTitle.text = $"角色图鉴 · {(string.IsNullOrWhiteSpace(handbook?.scriptName) ? DisplayScriptName() : handbook.scriptName)}";
            UpdateHandbookCategoryButtons();
            RenderHandbookSignalStrip(handbook, roles, filtered.Length, selected);
            if (handbookRoleListRoot != null)
            {
                for (var i = handbookRoleListRoot.childCount - 1; i >= 0; i--) Destroy(handbookRoleListRoot.GetChild(i).gameObject);
                AddFrame(handbookRoleListRoot, "Handbook List Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
                RenderHandbookListHeader(roles, filtered.Length, handbookPages);
                var pageStart = activeHandbookRolePage * HandbookRolePageSize;
                var pageRoles = filtered.Skip(pageStart).Take(HandbookRolePageSize).ToArray();
                for (var i = 0; i < pageRoles.Length; i++)
                {
                    var role = pageRoles[i];
                    var absoluteIndex = pageStart + i;
                    var active = absoluteIndex == activeHandbookRoleIndex;
                    var row = i / 5;
                    var col = i % 5;
                    var index = absoluteIndex;
                    AddRoleTokenButton(handbookRoleListRoot, role.id, role.name, role.category, role.team, new Vector2(66f + col * 108f, 408f - row * 128f), 66f, active, () => SelectHandbookRole(index));
                    var tag = RoleHandbookTag(role);
                    if (!string.IsNullOrWhiteSpace(tag))
                    {
                        var tagText = tag.Contains("你") ? "你" : "标";
                        AddText("Handbook Role Tag", handbookRoleListRoot, Vector2.zero, Vector2.zero, new Vector2(42f + col * 108f, 456f - row * 128f), new Vector2(90f + col * 108f, 478f - row * 128f), tagText, 11, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.78f, 0.36f, 1f);
                    }
                }
                AddText("Handbook Page Label", handbookRoleListRoot, Vector2.zero, Vector2.zero, new Vector2(198f, 28f), new Vector2(428f, 56f), $"第 {activeHandbookRolePage + 1}/{handbookPages} 页 · {filtered.Length} 个角色", 13, TextAnchor.MiddleCenter, FontStyle.Normal);
                var prev = AddToolActionButton("上", "上一页", handbookRoleListRoot, new Vector2(74f, 42f), new Vector2(96f, 28f), () => ChangeHandbookRolePage(-1), true);
                var next = AddToolActionButton("下", "下一页", handbookRoleListRoot, new Vector2(520f, 42f), new Vector2(96f, 28f), () => ChangeHandbookRolePage(1), true);
                SetToolButtonEnabled(prev, activeHandbookRolePage > 0);
                SetToolButtonEnabled(next, activeHandbookRolePage < handbookPages - 1);
            }

            if (handbookDetailText != null)
            {
                RenderHandbookSelectedRoleToken(selected);
                RenderHandbookDetailSummary(selected);
                if (selected == null)
                {
                    handbookDetailText.text = "当前剧本手册没有可显示角色。";
                }
                else
                {
                    handbookDetailText.text = ClampTextLines(new[]
                    {
                        $"{selected.name}  ·  {CategoryLabel(selected.category)} / {TeamLabel(selected.team)}",
                        $"ID：{selected.id}",
                        "",
                        "能力",
                        string.IsNullOrWhiteSpace(selected.ability) ? "暂无能力文本。" : selected.ability,
                        "",
                        $"标记词：{HandbookReminderTokens(selected)}",
                        RoleHandbookUseLine(selected),
                    }, 8, 54);
                }
            }

            if (handbookOrderText != null)
            {
                var first = handbook?.firstNightOrder ?? Array.Empty<string>();
                var other = handbook?.otherNightOrder ?? Array.Empty<string>();
                var lines = new List<string> { "公开剧本顺序", "首夜：" + ShortOrder(first), "其后：" + ShortOrder(other) };
                var counts = roles.GroupBy((role) => role.category ?? "").ToDictionary((group) => group.Key, (group) => group.Count());
                lines.Add($"角色数：民 {CountCategory(counts, "townsfolk")} / 外 {CountCategory(counts, "outsider")} / 爪 {CountCategory(counts, "minion")} / 恶 {CountCategory(counts, "demon")}");
                lines.Add("玩家声称和已确认信息请看资料笔记。");
                handbookOrderText.text = ClampTextLines(lines, 12, 92);
            }
        }

        private void RenderHandbookHelpMode(ScriptHandbookViewModel handbook, ScriptRoleViewModel[] roles)
        {
            if (handbookTitle != null) handbookTitle.text = "教程/帮助 · 主界面只放必要信息";
            UpdateHandbookCategoryButtons();
            RenderHandbookSignalStrip(handbook, roles, roles?.Length ?? 0, null);
            RenderHandbookHelpCards();
            RenderHandbookHelpSummary();
            RenderHandbookHelpBody();
        }

        private void RenderHandbookOrderMode(ScriptHandbookViewModel handbook, ScriptRoleViewModel[] roles)
        {
            if (handbookTitle != null) handbookTitle.text = $"夜晚顺序 · {(string.IsNullOrWhiteSpace(handbook?.scriptName) ? DisplayScriptName() : handbook.scriptName)}";
            UpdateHandbookCategoryButtons();
            RenderHandbookSignalStrip(handbook, roles, roles?.Length ?? 0, null);
            RenderHandbookOrderCards(handbook);
            RenderHandbookOrderSummary(roles);
        }

        private void RenderHandbookHelpCards()
        {
            if (handbookRoleListRoot == null) return;
            ClearChildren(handbookRoleListRoot);
            AddFrame(handbookRoleListRoot, "Handbook Help List Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            AddHandbookHelpCard("主界面", "只看阶段、我是谁、桌上玩家、现在能做什么。长教程不常驻。", 392f);
            AddHandbookHelpCard("私聊", "待处理入口会排队显示；接受后才展示具体私聊内容。", 282f);
            AddHandbookHelpCard("资料抽屉", "日志、私聊、公开发言、线索总结分开查，不展示内部推理字段。", 172f);
            AddHandbookHelpCard("推进", "阻塞事项留在流程区；可选提示放这里或短暂对话提示。", 62f);
        }

        private void AddHandbookHelpCard(string title, string body, float y)
        {
            var card = AddPanel($"Handbook Help Card {title}", handbookRoleListRoot, Vector2.zero, Vector2.zero, new Vector2(18f, y), new Vector2(586f, y + 82f), new Color(0.010f, 0.018f, 0.026f, 0.66f));
            AddImage("Handbook Help Card Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.46f));
            AddFrame(card.transform, "Handbook Help Card Frame", 0.7f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            AddText("Handbook Help Card Title", card.transform, Vector2.zero, Vector2.one, new Vector2(16f, 48f), new Vector2(-16f, -6f), title, 15, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("Handbook Help Card Body", card.transform, Vector2.zero, Vector2.one, new Vector2(16f, 10f), new Vector2(-16f, -34f), Ellipsize(body, 42), 13, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.84f, 0.90f, 0.92f, 0.90f);
        }

        private void RenderHandbookHelpSummary()
        {
            if (handbookDetailTokenRoot != null)
            {
                ClearChildren(handbookDetailTokenRoot);
                AddFrame(handbookDetailTokenRoot, "Handbook Help Token Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
                AddText("Handbook Help Token Icon", handbookDetailTokenRoot, Vector2.zero, Vector2.one, new Vector2(20f, 30f), new Vector2(-20f, -30f), "?", 58, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
                AddText("Handbook Help Token Label", handbookDetailTokenRoot, Vector2.zero, Vector2.one, new Vector2(12f, 8f), new Vector2(-12f, -102f), "帮助", 15, TextAnchor.LowerCenter, FontStyle.Bold).color = new Color(0.96f, 0.91f, 0.82f, 0.96f);
            }
            if (handbookDetailSummaryRoot != null)
            {
                ClearChildren(handbookDetailSummaryRoot);
                AddHandbookSummaryField("blocker", "主界面", new Color(1f, 0.62f, 0.34f, 0.86f), 0);
                AddHandbookSummaryField("hint", "帮助/短提示", new Color(0.62f, 0.80f, 1f, 0.84f), 1);
                AddHandbookSummaryField("debug", "默认隐藏", new Color(0.74f, 0.78f, 0.84f, 0.80f), 2);
                AddHandbookSummaryField("资料", "抽屉查看", new Color(0.72f, 0.92f, 0.74f, 0.82f), 3);
            }
        }

        private void RenderHandbookHelpBody()
        {
            if (handbookDetailText != null)
            {
                handbookDetailText.text = ClampTextLines(new[]
                {
                    "提示分级",
                    "blocker：必须处理才可继续，留在左侧流程区。",
                    "hint：可选操作说明，放在这里或短暂对话提示。",
                    "debug/internal：默认不显示给玩家。",
                    "",
                    "当前建议",
                    $"阶段：{PhaseLabel()}",
                    $"下一步：{FlowNextLabel()}",
                }, 8, 54);
            }
            if (handbookOrderText != null)
            {
                var guard = vm?.phaseAdvance;
                var pendingWhispers = vm?.pendingProactiveWhispers?.Length ?? 0;
                var lines = new List<string>
                {
                    "主界面保留",
                    $"当前阶段：{PhaseLabel()}",
                    $"关键阻塞：{FirstNonEmpty(guard?.reason, "暂无阻塞")}",
                    $"待处理私聊：{pendingWhispers} 个",
                    "",
                    "教程已收敛",
                    "点击玩家私聊、资料抽屉用途、提醒物说明都放在本帮助页或对应弹窗。",
                    "公开发言与私聊摘要请打开右侧资料抽屉。"
                };
                handbookOrderText.text = ClampTextLines(lines, 12, 92);
            }
        }

        private void RenderHandbookOrderCards(ScriptHandbookViewModel handbook)
        {
            if (handbookRoleListRoot == null) return;
            ClearChildren(handbookRoleListRoot);
            AddFrame(handbookRoleListRoot, "Handbook Order List Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            var first = handbook?.firstNightOrder ?? Array.Empty<string>();
            var other = handbook?.otherNightOrder ?? Array.Empty<string>();
            AddHandbookHelpCard("首夜顺序", ShortOrder(first), 294f);
            AddHandbookHelpCard("其他夜晚", ShortOrder(other), 174f);
            AddHandbookHelpCard("阅读边界", "这里是公开剧本顺序，不展示隐藏身份或恶魔伪装。", 54f);
        }

        private void RenderHandbookOrderSummary(ScriptRoleViewModel[] roles)
        {
            if (handbookDetailTokenRoot != null)
            {
                ClearChildren(handbookDetailTokenRoot);
                AddFrame(handbookDetailTokenRoot, "Handbook Order Token Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
                AddText("Handbook Order Token Icon", handbookDetailTokenRoot, Vector2.zero, Vector2.one, new Vector2(20f, 30f), new Vector2(-20f, -30f), "表", 48, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
                AddText("Handbook Order Token Label", handbookDetailTokenRoot, Vector2.zero, Vector2.one, new Vector2(12f, 8f), new Vector2(-12f, -102f), "夜序", 15, TextAnchor.LowerCenter, FontStyle.Bold).color = new Color(0.96f, 0.91f, 0.82f, 0.96f);
            }
            if (handbookDetailSummaryRoot != null)
            {
                ClearChildren(handbookDetailSummaryRoot);
                var counts = (roles ?? Array.Empty<ScriptRoleViewModel>())
                    .GroupBy((role) => role.category ?? "")
                    .ToDictionary((group) => group.Key, (group) => group.Count());
                AddHandbookSummaryField("镇民", CountCategory(counts, "townsfolk").ToString(), CategoryAccent("townsfolk"), 0);
                AddHandbookSummaryField("外来", CountCategory(counts, "outsider").ToString(), CategoryAccent("outsider"), 1);
                AddHandbookSummaryField("爪牙", CountCategory(counts, "minion").ToString(), CategoryAccent("minion"), 2);
                AddHandbookSummaryField("恶魔", CountCategory(counts, "demon").ToString(), CategoryAccent("demon"), 3);
            }
            if (handbookDetailText != null)
            {
                handbookDetailText.text = ClampTextLines(new[]
                {
                    "夜晚顺序只用于公开参考。",
                    "角色是否在场、谁拥有该身份、夜间结果，都不会在这里泄露。",
                    "",
                    "实际夜间行动请看当前阶段的行动表单或说书人队列。"
                }, 8, 54);
            }
            if (handbookOrderText != null)
            {
                var first = vm?.scriptHandbook?.firstNightOrder ?? Array.Empty<string>();
                var other = vm?.scriptHandbook?.otherNightOrder ?? Array.Empty<string>();
                handbookOrderText.text = ClampTextLines(new[]
                {
                    "官方表参考",
                    "首夜：" + ShortOrder(first),
                    "其后：" + ShortOrder(other),
                    "",
                    "玩家声称、私聊摘要和矛盾点请看资料抽屉。"
                }, 12, 92);
            }
        }

        private void UpdateHandbookCategoryButtons()
        {
            var roleMode = activeHandbookMode == "roles";
            SetButtonSuggested(handbookAllCategoryButton, roleMode && activeHandbookCategory == "all");
            SetButtonSuggested(handbookTownsfolkCategoryButton, roleMode && activeHandbookCategory == "townsfolk");
            SetButtonSuggested(handbookOutsiderCategoryButton, roleMode && activeHandbookCategory == "outsider");
            SetButtonSuggested(handbookMinionCategoryButton, roleMode && activeHandbookCategory == "minion");
            SetButtonSuggested(handbookDemonCategoryButton, roleMode && activeHandbookCategory == "demon");
        }

        private void RenderHandbookListHeader(ScriptRoleViewModel[] roles, int filteredCount, int pageCount)
        {
            var total = roles == null ? 0 : roles.Length;
            var band = AddPanel("Handbook List Filter Band", handbookRoleListRoot, Vector2.zero, Vector2.zero, new Vector2(14f, 480f), new Vector2(586f, 516f), new Color(0.004f, 0.010f, 0.017f, 0.58f));
            AddImage("Handbook List Filter Accent", band.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), CategoryAccent(activeHandbookCategory));
            AddFrame(band.transform, "Handbook List Filter Frame", 0.7f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            AddText("Handbook List Filter Title", band.transform, Vector2.zero, Vector2.one, new Vector2(14f, 18f), new Vector2(-312f, -4f), $"筛选 · {RolePickerCategoryLabel(activeHandbookCategory)}", 13, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddText("Handbook List Filter Meta", band.transform, Vector2.zero, Vector2.one, new Vector2(14f, 4f), new Vector2(-312f, -20f), $"{filteredCount}/{total} 角色 · 第 {activeHandbookRolePage + 1}/{pageCount} 页", 10, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.72f, 0.82f, 0.86f, 0.82f);

            var counts = (roles ?? Array.Empty<ScriptRoleViewModel>())
                .GroupBy((role) => role.category ?? "")
                .ToDictionary((group) => group.Key, (group) => group.Count());
            AddHandbookCountChip(band.transform, "民", CountCategory(counts, "townsfolk"), "townsfolk", 274f);
            AddHandbookCountChip(band.transform, "外", CountCategory(counts, "outsider"), "outsider", 348f);
            AddHandbookCountChip(band.transform, "爪", CountCategory(counts, "minion"), "minion", 422f);
            AddHandbookCountChip(band.transform, "恶", CountCategory(counts, "demon"), "demon", 496f);
        }

        private void AddHandbookCountChip(Transform parent, string label, int count, string category, float x)
        {
            var active = activeHandbookCategory == "all" || activeHandbookCategory == category;
            var accent = CategoryAccent(category);
            var chip = AddPanel($"Handbook Count {label}", parent, Vector2.zero, Vector2.zero, new Vector2(x, 6f), new Vector2(x + 62f, 30f), active ? new Color(0.12f, 0.065f, 0.030f, 0.76f) : new Color(0.024f, 0.032f, 0.040f, 0.62f));
            AddFrame(chip.transform, "Handbook Count Frame", 0.65f, new Color(accent.r, accent.g, accent.b, active ? 0.34f : 0.16f));
            AddText("Handbook Count Text", chip.transform, Vector2.zero, Vector2.one, new Vector2(5f, 0f), new Vector2(-5f, 0f), $"{label} {count}", 11, TextAnchor.MiddleCenter, FontStyle.Bold).color = active ? new Color(1f, 0.88f, 0.52f, 0.98f) : new Color(0.72f, 0.82f, 0.86f, 0.72f);
        }

        private void RenderHandbookSelectedRoleToken(ScriptRoleViewModel selected)
        {
            if (handbookDetailTokenRoot == null) return;
            ClearChildren(handbookDetailTokenRoot);
            AddFrame(handbookDetailTokenRoot, "Handbook Detail Token Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            if (selected == null)
            {
                AddBlankRoleTokenButton(handbookDetailTokenRoot, "未选", new Vector2(70f, 66f), 78f, false, () => { });
                return;
            }

            AddRoleTokenButton(handbookDetailTokenRoot, selected.id, selected.name, selected.category, selected.team, new Vector2(70f, 66f), 78f, true, () => { });
        }

        private void RenderHandbookDetailSummary(ScriptRoleViewModel selected)
        {
            if (handbookDetailSummaryRoot == null) return;
            ClearChildren(handbookDetailSummaryRoot);
            if (selected == null)
            {
                AddHandbookSummaryField("类型", "未选中", new Color(0.70f, 0.82f, 0.92f, 0.80f), 0);
                AddHandbookSummaryField("夜晚", "暂无", new Color(0.70f, 0.82f, 0.92f, 0.80f), 1);
                AddHandbookSummaryField("标记", "无", new Color(0.70f, 0.82f, 0.92f, 0.80f), 2);
                AddHandbookSummaryField("边界", "公开剧本", new Color(0.70f, 0.82f, 0.92f, 0.80f), 3);
                return;
            }

            AddHandbookSummaryField("类型", $"{CategoryLabel(selected.category)} / {TeamLabel(selected.team)}", CategoryAccent(selected.category), 0);
            AddHandbookSummaryField("夜晚", HandbookNightSummary(selected), new Color(0.66f, 0.78f, 1f, 0.84f), 1);
            AddHandbookSummaryField("标记", HandbookReminderSummary(selected), new Color(1f, 0.74f, 0.32f, 0.86f), 2);
            AddHandbookSummaryField("边界", "公开能力", new Color(0.72f, 0.92f, 0.74f, 0.82f), 3);
        }

        private void AddHandbookSummaryField(string label, string value, Color accent, int index)
        {
            var width = 132f;
            var gap = 8f;
            var x = index * (width + gap);
            var field = AddPanel($"Handbook Summary {label}", handbookDetailSummaryRoot, Vector2.zero, Vector2.zero, new Vector2(x, 10f), new Vector2(x + width, 62f), new Color(0.004f, 0.010f, 0.017f, 0.54f));
            AddImage("Handbook Summary Accent", field.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(accent.r, accent.g, accent.b, 0.48f));
            AddFrame(field.transform, "Handbook Summary Frame", 0.65f, new Color(accent.r, accent.g, accent.b, 0.24f));
            AddText("Handbook Summary Label", field.transform, Vector2.zero, Vector2.one, new Vector2(10f, 32f), new Vector2(-8f, -6f), label, 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.94f);
            AddText("Handbook Summary Value", field.transform, Vector2.zero, Vector2.one, new Vector2(10f, 9f), new Vector2(-8f, -28f), Ellipsize(value, 14), 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.96f, 0.91f, 0.82f, 0.98f);
        }

        private static Color CategoryAccent(string category)
        {
            if (category == "townsfolk") return new Color(0.32f, 0.62f, 1f, 0.86f);
            if (category == "outsider") return new Color(0.55f, 0.70f, 1f, 0.82f);
            if (category == "minion") return new Color(1f, 0.48f, 0.36f, 0.86f);
            if (category == "demon") return new Color(1f, 0.24f, 0.24f, 0.90f);
            return new Color(0.70f, 0.82f, 0.92f, 0.80f);
        }

        private static string HandbookNightSummary(ScriptRoleViewModel role)
        {
            if (role == null) return "暂无";
            if (role.firstNight > 0 && role.otherNight > 0) return $"首 {role.firstNight} / 后 {role.otherNight}";
            if (role.firstNight > 0) return $"首夜 #{role.firstNight}";
            if (role.otherNight > 0) return $"后夜 #{role.otherNight}";
            return "无夜序";
        }

        private static string HandbookReminderSummary(ScriptRoleViewModel role)
        {
            if (role == null) return "无";
            var count = 0;
            if (role.reminders != null) count += role.reminders.Count((entry) => !string.IsNullOrWhiteSpace(entry));
            if (role.remindersGlobal != null) count += role.remindersGlobal.Count((entry) => !string.IsNullOrWhiteSpace(entry));
            return count == 0 ? "无" : $"{count} 个提醒";
        }
    }
}
