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
            handbookTitle = AddText("Handbook Title", handbookPanel, Vector2.zero, Vector2.one, new Vector2(34f, 704f), new Vector2(-34f, -18f), "剧本手册", 31, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Handbook Hint", handbookPanel, Vector2.zero, Vector2.one, new Vector2(1220f, 712f), new Vector2(-150f, -24f), "", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddToolActionButton("关", "关闭", handbookPanel, new Vector2(1410f, 716f), new Vector2(104f, 34f), CloseHandbookPanel, true);
            AddToolActionButton("全", "全部", handbookPanel, new Vector2(84f, 646f), new Vector2(98f, 32f), () => SelectHandbookCategory("all"), true);
            AddToolActionButton("民", "镇民", handbookPanel, new Vector2(192f, 646f), new Vector2(98f, 32f), () => SelectHandbookCategory("townsfolk"), true);
            AddToolActionButton("外", "外来者", handbookPanel, new Vector2(306f, 646f), new Vector2(110f, 32f), () => SelectHandbookCategory("outsider"), true);
            AddToolActionButton("爪", "爪牙", handbookPanel, new Vector2(426f, 646f), new Vector2(98f, 32f), () => SelectHandbookCategory("minion"), true);
            AddToolActionButton("恶", "恶魔", handbookPanel, new Vector2(534f, 646f), new Vector2(98f, 32f), () => SelectHandbookCategory("demon"), true);
            handbookRoleListRoot = AddPanel("Handbook Role List", handbookPanel, Vector2.zero, Vector2.one, new Vector2(30f, 100f), new Vector2(-850f, -134f), new Color(0.020f, 0.028f, 0.036f, 0.26f)).GetComponent<RectTransform>();
            AddFrame(handbookRoleListRoot, "Handbook List Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            AddImage("Handbook Detail Wash", handbookPanel, Vector2.zero, Vector2.one, new Vector2(666f, 318f), new Vector2(-32f, -134f), new Color(0.020f, 0.028f, 0.036f, 0.28f));
            handbookDetailTokenRoot = AddPanel("Handbook Detail Token", handbookPanel, Vector2.zero, Vector2.one, new Vector2(690f, 454f), new Vector2(-648f, -174f), new Color(0.004f, 0.010f, 0.017f, 0.24f)).GetComponent<RectTransform>();
            handbookDetailText = AddText("Handbook Detail", handbookPanel, Vector2.zero, Vector2.one, new Vector2(850f, 342f), new Vector2(-60f, -158f), "", 17, TextAnchor.UpperLeft, FontStyle.Normal);
            AddImage("Handbook Order Wash", handbookPanel, Vector2.zero, Vector2.one, new Vector2(666f, 100f), new Vector2(-32f, -456f), new Color(0.020f, 0.028f, 0.036f, 0.24f));
            handbookOrderText = AddText("Handbook Order", handbookPanel, Vector2.zero, Vector2.one, new Vector2(694f, 118f), new Vector2(-60f, -472f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            AddButton("关闭", handbookPanel, new Vector2(1376f, 46f), new Vector2(100f, 34f), CloseHandbookPanel);
            handbookPanel.gameObject.SetActive(false);
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

        private void OpenHandbookPanel()
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            CloseActionFormPanel();
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(false);
            RenderHandbookPanel();
            ShowModalPanel(handbookPanel);
        }

        private void SelectHandbookCategory(string category)
        {
            activeHandbookCategory = string.IsNullOrWhiteSpace(category) ? "all" : category;
            activeHandbookRoleIndex = 0;
            activeHandbookRolePage = 0;
            RenderHandbookPanel();
        }

        private void SelectHandbookRole(int index)
        {
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

            if (handbookTitle != null) handbookTitle.text = $"剧本手册 · {(string.IsNullOrWhiteSpace(handbook?.scriptName) ? DisplayScriptName() : handbook.scriptName)}";
            if (handbookRoleListRoot != null)
            {
                for (var i = handbookRoleListRoot.childCount - 1; i >= 0; i--) Destroy(handbookRoleListRoot.GetChild(i).gameObject);
                AddFrame(handbookRoleListRoot, "Handbook List Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
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
                    if (!string.IsNullOrWhiteSpace(RoleHandbookTag(role)))
                    {
                        AddText("Handbook Role Tag", handbookRoleListRoot, Vector2.zero, Vector2.zero, new Vector2(42f + col * 108f, 456f - row * 128f), new Vector2(90f + col * 108f, 478f - row * 128f), "标", 11, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.78f, 0.36f, 1f);
                    }
                }
                AddText("Handbook Page Label", handbookRoleListRoot, Vector2.zero, Vector2.zero, new Vector2(196f, 28f), new Vector2(432f, 56f), $"第 {activeHandbookRolePage + 1}/{handbookPages} 页 · {filtered.Length} 个角色", 13, TextAnchor.MiddleCenter, FontStyle.Normal);
                AddButton("‹", handbookRoleListRoot, new Vector2(82f, 42f), new Vector2(54f, 28f), () => ChangeHandbookRolePage(-1));
                AddButton("›", handbookRoleListRoot, new Vector2(530f, 42f), new Vector2(54f, 28f), () => ChangeHandbookRolePage(1));
            }

            if (handbookDetailText != null)
            {
                RenderHandbookSelectedRoleToken(selected);
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
                        "夜晚提醒",
                        HandbookReminderLine("首夜", selected.firstNight, selected.firstNightReminder),
                        HandbookReminderLine("其他夜晚", selected.otherNight, selected.otherNightReminder),
                        "",
                        "标记词",
                        HandbookReminderTokens(selected),
                        "",
                        RoleHandbookUseLine(selected),
                    }, 15, 54);
                }
            }

            if (handbookOrderText != null)
            {
                var first = handbook?.firstNightOrder ?? Array.Empty<string>();
                var other = handbook?.otherNightOrder ?? Array.Empty<string>();
                var lines = new List<string> { "夜晚顺序", "首夜：" + ShortOrder(first), "其后：" + ShortOrder(other) };
                var counts = roles.GroupBy((role) => role.category ?? "").ToDictionary((group) => group.Key, (group) => group.Count());
                lines.Add($"角色数：民 {CountCategory(counts, "townsfolk")} / 外 {CountCategory(counts, "outsider")} / 爪 {CountCategory(counts, "minion")} / 恶 {CountCategory(counts, "demon")}");
                handbookOrderText.text = ClampTextLines(lines, 12, 92);
            }
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
    }
}