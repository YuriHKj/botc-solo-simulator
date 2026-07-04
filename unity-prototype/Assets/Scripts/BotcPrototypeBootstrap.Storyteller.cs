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
            storytellerSignalRoot = AddPanel("Storyteller Signal Strip", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(36f, 558f), new Vector2(-36f, -116f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            storytellerQueueListRoot = AddPanel("Storyteller Queue List", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(32f, 108f), new Vector2(-784f, -154f), new Color(0.020f, 0.028f, 0.036f, 0.28f)).GetComponent<RectTransform>();
            storytellerDetailRoot = AddPanel("Storyteller Detail", storytellerPanel, Vector2.zero, Vector2.one, new Vector2(568f, 328f), new Vector2(-32f, -154f), new Color(0.020f, 0.028f, 0.036f, 0.30f)).GetComponent<RectTransform>();
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
                    queueCount == 0 ? "队列为空。阶段推进不会被 Storyteller 队列阻塞。" : $"待处理 {queueCount} 项。会按队首优先处理；当前面板只展示并提交队首行动。",
                    currentLine
                }, 2, 92);
            }

            RenderStorytellerSignalStrip(queueCount, queueCount <= 0 ? 0 : PageCount(queueCount, StorytellerQueuePageSize), action);
            RenderStorytellerQueueCards(queue, details);
            RenderStorytellerCurrentAction(action, details.FirstOrDefault((entry) => entry != null && entry.current));
            RenderStorytellerTargetPreview(action);
        }

        private void RenderStorytellerSignalStrip(int queueCount, int totalPages, RoleActionViewModel action)
        {
            if (storytellerSignalRoot == null) return;
            ClearChildren(storytellerSignalRoot);
            AddStorytellerSignalChip("Q", "Queue", StorytellerQueueCountSignalLabel(queueCount), 0f, 118f, new Color(0.040f, 0.052f, 0.064f, 0.74f), new Color(0.62f, 0.78f, 0.92f, 0.20f));
            AddStorytellerSignalChip("P", "Page", StorytellerQueuePageSignalLabel(queueCount, totalPages), 128f, 96f, new Color(0.054f, 0.042f, 0.028f, 0.76f), new Color(0.96f, 0.68f, 0.30f, 0.25f));
            AddStorytellerSignalChip("1", "Head", StorytellerCurrentRoleSignalLabel(action), 234f, 190f, new Color(0.070f, 0.046f, 0.030f, 0.76f), new Color(1f, 0.74f, 0.32f, 0.28f));
            AddStorytellerSignalChip("I", "Input", StorytellerCurrentInputSignalLabel(action), 434f, 182f, new Color(0.040f, 0.060f, 0.072f, 0.74f), new Color(0.52f, 0.76f, 1f, 0.22f));
            AddStorytellerSignalChip("T", "Target", StorytellerCurrentTargetSignalLabel(action), 626f, 164f, new Color(0.044f, 0.064f, 0.048f, 0.74f), new Color(0.76f, 0.92f, 0.52f, 0.22f));
        }

        private void AddStorytellerSignalChip(string icon, string label, string value, float x, float width, Color fill, Color border)
        {
            if (storytellerSignalRoot == null) return;
            var chip = AddPanel($"Storyteller Signal Chip {label}", storytellerSignalRoot, Vector2.zero, Vector2.zero, new Vector2(x, 0f), new Vector2(x + width, 26f), fill);
            AddFrame(chip.transform, "Storyteller Signal Chip Frame", 0.65f, border);
            var badge = AddImage("Storyteller Signal Badge", chip.transform, Vector2.zero, Vector2.zero, new Vector2(6f, 5f), new Vector2(22f, 21f), new Color(0.008f, 0.012f, 0.016f, 0.78f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            AddText("Storyteller Signal Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, 9, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("Storyteller Signal Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(28f, 13f), new Vector2(-6f, -3f), label, 8, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.70f, 0.78f, 0.82f, 0.76f);
            AddText("Storyteller Signal Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(28f, 2f), new Vector2(-6f, -14f), Ellipsize(value, Mathf.Max(4, Mathf.FloorToInt(width / 12f))), 10, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            SetRaycastTargetsExceptButtons(chip.transform);
        }

        private static string StorytellerQueueCountSignalLabel(int queueCount)
        {
            return queueCount <= 0 ? "0 items" : $"{queueCount} items";
        }

        private string StorytellerQueuePageSignalLabel(int queueCount, int totalPages)
        {
            return queueCount <= 0 ? "0/0" : $"{storytellerQueuePage + 1}/{Mathf.Max(1, totalPages)}";
        }

        private static string StorytellerCurrentRoleSignalLabel(RoleActionViewModel action)
        {
            if (action == null || !action.available) return "None";
            return Ellipsize(string.IsNullOrWhiteSpace(action.roleName) ? "Storyteller" : action.roleName, 16);
        }

        private static string StorytellerCurrentInputSignalLabel(RoleActionViewModel action)
        {
            if (action == null || !action.available) return "None";
            return StorytellerInputLabel(action.inputType);
        }

        private static string StorytellerCurrentTargetSignalLabel(RoleActionViewModel action)
        {
            if (action == null || !action.available) return "None";
            var optionCount = (action.options?.Length ?? 0) + (action.roleOptions?.Length ?? 0) + (action.modes?.Length ?? 0);
            if (optionCount > 0) return $"{optionCount} options";
            if (action.minTargetCount > 0 || action.maxTargetCount > 0) return $"{action.minTargetCount}-{action.maxTargetCount}";
            return "No target";
        }

        private void RenderStorytellerQueueCards(string[] queue, StorytellerQueueItemViewModel[] details)
        {
            if (storytellerQueueListRoot == null) return;
            ClearChildren(storytellerQueueListRoot);
            AddFrame(storytellerQueueListRoot, "Storyteller Queue Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));

            var count = Mathf.Max(queue?.Length ?? 0, details?.Length ?? 0);
            var totalPages = PageCount(count, StorytellerQueuePageSize);
            storytellerQueuePage = ClampPage(storytellerQueuePage, count, StorytellerQueuePageSize);
            var pageStart = storytellerQueuePage * StorytellerQueuePageSize;
            var visible = count == 0 ? 0 : Mathf.Min(StorytellerQueuePageSize, count - pageStart);
            var pageEnd = visible == 0 ? 0 : pageStart + visible;
            var rangeLabel = count == 0 ? "0 项" : $"第 {storytellerQueuePage + 1}/{totalPages} 页 · {pageStart + 1}-{pageEnd}/{count}";
            AddText("Storyteller Queue Label", storytellerQueueListRoot, Vector2.zero, Vector2.one, new Vector2(18f, 398f), new Vector2(-18f, -14f), "待处理队列", 18, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Storyteller Queue Count", storytellerQueueListRoot, Vector2.zero, Vector2.one, new Vector2(196f, 402f), new Vector2(-18f, -16f), rangeLabel, 12, TextAnchor.UpperRight, FontStyle.Normal).color = new Color(0.82f, 0.86f, 0.88f, 0.86f);
            if (count == 0)
            {
                AddText("Storyteller Queue Empty", storytellerQueueListRoot, Vector2.zero, Vector2.one, new Vector2(24f, 150f), new Vector2(-24f, -120f), "暂无队列。\n死亡触发、被动信息或特殊角色选择会出现在这里。", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

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
                var remainingAfterPage = Mathf.Max(0, count - pageEnd);
                var pagingNote = storytellerQueuePage == 0
                    ? $"队首在本页 · 后续 {remainingAfterPage} 项"
                    : $"浏览 {pageStart + 1}-{pageEnd} 项 · 仍从队首处理";
                AddText("Storyteller Queue Paging Note", storytellerQueueListRoot, Vector2.zero, Vector2.zero, new Vector2(122f, 16f), new Vector2(302f, 46f), pagingNote, 11, TextAnchor.MiddleCenter, FontStyle.Normal).color = new Color(0.82f, 0.86f, 0.88f, 0.80f);
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
            AddImage("Storyteller Target Header Wash", storytellerTargetRoot, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -58f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.050f));
            AddText("Storyteller Target Label", storytellerTargetRoot, Vector2.zero, Vector2.one, new Vector2(20f, 154f), new Vector2(-20f, -16f), "目标 / 输入预览", 17, TextAnchor.UpperLeft, FontStyle.Bold);

            if (action == null || !action.available)
            {
                AddText("Storyteller Target Empty", storytellerTargetRoot, Vector2.zero, Vector2.one, new Vector2(24f, 58f), new Vector2(-24f, -58f), "有队列后，这里会预览合法目标或输入类型。", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var optionCount = action.options?.Length ?? 0;
            var previewLimit = 6;
            var previewCount = Mathf.Min(optionCount, previewLimit);
            var overflowCount = Mathf.Max(0, optionCount - previewCount);
            var requirementLabel = optionCount == 0
                ? StorytellerInputLabel(action.inputType)
                : $"目标 {action.minTargetCount}-{action.maxTargetCount}";
            var badge = AddPanel("Storyteller Target Summary Badge", storytellerTargetRoot, Vector2.zero, Vector2.zero, new Vector2(516f, 166f), new Vector2(696f, 194f), optionCount == 0 ? new Color(0.090f, 0.060f, 0.030f, 0.80f) : new Color(0.025f, 0.070f, 0.095f, 0.82f));
            AddFrame(badge.transform, "Storyteller Target Summary Badge Frame", 0.7f, optionCount == 0 ? new Color(0.94f, 0.66f, 0.30f, 0.24f) : new Color(0.42f, 0.76f, 1f, 0.26f));
            AddText("Storyteller Target Summary Badge Text", badge.transform, Vector2.zero, Vector2.one, new Vector2(8f, 0f), new Vector2(-8f, 0f), optionCount == 0 ? requirementLabel : $"{previewCount}/{optionCount} 预览", 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = optionCount == 0 ? new Color(1f, 0.80f, 0.42f, 0.98f) : new Color(0.72f, 0.90f, 1f, 0.98f);
            var helper = optionCount == 0
                ? "无需在这里选择目标；进入表单后按提示处理。"
                : overflowCount > 0
                    ? $"预览前 {previewCount} 个合法目标，另有 {overflowCount} 个在完整表单内选择。"
                    : "这些是当前合法目标；点击处理当前进入完整表单。";
            AddText("Storyteller Target Helper", storytellerTargetRoot, Vector2.zero, Vector2.zero, new Vector2(20f, 132f), new Vector2(500f, 156f), Ellipsize(helper, 58), 12, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.88f, 0.84f);

            if (optionCount == 0)
            {
                var text = action.inputType == "info"
                    ? "信息型行动：无需额外选择，处理后会把私有信息写入主视角可见信息。"
                    : $"此行动需要 {StorytellerInputLabel(action.inputType)}。点击“处理当前”进入完整表单。";
                var info = AddPanel("Storyteller Target Info Card", storytellerTargetRoot, Vector2.zero, Vector2.zero, new Vector2(20f, 26f), new Vector2(696f, 120f), new Color(0.008f, 0.016f, 0.024f, 0.70f));
                AddFrame(info.transform, "Storyteller Target Info Card Frame", 0.7f, new Color(0.86f, 0.58f, 0.26f, 0.16f));
                AddText("Storyteller Target Info", info.transform, Vector2.zero, Vector2.one, new Vector2(18f, 16f), new Vector2(-18f, -16f), ClampTextBlock(text, 3, 62), 15, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var options = action.options.Take(previewLimit).ToArray();
            for (var i = 0; i < options.Length; i++)
            {
                var option = options[i];
                var col = i % 3;
                var row = i / 3;
                var x = 18f + col * 210f;
                var y = 112f - row * 56f;
                var alive = option.alive;
                var card = AddPanel($"Storyteller Target {i}", storytellerTargetRoot, Vector2.zero, Vector2.zero, new Vector2(x, y - 42f), new Vector2(x + 192f, y), new Color(0.010f, 0.017f, 0.026f, 0.74f));
                AddImage("Target Preview Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), alive ? new Color(0.42f, 0.76f, 1f, 0.34f) : new Color(0.78f, 0.38f, 0.32f, 0.34f));
                AddFrame(card.transform, "Target Preview Frame", 0.7f, alive ? new Color(0.42f, 0.76f, 1f, 0.16f) : new Color(0.94f, 0.50f, 0.34f, 0.18f));
                var name = string.IsNullOrWhiteSpace(option.name) ? option.id : option.name;
                AddText("Target Name", card.transform, Vector2.zero, Vector2.one, new Vector2(12f, 16f), new Vector2(-12f, -4f), Ellipsize(name, 16), 14, TextAnchor.MiddleLeft, FontStyle.Bold);
                AddText("Target Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(12f, 1f), new Vector2(-12f, -23f), alive ? "存活目标" : "死亡目标", 11, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.88f, 0.82f);
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
            dialogueBody.text = "已提交：使用当前合法默认选择处理队首行动。";
        }
    }
}
