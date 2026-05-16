using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {

        private void BuildEventPanel()
        {
            eventPanel = AddPanel("Event Panel", canvas.transform, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-720f, -330f), new Vector2(-18f, 330f), new Color(0.66f, 0.57f, 0.38f, 0.93f)).GetComponent<RectTransform>();
            eventPanelTargetOffsetMin = eventPanel.offsetMin;
            eventPanelTargetOffsetMax = eventPanel.offsetMax;
            AddFrame(eventPanel, "Event Panel Frame", 1.2f, new Color(0.28f, 0.16f, 0.075f, 0.58f));
            AddImage("Info Drawer Header Wash", eventPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -86f), new Vector2(-1f, -1f), new Color(0.42f, 0.22f, 0.08f, 0.12f));
            AddImage("Info Drawer Content Wash", eventPanel, Vector2.zero, Vector2.one, new Vector2(16f, 66f), new Vector2(-16f, -112f), new Color(0.86f, 0.78f, 0.56f, 0.78f));
            AddImage("Info Drawer Sub Wash", eventPanel, Vector2.zero, Vector2.one, new Vector2(16f, 16f), new Vector2(-16f, -438f), new Color(0.76f, 0.62f, 0.38f, 0.50f));
            AddImage("Info Drawer Notebook Spine", eventPanel, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(76f, 0f), new Color(0.28f, 0.020f, 0.026f, 0.94f));
            AddImage("Info Drawer Spine Edge", eventPanel, Vector2.zero, new Vector2(0f, 1f), new Vector2(76f, 0f), new Vector2(80f, 0f), new Color(0.82f, 0.54f, 0.24f, 0.62f));
            var spineText = AddText("Info Drawer Spine Text", eventPanel, Vector2.zero, new Vector2(0f, 1f), new Vector2(16f, 210f), new Vector2(64f, -130f), "笔\n记\n本", 31, TextAnchor.MiddleCenter, FontStyle.Bold);
            spineText.color = new Color(1f, 0.91f, 0.72f, 0.98f);
            infoDrawerTitle = AddText("Info Drawer Title", eventPanel, Vector2.zero, Vector2.one, new Vector2(24f, 604f), new Vector2(-24f, -14f), "资料抽屉", 29, TextAnchor.UpperLeft, FontStyle.Bold);
            SetRect(infoDrawerTitle.rectTransform, Vector2.zero, Vector2.one, new Vector2(104f, 604f), new Vector2(-24f, -14f));
            infoDrawerTitle.color = new Color(0.20f, 0.10f, 0.045f, 1f);
            AddText("Info Drawer Hint", eventPanel, Vector2.zero, Vector2.one, new Vector2(500f, 614f), new Vector2(-126f, -20f), "", 13, TextAnchor.UpperRight, FontStyle.Normal);
            AddToolActionButton("关", "关闭", eventPanel, new Vector2(640f, 620f), new Vector2(92f, 32f), CloseAuxPanels, true);
            eventTabText = AddButton("日志", eventPanel, new Vector2(72f, 562f), new Vector2(90f, 32f), () => ShowInfoDrawer("events")).GetComponentInChildren<Text>();
            timelineTabText = AddButton("时间", eventPanel, new Vector2(172f, 562f), new Vector2(90f, 32f), () => ShowInfoDrawer("timeline")).GetComponentInChildren<Text>();
            handbookTabText = AddButton("信息", eventPanel, new Vector2(272f, 562f), new Vector2(90f, 32f), () => ShowInfoDrawer("intel")).GetComponentInChildren<Text>();
            recapTabText = AddButton("复盘", eventPanel, new Vector2(372f, 562f), new Vector2(90f, 32f), () => ShowInfoDrawer("recap")).GetComponentInChildren<Text>();
            SetInfoTabButtonPosition(eventTabText, new Vector2(138f, 562f));
            SetInfoTabButtonPosition(timelineTabText, new Vector2(238f, 562f));
            SetInfoTabButtonPosition(handbookTabText, new Vector2(338f, 562f));
            SetInfoTabButtonPosition(recapTabText, new Vector2(438f, 562f));
            eventBody = AddText("Info Drawer Main", eventPanel, Vector2.zero, Vector2.one, new Vector2(28f, 188f), new Vector2(-28f, -114f), "", 17, TextAnchor.UpperLeft, FontStyle.Normal);
            queueBody = AddText("Info Drawer Sub", eventPanel, Vector2.zero, Vector2.one, new Vector2(28f, 52f), new Vector2(-28f, -474f), "", 16, TextAnchor.UpperLeft, FontStyle.Normal);
            ApplyInfoDrawerTextStyle();
            eventPanel.gameObject.SetActive(false);
        }


        private void BuildTimelinePanel()
        {
            timelinePanel = AddPanel("Timeline Panel", canvas.transform, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(118f, -260f), new Vector2(418f, 220f), new Color(0.004f, 0.010f, 0.017f, 0.70f)).GetComponent<RectTransform>();
            AddFrame(timelinePanel, "Timeline Panel Frame", 1.2f, new Color(0.82f, 0.56f, 0.25f, 0.30f));
            AddText("Timeline Title", timelinePanel, Vector2.zero, Vector2.one, new Vector2(20f, 430f), new Vector2(-20f, -10f), "对话时间线", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            timelineBody = AddText("Timeline Body", timelinePanel, Vector2.zero, Vector2.one, new Vector2(20f, 18f), new Vector2(-20f, -58f), "", 14, TextAnchor.UpperLeft, FontStyle.Normal);
            timelinePanel.gameObject.SetActive(false);
        }


        private void SetInfoTabButtonPosition(Text label, Vector2 center)
        {
            if (label == null || label.transform.parent == null) return;
            var rect = label.transform.parent as RectTransform;
            if (rect == null) return;
            SetRect(rect, Vector2.zero, Vector2.zero, center - new Vector2(45f, 16f), center + new Vector2(45f, 16f));
        }


        private void ApplyInfoDrawerTextStyle()
        {
            var notebook = infoDrawerTab == "intel";
            if (eventBody != null)
            {
                SetRect(eventBody.rectTransform, Vector2.zero, Vector2.one, notebook ? new Vector2(106f, 86f) : new Vector2(106f, 188f), notebook ? new Vector2(-30f, -112f) : new Vector2(-30f, -114f));
                eventBody.fontSize = notebook ? 19 : 16;
                eventBody.fontStyle = notebook ? FontStyle.Bold : FontStyle.Normal;
                eventBody.color = new Color(0.11f, 0.060f, 0.030f, 0.98f);
            }
            if (queueBody != null)
            {
                SetRect(queueBody.rectTransform, Vector2.zero, Vector2.one, new Vector2(106f, 42f), notebook ? new Vector2(-30f, -588f) : new Vector2(-30f, -474f));
                queueBody.fontSize = notebook ? 14 : 15;
                queueBody.color = new Color(0.22f, 0.12f, 0.055f, 0.84f);
            }
        }


        private string InfoDrawerTitle()
        {
            if (infoDrawerTab == "timeline") return "资料抽屉 · 时间";
            if (infoDrawerTab == "intel") return "资料抽屉 · 信息";
            if (infoDrawerTab == "handbook") return "资料抽屉 · 手册";
            if (infoDrawerTab == "recap") return "资料抽屉 · 复盘";
            return "资料抽屉 · 日志";
        }


        private void UpdateInfoDrawerTabs()
        {
            SetInfoTabStyle(eventTabText, "events", "日志");
            SetInfoTabStyle(timelineTabText, "timeline", "时间");
            SetInfoTabStyle(handbookTabText, "intel", "信息");
            SetInfoTabStyle(recapTabText, "recap", "复盘");
        }


        private void RefreshInfoDrawerTabLayout()
        {
            ApplyInfoDrawerTextStyle();
        }


        private void SetInfoTabStyle(Text label, string tab, string title)
        {
            if (label == null) return;
            var active = infoDrawerTab == tab;
            label.text = active ? $"◆ {title}" : title;
            label.color = active ? new Color(1f, 0.82f, 0.42f, 1f) : new Color(0.86f, 0.78f, 0.64f, 0.86f);
            label.fontStyle = active ? FontStyle.Bold : FontStyle.Normal;
        }


        private string BuildInfoDrawerMainText()
        {
            ApplyInfoDrawerTextStyle();
            if (infoDrawerTab == "timeline") return BuildTimelineOnlyText();
            if (infoDrawerTab == "intel") return BuildNotebookInformationText();
            if (infoDrawerTab == "handbook") return BuildHandbookText();
            if (infoDrawerTab == "recap") return BuildRecapText();
            return BuildEventText();
        }


        private string BuildInfoDrawerSubText()
        {
            if (infoDrawerTab == "handbook")
            {
                var roles = vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>();
                var townsfolk = roles.Count((entry) => entry.category == "townsfolk");
                var outsider = roles.Count((entry) => entry.category == "outsider");
                var minion = roles.Count((entry) => entry.category == "minion");
                var demon = roles.Count((entry) => entry.category == "demon");
                return $"角色数：{roles.Length}  民 {townsfolk} / 外 {outsider} / 爪 {minion} / 恶 {demon}";
            }
            if (infoDrawerTab == "recap")
            {
                var count = vm.aiRecapDetails?.Length ?? 0;
                return $"AI 条目：{count}  ·  来源：JS Core belief trail";
            }
            if (infoDrawerTab == "intel") return BuildNotebookSummaryText();
            return BuildQueueText();
        }


        private string BuildTimelineText()
        {
            var timeline = vm.timeline ?? Array.Empty<TimelineEntryViewModel>();
            var start = Mathf.Max(0, timeline.Length - 8);
            var lines = new List<string>();
            for (var i = start; i < timeline.Length; i++)
            {
                var item = timeline[i];
                var speaker = NameForPlayerId(item.speakerId);
                var target = NameForPlayerId(item.targetId);
                var arrow = string.IsNullOrWhiteSpace(item.targetId) ? "" : $" -> {target}";
                lines.Add($"[{TimelineModeLabel(item.mode)}] {speaker}{arrow}: {item.text}");
            }
            if (vm.aiRecap != null && vm.aiRecap.Length > 0)
            {
                if (lines.Count > 0) lines.Add("");
                lines.Add("AI 复盘摘要：");
                for (var i = 0; i < vm.aiRecap.Length && i < 4; i++) lines.Add($"- {vm.aiRecap[i]}");
            }
            if (vm.aiRecapDetails != null && vm.aiRecapDetails.Length > 0)
            {
                var detail = vm.aiRecapDetails[0];
                lines.Add("");
                lines.Add($"首位 AI 证据簿：{detail.name} -> {detail.target} {detail.score}");
                var targets = detail.targets ?? Array.Empty<AiRecapTargetViewModel>();
                if (targets.Length > 0)
                {
                    var target = targets[0];
                    lines.Add($"{target.name}：{target.reason}");
                    var trail = target.trail ?? Array.Empty<AiTrailViewModel>();
                    for (var i = 0; i < trail.Length && i < 2; i++)
                    {
                        lines.Add($"  {trail[i].evidenceKind} {trail[i].before:0}%->{trail[i].after:0}% {trail[i].reason}");
                    }
                }
            }
            if (lines.Count == 0) return "暂无公聊 / 私聊时间线。";
            return string.Join("\n", lines);
        }


        private string BuildTimelineOnlyText()
        {
            var timeline = vm.timeline ?? Array.Empty<TimelineEntryViewModel>();
            if (timeline.Length == 0) return "暂无公聊 / 私聊时间线。";
            var start = Mathf.Max(0, timeline.Length - 12);
            var lines = new List<string> { "最近对话", "────────" };
            for (var i = start; i < timeline.Length; i++)
            {
                var item = timeline[i];
                var speaker = NameForPlayerId(item.speakerId);
                var target = NameForPlayerId(item.targetId);
                var arrow = string.IsNullOrWhiteSpace(item.targetId) ? "" : $" -> {target}";
                lines.Add($"[{TimelineModeLabel(item.mode)}] {speaker}{arrow}: {item.text}");
            }
            return ClampTextLines(lines, 14, 48);
        }

        private string BuildNotebookInformationText()
        {
            var claims = BuildNotebookClaimLines().ToArray();
            var reports = BuildNotebookReportLines().ToArray();
            var lines = new List<string>();

            if (claims.Length > 0)
            {
                foreach (var entry in claims.Take(10)) lines.Add(entry);
            }

            if (reports.Length > 0)
            {
                if (lines.Count > 0) lines.Add("");
                foreach (var entry in reports.TakeLast(8)) lines.Add(entry);
            }

            if (lines.Count == 0) lines.Add("暂无 AI 身份声称或报信。");
            return ClampTextLines(lines, 19, 38);
        }


        private string BuildNotebookSummaryText()
        {
            var claimCount = BuildNotebookClaimLines().Count();
            var reportCount = BuildNotebookReportLines().Count();
            return $"身份 {claimCount}   报信 {reportCount}";
        }


        private IEnumerable<string> BuildNotebookClaimLines()
        {
            var seen = new HashSet<string>();
            var players = vm.players ?? Array.Empty<PlayerViewModel>();
            if (!vm.grimoireView)
            {
                foreach (var player in players.Where((entry) => entry != null && !entry.human && !string.IsNullOrWhiteSpace(entry.roleId)).OrderBy((entry) => entry.seat))
                {
                    var role = RoleForId(player.roleId);
                    var roleName = FirstNonEmpty(player.roleName, role?.name, RoleNameForId(player.roleId));
                    var line = $"{NotebookSeatLabel(player)}  {NotebookRoleIcon(role)} {roleName}";
                    if (seen.Add($"claim:{player.id}:{roleName}")) yield return line;
                }
            }

            foreach (var item in vm.timeline ?? Array.Empty<TimelineEntryViewModel>())
            {
                if (!NotebookLooksLikeClaimEntry(item)) continue;
                var player = PlayerById(item.speakerId);
                if (player == null || player.human) continue;
                var roleName = NotebookClaimRoleName(item);
                if (string.IsNullOrWhiteSpace(roleName)) continue;
                var line = $"{NotebookSeatLabel(player)}  {roleName}";
                if (seen.Add($"claim:{player.id}:{roleName}")) yield return line;
            }
        }


        private IEnumerable<string> BuildNotebookReportLines()
        {
            var seen = new HashSet<string>();
            foreach (var item in vm.timeline ?? Array.Empty<TimelineEntryViewModel>())
            {
                if (!NotebookLooksLikeReportEntry(item)) continue;
                var player = PlayerById(item.speakerId);
                if (player == null || player.human) continue;
                var summary = NotebookReportSummary(item);
                if (string.IsNullOrWhiteSpace(summary)) continue;
                var line = $"{NotebookSeatLabel(player)}  报：{summary}";
                if (seen.Add($"report:{player.id}:{summary}")) yield return line;
            }
        }


        private PlayerViewModel PlayerById(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return null;
            return (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && player.id == playerId);
        }


        private static string NotebookSeatLabel(PlayerViewModel player)
        {
            if (player == null) return "?号";
            return player.seat > 0 ? $"{player.seat}号" : FirstNonEmpty(player.name, player.id);
        }


        private static string NotebookRoleIcon(ScriptRoleViewModel role)
        {
            if (role == null) return "◇";
            if (string.Equals(role.team, "evil", StringComparison.OrdinalIgnoreCase) || role.category == "demon") return "◆";
            if (role.category == "minion") return "✦";
            if (role.category == "outsider") return "◇";
            return "△";
        }


        private string NotebookClaimRoleName(TimelineEntryViewModel item)
        {
            var text = item?.text ?? "";
            var roles = (vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>())
                .Where((role) => role != null && !string.IsNullOrWhiteSpace(role.name))
                .OrderByDescending((role) => role.name.Length);
            foreach (var role in roles)
            {
                if (text.IndexOf(role.name, StringComparison.OrdinalIgnoreCase) >= 0) return role.name;
            }
            return "";
        }


        private static bool NotebookLooksLikeClaimEntry(TimelineEntryViewModel item)
        {
            if (item == null) return false;
            if (NotebookTextHasAny(item.intent, "claim", "public-claim")) return true;
            if (NotebookTextHasAny(item.evidenceKind, "claim")) return true;
            return NotebookTextHasAny(
                item.text,
                "公开身份",
                "公开报身份",
                "声称自己是",
                "我是",
                "我先跳",
                "我跳",
                "先跳",
                "台面上我先跳",
                "公开说，我是",
                "身份先放桌上",
                "身份放桌上",
                "私聊中报身份",
                "我声称自己是");
        }


        private static bool NotebookLooksLikeReportEntry(TimelineEntryViewModel item)
        {
            if (item == null || NotebookLooksLikeClaimEntry(item)) return false;
            if (!string.IsNullOrWhiteSpace(item.abilityRoleId) || !string.IsNullOrWhiteSpace(item.abilityKind)) return true;
            if (NotebookTextHasAny(item.intent, "night", "info", "report")) return true;
            if (NotebookTextHasAny(item.evidenceKind, "night-info", "info")) return true;
            var text = item.text ?? "";
            var hasNightCue = NotebookTextHasAny(text, "昨晚", "昨夜", "夜里", "夜间", "夜信", "得到的信息");
            var hasInfoCue = NotebookTextHasAny(text, "信息是", "报信息", "看见", "测到", "同阵营", "不同阵营", "恶魔", "爪牙");
            return hasNightCue && hasInfoCue;
        }


        private string NotebookReportSummary(TimelineEntryViewModel item)
        {
            var text = (item?.text ?? "").Replace("\r", " ").Replace("\n", " ").Trim();
            foreach (var marker in new[] { "我说我昨晚得到的信息是：", "我昨晚得到的信息是：", "我昨晚的信息是：", "昨晚信息：", "信息是：" })
            {
                var index = text.IndexOf(marker, StringComparison.Ordinal);
                if (index >= 0)
                {
                    text = text.Substring(index + marker.Length).Trim();
                    break;
                }
            }
            if (!string.IsNullOrWhiteSpace(item?.abilityRoleId))
            {
                var roleName = RoleNameForId(item.abilityRoleId);
                if (!string.IsNullOrWhiteSpace(roleName) && text.IndexOf(roleName, StringComparison.OrdinalIgnoreCase) < 0)
                {
                    text = $"{roleName}：{text}";
                }
            }
            return Ellipsize(text, 32);
        }


        private static bool NotebookTextHasAny(string value, params string[] needles)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            foreach (var needle in needles)
            {
                if (!string.IsNullOrWhiteSpace(needle) && value.IndexOf(needle, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            }
            return false;
        }


        private string BuildInformationOnlyText()
        {
            var lines = new List<string> { "信息板", "────────" };
            var ownInfo = vm.privateInfo ?? Array.Empty<string>();
            if (ownInfo.Length > 0)
            {
                lines.Add("你的信息");
                foreach (var entry in ownInfo.Where((item) => !string.IsNullOrWhiteSpace(item)).TakeLast(6))
                {
                    lines.Add($"- {entry.Trim()}");
                }
                lines.Add("");
            }

            var claims = BuildClaimInformationLines().ToArray();
            if (claims.Length > 0)
            {
                lines.Add("自己信息 / 他人跳身份 / 报信息");
                foreach (var entry in claims.TakeLast(10)) lines.Add($"- {entry}");
            }

            if (lines.Count <= 2) lines.Add("暂无可整理的信息。这里不会收录普通闲聊，只保留身份声称、夜间信息和你自己的私有信息。");
            return ClampTextLines(lines, 18, 54);
        }

        private IEnumerable<string> BuildClaimInformationLines()
        {
            var seen = new HashSet<string>();
            foreach (var item in vm.timeline ?? Array.Empty<TimelineEntryViewModel>())
            {
                if (item == null || string.IsNullOrWhiteSpace(item.text)) continue;
                if (!LooksLikeInformationEntry(item)) continue;
                var speaker = NameForPlayerId(item.speakerId);
                var target = string.IsNullOrWhiteSpace(item.targetId) ? "" : $" -> {NameForPlayerId(item.targetId)}";
                var label = TimelineInformationLabel(item);
                var line = $"[{label}] {speaker}{target}: {Ellipsize(item.text.Trim(), 72)}";
                if (seen.Add(line)) yield return line;
            }

            foreach (var item in vm.events ?? Array.Empty<string>())
            {
                if (string.IsNullOrWhiteSpace(item) || !LooksLikeInformationText(item)) continue;
                var line = $"[事件] {Ellipsize(item.Trim().TrimStart('-', ' '), 76)}";
                if (seen.Add(line)) yield return line;
            }
        }

        private static bool LooksLikeInformationEntry(TimelineEntryViewModel item)
        {
            var intent = item.intent ?? "";
            var evidence = item.evidenceKind ?? "";
            if (intent.IndexOf("claim", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            if (intent.IndexOf("night", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            if (evidence.IndexOf("claim", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            if (evidence.IndexOf("night-info", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            return LooksLikeInformationText(item.text);
        }

        private static bool LooksLikeInformationText(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return false;
            return text.Contains("声称")
                || text.Contains("跳")
                || text.Contains("我是")
                || text.Contains("身份")
                || text.Contains("昨晚")
                || text.Contains("昨夜")
                || text.Contains("夜里")
                || text.Contains("夜间")
                || text.Contains("信息");
        }

        private static string TimelineInformationLabel(TimelineEntryViewModel item)
        {
            var intent = item?.intent ?? "";
            var evidence = item?.evidenceKind ?? "";
            var text = item?.text ?? "";
            if (intent.IndexOf("claim", StringComparison.OrdinalIgnoreCase) >= 0 || evidence.IndexOf("claim", StringComparison.OrdinalIgnoreCase) >= 0 || text.Contains("声称") || text.Contains("我是")) return "身份";
            if (intent.IndexOf("night", StringComparison.OrdinalIgnoreCase) >= 0 || evidence.IndexOf("night-info", StringComparison.OrdinalIgnoreCase) >= 0 || text.Contains("昨晚") || text.Contains("夜里")) return "夜信";
            return "信息";
        }


        private string BuildRecapText()
        {
            var outcomeLines = new List<string>();
            if (IsGameOver())
            {
                outcomeLines.Add("终局结果");
                outcomeLines.Add("────────");
                outcomeLines.Add($"{OutcomeWinnerLabel()}胜利");
                var reason = FirstNonEmpty(vm?.winnerReason, vm?.outcome?.reason);
                if (!string.IsNullOrWhiteSpace(reason)) outcomeLines.Add(reason);
                outcomeLines.Add($"结束于 D{vm.day}/N{vm.night} · 存活 {vm.alive} · 死亡 {vm.dead}");
                outcomeLines.Add("");
            }
            var details = vm.aiRecapDetails ?? Array.Empty<AiRecapViewModel>();
            var socialClues = vm.aiSocialClues ?? Array.Empty<string>();
            if (details.Length == 0)
            {
                var recap = vm.aiRecap != null && vm.aiRecap.Length > 0 ? $"AI 摘要\n────────\n{string.Join("\n", vm.aiRecap.Take(8).Select((entry) => $"- {entry}"))}" : "暂无 AI 复盘摘要。";
                var social = socialClues.Length > 0 ? $"\n\n社交线索\n────────\n{string.Join("\n", socialClues.Take(6).Select((entry) => $"- {entry}"))}" : "";
                return outcomeLines.Count > 0 ? ClampTextLines(outcomeLines.Concat(new[] { recap + social }), 16, 52) : recap + social;
            }
            var lines = new List<string>();
            lines.AddRange(outcomeLines);
            lines.Add("AI 推理摘要");
            lines.Add("────────");
            if (socialClues.Length > 0)
            {
                lines.Add("社交线索");
                foreach (var clue in socialClues.Take(4)) lines.Add($"  {clue}");
                lines.Add("");
            }
            foreach (var detail in details.Take(3))
            {
                lines.Add($"{detail.name} -> {detail.target} {detail.score}");
                lines.Add($"  {detail.reason}");
                var top = detail.targets?.FirstOrDefault();
                if (top != null)
                {
                    lines.Add($"  关注 {top.name}：{top.reason}");
                    var trail = top.trail ?? Array.Empty<AiTrailViewModel>();
                    foreach (var entry in trail.TakeLast(2))
                    {
                        lines.Add($"    {entry.evidenceKind} {entry.before:0}%->{entry.after:0}% {entry.reason}");
                    }
                }
            }
            return ClampTextLines(lines, 14, 48);
        }


        private string BuildBluffText()
        {
            var bluffs = vm.bluffs ?? Array.Empty<string>();
            return bluffs.Length == 0 ? "暂无伪装" : string.Join("     ", bluffs);
        }


        private static string TimelineModeLabel(string mode)
        {
            if (mode == "public") return "公聊";
            if (mode == "whisper-in") return "私聊传入";
            if (mode == "whisper-out") return "私聊传出";
            if (mode == "private") return "私聊";
            if (mode == "nomination") return "提名";
            if (mode == "vote") return "投票";
            return "事件";
        }


        private void ToggleEventPanel()
        {
            if (eventPanelOpen && infoDrawerTab == "events")
            {
                eventPanelOpen = false;
            }
            else
            {
                ShowInfoDrawer("events");
            }
        }


        private void ToggleTimelinePanel()
        {
            if (eventPanelOpen && infoDrawerTab == "timeline")
            {
                eventPanelOpen = false;
                ApplyAuxPanelVisibility();
            }
            else
            {
                ShowInfoDrawer("timeline");
            }
        }


        private void ShowInfoDrawer(string tab)
        {
            CloseMoreActionsPanel();
            infoDrawerTab = string.IsNullOrWhiteSpace(tab) ? "events" : tab;
            eventPanelOpen = true;
            timelinePanelOpen = false;
            if (infoDrawerTitle != null) infoDrawerTitle.text = InfoDrawerTitle();
            if (eventBody != null) eventBody.text = BuildInfoDrawerMainText();
            if (queueBody != null) queueBody.text = BuildInfoDrawerSubText();
            UpdateInfoDrawerTabs();
            if (eventPanel != null && !eventPanel.gameObject.activeSelf && !UiMotionDisabled())
            {
                ShowDrawerPanel(eventPanel, eventPanelTargetOffsetMin, eventPanelTargetOffsetMax);
            }
            else
            {
                ApplyAuxPanelVisibility();
            }
        }
    }
}
