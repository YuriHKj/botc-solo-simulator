using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private void BuildActionFormPanel()
        {
            actionFormPanel = AddPanel("Action Form Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-760f, -410f), new Vector2(760f, 410f), new Color(0.005f, 0.012f, 0.020f, 0.93f)).GetComponent<RectTransform>();
            AddFrame(actionFormPanel, "Action Form Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.38f));
            AddImage("Action Form Header Wash", actionFormPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -92f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            actionFormTitle = AddText("Action Form Title", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(34f, 764f), new Vector2(-34f, -16f), "行动表单", 31, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Action Form Hint", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(1300f, 774f), new Vector2(-150f, -22f), "", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddToolActionButton("关", "关闭", actionFormPanel, new Vector2(1450f, 778f), new Vector2(104f, 34f), CloseActionFormPanel, true);
            AddImage("Action Form Summary Wash", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(32f, 650f), new Vector2(-32f, -100f), new Color(0.020f, 0.028f, 0.036f, 0.28f));
            actionFormBody = AddText("Action Form Body", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(52f, 662f), new Vector2(-52f, -114f), "", 16, TextAnchor.UpperLeft, FontStyle.Normal);
            actionOptionRoot = AddPanel("Action Option Root", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(32f, 116f), new Vector2(-32f, -208f), new Color(0.020f, 0.028f, 0.036f, 0.24f)).GetComponent<RectTransform>();
            AddFrame(actionOptionRoot, "Action Option Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            actionFormStatusText = AddText("Action Form Status", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(38f, 46f), new Vector2(-560f, -738f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            actionFormStatusText.color = new Color(0.86f, 0.90f, 0.92f, 0.94f);
            actionFormAutoButton = AddToolActionButton("自", "自动合法", actionFormPanel, new Vector2(1060f, 54f), new Vector2(150f, 38f), () => SendActiveActionFormAuto());
            actionFormSubmitButton = AddToolActionButton("发", "确认发送", actionFormPanel, new Vector2(1232f, 54f), new Vector2(150f, 38f), () => SendActionFormComposed());
            AddToolActionButton("关", "关闭", actionFormPanel, new Vector2(1390f, 54f), new Vector2(112f, 38f), CloseActionFormPanel);
            actionFormPanel.gameObject.SetActive(false);
            BuildActionTargetBar();
        }

        private void BuildActionTargetBar()
        {
            actionTargetBar = AddPanel("Action Target Bar", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-760f, 18f), new Vector2(760f, 236f), new Color(0.004f, 0.010f, 0.016f, 0.90f)).GetComponent<RectTransform>();
            actionTargetBar.gameObject.SetActive(false);
        }

        private string FirstAvailableActionFormId()
        {
            var forms = vm?.actionForms ?? Array.Empty<ActionFormViewModel>();
            return forms.FirstOrDefault((form) => form != null && form.available)?.id
                ?? forms.FirstOrDefault((form) => form != null)?.id
                ?? "night-action";
        }

        private void RenderGrimoireActionTargetHint(Transform tokenRoot, PlayerViewModel player)
        {
            var form = ActiveActionForm();
            if (!ActionFormCanPickGrimoireTarget(form)) return;
            var legal = IsLegalActionTarget(player?.id);
            var selected = !string.IsNullOrWhiteSpace(player?.id) && selectedActionTargetIds.Contains(player.id);
            if (!legal) return;

            var halo = AddImage("Action Target Halo", tokenRoot, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-84f, -152f), new Vector2(84f, 16f), selected ? new Color(1f, 0.74f, 0.26f, 0.58f) : new Color(0.38f, 0.72f, 1f, 0.28f));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;
            AddTokenStatusBadge(tokenRoot, selected ? "选" : "可", new Vector2(70f, -42f), selected ? new Color(0.22f, 0.12f, 0.030f, 0.96f) : new Color(0.025f, 0.080f, 0.13f, 0.92f), selected ? new Color(1f, 0.78f, 0.30f, 0.66f) : new Color(0.42f, 0.76f, 1f, 0.48f));
        }

        private bool TryToggleGrimoireActionTarget(PlayerViewModel player)
        {
            var form = ActiveActionForm();
            if (!ActionFormUsesGrimoireTargets(form) || actionTargetBar == null || !actionTargetBar.gameObject.activeSelf) return false;
            if (!ActionFormCanPickGrimoireTarget(form))
            {
                dialogueTitle.text = form?.title ?? "行动目标";
                dialogueBody.text = "当前模式不需要在魔典上选择目标，可以直接确认或切换模式。";
                return true;
            }
            if (!IsLegalActionTarget(player?.id))
            {
                dialogueTitle.text = form?.title ?? "行动目标";
                dialogueBody.text = "这个 token 不是当前行动的合法目标。合法目标会在大魔典上显示“可”。";
                return true;
            }
            ToggleActionFormTarget(player.id);
            return true;
        }

        private ActionFormViewModel ActiveActionForm()
        {
            return (vm.actionForms ?? Array.Empty<ActionFormViewModel>()).FirstOrDefault((entry) => entry != null && entry.id == activeActionFormId);
        }

        private void EnsureActiveActionFormStillValid()
        {
            if (string.IsNullOrWhiteSpace(activeActionFormId)) return;
            var form = ActiveActionForm();
            var valid =
                form != null
                && form.available
                && (activeActionFormId != "night-action" || vm?.phase == "night")
                && (activeActionFormId != "day-action" || vm?.phase == "day");
            if (valid) return;
            CloseActionFormPanel();
        }

        private void OpenActionFormPanel(string formId)
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(false);
            if (handbookPanel != null) handbookPanel.gameObject.SetActive(false);
            activeActionFormId = formId;
            selectedActionTargetIds.Clear();
            selectedActionRoleId = "";
            selectedActionModeId = "";
            actionTargetPage = 0;
            actionRolePage = 0;
            actionQuestionInput = null;
            var form = ActiveActionForm();
            if (ActionFormUsesGrimoireTargets(form))
            {
                if (actionFormPanel != null) actionFormPanel.gameObject.SetActive(false);
                bottomDockOpen = false;
                ApplyBottomDockVisibility();
                RenderActionTargetBar();
                if (actionTargetBar != null) actionTargetBar.gameObject.SetActive(true);
                RenderGrimoire();
                ApplyModalBackdropVisibility();
                return;
            }
            if (actionTargetBar != null) actionTargetBar.gameObject.SetActive(false);
            RenderActionFormPanel();
            ShowModalPanel(actionFormPanel);
        }

        private void CloseActionFormPanel()
        {
            var hadGrimoireTargetMode = actionTargetBar != null && actionTargetBar.gameObject.activeSelf;
            if (actionFormPanel != null) actionFormPanel.gameObject.SetActive(false);
            if (actionTargetBar != null) actionTargetBar.gameObject.SetActive(false);
            var hadTargets = selectedActionTargetIds.Count > 0;
            selectedActionTargetIds.Clear();
            selectedActionRoleId = "";
            selectedActionModeId = "";
            activeActionFormId = "";
            actionQuestionInput = null;
            SetButtonSuggested(actionFormSubmitButton, false);
            SetButtonSuggested(actionFormAutoButton, false);
            if (hadTargets || hadGrimoireTargetMode) RenderGrimoire();
            ApplyModalBackdropVisibility();
        }

        private void RenderActionFormPanel()
        {
            if (actionOptionRoot != null)
            {
                ClearChildren(actionOptionRoot);
                AddFrame(actionOptionRoot, "Action Option Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            }
            var form = ActiveActionForm();
            if (form == null)
            {
                if (actionFormTitle != null) actionFormTitle.text = "行动表单";
                if (actionFormBody != null) actionFormBody.text = "当前 viewmodel 尚未导出这个行动表单。";
                if (actionFormStatusText != null) actionFormStatusText.text = "";
                SetActionFormButtonStates(null);
                return;
            }
            if (actionFormTitle != null) actionFormTitle.text = form.title ?? "行动表单";
            if (actionFormBody != null)
            {
                actionFormBody.text = form.available
                    ? ClampTextLines(new[]
                    {
                        $"{form.roleName} · {ActionInputLabel(form.inputType)} · {ActionRequirementLabel(form)}",
                        string.IsNullOrWhiteSpace(form.prompt) ? "JS Core 已导出行动，等待选择。" : form.prompt,
                        ActionFormReadinessLine(form)
                    }, 3, 118)
                    : ClampTextBlock($"当前不可用：{form.reason}", 3, 118);
            }
            if (!form.available || actionOptionRoot == null)
            {
                if (actionFormStatusText != null)
                {
                    actionFormStatusText.text = ClampTextBlock(ActionFormStatus(form), 2, 88);
                    actionFormStatusText.color = ActionFormStatusColor(form);
                }
                SetActionFormButtonStates(form);
                return;
            }
            actionQuestionInput = null;
            RenderActionSubmitChecklist(form);
            var y = 462f;
            if (NeedsMode(form))
            {
                AddActionSectionHeader("Mode", "模式", ActionFormInstruction(form), y);
                RenderActionModeChoices(form, y - 38f);
                y -= 86f;
            }
            if (NeedsTargets(form))
            {
                AddActionSectionHeader("Target", "目标", ActionTargetHint(form), y);
                if (ActionFormUsesGrimoireTargets(form)) RenderActionGrimoireTargetPrompt(form, y - 38f);
                else RenderActionTargetChoices(form, y - 38f);
                y -= NeedsRole(form) ? 154f : (form.options?.Length ?? 0) > ActionChoicePageSize ? 150f : 132f;
            }
            if (NeedsRole(form))
            {
                AddActionSectionHeader("Role", "身份", "选择身份 token 后再确认发送。", y);
                RenderActionRoleChoices(form, y - 44f, NeedsTargets(form));
                y -= NeedsTargets(form) ? 156f : 190f;
            }
            if (NeedsQuestion(form))
            {
                AddActionSectionHeader("Question", "问题", "写下要交给 JS Core 的是/否问题。", y);
                actionQuestionInput = AddInputField("Action Question Input", actionOptionRoot, new Vector2(24f, Mathf.Max(28f, y - 74f)), new Vector2(1078f, Mathf.Max(68f, y - 28f)), "输入要提交给 JS Core 的问题");
            }
            if (!NeedsMode(form) && !NeedsTargets(form) && !NeedsRole(form) && !NeedsQuestion(form))
            {
                AddText("Info Action", actionOptionRoot, Vector2.zero, Vector2.one, new Vector2(28f, 202f), new Vector2(-374f, -170f), "这是信息型行动，无需额外输入。\n点击确认发送或自动合法选择后，JS Core 会写入结果。", 17, TextAnchor.MiddleCenter, FontStyle.Normal);
            }
            if (actionFormStatusText != null)
            {
                actionFormStatusText.text = ClampTextBlock(ActionFormStatus(form), 2, 88);
                actionFormStatusText.color = ActionFormStatusColor(form);
            }
            SetActionFormButtonStates(form);
        }

        private void RenderActionSubmitChecklist(ActionFormViewModel form)
        {
            if (actionOptionRoot == null || form == null) return;
            var panel = AddPanel("Action Submit Checklist", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(1120f, 24f), new Vector2(1424f, 472f), new Color(0.004f, 0.010f, 0.017f, 0.62f));
            AddFrame(panel.transform, "Action Checklist Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            AddImage("Action Checklist Header Wash", panel.transform, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -58f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.060f));
            AddText("Action Checklist Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 398f), new Vector2(-18f, -14f), "提交检查", 19, TextAnchor.UpperLeft, FontStyle.Bold);

            var y = 356f;
            if (NeedsTargets(form))
            {
                var modeSkipsTargets = ActionFormModeSkipsTargetsInstance(form);
                var ok = modeSkipsTargets || selectedActionTargetIds.Count >= form.minTargetCount;
                var countText = modeSkipsTargets
                    ? "当前模式不需要目标"
                    : $"{selectedActionTargetIds.Count}/{Mathf.Max(1, form.minTargetCount)} 已选";
                AddActionChecklistRow(panel.transform, "目标", countText, ok, y);
                y -= 48f;
            }
            if (NeedsRole(form))
            {
                AddActionChecklistRow(panel.transform, "身份", string.IsNullOrWhiteSpace(selectedActionRoleId) ? "尚未选择" : RoleNameForId(selectedActionRoleId), !string.IsNullOrWhiteSpace(selectedActionRoleId), y);
                y -= 48f;
            }
            if (NeedsMode(form))
            {
                var hasModes = (form.modes?.Length ?? 0) > 0;
                AddActionChecklistRow(panel.transform, "模式", string.IsNullOrWhiteSpace(selectedActionModeId) ? (hasModes ? "未选则使用默认" : "无需选择") : ActionModeLabel(form, selectedActionModeId), true, y);
                y -= 48f;
            }
            if (NeedsQuestion(form))
            {
                AddActionChecklistRow(panel.transform, "问题", "留空则使用默认问题", true, y);
                y -= 48f;
            }
            if (!NeedsTargets(form) && !NeedsRole(form) && !NeedsMode(form) && !NeedsQuestion(form))
            {
                AddActionChecklistRow(panel.transform, "输入", "无需额外输入", true, y);
                y -= 48f;
            }

            AddText("Action Current Label", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 118f), new Vector2(-18f, -308f), "当前选择", 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddText("Action Current Value", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 58f), new Vector2(-18f, -338f), ClampTextBlock(ActionFormSelectionText(form), 3, 26), 13, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.86f, 0.90f, 0.92f, 0.92f);
            if (selectedActionTargetIds.Count > 0)
            {
                AddToolActionButton("清", "清空目标", panel.transform, new Vector2(232f, 26f), new Vector2(112f, 28f), ClearActionFormTargets, true);
            }
        }

        private void AddActionChecklistRow(Transform parent, string label, string value, bool ok, float y)
        {
            var row = AddPanel($"Checklist Row {label}", parent, Vector2.zero, Vector2.zero, new Vector2(16f, y - 34f), new Vector2(288f, y), ok ? new Color(0.020f, 0.040f, 0.032f, 0.56f) : new Color(0.070f, 0.035f, 0.020f, 0.62f));
            AddFrame(row.transform, "Checklist Row Frame", 0.7f, ok ? new Color(0.45f, 0.78f, 0.56f, 0.24f) : new Color(1f, 0.58f, 0.24f, 0.26f));
            var badge = AddImage("Checklist Badge", row.transform, Vector2.zero, Vector2.zero, new Vector2(10f, 7f), new Vector2(34f, 31f), ok ? new Color(0.08f, 0.26f, 0.15f, 0.92f) : new Color(0.30f, 0.13f, 0.04f, 0.92f));
            AddFrame(badge.transform, "Checklist Badge Frame", 0.6f, ok ? new Color(0.55f, 0.92f, 0.60f, 0.32f) : new Color(1f, 0.72f, 0.36f, 0.32f));
            AddText("Checklist Badge Text", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, ok ? "好" : "缺", 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = ok ? new Color(0.72f, 1f, 0.74f, 1f) : new Color(1f, 0.76f, 0.36f, 1f);
            AddText("Checklist Label", row.transform, Vector2.zero, Vector2.one, new Vector2(44f, 10f), new Vector2(-170f, -4f), label, 13, TextAnchor.MiddleLeft, FontStyle.Bold);
            AddText("Checklist Value", row.transform, Vector2.zero, Vector2.one, new Vector2(96f, 10f), new Vector2(-10f, -4f), Ellipsize(value, 18), 12, TextAnchor.MiddleRight, FontStyle.Normal).color = new Color(0.86f, 0.90f, 0.92f, 0.90f);
        }

        private void AddActionSectionHeader(string key, string title, string hint, float y)
        {
            if (actionOptionRoot == null) return;
            const float optionRootHeight = 496f;
            var topOffset = -(optionRootHeight - (y + 8f));
            AddText($"{key} Label", actionOptionRoot, Vector2.zero, Vector2.one, new Vector2(22f, y - 18f), new Vector2(-22f, topOffset), title, 16, TextAnchor.UpperLeft, FontStyle.Bold);
            if (!string.IsNullOrWhiteSpace(hint))
            {
                AddText($"{key} Hint", actionOptionRoot, Vector2.zero, Vector2.one, new Vector2(100f, y - 16f), new Vector2(-370f, topOffset), Ellipsize(hint, 82), 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.88f, 0.86f);
            }
        }

        private void AddActionTargetCard(ActionOptionViewModel option, Vector2 center, bool selected, UnityEngine.Events.UnityAction onClick)
        {
            var size = new Vector2(196f, 38f);
            var card = AddPanel($"Action Target {option.id}", actionOptionRoot, Vector2.zero, Vector2.zero, center - size * 0.5f, center + size * 0.5f, selected ? new Color(0.15f, 0.082f, 0.032f, 0.90f) : new Color(0.010f, 0.017f, 0.026f, 0.74f));
            AddImage("Target Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(4f, 0f), selected ? new Color(1f, 0.74f, 0.30f, 0.84f) : new Color(0.70f, 0.50f, 0.28f, 0.25f));
            AddFrame(card.transform, "Target Card Frame", 0.8f, selected ? new Color(1f, 0.70f, 0.30f, 0.48f) : new Color(0.86f, 0.58f, 0.26f, 0.16f));
            var image = card.GetComponent<Image>();
            image.raycastTarget = true;
            var button = card.AddComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(onClick);
            ApplyButtonStyle(button);

            var name = string.IsNullOrWhiteSpace(option.name) ? option.id : option.name;
            var prefix = selected ? "✓ " : "";
            AddText("Target Name", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 14f), new Vector2(-12f, -4f), Ellipsize(prefix + name, 17), 14, TextAnchor.MiddleLeft, FontStyle.Bold).color = selected ? new Color(1f, 0.82f, 0.38f, 1f) : new Color(0.95f, 0.89f, 0.76f, 0.98f);
            var meta = option.seat > 0 ? $"{option.seat}号" : "目标";
            meta += option.alive ? " · 存活" : " · 死亡/不可用";
            AddText("Target Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 0f), new Vector2(-12f, -22f), Ellipsize(meta, 24), 11, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.88f, 0.82f);
        }

        private void RenderActionTargetChoices(ActionFormViewModel form, float y)
        {
            var options = form.options ?? Array.Empty<ActionOptionViewModel>();
            actionTargetPage = ClampPage(actionTargetPage, options.Length, ActionChoicePageSize);
            var pageStart = actionTargetPage * ActionChoicePageSize;
            var pageOptions = options.Skip(pageStart).Take(ActionChoicePageSize).ToArray();
            for (var i = 0; i < pageOptions.Length; i++)
            {
                var option = pageOptions[i];
                var col = i % 5;
                var row = i / 5;
                var selected = selectedActionTargetIds.Contains(option.id);
                AddActionTargetCard(option, new Vector2(112f + col * 216f, y - row * 48f), selected, () => ToggleActionFormTarget(option.id));
            }
            RenderActionChoicePager("Target", actionTargetPage, PageCount(options.Length, ActionChoicePageSize), y - 106f, () => ChangeActionTargetPage(-1), () => ChangeActionTargetPage(1));
        }

        private void RenderActionRoleChoices(ActionFormViewModel form, float y, bool compact)
        {
            RenderActionRoleSelector(actionOptionRoot, new Vector2(28f, y - 118f), new Vector2(760f, y), compact ? 58f : 70f);
        }

        private void RenderActionGrimoireTargetPrompt(ActionFormViewModel form, float y)
        {
            var panel = AddPanel("Action Grimoire Target Prompt", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(28f, y - 82f), new Vector2(760f, y), new Color(0.010f, 0.017f, 0.026f, 0.68f));
            AddFrame(panel.transform, "Grimoire Target Prompt Frame", 0.8f, new Color(0.42f, 0.76f, 1f, 0.22f));
            AddText("Grimoire Target Prompt Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 42f), new Vector2(-18f, -8f), "在大魔典上点击带“可”的 token", 16, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.76f, 0.90f, 1f, 0.98f);
            var selected = selectedActionTargetIds.Count == 0 ? "尚未选择目标" : string.Join(" / ", selectedActionTargetIds.Select(NameForPlayerId));
            AddText("Grimoire Target Prompt Body", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 12f), new Vector2(-18f, -42f), $"当前：{selected}", 14, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.90f, 0.86f, 0.76f, 0.94f);
        }

        private void RenderActionRoleSelector(Transform parent, Vector2 offsetMin, Vector2 offsetMax, float tokenSize)
        {
            if (parent == null) return;
            var form = ActiveActionForm();
            var panel = AddPanel("Action Role Selector", parent, Vector2.zero, Vector2.zero, offsetMin, offsetMax, new Color(0.010f, 0.017f, 0.026f, 0.68f));
            AddFrame(panel.transform, "Action Role Selector Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.22f));
            var width = Mathf.Abs(offsetMax.x - offsetMin.x);
            var height = Mathf.Abs(offsetMax.y - offsetMin.y);
            var selected = !string.IsNullOrWhiteSpace(selectedActionRoleId);
            var role = RoleForId(selectedActionRoleId);
            if (selected)
            {
                AddRoleTokenButton(panel.transform, selectedActionRoleId, RoleNameForId(selectedActionRoleId), role?.category ?? "", role?.team ?? "", new Vector2(70f, height * 0.52f), tokenSize, true, OpenActionFormRolePicker);
            }
            else
            {
                AddBlankRoleTokenButton(panel.transform, "选择", new Vector2(70f, height * 0.52f), tokenSize, false, OpenActionFormRolePicker);
            }
            var roleCount = ActionRoleChoices(form).Count();
            var label = selected ? RoleNameForId(selectedActionRoleId) : "未选择身份";
            AddText("Action Role Selector Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(142f, height - 42f), new Vector2(-20f, -10f), label, 17, TextAnchor.UpperLeft, FontStyle.Bold).color = selected ? new Color(1f, 0.82f, 0.38f, 1f) : new Color(0.95f, 0.89f, 0.76f, 0.96f);
            AddText("Action Role Selector Body", panel.transform, Vector2.zero, Vector2.one, new Vector2(142f, height - 76f), new Vector2(-20f, -48f), $"从 {roleCount} 个身份 token 中选择，规则仍由 JS Core 校验。", 13, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.88f, 0.86f);
            AddToolActionButton("角", selected ? "重选身份" : "选择身份", panel.transform, new Vector2(Mathf.Max(230f, width - 120f), 28f), new Vector2(154f, 32f), OpenActionFormRolePicker, true);
            if (selected)
            {
                AddToolActionButton("清", "清空", panel.transform, new Vector2(Mathf.Max(90f, width - 278f), 28f), new Vector2(92f, 32f), () =>
                {
                    selectedActionRoleId = "";
                    RenderActiveActionSurface();
                }, true);
            }
        }

        private void RenderActionTargetBar()
        {
            if (actionTargetBar == null) return;
            ClearChildren(actionTargetBar);
            var form = ActiveActionForm();
            if (form == null)
            {
                actionTargetBar.gameObject.SetActive(false);
                return;
            }

            var image = actionTargetBar.GetComponent<Image>();
            if (image != null)
            {
                image.color = new Color(0.004f, 0.010f, 0.016f, 0.90f);
                image.raycastTarget = false;
            }
            AddFrame(actionTargetBar, "Action Target Bar Frame", 1.0f, new Color(0.92f, 0.62f, 0.28f, 0.34f));
            AddImage("Action Target Bar Header Wash", actionTargetBar, new Vector2(0f, 0.65f), Vector2.one, Vector2.zero, Vector2.zero, new Color(0.76f, 0.48f, 0.18f, 0.060f));
            AddText("Action Target Bar Title", actionTargetBar, Vector2.zero, Vector2.one, new Vector2(26f, 174f), new Vector2(-620f, -12f), form.title ?? "行动目标", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Action Target Bar Hint", actionTargetBar, Vector2.zero, Vector2.one, new Vector2(26f, 132f), new Vector2(-690f, -58f), "在大魔典上点击带“可”的玩家 token 选择目标。已选目标会显示“选”。", 16, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.88f, 0.92f, 0.94f, 0.94f);
            var selectedTargets = selectedActionTargetIds.Count == 0 ? "未选择目标" : string.Join(" / ", selectedActionTargetIds.Select(NameForPlayerId));
            actionTargetBarStatusText = AddText("Action Target Bar Status", actionTargetBar, Vector2.zero, Vector2.one, new Vector2(26f, 72f), new Vector2(-690f, -102f), $"目标：{selectedTargets}    {ActionFormStatus(form)}", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            actionTargetBarStatusText.color = ActionFormStatusColor(form);

            if (NeedsMode(form))
            {
                var modes = form.modes ?? Array.Empty<ActionModeViewModel>();
                for (var i = 0; i < modes.Length && i < 3; i++)
                {
                    var mode = modes[i];
                    var modeId = mode.id;
                    var button = AddToolActionButton("式", ActionModeLabel(mode), actionTargetBar, new Vector2(860f + i * 134f, 178f), new Vector2(124f, 32f), () => SelectActionFormMode(modeId), true);
                    if (selectedActionModeId == mode.id) AddFrame(button.transform, "Action Target Mode Selected", 1.1f, new Color(1f, 0.76f, 0.32f, 0.62f));
                }
            }

            if (NeedsRole(form)) RenderActionRoleSelector(actionTargetBar, new Vector2(852f, 42f), new Vector2(1182f, 154f), 52f);
            if (selectedActionTargetIds.Count > 0) AddToolActionButton("清", "清空目标", actionTargetBar, new Vector2(1248f, 172f), new Vector2(116f, 34f), ClearActionFormTargets, true);
            var auto = AddToolActionButton("自", "自动合法", actionTargetBar, new Vector2(1374f, 172f), new Vector2(120f, 34f), SendActiveActionFormAuto, true);
            var submit = AddToolActionButton("发", "确认发送", actionTargetBar, new Vector2(1308f, 96f), new Vector2(128f, 40f), SendActionFormComposed);
            AddToolActionButton("关", "关闭", actionTargetBar, new Vector2(1444f, 96f), new Vector2(96f, 40f), CloseActionFormPanel);
            SetToolButtonEnabled(auto, form.available);
            SetToolButtonEnabled(submit, CanSubmitActionForm(form));
            SetRaycastTargetsExceptButtons(actionTargetBar);
        }

        private void RenderActionModeChoices(ActionFormViewModel form, float y)
        {
            var modes = form.modes ?? Array.Empty<ActionModeViewModel>();
            for (var i = 0; i < modes.Length && i < 4; i++)
            {
                var mode = modes[i];
                var selected = selectedActionModeId == mode.id;
                var modeId = mode.id;
                AddActionModeCard(mode, new Vector2(112f + i * 202f, y), selected, () => SelectActionFormMode(modeId));
            }
        }

        private void AddActionModeCard(ActionModeViewModel mode, Vector2 center, bool selected, UnityEngine.Events.UnityAction onClick)
        {
            var size = new Vector2(184f, 34f);
            var card = AddPanel($"Action Mode {mode.id}", actionOptionRoot, Vector2.zero, Vector2.zero, center - size * 0.5f, center + size * 0.5f, selected ? new Color(0.15f, 0.082f, 0.032f, 0.90f) : new Color(0.010f, 0.017f, 0.026f, 0.74f));
            AddImage("Mode Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(4f, 0f), selected ? new Color(1f, 0.74f, 0.30f, 0.84f) : new Color(0.70f, 0.50f, 0.28f, 0.25f));
            AddFrame(card.transform, "Mode Card Frame", 0.8f, selected ? new Color(1f, 0.70f, 0.30f, 0.48f) : new Color(0.86f, 0.58f, 0.26f, 0.16f));
            var image = card.GetComponent<Image>();
            image.raycastTarget = true;
            var button = card.AddComponent<Button>();
            button.targetGraphic = image;
            button.onClick.AddListener(onClick);
            ApplyButtonStyle(button);
            var badge = selected ? "选" : "式";
            AddText("Mode Badge", card.transform, Vector2.zero, Vector2.one, new Vector2(12f, 2f), new Vector2(-146f, -2f), badge, 12, TextAnchor.MiddleCenter, FontStyle.Bold).color = selected ? new Color(1f, 0.82f, 0.38f, 1f) : new Color(0.80f, 0.72f, 0.60f, 0.88f);
            AddText("Mode Label", card.transform, Vector2.zero, Vector2.one, new Vector2(42f, 2f), new Vector2(-12f, -2f), Ellipsize(ActionModeLabel(mode), 15), 14, TextAnchor.MiddleLeft, FontStyle.Bold).color = selected ? new Color(1f, 0.82f, 0.38f, 1f) : new Color(0.95f, 0.89f, 0.76f, 0.98f);
        }

        private void RenderActionChoicePager(string name, int page, int totalPages, float y, UnityEngine.Events.UnityAction prev, UnityEngine.Events.UnityAction next)
        {
            if (actionOptionRoot == null || totalPages <= 1) return;
            AddText($"{name} Page Label", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(834f, y - 14f), new Vector2(982f, y + 12f), $"第 {page + 1}/{totalPages} 页", 12, TextAnchor.MiddleRight, FontStyle.Normal);
            AddButton("‹", actionOptionRoot, new Vector2(1010f, y), new Vector2(40f, 26f), prev);
            AddButton("›", actionOptionRoot, new Vector2(1058f, y), new Vector2(40f, 26f), next);
        }

        private void ChangeActionTargetPage(int delta)
        {
            var count = ActiveActionForm()?.options?.Length ?? 0;
            actionTargetPage = ClampPage(actionTargetPage + delta, count, ActionChoicePageSize);
            RenderActionFormPanel();
        }

        private void ChangeActionRolePage(int delta)
        {
            var form = ActiveActionForm();
            var count = form == null ? 0 : ActionRoleChoices(form).Count();
            actionRolePage = ClampPage(actionRolePage + delta, count, ActionChoicePageSize);
            RenderActionFormPanel();
        }

        private void RenderActiveActionSurface()
        {
            if (actionTargetBar != null && actionTargetBar.gameObject.activeSelf)
            {
                RenderActionTargetBar();
                return;
            }
            RenderActionFormPanel();
        }

        private bool ActionFormUsesGrimoireTargets(ActionFormViewModel form)
        {
            if (form == null || !form.available || !NeedsTargets(form) || (form.options?.Length ?? 0) == 0) return false;
            var playerIds = new HashSet<string>((vm.players ?? Array.Empty<PlayerViewModel>())
                .Where((player) => player != null && !string.IsNullOrWhiteSpace(player.id))
                .Select((player) => player.id));
            return playerIds.Count > 0
                && (form.options ?? Array.Empty<ActionOptionViewModel>()).All((option) => option != null && !string.IsNullOrWhiteSpace(option.id) && playerIds.Contains(option.id));
        }

        private bool ActionFormCanPickGrimoireTarget(ActionFormViewModel form)
        {
            return ActionFormUsesGrimoireTargets(form) && !ActionFormModeSkipsTargetsInstance(form);
        }

        private bool IsLegalActionTarget(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return false;
            var form = ActiveActionForm();
            return (form?.options ?? Array.Empty<ActionOptionViewModel>()).Any((option) => option != null && option.id == playerId);
        }

        private static bool NeedsTargets(ActionFormViewModel form)
        {
            var type = form?.inputType ?? "";
            return (form?.options?.Length ?? 0) > 0 && (type.Contains("target") || type == "player-role" || type == "guesses" || type == "charge-or-targets");
        }

        private static bool NeedsRole(ActionFormViewModel form)
        {
            var type = form?.inputType ?? "";
            return type == "role" || type == "player-role" || type == "guesses";
        }

        private static bool NeedsMode(ActionFormViewModel form)
        {
            return (form?.modes?.Length ?? 0) > 0 || (form?.inputType ?? "") == "charge-or-targets";
        }

        private static bool NeedsQuestion(ActionFormViewModel form)
        {
            return (form?.inputType ?? "") == "question";
        }

        private IEnumerable<ActionRoleOptionViewModel> ActionRoleChoices(ActionFormViewModel form)
        {
            var direct = form?.roleOptions ?? Array.Empty<ActionRoleOptionViewModel>();
            if (direct.Length > 0) return direct;
            return (vm.scriptHandbook?.roles ?? Array.Empty<ScriptRoleViewModel>())
                .Select((role) => new ActionRoleOptionViewModel { id = role.id, name = role.name, category = role.category, team = role.team });
        }

        private static string ActionInputLabel(string inputType)
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

        private static string ActionModeLabel(ActionModeViewModel mode)
        {
            if (mode == null) return "";
            return string.IsNullOrWhiteSpace(mode.label) ? mode.id : mode.label;
        }

        private static string ActionModeLabel(ActionFormViewModel form, string modeId)
        {
            if (string.IsNullOrWhiteSpace(modeId)) return "";
            var mode = (form?.modes ?? Array.Empty<ActionModeViewModel>()).FirstOrDefault((entry) => entry != null && entry.id == modeId);
            return string.IsNullOrWhiteSpace(mode?.label) ? modeId : mode.label;
        }

        private static string ActionRequirementLabel(ActionFormViewModel form)
        {
            if (form == null) return "";
            if (NeedsTargets(form)) return $"目标 {form.minTargetCount}-{form.maxTargetCount}";
            if (NeedsRole(form)) return "需要身份";
            if (NeedsQuestion(form)) return "需要问题";
            if (NeedsMode(form)) return "需要模式";
            return "无需额外输入";
        }

        private static string ActionTargetHint(ActionFormViewModel form)
        {
            if (form == null) return "";
            if (form.maxTargetCount > 1) return $"可多选，至少 {form.minTargetCount} 个，最多 {form.maxTargetCount} 个。";
            return "选择一个合法目标；完整规则仍由 JS Core 校验。";
        }

        private string ActionFormInstruction(ActionFormViewModel form)
        {
            if (form == null) return "";
            if (!form.available) return form.reason ?? "";
            if (form.inputType == "guesses") return "选择一个玩家和一个身份后确认，Unity 会提交 guess 给 JS Core。";
            if (form.inputType == "player-role") return "选择目标和身份后确认。";
            if (form.inputType == "role") return "选择一个身份后确认。";
            if (form.inputType == "question") return "输入问题后确认。";
            if (form.inputType == "charge-or-targets") return "选择模式；若模式需要目标，再选择玩家后确认。";
            if (form.inputType == "info") return "信息型行动无需额外输入。";
            return $"需要 {form.minTargetCount}-{form.maxTargetCount} 项选择。";
        }

        private string ActionFormReadinessLine(ActionFormViewModel form)
        {
            if (form == null) return "当前：未选择";
            return CanSubmitActionForm(form)
                ? $"就绪：{ActionFormSelectionText(form)}"
                : $"待补：{ActionFormStatus(form)}";
        }

        private string ActionFormSelectionText(ActionFormViewModel form)
        {
            var parts = new List<string>();
            if (selectedActionTargetIds.Count > 0) parts.Add($"目标 {string.Join(" / ", selectedActionTargetIds.Select(NameForPlayerId))}");
            if (!string.IsNullOrWhiteSpace(selectedActionRoleId)) parts.Add($"身份 {RoleNameForId(selectedActionRoleId)}");
            if (!string.IsNullOrWhiteSpace(selectedActionModeId)) parts.Add($"模式 {ActionModeLabel(form, selectedActionModeId)}");
            if (form != null && NeedsQuestion(form) && actionQuestionInput != null && !string.IsNullOrWhiteSpace(actionQuestionInput.text)) parts.Add($"问题 {actionQuestionInput.text}");
            return parts.Count == 0 ? "未选择" : string.Join("；", parts);
        }

        private bool ActionFormModeSkipsTargetsInstance(ActionFormViewModel form)
        {
            return form != null
                && form.inputType == "charge-or-targets"
                && (selectedActionModeId == "charge" || selectedActionModeId == "none");
        }

        private bool CanSubmitActionForm(ActionFormViewModel form)
        {
            if (form == null || !form.available) return false;
            if (form.inputType == "guesses") return selectedActionTargetIds.Count > 0 && !string.IsNullOrWhiteSpace(selectedActionRoleId);
            var modeSkipsTargets = ActionFormModeSkipsTargetsInstance(form);
            if (NeedsTargets(form) && !modeSkipsTargets && selectedActionTargetIds.Count < form.minTargetCount) return false;
            if (NeedsRole(form) && string.IsNullOrWhiteSpace(selectedActionRoleId)) return false;
            return true;
        }

        private string ActionFormStatus(ActionFormViewModel form)
        {
            if (form == null) return "";
            if (!form.available) return form.reason ?? "当前不可用。";
            if (form.inputType == "guesses" && (selectedActionTargetIds.Count == 0 || string.IsNullOrWhiteSpace(selectedActionRoleId))) return "猜测类行动需要玩家 + 身份。";
            var modeSkipsTargets = ActionFormModeSkipsTargetsInstance(form);
            if (NeedsTargets(form) && !modeSkipsTargets && selectedActionTargetIds.Count < form.minTargetCount) return $"还需选择至少 {form.minTargetCount} 个目标。";
            if (NeedsRole(form) && string.IsNullOrWhiteSpace(selectedActionRoleId)) return "还需选择身份。";
            if (NeedsMode(form) && string.IsNullOrWhiteSpace(selectedActionModeId) && (form.modes?.Length ?? 0) > 0) return "可选择一个模式，未选则由 JS Core 使用默认模式。";
            return "可以确认发送；规则仍由 JS Core 结算。";
        }

        private Color ActionFormStatusColor(ActionFormViewModel form)
        {
            if (form == null || !form.available) return new Color(1f, 0.58f, 0.34f, 0.96f);
            return CanSubmitActionForm(form)
                ? new Color(0.66f, 0.94f, 0.72f, 0.96f)
                : new Color(1f, 0.76f, 0.38f, 0.96f);
        }

        private void SetActionFormButtonStates(ActionFormViewModel form)
        {
            SetToolButtonEnabled(actionFormAutoButton, form != null && form.available);
            SetToolButtonEnabled(actionFormSubmitButton, CanSubmitActionForm(form));
            SetButtonSuggested(actionFormSubmitButton, CanSubmitActionForm(form));
            SetButtonSuggested(actionFormAutoButton, form != null && form.available && !CanSubmitActionForm(form));
        }

        private void SendActiveActionFormAuto()
        {
            var form = ActiveActionForm();
            if (form == null || string.IsNullOrWhiteSpace(form.id)) return;
            SendUnityAction(form.id);
            FinishActionFormSend(form, "已发送给 JS Core：自动使用当前合法默认选择。");
        }

        private void ToggleActionFormTarget(string targetId)
        {
            var form = ActiveActionForm();
            if (form == null) return;
            if (selectedActionTargetIds.Contains(targetId))
            {
                selectedActionTargetIds.Remove(targetId);
            }
            else
            {
                if (form.maxTargetCount > 0 && selectedActionTargetIds.Count >= form.maxTargetCount) selectedActionTargetIds.RemoveAt(0);
                selectedActionTargetIds.Add(targetId);
            }
            RenderActiveActionSurface();
            RenderGrimoire();
        }

        private void ClearActionFormTargets()
        {
            selectedActionTargetIds.Clear();
            RenderActiveActionSurface();
            RenderGrimoire();
        }

        private void SelectActionFormRole(string roleId)
        {
            selectedActionRoleId = selectedActionRoleId == roleId ? "" : roleId;
            RenderActiveActionSurface();
        }

        private void SelectActionFormMode(string modeId)
        {
            selectedActionModeId = selectedActionModeId == modeId ? "" : modeId;
            RenderActiveActionSurface();
            RenderGrimoire();
        }

        private void SendActionFormComposed()
        {
            var form = ActiveActionForm();
            if (form == null) return;
            if (form.inputType == "guesses")
            {
                if (selectedActionTargetIds.Count == 0 || string.IsNullOrWhiteSpace(selectedActionRoleId))
                {
                    dialogueTitle.text = $"{form.title}未发送";
                    dialogueBody.text = "猜测类行动需要先选择玩家和身份。";
                    return;
                }
                SendUnityAction(form.id, targetIds: selectedActionTargetIds.Take(1), roleId: selectedActionRoleId, guessPlayerId: selectedActionTargetIds[0], guessRoleId: selectedActionRoleId);
                FinishActionFormSend(form, $"已发送给 JS Core：{ActionFormSelectionText(form)}。");
                return;
            }
            else if (NeedsQuestion(form))
            {
                var question = actionQuestionInput == null ? "" : actionQuestionInput.text.Trim();
                SendUnityAction(form.id, text: string.IsNullOrWhiteSpace(question) ? "Is there a demon in play?" : question);
                FinishActionFormSend(form, $"已发送给 JS Core：{ActionFormSelectionText(form)}。");
                return;
            }
            else
            {
                var modeSkipsTargets = form.inputType == "charge-or-targets" && (selectedActionModeId == "charge" || selectedActionModeId == "none");
                if (NeedsTargets(form) && !modeSkipsTargets && selectedActionTargetIds.Count < form.minTargetCount)
                {
                    dialogueTitle.text = $"{form.title}未发送";
                    dialogueBody.text = $"还需要选择至少 {form.minTargetCount} 项。";
                    return;
                }
                if (NeedsRole(form) && string.IsNullOrWhiteSpace(selectedActionRoleId))
                {
                    dialogueTitle.text = $"{form.title}未发送";
                    dialogueBody.text = "还需要选择身份。";
                    return;
                }
                SendUnityAction(form.id, roleId: selectedActionRoleId, mode: selectedActionModeId, targetIds: selectedActionTargetIds);
                FinishActionFormSend(form, $"已发送给 JS Core：{ActionFormSelectionText(form)}。");
                return;
            }
        }

        private void FinishActionFormSend(ActionFormViewModel form, string message)
        {
            var isNight = form?.id == "night-action";
            var title = form?.title ?? "行动表单";
            CloseActionFormPanel();
            dialogueTitle.text = $"{title}已发送";
            dialogueBody.text = message;
            if (isNight)
            {
                QueueStageDialogue(
                    "说书人",
                    "你的夜间选择已经记录。\n稍后结算夜晚时，我会把得到的信息用这条底部对话框告诉你，并同步写入右侧“资料 > 信息”。",
                    "夜间行动");
            }
        }

        private void SendActionFormSelectedTargets()
        {
            var form = ActiveActionForm();
            if (form == null) return;
            if (selectedActionTargetIds.Count < form.minTargetCount)
            {
                dialogueTitle.text = $"{form.title}未发送";
                dialogueBody.text = $"还需要选择至少 {form.minTargetCount} 项。";
                return;
            }
            SendUnityAction(form.id, targetIds: selectedActionTargetIds);
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = $"已发送给 JS Core：{string.Join(" / ", selectedActionTargetIds.Select(NameForPlayerId))}。";
        }

        private void SendActionFormRole(string roleId)
        {
            var form = ActiveActionForm();
            if (form == null) return;
            SendUnityAction(form.id, roleId: roleId);
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = $"已发送给 JS Core：选择身份 {RoleNameForId(roleId)}。";
        }

        private void SendActionFormMode(string mode)
        {
            var form = ActiveActionForm();
            if (form == null) return;
            SendUnityAction(form.id, mode: mode);
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = $"已发送给 JS Core：选择模式 {mode}。";
        }
    }
}
