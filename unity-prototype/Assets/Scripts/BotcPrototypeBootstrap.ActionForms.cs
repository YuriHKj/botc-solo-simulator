using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {
        private sealed class ActionGuessSelection
        {
            public string playerId = "";
            public string roleId = "";
        }

        private const int ActionQuestionMinLength = 2;

        private void BuildActionFormPanel()
        {
            actionFormPanel = AddPanel("Action Form Panel", canvas.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-760f, -410f), new Vector2(760f, 410f), new Color(0.005f, 0.012f, 0.020f, 0.93f)).GetComponent<RectTransform>();
            AddFrame(actionFormPanel, "Action Form Frame", 1.1f, new Color(0.92f, 0.62f, 0.28f, 0.38f));
            AddImage("Action Form Header Wash", actionFormPanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -92f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            actionFormTitle = AddText("Action Form Title", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(34f, 764f), new Vector2(-34f, -16f), "行动表单", 31, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Action Form Hint", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(1300f, 774f), new Vector2(-150f, -22f), "", 12, TextAnchor.UpperRight, FontStyle.Normal);
            AddToolActionButton("×", "关闭", actionFormPanel, new Vector2(1450f, 778f), new Vector2(104f, 34f), CloseActionFormPanel, true);
            AddImage("Action Form Summary Wash", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(32f, 650f), new Vector2(-32f, -100f), new Color(0.020f, 0.028f, 0.036f, 0.28f));
            actionFormBody = AddText("Action Form Body", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(52f, 662f), new Vector2(-52f, -114f), "", 16, TextAnchor.UpperLeft, FontStyle.Normal);
            actionFormSignalRoot = AddPanel("Action Form Signal Strip", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(42f, 616f), new Vector2(-42f, -180f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            actionOptionRoot = AddPanel("Action Option Root", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(32f, 116f), new Vector2(-32f, -208f), new Color(0.020f, 0.028f, 0.036f, 0.24f)).GetComponent<RectTransform>();
            AddFrame(actionOptionRoot, "Action Option Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            actionFormStatusText = AddText("Action Form Status", actionFormPanel, Vector2.zero, Vector2.one, new Vector2(38f, 46f), new Vector2(-560f, -738f), "", 15, TextAnchor.UpperLeft, FontStyle.Normal);
            actionFormStatusText.color = new Color(0.86f, 0.90f, 0.92f, 0.94f);
            actionFormAutoButton = AddToolActionButton("↺", "自动合法", actionFormPanel, new Vector2(1060f, 54f), new Vector2(150f, 38f), () => SendActiveActionFormAuto());
            actionFormSubmitButton = AddToolActionButton("✓", "确认发送", actionFormPanel, new Vector2(1232f, 54f), new Vector2(190f, 38f), () => SendActionFormComposed());
            AddToolActionButton("×", "关闭", actionFormPanel, new Vector2(1390f, 54f), new Vector2(112f, 38f), CloseActionFormPanel);
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
                dialogueBody.text = "这名玩家不是当前行动的合法目标。合法目标会在大魔典上显示“可”。";
                return true;
            }
            ToggleActionFormTarget(player.id);
            return true;
        }

        private ActionFormViewModel ActiveActionForm()
        {
            return (vm.actionForms ?? Array.Empty<ActionFormViewModel>()).FirstOrDefault((entry) => entry != null && entry.id == activeActionFormId);
        }

        private static bool IsPublicDayAction(ActionFormViewModel form)
        {
            return form != null
                && form.id == "day-action"
                && form.interaction != null
                && (form.roleId == "slayer" || form.roleId == "gossip" || !string.IsNullOrWhiteSpace(form.interaction.confirmText));
        }

        private static string PublicActionTitle(ActionFormViewModel form)
        {
            if (!string.IsNullOrWhiteSpace(form?.interaction?.title)) return form.interaction.title;
            return string.IsNullOrWhiteSpace(form?.roleName) ? "公开发动" : form.roleName;
        }

        private static string PublicActionConfirmText(ActionFormViewModel form)
        {
            if (!string.IsNullOrWhiteSpace(form?.interaction?.confirmText)) return form.interaction.confirmText;
            if (form?.roleId == "slayer") return "公开开枪";
            if (form?.roleId == "gossip") return "公开声明";
            return "公开发动";
        }

        private static string PublicActionInputTitle(ActionFormViewModel form)
        {
            if (form?.roleId == "gossip") return "公开声明";
            if (form?.roleId == "slayer") return "开枪目标";
            return NeedsQuestion(form) ? "公开文本" : "公开选择";
        }

        private static string PublicActionHelper(ActionFormViewModel form)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(form?.interaction?.badge)) parts.Add(form.interaction.badge);
            if (!string.IsNullOrWhiteSpace(form?.interaction?.subtitle)) parts.Add(form.interaction.subtitle);
            if (!string.IsNullOrWhiteSpace(form?.interaction?.helper)) parts.Add(form.interaction.helper);
            return parts.Count == 0 ? "" : string.Join("  ", parts);
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
            actionQuestionDraftText = "";
            selectedActionGuesses.Clear();
            actionTargetPage = 0;
            actionRolePage = 0;
            actionQuestionInput = null;
            var form = ActiveActionForm();
            if (ActionFormUsesGrimoireTargets(form))
            {
                if (phaseAssistPanel != null) phaseAssistPanel.gameObject.SetActive(false);
                if (actionFormPanel != null) actionFormPanel.gameObject.SetActive(false);
                bottomDockOpen = false;
                ApplyBottomDockVisibility();
                RenderActionTargetBar();
                if (actionTargetBar != null) actionTargetBar.gameObject.SetActive(true);
                RenderGrimoire();
                ApplyModalBackdropVisibility();
                if (actionTargetBar != null) actionTargetBar.SetAsLastSibling();
                return;
            }
            if (phaseAssistPanel != null) phaseAssistPanel.gameObject.SetActive(false);
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
            actionQuestionDraftText = "";
            selectedActionGuesses.Clear();
            activeActionFormId = "";
            actionQuestionInput = null;
            SetButtonSuggested(actionFormSubmitButton, false);
            SetButtonSuggested(actionFormAutoButton, false);
            if (hadTargets || hadGrimoireTargetMode) RenderGrimoire();
            ApplyModalBackdropVisibility();
            RenderPhaseAssistPanel();
            ApplyBottomDockVisibility();
            ApplyFocusChromeVisibility();
        }

        private void RenderActionFormPanel()
        {
            if (actionOptionRoot != null)
            {
                ClearChildren(actionOptionRoot);
                AddFrame(actionOptionRoot, "Action Option Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            }
            actionQuestionStatusText = null;
            actionQuestionCountText = null;
            actionQuestionStatusPill = null;
            var form = ActiveActionForm();
            if (form == null)
            {
                if (actionFormTitle != null) actionFormTitle.text = "行动表单";
                if (actionFormBody != null) actionFormBody.text = "当前没有可用的行动面板。";
                if (actionFormStatusText != null) actionFormStatusText.text = "";
                RenderActionFormSignalStrip(null);
                SetActionFormButtonStates(null);
                return;
            }
            var isPublicAction = IsPublicDayAction(form);
            actionQuestionInput = null;
            if (actionFormTitle != null) actionFormTitle.text = isPublicAction ? $"公开发动 · {PublicActionTitle(form)}" : form.title ?? "行动表单";
            if (actionFormBody != null) actionFormBody.text = BuildActionFormBodyText(form, isPublicAction);
            RenderActionFormSignalStrip(form);
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
            RenderActionSubmitChecklist(form);
            if (form.inputType == "guesses")
            {
                RenderActionGuessBuilder(form);
                if (actionFormStatusText != null)
                {
                    actionFormStatusText.text = ClampTextBlock(ActionFormStatus(form), 2, 88);
                    actionFormStatusText.color = ActionFormStatusColor(form);
                }
                SetActionFormButtonStates(form);
                return;
            }
            var y = 462f;
            if (NeedsMode(form))
            {
                AddActionSectionHeader("Mode", "模式", ActionFormInstruction(form), y);
                RenderActionModeChoices(form, y - 38f);
                y -= 86f;
            }
            if (NeedsTargets(form))
            {
                AddActionSectionHeader("Target", isPublicAction ? PublicActionInputTitle(form) : "目标", isPublicAction ? PublicActionHelper(form) : ActionTargetHint(form), y);
                if (ActionFormUsesGrimoireTargets(form)) RenderActionGrimoireTargetPrompt(form, y - 38f);
                else RenderActionTargetChoices(form, y - 38f);
                y -= NeedsRole(form) ? 154f : (form.options?.Length ?? 0) > ActionChoicePageSize ? 150f : 132f;
            }
            if (NeedsRole(form))
            {
                AddActionSectionHeader("Role", "身份", "选择身份标记后再确认发送。", y);
                RenderActionRoleChoices(form, y - 44f, NeedsTargets(form));
                y -= NeedsTargets(form) ? 156f : 190f;
            }
            if (NeedsQuestion(form))
            {
                AddActionSectionHeader("Question", isPublicAction ? PublicActionInputTitle(form) : "问题", isPublicAction ? "提交后会立刻写入公开时间线。" : "写下要询问说书人的是/否问题。", y);
                RenderActionQuestionComposer(form, isPublicAction, y);
                var formId = form.id ?? "";
                actionQuestionInput.onValueChanged.AddListener((_) =>
                {
                    actionQuestionDraftText = actionQuestionInput == null ? "" : actionQuestionInput.text ?? "";
                    if (activeActionFormId == formId) RefreshActionFormReadiness(form);
                });
                if (!string.IsNullOrWhiteSpace(actionQuestionDraftText)) actionQuestionInput.text = actionQuestionDraftText;
                if (isPublicAction)
                {
                    actionQuestionInput.characterLimit = 180;
                    actionQuestionInput.lineType = InputField.LineType.MultiLineNewline;
                    if (actionQuestionInput.textComponent != null) actionQuestionInput.textComponent.alignment = TextAnchor.UpperLeft;
                    if (actionQuestionInput.placeholder is Text placeholder) placeholder.alignment = TextAnchor.UpperLeft;
                }
                UpdateActionQuestionComposer(form);
            }
            if (!NeedsMode(form) && !NeedsTargets(form) && !NeedsRole(form) && !NeedsQuestion(form))
            {
                AddText("Info Action", actionOptionRoot, Vector2.zero, Vector2.one, new Vector2(28f, 202f), new Vector2(-374f, -170f), "这是信息型行动，无需额外输入。\n点击确认发送或自动合法选择后，会记录结算结果。", 17, TextAnchor.MiddleCenter, FontStyle.Normal);
            }
            if (actionFormStatusText != null)
            {
                actionFormStatusText.text = ClampTextBlock(ActionFormStatus(form), 2, 88);
                actionFormStatusText.color = ActionFormStatusColor(form);
            }
            SetActionFormButtonStates(form);
        }

        private void RenderActionQuestionComposer(ActionFormViewModel form, bool isPublicAction, float y)
        {
            if (actionOptionRoot == null) return;
            var height = isPublicAction ? 206f : 136f;
            var top = Mathf.Min(472f, y - 22f);
            var bottom = Mathf.Max(24f, top - height);
            height = top - bottom;
            const float width = 1054f;
            var panel = AddPanel("Action Question Composer", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(24f, bottom), new Vector2(1078f, top), new Color(0.008f, 0.016f, 0.024f, 0.76f));
            AddImage("Action Question Composer Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), isPublicAction ? new Color(0.78f, 0.92f, 0.58f, 0.46f) : new Color(0.42f, 0.76f, 1f, 0.40f));
            AddImage("Action Question Composer Wash", panel.transform, new Vector2(0f, 0.58f), Vector2.one, new Vector2(5f, -2f), new Vector2(-5f, -4f), isPublicAction ? new Color(0.46f, 0.64f, 0.22f, 0.060f) : new Color(0.28f, 0.48f, 0.70f, 0.050f));
            AddFrame(panel.transform, "Action Question Composer Frame", 0.8f, isPublicAction ? new Color(0.76f, 0.92f, 0.48f, 0.22f) : new Color(0.42f, 0.76f, 1f, 0.22f));

            var title = isPublicAction ? "公开声明草稿" : "问题草稿";
            var helper = isPublicAction
                ? FirstNonEmpty(PublicActionHelper(form), "提交后进入公开时间线；尽量写成一句可判定声明。")
                : "写成一句清楚的是/否问题，交给说书人结算。";
            AddText("Action Question Composer Title", panel.transform, Vector2.zero, Vector2.zero, new Vector2(20f, height - 34f), new Vector2(360f, height - 8f), title, 16, TextAnchor.MiddleLeft, FontStyle.Bold);
            AddText("Action Question Composer Helper", panel.transform, Vector2.zero, Vector2.zero, new Vector2(20f, height - 58f), new Vector2(width - 244f, height - 34f), Ellipsize(helper, 72), 12, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.78f, 0.86f, 0.88f, 0.84f);

            actionQuestionStatusPill = AddImage("Action Question Status Pill", panel.transform, Vector2.zero, Vector2.zero, new Vector2(width - 208f, height - 38f), new Vector2(width - 20f, height - 12f), new Color(0.30f, 0.13f, 0.04f, 0.88f));
            AddFrame(actionQuestionStatusPill.transform, "Action Question Status Pill Frame", 0.65f, new Color(1f, 0.72f, 0.36f, 0.28f));
            actionQuestionStatusText = AddText("Action Question Status Text", actionQuestionStatusPill.transform, Vector2.zero, Vector2.one, new Vector2(10f, 0f), new Vector2(-10f, 0f), "待填写", 12, TextAnchor.MiddleCenter, FontStyle.Bold);

            var inputBottom = isPublicAction ? 44f : 34f;
            var inputTop = isPublicAction ? Mathf.Max(inputBottom + 54f, height - 66f) : Mathf.Max(inputBottom + 38f, height - 52f);
            actionQuestionInput = AddInputField("Action Question Input", panel.transform, new Vector2(20f, inputBottom), new Vector2(width - 20f, inputTop), isPublicAction ? "输入要公开声明的内容" : "输入要询问说书人的问题");
            actionQuestionCountText = AddText("Action Question Count", panel.transform, Vector2.zero, Vector2.zero, new Vector2(20f, 12f), new Vector2(width - 20f, 34f), "", 12, TextAnchor.MiddleRight, FontStyle.Normal);
            actionQuestionCountText.color = new Color(0.76f, 0.84f, 0.86f, 0.78f);
        }

        private string BuildActionFormBodyText(ActionFormViewModel form, bool isPublicAction)
        {
            if (form == null) return "";
            if (!form.available) return ClampTextBlock($"当前不可用：{form.reason}", 3, 118);
            return ClampTextLines(new[]
            {
                isPublicAction
                    ? $"{form.roleName} · 公开技能 · {ActionRequirementLabel(form)}"
                    : $"{form.roleName} · {ActionInputLabel(form.inputType)} · {ActionRequirementLabel(form)}",
                string.IsNullOrWhiteSpace(form.prompt) ? "说书人正在等待你的选择。" : form.prompt,
                isPublicAction ? FirstNonEmpty(PublicActionHelper(form), ActionFormReadinessLine(form)) : ActionFormReadinessLine(form)
            }, 3, 118);
        }

        private void RenderActionFormSignalStrip(ActionFormViewModel form)
        {
            if (actionFormSignalRoot == null) return;
            ClearChildren(actionFormSignalRoot);
            if (form == null)
            {
                AddActionFormSignalChip("表", "表单", "未载入", 0f, 150f, new Color(0.070f, 0.035f, 0.020f, 0.68f), new Color(1f, 0.58f, 0.24f, 0.24f));
                AddActionFormSignalChip("态", "提交", "不可用", 160f, 150f, new Color(0.070f, 0.035f, 0.020f, 0.68f), new Color(1f, 0.58f, 0.24f, 0.24f));
                return;
            }

            var canSubmit = CanSubmitActionForm(form);
            var readyFill = canSubmit ? new Color(0.022f, 0.060f, 0.036f, 0.74f) : new Color(0.058f, 0.036f, 0.018f, 0.72f);
            var readyBorder = canSubmit ? new Color(0.48f, 0.86f, 0.56f, 0.26f) : new Color(1f, 0.62f, 0.28f, 0.24f);
            if (!form.available)
            {
                readyFill = new Color(0.070f, 0.035f, 0.020f, 0.70f);
                readyBorder = new Color(1f, 0.58f, 0.24f, 0.28f);
            }

            AddActionFormSignalChip("ID", "角色", ActionFormRoleSignalLabel(form), 0f, 208f, new Color(0.050f, 0.038f, 0.024f, 0.76f), new Color(0.96f, 0.68f, 0.30f, 0.24f));
            AddActionFormSignalChip("IN", "输入", ActionInputLabel(form.inputType), 216f, 182f, new Color(0.035f, 0.048f, 0.060f, 0.74f), new Color(0.62f, 0.78f, 0.92f, 0.20f));
            AddActionFormSignalChip("REQ", "需求", ActionRequirementLabel(form), 406f, 190f, new Color(0.045f, 0.050f, 0.036f, 0.74f), new Color(0.78f, 0.88f, 0.48f, 0.20f));
            AddActionFormSignalChip("→", "进度", ActionFormProgressSignalLabel(form), 604f, 180f, readyFill, readyBorder);
            AddActionFormSignalChip("✓", "提交", ActionFormSubmitSignalLabel(form, canSubmit), 792f, 186f, readyFill, readyBorder);
        }

        private void AddActionFormSignalChip(string icon, string label, string value, float x, float width, Color fill, Color border)
        {
            if (actionFormSignalRoot == null) return;
            var chip = AddPanel($"Action Form Signal Chip {label}", actionFormSignalRoot, Vector2.zero, Vector2.zero, new Vector2(x, 0f), new Vector2(x + width, 24f), fill);
            AddFrame(chip.transform, "Action Form Signal Chip Frame", 0.65f, border);
            var badge = AddImage("Action Form Signal Badge", chip.transform, Vector2.zero, Vector2.zero, new Vector2(5f, 5f), new Vector2(21f, 21f), new Color(0.008f, 0.012f, 0.016f, 0.78f));
            badge.sprite = GetCircleFillSprite();
            badge.preserveAspect = true;
            badge.raycastTarget = false;
            AddText("Action Form Signal Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, icon.Length > 1 ? 7 : 9, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("Action Form Signal Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(26f, 12f), new Vector2(-4f, -3f), label, 7, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.70f, 0.78f, 0.82f, 0.76f);
            AddText("Action Form Signal Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(26f, 2f), new Vector2(-4f, -13f), Ellipsize(value, Mathf.Max(4, Mathf.FloorToInt(width / 12f))), 9, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            SetRaycastTargetsExceptButtons(chip.transform);
        }

        private string ActionFormRoleSignalLabel(ActionFormViewModel form)
        {
            if (form == null) return "未知";
            if (IsPublicDayAction(form)) return PublicActionTitle(form);
            return FirstNonEmpty(form.roleName, form.roleId, "未知角色");
        }

        private string ActionFormProgressSignalLabel(ActionFormViewModel form)
        {
            if (form == null) return "--";
            if (!form.available) return "锁定";
            if (form.inputType == "guesses") return $"{selectedActionGuesses.Count}/{GuessMaxCount(form)}组";
            if (NeedsTargets(form) && !ActionFormModeSkipsTargetsInstance(form)) return $"{selectedActionTargetIds.Count}/{Mathf.Max(1, form.minTargetCount)}目标";
            if (NeedsRole(form)) return string.IsNullOrWhiteSpace(selectedActionRoleId) ? "待身份" : "已选身份";
            if (NeedsQuestion(form)) return HasActionQuestionText() ? "已填写" : "待填写";
            if (NeedsMode(form)) return string.IsNullOrWhiteSpace(selectedActionModeId) ? "默认模式" : "已选模式";
            return "无需输入";
        }

        private string ActionFormSubmitSignalLabel(ActionFormViewModel form, bool canSubmit)
        {
            if (form == null || !form.available) return "不可用";
            if (canSubmit) return IsPublicDayAction(form) ? "可公开" : "可发送";
            if (form.inputType == "guesses" && selectedActionTargetIds.Count > 0 && !string.IsNullOrWhiteSpace(selectedActionRoleId)) return "先加入";
            return "待补齐";
        }

        private void RefreshActionFormReadiness(ActionFormViewModel form)
        {
            var active = form != null && form.id == activeActionFormId ? form : ActiveActionForm();
            var isPublicAction = IsPublicDayAction(active);
            if (actionFormBody != null) actionFormBody.text = BuildActionFormBodyText(active, isPublicAction);
            if (actionFormStatusText != null)
            {
                actionFormStatusText.text = ClampTextBlock(ActionFormStatus(active), 2, 88);
                actionFormStatusText.color = ActionFormStatusColor(active);
            }
            RenderActionFormSignalStrip(active);
            UpdateActionQuestionComposer(active);
            SetActionFormButtonStates(active);
        }

        private void UpdateActionQuestionComposer(ActionFormViewModel form)
        {
            if (actionQuestionStatusText == null && actionQuestionCountText == null && actionQuestionStatusPill == null) return;
            var isPublicAction = IsPublicDayAction(form);
            var length = ActionQuestionText().Length;
            var limit = actionQuestionInput != null && actionQuestionInput.characterLimit > 0 ? actionQuestionInput.characterLimit : (isPublicAction ? 180 : 120);
            var ready = length >= ActionQuestionMinLength;
            if (actionQuestionStatusPill != null)
            {
                actionQuestionStatusPill.color = ready
                    ? new Color(0.055f, 0.18f, 0.10f, 0.90f)
                    : new Color(0.30f, 0.13f, 0.04f, 0.88f);
            }
            if (actionQuestionStatusText != null)
            {
                actionQuestionStatusText.text = ready ? (isPublicAction ? "可公开发送" : "可提交") : $"至少 {ActionQuestionMinLength} 字";
                actionQuestionStatusText.color = ready ? new Color(0.72f, 1f, 0.76f, 0.98f) : new Color(1f, 0.76f, 0.36f, 0.98f);
            }
            if (actionQuestionCountText != null)
            {
                actionQuestionCountText.text = $"字数 {length}/{limit} · 至少 {ActionQuestionMinLength} 字";
                actionQuestionCountText.color = ready ? new Color(0.72f, 0.92f, 0.78f, 0.86f) : new Color(0.92f, 0.78f, 0.54f, 0.86f);
            }
        }

        private void PrimeActionFormSmokeInput()
        {
            var form = ActiveActionForm();
            if (form == null) return;
            var changed = false;
            if (NeedsTargets(form) && selectedActionTargetIds.Count < Mathf.Max(1, form.minTargetCount))
            {
                selectedActionTargetIds.Clear();
                selectedActionTargetIds.AddRange(AutomaticActionTargetIds(form));
                changed = true;
            }
            if (NeedsQuestion(form) && actionQuestionInput != null)
            {
                actionQuestionDraftText = IsPublicDayAction(form) ? "5号是善良玩家" : "场上是否有恶魔？";
                actionQuestionInput.text = actionQuestionDraftText;
                changed = true;
            }
            if (changed) RenderActiveActionSurface();
        }

        private void RenderActionSubmitChecklist(ActionFormViewModel form)
        {
            if (actionOptionRoot == null || form == null) return;
            var panel = AddPanel("Action Submit Checklist", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(1120f, 24f), new Vector2(1424f, 472f), new Color(0.004f, 0.010f, 0.017f, 0.62f));
            AddFrame(panel.transform, "Action Checklist Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            AddImage("Action Checklist Header Wash", panel.transform, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -58f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.060f));
            var checklistTitle = form.inputType == "guesses"
                ? "猜测进度"
                : IsPublicDayAction(form) ? "公开发动检查" : "提交检查";
            AddText("Action Checklist Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 398f), new Vector2(-18f, -14f), checklistTitle, 19, TextAnchor.UpperLeft, FontStyle.Bold);

            var y = 356f;
            if (form.inputType == "guesses")
            {
                var min = GuessMinCount(form);
                var max = GuessMaxCount(form);
                var count = selectedActionGuesses.Count;
                var canSubmitGuesses = count >= min && count <= max;
                AddActionChecklistRow(panel.transform, "猜测", $"{count}/{max}，至少 {min}", canSubmitGuesses, y);
                y -= 48f;
                AddActionChecklistRow(panel.transform, "当前玩家", selectedActionTargetIds.Count == 0 ? "尚未选择" : NameForPlayerId(selectedActionTargetIds[0]), selectedActionTargetIds.Count > 0, y);
                y -= 48f;
                AddActionChecklistRow(panel.transform, "当前身份", string.IsNullOrWhiteSpace(selectedActionRoleId) ? "尚未选择" : RoleNameForId(selectedActionRoleId), !string.IsNullOrWhiteSpace(selectedActionRoleId), y);

                var hasDraft = selectedActionTargetIds.Count > 0 && !string.IsNullOrWhiteSpace(selectedActionRoleId);
                var missing = Mathf.Max(0, min - count);
                var checklistHint = count > max
                    ? $"已超过上限；最多 {max} 组。"
                    : canSubmitGuesses
                        ? "数量已满足；草稿未加入列表时不会随提交发送。"
                        : hasDraft ? $"还需 {missing} 组；点击“加入猜测”后才算完成。" : $"还需 {missing} 组；先选玩家和身份。";
                AddText("Action Guess Checklist Hint", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 150f), new Vector2(-18f, -244f), ClampTextBlock(checklistHint, 2, 30), 12, TextAnchor.UpperLeft, FontStyle.Normal).color = canSubmitGuesses
                    ? new Color(0.72f, 1f, 0.76f, 0.92f)
                    : new Color(1f, 0.76f, 0.38f, 0.92f);
                AddText("Action Current Label", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 118f), new Vector2(-18f, -308f), "已加入猜测", 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
                AddText("Action Current Value", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 58f), new Vector2(-18f, -338f), ClampTextBlock(ActionFormSelectionText(form), 3, 26), 13, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.86f, 0.90f, 0.92f, 0.92f);
                if (selectedActionGuesses.Count > 0)
                {
                    AddToolActionButton("↺", "清空猜测", panel.transform, new Vector2(232f, 26f), new Vector2(112f, 28f), ClearActionGuesses, true);
                }
                return;
            }
            if (NeedsTargets(form))
            {
                var modeSkipsTargets = ActionFormModeSkipsTargetsInstance(form);
                var ok = modeSkipsTargets || selectedActionTargetIds.Count >= form.minTargetCount;
                var countText = modeSkipsTargets
                    ? "当前模式不需要目标"
                    : $"{selectedActionTargetIds.Count}/{Mathf.Max(1, form.minTargetCount)} 已选";
                AddActionChecklistRow(panel.transform, IsPublicDayAction(form) ? PublicActionInputTitle(form) : "目标", countText, ok, y);
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
                var hasQuestion = HasActionQuestionText();
                AddActionChecklistRow(panel.transform, IsPublicDayAction(form) ? PublicActionInputTitle(form) : "问题", hasQuestion ? "已填写" : $"至少 {ActionQuestionMinLength} 个字符", hasQuestion, y);
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
                AddToolActionButton("↺", "清空目标", panel.transform, new Vector2(232f, 26f), new Vector2(112f, 28f), ClearActionFormTargets, true);
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

        private void RenderActionGuessBuilder(ActionFormViewModel form)
        {
            if (actionOptionRoot == null || form == null) return;
            AddActionSectionHeader("GuessTarget", "玩家", "先选一个玩家，再选身份；每名玩家最多加入一次猜测。", 462f);
            RenderActionTargetChoices(form, 424f);
            RenderActionGuessReadinessStrip(form);
            RenderActionRoleSelector(actionOptionRoot, new Vector2(28f, 172f), new Vector2(760f, 292f), 58f);
            RenderActionGuessComposerPanel(form);
            RenderActionGuessRows(form);
        }

        private void RenderActionGuessReadinessStrip(ActionFormViewModel form)
        {
            var min = GuessMinCount(form);
            var max = GuessMaxCount(form);
            var count = selectedActionGuesses.Count;
            var playerId = selectedActionTargetIds.Count == 0 ? "" : selectedActionTargetIds[0];
            var hasPlayer = !string.IsNullOrWhiteSpace(playerId);
            var hasRole = !string.IsNullOrWhiteSpace(selectedActionRoleId);
            var existingIndex = hasPlayer ? selectedActionGuesses.FindIndex((entry) => entry.playerId == playerId) : -1;
            var draftComplete = hasPlayer && hasRole;
            var atMaxForNewGuess = draftComplete && existingIndex < 0 && count >= max;
            var canCommitDraft = draftComplete && (existingIndex >= 0 || count < max);
            var canSubmit = count >= min && count <= max;

            string status;
            string hint;
            Color fill;
            Color frame;
            Color statusColor;
            if (atMaxForNewGuess)
            {
                status = "已达上限";
                hint = $"最多 {max} 组；删除一组后再添加新猜测。";
                fill = new Color(0.070f, 0.030f, 0.020f, 0.72f);
                frame = new Color(1f, 0.52f, 0.34f, 0.32f);
                statusColor = new Color(1f, 0.68f, 0.48f, 0.98f);
            }
            else if (canCommitDraft)
            {
                status = existingIndex >= 0 ? "下一步：更新猜测" : "下一步：加入猜测";
                hint = "当前草稿完整，写入列表后才会随提交发送。";
                fill = new Color(0.072f, 0.042f, 0.018f, 0.72f);
                frame = new Color(1f, 0.70f, 0.30f, 0.34f);
                statusColor = new Color(1f, 0.82f, 0.42f, 0.98f);
            }
            else if (canSubmit)
            {
                status = hasPlayer || hasRole ? "可提交；草稿未完成" : "可确认发送";
                hint = hasPlayer || hasRole ? "补齐或清空草稿；未加入列表不会发送。" : $"已满足至少 {min} 组，可直接提交。";
                fill = new Color(0.018f, 0.050f, 0.034f, 0.72f);
                frame = new Color(0.48f, 0.86f, 0.56f, 0.30f);
                statusColor = new Color(0.72f, 1f, 0.76f, 0.98f);
            }
            else if (!hasPlayer && !hasRole)
            {
                status = "先选玩家和身份";
                hint = "上方选玩家，中部选身份，然后加入猜测列表。";
                fill = new Color(0.058f, 0.036f, 0.018f, 0.70f);
                frame = new Color(1f, 0.62f, 0.28f, 0.28f);
                statusColor = new Color(1f, 0.76f, 0.38f, 0.98f);
            }
            else
            {
                status = hasPlayer ? "还需选择身份" : "还需选择玩家";
                hint = "凑齐玩家 + 身份后，点击“加入猜测”。";
                fill = new Color(0.058f, 0.036f, 0.018f, 0.70f);
                frame = new Color(1f, 0.62f, 0.28f, 0.28f);
                statusColor = new Color(1f, 0.76f, 0.38f, 0.98f);
            }

            var panel = AddPanel("Action Guess Readiness", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(28f, 304f), new Vector2(760f, 342f), fill);
            AddFrame(panel.transform, "Action Guess Readiness Frame", 0.7f, frame);
            AddText("Guess Readiness Status", panel.transform, Vector2.zero, Vector2.one, new Vector2(14f, 4f), new Vector2(-520f, -4f), status, 14, TextAnchor.MiddleLeft, FontStyle.Bold).color = statusColor;
            AddText("Guess Readiness Hint", panel.transform, Vector2.zero, Vector2.one, new Vector2(176f, 4f), new Vector2(-92f, -4f), Ellipsize(hint, 34), 12, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.86f, 0.90f, 0.92f, 0.90f);
            AddText("Guess Readiness Count", panel.transform, Vector2.zero, Vector2.one, new Vector2(640f, 2f), new Vector2(-18f, -2f), $"{count}/{max}", 18, TextAnchor.MiddleRight, FontStyle.Bold).color = statusColor;
        }

        private void RenderActionGuessComposerPanel(ActionFormViewModel form)
        {
            var panel = AddPanel("Action Guess Composer", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(788f, 172f), new Vector2(1084f, 292f), new Color(0.010f, 0.017f, 0.026f, 0.68f));
            AddFrame(panel.transform, "Action Guess Composer Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.22f));
            var playerId = selectedActionTargetIds.Count == 0 ? "" : selectedActionTargetIds[0];
            var hasPlayer = !string.IsNullOrWhiteSpace(playerId);
            var hasRole = !string.IsNullOrWhiteSpace(selectedActionRoleId);
            var existingIndex = hasPlayer ? selectedActionGuesses.FindIndex((entry) => entry.playerId == playerId) : -1;
            var canAddNew = selectedActionGuesses.Count < GuessMaxCount(form);
            var canCommit = hasPlayer && hasRole && (existingIndex >= 0 || canAddNew);
            var title = existingIndex >= 0 ? "更新这组猜测" : "加入一组猜测";
            AddText("Guess Composer Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 86f), new Vector2(-18f, -10f), title, 16, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddText("Guess Composer Player", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 58f), new Vector2(-18f, -42f), hasPlayer ? $"玩家：{NameForPlayerId(playerId)}" : "玩家：尚未选择", 13, TextAnchor.UpperLeft, FontStyle.Normal).color = hasPlayer ? new Color(0.90f, 0.94f, 0.96f, 0.94f) : new Color(1f, 0.76f, 0.38f, 0.92f);
            AddText("Guess Composer Role", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 36f), new Vector2(-18f, -64f), hasRole ? $"身份：{RoleNameForId(selectedActionRoleId)}" : "身份：尚未选择", 13, TextAnchor.UpperLeft, FontStyle.Normal).color = hasRole ? new Color(0.90f, 0.94f, 0.96f, 0.94f) : new Color(1f, 0.76f, 0.38f, 0.92f);
            var add = AddToolActionButton(existingIndex >= 0 ? "✓" : "+", existingIndex >= 0 ? "更新猜测" : "加入猜测", panel.transform, new Vector2(210f, 24f), new Vector2(124f, 30f), () => AddOrUpdateActionGuess(form), true);
            SetToolButtonEnabled(add, canCommit);
            if (hasPlayer || hasRole)
            {
                AddToolActionButton("↺", "清空当前编辑", panel.transform, new Vector2(92f, 24f), new Vector2(88f, 30f), ClearActionFormTargets, true);
            }
        }

        private void RenderActionGuessRows(ActionFormViewModel form)
        {
            var panel = AddPanel("Action Guess Rows", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(28f, 24f), new Vector2(1084f, 154f), new Color(0.004f, 0.010f, 0.017f, 0.58f));
            AddFrame(panel.transform, "Action Guess Rows Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.20f));
            AddText("Guess Rows Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 100f), new Vector2(-18f, -10f), $"猜测列表 {selectedActionGuesses.Count}/{GuessMaxCount(form)}", 15, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            if (selectedActionGuesses.Count == 0)
            {
                AddText("Guess Rows Empty", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 28f), new Vector2(-18f, -48f), "还没有加入猜测。选择玩家和身份后，点击“加入猜测”。", 14, TextAnchor.MiddleCenter, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.88f, 0.82f);
                return;
            }

            for (var i = 0; i < selectedActionGuesses.Count && i < 5; i++)
            {
                var guess = selectedActionGuesses[i];
                var x = 18f + i * 204f;
                var row = AddPanel($"Action Guess Row {i}", panel.transform, Vector2.zero, Vector2.zero, new Vector2(x, 18f), new Vector2(x + 188f, 88f), new Color(0.020f, 0.032f, 0.040f, 0.72f));
                AddFrame(row.transform, "Action Guess Row Frame", 0.7f, new Color(1f, 0.70f, 0.30f, 0.30f));
                AddText("Guess Row Player", row.transform, Vector2.zero, Vector2.one, new Vector2(12f, 42f), new Vector2(-42f, -8f), Ellipsize($"{i + 1}. {NameForPlayerId(guess.playerId)}", 15), 13, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.86f, 0.48f, 0.98f);
                AddText("Guess Row Role", row.transform, Vector2.zero, Vector2.one, new Vector2(12f, 12f), new Vector2(-42f, -38f), Ellipsize(RoleNameForId(guess.roleId), 15), 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.86f, 0.90f, 0.92f, 0.90f);
                var removeIndex = i;
                AddToolActionButton("×", "移除这组猜测", row.transform, new Vector2(164f, 35f), new Vector2(36f, 28f), () => RemoveActionGuess(removeIndex), true);
            }
        }

        private void RenderActionGrimoireTargetPrompt(ActionFormViewModel form, float y)
        {
            var panel = AddPanel("Action Grimoire Target Prompt", actionOptionRoot, Vector2.zero, Vector2.zero, new Vector2(28f, y - 82f), new Vector2(760f, y), new Color(0.010f, 0.017f, 0.026f, 0.68f));
            AddFrame(panel.transform, "Grimoire Target Prompt Frame", 0.8f, new Color(0.42f, 0.76f, 1f, 0.22f));
            AddText("Grimoire Target Prompt Title", panel.transform, Vector2.zero, Vector2.one, new Vector2(18f, 42f), new Vector2(-18f, -8f), "在大魔典上点击带“可”的玩家", 16, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.76f, 0.90f, 1f, 0.98f);
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
            AddText("Action Role Selector Body", panel.transform, Vector2.zero, Vector2.one, new Vector2(142f, height - 76f), new Vector2(-20f, -48f), $"从 {roleCount} 个身份标记中选择，提交前会按当前规则校验。", 13, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.78f, 0.84f, 0.88f, 0.86f);
            AddToolActionButton("ID", selected ? "重选身份" : "选择身份", panel.transform, new Vector2(Mathf.Max(230f, width - 120f), 28f), new Vector2(154f, 32f), OpenActionFormRolePicker, true);
            if (selected)
            {
                AddToolActionButton("↺", "清空", panel.transform, new Vector2(Mathf.Max(90f, width - 278f), 28f), new Vector2(92f, 32f), () =>
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
            var isPublicAction = IsPublicDayAction(form);
            AddText("Action Target Bar Title", actionTargetBar, Vector2.zero, Vector2.one, new Vector2(26f, 176f), new Vector2(-620f, -10f), ActionTargetBarTitle(form, isPublicAction), 23, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText("Action Target Bar Task", actionTargetBar, Vector2.zero, Vector2.one, new Vector2(26f, 140f), new Vector2(-690f, -46f), ActionTargetPrimaryTaskLabel(form), 20, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.98f);
            AddText("Action Target Bar Hint", actionTargetBar, Vector2.zero, Vector2.one, new Vector2(26f, 112f), new Vector2(-690f, -78f), ActionTargetBarHint(form, isPublicAction), 14, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.88f, 0.92f, 0.94f, 0.94f);
            var progress = ActionTargetProgressLabel(form);
            var statusLine = string.IsNullOrWhiteSpace(progress) ? ActionFormStatus(form) : $"{progress} · {ActionFormStatus(form)}";
            actionTargetBarStatusText = AddText("Action Target Bar Status", actionTargetBar, Vector2.zero, Vector2.one, new Vector2(26f, 86f), new Vector2(-690f, -106f), statusLine, 13, TextAnchor.UpperLeft, FontStyle.Normal);
            actionTargetBarStatusText.color = ActionFormStatusColor(form);
            RenderActionTargetSlots(form);

            if (NeedsMode(form))
            {
                var modes = form.modes ?? Array.Empty<ActionModeViewModel>();
                for (var i = 0; i < modes.Length && i < 3; i++)
                {
                    var mode = modes[i];
                    var modeId = mode.id;
                    var button = AddToolActionButton("MODE", ActionModeLabel(mode), actionTargetBar, new Vector2(860f + i * 134f, 178f), new Vector2(124f, 32f), () => SelectActionFormMode(modeId), true);
                    if (selectedActionModeId == mode.id) AddFrame(button.transform, "Action Target Mode Selected", 1.1f, new Color(1f, 0.76f, 0.32f, 0.62f));
                }
            }

            if (NeedsRole(form)) RenderActionRoleSelector(actionTargetBar, new Vector2(852f, 42f), new Vector2(1182f, 154f), 52f);
            if (selectedActionTargetIds.Count > 0)
            {
                AddToolActionButton("↺", "重选目标", actionTargetBar, isPublicAction ? new Vector2(1190f, 172f) : new Vector2(1248f, 172f), new Vector2(116f, 34f), ClearActionFormTargets, true);
            }
            Button auto = null;
            if (!isPublicAction) auto = AddToolActionButton("AUTO", "自动合法", actionTargetBar, new Vector2(1374f, 172f), new Vector2(120f, 34f), SendActiveActionFormAuto, true);
            var submit = AddToolActionButton("✓", isPublicAction ? PublicActionConfirmText(form) : "确认发送", actionTargetBar, isPublicAction ? new Vector2(1334f, 96f) : new Vector2(1308f, 96f), new Vector2(128f, 40f), SendActionFormComposed);
            AddToolActionButton("×", "关闭", actionTargetBar, isPublicAction ? new Vector2(1460f, 96f) : new Vector2(1444f, 96f), new Vector2(96f, 40f), CloseActionFormPanel);
            SetToolButtonEnabled(auto, form.available);
            SetToolButtonEnabled(submit, CanSubmitActionForm(form));
            SetButtonSuggested(submit, CanSubmitActionForm(form));
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
                actionTargetBar.SetAsLastSibling();
                return;
            }
            RenderActionFormPanel();
        }

        private bool ActionFormUsesGrimoireTargets(ActionFormViewModel form)
        {
            if (form == null || !form.available || !NeedsTargets(form) || (form.options?.Length ?? 0) == 0) return false;
            if (form.inputType == "guesses") return false;
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
            if (form.inputType == "guesses") return $"猜测 {GuessMinCount(form)}-{GuessMaxCount(form)}";
            if (NeedsTargets(form))
            {
                var min = Mathf.Max(1, form.minTargetCount);
                var max = Mathf.Max(min, form.maxTargetCount);
                return min == max ? $"目标 {min}" : $"目标 {min}-{max}";
            }
            if (NeedsRole(form)) return "需要身份";
            if (NeedsQuestion(form)) return "需要问题";
            if (NeedsMode(form)) return "需要模式";
            return "无需额外输入";
        }

        private static string ActionTargetHint(ActionFormViewModel form)
        {
            if (form == null) return "";
            if (form.inputType == "guesses") return $"可加入 {GuessMinCount(form)}-{GuessMaxCount(form)} 组玩家 + 身份猜测；每名玩家最多一次。";
            if (form.maxTargetCount > 1) return $"可多选，至少 {form.minTargetCount} 个，最多 {form.maxTargetCount} 个。";
            return "选择一个合法目标；提交前会按当前规则校验。";
        }

        private string ActionTargetProgressLabel(ActionFormViewModel form)
        {
            if (form == null || !NeedsTargets(form)) return "";
            var selected = selectedActionTargetIds.Count;
            var min = Mathf.Max(0, form.minTargetCount);
            var max = Mathf.Max(min, form.maxTargetCount);
            if (max > 1) return $"已选 {selected} / 需要 {min} / 最多 {max}";
            return selected > 0 ? "已选 1 / 需要 1" : "已选 0 / 需要 1";
        }

        private static string ActionTargetPrimaryTaskLabel(ActionFormViewModel form)
        {
            if (form == null || !NeedsTargets(form)) return "确认行动";
            var min = Mathf.Max(1, form.minTargetCount);
            var max = Mathf.Max(min, form.maxTargetCount);
            if (min == max) return $"选择 {min} 名玩家";
            return $"选择 {min}-{max} 名玩家";
        }

        private string ActionTargetBarTitle(ActionFormViewModel form, bool isPublicAction)
        {
            if (form == null) return "行动目标";
            if (isPublicAction) return $"公开发动 · {PublicActionTitle(form)}";
            if (vm?.phase == "night") return $"夜晚行动 · {FirstNonEmpty(form.roleName, form.title, "角色行动")}";
            return form.title ?? "行动目标";
        }

        private string ActionTargetBarHint(ActionFormViewModel form, bool isPublicAction)
        {
            if (isPublicAction) return FirstNonEmpty(PublicActionHelper(form), "在大魔典上选择目标后公开发动。");
            var slotHint = (form?.maxTargetCount ?? 0) > 1 ? "所有已选目标会保留在下方槽位中。" : "已选目标会保留在下方槽位中。";
            return $"在大魔典上点击带“可”的玩家。{slotHint}";
        }

        private int ActionTargetSlotCount(ActionFormViewModel form)
        {
            if (form == null || !NeedsTargets(form) || ActionFormModeSkipsTargetsInstance(form)) return 0;
            var min = Mathf.Max(1, form.minTargetCount);
            var max = Mathf.Max(min, form.maxTargetCount);
            var required = min == max ? min : max;
            return Mathf.Clamp(required, 1, 3);
        }

        private void RenderActionTargetSlots(ActionFormViewModel form)
        {
            if (actionTargetBar == null) return;
            var slotCount = ActionTargetSlotCount(form);
            if (slotCount <= 0) return;

            var slotWidth = slotCount == 1 ? 326f : slotCount == 2 ? 236f : 158f;
            const float gap = 14f;
            for (var i = 0; i < slotCount; i++)
            {
                var selected = i < selectedActionTargetIds.Count;
                var x = 26f + i * (slotWidth + gap);
                var slot = AddPanel($"Action Target Slot {i + 1}", actionTargetBar, Vector2.zero, Vector2.zero, new Vector2(x, 20f), new Vector2(x + slotWidth, 76f), selected ? new Color(0.12f, 0.070f, 0.028f, 0.88f) : new Color(0.010f, 0.017f, 0.026f, 0.74f));
                AddImage("Action Target Slot Accent", slot.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), selected ? new Color(1f, 0.74f, 0.30f, 0.76f) : new Color(0.42f, 0.76f, 1f, 0.24f));
                AddFrame(slot.transform, "Action Target Slot Frame", 0.75f, selected ? new Color(1f, 0.70f, 0.30f, 0.42f) : new Color(0.42f, 0.76f, 1f, 0.18f));
                AddText("Action Target Slot Label", slot.transform, Vector2.zero, Vector2.one, new Vector2(14f, 32f), new Vector2(-14f, -5f), slotCount == 1 ? "目标" : $"目标 {i + 1}", 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.76f, 0.84f, 0.88f, 0.82f);
                AddText("Action Target Slot Value", slot.transform, Vector2.zero, Vector2.one, new Vector2(14f, 8f), new Vector2(-14f, -24f), selected ? Ellipsize(NameForPlayerId(selectedActionTargetIds[i]), 16) : "待选择", 16, TextAnchor.UpperLeft, FontStyle.Bold).color = selected ? new Color(1f, 0.84f, 0.42f, 0.98f) : new Color(1f, 0.76f, 0.38f, 0.90f);
            }
        }

        private static int GuessMinCount(ActionFormViewModel form)
        {
            if (form == null) return 1;
            if (form.minGuessCount > 0) return form.minGuessCount;
            return Mathf.Max(1, form.minTargetCount);
        }

        private static int GuessMaxCount(ActionFormViewModel form)
        {
            if (form == null) return 5;
            if (form.maxGuessCount > 0) return Mathf.Max(GuessMinCount(form), form.maxGuessCount);
            return Mathf.Max(GuessMinCount(form), 5);
        }

        private string ActionFormInstruction(ActionFormViewModel form)
        {
            if (form == null) return "";
            if (!form.available) return form.reason ?? "";
            if (form.inputType == "guesses") return $"加入 {GuessMinCount(form)}-{GuessMaxCount(form)} 组玩家 + 身份猜测后确认；提交时会一起发送。";
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
            if (form?.inputType == "guesses")
            {
                if (selectedActionGuesses.Count > 0)
                {
                    return string.Join("；", selectedActionGuesses.Select((entry) => $"{NameForPlayerId(entry.playerId)}={RoleNameForId(entry.roleId)}"));
                }
                var draft = new List<string>();
                if (selectedActionTargetIds.Count > 0) draft.Add($"玩家 {NameForPlayerId(selectedActionTargetIds[0])}");
                if (!string.IsNullOrWhiteSpace(selectedActionRoleId)) draft.Add($"身份 {RoleNameForId(selectedActionRoleId)}");
                return draft.Count == 0 ? "未加入猜测" : $"编辑中：{string.Join(" / ", draft)}";
            }
            var parts = new List<string>();
            if (selectedActionTargetIds.Count > 0) parts.Add($"{(IsPublicDayAction(form) ? PublicActionInputTitle(form) : "目标")} {string.Join(" / ", selectedActionTargetIds.Select(NameForPlayerId))}");
            if (!string.IsNullOrWhiteSpace(selectedActionRoleId)) parts.Add($"身份 {RoleNameForId(selectedActionRoleId)}");
            if (!string.IsNullOrWhiteSpace(selectedActionModeId)) parts.Add($"模式 {ActionModeLabel(form, selectedActionModeId)}");
            if (form != null && NeedsQuestion(form) && actionQuestionInput != null && !string.IsNullOrWhiteSpace(actionQuestionInput.text)) parts.Add($"{(IsPublicDayAction(form) ? PublicActionInputTitle(form) : "问题")} {actionQuestionInput.text}");
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
            if (form.inputType == "guesses") return selectedActionGuesses.Count >= GuessMinCount(form) && selectedActionGuesses.Count <= GuessMaxCount(form);
            var modeSkipsTargets = ActionFormModeSkipsTargetsInstance(form);
            if (NeedsTargets(form) && !modeSkipsTargets && selectedActionTargetIds.Count < form.minTargetCount) return false;
            if (NeedsRole(form) && string.IsNullOrWhiteSpace(selectedActionRoleId)) return false;
            if (NeedsQuestion(form) && !HasActionQuestionText()) return false;
            return true;
        }

        private string ActionFormStatus(ActionFormViewModel form)
        {
            if (form == null) return "";
            if (!form.available) return form.reason ?? "当前不可用。";
            if (IsPublicDayAction(form) && NeedsTargets(form) && selectedActionTargetIds.Count < form.minTargetCount) return $"还需要选择{PublicActionInputTitle(form)}。";
            if (form.inputType == "guesses" && selectedActionGuesses.Count < GuessMinCount(form)) return $"还需加入至少 {GuessMinCount(form)} 组玩家 + 身份猜测。";
            if (form.inputType == "guesses" && selectedActionGuesses.Count > GuessMaxCount(form)) return $"最多只能加入 {GuessMaxCount(form)} 组猜测。";
            var modeSkipsTargets = ActionFormModeSkipsTargetsInstance(form);
            if (NeedsTargets(form) && !modeSkipsTargets && selectedActionTargetIds.Count < form.minTargetCount) return $"还需选择至少 {form.minTargetCount} 个目标。";
            if (NeedsRole(form) && string.IsNullOrWhiteSpace(selectedActionRoleId)) return "还需选择身份。";
            if (NeedsQuestion(form) && !HasActionQuestionText()) return IsPublicDayAction(form)
                ? $"还需填写公开声明，至少 {ActionQuestionMinLength} 个字符。"
                : $"还需填写要询问 Storyteller 的问题，至少 {ActionQuestionMinLength} 个字符。";
            if (NeedsMode(form) && string.IsNullOrWhiteSpace(selectedActionModeId) && (form.modes?.Length ?? 0) > 0) return "可选择一个模式；未选则使用默认模式。";
            if (IsPublicDayAction(form)) return "可以公开发动；提交后会结算并写入公开时间线。";
            return "可以确认发送；提交后按当前规则结算。";
        }

        private string ActionQuestionText()
        {
            var text = actionQuestionInput == null ? actionQuestionDraftText : actionQuestionInput.text;
            return (text ?? "").Trim();
        }

        private bool HasActionQuestionText()
        {
            return ActionQuestionText().Length >= ActionQuestionMinLength;
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
            var isPublicAction = IsPublicDayAction(form);
            var canSubmit = CanSubmitActionForm(form);
            if (actionFormAutoButton != null) actionFormAutoButton.gameObject.SetActive(!isPublicAction);
            var submitLabel = ToolButtonLabel(actionFormSubmitButton);
            if (submitLabel != null) submitLabel.text = ActionFormSubmitButtonLabel(form, isPublicAction, canSubmit);
            SetToolButtonEnabled(actionFormAutoButton, form != null && form.available && !isPublicAction);
            SetToolButtonEnabled(actionFormSubmitButton, canSubmit);
            SetButtonSuggested(actionFormSubmitButton, canSubmit);
            SetButtonSuggested(actionFormAutoButton, form != null && form.available && !isPublicAction && !canSubmit);
        }

        private string ActionFormSubmitButtonLabel(ActionFormViewModel form, bool isPublicAction, bool canSubmit)
        {
            if (form == null || !form.available) return "不可用";
            if (canSubmit) return isPublicAction ? PublicActionConfirmText(form) : "确认发送";
            if (form.inputType == "guesses")
            {
                var hasDraft = selectedActionTargetIds.Count > 0 && !string.IsNullOrWhiteSpace(selectedActionRoleId);
                if (selectedActionGuesses.Count < GuessMinCount(form)) return hasDraft ? "先加入猜测" : "待加入猜测";
                if (selectedActionGuesses.Count > GuessMaxCount(form)) return "减少猜测";
            }
            var modeSkipsTargets = ActionFormModeSkipsTargetsInstance(form);
            if (NeedsTargets(form) && !modeSkipsTargets && selectedActionTargetIds.Count < form.minTargetCount)
            {
                return IsPublicDayAction(form) ? $"待选择{PublicActionInputTitle(form)}" : "待选目标";
            }
            if (NeedsRole(form) && string.IsNullOrWhiteSpace(selectedActionRoleId)) return "待选身份";
            if (NeedsQuestion(form) && !HasActionQuestionText()) return isPublicAction ? "待填写声明" : "待填写问题";
            return isPublicAction ? PublicActionConfirmText(form) : "确认发送";
        }

        private void SendActiveActionFormAuto()
        {
            var form = ActiveActionForm();
            if (form == null || string.IsNullOrWhiteSpace(form.id)) return;
            if (IsPublicDayAction(form)) return;
            if (NeedsTargets(form) && !ActionFormModeSkipsTargetsInstance(form))
            {
                var autoTargets = AutomaticActionTargetIds(form);
                if (autoTargets.Count == 0) return;
                selectedActionTargetIds.Clear();
                selectedActionTargetIds.AddRange(autoTargets);
                RenderActiveActionSurface();
                RenderGrimoire();
                return;
            }
            SendUnityAction(form.id);
            FinishActionFormSend(form, "已提交：自动使用当前合法默认选择。");
        }

        private List<string> AutomaticActionTargetIds(ActionFormViewModel form)
        {
            var targetCount = Mathf.Max(0, form?.minTargetCount ?? 0);
            if (targetCount == 0) targetCount = Mathf.Max(0, form?.targetCount ?? 0);
            if (targetCount == 0) targetCount = 1;

            var ids = new List<string>();
            void AddIfUsable(string id)
            {
                if (string.IsNullOrWhiteSpace(id)) return;
                if (ids.Contains(id)) return;
                if (!IsLegalActionTarget(id)) return;
                ids.Add(id);
            }

            foreach (var id in selectedActionTargetIds) AddIfUsable(id);
            foreach (var id in form?.selectedTargetIds ?? Array.Empty<string>()) AddIfUsable(id);
            foreach (var option in form?.options ?? Array.Empty<ActionOptionViewModel>()) AddIfUsable(option?.id ?? "");

            return ids.Take(targetCount).ToList();
        }

        private void ToggleActionFormTarget(string targetId)
        {
            var form = ActiveActionForm();
            if (form == null) return;
            if (form.inputType == "guesses")
            {
                if (selectedActionTargetIds.Count == 1 && selectedActionTargetIds[0] == targetId)
                {
                    selectedActionTargetIds.Clear();
                }
                else
                {
                    selectedActionTargetIds.Clear();
                    selectedActionTargetIds.Add(targetId);
                    var existing = selectedActionGuesses.FirstOrDefault((entry) => entry.playerId == targetId);
                    if (existing != null) selectedActionRoleId = existing.roleId;
                }
                RenderActiveActionSurface();
                return;
            }
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
            if (ActiveActionForm()?.inputType == "guesses") selectedActionRoleId = "";
            RenderActiveActionSurface();
            RenderGrimoire();
        }

        private void AddOrUpdateActionGuess(ActionFormViewModel form)
        {
            var playerId = selectedActionTargetIds.Count == 0 ? "" : selectedActionTargetIds[0];
            if (string.IsNullOrWhiteSpace(playerId) || string.IsNullOrWhiteSpace(selectedActionRoleId))
            {
                dialogueTitle.text = "猜测未加入";
                dialogueBody.text = "请先选择一名玩家和一个身份。";
                return;
            }

            var existingIndex = selectedActionGuesses.FindIndex((entry) => entry.playerId == playerId);
            if (existingIndex >= 0)
            {
                selectedActionGuesses[existingIndex].roleId = selectedActionRoleId;
            }
            else
            {
                if (selectedActionGuesses.Count >= GuessMaxCount(form))
                {
                    dialogueTitle.text = "猜测未加入";
                    dialogueBody.text = $"最多只能加入 {GuessMaxCount(form)} 组猜测。";
                    return;
                }
                selectedActionGuesses.Add(new ActionGuessSelection { playerId = playerId, roleId = selectedActionRoleId });
            }

            selectedActionTargetIds.Clear();
            selectedActionRoleId = "";
            RenderActiveActionSurface();
        }

        private void RemoveActionGuess(int index)
        {
            if (index < 0 || index >= selectedActionGuesses.Count) return;
            selectedActionGuesses.RemoveAt(index);
            RenderActiveActionSurface();
        }

        private void ClearActionGuesses()
        {
            selectedActionGuesses.Clear();
            selectedActionTargetIds.Clear();
            selectedActionRoleId = "";
            RenderActiveActionSurface();
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
                if (selectedActionGuesses.Count < GuessMinCount(form))
                {
                    dialogueTitle.text = $"{form.title}未发送";
                    dialogueBody.text = $"还需要先加入至少 {GuessMinCount(form)} 组玩家 + 身份猜测。";
                    return;
                }
                SendUnityAction(form.id, targetIds: selectedActionGuesses.Select((entry) => entry.playerId), guesses: selectedActionGuesses);
                FinishActionFormSend(form, $"已提交：{ActionFormSelectionText(form)}。");
                return;
            }
            else if (NeedsQuestion(form))
            {
                var question = ActionQuestionText();
                if (!HasActionQuestionText())
                {
                    dialogueTitle.text = $"{form.title}未发送";
                    dialogueBody.text = IsPublicDayAction(form)
                        ? $"请先填写公开声明，至少 {ActionQuestionMinLength} 个字符。"
                        : $"请先填写要询问 Storyteller 的问题，至少 {ActionQuestionMinLength} 个字符。";
                    RefreshActionFormReadiness(form);
                    return;
                }
                SendUnityAction(form.id, text: question);
                FinishActionFormSend(form, $"已提交：{ActionFormSelectionText(form)}。");
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
                FinishActionFormSend(form, $"已提交：{ActionFormSelectionText(form)}。");
                return;
            }
        }

        private void FinishActionFormSend(ActionFormViewModel form, string message)
        {
            var isNight = form?.id == "night-action";
            var isPublicAction = IsPublicDayAction(form);
            var title = isPublicAction ? PublicActionTitle(form) : form?.title ?? "行动表单";
            CloseActionFormPanel();
            dialogueTitle.text = isPublicAction ? "公开发动已提交" : $"{title}已发送";
            dialogueBody.text = isPublicAction ? $"{PublicActionConfirmText(form)} 已提交；公开时间线会立即刷新。" : message;
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
            dialogueBody.text = $"已提交：{string.Join(" / ", selectedActionTargetIds.Select(NameForPlayerId))}。";
        }

        private void SendActionFormRole(string roleId)
        {
            var form = ActiveActionForm();
            if (form == null) return;
            SendUnityAction(form.id, roleId: roleId);
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = $"已提交：选择身份 {RoleNameForId(roleId)}。";
        }

        private void SendActionFormMode(string mode)
        {
            var form = ActiveActionForm();
            if (form == null) return;
            SendUnityAction(form.id, mode: mode);
            dialogueTitle.text = $"{form.title}已发送";
            dialogueBody.text = $"已提交：选择模式 {mode}。";
        }
    }
}
