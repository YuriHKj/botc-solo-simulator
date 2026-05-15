using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private void BuildStorytellerPanel()
        {
            storytellerPanel = AddPanel("Storyteller Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-660f, -350f), new Vector2(660f, 350f), new Color(0.005f, 0.012f, 0.020f, 0.93f)).GetComponent<RectTransform>();
            AddFrame(storytellerPanel, "Storyteller Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.36f));
            AddImage("Storyteller Header Wash", storytellerPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -92f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            storytellerTitle = AddText("Storyteller Title", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(34f, 644f), new Vector2(-34f, -16f), "Storyteller 队列", 31, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Storyteller Hint", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(1100f, 654f), new Vector2(-150f, -22f), "", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddToolActionButton("关", "关闭", storytellerPanel, new Vector2(1250f, 658f), new Vector2(104f, 34f), CloseStorytellerPanel, true);
            storytellerBody = AddText("Storyteller Body", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(36f, 594f), new Vector2(-36f, -78f), "", 16, TextAnchor.UpperLeft, FontStyle.Normal);
            storytellerBody.color = new Color(0.86f, 0.90f, 0.92f, 0.94f);
            storytellerQueueListRoot = AddPanel("Storyteller Queue List", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(32f, 108f), new Vector2(-784f, -118f), new Color(0.020f, 0.028f, 0.036f, 0.28f)).GetComponent<RectTransform>();
            storytellerDetailRoot = AddPanel("Storyteller Detail", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(568f, 328f), new Vector2(-32f, -118f), new Color(0.020f, 0.028f, 0.036f, 0.30f)).GetComponent<RectTransform>();
            storytellerTargetRoot = AddPanel("Storyteller Targets", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(568f, 108f), new Vector2(-32f, -374f), new Color(0.020f, 0.028f, 0.036f, 0.26f)).GetComponent<RectTransform>();
            AddButton("处理当前", storytellerPanel, new Vector2(792f, 48f), new Vector2(138f, 36f), () => OpenActionFormPanel("storyteller-action"));
            AddButton("自动处理", storytellerPanel, new Vector2(946f, 48f), new Vector2(138f, 36f), SendStorytellerAuto);
            AddButton("刷新", storytellerPanel, new Vector2(1102f, 48f), new Vector2(100f, 36f), RenderStorytellerPanel);
            AddButton("关闭", storytellerPanel, new Vector2(1210f, 48f), new Vector2(98f, 36f), CloseStorytellerPanel);
            storytellerPanel.gameObject.SetActive(false);
        }

        private void CloseStorytellerPanel()
        {
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(false);
            ApplyModalBackdropVisibility();
        }

        private void OpenStorytellerPanel()
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            CloseActionFormPanel();
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            if (handbookPanel != null) handbookPanel.gameObject.SetActive(false);
            storytellerQueuePage = 0;
            RenderStorytellerPanel();
            ShowModalPanel(storytellerPanel);
        }

        private void RenderStorytellerPanel()
        {
            if (storytellerTitle != null) storytellerTitle.text = "Storyteller 队列";
            var queue = vm.storytellerQueue ?? Array.Empty<string>();
            var details = vm.storytellerQueueDetails ?? Array.Empty<StorytellerQueueItemViewModel>();
            var action = vm.pendingStorytellerAction;
            var queueCount = Mathf.Max(queue.Length, details.Length);
            storytellerQueuePage = ClampPage(storytellerQueuePage, queueCount, StorytellerQueuePageSize);

            if (storytellerBody != null)
            {
                var currentLine = action != null && action.available
                    ? $"当前：{action.roleName} · {StorytellerActionTypeLabel(action.type)} · {StorytellerInputLabel(action.inputType)}"
                    : $"当前：{(string.IsNullOrWhiteSpace(action?.reason) ? "没有待处理行动" : action.reason)}";
                storytellerBody.text = ClampTextLines(new[]
                {
                    queueCount == 0 ? "队列为空。阶段推进不会被 Storyteller 队列阻塞。" : $"待处理 {queueCount} 项。JS Core 会按队首优先处理；当前面板只展示并提交队首行动。",
                    currentLine
                }, 2, 92);
            }

            RenderStorytellerQueueCards(queue, details);
            RenderStorytellerCurrentAction(action, details.FirstOrDefault((entry) => entry != null && entry.current));
            RenderStorytellerTargetPreview(action);
        }

        private void RenderStorytellerQueueCards(string[] queue, StorytellerQueueItemViewModel[] details)
        {
            if (storytellerQueueListRoot == null) return;
            ClearChildren(storytellerQueueListRoot);
            AddFrame(storytellerQueueListRoot, "Storyteller Queue Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));

            var count = Mathf.Max(queue?.Length ?? 0, details?.Length ?? 0);
            var totalPages = PageCount(count, StorytellerQueuePageSize);
            storytellerQueuePage = ClampPage(storytellerQueuePage, count, StorytellerQueuePageSize);
            AddText("Storyteller Queue Label", storytellerQueueListRoot, Vector2.zero, Vector2.one, new Vector2(18f, 398f), new Vector2(-18f, -14f), "待处理队列", 18, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Storyteller Queue Count", storytellerQueueListRoot, Vector2.zero, Vector2.one, new Vector2(220f, 402f), new Vector2(-18f, -16f), count == 0 ? "0 项" : $"第 {storytellerQueuePage + 1}/{totalPages} 页 · {count} 项", 12, TextAnchor.UpperRight, FontStyle.Normal).color = new Color(0.82f, 0.86f, 0.88f, 0.86f);
            if (count == 0)
            {
                AddText("Storyteller Queue Empty", storytellerQueueListRoot, Vector2.zero, Vector2.one, new Vector2(24f, 150f), new Vector2(-24f, -120f), "暂无队列。\n死亡触发、被动信息或特殊角色选择会出现在这里。", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var pageStart = storytellerQueuePage * StorytellerQueuePageSize;
            var visible = Mathf.Min(StorytellerQueuePageSize, count - pageStart);
            for (var i = 0; i < visible; i++)
            {
                var absoluteIndex = pageStart + i;
                var detail = details != null && absoluteIndex < details.Length ? details[absoluteIndex] : null;
                var prompt = detail != null && !string.IsNullOrWhiteSpace(detail.prompt)
                    ? detail.prompt
                    : queue != null && absoluteIndex < queue.Length ? queue[absoluteIndex] : "待处理行动";
                var roleName = detail != null && !string.IsNullOrWhiteSpace(detail.roleName) ? detail.roleName : "Storyteller";
                var phase = detail != null && !string.IsNullOrWhiteSpace(detail.phaseLabel) ? detail.phaseLabel : "";
                var active = detail?.current ?? (absoluteIndex == 0);
                var y = 360f - i * 78f;
                var cardColor = active ? new Color(0.13f, 0.072f, 0.030f, 0.86f) : new Color(0.009f, 0.016f, 0.024f, 0.72f);
                var card = AddPanel($"Storyteller Queue Card {absoluteIndex}", storytellerQueueListRoot, Vector2.zero, Vector2.zero, new Vector2(16f, y - 66f), new Vector2(388f, y), cardColor);
                AddFrame(card.transform, "Queue Card Frame", 0.8f, active ? new Color(1f, 0.70f, 0.30f, 0.42f) : new Color(0.86f, 0.58f, 0.26f, 0.16f));
                AddText("Queue Card Index", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 26f), new Vector2(-320f, -6f), active ? "当前" : $"{absoluteIndex + 1}", 14, TextAnchor.MiddleLeft, FontStyle.Bold).color = active ? new Color(1f, 0.78f, 0.36f, 1f) : new Color(0.82f, 0.78f, 0.68f, 0.92f);
                AddText("Queue Card Role", card.transform, Vector2.zero, Vector2.one, new Vector2(74f, 34f), new Vector2(-16f, -6f), Ellipsize(roleName, 18), 15, TextAnchor.MiddleLeft, FontStyle.Bold);
                AddText("Queue Card Prompt", card.transform, Vector2.zero, Vector2.one, new Vector2(74f, 14f), new Vector2(-16f, -30f), Ellipsize(prompt, 36), 12, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.86f, 0.88f, 0.88f, 0.86f);
                AddText("Queue Card Phase", card.transform, Vector2.zero, Vector2.one, new Vector2(74f, 0f), new Vector2(-16f, -48f), string.IsNullOrWhiteSpace(phase) ? "队首优先" : phase, 11, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.72f, 0.78f, 0.82f, 0.72f);
            }

            if (totalPages > 1)
            {
                AddText("Storyteller Queue Paging Note", storytellerQueueListRoot, Vector2.zero, Vector2.zero, new Vector2(136f, 16f), new Vector2(288f, 46f), storytellerQueuePage == 0 ? "队首在本页" : "浏览后续，处理仍从队首开始", 11, TextAnchor.MiddleCenter, FontStyle.Normal).color = new Color(0.82f, 0.86f, 0.88f, 0.80f);
                var prev = AddToolActionButton("上", "上一页", storytellerQueueListRoot, new Vector2(70f, 32f), new Vector2(96f, 28f), () => ChangeStorytellerQueuePage(-1), true);
                var home = AddToolActionButton("首", "队首", storytellerQueueListRoot, new Vector2(344f, 32f), new Vector2(86f, 28f), () => ChangeStorytellerQueuePage(-999), true);
                var next = AddToolActionButton("下", "下一页", storytellerQueueListRoot, new Vector2(442f, 32f), new Vector2(96f, 28f), () => ChangeStorytellerQueuePage(1), true);
                SetToolButtonEnabled(prev, storytellerQueuePage > 0);
                SetToolButtonEnabled(home, storytellerQueuePage > 0);
                SetToolButtonEnabled(next, storytellerQueuePage < totalPages - 1);
            }
        }

        private void ChangeStorytellerQueuePage(int delta)
        {
            var queueCount = Mathf.Max(vm?.storytellerQueue?.Length ?? 0, vm?.storytellerQueueDetails?.Length ?? 0);
            storytellerQueuePage = delta <= -999 ? 0 : ClampPage(storytellerQueuePage + delta, queueCount, StorytellerQueuePageSize);
            RenderStorytellerPanel();
        }

        private void RenderStorytellerCurrentAction(RoleActionViewModel action, StorytellerQueueItemViewModel currentDetail)
        {
            if (storytellerDetailRoot == null) return;
            ClearChildren(storytellerDetailRoot);
            AddFrame(storytellerDetailRoot, "Storyteller Detail Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.22f));
            AddText("Storyteller Detail Label", storytellerDetailRoot, Vector2.zero, Vector2.one, new Vector2(20f, 174f), new Vector2(-20f, -16f), "当前行动", 18, TextAnchor.UpperLeft, FontStyle.Bold);

            if (action == null || !action.available)
            {
                var reason = string.IsNullOrWhiteSpace(action?.reason) ? "当前没有可处理的 Storyteller 行动。" : action.reason;
                AddText("Storyteller Detail Empty", storytellerDetailRoot, Vector2.zero, Vector2.one, new Vector2(26f, 58f), new Vector2(-26f, -58f), reason, 16, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var role = RoleForId(action.roleId);
            AddRoleTokenButton(storytellerDetailRoot, action.roleId, string.IsNullOrWhiteSpace(action.roleName) ? role?.name : action.roleName, role?.category ?? "", role?.team ?? "", new Vector2(80f, 92f), 70f, true, () => { });
            AddText("Storyteller Current Role", storytellerDetailRoot, Vector2.zero, Vector2.one, new Vector2(156f, 136f), new Vector2(-24f, -42f), $"{action.roleName} · {StorytellerActionTypeLabel(action.type)}", 20, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Storyteller Current Meta", storytellerDetailRoot, Vector2.zero, Vector2.one, new Vector2(156f, 106f), new Vector2(-24f, -74f), $"{StorytellerInputLabel(action.inputType)}  ·  目标 {action.minTargetCount}-{action.maxTargetCount}  ·  可选 {(action.options?.Length ?? 0) + (action.roleOptions?.Length ?? 0) + (action.modes?.Length ?? 0)}", 14, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.88f, 0.86f, 0.78f, 0.94f);
            var phase = currentDetail != null && !string.IsNullOrWhiteSpace(currentDetail.phaseLabel) ? currentDetail.phaseLabel : $"D{vm.day}/N{vm.night}";
            AddText("Storyteller Current Phase", storytellerDetailRoot, Vector2.zero, Vector2.one, new Vector2(156f, 80f), new Vector2(-24f, -102f), $"来源：{phase}  ·  队首优先", 13, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.88f, 0.90f);
            AddText("Storyteller Current Prompt", storytellerDetailRoot, Vector2.zero, Vector2.one, new Vector2(156f, 24f), new Vector2(-24f, -130f), ClampTextBlock(action.prompt, 3, 58), 14, TextAnchor.UpperLeft, FontStyle.Normal);
        }

        private void RenderStorytellerTargetPreview(RoleActionViewModel action)
        {
            if (storytellerTargetRoot == null) return;
            ClearChildren(storytellerTargetRoot);
            AddFrame(storytellerTargetRoot, "Storyteller Target Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.18f));
            AddText("Storyteller Target Label", storytellerTargetRoot, Vector2.zero, Vector2.one, new Vector2(20f, 154f), new Vector2(-20f, -16f), "目标 / 输入预览", 17, TextAnchor.UpperLeft, FontStyle.Bold);

            if (action == null || !action.available)
            {
                AddText("Storyteller Target Empty", storytellerTargetRoot, Vector2.zero, Vector2.one, new Vector2(24f, 58f), new Vector2(-24f, -58f), "有队列后，这里会预览合法目标或输入类型。", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            if ((action.options?.Length ?? 0) == 0)
            {
                var text = action.inputType == "info"
                    ? "信息型行动：无需额外选择，处理后会把私有信息写入主视角可见信息。"
                    : $"此行动需要 {StorytellerInputLabel(action.inputType)}。点击“处理当前”进入完整表单。";
                AddText("Storyteller Target Info", storytellerTargetRoot, Vector2.zero, Vector2.one, new Vector2(24f, 60f), new Vector2(-24f, -56f), ClampTextBlock(text, 3, 58), 15, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var options = action.options.Take(6).ToArray();
            for (var i = 0; i < options.Length; i++)
            {
                var option = options[i];
                var col = i % 3;
                var row = i / 3;
                var x = 18f + col * 210f;
                var y = 122f - row * 62f;
                var card = AddPanel($"Storyteller Target {i}", storytellerTargetRoot, Vector2.zero, Vector2.zero, new Vector2(x, y - 44f), new Vector2(x + 192f, y), new Color(0.010f, 0.017f, 0.026f, 0.74f));
                AddFrame(card.transform, "Target Preview Frame", 0.7f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
                var name = string.IsNullOrWhiteSpace(option.name) ? option.id : option.name;
                AddText("Target Name", card.transform, Vector2.zero, Vector2.one, new Vector2(12f, 18f), new Vector2(-12f, -4f), Ellipsize(name, 16), 14, TextAnchor.MiddleLeft, FontStyle.Bold);
                AddText("Target Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(12f, 2f), new Vector2(-12f, -24f), option.alive ? "存活目标" : "死亡目标", 11, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.88f, 0.82f);
            }

            if ((action.options?.Length ?? 0) > options.Length)
            {
                AddText("Target More", storytellerTargetRoot, Vector2.zero, Vector2.one, new Vector2(496f, 18f), new Vector2(-18f, -154f), $"+{action.options.Length - options.Length}", 13, TextAnchor.MiddleRight, FontStyle.Bold);
            }
        }

        private static string StorytellerInputLabel(string inputType)
        {
            if (inputType == "info") return "信息确认";
            if (inputType == "player-target") return "选择玩家";
            if (inputType == "player-role") return "玩家 + 身份";
            if (inputType == "role") return "选择身份";
            if (inputType == "question") return "是/否问题";
            if (inputType == "guesses") return "猜测输入";
            if (inputType == "charge-or-targets") return "模式 / 目标";
            return string.IsNullOrWhiteSpace(inputType) ? "默认选择" : inputType;
        }

        private static string StorytellerActionTypeLabel(string type)
        {
            if (type == "ravenkeeper-info") return "守鸦人信息";
            if (type == "sage-info") return "贤者信息";
            if (type == "moonchild-choice") return "月之子选择";
            if (type == "klutz-choice") return "呆瓜选择";
            if (type == "barber-swap") return "理发师换位";
            return string.IsNullOrWhiteSpace(type) ? "Storyteller 行动" : type;
        }

        private void SendStorytellerAuto()
        {
            var action = vm.pendingStorytellerAction;
            if (action == null || !action.available)
            {
                dialogueTitle.text = "Storyteller 队列";
                dialogueBody.text = string.IsNullOrWhiteSpace(action?.reason) ? "当前没有待处理 Storyteller 行动。" : action.reason;
                return;
            }
            SendUnityAction("storyteller-action");
            dialogueTitle.text = "Storyteller 队列已发送";
            dialogueBody.text = "已发送给 JS Core：使用当前合法默认选择处理队首行动。";
        }
    }
}
