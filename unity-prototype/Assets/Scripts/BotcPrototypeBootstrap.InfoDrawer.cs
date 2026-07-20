using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
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
            timelineTabText = AddButton("私聊", eventPanel, new Vector2(172f, 562f), new Vector2(90f, 32f), () => ShowInfoDrawer("whispers")).GetComponentInChildren<Text>();
            handbookTabText = AddButton("公开", eventPanel, new Vector2(272f, 562f), new Vector2(90f, 32f), () => ShowInfoDrawer("public")).GetComponentInChildren<Text>();
            recapTabText = AddButton("线索", eventPanel, new Vector2(372f, 562f), new Vector2(90f, 32f), () => ShowInfoDrawer("clues")).GetComponentInChildren<Text>();
            SetInfoTabButtonPosition(eventTabText, new Vector2(138f, 562f));
            SetInfoTabButtonPosition(timelineTabText, new Vector2(238f, 562f));
            SetInfoTabButtonPosition(handbookTabText, new Vector2(338f, 562f));
            SetInfoTabButtonPosition(recapTabText, new Vector2(438f, 562f));
            eventBody = AddText("Info Drawer Main", eventPanel, Vector2.zero, Vector2.one, new Vector2(28f, 188f), new Vector2(-28f, -114f), "", 17, TextAnchor.UpperLeft, FontStyle.Normal);
            infoActivityCardRoot = AddPanel("Info Activity Cards", eventPanel, Vector2.zero, Vector2.one, new Vector2(106f, 188f), new Vector2(-30f, -114f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            infoNotebookCardRoot = AddPanel("Info Notebook Cards", eventPanel, Vector2.zero, Vector2.one, new Vector2(106f, 86f), new Vector2(-30f, -112f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            infoRecapCardRoot = AddPanel("Info Recap Cards", eventPanel, Vector2.zero, Vector2.one, new Vector2(106f, 188f), new Vector2(-30f, -114f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            queueBody = AddText("Info Drawer Sub", eventPanel, Vector2.zero, Vector2.one, new Vector2(28f, 52f), new Vector2(-28f, -474f), "", 16, TextAnchor.UpperLeft, FontStyle.Normal);
            infoQueueCardRoot = AddPanel("Info Queue Cards", eventPanel, Vector2.zero, Vector2.one, new Vector2(106f, 34f), new Vector2(-30f, -476f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            ApplyInfoDrawerTextStyle();
            RenderInfoDrawerVisuals();
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
            if (infoDrawerTab == "whispers") return "资料抽屉 · 私聊";
            if (infoDrawerTab == "public") return "资料抽屉 · 公开发言";
            if (infoDrawerTab == "clues") return "资料抽屉 · 线索总结";
            if (infoDrawerTab == "handbook") return "资料抽屉 · 手册";
            return "资料抽屉 · 日志";
        }


        private void UpdateInfoDrawerTabs()
        {
            SetInfoTabStyle(eventTabText, "events", "日志");
            SetInfoTabStyle(timelineTabText, "whispers", "私聊");
            SetInfoTabStyle(handbookTabText, "public", "公开");
            SetInfoTabStyle(recapTabText, "clues", "线索");
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
            if (infoDrawerTab == "whispers") return BuildWhisperTabText();
            if (infoDrawerTab == "public") return BuildPublicSpeechTabText();
            if (infoDrawerTab == "clues") return BuildClueSummaryTabText();
            if (infoDrawerTab == "handbook") return BuildHandbookText();
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
            if (infoDrawerTab == "clues")
            {
                var count = vm.aiRecapDetails?.Length ?? 0;
                var clues = vm.aiSocialClues?.Length ?? 0;
                var reasoning = vm.aiReasoningRecap?.Length ?? 0;
                return $"身份/报信 {BuildNotebookClaimLines().Count() + BuildNotebookReportLines().Count()}   推理 {reasoning}   社交线索 {clues}   摘要 {count}";
            }
            if (infoDrawerTab == "whispers") return BuildWhisperTabSummaryText();
            if (infoDrawerTab == "public") return BuildPublicSpeechTabSummaryText();
            return BuildQueueText();
        }


        private void RenderInfoDrawerVisuals()
        {
            var recapDetails = vm?.aiRecapDetails ?? Array.Empty<AiRecapViewModel>();
            var reasoningRecap = vm?.aiReasoningRecap ?? Array.Empty<AiReasoningRecapViewModel>();
            var showRecapCards = false;
            var showClueCards = infoDrawerTab == "clues";
            var showPublicCards = infoDrawerTab == "public";
            var showNotebookCards = infoDrawerTab == "whispers" || showPublicCards;
            var showActivityCards = infoDrawerTab == "events";

            if (eventBody != null) eventBody.gameObject.SetActive(!showRecapCards && !showClueCards && !showNotebookCards && !showActivityCards);
            if (queueBody != null) queueBody.gameObject.SetActive(!showActivityCards && !showNotebookCards);
            if (infoActivityCardRoot != null)
            {
                infoActivityCardRoot.gameObject.SetActive(showActivityCards);
                ClearChildren(infoActivityCardRoot);
                if (showActivityCards) RenderInfoActivityCards(infoActivityCardRoot);
            }
            if (infoQueueCardRoot != null)
            {
                infoQueueCardRoot.gameObject.SetActive(showActivityCards);
                ClearChildren(infoQueueCardRoot);
                if (showActivityCards) RenderInfoQueueCards(infoQueueCardRoot);
            }
            if (infoNotebookCardRoot != null)
            {
                infoNotebookCardRoot.gameObject.SetActive(showNotebookCards);
                ClearChildren(infoNotebookCardRoot);
                if (showPublicCards) RenderPublicSpeechCards(infoNotebookCardRoot);
                else if (showNotebookCards) RenderWhisperInformationCards(infoNotebookCardRoot);
            }
            if (infoRecapCardRoot == null) return;

            infoRecapCardRoot.gameObject.SetActive(showRecapCards || showClueCards);
            ClearChildren(infoRecapCardRoot);
            if (showClueCards)
            {
                RenderClueSummaryCards(infoRecapCardRoot);
                return;
            }
            if (!showRecapCards) return;

            var socialClues = vm?.aiSocialClues ?? Array.Empty<string>();
            var reasoningIndex = NormalizeReasoningRecapIndex(reasoningRecap.Length);
            AddAiRecapSummaryStrip(infoRecapCardRoot, recapDetails, socialClues, reasoningRecap, reasoningIndex);

            AddAiRecapSuspectSnapshot(infoRecapCardRoot, recapDetails, reasoningRecap, reasoningIndex, 204f);
            var y = 102f;
            if (reasoningRecap.Length > 0)
            {
                var selectedReasoning = reasoningRecap[Mathf.Clamp(reasoningIndex, 0, reasoningRecap.Length - 1)];
                if (selectedReasoning != null)
                {
                    AddAiReasoningRecapCard(infoRecapCardRoot, selectedReasoning, y);
                    y -= 102f;
                    AddAiReasoningEvidenceDrilldownCard(infoRecapCardRoot, selectedReasoning, y);
                }
                return;
            }

            foreach (var detail in recapDetails.Take(2))
            {
                AddAiRecapCard(infoRecapCardRoot, detail, y);
                y -= 102f;
            }
        }


        private void RenderClueSummaryCards(Transform parent)
        {
            if (parent == null) return;
            var ownInfo = (vm?.privateInfo ?? Array.Empty<string>())
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Select(PlayerFacingClueLine)
                .TakeLast(3)
                .ToArray();
            var claims = BuildNotebookClaimLines()
                .Select(PlayerFacingClueLine)
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Take(4)
                .ToArray();
            var reports = BuildNotebookReportLines()
                .Select(PlayerFacingClueLine)
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .TakeLast(4)
                .ToArray();
            var social = (vm?.aiSocialClues ?? Array.Empty<string>())
                .Select(PlayerFacingClueLine)
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Take(3)
                .ToArray();

            AddClueSummaryCard(
                parent,
                "己",
                "已知信息",
                ownInfo.Length == 0 ? new[] { "暂无自己的夜间或私有确认信息。" } : ownInfo,
                new Vector2(0f, 244f),
                new Vector2(584f, 356f),
                ownInfo.Length,
                new Color(0.030f, 0.11f, 0.085f, 0.88f)
            );
            AddClueSummaryCard(
                parent,
                "证",
                "待验证",
                reports.Length == 0 ? new[] { "暂无可验证报信。" } : reports,
                new Vector2(0f, 124f),
                new Vector2(286f, 232f),
                reports.Length,
                new Color(0.080f, 0.085f, 0.13f, 0.86f)
            );
            AddClueSummaryCard(
                parent,
                "身",
                "身份声称",
                claims.Length == 0 ? new[] { "暂无身份声称。" } : claims,
                new Vector2(298f, 124f),
                new Vector2(584f, 232f),
                claims.Length,
                new Color(0.13f, 0.075f, 0.030f, 0.86f)
            );

            var next = PlayerFacingClueLine(FirstNonEmpty(vm?.phaseAdvance?.reason, vm?.phaseObjectiveHint, FlowNextLabel(), "等待下一步可用行动。"));
            var socialLines = social.Length == 0 ? new[] { "暂无明显矛盾或社交线索。", $"下一步：{next}" } : social.Concat(new[] { $"下一步：{next}" }).ToArray();
            AddClueSummaryCard(
                parent,
                "问",
                "社交线索 / 下一步",
                socialLines,
                new Vector2(0f, 8f),
                new Vector2(584f, 112f),
                social.Length,
                new Color(0.12f, 0.075f, 0.14f, 0.84f)
            );
        }


        private void AddClueSummaryCard(Transform parent, string icon, string title, IEnumerable<string> entries, Vector2 offsetMin, Vector2 offsetMax, int count, Color accent)
        {
            var height = Mathf.Max(1f, offsetMax.y - offsetMin.y);
            var card = AddPanel($"Clue Summary Card {title}", parent, Vector2.zero, Vector2.zero, offsetMin, offsetMax, new Color(0.92f, 0.82f, 0.58f, 0.52f));
            AddFrame(card.transform, "Clue Summary Card Frame", 0.7f, new Color(0.26f, 0.13f, 0.055f, 0.24f));
            AddImage("Clue Summary Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), accent);
            var badge = AddImage("Clue Summary Badge", card.transform, Vector2.zero, Vector2.zero, new Vector2(14f, height - 43f), new Vector2(46f, height - 11f), accent);
            AddFrame(badge.transform, "Clue Summary Badge Frame", 0.6f, new Color(0.16f, 0.080f, 0.035f, 0.42f));
            AddText("Clue Summary Badge Text", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, 14, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.88f, 0.56f, 0.98f);
            AddText("Clue Summary Title", card.transform, Vector2.zero, Vector2.one, new Vector2(56f, height - 39f), new Vector2(-86f, -10f), title, 16, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Clue Summary Count", card.transform, Vector2.zero, Vector2.one, new Vector2(offsetMax.x - offsetMin.x - 82f, height - 36f), new Vector2(-14f, -14f), count == 0 ? "空" : $"{count}条", 11, TextAnchor.UpperRight, FontStyle.Bold).color = count == 0 ? new Color(0.40f, 0.24f, 0.12f, 0.70f) : new Color(0.32f, 0.14f, 0.055f, 0.92f);

            var lineList = entries?.Select(PlayerFacingClueLine).Where((entry) => !string.IsNullOrWhiteSpace(entry)).Take(4).ToArray() ?? Array.Empty<string>();
            var body = lineList.Length == 0 ? "暂无记录。" : string.Join("\n", lineList.Select((entry) => $"· {Ellipsize(entry, offsetMax.x - offsetMin.x > 360f ? 52 : 24)}"));
            AddText("Clue Summary Body", card.transform, Vector2.zero, Vector2.one, new Vector2(16f, 10f), new Vector2(-16f, -(height - 54f)), body, 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.14f, 0.075f, 0.035f, 0.92f);
        }


        private static string PlayerFacingClueLine(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var clean = value.Trim();
            clean = clean.Replace("Timeline Rationale", "发言依据");
            clean = clean.Replace("reason:", "理由：").Replace("Reason:", "理由：");
            clean = clean.Replace("target", "目标").Replace("Target", "目标");
            clean = clean.Replace("evidence", "线索").Replace("Evidence", "线索");
            clean = clean.Replace("cards", "线索").Replace("Cards", "线索");
            clean = clean.Replace("JS Core", "规则服务");
            clean = clean.Replace("viewmodel", "界面数据").Replace("ViewModel", "界面数据");
            clean = clean.Replace("payload", "提交内容").Replace("Payload", "提交内容");
            return clean;
        }


        private void RenderInfoActivityCards(Transform parent)
        {
            var timeline = vm?.timeline ?? Array.Empty<TimelineEntryViewModel>();
            var events = vm?.events ?? Array.Empty<string>();
            var timelineTab = infoDrawerTab == "timeline";
            AddInfoDrawerStatCard(parent, 0, "阶段", Ellipsize(PhaseLabel(), 10), $"D{vm.day}/N{vm.night}", new Color(0.23f, 0.10f, 0.040f, 0.92f));
            AddInfoDrawerStatCard(parent, 1, "人数", $"存活 {vm.alive}", $"死亡 {vm.dead}", new Color(0.15f, 0.13f, 0.055f, 0.92f));
            AddInfoDrawerStatCard(parent, 2, timelineTab ? "对话" : "记录", $"{(timelineTab ? timeline.Length : events.Length)} 条", $"队列 {InfoDrawerQueueCount()} 项", new Color(0.055f, 0.11f, 0.12f, 0.92f));

            AddText("Info Activity Section Title", parent, Vector2.zero, Vector2.one, new Vector2(2f, 268f), new Vector2(-300f, -68f), timelineTab ? "最近对话" : "最近事件", 15, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Info Activity Section Meta", parent, Vector2.zero, Vector2.one, new Vector2(286f, 268f), new Vector2(-2f, -70f), timelineTab ? BuildTimelineModeSummary(timeline) : BuildEventLedgerSummary(events), 12, TextAnchor.UpperRight, FontStyle.Normal).color = new Color(0.32f, 0.18f, 0.080f, 0.82f);

            if (timelineTab)
            {
                RenderInfoTimelineRows(parent, timeline);
            }
            else
            {
                RenderInfoEventRows(parent, events);
            }
        }


        private void AddInfoDrawerStatCard(Transform parent, int index, string label, string value, string meta, Color accent)
        {
            const float width = 180f;
            const float gap = 13f;
            var x = index * (width + gap);
            var card = AddPanel($"Info Drawer Stat {label}", parent, Vector2.zero, Vector2.zero, new Vector2(x, 298f), new Vector2(x + width, 358f), new Color(0.15f, 0.080f, 0.036f, 0.82f));
            AddFrame(card.transform, "Info Drawer Stat Frame", 0.7f, new Color(0.95f, 0.66f, 0.30f, 0.30f));
            AddImage("Info Drawer Stat Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), accent);
            AddText("Info Drawer Stat Label", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 38f), new Vector2(-12f, -8f), label, 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.45f, 0.92f);
            AddText("Info Drawer Stat Value", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 16f), new Vector2(-12f, -22f), Ellipsize(value, 12), 17, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.93f, 0.78f, 0.98f);
            AddText("Info Drawer Stat Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 5f), new Vector2(-12f, -43f), Ellipsize(meta, 16), 10, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.88f, 0.68f, 0.72f);
        }


        private void RenderInfoEventRows(Transform parent, string[] events)
        {
            var cleanEvents = (events ?? Array.Empty<string>())
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Select(PlayerFacingEventLine)
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .ToArray();
            var recent = cleanEvents.TakeLast(4).Reverse().ToArray();
            if (recent.Length == 0)
            {
                AddInfoActivityRow(parent, 160f, "等", "等待事件", "当前没有新记录", "说书人尚未写入事件。", new Color(0.11f, 0.085f, 0.055f, 0.88f));
                AddInfoEventLedgerFoldRow(parent, cleanEvents.Length, recent.Length);
                return;
            }

            for (var i = 0; i < recent.Length; i++)
            {
                var absoluteIndex = cleanEvents.Length - i;
                AddInfoActivityRow(parent, 212f - i * 52f, "事", $"事件 {absoluteIndex}", i == 0 ? "最新" : $"{i + 1} 条前", recent[i], new Color(0.20f, 0.075f, 0.040f, 0.90f));
            }
            AddInfoEventLedgerFoldRow(parent, cleanEvents.Length, recent.Length);
        }


        private void AddInfoEventLedgerFoldRow(Transform parent, int total, int shown)
        {
            var hidden = Mathf.Max(0, total - shown);
            var title = hidden > 0 ? "完整日志已折叠" : "完整日志";
            var meta = hidden > 0 ? $"隐藏 {hidden} 条" : "全部已显示";
            var body = total <= 0
                ? "暂无完整日志。"
                : hidden > 0
                    ? $"保留全部 {total} 条事件，默认只显示最近 {shown} 条。"
                    : $"当前 {total} 条事件已全部显示。";
            AddInfoActivityRow(parent, 4f, "折", title, meta, body, new Color(0.13f, 0.095f, 0.050f, 0.90f));
        }


        private void RenderInfoTimelineRows(Transform parent, TimelineEntryViewModel[] timeline)
        {
            var clean = (timeline ?? Array.Empty<TimelineEntryViewModel>())
                .Select((entry, index) => new { entry, index })
                .Where((item) => item.entry != null && !string.IsNullOrWhiteSpace(item.entry.text))
                .ToArray();
            var recent = clean
                .TakeLast(4)
                .Reverse()
                .ToList();

            if (!string.IsNullOrWhiteSpace(activeInfoTimelineAnchorId))
            {
                var anchored = clean.FirstOrDefault((item) => TimelineEntryMatchesAnchor(item.entry, item.index, activeInfoTimelineAnchorId));
                if (anchored != null && !recent.Any((item) => item.index == anchored.index))
                {
                    recent.Insert(0, anchored);
                    if (recent.Count > 4) recent.RemoveAt(recent.Count - 1);
                }
            }

            if (recent.Count == 0)
            {
                AddInfoActivityRow(parent, 160f, "时", "暂无对话", "时间线", "公聊与私聊记录会在这里归档。", new Color(0.055f, 0.11f, 0.12f, 0.88f));
                return;
            }

            for (var i = 0; i < recent.Count; i++)
            {
                var item = recent[i];
                var entry = item.entry;
                var speaker = NameForPlayerId(entry.speakerId);
                var target = string.IsNullOrWhiteSpace(entry.targetId) ? "" : $" -> {NameForPlayerId(entry.targetId)}";
                var title = $"{TimelineModeLabel(entry.mode)} · {Ellipsize(speaker + target, 18)}";
                var selected = TimelineEntryMatchesAnchor(entry, item.index, activeInfoTimelineAnchorId);
                var meta = selected ? $"已定位 | {InfoTimelineMeta(entry)}" : InfoTimelineMeta(entry);
                AddInfoActivityRow(parent, 212f - i * 52f, selected ? "TL" : InfoTimelineBadge(entry.mode), title, meta, InfoTimelineBody(entry), selected ? new Color(0.26f, 0.13f, 0.040f, 0.96f) : InfoTimelineAccent(entry.mode), selected);
            }

            var rationaleEntry = recent
                .FirstOrDefault((item) => TimelineEntryMatchesAnchor(item.entry, item.index, activeInfoTimelineAnchorId) && TimelineEntryHasRationaleCards(item.entry))
                ?.entry;
            if (rationaleEntry == null) rationaleEntry = recent.FirstOrDefault((item) => TimelineEntryHasRationaleCards(item.entry))?.entry;
            if (rationaleEntry == null) rationaleEntry = clean.AsEnumerable().Reverse().FirstOrDefault((item) => TimelineEntryHasRationaleCards(item.entry))?.entry;
            AddInfoTimelineRationaleDrilldown(parent, rationaleEntry);
        }

        private static bool TimelineEntryMatchesAnchor(TimelineEntryViewModel entry, int index, string anchorId)
        {
            if (entry == null || string.IsNullOrWhiteSpace(anchorId)) return false;
            if (!string.IsNullOrWhiteSpace(entry.id) && string.Equals(entry.id, anchorId, StringComparison.Ordinal)) return true;
            return string.Equals($"index:{index}", anchorId, StringComparison.Ordinal);
        }


        private static string InfoTimelineBody(TimelineEntryViewModel entry)
        {
            if (entry == null) return "";
            var cardsLine = InfoTimelineRationaleCardsLine(entry.rationaleCards);
            if (!string.IsNullOrWhiteSpace(entry.rationaleSummary) && !string.IsNullOrWhiteSpace(cardsLine))
            {
                return $"摘要：{entry.rationaleSummary}；补充：{cardsLine}";
            }
            if (!string.IsNullOrWhiteSpace(entry.rationaleSummary))
            {
                return $"理由：{entry.rationaleSummary}";
            }
            if (!string.IsNullOrWhiteSpace(cardsLine)) return $"补充：{cardsLine}";
            return entry.text ?? "";
        }


        private static string InfoTimelineRationaleCardsLine(RationaleCardViewModel[] cards)
        {
            var visible = (cards ?? Array.Empty<RationaleCardViewModel>())
                .Where(RationaleCardHasVisibleText)
                .Take(3)
                .Select((card) =>
                {
                    var label = PlayerFacingRationaleLabel(card);
                    var text = RationaleCardTimelineText(card);
                    return string.IsNullOrWhiteSpace(text) ? label : $"{label}: {text}";
                })
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .ToArray();
            return visible.Length == 0 ? "" : string.Join(" / ", visible);
        }

        private static string PlayerFacingRationaleLabel(RationaleCardViewModel card)
        {
            if (card == null) return "线索";
            if (string.Equals(card.kind, "decision", StringComparison.OrdinalIgnoreCase)) return "判断";
            if (string.Equals(card.kind, "strategy", StringComparison.OrdinalIgnoreCase)) return "投票";
            if (string.Equals(card.kind, "verification", StringComparison.OrdinalIgnoreCase)) return "验证";
            return FirstNonEmpty(card.title, "线索");
        }

        private static bool TimelineEntryHasRationaleCards(TimelineEntryViewModel entry)
        {
            return (entry?.rationaleCards ?? Array.Empty<RationaleCardViewModel>()).Any(RationaleCardHasVisibleText);
        }

        private static RationaleCardViewModel[] VisibleInfoTimelineRationaleCards(TimelineEntryViewModel entry)
        {
            return (entry?.rationaleCards ?? Array.Empty<RationaleCardViewModel>())
                .Where(RationaleCardHasVisibleText)
                .Take(3)
                .ToArray();
        }

        private void AddInfoTimelineRationaleDrilldown(Transform parent, TimelineEntryViewModel entry)
        {
            var panel = AddPanel("Info Timeline Insight Drilldown", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 4f), new Vector2(566f, 48f), new Color(0.050f, 0.055f, 0.070f, 0.88f));
            AddFrame(panel.transform, "Info Timeline Insight Drilldown Frame", 0.65f, new Color(0.72f, 0.58f, 0.92f, 0.24f));
            AddImage("Info Timeline Insight Drilldown Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(0.18f, 0.12f, 0.42f, 0.84f));
            AddText("Info Timeline Insight Drilldown Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 27f), new Vector2(-360f, -5f), "发言依据", 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);

            var meta = entry == null
                ? "等待线索"
                : $"{TimelineModeLabel(entry.mode)} | {Ellipsize(FirstNonEmpty(NameForPlayerId(entry.speakerId), entry.speakerId, "AI"), 12)}";
            AddText("Info Timeline Insight Drilldown Meta", panel.transform, Vector2.zero, Vector2.one, new Vector2(152f, 27f), new Vector2(-12f, -5f), Ellipsize(meta, 42), 10, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.82f, 0.90f, 1f, 0.78f);

            var cards = VisibleInfoTimelineRationaleCards(entry);
            if (cards.Length == 0)
            {
                AddText("Info Timeline Insight Drilldown Empty", panel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 7f), new Vector2(-12f, -24f), "暂无可整理的发言依据。", 9, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.91f, 0.78f, 0.72f);
                return;
            }

            const float cardWidth = 174f;
            const float gap = 8f;
            for (var i = 0; i < cards.Length; i++)
            {
                AddInfoTimelineRationaleCard(panel.transform, cards[i], i, new Vector2(12f + i * (cardWidth + gap), 5f), new Vector2(cardWidth, 22f));
            }
        }

        private void AddInfoTimelineRationaleCard(Transform parent, RationaleCardViewModel card, int index, Vector2 bottomLeft, Vector2 size)
        {
            var accent = InfoTimelineRationaleAccent(card?.kind, index);
            var item = AddPanel("Info Timeline Insight Card", parent, Vector2.zero, Vector2.zero, bottomLeft, bottomLeft + size, new Color(0.88f, 0.82f, 0.64f, 0.12f));
            AddFrame(item.transform, "Info Timeline Insight Card Frame", 0.45f, new Color(accent.r, accent.g, accent.b, 0.26f));
            AddImage("Info Timeline Insight Card Accent", item.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), accent);
            var label = PlayerFacingRationaleLabel(card);
            var text = FirstNonEmpty(RationaleCardTimelineText(card), InfoTimelineRationaleCardTraceLine(card), RationaleCardRawLine(card), card?.reasonKey, card?.displayIntent, "待验证");
            AddText("Info Timeline Insight Card Title", item.transform, Vector2.zero, Vector2.one, new Vector2(7f, 11f), new Vector2(-6f, -2f), Ellipsize(label, 15), 7, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.88f, 0.58f, 0.94f);
            AddText("Info Timeline Insight Card Body", item.transform, Vector2.zero, Vector2.one, new Vector2(7f, 1f), new Vector2(-6f, -12f), Ellipsize(text, 22), 7, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.91f, 0.78f, 0.78f);
        }

        private static Color InfoTimelineRationaleAccent(string kind, int index)
        {
            if (string.Equals(kind, "decision", StringComparison.OrdinalIgnoreCase)) return new Color(0.86f, 0.38f, 0.13f, 0.78f);
            if (string.Equals(kind, "strategy", StringComparison.OrdinalIgnoreCase)) return new Color(0.22f, 0.42f, 0.52f, 0.78f);
            if (string.Equals(kind, "verification", StringComparison.OrdinalIgnoreCase)) return new Color(0.44f, 0.30f, 0.70f, 0.78f);
            return index % 2 == 0 ? new Color(0.62f, 0.36f, 0.16f, 0.72f) : new Color(0.28f, 0.40f, 0.44f, 0.72f);
        }

        private static string InfoTimelineRationaleCardTraceLine(RationaleCardViewModel card)
        {
            if (card == null) return "";
            var pieces = new[]
            {
                RationaleCardMatchupTraceLine(card),
                RationaleCardEvidenceTraceLine(card),
                RationaleCardNextCheckTraceLine(card)
            }
                .Where((piece) => !string.IsNullOrWhiteSpace(piece))
                .Take(3)
                .ToArray();
            return pieces.Length == 0 ? "" : string.Join(" | ", pieces);
        }

        private static string RationaleCardMatchupTraceLine(RationaleCardViewModel card)
        {
            if (card == null) return "";
            var target = FirstNonEmpty(card.targetName, card.targetId);
            var runner = FirstNonEmpty(card.runnerUpName, card.runnerUpId);
            var confidence = FirstNonEmpty(card.confidenceBand, card.reasonKey);
            if (!string.IsNullOrWhiteSpace(target) && !string.IsNullOrWhiteSpace(runner))
            {
                return string.IsNullOrWhiteSpace(confidence) ? $"关注 {target} / 对比 {runner}" : $"关注 {target} / 对比 {runner}（{confidence}）";
            }
            if (!string.IsNullOrWhiteSpace(target))
            {
                return string.IsNullOrWhiteSpace(confidence) ? $"关注 {target}" : $"关注 {target}（{confidence}）";
            }
            if (!string.IsNullOrWhiteSpace(runner)) return $"备选关注 {runner}";
            return "";
        }

        private static string RationaleCardEvidenceTraceLine(RationaleCardViewModel card)
        {
            if (card == null) return "";
            var mode = FirstNonEmpty(card.evidenceMode, card.evidenceModeLine);
            var source = FirstNonEmpty(card.sourceReliabilityLine, card.timelineConsistencyLine, card.evidenceInteractionLine, card.evidenceBoundaryLine);
            if (!string.IsNullOrWhiteSpace(mode) && !string.IsNullOrWhiteSpace(source)) return $"依据 {mode} / {source}";
            if (!string.IsNullOrWhiteSpace(mode)) return $"依据 {mode}";
            if (!string.IsNullOrWhiteSpace(source)) return $"来源 {source}";
            return "";
        }

        private static string RationaleCardNextCheckTraceLine(RationaleCardViewModel card)
        {
            if (card == null) return "";
            var next = FirstNonEmpty(card.verificationLine, card.responsePlanLine, card.actionThresholdLine, card.questionPriorityLine, card.runnerUpWatchLine);
            return string.IsNullOrWhiteSpace(next) ? "" : $"下一步 {next}";
        }

        private static string RationaleCardTimelineText(RationaleCardViewModel card)
        {
            if (card == null) return "";
            var headline = FirstNonEmpty(card.summary, card.detail, card.reasonKey, card.displayIntent);
            var sectionLine = RationaleCardSectionLine(card, 2);
            if (!string.IsNullOrWhiteSpace(headline) && !string.IsNullOrWhiteSpace(sectionLine))
            {
                return $"{headline} [{sectionLine}]";
            }
            return FirstNonEmpty(sectionLine, RationaleCardRawLine(card), headline);
        }

        private static bool RationaleCardHasVisibleText(RationaleCardViewModel card)
        {
            return card != null && !string.IsNullOrWhiteSpace(FirstNonEmpty(
                card.title,
                card.summary,
                card.detail,
                RationaleCardSectionLine(card, 1),
                RationaleCardRawLine(card),
                card.reasonKey,
                card.displayIntent
            ));
        }

        private static string RationaleCardSectionLine(RationaleCardViewModel card, int maxSections)
        {
            if (card == null || maxSections <= 0) return "";
            var sections = new[]
            {
                RationaleCardSection("验证", FirstNonEmpty(card.verificationLine, card.responseCriteriaLine)),
                RationaleCardSection("依据", FirstNonEmpty(card.evidenceModeLine, card.evidenceInteractionLine, card.sourceReliabilityLine, card.timelineConsistencyLine)),
                RationaleCardSection("计划", FirstNonEmpty(card.responsePlanLine, card.actionThresholdLine, card.questionPriorityLine)),
                RationaleCardSection("复查", FirstNonEmpty(card.falsificationCheckLine, card.counterEvidenceLine, card.assumptionAuditLine, card.evidenceBoundaryLine)),
                RationaleCardSection("身份", FirstNonEmpty(card.roleHypothesisLine, card.mechanicSensitivityLine, card.worldBranchLine)),
                RationaleCardSection("记忆", FirstNonEmpty(card.memoryContinuityLine, card.evidenceFreshnessLine, card.reconsiderationLine))
            }
                .Where((section) => !string.IsNullOrWhiteSpace(section))
                .Take(maxSections)
                .ToArray();
            return sections.Length == 0 ? "" : string.Join(" | ", sections);
        }

        private static string RationaleCardSection(string label, string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "" : $"{label}：{value.Trim()}";
        }

        private static string RationaleCardRawLine(RationaleCardViewModel card)
        {
            if (card == null) return "";
            return FirstNonEmpty(
                card.verificationLine,
                card.responsePlanLine,
                card.responseCriteriaLine,
                card.evidenceModeLine,
                card.evidenceInteractionLine,
                card.sourceReliabilityLine,
                card.timelineConsistencyLine,
                card.incentiveAlignmentLine,
                card.burdenOfProofLine,
                card.questionPriorityLine,
                card.actionThresholdLine,
                card.memoryContinuityLine,
                card.expressionDisciplineLine,
                card.uncertaintyResolutionLine,
                card.evidenceFreshnessLine,
                card.falsificationCheckLine,
                card.causalChainLine,
                card.assumptionAuditLine,
                card.mechanicSensitivityLine,
                card.roleHypothesisLine,
                card.pressureStageLine,
                card.timingWindowLine,
                card.worldBranchLine,
                card.voteCoalitionLine,
                card.tableRiskLine,
                card.informationGainLine,
                card.tableReactionLine,
                card.counterEvidenceLine,
                card.evidenceBoundaryLine,
                card.runnerUpWatchLine,
                card.confidenceLine,
                card.reconsiderationLine
            );
        }


        private void AddInfoActivityRow(Transform parent, float y, string badge, string title, string meta, string body, Color accent, bool selected = false)
        {
            var card = AddPanel($"Info Activity Row {title}", parent, Vector2.zero, Vector2.zero, new Vector2(0f, y), new Vector2(566f, y + 44f), selected ? new Color(1f, 0.84f, 0.48f, 0.70f) : new Color(0.93f, 0.82f, 0.58f, 0.58f));
            AddFrame(card.transform, "Info Activity Row Frame", 0.7f, selected ? new Color(0.96f, 0.54f, 0.16f, 0.50f) : new Color(0.28f, 0.14f, 0.060f, 0.28f));
            if (selected) AddImage("Info Activity Row Timeline Anchor Glow", card.transform, new Vector2(0f, 0.48f), Vector2.one, new Vector2(6f, -5f), new Vector2(-6f, -4f), new Color(1f, 0.70f, 0.22f, 0.12f));
            AddImage("Info Activity Row Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), accent);
            var badgeImage = AddImage("Info Activity Row Badge", card.transform, Vector2.zero, Vector2.zero, new Vector2(16f, 10f), new Vector2(48f, 34f), accent);
            AddFrame(badgeImage.transform, "Info Activity Row Badge Frame", 0.6f, new Color(0.16f, 0.080f, 0.035f, 0.42f));
            AddText("Info Activity Row Badge Text", badgeImage.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, badge, 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.88f, 0.58f, 0.98f);
            AddText("Info Activity Row Title", card.transform, Vector2.zero, Vector2.one, new Vector2(60f, 24f), new Vector2(-160f, -6f), Ellipsize(title, 24), 13, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Info Activity Row Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(390f, 24f), new Vector2(-14f, -7f), Ellipsize(meta, 18), 11, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.36f, 0.20f, 0.090f, 0.84f);
            AddText("Info Activity Row Body", card.transform, Vector2.zero, Vector2.one, new Vector2(60f, 6f), new Vector2(-14f, -24f), Ellipsize(body, 54), 11, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.17f, 0.095f, 0.045f, 0.88f);
        }


        private void RenderInfoQueueCards(Transform parent)
        {
            var details = vm?.storytellerQueueDetails ?? Array.Empty<StorytellerQueueItemViewModel>();
            var queue = (vm?.storytellerQueue ?? Array.Empty<string>())
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Select((entry) => entry.Trim())
                .ToArray();
            var count = InfoDrawerQueueCount();
            var header = AddPanel("Info Queue Header", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 100f), new Vector2(566f, 144f), new Color(0.13f, 0.070f, 0.032f, 0.78f));
            AddFrame(header.transform, "Info Queue Header Frame", 0.7f, new Color(0.94f, 0.64f, 0.28f, 0.28f));
            AddImage("Info Queue Header Accent", header.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.28f, 0.040f, 0.040f, 0.84f));
            AddText("Info Queue Header Title", header.transform, Vector2.zero, Vector2.one, new Vector2(18f, 21f), new Vector2(-260f, -5f), "说书人队列", 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("Info Queue Header Count", header.transform, Vector2.zero, Vector2.one, new Vector2(320f, 21f), new Vector2(-16f, -6f), count == 0 ? "暂无待处理" : $"{count} 项待处理", 13, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(1f, 0.92f, 0.74f, 0.94f);
            AddText("Info Queue Header Meta", header.transform, Vector2.zero, Vector2.one, new Vector2(18f, 6f), new Vector2(-16f, -25f), Ellipsize(FirstNonEmpty(vm?.phaseObjectiveTitle, PhaseLabel()), 36), 10, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.88f, 0.68f, 0.70f);

            if (count == 0)
            {
                AddInfoQueueRow(parent, 18f, "空", "暂无待处理行动", "阶段流转正常", FirstNonEmpty(vm?.phaseObjectiveHint, "等待下一步。"), new Color(0.080f, 0.11f, 0.085f, 0.88f), 70f);
                return;
            }

            if (details.Length > 0)
            {
                var rows = details.Take(2).ToArray();
                for (var i = 0; i < rows.Length; i++)
                {
                    var item = rows[i];
                    var title = FirstNonEmpty(item.roleName, item.type, "待处理行动");
                    var meta = item.current ? "当前" : FirstNonEmpty(item.phaseLabel, item.createdPhase, "待处理");
                    var body = FirstNonEmpty(item.prompt, $"{item.inputType} · 目标 {item.targetCount}");
                    AddInfoQueueRow(parent, 52f - i * 44f, i == 0 ? "今" : "后", title, meta, body, new Color(0.25f, 0.10f, 0.040f, 0.88f), 38f);
                }
                return;
            }

            for (var i = 0; i < queue.Length && i < 2; i++)
            {
                AddInfoQueueRow(parent, 52f - i * 44f, i == 0 ? "今" : "后", $"队列 {i + 1}", i == 0 ? "当前" : "待处理", queue[i], new Color(0.25f, 0.10f, 0.040f, 0.88f), 38f);
            }
        }


        private void AddInfoQueueRow(Transform parent, float y, string badge, string title, string meta, string body, Color accent, float height)
        {
            var card = AddPanel($"Info Queue Row {title}", parent, Vector2.zero, Vector2.zero, new Vector2(0f, y), new Vector2(566f, y + height), new Color(0.92f, 0.80f, 0.54f, 0.50f));
            AddFrame(card.transform, "Info Queue Row Frame", 0.65f, new Color(0.26f, 0.13f, 0.055f, 0.24f));
            AddImage("Info Queue Row Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), accent);
            var badgeImage = AddImage("Info Queue Badge", card.transform, Vector2.zero, Vector2.zero, new Vector2(16f, Mathf.Max(7f, height - 32f)), new Vector2(48f, height - 8f), accent);
            AddFrame(badgeImage.transform, "Info Queue Badge Frame", 0.6f, new Color(0.16f, 0.080f, 0.035f, 0.42f));
            AddText("Info Queue Badge Text", badgeImage.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, badge, 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.88f, 0.58f, 0.98f);
            AddText("Info Queue Row Title", card.transform, Vector2.zero, Vector2.one, new Vector2(60f, height - 23f), new Vector2(-184f, -5f), Ellipsize(title, 22), 13, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Info Queue Row Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(392f, height - 23f), new Vector2(-14f, -6f), Ellipsize(meta, 18), 11, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.36f, 0.20f, 0.090f, 0.82f);
            AddText("Info Queue Row Body", card.transform, Vector2.zero, Vector2.one, new Vector2(60f, 7f), new Vector2(-14f, -(height - 23f)), Ellipsize(body, 52), 11, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.17f, 0.095f, 0.045f, 0.86f);
        }


        private int InfoDrawerQueueCount()
        {
            var detailCount = vm?.storytellerQueueDetails?.Length ?? 0;
            if (detailCount > 0) return detailCount;
            return (vm?.storytellerQueue ?? Array.Empty<string>()).Count((entry) => !string.IsNullOrWhiteSpace(entry));
        }


        private static string BuildEventLedgerSummary(string[] events)
        {
            var cleanEvents = (events ?? Array.Empty<string>())
                .Select(PlayerFacingEventLine)
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .ToArray();
            if (cleanEvents.Length == 0) return "等待事件";
            var shown = Mathf.Min(4, cleanEvents.Length);
            return $"最近 {shown} / 全部 {cleanEvents.Length} · 完整日志折叠";
        }


        private static string BuildTimelineModeSummary(TimelineEntryViewModel[] timeline)
        {
            var entries = timeline ?? Array.Empty<TimelineEntryViewModel>();
            if (entries.Length == 0) return "暂无对话";
            var publicCount = entries.Count((entry) => string.Equals(entry?.mode, "public", StringComparison.OrdinalIgnoreCase));
            var privateCount = entries.Count((entry) =>
            {
                var mode = entry?.mode ?? "";
                return mode.IndexOf("whisper", StringComparison.OrdinalIgnoreCase) >= 0 || string.Equals(mode, "private", StringComparison.OrdinalIgnoreCase);
            });
            return $"公聊 {publicCount} / 私聊 {privateCount}";
        }


        private static string InfoTimelineBadge(string mode)
        {
            if (string.Equals(mode, "public", StringComparison.OrdinalIgnoreCase)) return "公";
            if (!string.IsNullOrWhiteSpace(mode) && mode.IndexOf("whisper", StringComparison.OrdinalIgnoreCase) >= 0) return "私";
            if (string.Equals(mode, "private", StringComparison.OrdinalIgnoreCase)) return "私";
            if (string.Equals(mode, "nomination", StringComparison.OrdinalIgnoreCase)) return "提";
            if (string.Equals(mode, "vote", StringComparison.OrdinalIgnoreCase)) return "票";
            return "时";
        }


        private static Color InfoTimelineAccent(string mode)
        {
            if (string.Equals(mode, "public", StringComparison.OrdinalIgnoreCase)) return new Color(0.090f, 0.18f, 0.12f, 0.90f);
            if (!string.IsNullOrWhiteSpace(mode) && mode.IndexOf("whisper", StringComparison.OrdinalIgnoreCase) >= 0) return new Color(0.055f, 0.11f, 0.18f, 0.90f);
            if (string.Equals(mode, "private", StringComparison.OrdinalIgnoreCase)) return new Color(0.055f, 0.11f, 0.18f, 0.90f);
            if (string.Equals(mode, "nomination", StringComparison.OrdinalIgnoreCase) || string.Equals(mode, "vote", StringComparison.OrdinalIgnoreCase)) return new Color(0.28f, 0.040f, 0.045f, 0.90f);
            return new Color(0.20f, 0.075f, 0.040f, 0.90f);
        }


        private string InfoTimelineMeta(TimelineEntryViewModel entry)
        {
            if (entry == null) return $"D{vm.day}/N{vm.night}";
            if (entry.day > 0 || entry.night > 0) return $"D{entry.day}/N{entry.night}";
            return $"D{vm.day}/N{vm.night}";
        }


        private void RenderNotebookInformationCards(Transform parent)
        {
            var ownInfo = (vm?.privateInfo ?? Array.Empty<string>())
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Select((entry) => entry.Trim())
                .TakeLast(4)
                .ToArray();
            var claims = BuildNotebookClaimLines().Take(8).ToArray();
            var reports = BuildNotebookReportLines().TakeLast(6).ToArray();

            AddNotebookInfoCard(
                parent,
                "己",
                "自己的确认信息",
                ownInfo.Length == 0 ? new[] { "暂无自己的夜间/私有确认信息。" } : ownInfo,
                new Vector2(0f, 330f),
                new Vector2(584f, 430f),
                ownInfo.Length,
                new Color(0.030f, 0.11f, 0.085f, 0.90f)
            );
            AddNotebookInfoCard(
                parent,
                "身",
                "身份声称",
                claims.Length == 0 ? new[] { "暂无 AI 身份声称。" } : claims,
                new Vector2(0f, 178f),
                new Vector2(584f, 314f),
                claims.Length,
                new Color(0.13f, 0.075f, 0.030f, 0.90f)
            );
            AddNotebookInfoCard(
                parent,
                "报",
                "报信记录",
                reports.Length == 0 ? new[] { "暂无公开或私聊报信。" } : reports,
                new Vector2(0f, 26f),
                new Vector2(584f, 162f),
                reports.Length,
                new Color(0.080f, 0.085f, 0.13f, 0.88f)
            );
        }


        private void AddNotebookInfoCard(Transform parent, string icon, string title, IEnumerable<string> entries, Vector2 offsetMin, Vector2 offsetMax, int count, Color accent)
        {
            var card = AddPanel($"Notebook Info Card {title}", parent, Vector2.zero, Vector2.zero, offsetMin, offsetMax, new Color(0.92f, 0.82f, 0.58f, 0.58f));
            AddFrame(card.transform, "Notebook Info Card Frame", 0.8f, new Color(0.26f, 0.13f, 0.055f, 0.32f));
            AddImage("Notebook Info Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(5f, 0f), accent);
            var badge = AddImage("Notebook Info Badge", card.transform, Vector2.zero, Vector2.zero, new Vector2(16f, offsetMax.y - offsetMin.y - 46f), new Vector2(50f, offsetMax.y - offsetMin.y - 12f), accent);
            AddFrame(badge.transform, "Notebook Info Badge Frame", 0.7f, new Color(0.16f, 0.080f, 0.035f, 0.54f));
            AddText("Notebook Info Badge Text", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, 15, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.88f, 0.56f, 0.98f);
            AddText("Notebook Info Title", card.transform, Vector2.zero, Vector2.one, new Vector2(62f, offsetMax.y - offsetMin.y - 42f), new Vector2(-92f, -10f), title, 17, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Notebook Info Count", card.transform, Vector2.zero, Vector2.one, new Vector2(488f, offsetMax.y - offsetMin.y - 38f), new Vector2(-18f, -14f), count == 0 ? "空" : $"{count}条", 12, TextAnchor.UpperRight, FontStyle.Bold).color = count == 0 ? new Color(0.40f, 0.24f, 0.12f, 0.70f) : new Color(0.32f, 0.14f, 0.055f, 0.92f);

            var lineList = entries?.Where((entry) => !string.IsNullOrWhiteSpace(entry)).ToArray() ?? Array.Empty<string>();
            var body = lineList.Length == 0 ? "暂无记录。" : string.Join("\n", lineList.Select((entry) => $"· {Ellipsize(entry, 42)}"));
            var bodyText = AddText("Notebook Info Body", card.transform, Vector2.zero, Vector2.one, new Vector2(18f, 12f), new Vector2(-18f, -(offsetMax.y - offsetMin.y - 58f)), body, 13, TextAnchor.UpperLeft, FontStyle.Normal);
            bodyText.color = count == 0 ? new Color(0.32f, 0.18f, 0.085f, 0.72f) : new Color(0.14f, 0.075f, 0.035f, 0.92f);
        }

        private sealed class WhisperNotebookCard
        {
            public string playerId;
            public string playerLabel;
            public string badge;
            public TimelineEntryViewModel[] entries;
            public ProactiveWhisperViewModel pendingOffer;
        }


        private enum WhisperNotebookLens
        {
            IdentityClaims = 0,
            NightInformation = 1,
            RecentStatements = 2,
            ItemsToVerify = 3,
        }


        private int activeWhisperNotebookPlayerIndex;
        private int activeWhisperNotebookLensIndex = (int)WhisperNotebookLens.RecentStatements;
        private int activeWhisperNotebookRecordIndex;
        private int activeWhisperNotebookTextPageIndex;
        private int activePublicSpeechDayIndex;
        private int activePublicSpeechFocusIndex;
        private int activePublicSpeechRecordIndex;
        private int activePublicSpeechTextPageIndex;


        private void RenderWhisperInformationCards(Transform parent)
        {
            var cards = BuildWhisperNotebookCards();
            AddWhisperNotebookSummaryStrip(parent, cards);

            if (cards.Length == 0)
            {
                AddWhisperNotebookEmptyCard(parent, WhisperNotebookEmptyGuidance(null, WhisperNotebookLens.RecentStatements));
                return;
            }

            var entries = NormalizeWhisperNotebookState(cards);
            var selected = cards[activeWhisperNotebookPlayerIndex];
            var lens = (WhisperNotebookLens)activeWhisperNotebookLensIndex;
            AddWhisperNotebookPlayerSelector(parent, cards, selected);
            AddWhisperNotebookLensSelector(parent, selected, lens, entries);
            if ((selected.entries?.Length ?? 0) == 0 && selected.pendingOffer != null)
            {
                AddWhisperNotebookPendingDetail(parent, selected.pendingOffer);
                return;
            }
            if (entries.Length == 0)
            {
                AddWhisperNotebookEmptyCard(parent, WhisperNotebookEmptyGuidance(selected, lens));
                return;
            }
            AddWhisperNotebookDetail(parent, selected, lens, entries[activeWhisperNotebookRecordIndex], activeWhisperNotebookRecordIndex, entries.Length);
        }


        private WhisperNotebookCard[] BuildWhisperNotebookCards()
        {
            var players = vm.players ?? Array.Empty<PlayerViewModel>();
            var humanId = players.FirstOrDefault((player) => player != null && player.human)?.id ?? "";
            var cards = new List<WhisperNotebookCard>();
            var groups = new Dictionary<string, List<TimelineEntryViewModel>>();
            foreach (var item in vm?.timeline ?? Array.Empty<TimelineEntryViewModel>())
            {
                if (item == null || !IsPrivateTimelineEntry(item.mode) || !WhisperNotebookEntryHasVisibleContent(item)) continue;
                var otherId = WhisperNotebookCounterpartId(item, humanId);
                if (string.IsNullOrWhiteSpace(otherId)) continue;
                if (!groups.TryGetValue(otherId, out var list))
                {
                    list = new List<TimelineEntryViewModel>();
                    groups[otherId] = list;
                }
                list.Add(item);
            }

            var pendingByPlayer = (vm?.pendingProactiveWhispers ?? Array.Empty<ProactiveWhisperViewModel>())
                .Where((offer) => offer != null && !string.IsNullOrWhiteSpace(offer.playerId))
                .GroupBy((offer) => offer.playerId)
                .ToDictionary((group) => group.Key, (group) => group.First());

            foreach (var player in players.Where((player) => player != null && !player.human).OrderBy((player) => player.seat))
            {
                groups.TryGetValue(player.id ?? "", out var playerEntries);
                pendingByPlayer.TryGetValue(player.id ?? "", out var offer);
                cards.Add(new WhisperNotebookCard
                {
                    playerId = player.id,
                    playerLabel = NotebookSeatLabel(player),
                    badge = player.seat > 0 ? player.seat.ToString() : "私",
                    entries = playerEntries?.ToArray() ?? Array.Empty<TimelineEntryViewModel>(),
                    pendingOffer = offer,
                });
                groups.Remove(player.id ?? "");
                pendingByPlayer.Remove(player.id ?? "");
            }

            foreach (var group in groups.OrderBy((entry) => PlayerById(entry.Key)?.seat ?? 99))
            {
                pendingByPlayer.TryGetValue(group.Key, out var offer);
                var player = PlayerById(group.Key);
                cards.Add(new WhisperNotebookCard
                {
                    playerId = group.Key,
                    playerLabel = player == null ? "未知玩家" : NotebookSeatLabel(player),
                    badge = "私",
                    entries = group.Value.ToArray(),
                    pendingOffer = offer,
                });
                pendingByPlayer.Remove(group.Key);
            }

            foreach (var offer in pendingByPlayer.Values.OrderBy((entry) => entry.playerSeat))
            {
                cards.Add(new WhisperNotebookCard
                {
                    playerId = offer.playerId,
                    playerLabel = offer.playerSeat > 0 ? $"{offer.playerSeat}号" : FirstNonEmpty(offer.playerName, "私聊邀请"),
                    badge = offer.playerSeat > 0 ? offer.playerSeat.ToString() : "新",
                    entries = Array.Empty<TimelineEntryViewModel>(),
                    pendingOffer = offer,
                });
            }

            return cards.ToArray();
        }


        private static bool WhisperNotebookEntryHasVisibleContent(TimelineEntryViewModel entry)
        {
            return entry != null && (
                !string.IsNullOrWhiteSpace(entry.text) ||
                !string.IsNullOrWhiteSpace(entry.questionToAsk) ||
                (entry.followUpPrompts?.Any((prompt) => !string.IsNullOrWhiteSpace(prompt)) ?? false));
        }


        private string WhisperNotebookCounterpartId(TimelineEntryViewModel entry, string humanId)
        {
            if (entry == null) return "";
            if (!string.IsNullOrWhiteSpace(humanId) && entry.speakerId == humanId) return entry.targetId ?? "";
            if (!string.IsNullOrWhiteSpace(humanId) && entry.targetId == humanId) return entry.speakerId ?? "";
            var speaker = PlayerById(entry.speakerId);
            if (speaker != null && !speaker.human) return entry.speakerId ?? "";
            var target = PlayerById(entry.targetId);
            return target != null && !target.human ? entry.targetId ?? "" : FirstNonEmpty(entry.speakerId, entry.targetId);
        }


        private TimelineEntryViewModel[] BuildWhisperNotebookLensEntries(WhisperNotebookCard card, WhisperNotebookLens lens)
        {
            var entries = card?.entries ?? Array.Empty<TimelineEntryViewModel>();
            if (lens == WhisperNotebookLens.RecentStatements) return entries;
            if (lens == WhisperNotebookLens.IdentityClaims) return entries.Where(NotebookLooksLikeClaimEntry).ToArray();
            if (lens == WhisperNotebookLens.NightInformation) return entries.Where(NotebookLooksLikeReportEntry).ToArray();
            if (lens == WhisperNotebookLens.ItemsToVerify)
            {
                return entries.Where((entry) => entry != null && (
                    !string.IsNullOrWhiteSpace(entry.questionToAsk) ||
                    (entry.followUpPrompts?.Any((prompt) => !string.IsNullOrWhiteSpace(prompt)) ?? false) ||
                    NotebookLooksLikeClaimEntry(entry) ||
                    NotebookLooksLikeReportEntry(entry))).ToArray();
            }
            return entries;
        }


        private string WhisperNotebookLensTitle(WhisperNotebookLens lens)
        {
            if (lens == WhisperNotebookLens.IdentityClaims) return "身份声称";
            if (lens == WhisperNotebookLens.NightInformation) return "夜间信息";
            if (lens == WhisperNotebookLens.ItemsToVerify) return "待验证";
            return "近期发言";
        }


        private TimelineEntryViewModel[] NormalizeWhisperNotebookState(WhisperNotebookCard[] cards)
        {
            var count = cards?.Length ?? 0;
            activeWhisperNotebookPlayerIndex = count == 0 ? 0 : Mathf.Clamp(activeWhisperNotebookPlayerIndex, 0, count - 1);
            activeWhisperNotebookLensIndex = Mathf.Clamp(activeWhisperNotebookLensIndex, 0, 3);
            if (count == 0)
            {
                activeWhisperNotebookRecordIndex = 0;
                activeWhisperNotebookTextPageIndex = 0;
                return Array.Empty<TimelineEntryViewModel>();
            }
            var entries = BuildWhisperNotebookLensEntries(cards[activeWhisperNotebookPlayerIndex], (WhisperNotebookLens)activeWhisperNotebookLensIndex);
            activeWhisperNotebookRecordIndex = entries.Length == 0 ? 0 : Mathf.Clamp(activeWhisperNotebookRecordIndex, 0, entries.Length - 1);
            var pages = entries.Length == 0
                ? Array.Empty<string>()
                : NotebookTextPages(WhisperNotebookDetailText(entries[activeWhisperNotebookRecordIndex], (WhisperNotebookLens)activeWhisperNotebookLensIndex));
            activeWhisperNotebookTextPageIndex = pages.Length == 0 ? 0 : Mathf.Clamp(activeWhisperNotebookTextPageIndex, 0, pages.Length - 1);
            return entries;
        }


        private void CycleWhisperNotebookPlayer(int delta)
        {
            var cards = BuildWhisperNotebookCards();
            if (cards.Length <= 1) return;
            activeWhisperNotebookPlayerIndex = WrapIndex(activeWhisperNotebookPlayerIndex + delta, cards.Length);
            activeWhisperNotebookRecordIndex = 0;
            activeWhisperNotebookTextPageIndex = 0;
            ShowInfoDrawer("whispers");
        }


        private void SelectWhisperNotebookLens(int index)
        {
            activeWhisperNotebookLensIndex = Mathf.Clamp(index, 0, 3);
            activeWhisperNotebookRecordIndex = 0;
            activeWhisperNotebookTextPageIndex = 0;
            ShowInfoDrawer("whispers");
        }


        private void CycleWhisperNotebookRecord(int delta)
        {
            var cards = BuildWhisperNotebookCards();
            var entries = NormalizeWhisperNotebookState(cards);
            if (cards.Length == 0) return;
            if (entries.Length == 0) return;
            var lens = (WhisperNotebookLens)activeWhisperNotebookLensIndex;
            var pages = NotebookTextPages(WhisperNotebookDetailText(entries[activeWhisperNotebookRecordIndex], lens));
            if (delta > 0 && activeWhisperNotebookTextPageIndex < pages.Length - 1)
            {
                activeWhisperNotebookTextPageIndex += 1;
            }
            else if (delta < 0 && activeWhisperNotebookTextPageIndex > 0)
            {
                activeWhisperNotebookTextPageIndex -= 1;
            }
            else if (entries.Length > 1)
            {
                activeWhisperNotebookRecordIndex = WrapIndex(activeWhisperNotebookRecordIndex + delta, entries.Length);
                var nextPages = NotebookTextPages(WhisperNotebookDetailText(entries[activeWhisperNotebookRecordIndex], lens));
                activeWhisperNotebookTextPageIndex = delta < 0 ? Mathf.Max(0, nextPages.Length - 1) : 0;
            }
            ShowInfoDrawer("whispers");
        }


        private void AddWhisperNotebookSummaryStrip(Transform parent, WhisperNotebookCard[] cards)
        {
            var pending = vm.pendingProactiveWhispers?.Length ?? 0;
            var totalLines = (vm.timeline ?? Array.Empty<TimelineEntryViewModel>()).Count((entry) => entry != null && IsPrivateTimelineEntry(entry.mode));
            var strip = AddPanel("Whisper Notebook Summary", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 358f), new Vector2(584f, 430f), new Color(0.15f, 0.080f, 0.036f, 0.76f));
            AddFrame(strip.transform, "Whisper Notebook Summary Frame", 0.75f, new Color(0.95f, 0.66f, 0.30f, 0.30f));
            AddImage("Whisper Notebook Summary Accent", strip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.055f, 0.11f, 0.18f, 0.86f));
            AddText("Whisper Notebook Summary Title", strip.transform, Vector2.zero, Vector2.one, new Vector2(18f, 42f), new Vector2(-220f, -8f), "私聊情报簿", 17, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("Whisper Notebook Summary Meta", strip.transform, Vector2.zero, Vector2.one, new Vector2(18f, 18f), new Vector2(-220f, -32f), $"玩家 {cards.Length} · 当前资料 {totalLines}条 · 邀请 {pending}", 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.92f, 0.78f, 0.84f);
            AddText("Whisper Notebook Summary Rule", strip.transform, Vector2.zero, Vector2.one, new Vector2(302f, 42f), new Vector2(-18f, -8f), "私聊记录 · 仅你可见", 12, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.90f);
            AddText("Whisper Notebook Summary Hint", strip.transform, Vector2.zero, Vector2.one, new Vector2(250f, 16f), new Vector2(-18f, -32f), "前后切换可查看全部当前资料", 12, TextAnchor.UpperRight, FontStyle.Normal).color = new Color(0.98f, 0.92f, 0.78f, 0.76f);
        }


        private void AddWhisperNotebookPlayerSelector(Transform parent, WhisperNotebookCard[] cards, WhisperNotebookCard selected)
        {
            var panel = AddPanel("Whisper Notebook Player Selector", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 314f), new Vector2(584f, 354f), new Color(0.92f, 0.82f, 0.58f, 0.48f));
            AddFrame(panel.transform, "Whisper Notebook Player Selector Frame", 0.65f, new Color(0.26f, 0.13f, 0.055f, 0.26f));
            var previous = AddButton("‹", panel.transform, new Vector2(24f, 20f), new Vector2(40f, 28f), () => CycleWhisperNotebookPlayer(-1));
            var next = AddButton("›", panel.transform, new Vector2(560f, 20f), new Vector2(40f, 28f), () => CycleWhisperNotebookPlayer(1));
            SetToolButtonEnabled(previous, cards.Length > 1);
            SetToolButtonEnabled(next, cards.Length > 1);
            AddText("Whisper Notebook Selected Player", panel.transform, Vector2.zero, Vector2.one, new Vector2(72f, 4f), new Vector2(-72f, -4f), $"{FirstNonEmpty(selected?.badge, "私")} · {FirstNonEmpty(selected?.playerLabel, "未知玩家")}   玩家 {activeWhisperNotebookPlayerIndex + 1} / {cards.Length}", 15, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
        }


        private void AddWhisperNotebookLensSelector(Transform parent, WhisperNotebookCard selected, WhisperNotebookLens lens, TimelineEntryViewModel[] selectedEntries)
        {
            for (var index = 0; index < 4; index++)
            {
                var selectedIndex = index;
                var itemLens = (WhisperNotebookLens)index;
                var title = WhisperNotebookLensTitle(itemLens);
                var count = itemLens == lens ? (selectedEntries?.Length ?? 0) : BuildWhisperNotebookLensEntries(selected, itemLens).Length;
                var button = AddButton($"{title} {count}", parent, new Vector2(68f + index * 148f, 286f), new Vector2(136f, 30f), () => SelectWhisperNotebookLens(selectedIndex));
                var label = button.GetComponentInChildren<Text>();
                if (label != null && index == (int)lens)
                {
                    label.text = $"● {title} {count}";
                    label.color = new Color(1f, 0.82f, 0.42f, 1f);
                }
            }
        }


        private void AddWhisperNotebookDetail(Transform parent, WhisperNotebookCard card, WhisperNotebookLens lens, TimelineEntryViewModel entry, int index, int count)
        {
            var panel = AddPanel("Whisper Notebook Detail", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 40f), new Vector2(584f, 262f), new Color(0.92f, 0.82f, 0.58f, 0.58f));
            AddFrame(panel.transform, "Whisper Notebook Detail Frame", 0.78f, new Color(0.26f, 0.13f, 0.055f, 0.32f));
            AddImage("Whisper Notebook Detail Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.055f, 0.11f, 0.18f, 0.90f));
            var stamp = entry.day > 0 ? $"D{entry.day}" : entry.night > 0 ? $"N{entry.night}" : "本局";
            var speaker = FirstNonEmpty(NameForPlayerId(entry.speakerId), "发言者");
            var pages = NotebookTextPages(WhisperNotebookDetailText(entry, lens));
            activeWhisperNotebookTextPageIndex = Mathf.Clamp(activeWhisperNotebookTextPageIndex, 0, pages.Length - 1);
            AddText("Whisper Notebook Detail Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 190f), new Vector2(-210f, -10f), $"{WhisperNotebookLensTitle(lens)} · {stamp} · {speaker}", 15, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Whisper Notebook Detail Count", panel.transform, Vector2.zero, Vector2.one, new Vector2(340f, 190f), new Vector2(-18f, -10f), $"记录 {index + 1}/{count} · 原文 {activeWhisperNotebookTextPageIndex + 1}/{pages.Length}", 12, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.32f, 0.14f, 0.055f, 0.90f);
            AddText("Whisper Notebook Visibility", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 170f), new Vector2(-18f, -32f), "私聊原话 · 仅你可见", 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.22f, 0.12f, 0.055f, 0.78f);
            var body = AddText("Whisper Notebook Full Source", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 46f), new Vector2(-18f, -58f), pages[activeWhisperNotebookTextPageIndex], 14, TextAnchor.UpperLeft, FontStyle.Normal);
            body.horizontalOverflow = HorizontalWrapMode.Wrap;
            body.verticalOverflow = VerticalWrapMode.Truncate;
            body.resizeTextForBestFit = true;
            body.resizeTextMinSize = 9;
            body.resizeTextMaxSize = 14;
            body.color = new Color(0.14f, 0.075f, 0.035f, 0.94f);
            AddText("Whisper Notebook Next Question", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 12f), new Vector2(-18f, -178f), lens == WhisperNotebookLens.ItemsToVerify ? "全部待验证问题随原文分页显示。" : "查看原话后再决定是否追问。", 11, TextAnchor.LowerLeft, FontStyle.Bold).color = new Color(0.26f, 0.13f, 0.055f, 0.84f);
            AddNotebookRecordControls(parent, "Whisper", index, count, activeWhisperNotebookTextPageIndex, pages.Length, () => CycleWhisperNotebookRecord(-1), () => CycleWhisperNotebookRecord(1));
        }


        private string WhisperNotebookDetailText(TimelineEntryViewModel entry, WhisperNotebookLens lens)
        {
            var source = PlayerFacingClueLine(FirstNonEmpty(entry?.text, "该条记录没有可读原话。"));
            if (lens != WhisperNotebookLens.ItemsToVerify || entry == null) return source;
            var questions = new[] { entry.questionToAsk }
                .Concat(entry.followUpPrompts ?? Array.Empty<string>())
                .Where((prompt) => !string.IsNullOrWhiteSpace(prompt))
                .Select(PlayerFacingClueLine)
                .Distinct()
                .ToArray();
            if (questions.Length == 0) return source;
            return $"{source}\n\n待验证：\n{string.Join("\n", questions.Select((prompt) => $"· {prompt}"))}";
        }


        private void AddWhisperNotebookPendingDetail(Transform parent, ProactiveWhisperViewModel offer)
        {
            var panel = AddPanel("Whisper Notebook Pending Detail", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 40f), new Vector2(584f, 262f), new Color(0.92f, 0.82f, 0.58f, 0.58f));
            AddFrame(panel.transform, "Whisper Notebook Pending Detail Frame", 0.78f, new Color(0.26f, 0.13f, 0.055f, 0.32f));
            AddText("Whisper Notebook Pending Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 188f), new Vector2(-18f, -12f), offer?.isNew == true ? "新私聊邀请" : "待处理私聊邀请", 16, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Whisper Notebook Pending Intent", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 128f), new Vector2(-18f, -48f), $"对方想：{PlayerFacingClueLine(FirstNonEmpty(offer?.publicIntent, "交换信息"))}\n{PlayerFacingClueLine(FirstNonEmpty(offer?.publicReason, "接受前不会显示具体内容。"))}", 14, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.14f, 0.075f, 0.035f, 0.92f);
            AddText("Whisper Notebook Pending Rule", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 22f), new Vector2(-18f, -176f), "接受后才会出现具体私聊内容。", 12, TextAnchor.LowerLeft, FontStyle.Bold).color = new Color(0.26f, 0.13f, 0.055f, 0.86f);
        }


        private string WhisperNotebookEmptyGuidance(WhisperNotebookCard card, WhisperNotebookLens lens)
        {
            var player = FirstNonEmpty(card?.playerLabel, "这位玩家");
            if (card == null) return $"下一步：从玩家头像发起私聊，或接受一条私聊邀请。";
            if ((card.entries?.Length ?? 0) == 0) return $"{player} 暂无私聊记录。下一步：从该玩家头像发起私聊。";
            if (lens == WhisperNotebookLens.IdentityClaims) return $"{player} 尚无身份声称。下一步：询问其身份范围。";
            if (lens == WhisperNotebookLens.NightInformation) return $"{player} 尚无可归入夜间信息的原话。下一步：查看近期发言。";
            if (lens == WhisperNotebookLens.ItemsToVerify) return $"{player} 暂无待验证项。下一步：对照近期发言。";
            return $"{player} 暂无匹配记录。下一步：继续本局后再查看。";
        }


        private void AddWhisperNotebookEmptyCard(Transform parent, string guidance)
        {
            var card = AddPanel("Whisper Notebook Empty", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 40f), new Vector2(584f, 262f), new Color(0.92f, 0.82f, 0.58f, 0.52f));
            AddFrame(card.transform, "Whisper Notebook Empty Frame", 0.75f, new Color(0.26f, 0.13f, 0.055f, 0.28f));
            AddImage("Whisper Notebook Empty Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.080f, 0.085f, 0.13f, 0.78f));
            AddText("Whisper Notebook Empty Title", card.transform, Vector2.zero, Vector2.one, new Vector2(20f, 176f), new Vector2(-20f, -14f), "这里还没有匹配记录", 17, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Whisper Notebook Empty Body", card.transform, Vector2.zero, Vector2.one, new Vector2(20f, 42f), new Vector2(-20f, -56f), PlayerFacingClueLine(guidance), 14, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.14f, 0.075f, 0.035f, 0.88f);
        }


        private void RenderPublicSpeechCards(Transform parent)
        {
            var entries = BuildPublicSpeechEntries();
            var dayKeys = BuildPublicSpeechDayKeys(entries);
            var focusKeys = BuildPublicSpeechFocusKeys(entries);
            var filtered = NormalizePublicSpeechNotebookState(entries, dayKeys, focusKeys);
            AddPublicSpeechSummaryStrip(parent, entries.Length, filtered.Length);
            AddPublicSpeechDaySelector(parent, dayKeys);
            AddPublicSpeechFocusSelector(parent, focusKeys);
            if (filtered.Length == 0)
            {
                AddPublicSpeechEmptyCard(parent, PublicSpeechEmptyGuidance(entries.Length));
                return;
            }
            AddPublicSpeechDetail(parent, filtered[activePublicSpeechRecordIndex], activePublicSpeechRecordIndex, filtered.Length);
        }


        private TimelineEntryViewModel[] BuildPublicSpeechEntries()
        {
            return (vm?.timeline ?? Array.Empty<TimelineEntryViewModel>())
                .Where((entry) => entry != null && IsPublicTimelineEntry(entry.mode) && !string.IsNullOrWhiteSpace(entry.text))
                .ToArray();
        }


        private string PublicSpeechDayKey(TimelineEntryViewModel entry)
        {
            if (entry == null) return $"D{Mathf.Max(1, vm?.day ?? 1)}";
            if (entry.day > 0) return $"D{entry.day}";
            if (entry.night > 0) return $"N{entry.night}";
            return $"D{Mathf.Max(1, vm?.day ?? 1)}";
        }


        private string PublicSpeechFocusKey(TimelineEntryViewModel entry)
        {
            if (entry == null) return "table";
            if (!string.IsNullOrWhiteSpace(entry.focusId))
            {
                var focus = PlayerById(entry.focusId);
                if (focus != null) return focus.id;
            }
            var target = PlayerById(entry.targetId);
            if (target != null) return target.id;
            return "table";
        }


        private string[] BuildPublicSpeechDayKeys(TimelineEntryViewModel[] entries)
        {
            return new[] { "all" }.Concat((entries ?? Array.Empty<TimelineEntryViewModel>()).Select(PublicSpeechDayKey).Distinct()).ToArray();
        }


        private string[] BuildPublicSpeechFocusKeys(TimelineEntryViewModel[] entries)
        {
            return new[] { "all" }.Concat((entries ?? Array.Empty<TimelineEntryViewModel>()).Select(PublicSpeechFocusKey).Distinct()).ToArray();
        }


        private TimelineEntryViewModel[] BuildFilteredPublicSpeechEntries(TimelineEntryViewModel[] entries, string[] dayKeys, string[] focusKeys)
        {
            var dayKey = dayKeys != null && dayKeys.Length > 0 ? dayKeys[Mathf.Clamp(activePublicSpeechDayIndex, 0, dayKeys.Length - 1)] : "all";
            var focusKey = focusKeys != null && focusKeys.Length > 0 ? focusKeys[Mathf.Clamp(activePublicSpeechFocusIndex, 0, focusKeys.Length - 1)] : "all";
            return (entries ?? Array.Empty<TimelineEntryViewModel>())
                .Where((entry) => dayKey == "all" || PublicSpeechDayKey(entry) == dayKey)
                .Where((entry) => focusKey == "all" || PublicSpeechFocusKey(entry) == focusKey)
                .ToArray();
        }


        private TimelineEntryViewModel[] NormalizePublicSpeechNotebookState(TimelineEntryViewModel[] entries, string[] dayKeys, string[] focusKeys)
        {
            activePublicSpeechDayIndex = dayKeys == null || dayKeys.Length == 0 ? 0 : Mathf.Clamp(activePublicSpeechDayIndex, 0, dayKeys.Length - 1);
            activePublicSpeechFocusIndex = focusKeys == null || focusKeys.Length == 0 ? 0 : Mathf.Clamp(activePublicSpeechFocusIndex, 0, focusKeys.Length - 1);
            var filtered = BuildFilteredPublicSpeechEntries(entries, dayKeys, focusKeys);
            activePublicSpeechRecordIndex = filtered.Length == 0 ? 0 : Mathf.Clamp(activePublicSpeechRecordIndex, 0, filtered.Length - 1);
            var pages = filtered.Length == 0
                ? Array.Empty<string>()
                : NotebookTextPages(PlayerFacingClueLine(FirstNonEmpty(filtered[activePublicSpeechRecordIndex]?.text, "暂无可读原话。")));
            activePublicSpeechTextPageIndex = pages.Length == 0 ? 0 : Mathf.Clamp(activePublicSpeechTextPageIndex, 0, pages.Length - 1);
            return filtered;
        }


        private void CyclePublicSpeechDay(int delta)
        {
            var keys = BuildPublicSpeechDayKeys(BuildPublicSpeechEntries());
            if (keys.Length <= 1) return;
            activePublicSpeechDayIndex = WrapIndex(activePublicSpeechDayIndex + delta, keys.Length);
            activePublicSpeechRecordIndex = 0;
            activePublicSpeechTextPageIndex = 0;
            ShowInfoDrawer("public");
        }


        private void CyclePublicSpeechFocus(int delta)
        {
            var keys = BuildPublicSpeechFocusKeys(BuildPublicSpeechEntries());
            if (keys.Length <= 1) return;
            activePublicSpeechFocusIndex = WrapIndex(activePublicSpeechFocusIndex + delta, keys.Length);
            activePublicSpeechRecordIndex = 0;
            activePublicSpeechTextPageIndex = 0;
            ShowInfoDrawer("public");
        }


        private void CyclePublicSpeechRecord(int delta)
        {
            var entries = BuildPublicSpeechEntries();
            var dayKeys = BuildPublicSpeechDayKeys(entries);
            var focusKeys = BuildPublicSpeechFocusKeys(entries);
            var filtered = NormalizePublicSpeechNotebookState(entries, dayKeys, focusKeys);
            if (filtered.Length == 0) return;
            var pages = NotebookTextPages(PlayerFacingClueLine(FirstNonEmpty(filtered[activePublicSpeechRecordIndex]?.text, "暂无可读原话。")));
            if (delta > 0 && activePublicSpeechTextPageIndex < pages.Length - 1)
            {
                activePublicSpeechTextPageIndex += 1;
            }
            else if (delta < 0 && activePublicSpeechTextPageIndex > 0)
            {
                activePublicSpeechTextPageIndex -= 1;
            }
            else if (filtered.Length > 1)
            {
                activePublicSpeechRecordIndex = WrapIndex(activePublicSpeechRecordIndex + delta, filtered.Length);
                var nextPages = NotebookTextPages(PlayerFacingClueLine(FirstNonEmpty(filtered[activePublicSpeechRecordIndex]?.text, "暂无可读原话。")));
                activePublicSpeechTextPageIndex = delta < 0 ? Mathf.Max(0, nextPages.Length - 1) : 0;
            }
            ShowInfoDrawer("public");
        }


        private string PublicSpeechFocusLabel(string key)
        {
            if (key == "all") return "全部对象";
            if (key == "table") return "全桌";
            var player = PlayerById(key);
            return player == null ? "全桌" : NotebookSeatLabel(player);
        }


        private void AddPublicSpeechSummaryStrip(Transform parent, int total, int filtered)
        {
            var strip = AddPanel("Public Speech Summary", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 358f), new Vector2(584f, 430f), new Color(0.15f, 0.080f, 0.036f, 0.74f));
            AddFrame(strip.transform, "Public Speech Summary Frame", 0.75f, new Color(0.95f, 0.66f, 0.30f, 0.28f));
            AddImage("Public Speech Summary Accent", strip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.090f, 0.18f, 0.12f, 0.86f));
            AddText("Public Speech Summary Title", strip.transform, Vector2.zero, Vector2.one, new Vector2(18f, 42f), new Vector2(-230f, -8f), "公开发言记录", 17, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("Public Speech Summary Meta", strip.transform, Vector2.zero, Vector2.one, new Vector2(18f, 18f), new Vector2(-230f, -32f), $"当前资料 {total}条 · 匹配 {filtered}条", 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.92f, 0.78f, 0.84f);
            AddText("Public Speech Summary Current", strip.transform, Vector2.zero, Vector2.one, new Vector2(274f, 42f), new Vector2(-18f, -8f), "原始发言 · 全桌可见", 12, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.90f);
            AddText("Public Speech Summary Hint", strip.transform, Vector2.zero, Vector2.one, new Vector2(250f, 16f), new Vector2(-18f, -32f), "按天数和关注对象定位原话", 12, TextAnchor.UpperRight, FontStyle.Normal).color = new Color(0.98f, 0.92f, 0.78f, 0.76f);
        }


        private void AddPublicSpeechDaySelector(Transform parent, string[] keys)
        {
            var key = keys != null && keys.Length > 0 ? keys[Mathf.Clamp(activePublicSpeechDayIndex, 0, keys.Length - 1)] : "all";
            var label = key == "all" ? "全部天数" : key;
            var panel = AddPanel("Public Speech Day Selector", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 314f), new Vector2(286f, 354f), new Color(0.92f, 0.82f, 0.58f, 0.48f));
            AddFrame(panel.transform, "Public Speech Day Selector Frame", 0.65f, new Color(0.26f, 0.13f, 0.055f, 0.26f));
            var previous = AddButton("‹", panel.transform, new Vector2(22f, 20f), new Vector2(36f, 28f), () => CyclePublicSpeechDay(-1));
            var next = AddButton("›", panel.transform, new Vector2(264f, 20f), new Vector2(36f, 28f), () => CyclePublicSpeechDay(1));
            SetToolButtonEnabled(previous, (keys?.Length ?? 0) > 1);
            SetToolButtonEnabled(next, (keys?.Length ?? 0) > 1);
            AddText("Public Speech Day Value", panel.transform, Vector2.zero, Vector2.one, new Vector2(48f, 3f), new Vector2(-48f, -3f), $"天数 {label} · {activePublicSpeechDayIndex + 1}/{Mathf.Max(1, keys?.Length ?? 0)}", 13, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
        }


        private void AddPublicSpeechFocusSelector(Transform parent, string[] keys)
        {
            var key = keys != null && keys.Length > 0 ? keys[Mathf.Clamp(activePublicSpeechFocusIndex, 0, keys.Length - 1)] : "all";
            var panel = AddPanel("Public Speech Focus Selector", parent, Vector2.zero, Vector2.zero, new Vector2(298f, 314f), new Vector2(584f, 354f), new Color(0.92f, 0.82f, 0.58f, 0.48f));
            AddFrame(panel.transform, "Public Speech Focus Selector Frame", 0.65f, new Color(0.26f, 0.13f, 0.055f, 0.26f));
            var previous = AddButton("‹", panel.transform, new Vector2(22f, 20f), new Vector2(36f, 28f), () => CyclePublicSpeechFocus(-1));
            var next = AddButton("›", panel.transform, new Vector2(264f, 20f), new Vector2(36f, 28f), () => CyclePublicSpeechFocus(1));
            SetToolButtonEnabled(previous, (keys?.Length ?? 0) > 1);
            SetToolButtonEnabled(next, (keys?.Length ?? 0) > 1);
            AddText("Public Speech Focus Value", panel.transform, Vector2.zero, Vector2.one, new Vector2(48f, 3f), new Vector2(-48f, -3f), $"关注 {PublicSpeechFocusLabel(key)} · {activePublicSpeechFocusIndex + 1}/{Mathf.Max(1, keys?.Length ?? 0)}", 13, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
        }


        private void AddPublicSpeechDetail(Transform parent, TimelineEntryViewModel entry, int index, int count)
        {
            var panel = AddPanel("Public Speech Detail", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 40f), new Vector2(584f, 302f), new Color(0.92f, 0.82f, 0.58f, 0.58f));
            AddFrame(panel.transform, "Public Speech Detail Frame", 0.78f, new Color(0.26f, 0.13f, 0.055f, 0.32f));
            AddImage("Public Speech Detail Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.090f, 0.18f, 0.12f, 0.90f));
            var stamp = PublicSpeechDayKey(entry);
            var speaker = FirstNonEmpty(NameForPlayerId(entry?.speakerId), "发言者");
            var focus = PublicSpeechFocusLabel(PublicSpeechFocusKey(entry));
            var pages = NotebookTextPages(PlayerFacingClueLine(FirstNonEmpty(entry?.text, "暂无可读原话。")));
            activePublicSpeechTextPageIndex = Mathf.Clamp(activePublicSpeechTextPageIndex, 0, pages.Length - 1);
            AddText("Public Speech Detail Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 230f), new Vector2(-210f, -10f), $"原始发言 · {stamp} · {speaker}", 15, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Public Speech Detail Count", panel.transform, Vector2.zero, Vector2.one, new Vector2(320f, 230f), new Vector2(-18f, -10f), $"匹配记录 {index + 1}/{count} · 原文 {activePublicSpeechTextPageIndex + 1}/{pages.Length}", 12, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.32f, 0.14f, 0.055f, 0.90f);
            AddText("Public Speech Detail Visibility", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 210f), new Vector2(-18f, -32f), $"全桌可见 · 关注 {focus}", 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.22f, 0.12f, 0.055f, 0.78f);
            var body = AddText("Public Speech Full Source", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 48f), new Vector2(-18f, -60f), pages[activePublicSpeechTextPageIndex], 14, TextAnchor.UpperLeft, FontStyle.Normal);
            body.horizontalOverflow = HorizontalWrapMode.Wrap;
            body.verticalOverflow = VerticalWrapMode.Truncate;
            body.resizeTextForBestFit = true;
            body.resizeTextMinSize = 9;
            body.resizeTextMaxSize = 14;
            body.color = new Color(0.14f, 0.075f, 0.035f, 0.94f);
            var next = FirstNonEmpty(vm?.publicConversation?.lastStep?.followUp, vm?.publicConversation?.lastStep?.question, vm?.phaseAdvance?.reason, vm?.phaseObjectiveHint, FlowNextLabel(), "听完后可追问或进入提名。");
            AddText("Public Speech Next Step", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 12f), new Vector2(-18f, -218f), $"下一步：{PlayerFacingClueLine(next)}", 11, TextAnchor.LowerLeft, FontStyle.Bold).color = new Color(0.26f, 0.13f, 0.055f, 0.84f);
            AddNotebookRecordControls(parent, "Public", index, count, activePublicSpeechTextPageIndex, pages.Length, () => CyclePublicSpeechRecord(-1), () => CyclePublicSpeechRecord(1));
        }


        private string PublicSpeechEmptyGuidance(int total)
        {
            if (total == 0) return $"下一步：{PlayerFacingClueLine(FirstNonEmpty(FlowNextLabel(), "开始一次公开讨论。"))}";
            return "当前天数与关注对象没有交集。下一步：切换天数、关注对象，或回到全部。";
        }


        private void AddPublicSpeechEmptyCard(Transform parent, string guidance)
        {
            var card = AddPanel("Public Speech Empty", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 40f), new Vector2(584f, 302f), new Color(0.92f, 0.82f, 0.58f, 0.52f));
            AddFrame(card.transform, "Public Speech Empty Frame", 0.75f, new Color(0.26f, 0.13f, 0.055f, 0.28f));
            AddImage("Public Speech Empty Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.090f, 0.18f, 0.12f, 0.78f));
            AddText("Public Speech Empty Title", card.transform, Vector2.zero, Vector2.one, new Vector2(20f, 214f), new Vector2(-20f, -14f), "没有匹配的公开发言", 17, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.18f, 0.085f, 0.035f, 0.98f);
            AddText("Public Speech Empty Body", card.transform, Vector2.zero, Vector2.one, new Vector2(20f, 62f), new Vector2(-20f, -58f), PlayerFacingClueLine(guidance), 14, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.14f, 0.075f, 0.035f, 0.88f);
        }


        private static string[] NotebookTextPages(string value, int maxChars = 180, int maxLines = 7)
        {
            var clean = string.IsNullOrWhiteSpace(value) ? "暂无可读原话。" : value.Trim();
            var pages = new List<string>();
            var buffer = new StringBuilder(Mathf.Min(maxChars, clean.Length));
            var lines = 1;
            foreach (var character in clean)
            {
                if (character == '\n' && lines >= maxLines)
                {
                    if (buffer.Length > 0) pages.Add(buffer.ToString());
                    buffer.Clear();
                    lines = 1;
                    continue;
                }
                buffer.Append(character);
                if (character == '\n') lines += 1;
                if (buffer.Length < maxChars) continue;
                pages.Add(buffer.ToString());
                buffer.Clear();
                lines = 1;
            }
            if (buffer.Length > 0) pages.Add(buffer.ToString());
            return pages.Count == 0 ? new[] { "暂无可读原话。" } : pages.ToArray();
        }


        private void AddNotebookRecordControls(Transform parent, string prefix, int index, int count, int textPageIndex, int textPageCount, UnityEngine.Events.UnityAction previousAction, UnityEngine.Events.UnityAction nextAction)
        {
            var previous = AddButton("上一页", parent, new Vector2(58f, 17f), new Vector2(104f, 30f), previousAction);
            var next = AddButton("下一页", parent, new Vector2(526f, 17f), new Vector2(104f, 30f), nextAction);
            var canMove = count > 1 || textPageCount > 1;
            SetToolButtonEnabled(previous, canMove);
            SetToolButtonEnabled(next, canMove);
            AddText($"{prefix} Notebook Record Position", parent, Vector2.zero, Vector2.zero, new Vector2(168f, 2f), new Vector2(416f, 32f), $"记录 {index + 1}/{Mathf.Max(1, count)} · 原文 {textPageIndex + 1}/{Mathf.Max(1, textPageCount)}", 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.22f, 0.12f, 0.055f, 0.86f);
        }


        private int NormalizeReasoningRecapIndex(int count)
        {
            if (count <= 0)
            {
                activeReasoningRecapIndex = 0;
                return 0;
            }
            if (activeReasoningRecapIndex < 0) activeReasoningRecapIndex = 0;
            if (activeReasoningRecapIndex >= count) activeReasoningRecapIndex = count - 1;
            return activeReasoningRecapIndex;
        }


        private void CycleReasoningRecap(int delta)
        {
            var count = vm?.aiReasoningRecap?.Length ?? 0;
            if (count <= 1) return;
            activeReasoningRecapIndex = ((activeReasoningRecapIndex + delta) % count + count) % count;
            activeReasoningScoreTrailPage = 0;
            activeReasoningScoreTrailExpandedIndex = -1;
            ShowInfoDrawer("recap");
        }

        private int NormalizeReasoningScoreTrailPage(int count)
        {
            if (count <= 0)
            {
                activeReasoningScoreTrailPage = 0;
                return 0;
            }
            activeReasoningScoreTrailPage = ClampPage(activeReasoningScoreTrailPage, count, ReasoningScoreTrailPageSize);
            return activeReasoningScoreTrailPage;
        }

        private void ChangeReasoningScoreTrailPage(int delta)
        {
            var tracks = vm?.aiReasoningRecap ?? Array.Empty<AiReasoningRecapViewModel>();
            var trackIndex = NormalizeReasoningRecapIndex(tracks.Length);
            var count = tracks.Length == 0 ? 0 : tracks[trackIndex]?.scoreTrail?.Count((entry) => entry != null) ?? 0;
            activeReasoningScoreTrailPage = ClampPage(activeReasoningScoreTrailPage + delta, count, ReasoningScoreTrailPageSize);
            activeReasoningScoreTrailExpandedIndex = activeReasoningScoreTrailPage * ReasoningScoreTrailPageSize;
            ShowInfoDrawer("recap");
        }

        private int NormalizeReasoningScoreTrailExpandedIndex(int pageStart, AiReasoningScorePointViewModel[] points)
        {
            if (points == null || points.Length == 0)
            {
                activeReasoningScoreTrailExpandedIndex = -1;
                return -1;
            }
            var min = pageStart;
            var max = pageStart + points.Length - 1;
            if (activeReasoningScoreTrailExpandedIndex < min || activeReasoningScoreTrailExpandedIndex > max)
            {
                activeReasoningScoreTrailExpandedIndex = min;
            }
            return activeReasoningScoreTrailExpandedIndex;
        }

        private void SelectReasoningScoreTrailPoint(int index)
        {
            var tracks = vm?.aiReasoningRecap ?? Array.Empty<AiReasoningRecapViewModel>();
            var trackIndex = NormalizeReasoningRecapIndex(tracks.Length);
            var count = tracks.Length == 0 ? 0 : tracks[trackIndex]?.scoreTrail?.Count((entry) => entry != null) ?? 0;
            activeReasoningScoreTrailExpandedIndex = Mathf.Max(0, index);
            activeReasoningScoreTrailPage = ClampPage(activeReasoningScoreTrailExpandedIndex / ReasoningScoreTrailPageSize, count, ReasoningScoreTrailPageSize);
            ShowInfoDrawer("recap");
        }

        private void JumpToReasoningScoreTrailTimeline(AiReasoningScorePointViewModel point)
        {
            var anchorId = ReasoningTimelineAnchorId(point);
            if (string.IsNullOrWhiteSpace(anchorId)) return;
            activeInfoTimelineAnchorId = anchorId;
            ShowInfoDrawer("timeline");
        }

        private void SelectReasoningRecapForSuspect(string suspectKey)
        {
            var tracks = vm?.aiReasoningRecap ?? Array.Empty<AiReasoningRecapViewModel>();
            if (tracks.Length == 0 || string.IsNullOrWhiteSpace(suspectKey)) return;
            for (var i = 0; i < tracks.Length; i++)
            {
                var track = tracks[i];
                if (track == null) continue;
                if (RecapSuspectKey(track.targetId, track.targetName) != suspectKey) continue;
                activeReasoningRecapIndex = i;
                activeReasoningScoreTrailPage = 0;
                activeReasoningScoreTrailExpandedIndex = -1;
                ShowInfoDrawer("recap");
                return;
            }
        }


        private void AddAiRecapSummaryStrip(Transform parent, AiRecapViewModel[] details, string[] socialClues, AiReasoningRecapViewModel[] reasoningTracks = null, int reasoningIndex = 0)
        {
            var strip = AddPanel("AI Recap Summary Strip", parent, Vector2.zero, Vector2.zero, new Vector2(0f, 306f), new Vector2(584f, 358f), new Color(0.14f, 0.075f, 0.034f, 0.84f));
            AddFrame(strip.transform, "AI Recap Summary Frame", 0.7f, new Color(0.95f, 0.66f, 0.30f, 0.34f));
            AddImage("AI Recap Summary Accent", strip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.26f, 0.030f, 0.038f, 0.86f));
            var badge = AddImage("AI Recap Summary Badge", strip.transform, Vector2.zero, Vector2.zero, new Vector2(16f, 11f), new Vector2(48f, 43f), new Color(0.020f, 0.030f, 0.040f, 0.82f));
            AddFrame(badge.transform, "AI Recap Summary Badge Frame", 0.7f, new Color(0.70f, 0.82f, 0.92f, 0.22f));
            AddText("AI Recap Summary Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, "疑", 15, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("AI Recap Summary Title", strip.transform, Vector2.zero, Vector2.one, new Vector2(60f, 27f), new Vector2(-248f, -4f), "嫌疑卡总览", 15, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("AI Recap Summary Meta", strip.transform, Vector2.zero, Vector2.one, new Vector2(60f, 8f), new Vector2(-250f, -28f), BuildRecapHeadline(details), 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.92f, 0.78f, 0.94f);
            if (reasoningTracks != null && reasoningTracks.Length > 0)
            {
                AddReasoningTrackSelector(strip.transform, reasoningTracks, reasoningIndex);
                return;
            }
            AddText("AI Recap Summary Evidence", strip.transform, Vector2.zero, Vector2.one, new Vector2(332f, 25f), new Vector2(-14f, -7f), BuildRecapEvidenceSummary(details), 12, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.94f);
            AddText("AI Recap Summary Social", strip.transform, Vector2.zero, Vector2.one, new Vector2(332f, 7f), new Vector2(-14f, -29f), socialClues != null && socialClues.Length > 0 ? Ellipsize(string.Join(" / ", socialClues.Take(2)), 32) : "暂无社交线索", 11, TextAnchor.UpperRight, FontStyle.Normal).color = new Color(0.98f, 0.92f, 0.78f, 0.78f);
        }


        private sealed class RecapSuspectSnapshotEntry
        {
            public string key;
            public string name;
            public float score;
            public int evidenceCount;
            public int trailCount;
            public int trackCount;
            public int reasoningIndex;
            public bool hasReasoningTrack;
            public bool selected;
            public float delta;
            public string reason;
        }


        private void AddAiRecapSuspectSnapshot(Transform parent, AiRecapViewModel[] details, AiReasoningRecapViewModel[] reasoningTracks, int reasoningIndex, float y)
        {
            var entries = BuildAiRecapSuspectSnapshotEntries(details, reasoningTracks, reasoningIndex);
            var panel = AddPanel("AI Recap Suspect Snapshot", parent, Vector2.zero, Vector2.zero, new Vector2(0f, y), new Vector2(584f, y + 100f), new Color(0.10f, 0.075f, 0.045f, 0.90f));
            AddFrame(panel.transform, "AI Recap Suspect Snapshot Frame", 0.8f, new Color(0.94f, 0.64f, 0.28f, 0.30f));
            AddImage("AI Recap Suspect Snapshot Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.26f, 0.030f, 0.038f, 0.88f));
            AddText("AI Recap Suspect Snapshot Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(16f, 74f), new Vector2(-250f, -8f), "Suspect Snapshot", 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("AI Recap Suspect Snapshot Meta", panel.transform, Vector2.zero, Vector2.one, new Vector2(304f, 74f), new Vector2(-16f, -8f), entries.Length > 0 ? $"Top {entries.Length} / score + evidence" : "waiting for AI reads", 11, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.82f);

            if (entries.Length == 0)
            {
                AddText("AI Recap Suspect Snapshot Empty", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 20f), new Vector2(-18f, -42f), "No suspect lanes yet. Public and private evidence will populate this strip.", 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.91f, 0.78f, 0.76f);
                return;
            }

            for (var i = 0; i < entries.Length && i < 3; i++)
            {
                AddAiRecapSuspectCard(panel.transform, entries[i], i);
            }
        }


        private RecapSuspectSnapshotEntry[] BuildAiRecapSuspectSnapshotEntries(AiRecapViewModel[] details, AiReasoningRecapViewModel[] reasoningTracks, int reasoningIndex)
        {
            var map = new Dictionary<string, RecapSuspectSnapshotEntry>();
            foreach (var detail in details ?? Array.Empty<AiRecapViewModel>())
            {
                foreach (var target in detail?.targets ?? Array.Empty<AiRecapTargetViewModel>())
                {
                    if (target == null) continue;
                    var entry = UpsertRecapSuspectSnapshotEntry(map, target.id, target.name);
                    entry.score = Mathf.Max(entry.score, Mathf.Clamp01(target.scoreValue));
                    var trail = target.trail?.Where((item) => item != null).ToArray() ?? Array.Empty<AiTrailViewModel>();
                    entry.evidenceCount += trail.Length;
                    entry.trailCount = Mathf.Max(entry.trailCount, trail.Length);
                    entry.trackCount += 1;
                    var latest = trail.LastOrDefault();
                    if (latest != null && Mathf.Abs(latest.appliedDelta) >= Mathf.Abs(entry.delta)) entry.delta = latest.appliedDelta;
                    if (string.IsNullOrWhiteSpace(entry.reason)) entry.reason = FirstNonEmpty(target.reason, detail.reason);
                }
            }

            var tracks = reasoningTracks ?? Array.Empty<AiReasoningRecapViewModel>();
            for (var i = 0; i < tracks.Length; i++)
            {
                var track = tracks[i];
                if (track == null) continue;
                var entry = UpsertRecapSuspectSnapshotEntry(map, track.targetId, track.targetName);
                entry.score = Mathf.Max(entry.score, Mathf.Clamp01(track.latestScore));
                var point = LatestReasoningPoint(track);
                var evidence = point == null
                    ? track.evidenceSnippets?.Count((item) => item != null && !string.IsNullOrWhiteSpace(item.text)) ?? 0
                    : Mathf.RoundToInt(point.focusEvidenceCount);
                entry.evidenceCount += evidence;
                entry.trailCount = Mathf.Max(entry.trailCount, track.scoreTrail?.Count((item) => item != null) ?? 0);
                entry.trackCount += 1;
                entry.hasReasoningTrack = true;
                if (entry.reasoningIndex < 0) entry.reasoningIndex = i;
                if (i == reasoningIndex) entry.selected = true;
                if (Mathf.Abs(track.scoreDelta) >= Mathf.Abs(entry.delta)) entry.delta = track.scoreDelta;
                if (string.IsNullOrWhiteSpace(entry.reason)) entry.reason = FirstNonEmpty(track.latestSummary, ReasoningEvidenceLine(track));
            }

            return map.Values
                .Where((entry) => entry != null)
                .OrderByDescending((entry) => entry.score)
                .ThenByDescending((entry) => entry.evidenceCount)
                .ThenBy((entry) => entry.name ?? "")
                .Take(3)
                .ToArray();
        }


        private RecapSuspectSnapshotEntry UpsertRecapSuspectSnapshotEntry(Dictionary<string, RecapSuspectSnapshotEntry> map, string id, string name)
        {
            var key = RecapSuspectKey(id, name);
            if (map.TryGetValue(key, out var entry)) return entry;
            entry = new RecapSuspectSnapshotEntry
            {
                key = key,
                name = FirstNonEmpty(name, NameForPlayerId(id), "Unknown"),
                score = 0f,
                evidenceCount = 0,
                trailCount = 0,
                trackCount = 0,
                reasoningIndex = -1,
                hasReasoningTrack = false,
                selected = false,
                delta = 0f,
                reason = "",
            };
            map[key] = entry;
            return entry;
        }


        private static string RecapSuspectKey(string id, string name)
        {
            return FirstNonEmpty(id, name, "unknown");
        }


        private void AddAiRecapSuspectCard(Transform parent, RecapSuspectSnapshotEntry entry, int index)
        {
            var x = 14f + index * 190f;
            var accent = RecapScoreColor(entry == null ? 0f : entry.score);
            var selected = entry?.selected == true;
            var card = AddPanel($"AI Recap Suspect Card {index + 1}", parent, Vector2.zero, Vector2.zero, new Vector2(x, 10f), new Vector2(x + 178f, 68f), selected ? new Color(accent.r * 0.34f, accent.g * 0.28f, accent.b * 0.22f, 0.94f) : new Color(accent.r * 0.24f, accent.g * 0.20f, accent.b * 0.18f, 0.88f));
            var cardImage = card.GetComponent<Image>();
            var button = card.AddComponent<Button>();
            card.AddComponent<CanvasGroup>();
            button.targetGraphic = cardImage;
            button.interactable = entry?.hasReasoningTrack == true;
            if (entry?.hasReasoningTrack == true) button.onClick.AddListener(() => SelectReasoningRecapForSuspect(entry.key));
            ApplyButtonStyle(button);
            AddFrame(card.transform, "AI Recap Suspect Card Frame", selected ? 1.05f : 0.65f, selected ? new Color(1f, 0.82f, 0.32f, 0.58f) : new Color(accent.r, accent.g, accent.b, 0.32f));
            if (selected) AddImage("AI Recap Suspect Selected Glow", card.transform, Vector2.zero, Vector2.one, new Vector2(-3f, -3f), new Vector2(3f, 3f), new Color(1f, 0.76f, 0.24f, 0.13f)).transform.SetAsFirstSibling();
            AddImage("AI Recap Suspect Card Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(accent.r, accent.g, accent.b, 0.66f));

            var ring = AddImage("AI Recap Suspect Score Ring", card.transform, Vector2.zero, Vector2.zero, new Vector2(8f, 16f), new Vector2(48f, 56f), new Color(accent.r, accent.g, accent.b, 0.54f));
            ring.sprite = GetCircleRingSprite();
            ring.preserveAspect = true;
            ring.raycastTarget = false;
            var badge = AddImage("AI Recap Suspect Score Badge", card.transform, Vector2.zero, Vector2.zero, new Vector2(12f, 20f), new Vector2(44f, 52f), new Color(accent.r, accent.g, accent.b, 0.86f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            AddText("AI Recap Suspect Score Text", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, entry == null || entry.score <= 0f ? "--" : $"{entry.score * 100f:0}", 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = Color.white;
            AddText("AI Recap Suspect Name", card.transform, Vector2.zero, Vector2.one, new Vector2(54f, 39f), new Vector2(-8f, -5f), Ellipsize(entry?.name, 15), 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.86f, 0.48f, 0.98f);
            AddText("AI Recap Suspect Reason", card.transform, Vector2.zero, Vector2.one, new Vector2(54f, 25f), new Vector2(-8f, -20f), Ellipsize(FirstNonEmpty(entry?.reason, "pending"), 18), 9, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.91f, 0.78f, 0.76f);
            AddText("AI Recap Suspect Trail State", card.transform, Vector2.zero, Vector2.one, new Vector2(130f, 39f), new Vector2(-8f, -7f), selected ? "open" : entry?.hasReasoningTrack == true ? "trail" : "--", 8, TextAnchor.UpperRight, FontStyle.Bold).color = selected ? new Color(1f, 0.88f, 0.36f, 0.98f) : new Color(0.82f, 0.90f, 1f, 0.66f);
            AddAiRecapSuspectMetricChip(card.transform, "AI Recap Suspect Evidence Chip", "E", entry == null ? "0" : entry.evidenceCount.ToString(), 54f, 7f, 40f, new Color(0.22f, 0.46f, 0.78f, 0.86f));
            AddAiRecapSuspectMetricChip(card.transform, "AI Recap Suspect Trail Chip", "T", entry == null ? "0" : entry.trailCount.ToString(), 100f, 7f, 38f, new Color(0.45f, 0.28f, 0.78f, 0.84f));
            AddAiRecapSuspectMetricChip(card.transform, "AI Recap Suspect Delta Chip", "D", entry == null ? "0" : FormatRecapDelta(entry.delta), 144f, 7f, 28f, entry != null && entry.delta > 0f ? new Color(0.78f, 0.24f, 0.16f, 0.80f) : new Color(0.20f, 0.62f, 0.42f, 0.78f));
            SetRaycastTargetsExceptButtons(card.transform);
        }


        private void AddAiRecapSuspectMetricChip(Transform parent, string objectName, string label, string value, float x, float y, float width, Color accent)
        {
            var chip = AddPanel(objectName, parent, Vector2.zero, Vector2.zero, new Vector2(x, y), new Vector2(x + width, y + 15f), new Color(accent.r * 0.34f, accent.g * 0.34f, accent.b * 0.34f, 0.72f));
            AddFrame(chip.transform, $"{objectName} Frame", 0.45f, new Color(accent.r, accent.g, accent.b, 0.30f));
            AddText($"{objectName} Text", chip.transform, Vector2.zero, Vector2.one, new Vector2(3f, 0f), new Vector2(-3f, 0f), Ellipsize($"{label} {value}", Mathf.Max(3, Mathf.FloorToInt(width / 6f))), 7, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.92f, 0.74f, 0.90f);
        }


        private void AddReasoningTrackSelector(Transform parent, AiReasoningRecapViewModel[] reasoningTracks, int reasoningIndex)
        {
            var count = reasoningTracks?.Length ?? 0;
            if (count <= 0) return;
            var index = Mathf.Clamp(reasoningIndex, 0, count - 1);
            var item = reasoningTracks[index];
            var label = $"推理轨道 {index + 1}/{count}";
            var speaker = FirstNonEmpty(item?.speakerName, NameForPlayerId(item?.speakerId), "AI");
            var target = FirstNonEmpty(item?.targetName, NameForPlayerId(item?.targetId), "--");
            AddText("AI Reasoning Track Selector Title", parent, Vector2.zero, Vector2.one, new Vector2(334f, 27f), new Vector2(-96f, -5f), label, 12, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddText("AI Reasoning Track Selector Meta", parent, Vector2.zero, Vector2.one, new Vector2(334f, 8f), new Vector2(-96f, -28f), Ellipsize($"{speaker} -> {target}", 24), 11, TextAnchor.UpperRight, FontStyle.Normal).color = new Color(0.98f, 0.92f, 0.78f, 0.78f);
            if (count <= 1) return;
            AddButton("‹", parent, new Vector2(504f, 26f), new Vector2(34f, 26f), () => CycleReasoningRecap(-1));
            AddButton("›", parent, new Vector2(548f, 26f), new Vector2(34f, 26f), () => CycleReasoningRecap(1));
        }

        private void AddAiRecapCard(Transform parent, AiRecapViewModel detail, float y)
        {
            var card = AddPanel($"AI Recap Card {detail?.id}", parent, Vector2.zero, Vector2.zero, new Vector2(0f, y), new Vector2(584f, y + 100f), new Color(0.12f, 0.065f, 0.030f, 0.88f));
            AddFrame(card.transform, "AI Recap Card Frame", 0.8f, new Color(0.94f, 0.64f, 0.28f, 0.34f));
            AddImage("AI Recap Card Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(4f, 0f), new Color(0.26f, 0.030f, 0.038f, 0.88f));

            var targets = detail?.targets ?? Array.Empty<AiRecapTargetViewModel>();
            var top = targets.FirstOrDefault();
            var scoreValue = top == null ? 0.5f : Mathf.Clamp01(top.scoreValue);
            var scoreColor = RecapScoreColor(scoreValue);
            var scoreRing = AddImage("AI Recap Score Ring", card.transform, Vector2.zero, Vector2.zero, new Vector2(11f, 30f), new Vector2(75f, 94f), new Color(scoreColor.r, scoreColor.g, scoreColor.b, 0.50f));
            scoreRing.sprite = GetCircleRingSprite();
            scoreRing.preserveAspect = true;
            scoreRing.raycastTarget = false;
            var scoreBadge = AddImage("AI Recap Score Badge", card.transform, Vector2.zero, Vector2.zero, new Vector2(18f, 37f), new Vector2(68f, 87f), new Color(scoreColor.r, scoreColor.g, scoreColor.b, 0.88f));
            scoreBadge.sprite = GetCircleFillSprite();
            scoreBadge.preserveAspect = true;
            AddText("AI Recap Score", scoreBadge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, top == null ? "--" : top.score, 16, TextAnchor.MiddleCenter, FontStyle.Bold).color = Color.white;
            AddText("AI Recap Score Label", card.transform, Vector2.zero, Vector2.one, new Vector2(13f, 12f), new Vector2(-503f, -62f), RecapRiskLabel(scoreValue), 11, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.94f);

            var observer = FirstNonEmpty(detail?.name, detail?.id, "AI");
            var target = FirstNonEmpty(top?.name, detail?.target, "--");
            AddText("AI Recap Observer", card.transform, Vector2.zero, Vector2.one, new Vector2(88f, 72f), new Vector2(-306f, -8f), Ellipsize($"AI 视角：{observer}", 22), 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("AI Recap Target", card.transform, Vector2.zero, Vector2.one, new Vector2(320f, 72f), new Vector2(-18f, -8f), Ellipsize($"关注：{target}", 18), 13, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            var reason = FirstNonEmpty(top?.reason, detail?.reason, "暂无线索。");
            AddText("AI Recap Candidate Row", card.transform, Vector2.zero, Vector2.one, new Vector2(88f, 55f), new Vector2(-18f, -28f), RecapCandidateLine(targets), 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.72f, 0.88f, 0.82f, 0.86f);
            AddText("AI Recap Card Reason", card.transform, Vector2.zero, Vector2.one, new Vector2(88f, 36f), new Vector2(-18f, -48f), Ellipsize($"依据：{reason}", 50), 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.92f);

            var trail = top?.trail ?? Array.Empty<AiTrailViewModel>();
            var x = 88f;
            foreach (var item in trail.TakeLast(3))
            {
                var chipWidth = 138f;
                AddAiRecapEvidenceChip(card.transform, item, new Vector2(x, 5f), chipWidth);
                x += chipWidth + 9f;
            }
            if (trail.Length == 0)
            {
                AddAiRecapEvidenceChip(card.transform, null, new Vector2(88f, 5f), 184f);
            }
            AddText("AI Recap Trail Count", card.transform, Vector2.zero, Vector2.one, new Vector2(524f, 10f), new Vector2(-12f, -70f), trail.Length > 0 ? $"{trail.Length} 条" : "待积累", 10, TextAnchor.MiddleRight, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.72f);
        }


        private void AddAiReasoningRecapCard(Transform parent, AiReasoningRecapViewModel item, float y)
        {
            var card = AddPanel($"AI Reasoning Recap Card {item?.id}", parent, Vector2.zero, Vector2.zero, new Vector2(0f, y), new Vector2(584f, y + 100f), new Color(0.085f, 0.075f, 0.11f, 0.88f));
            AddFrame(card.transform, "AI Reasoning Recap Frame", 0.8f, new Color(0.72f, 0.58f, 0.92f, 0.30f));
            AddImage("AI Reasoning Recap Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(0.18f, 0.12f, 0.42f, 0.88f));

            var badge = AddImage("AI Reasoning Recap Badge", card.transform, Vector2.zero, Vector2.zero, new Vector2(18f, 52f), new Vector2(68f, 88f), new Color(0.18f, 0.12f, 0.42f, 0.88f));
            AddFrame(badge.transform, "AI Reasoning Recap Badge Frame", 0.7f, new Color(0.88f, 0.78f, 1f, 0.30f));
            AddText("AI Reasoning Recap Badge Text", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, item == null ? "0" : Mathf.Max(1, item.count).ToString(), 15, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.92f, 0.74f, 0.98f);
            AddText("AI Reasoning Recap Badge Label", card.transform, Vector2.zero, Vector2.one, new Vector2(15f, 14f), new Vector2(-503f, -62f), ReasoningScoreDeltaLabel(item), 11, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.88f);

            var speaker = FirstNonEmpty(item?.speakerName, NameForPlayerId(item?.speakerId), "AI");
            var target = FirstNonEmpty(item?.targetName, NameForPlayerId(item?.targetId), "--");
            AddText("AI Reasoning Recap Title", card.transform, Vector2.zero, Vector2.one, new Vector2(88f, 72f), new Vector2(-18f, -8f), Ellipsize($"{speaker} -> {target}", 30), 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("AI Reasoning Recap Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(336f, 72f), new Vector2(-18f, -9f), Ellipsize(ReasoningRecapMeta(item), 22), 11, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.86f, 0.80f, 1f, 0.84f);
            AddText("AI Reasoning Recap Latest", card.transform, Vector2.zero, Vector2.one, new Vector2(88f, 42f), new Vector2(-18f, -32f), Ellipsize($"最新：{FirstNonEmpty(item?.latestSummary, ReasoningEvidenceLine(item), "暂无理由摘要")}", 58), 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.92f);

            AddReasoningSignalChip(card.transform, "分数", ReasoningSignalScoreLabel(item), new Vector2(88f, 8f), 92f, RecapScoreColor(item == null ? 0f : item.latestScore));
            AddReasoningSignalChip(card.transform, "变化", ReasoningScoreDeltaLabel(item), new Vector2(188f, 8f), 92f, ReasoningDeltaAccent(item));
            AddReasoningSignalChip(card.transform, "证据", ReasoningSignalEvidenceLabel(item), new Vector2(288f, 8f), 92f, new Color(0.22f, 0.46f, 0.78f, 0.80f));
            AddReasoningSignalChip(card.transform, "置信", ReasoningSignalConfidenceLabel(item), new Vector2(388f, 8f), 112f, new Color(0.45f, 0.28f, 0.78f, 0.78f));
        }

        private void AddReasoningSignalChip(Transform parent, string label, string value, Vector2 bottomLeft, float width, Color accent)
        {
            var fill = new Color(accent.r * 0.30f, accent.g * 0.30f, accent.b * 0.30f, 0.72f);
            var border = new Color(accent.r, accent.g, accent.b, 0.34f);
            var chip = AddPanel("AI Reasoning Signal Chip", parent, Vector2.zero, Vector2.zero, bottomLeft, bottomLeft + new Vector2(width, 30f), fill);
            AddFrame(chip.transform, "AI Reasoning Signal Chip Frame", 0.55f, border);
            AddImage("AI Reasoning Signal Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), border);
            AddText("AI Reasoning Signal Chip Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 15f), new Vector2(-8f, -2f), label, 9, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.92f, 0.90f, 1f, 0.72f);
            AddText("AI Reasoning Signal Chip Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 3f), new Vector2(-8f, -15f), Ellipsize(FirstNonEmpty(value, "--"), 12), 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.92f, 0.74f, 0.96f);
        }

        private void AddReasoningLatestDecisionSnapshotChips(Transform parent, AiReasoningRecapViewModel item)
        {
            var point = LatestReasoningPoint(item);
            if (point == null)
            {
                AddReasoningAuditSectionChip(parent, "pending", FirstNonEmpty(item?.latestSummary, "decision trail pending"), new Vector2(16f, 52f), 536f, new Color(0.42f, 0.42f, 0.48f, 0.78f));
                return;
            }

            var row = point.evidenceRows?.FirstOrDefault((entry) => entry != null);
            AddReasoningAuditSectionChip(parent, "score", ReasoningPointScoreLine(point), new Vector2(16f, 52f), 88f, RecapScoreColor(point.focusScore));
            AddReasoningAuditSectionChip(parent, "compare", FirstNonEmpty(point.comparisonTrace?.summary, point.summary), new Vector2(110f, 52f), 118f, new Color(0.45f, 0.28f, 0.78f, 0.78f));
            AddReasoningAuditSectionChip(parent, "source", ReasoningTimelineAnchorLine(point), new Vector2(234f, 52f), 112f, new Color(0.22f, 0.46f, 0.78f, 0.80f));
            AddReasoningAuditSectionChip(parent, "continuity", ReasoningContinuityLine(point), new Vector2(352f, 52f), 118f, new Color(0.22f, 0.56f, 0.46f, 0.78f));
            AddReasoningAuditSectionChip(parent, "evidence", row == null ? FirstNonEmpty(point.summary, "pending") : ReasoningEvidenceRowBody(row), new Vector2(476f, 52f), 92f, new Color(0.78f, 0.42f, 0.16f, 0.78f));
        }

        private void AddReasoningAuditSectionChip(Transform parent, string label, string value, Vector2 bottomLeft, float width, Color accent)
        {
            var fill = new Color(accent.r * 0.26f, accent.g * 0.26f, accent.b * 0.26f, 0.72f);
            var border = new Color(accent.r, accent.g, accent.b, 0.32f);
            var chip = AddPanel("AI Reasoning Latest Decision Snapshot Chip", parent, Vector2.zero, Vector2.zero, bottomLeft, bottomLeft + new Vector2(width, 16f), fill);
            AddFrame(chip.transform, "AI Reasoning Latest Decision Snapshot Chip Frame", 0.45f, border);
            AddImage("AI Reasoning Latest Decision Snapshot Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), border);
            AddText("AI Reasoning Latest Decision Snapshot Chip Text", chip.transform, Vector2.zero, Vector2.one, new Vector2(6f, 0f), new Vector2(-5f, 0f), Ellipsize($"{label}: {FirstNonEmpty(value, "--")}", Mathf.Max(6, Mathf.FloorToInt(width / 7f))), 7, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.96f, 0.92f, 1f, 0.88f);
        }


        private void AddAiReasoningEvidenceDrilldownCard(Transform parent, AiReasoningRecapViewModel item, float y)
        {
            var card = AddPanel($"AI Reasoning Evidence Drilldown {item?.id}", parent, Vector2.zero, Vector2.zero, new Vector2(0f, y), new Vector2(584f, y + 100f), new Color(0.055f, 0.060f, 0.085f, 0.90f));
            AddFrame(card.transform, "AI Reasoning Evidence Drilldown Frame", 0.8f, new Color(0.62f, 0.74f, 0.96f, 0.30f));
            AddImage("AI Reasoning Evidence Drilldown Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(0.060f, 0.14f, 0.22f, 0.88f));

            var allPoints = item?.scoreTrail?.Where((entry) => entry != null).ToArray() ?? Array.Empty<AiReasoningScorePointViewModel>();
            var totalPages = PageCount(allPoints.Length, ReasoningScoreTrailPageSize);
            var page = NormalizeReasoningScoreTrailPage(allPoints.Length);
            var pageStart = page * ReasoningScoreTrailPageSize;
            var points = allPoints.Skip(pageStart).Take(ReasoningScoreTrailPageSize).ToArray();
            var speaker = FirstNonEmpty(item?.speakerName, NameForPlayerId(item?.speakerId), "AI");
            var target = FirstNonEmpty(item?.targetName, NameForPlayerId(item?.targetId), "--");
            AddText("AI Reasoning Evidence Title", card.transform, Vector2.zero, Vector2.one, new Vector2(16f, 74f), new Vector2(-230f, -7f), Ellipsize($"分数轨迹：{speaker} -> {target}", 26), 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.98f);
            AddText("AI Reasoning Evidence Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(310f, 74f), new Vector2(-104f, -8f), allPoints.Length > 0 ? $"{allPoints.Length} 个分数点 · Page {page + 1}/{totalPages}" : "score trail pending", 11, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.82f, 0.90f, 1f, 0.88f);
            AddReasoningLatestDecisionSnapshotChips(card.transform, item);
            if (totalPages > 1)
            {
                var prev = AddToolActionButton("‹", "Previous", card.transform, new Vector2(500f, 84f), new Vector2(42f, 24f), () => ChangeReasoningScoreTrailPage(-1), true);
                var next = AddToolActionButton("›", "Next", card.transform, new Vector2(548f, 84f), new Vector2(42f, 24f), () => ChangeReasoningScoreTrailPage(1), true);
                SetToolButtonEnabled(prev, page > 0);
                SetToolButtonEnabled(next, page < totalPages - 1);
            }

            if (points.Length == 0)
            {
                AddAiReasoningEvidenceRow(card.transform, null, 18f, "待积累", "暂无可回连的 belief trail 证据行。");
                return;
            }

            var expandedIndex = NormalizeReasoningScoreTrailExpandedIndex(pageStart, points);
            var chipGap = 8f;
            var chipWidth = points.Length <= 1 ? 552f : (552f - chipGap) / points.Length;
            for (var i = 0; i < points.Length; i++)
            {
                var index = pageStart + i;
                AddAiReasoningScoreTrailSelectorChip(card.transform, points[i], index, index == expandedIndex, 16f + i * (chipWidth + chipGap), 34f, chipWidth);
            }

            var expandedPoint = expandedIndex >= pageStart && expandedIndex < pageStart + points.Length ? points[expandedIndex - pageStart] : points[0];
            AddAiReasoningScoreTrailExpandedRow(card.transform, expandedPoint, expandedIndex < 0 ? pageStart : expandedIndex);
        }


        private void AddAiReasoningScoreTrailSelectorChip(Transform parent, AiReasoningScorePointViewModel point, int index, bool selected, float x, float y, float width)
        {
            var row = point?.evidenceRows?.FirstOrDefault((entry) => entry != null);
            var accent = row == null
                ? new Color(0.24f, 0.26f, 0.32f, 0.82f)
                : row.appliedDelta >= 0f ? new Color(0.74f, 0.25f, 0.16f, 0.88f) : new Color(0.20f, 0.62f, 0.42f, 0.84f);
            var panel = AddPanel("AI Reasoning Score Trail Selector Chip", parent, Vector2.zero, Vector2.zero, new Vector2(x, y), new Vector2(x + width, y + 16f), selected ? new Color(0.82f, 0.62f, 0.24f, 0.30f) : new Color(0.88f, 0.82f, 0.64f, 0.13f));
            AddFrame(panel.transform, "AI Reasoning Score Trail Selector Chip Frame", 0.5f, selected ? new Color(1f, 0.78f, 0.32f, 0.45f) : new Color(0.64f, 0.74f, 0.92f, 0.16f));
            AddImage("AI Reasoning Score Trail Selector Chip Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), accent);
            if (selected) AddImage("AI Reasoning Score Trail Selector Selected Glow", panel.transform, new Vector2(0f, 0.45f), Vector2.one, new Vector2(4f, -3f), new Vector2(-4f, -3f), new Color(1f, 0.72f, 0.25f, 0.12f));
            var button = panel.AddComponent<Button>();
            button.onClick.AddListener(() => SelectReasoningScoreTrailPoint(index));
            ApplyButtonStyle(button);
            var label = $"#{index + 1} {ReasoningPointScoreLine(point)}";
            AddText("AI Reasoning Score Trail Selector Chip Text", panel.transform, Vector2.zero, Vector2.one, new Vector2(8f, 0f), new Vector2(-8f, 0f), Ellipsize(label, Mathf.Max(12, Mathf.FloorToInt(width / 8f))), 8, TextAnchor.MiddleLeft, FontStyle.Bold).color = selected ? new Color(1f, 0.92f, 0.74f, 0.96f) : new Color(0.82f, 0.90f, 1f, 0.76f);
            SetRaycastTargetsExceptButtons(panel.transform);
        }


        private void AddAiReasoningScoreTrailExpandedRow(Transform parent, AiReasoningScorePointViewModel point, int index)
        {
            var row = point?.evidenceRows?.FirstOrDefault((entry) => entry != null);
            var up = row == null || row.appliedDelta >= 0f;
            var accent = row == null
                ? new Color(0.12f, 0.12f, 0.14f, 0.86f)
                : up ? new Color(0.22f, 0.070f, 0.060f, 0.88f) : new Color(0.040f, 0.13f, 0.12f, 0.88f);
            var panel = AddPanel("AI Reasoning Score Trail Expanded Row", parent, Vector2.zero, Vector2.zero, new Vector2(16f, 4f), new Vector2(568f, 31f), new Color(0.88f, 0.82f, 0.64f, 0.18f));
            AddFrame(panel.transform, "AI Reasoning Score Trail Expanded Row Frame", 0.55f, new Color(0.92f, 0.78f, 0.34f, 0.24f));
            AddImage("AI Reasoning Score Trail Expanded Row Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), accent);

            var meta = $"#{index + 1} {ReasoningPointScoreLine(point)} | {ReasoningEvidenceRowMeta(row)}";
            var body = ReasoningScorePointAuditLine(point, 3);
            var hasCrossDayStance = point?.crossDayStance != null;
            AddText("AI Reasoning Score Trail Expanded Meta", panel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 14f), new Vector2(hasCrossDayStance ? -176f : -88f, -1f), Ellipsize(meta, hasCrossDayStance ? 52 : 66), 8, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.82f, 0.90f, 1f, 0.90f);
            AddReasoningCrossDayStanceBadge(panel.transform, point?.crossDayStance);
            var usesRightChipLane = ReasoningHasCrossDayAnchorChips(point) || ReasoningHasEvidenceRows(point);
            AddText("AI Reasoning Score Trail Expanded Body", panel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 3f), new Vector2(usesRightChipLane ? -286f : -88f, -14f), Ellipsize(body, usesRightChipLane ? 40 : 68), 8, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.91f, 0.78f, 0.88f);
            if (ReasoningHasCrossDayAnchorChips(point))
            {
                AddReasoningCrossDayAnchorChips(panel.transform, point);
            }
            else
            {
                AddReasoningEvidenceExpandedRows(panel.transform, point);
            }

            var jump = AddToolActionButton("TL", "Open", panel.transform, new Vector2(514f, 14f), new Vector2(76f, 20f), () => JumpToReasoningScoreTrailTimeline(point), true);
            SetToolButtonEnabled(jump, !string.IsNullOrWhiteSpace(ReasoningTimelineAnchorId(point)));
        }


        private void AddReasoningCrossDayStanceBadge(Transform parent, CrossDayStanceViewModel crossDay)
        {
            var text = ReasoningCrossDayStanceBadgeLine(crossDay);
            if (string.IsNullOrWhiteSpace(text)) return;
            var accent = string.Equals(crossDay?.continuity, "shift", StringComparison.OrdinalIgnoreCase)
                ? new Color(0.74f, 0.32f, 0.18f, 0.78f)
                : new Color(0.22f, 0.56f, 0.46f, 0.76f);
            var fill = new Color(accent.r * 0.26f, accent.g * 0.26f, accent.b * 0.26f, 0.76f);
            var badge = AddPanel("AI Reasoning Cross Day Stance Badge", parent, Vector2.zero, Vector2.zero, new Vector2(394f, 14f), new Vector2(508f, 26f), fill);
            AddFrame(badge.transform, "AI Reasoning Cross Day Stance Badge Frame", 0.42f, new Color(accent.r, accent.g, accent.b, 0.36f));
            AddImage("AI Reasoning Cross Day Stance Badge Accent", badge.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), accent);
            AddText("AI Reasoning Cross Day Stance Badge Text", badge.transform, Vector2.zero, Vector2.one, new Vector2(5f, 0f), new Vector2(-4f, 0f), Ellipsize(text, 15), 6, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.96f, 0.92f, 1f, 0.88f);
        }


        private void AddReasoningCrossDayAnchorChips(Transform parent, AiReasoningScorePointViewModel point)
        {
            var eventAnchor = ReasoningCrossDayEventAnchor(point);
            var scoreAnchor = ReasoningCrossDayScoreAnchor(point);
            var evidenceAnchor = ReasoningCrossDayEvidenceAnchor(point);
            if (eventAnchor == null && scoreAnchor == null && evidenceAnchor == null) return;
            AddReasoningCrossDayAnchorChip(parent, "event", ReasoningCrossDayEventChipLine(eventAnchor), new Vector2(288f, 2f), 68f, new Color(0.22f, 0.46f, 0.78f, 0.78f));
            AddReasoningCrossDayAnchorChip(parent, "score", ReasoningCrossDayScoreChipLine(scoreAnchor), new Vector2(360f, 2f), 68f, new Color(0.45f, 0.28f, 0.78f, 0.76f));
            AddReasoningCrossDayAnchorChip(parent, "evidence", ReasoningCrossDayEvidenceChipLine(evidenceAnchor), new Vector2(432f, 2f), 76f, new Color(0.78f, 0.42f, 0.16f, 0.76f));
        }


        private void AddReasoningCrossDayAnchorChip(Transform parent, string label, string value, Vector2 bottomLeft, float width, Color accent)
        {
            var fill = new Color(accent.r * 0.26f, accent.g * 0.26f, accent.b * 0.26f, 0.74f);
            var border = new Color(accent.r, accent.g, accent.b, 0.34f);
            var chip = AddPanel("AI Reasoning Cross Day Anchor Chip", parent, Vector2.zero, Vector2.zero, bottomLeft, bottomLeft + new Vector2(width, 12f), fill);
            AddFrame(chip.transform, "AI Reasoning Cross Day Anchor Chip Frame", 0.40f, border);
            AddImage("AI Reasoning Cross Day Anchor Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), border);
            AddText("AI Reasoning Cross Day Anchor Chip Text", chip.transform, Vector2.zero, Vector2.one, new Vector2(5f, 0f), new Vector2(-4f, 0f), Ellipsize($"{label}: {FirstNonEmpty(value, "--")}", Mathf.Max(6, Mathf.FloorToInt(width / 7f))), 6, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.96f, 0.92f, 1f, 0.86f);
        }

        private static bool ReasoningHasCrossDayAnchorChips(AiReasoningScorePointViewModel point)
        {
            return ReasoningCrossDayEventAnchor(point) != null
                || ReasoningCrossDayScoreAnchor(point) != null
                || ReasoningCrossDayEvidenceAnchor(point) != null;
        }

        private void AddReasoningEvidenceDrillthroughChips(Transform parent, AiReasoningScorePointViewModel point)
        {
            var rows = ReasoningVisibleEvidenceRows(point).Take(2).ToArray();
            if (rows.Length == 0) return;
            var contextAnchorId = ReasoningEvidenceContextAnchorId(point);
            const float width = 106f;
            const float gap = 4f;
            for (var i = 0; i < rows.Length; i++)
            {
                var row = rows[i];
                var accent = row.appliedDelta >= 0f
                    ? new Color(0.78f, 0.42f, 0.16f, 0.76f)
                    : new Color(0.20f, 0.62f, 0.42f, 0.76f);
                AddReasoningEvidenceDrillthroughChip(parent, $"e{i + 1}", ReasoningEvidenceDrillthroughLine(row), new Vector2(288f + i * (width + gap), 2f), width, accent, row, string.IsNullOrWhiteSpace(contextAnchorId) ? null : point);
            }
        }

        private void AddReasoningEvidenceExpandedRows(Transform parent, AiReasoningScorePointViewModel point)
        {
            var rows = ReasoningVisibleEvidenceRows(point).Take(2).ToArray();
            if (rows.Length == 0) return;
            var contextAnchorId = ReasoningEvidenceContextAnchorId(point);
            for (var i = 0; i < rows.Length; i++)
            {
                var row = rows[i];
                var accent = row.appliedDelta >= 0f
                    ? new Color(0.78f, 0.42f, 0.16f, 0.76f)
                    : new Color(0.20f, 0.62f, 0.42f, 0.76f);
                AddReasoningEvidenceExpandedRow(parent, $"e{i + 1}", row, new Vector2(288f, 14f - i * 12f), 220f, accent, string.IsNullOrWhiteSpace(contextAnchorId) ? null : point);
            }
        }

        private void AddReasoningEvidenceExpandedRow(Transform parent, string label, AiReasoningEvidenceRowViewModel row, Vector2 bottomLeft, float width, Color accent, AiReasoningScorePointViewModel contextPoint)
        {
            var fill = new Color(accent.r * 0.22f, accent.g * 0.22f, accent.b * 0.22f, 0.74f);
            var border = new Color(accent.r, accent.g, accent.b, 0.34f);
            var hasEvidenceAnchor = !string.IsNullOrWhiteSpace(ReasoningEvidenceTimelineAnchorId(row));
            var hasContextAnchor = contextPoint != null;
            var panel = AddPanel("AI Reasoning Evidence Expanded Row", parent, Vector2.zero, Vector2.zero, bottomLeft, bottomLeft + new Vector2(width, 11f), fill);
            AddFrame(panel.transform, "AI Reasoning Evidence Expanded Row Frame", 0.40f, border);
            AddImage("AI Reasoning Evidence Expanded Row Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), border);
            if (hasEvidenceAnchor || hasContextAnchor)
            {
                var button = panel.AddComponent<Button>();
                button.onClick.AddListener(() => JumpToReasoningEvidenceTimeline(row, contextPoint));
                ApplyButtonStyle(button);
            }
            var prefix = ReasoningEvidenceJumpPrefix(label, row, contextPoint);
            AddText("AI Reasoning Evidence Expanded Row Text", panel.transform, Vector2.zero, Vector2.one, new Vector2(5f, 0f), new Vector2(-4f, 0f), Ellipsize($"{prefix}: {ReasoningEvidenceExpandedRowLine(row)}", Mathf.Max(12, Mathf.FloorToInt(width / 7f))), 6, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.96f, 0.92f, 1f, 0.86f);
            if (hasEvidenceAnchor || hasContextAnchor) SetRaycastTargetsExceptButtons(panel.transform);
        }

        private void AddReasoningEvidenceDrillthroughChip(Transform parent, string label, string value, Vector2 bottomLeft, float width, Color accent, AiReasoningEvidenceRowViewModel row, AiReasoningScorePointViewModel contextPoint)
        {
            var fill = new Color(accent.r * 0.26f, accent.g * 0.26f, accent.b * 0.26f, 0.74f);
            var border = new Color(accent.r, accent.g, accent.b, 0.34f);
            var hasEvidenceAnchor = !string.IsNullOrWhiteSpace(ReasoningEvidenceTimelineAnchorId(row));
            var hasContextAnchor = contextPoint != null;
            var chip = AddPanel("AI Reasoning Evidence Drillthrough Chip", parent, Vector2.zero, Vector2.zero, bottomLeft, bottomLeft + new Vector2(width, 12f), fill);
            AddFrame(chip.transform, "AI Reasoning Evidence Drillthrough Chip Frame", 0.40f, border);
            AddImage("AI Reasoning Evidence Drillthrough Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), border);
            if (hasEvidenceAnchor || hasContextAnchor)
            {
                var button = chip.AddComponent<Button>();
                button.onClick.AddListener(() => JumpToReasoningEvidenceTimeline(row, contextPoint));
                ApplyButtonStyle(button);
            }
            var prefix = ReasoningEvidenceJumpPrefix(label, row, contextPoint);
            AddText("AI Reasoning Evidence Drillthrough Chip Text", chip.transform, Vector2.zero, Vector2.one, new Vector2(5f, 0f), new Vector2(-4f, 0f), Ellipsize($"{prefix}: {FirstNonEmpty(value, "--")}", Mathf.Max(6, Mathf.FloorToInt(width / 7f))), 6, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.96f, 0.92f, 1f, 0.86f);
            if (hasEvidenceAnchor || hasContextAnchor) SetRaycastTargetsExceptButtons(chip.transform);
        }

        private static string ReasoningEvidenceJumpPrefix(string label, AiReasoningEvidenceRowViewModel row, AiReasoningScorePointViewModel contextPoint)
        {
            var hasEvidenceAnchor = !string.IsNullOrWhiteSpace(ReasoningEvidenceTimelineAnchorId(row));
            var hasContextAnchor = contextPoint != null;
            return hasEvidenceAnchor ? $"{label}->EV" : hasContextAnchor ? $"{label}->TL" : label;
        }

        private static bool ReasoningHasEvidenceRows(AiReasoningScorePointViewModel point)
        {
            return ReasoningVisibleEvidenceRows(point).Length > 0;
        }

        private static AiReasoningEvidenceRowViewModel[] ReasoningVisibleEvidenceRows(AiReasoningScorePointViewModel point)
        {
            return (point?.evidenceRows ?? Array.Empty<AiReasoningEvidenceRowViewModel>())
                .Where((row) => row != null && !string.IsNullOrWhiteSpace(FirstNonEmpty(row.text, row.evidenceId, row.observationId, row.timelineEntryId, row.sourceId, row.sourceName, row.source)))
                .ToArray();
        }

        private static string ReasoningEvidenceDrillthroughLine(AiReasoningEvidenceRowViewModel row)
        {
            if (row == null) return "";
            var label = FirstNonEmpty(RecapEvidenceLabel(row.kind), row.reasonKey, "evidence");
            var source = FirstNonEmpty(row.sourceName, row.source, row.sourceId, row.evidenceId, row.observationId);
            var sourceLine = string.IsNullOrWhiteSpace(source) ? label : $"{label}@{source}";
            return $"{sourceLine} {FormatRecapDelta(row.appliedDelta)} trust {row.reliabilityScore * 100f:0}% risk {row.contaminationRisk * 100f:0}%";
        }

        private static string ReasoningEvidenceExpandedRowLine(AiReasoningEvidenceRowViewModel row)
        {
            if (row == null) return "--";
            var label = FirstNonEmpty(RecapEvidenceLabel(row.kind), row.reasonKey, "evidence");
            var source = FirstNonEmpty(row.sourceName, row.source, row.sourceId, row.evidenceId, row.observationId);
            var sourceLine = string.IsNullOrWhiteSpace(source) ? label : $"{label}@{source}";
            var sourceText = FirstNonEmpty(row.timelineText, row.text, row.evidenceId, row.observationId, row.sourceId);
            var stats = $"{FormatRecapDelta(row.appliedDelta)} trust {row.reliabilityScore * 100f:0}% risk {row.contaminationRisk * 100f:0}%";
            return string.Join(" | ", new[] { sourceLine, stats, sourceText }.Where((entry) => !string.IsNullOrWhiteSpace(entry)));
        }

        private void JumpToReasoningEvidenceTimeline(AiReasoningEvidenceRowViewModel row, AiReasoningScorePointViewModel contextPoint)
        {
            var anchorId = ReasoningEvidenceTimelineAnchorId(row);
            if (!string.IsNullOrWhiteSpace(anchorId))
            {
                activeInfoTimelineAnchorId = anchorId;
                ShowInfoDrawer("timeline");
                return;
            }
            JumpToReasoningScoreTrailTimeline(contextPoint);
        }

        private static string ReasoningEvidenceTimelineAnchorId(AiReasoningEvidenceRowViewModel row)
        {
            if (row == null) return "";
            if (!string.IsNullOrWhiteSpace(row.timelineEntryId)) return row.timelineEntryId;
            return row.timelineIndex >= 0 ? $"index:{row.timelineIndex}" : "";
        }

        private static string ReasoningEvidenceContextAnchorId(AiReasoningScorePointViewModel point)
        {
            return ReasoningTimelineAnchorId(point);
        }


        private void AddAiReasoningScoreTrailRow(Transform parent, AiReasoningScorePointViewModel point, float y, int index)
        {
            var row = point?.evidenceRows?.FirstOrDefault((entry) => entry != null);
            var up = row == null || row.appliedDelta >= 0f;
            var accent = row == null
                ? new Color(0.12f, 0.12f, 0.14f, 0.86f)
                : up ? new Color(0.22f, 0.070f, 0.060f, 0.88f) : new Color(0.040f, 0.13f, 0.12f, 0.88f);
            var panel = AddPanel("AI Reasoning Score Trail Row", parent, Vector2.zero, Vector2.zero, new Vector2(16f, y), new Vector2(568f, y + 21f), new Color(0.88f, 0.82f, 0.64f, 0.16f));
            AddFrame(panel.transform, "AI Reasoning Score Trail Row Frame", 0.55f, new Color(0.64f, 0.74f, 0.92f, 0.18f));
            AddImage("AI Reasoning Score Trail Row Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), accent);

            var meta = $"#{index + 1} {ReasoningPointScoreLine(point)} · {ReasoningEvidenceRowMeta(row)}";
            var body = ReasoningScorePointAuditLine(point);
            AddText("AI Reasoning Score Trail Meta", panel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 9f), new Vector2(-8f, -1f), Ellipsize(meta, 72), 9, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.82f, 0.90f, 1f, 0.86f);
            AddText("AI Reasoning Score Trail Body", panel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 0f), new Vector2(-8f, -10f), Ellipsize(body, 78), 8, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.91f, 0.78f, 0.84f);
        }


        private void AddAiReasoningEvidenceRow(Transform parent, AiReasoningEvidenceRowViewModel row, float y, string meta, string body)
        {
            var up = row == null || row.appliedDelta >= 0f;
            var accent = row == null
                ? new Color(0.12f, 0.12f, 0.14f, 0.86f)
                : up ? new Color(0.22f, 0.070f, 0.060f, 0.88f) : new Color(0.040f, 0.13f, 0.12f, 0.88f);
            var panel = AddPanel("AI Reasoning Evidence Row", parent, Vector2.zero, Vector2.zero, new Vector2(16f, y), new Vector2(568f, y + 28f), new Color(0.88f, 0.82f, 0.64f, 0.18f));
            AddFrame(panel.transform, "AI Reasoning Evidence Row Frame", 0.55f, new Color(0.64f, 0.74f, 0.92f, 0.18f));
            AddImage("AI Reasoning Evidence Row Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), accent);
            AddText("AI Reasoning Evidence Row Meta", panel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 14f), new Vector2(-314f, -1f), Ellipsize(meta, 26), 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.82f, 0.90f, 1f, 0.86f);
            AddText("AI Reasoning Evidence Row Body", panel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 2f), new Vector2(-10f, -14f), Ellipsize(body, 68), 9, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.91f, 0.78f, 0.88f);
        }

        private static AiReasoningScorePointViewModel LatestReasoningPoint(AiReasoningRecapViewModel item)
        {
            return item?.scoreTrail?.FirstOrDefault((entry) => entry != null);
        }

        private static string ReasoningLatestDecisionSnapshotLine(AiReasoningRecapViewModel item)
        {
            var point = LatestReasoningPoint(item);
            if (point == null) return FirstNonEmpty(item?.latestSummary, ReasoningEvidenceLine(item), "decision trail pending");
            var scoreSection = ReasoningAuditSection("score", ReasoningPointScoreLine(point));
            var auditLine = ReasoningScorePointAuditLine(point, 4);
            return string.Join(" | ", new[] { scoreSection, auditLine }.Where((entry) => !string.IsNullOrWhiteSpace(entry)));
        }

        private static string ReasoningScorePointAuditLine(AiReasoningScorePointViewModel point, int maxSections = 4)
        {
            if (point == null) return "";
            var sections = ReasoningScorePointAuditSections(point)
                .Take(Mathf.Max(1, maxSections))
                .ToArray();
            if (sections.Length > 0) return string.Join(" | ", sections);
            return FirstNonEmpty(point.summary, ReasoningEvidenceRowBody(point.evidenceRows?.FirstOrDefault((entry) => entry != null)));
        }

        private static string[] ReasoningScorePointAuditSections(AiReasoningScorePointViewModel point)
        {
            if (point == null) return Array.Empty<string>();
            var row = point.evidenceRows?.FirstOrDefault((entry) => entry != null);
            return new[]
            {
                ReasoningAuditSection("compare", ReasoningComparisonLine(point.comparisonTrace)),
                ReasoningAuditSection("source", ReasoningTimelineAnchorLine(point)),
                ReasoningAuditSection("continuity", ReasoningContinuityLine(point)),
                ReasoningAuditSection("evidence", row == null ? FirstNonEmpty(point.summary, "暂无证据行。") : ReasoningEvidenceRowBody(row))
            }
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .ToArray();
        }

        private static string ReasoningAuditSection(string label, string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "" : $"{label}: {value.Trim()}";
        }

        private static string ReasoningSignalScoreLabel(AiReasoningRecapViewModel item)
        {
            if (item == null || item.latestScore <= 0f) return "--";
            return $"{item.latestScore * 100f:0}%";
        }

        private static string ReasoningSignalEvidenceLabel(AiReasoningRecapViewModel item)
        {
            var point = LatestReasoningPoint(item);
            if (point != null) return $"{point.focusEvidenceCount:0}/{point.runnerUpEvidenceCount:0}";
            var snippets = item?.evidenceSnippets?.Count((entry) => entry != null && !string.IsNullOrWhiteSpace(entry.text)) ?? 0;
            return snippets > 0 ? $"{snippets}" : "--";
        }

        private static string ReasoningSignalConfidenceLabel(AiReasoningRecapViewModel item)
        {
            var point = LatestReasoningPoint(item);
            var band = FirstNonEmpty(point?.confidenceBand, point?.comparisonTrace?.confidenceBand);
            if (!string.IsNullOrWhiteSpace(band)) return ReasoningConfidenceBandLabel(band);
            return ReasoningRecapModeLabel(item?.latestMode).Replace("推理", "");
        }

        private static string ReasoningConfidenceBandLabel(string band)
        {
            if (string.IsNullOrWhiteSpace(band)) return "--";
            var normalized = band.ToLowerInvariant();
            if (normalized.Contains("clear")) return "清晰";
            if (normalized.Contains("lean")) return "倾向";
            if (normalized.Contains("close")) return "贴线";
            if (normalized.Contains("watch")) return "观察";
            return band;
        }

        private static Color ReasoningDeltaAccent(AiReasoningRecapViewModel item)
        {
            if (item == null || Mathf.Abs(item.scoreDelta) < 0.005f) return new Color(0.44f, 0.44f, 0.50f, 0.78f);
            return item.scoreDelta > 0f ? new Color(0.78f, 0.24f, 0.16f, 0.80f) : new Color(0.20f, 0.62f, 0.42f, 0.78f);
        }


        private static string ReasoningPointScoreLine(AiReasoningScorePointViewModel point)
        {
            if (point == null) return "score trail 待积累";
            return $"{point.focusScore * 100f:0}% / gap {point.scoreGap * 100f:0} · 证据 {point.focusEvidenceCount:0}/{point.runnerUpEvidenceCount:0}";
        }


        private static string ReasoningEvidenceRowMeta(AiReasoningEvidenceRowViewModel row)
        {
            if (row == null) return "暂无证据";
            return $"{RecapEvidenceLabel(row.kind)} {FormatRecapDelta(row.appliedDelta)} · 可信 {row.reliabilityScore * 100f:0}% · 污染 {row.contaminationRisk * 100f:0}%";
        }


        private static string ReasoningComparisonLine(AiReasoningComparisonTraceViewModel trace)
        {
            if (trace == null) return "";
            var pieces = new[]
            {
                trace.summary,
                ReasoningComparisonSideLine("focus", trace.focusName, trace.focusScore, trace.focusEvidenceCount, trace.focusReason, trace.focusEvidenceSummary),
                ReasoningComparisonSideLine("runner", trace.runnerUpName, trace.runnerUpScore, trace.runnerUpEvidenceCount, trace.runnerUpReason, trace.runnerUpEvidenceSummary),
                ReasoningComparisonMetaLine(trace)
            }
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .ToArray();
            return pieces.Length == 0 ? "" : $"compare: {string.Join(" | ", pieces)}";
        }

        private static string ReasoningComparisonSideLine(string label, string name, float score, float evidenceCount, string reason, string evidenceSummary)
        {
            var subject = FirstNonEmpty(name, label);
            var scoreText = score > 0f ? $"{score * 100f:0}%" : "";
            var evidenceText = $"e{Mathf.Max(0f, evidenceCount):0}";
            var header = string.Join(" ", new[] { label, subject, scoreText, evidenceText }.Where((entry) => !string.IsNullOrWhiteSpace(entry)));
            var detail = FirstNonEmpty(reason, evidenceSummary);
            return string.IsNullOrWhiteSpace(detail) ? header : $"{header}: {detail}";
        }

        private static string ReasoningComparisonMetaLine(AiReasoningComparisonTraceViewModel trace)
        {
            if (trace == null) return "";
            var gap = trace.scoreGap > 0f ? $"gap {trace.scoreGap * 100f:0}" : "";
            var band = string.IsNullOrWhiteSpace(trace.confidenceBand) ? "" : $"band {trace.confidenceBand}";
            var key = string.IsNullOrWhiteSpace(trace.reasonKey) ? "" : $"key {trace.reasonKey}";
            var visibility = trace.publicOnly ? "public" : "";
            return string.Join(" ", new[] { gap, band, key, visibility }.Where((entry) => !string.IsNullOrWhiteSpace(entry)));
        }


        private static string ReasoningTimelineAnchorLine(AiReasoningScorePointViewModel point)
        {
            if (point == null) return "";
            var hasDirectAnchor = point.timelineIndex >= 0 ||
                !string.IsNullOrWhiteSpace(point.timelineEntryId) ||
                !string.IsNullOrWhiteSpace(point.timelineText);
            if (!hasDirectAnchor)
            {
                var eventAnchor = ReasoningCrossDayEventAnchor(point);
                if (eventAnchor != null)
                {
                    var eventLabel = FirstNonEmpty(eventAnchor.timelineEntryId, eventAnchor.eventId, eventAnchor.mode, "cross-day event");
                    var eventText = FirstNonEmpty(eventAnchor.text, point.summary);
                    return string.IsNullOrWhiteSpace(eventText) ? eventLabel : $"{eventLabel}: {eventText}";
                }
            }
            var anchor = point.timelineIndex >= 0
                ? $"T#{point.timelineIndex + 1}"
                : FirstNonEmpty(point.timelineEntryId, "timeline");
            var text = FirstNonEmpty(point.timelineText, point.summary);
            return string.IsNullOrWhiteSpace(text) ? "" : $"{anchor}: {text}";
        }

        private static string ReasoningTimelineAnchorId(AiReasoningScorePointViewModel point)
        {
            if (point == null) return "";
            if (!string.IsNullOrWhiteSpace(point.timelineEntryId)) return point.timelineEntryId;
            if (point.timelineIndex >= 0) return $"index:{point.timelineIndex}";
            var eventAnchor = ReasoningCrossDayEventAnchor(point);
            return eventAnchor == null ? "" : FirstNonEmpty(eventAnchor.timelineEntryId, eventAnchor.eventId);
        }

        private static CrossDayEventAnchorViewModel ReasoningCrossDayEventAnchor(AiReasoningScorePointViewModel point)
        {
            return point?.crossDayStance?.currentEventAnchors?.FirstOrDefault((entry) =>
                entry != null &&
                !string.IsNullOrWhiteSpace(FirstNonEmpty(entry.timelineEntryId, entry.eventId, entry.mode, entry.text)));
        }

        private static CrossDayScoreTrailAnchorViewModel ReasoningCrossDayScoreAnchor(AiReasoningScorePointViewModel point)
        {
            return point?.crossDayStance?.currentScoreTrailAnchors?.FirstOrDefault((entry) =>
                entry != null &&
                !string.IsNullOrWhiteSpace(FirstNonEmpty(entry.trailId, entry.evidenceId, entry.reasonKey, entry.kind, entry.text)));
        }

        private static CrossDayEvidenceAnchorViewModel ReasoningCrossDayEvidenceAnchor(AiReasoningScorePointViewModel point)
        {
            return point?.crossDayStance?.currentEvidenceAnchors?.FirstOrDefault((entry) =>
                entry != null &&
                !string.IsNullOrWhiteSpace(FirstNonEmpty(entry.evidenceId, entry.kind, entry.text)));
        }

        private static string ReasoningCrossDayEventChipLine(CrossDayEventAnchorViewModel anchor)
        {
            if (anchor == null) return "";
            return FirstNonEmpty(anchor.timelineEntryId, anchor.eventId, anchor.mode, anchor.text);
        }

        private static string ReasoningCrossDayScoreChipLine(CrossDayScoreTrailAnchorViewModel anchor)
        {
            if (anchor == null) return "";
            var name = FirstNonEmpty(anchor.trailId, anchor.evidenceId, anchor.reasonKey, anchor.kind, anchor.text);
            return string.IsNullOrWhiteSpace(name) ? "" : $"{name} {FormatRecapDelta(anchor.appliedDelta)}";
        }

        private static string ReasoningCrossDayEvidenceChipLine(CrossDayEvidenceAnchorViewModel anchor)
        {
            if (anchor == null) return "";
            return FirstNonEmpty(anchor.evidenceId, anchor.kind, anchor.text);
        }

        private static string ReasoningCrossDayStanceBadgeLine(CrossDayStanceViewModel crossDay)
        {
            if (crossDay == null) return "";
            var mode = FirstNonEmpty(crossDay.continuity, crossDay.kind, "cross-day");
            var scoreLine = crossDay.previousScore > 0f || crossDay.currentScore > 0f
                ? $"{crossDay.previousScore * 100f:0}>{crossDay.currentScore * 100f:0}"
                : "";
            var evidenceDelta = Mathf.Abs(crossDay.evidenceDelta) >= 0.01f ? $"{FormatSignedCount(crossDay.evidenceDelta)}e" : "";
            var stanceLine = string.IsNullOrWhiteSpace(crossDay.previousStance) && string.IsNullOrWhiteSpace(crossDay.currentStance)
                ? ""
                : $"{FirstNonEmpty(crossDay.previousStance, "?")}>{FirstNonEmpty(crossDay.currentStance, "?")}";
            return string.Join(" ", new[] { mode, scoreLine, evidenceDelta, stanceLine }.Where((entry) => !string.IsNullOrWhiteSpace(entry)));
        }

        private static string FormatSignedCount(float value)
        {
            if (Mathf.Abs(value) < 0.01f) return "0";
            var sign = value > 0f ? "+" : "";
            return $"{sign}{value:0}";
        }

        private static string ReasoningContinuityLine(AiReasoningScorePointViewModel point)
        {
            if (point == null) return "";
            var crossDaySummary = point.crossDayStance?.summary ?? "";
            var crossDayAnchor = ReasoningCrossDayAnchorLine(point.crossDayStance);
            var claimLine = FirstNonEmpty(
                point.claimDisclosureRationale?.continuitySummary,
                point.claimDisclosureRationale?.continuityLine,
                point.claimDisclosureRationale?.spokenLine,
                point.claimDisclosureRationale?.line
            );
            var pieces = new[] { crossDaySummary, crossDayAnchor, claimLine }
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .ToArray();
            return pieces.Length == 0 ? "" : string.Join(" / ", pieces);
        }

        private static string ReasoningCrossDayAnchorLine(CrossDayStanceViewModel crossDay)
        {
            if (crossDay == null) return "";
            var eventAnchor = crossDay.currentEventAnchors?.FirstOrDefault((entry) => entry != null);
            var scoreAnchor = crossDay.currentScoreTrailAnchors?.FirstOrDefault((entry) => entry != null);
            var evidenceAnchor = crossDay.currentEvidenceAnchors?.FirstOrDefault((entry) => entry != null);
            var eventLabel = eventAnchor == null
                ? ""
                : $"event {FirstNonEmpty(eventAnchor.timelineEntryId, eventAnchor.eventId, eventAnchor.mode)}";
            var scoreName = scoreAnchor == null
                ? ""
                : FirstNonEmpty(scoreAnchor.trailId, scoreAnchor.evidenceId, scoreAnchor.reasonKey, scoreAnchor.kind);
            var scoreLabel = string.IsNullOrWhiteSpace(scoreName) ? "" : $"score {scoreName} {FormatRecapDelta(scoreAnchor.appliedDelta)}";
            var evidenceName = evidenceAnchor == null
                ? ""
                : FirstNonEmpty(evidenceAnchor.evidenceId, evidenceAnchor.kind, evidenceAnchor.text);
            var evidenceLabel = string.IsNullOrWhiteSpace(evidenceName) ? "" : $"evidence {evidenceName}";
            var pieces = new[] { eventLabel, scoreLabel, evidenceLabel }
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .ToArray();
            return pieces.Length == 0 ? "" : $"anchors: {string.Join(" / ", pieces)}";
        }

        private static string ReasoningEvidenceRowBody(AiReasoningEvidenceRowViewModel row)
        {
            if (row == null) return "";
            var source = string.IsNullOrWhiteSpace(row.sourceName) ? "" : $"{row.sourceName}：";
            return $"{source}{row.text}";
        }


        private static string ReasoningRecapMeta(AiReasoningRecapViewModel item)
        {
            if (item == null) return "推理轨迹";
            var mode = ReasoningRecapModeLabel(item.latestMode);
            if (item.latestScore <= 0f) return mode;
            return $"{mode} · {item.latestScore * 100f:0}% {ReasoningScoreDeltaLabel(item)}";
        }


        private static string ReasoningScoreDeltaLabel(AiReasoningRecapViewModel item)
        {
            if (item == null || Mathf.Abs(item.scoreDelta) < 0.005f) return "±0";
            return FormatRecapDelta(item.scoreDelta);
        }


        private static string ReasoningEvidenceLine(AiReasoningRecapViewModel item)
        {
            var latestRows = item?.scoreTrail?.FirstOrDefault()?.evidenceRows ?? Array.Empty<AiReasoningEvidenceRowViewModel>();
            var rows = latestRows
                .Where((entry) => entry != null && !string.IsNullOrWhiteSpace(entry.text))
                .Take(2)
                .Select((entry) => $"{RecapEvidenceLabel(entry.kind)} {FormatRecapDelta(entry.appliedDelta)}：{entry.text}")
                .ToArray();
            if (rows.Length > 0) return $"证据行：{string.Join(" / ", rows)}";

            var snippets = item?.evidenceSnippets ?? Array.Empty<AiReasoningEvidenceViewModel>();
            var evidence = snippets
                .Where((entry) => entry != null && !string.IsNullOrWhiteSpace(entry.text))
                .Take(2)
                .Select((entry) => $"{RecapEvidenceLabel(entry.kind)}：{entry.text}")
                .ToArray();
            return evidence.Length == 0 ? "" : $"证据：{string.Join(" / ", evidence)}";
        }


        private static string ReasoningRecapModeLabel(string mode)
        {
            if (mode == "public") return "公聊推理";
            if (mode == "whisper-in" || mode == "whisper-out") return "私聊推理";
            if (mode == "nomination-debate") return "提名推理";
            return string.IsNullOrWhiteSpace(mode) ? "推理轨迹" : mode;
        }


        private void AddAiRecapEvidenceChip(Transform parent, AiTrailViewModel entry, Vector2 bottomLeft, float width)
        {
            var delta = entry == null ? 0f : entry.appliedDelta;
            var up = delta >= 0f;
            var fill = entry == null
                ? new Color(0.10f, 0.070f, 0.045f, 0.88f)
                : up ? new Color(0.20f, 0.060f, 0.045f, 0.90f) : new Color(0.040f, 0.13f, 0.11f, 0.88f);
            var border = entry == null
                ? new Color(0.62f, 0.48f, 0.30f, 0.25f)
                : up ? new Color(0.82f, 0.28f, 0.16f, 0.42f) : new Color(0.20f, 0.62f, 0.42f, 0.38f);
            var chip = AddPanel("AI Recap Evidence Chip", parent, Vector2.zero, Vector2.zero, bottomLeft, bottomLeft + new Vector2(width, 30f), fill);
            AddFrame(chip.transform, "AI Recap Evidence Frame", 0.7f, border);
            AddImage("AI Recap Evidence Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), border);
            var label = entry == null ? "暂无证据链" : $"{RecapEvidenceLabel(entry.evidenceKind)} {FormatRecapDelta(delta)}";
            AddText("AI Recap Evidence Text", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 13f), new Vector2(-8f, -1f), Ellipsize(label, 14), 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            if (entry != null)
            {
                AddText("AI Recap Evidence Reason", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 2f), new Vector2(-8f, -16f), Ellipsize(entry.reason, 14), 9, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.91f, 0.78f, 0.74f);
            }
        }


        private static string RecapCandidateLine(AiRecapTargetViewModel[] targets)
        {
            var candidates = (targets ?? Array.Empty<AiRecapTargetViewModel>())
                .Where((target) => target != null && !string.IsNullOrWhiteSpace(target.name))
                .Take(3)
                .Select((target) => $"{target.name} {FirstNonEmpty(target.score, "--")}")
                .ToArray();
            return candidates.Length == 0 ? "候选目标：待积累" : $"候选目标：{string.Join(" / ", candidates)}";
        }


        private static Color RecapScoreColor(float score)
        {
            if (score >= 0.68f) return new Color(0.65f, 0.075f, 0.070f, 1f);
            if (score >= 0.50f) return new Color(0.80f, 0.42f, 0.10f, 1f);
            return new Color(0.12f, 0.44f, 0.26f, 1f);
        }


        private static string RecapRiskLabel(float score)
        {
            if (score >= 0.68f) return "高压";
            if (score >= 0.50f) return "观察";
            return "低压";
        }


        private string BuildRecapHeadline(AiRecapViewModel[] details)
        {
            var best = (details ?? Array.Empty<AiRecapViewModel>())
                .SelectMany((detail) => (detail?.targets ?? Array.Empty<AiRecapTargetViewModel>())
                    .Select((target) => new { observer = detail?.name, target }))
                .OrderByDescending((entry) => entry.target?.scoreValue ?? 0f)
                .FirstOrDefault();
            if (best == null || best.target == null) return "暂无重点目标";
            return $"最高关注：{FirstNonEmpty(best.target.name, "--")} {FirstNonEmpty(best.target.score, "--")}";
        }


        private string BuildRecapEvidenceSummary(AiRecapViewModel[] details)
        {
            var labels = (details ?? Array.Empty<AiRecapViewModel>())
                .SelectMany((detail) => detail?.targets ?? Array.Empty<AiRecapTargetViewModel>())
                .SelectMany((target) => target?.trail ?? Array.Empty<AiTrailViewModel>())
                .Select((entry) => RecapEvidenceLabel(entry?.evidenceKind))
                .Where((label) => !string.IsNullOrWhiteSpace(label))
                .Distinct()
                .Take(4)
                .ToArray();
            return labels.Length == 0 ? "证据链待积累" : $"证据：{string.Join(" / ", labels)}";
        }


        private static string RecapEvidenceLabel(string evidenceKind)
        {
            if (string.IsNullOrWhiteSpace(evidenceKind)) return "证据";
            if (evidenceKind.IndexOf("night", StringComparison.OrdinalIgnoreCase) >= 0) return "夜信";
            if (evidenceKind.IndexOf("claim", StringComparison.OrdinalIgnoreCase) >= 0) return "身份";
            if (evidenceKind.IndexOf("vote", StringComparison.OrdinalIgnoreCase) >= 0) return "投票";
            if (evidenceKind.IndexOf("whisper", StringComparison.OrdinalIgnoreCase) >= 0) return "私聊";
            if (evidenceKind.IndexOf("speech", StringComparison.OrdinalIgnoreCase) >= 0) return "发言";
            return "证据";
        }


        private static string FormatRecapDelta(float delta)
        {
            if (Mathf.Abs(delta) < 0.005f) return "0";
            var sign = delta > 0f ? "+" : "";
            return $"{sign}{delta * 100f:0}";
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


        private string BuildWhisperTabText()
        {
            var humanId = (vm.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player.human)?.id ?? "";
            var groups = new Dictionary<string, List<TimelineEntryViewModel>>();
            foreach (var item in vm.timeline ?? Array.Empty<TimelineEntryViewModel>())
            {
                if (item == null || !IsPrivateTimelineEntry(item.mode)) continue;
                var otherId = item.speakerId == humanId ? item.targetId : item.speakerId;
                if (string.IsNullOrWhiteSpace(otherId)) otherId = item.targetId;
                if (string.IsNullOrWhiteSpace(otherId)) continue;
                if (!groups.TryGetValue(otherId, out var list))
                {
                    list = new List<TimelineEntryViewModel>();
                    groups[otherId] = list;
                }
                list.Add(item);
            }

            if (groups.Count == 0)
            {
                var pending = vm.pendingProactiveWhispers ?? Array.Empty<ProactiveWhisperViewModel>();
                if (pending.Length == 0) return "暂无私聊。\n\n接受主动私聊或从玩家 token 打开私聊后，这里会按对象记录身份声称、夜间信息和待验证点。";
                return ClampTextLines(new[] { "待处理私聊", "────────" }.Concat(pending.Select((offer) => $"- {ProactiveOfferNotebookLine(offer)}")), 12, 54);
            }

            var lines = new List<string> { "私聊对象", "────────" };
            foreach (var group in groups.OrderBy((entry) => PlayerById(entry.Key)?.seat ?? 99).Take(8))
            {
                var player = PlayerById(group.Key);
                var entries = group.Value.OrderBy((entry) => entry.day).ThenBy((entry) => entry.night).ToArray();
                var claims = entries.Where(NotebookLooksLikeClaimEntry).Select(NotebookClaimRoleName).Where((entry) => !string.IsNullOrWhiteSpace(entry)).Distinct().ToArray();
                var reports = entries.Where(NotebookLooksLikeReportEntry).Select(NotebookReportSummary).Where((entry) => !string.IsNullOrWhiteSpace(entry)).Distinct().ToArray();
                var latest = entries.LastOrDefault();
                var label = player != null ? NotebookSeatLabel(player) : NameForPlayerId(group.Key);
                var claim = claims.Length > 0 ? $"已声称：{string.Join(" / ", claims.Take(2))}" : "未声称身份";
                var report = reports.Length > 0 ? $"首要信息：{reports[0]}" : "暂无夜间信息";
                var pending = latest != null && latest.speakerId == humanId ? "待对方回应" : "待验证";
                lines.Add($"{label}：{claim}；{report}；{pending}");
                if (latest != null) lines.Add($"  最近：{Ellipsize(latest.text, 46)}");
            }
            return ClampTextLines(lines, 18, 56);
        }


        private string BuildPublicSpeechTabText()
        {
            var entries = (vm.timeline ?? Array.Empty<TimelineEntryViewModel>())
                .Where((entry) => entry != null && IsPublicTimelineEntry(entry.mode))
                .TakeLast(12)
                .ToArray();
            if (entries.Length == 0) return "暂无公开发言。\n\n进入公聊后，这里会整理桌面可见的发言摘要。";

            var lines = new List<string> { "公开发言", "────────" };
            foreach (var item in entries)
            {
                var speaker = FirstNonEmpty(NameForPlayerId(item.speakerId), "发言者");
                var stamp = item.day > 0 ? $"D{item.day}" : item.night > 0 ? $"N{item.night}" : "时间线";
                var label = TimelineInformationLabel(item);
                lines.Add($"{stamp} · {speaker} · {label}");
                lines.Add($"  {Ellipsize(item.text, 58)}");
            }
            return ClampTextLines(lines, 20, 62);
        }


        private string BuildClueSummaryTabText()
        {
            var lines = new List<string> { "线索总结", "────────" };
            var ownInfo = (vm.privateInfo ?? Array.Empty<string>()).Where((entry) => !string.IsNullOrWhiteSpace(entry)).TakeLast(4).ToArray();
            if (ownInfo.Length > 0)
            {
                lines.Add("你的已知信息");
                foreach (var entry in ownInfo) lines.Add($"- {Ellipsize(entry.Trim(), 58)}");
                lines.Add("");
            }

            var claims = BuildNotebookClaimLines().Take(6).ToArray();
            lines.Add("已知身份 / 声称");
            if (claims.Length == 0) lines.Add("- 暂无身份声称。");
            else foreach (var entry in claims) lines.Add($"- {entry}");
            lines.Add("");

            var reports = BuildNotebookReportLines().TakeLast(5).ToArray();
            lines.Add("待验证信息");
            if (reports.Length == 0) lines.Add("- 暂无可验证报信。");
            else foreach (var entry in reports) lines.Add($"- {Ellipsize(entry, 58)}");
            lines.Add("");

            var social = vm.aiSocialClues ?? Array.Empty<string>();
            lines.Add("矛盾点 / 社交线索");
            if (social.Length == 0) lines.Add("- 暂无明显矛盾或社交线索。");
            else foreach (var clue in social.Take(4)) lines.Add($"- {Ellipsize(clue, 58)}");
            lines.Add("");

            lines.Add("下一步建议");
            lines.Add($"- {Ellipsize(FirstNonEmpty(vm?.phaseAdvance?.reason, vm?.phaseObjectiveHint, FlowNextLabel()), 58)}");
            return ClampTextLines(lines, 24, 62);
        }


        private string BuildWhisperTabSummaryText()
        {
            var privateCount = (vm.timeline ?? Array.Empty<TimelineEntryViewModel>()).Count((entry) => entry != null && IsPrivateTimelineEntry(entry.mode));
            var pending = vm.pendingProactiveWhispers?.Length ?? 0;
            return pending > 0 ? $"私聊记录 {privateCount}   待处理邀请 {pending}   接受后才显示具体内容" : $"私聊记录 {privateCount}   暂无待处理邀请";
        }


        private string BuildPublicSpeechTabSummaryText()
        {
            var publicCount = (vm.timeline ?? Array.Empty<TimelineEntryViewModel>()).Count((entry) => entry != null && IsPublicTimelineEntry(entry.mode));
            return publicCount > 0 ? $"公开发言 {publicCount}   仅玩家可见摘要" : "暂无公开发言";
        }


        private string ProactiveOfferNotebookLine(ProactiveWhisperViewModel offer)
        {
            if (offer == null) return "有人想私聊你。";
            var seat = offer.playerSeat > 0 ? $"{offer.playerSeat}号" : FirstNonEmpty(NameForPlayerId(offer.playerId), "有人");
            return $"{seat}：{FirstNonEmpty(offer.publicIntent, "想交换信息")}；接受后显示具体内容。";
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
            var ownCount = (vm.privateInfo ?? Array.Empty<string>()).Count((entry) => !string.IsNullOrWhiteSpace(entry));
            var claimCount = BuildNotebookClaimLines().Count();
            var reportCount = BuildNotebookReportLines().Count();
            return $"自己 {ownCount}   身份 {claimCount}   报信 {reportCount}";
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
            if (eventPanelOpen && infoDrawerTab == "public")
            {
                eventPanelOpen = false;
                ApplyAuxPanelVisibility();
            }
            else
            {
                ShowInfoDrawer("public");
            }
        }


        private void ShowInfoDrawer(string tab)
        {
            CloseMoreActionsPanel();
            infoDrawerTab = NormalizeInfoDrawerTab(tab);
            eventPanelOpen = true;
            timelinePanelOpen = false;
            if (infoDrawerTitle != null) infoDrawerTitle.text = InfoDrawerTitle();
            if (eventBody != null) eventBody.text = BuildInfoDrawerMainText();
            if (queueBody != null) queueBody.text = BuildInfoDrawerSubText();
            RenderInfoDrawerVisuals();
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


        private static string NormalizeInfoDrawerTab(string tab)
        {
            var normalized = string.IsNullOrWhiteSpace(tab) ? "events" : tab.Trim().ToLowerInvariant();
            if (normalized == "timeline") return "public";
            if (normalized == "intel" || normalized == "recap") return "clues";
            if (normalized == "whisper" || normalized == "private") return "whispers";
            if (normalized == "speech") return "public";
            if (normalized == "summary") return "clues";
            return normalized;
        }
    }
}
