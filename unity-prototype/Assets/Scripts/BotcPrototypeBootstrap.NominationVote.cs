using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {

        private void BuildPhaseAssistPanel()
        {
            phaseAssistPanel = AddPanel("Phase Assist Panel", canvas.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-560f, -168f), new Vector2(560f, -8f), new Color(0.17f, 0.095f, 0.040f, 0.56f)).GetComponent<RectTransform>();
            AddFrame(phaseAssistPanel, "Phase Assist Frame", 0.9f, new Color(1f, 0.72f, 0.34f, 0.24f));
            var headerWash = AddImage("Phase Assist Header Wash", phaseAssistPanel, new Vector2(0f, 1f), Vector2.one, new Vector2(1f, -58f), new Vector2(-1f, -1f), new Color(1f, 0.74f, 0.34f, 0.070f));
            headerWash.raycastTarget = false;
            var badge = AddPanel("Phase Assist Badge", phaseAssistPanel, Vector2.zero, Vector2.one, new Vector2(24f, 88f), new Vector2(-1004f, -16f), new Color(0.11f, 0.070f, 0.026f, 0.68f));
            AddFrame(badge.transform, "Phase Assist Badge Frame", 0.7f, new Color(1f, 0.76f, 0.34f, 0.22f));
            phaseAssistBadgeImage = badge.GetComponent<Image>();
            phaseAssistBadgeText = AddText("Phase Assist Badge Text", badge.transform, Vector2.zero, Vector2.one, new Vector2(8f, 0f), new Vector2(-8f, 0f), "流程", 14, TextAnchor.MiddleCenter, FontStyle.Bold);
            phaseAssistBadgeText.color = new Color(1f, 0.82f, 0.42f, 0.98f);
            badge.gameObject.SetActive(false);
            phaseAssistProgressTrack = AddImage("Phase Assist Track", phaseAssistPanel, Vector2.zero, Vector2.zero, new Vector2(24f, 46f), new Vector2(560f, 51f), new Color(0.62f, 0.48f, 0.30f, 0.18f));
            phaseAssistProgressFill = AddImage("Phase Assist Progress", phaseAssistPanel, Vector2.zero, Vector2.zero, new Vector2(24f, 46f), new Vector2(86f, 51f), new Color(1f, 0.72f, 0.30f, 0.62f));
            phaseAssistProgressKnob = AddImage("Phase Assist Progress Knob", phaseAssistPanel, Vector2.zero, Vector2.zero, new Vector2(81f, 43f), new Vector2(91f, 55f), new Color(1f, 0.82f, 0.42f, 0.86f));
            phaseAssistProgressKnob.sprite = GetCircleFillSprite();
            phaseAssistProgressKnob.preserveAspect = true;
            phaseAssistProgressText = AddText("Phase Assist Progress Text", phaseAssistPanel, Vector2.zero, Vector2.zero, new Vector2(790f, 88f), new Vector2(932f, 110f), "", 12, TextAnchor.UpperRight, FontStyle.Bold);
            phaseAssistProgressText.color = new Color(1f, 0.82f, 0.42f, 0.86f);
            phaseAssistTitleText = AddText("Phase Assist Title", phaseAssistPanel, Vector2.zero, Vector2.one, new Vector2(24f, 88f), new Vector2(-246f, -10f), "流程提示", 19, TextAnchor.UpperLeft, FontStyle.Bold);
            phaseAssistHintText = AddText("Phase Assist Hint", phaseAssistPanel, Vector2.zero, Vector2.one, new Vector2(24f, 64f), new Vector2(-246f, -42f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            phaseAssistSignalRoot = AddPanel("Phase Assist Signal Strip", phaseAssistPanel, Vector2.zero, Vector2.one, new Vector2(610f, 78f), new Vector2(-24f, -12f), new Color(0.22f, 0.135f, 0.060f, 0.34f)).GetComponent<RectTransform>();
            phaseAssistPrimaryButton = AddToolActionButton("▶", "推进", phaseAssistPanel, new Vector2(634f, 32f), new Vector2(104f, 36f), PhaseAssistPrimaryAction, true);
            phaseAssistSecondaryButton = AddToolActionButton("◇", "提名", phaseAssistPanel, new Vector2(746f, 32f), new Vector2(104f, 36f), PhaseAssistSecondaryAction, true);
            phaseAssistTertiaryButton = AddToolActionButton("○", "空过", phaseAssistPanel, new Vector2(858f, 32f), new Vector2(104f, 36f), PhaseAssistTertiaryAction, true);
            phaseAssistPrimaryLabel = ToolButtonLabel(phaseAssistPrimaryButton);
            phaseAssistSecondaryLabel = ToolButtonLabel(phaseAssistSecondaryButton);
            phaseAssistTertiaryLabel = ToolButtonLabel(phaseAssistTertiaryButton);
            publicSpeechInput = AddInputField("Public Speech Input", phaseAssistPanel, new Vector2(24f, 14f), new Vector2(570f, 48f), "输入你的公聊发言");
            publicSpeechInput.characterLimit = 180;
            var publicSpeechInputImage = publicSpeechInput.GetComponent<Image>();
            if (publicSpeechInputImage != null) publicSpeechInputImage.color = new Color(0.17f, 0.095f, 0.040f, 0.74f);
            publicSpeechInput.gameObject.SetActive(false);
            phaseAssistPanel.gameObject.SetActive(false);
        }


        private void BuildNominationDebatePanel()
        {
            nominationDebatePanel = AddPanel("Nomination Debate Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-760f, 364f), new Vector2(760f, 642f), new Color(0.17f, 0.095f, 0.040f, 0.78f)).GetComponent<RectTransform>();
            AddFrame(nominationDebatePanel, "Nomination Debate Frame", 1f, new Color(0.92f, 0.62f, 0.28f, 0.36f));
            AddImage("Nomination Debate Header Wash", nominationDebatePanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -52f), new Vector2(-1f, -1f), new Color(1f, 0.72f, 0.30f, 0.10f));
            AddImage("Nomination Debate Action Wash", nominationDebatePanel, new Vector2(1f, 0f), Vector2.one, new Vector2(-288f, 1f), new Vector2(-1f, -1f), new Color(0.32f, 0.16f, 0.050f, 0.26f));
            nominationDebateTitleText = AddText("Nomination Debate Title", nominationDebatePanel, Vector2.zero, Vector2.one, new Vector2(26f, 232f), new Vector2(-420f, -12f), "提名互辩", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            nominationDebateStatusText = AddText("Nomination Debate Status", nominationDebatePanel, Vector2.zero, Vector2.one, new Vector2(1036f, 236f), new Vector2(-270f, -14f), "", 13, TextAnchor.UpperRight, FontStyle.Bold);
            nominationDebateFocusRoot = AddPanel("Nomination Debate Focus Strip", nominationDebatePanel, Vector2.zero, Vector2.one, new Vector2(520f, 218f), new Vector2(-500f, -14f), new Color(0.22f, 0.135f, 0.060f, 0.34f)).GetComponent<RectTransform>();
            nominationDebateBodyText = AddText("Nomination Debate Body", nominationDebatePanel, Vector2.zero, Vector2.one, new Vector2(28f, 70f), new Vector2(-326f, -56f), "", 16, TextAnchor.UpperLeft, FontStyle.Normal);
            nominationDebateDuelRoot = AddPanel("Nomination Debate Duel Rail", nominationDebatePanel, Vector2.zero, Vector2.one, new Vector2(1264f, 198f), new Vector2(-20f, -24f), new Color(0.20f, 0.120f, 0.052f, 0.46f)).GetComponent<RectTransform>();
            nominationDebateCardRoot = AddPanel("Nomination Debate Cards", nominationDebatePanel, Vector2.zero, Vector2.one, new Vector2(24f, 68f), new Vector2(-318f, -58f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            nominationDebateResponseInput = AddInputField("Nomination Debate Response Input", nominationDebatePanel, new Vector2(28f, 18f), new Vector2(1030f, 56f), "输入你的互辩回应");
            nominationDebateResponseButton = AddButton("回应", nominationDebatePanel, new Vector2(1124f, 36f), new Vector2(128f, 36f), SubmitNominationDebateResponse);
            AddToolActionButton("赞", "投赞成", nominationDebatePanel, new Vector2(1386f, 190f), new Vector2(196f, 48f), () => ResolveNominationDebateToVote(true));
            AddToolActionButton("弃", "不投票", nominationDebatePanel, new Vector2(1386f, 134f), new Vector2(196f, 48f), () => ResolveNominationDebateToVote(false));
            AddToolActionButton("线", "看时间线", nominationDebatePanel, new Vector2(1386f, 82f), new Vector2(196f, 34f), () => ShowInfoDrawer("timeline"), true);
            AddToolActionButton("收", "收起", nominationDebatePanel, new Vector2(1386f, 42f), new Vector2(196f, 34f), () => nominationDebatePanel.gameObject.SetActive(false), true);
            nominationDebatePanel.gameObject.SetActive(false);
        }


        private void BuildVotePanel()
        {
            votePanel = AddPanel("Vote Panel", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            var votePanelImage = votePanel.GetComponent<Image>();
            if (votePanelImage != null) votePanelImage.raycastTarget = false;
            var centerShade = AddImage("Vote Center Shade", votePanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-440f, -302f), new Vector2(440f, 294f), new Color(0f, 0f, 0f, 0.56f));
            centerShade.raycastTarget = false;
            AddFrame(centerShade.transform, "Vote Center Shade Frame", 0.8f, new Color(0.92f, 0.62f, 0.28f, 0.22f));
            voteTitle = AddText("Vote Title", votePanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-270f, 226f), new Vector2(270f, 270f), "投票仪式", 30, TextAnchor.MiddleCenter, FontStyle.Bold);
            var statusPlate = AddImage("Vote Status Plate", votePanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-212f, -286f), new Vector2(212f, -176f), new Color(0.005f, 0.010f, 0.014f, 0.76f));
            statusPlate.raycastTarget = false;
            AddFrame(statusPlate.transform, "Vote Status Plate Frame", 0.7f, new Color(0.92f, 0.62f, 0.28f, 0.38f));
            voteBody = AddText("Vote Body", votePanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-194f, -280f), new Vector2(194f, -188f), "", 18, TextAnchor.MiddleCenter, FontStyle.Bold);
            statusPlate.gameObject.SetActive(false);
            voteBody.gameObject.SetActive(false);
            voteAnimationRoot = AddPanel("Vote Animation Root", votePanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-520f, -350f), new Vector2(520f, 350f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            voteAnimationRowsRoot = AddPanel("Vote Animation Rows", votePanel, Vector2.zero, Vector2.zero, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            var replayButton = AddToolActionButton("播", "重播", votePanel, Vector2.zero, new Vector2(104f, 36f), () => RestartVoteAnimation(), true);
            var closeButton = AddToolActionButton("关", "关闭", votePanel, Vector2.zero, new Vector2(104f, 36f), CloseVotePanel, true);
            PlaceVoteChromeButton(replayButton, new Vector2(-118f, 26f), new Vector2(104f, 36f));
            PlaceVoteChromeButton(closeButton, new Vector2(-118f, -20f), new Vector2(104f, 36f));
            votePanel.gameObject.SetActive(false);
        }

        private void PlaceVoteChromeButton(Button button, Vector2 centerOffset, Vector2 size)
        {
            var rect = button == null ? null : button.transform as RectTransform;
            if (rect == null) return;
            var half = size * 0.5f;
            SetRect(rect, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), centerOffset - half, centerOffset + half);
        }

        private void CloseVotePanel()
        {
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            ApplyVoteChromeVisibility();
            RenderGrimoire();
            ApplyBottomDockVisibility();
            ApplyModalBackdropVisibility();
        }


        private void ApplyVoteChromeVisibility()
        {
            ApplyFocusChromeVisibility();
        }


        private string BuildVoteCeremonyText()
        {
            var vote = vm.voteCeremony;
            if (vote == null || string.IsNullOrWhiteSpace(vote.nomineeId)) return "";
            var voters = vote.voters ?? Array.Empty<VoteViewModel>();
            var raised = voters.Where((entry) => entry.vote).Take(6).Select((entry) => entry.voterName);
            return $"投票仪式：{vote.nominatorName} -> {vote.nomineeName}\n{vote.resultText}\n举手：{string.Join(" / ", raised)}";
        }


        private void RenderPhaseAssistPanel()
        {
            if (phaseAssistPanel == null) return;
            var conversation = vm?.publicConversation;
            var clock = vm?.nominationClock;
            var debate = vm?.nominationDebate;
            var showPublic = conversation != null && conversation.active;
            var showNomination = clock != null && (clock.active || vm?.dayStage == "nomination");
            var showDebate = debate != null && debate.active;
            var voteOpen = votePanel != null && votePanel.gameObject.activeSelf;
            var visible = gameplayEntered && !voteOpen && !showDebate && !GameplayOverlayOpen() && (showPublic || showNomination);
            phaseAssistPanel.gameObject.SetActive(visible);
            ApplyBottomDockVisibility();
            ApplyFocusChromeVisibility();
            if (!visible)
            {
                SetPublicSpeechInputVisible(false);
                SetPhaseAssistProgressVisible(false);
                if (phaseAssistSignalRoot != null) phaseAssistSignalRoot.gameObject.SetActive(false);
                return;
            }

            phaseAssistPanel.SetAsLastSibling();
            if (showDebate)
            {
                SetPublicSpeechInputVisible(false);
                if (phaseAssistProgressText != null) phaseAssistProgressText.gameObject.SetActive(true);
                if (phaseAssistTitleText != null) phaseAssistTitleText.text = "提名互辩";
                if (phaseAssistHintText != null) phaseAssistHintText.text = $"{debate.nominatorName} 提名 {debate.nomineeName}，读完双方陈述后进入投票。";
                SetPhaseAssistStatus("互辩", "投票就绪", new Color(0.18f, 0.090f, 0.040f, 0.90f), new Color(1f, 0.72f, 0.32f, 0.98f));
                SetPhaseAssistProgressVisible(true);
                SetPhaseAssistProgress(1f);
                SetPhaseAssistButtons("投赞成", "不投票", "空过", true, true, false);
                RenderPhaseAssistSignalStrip(conversation, clock, debate);
                return;
            }

            if (showNomination)
            {
                if (phaseAssistProgressText != null) phaseAssistProgressText.gameObject.SetActive(true);
                var total = Mathf.Max(1, clock?.totalTicks ?? 0);
                var remaining = Mathf.Clamp(clock?.ticksRemaining ?? 0, 0, total);
                var elapsed = clock != null && clock.active ? 1f - remaining / (float)total : 0.08f;
                var status = clock?.status ?? "idle";
                var closed = status == "expired" || status == "passed";
                SetPublicSpeechInputVisible(!closed);
                if (phaseAssistTitleText != null) phaseAssistTitleText.text = status == "expired" || status == "passed" ? "提名窗口 · 今日空过" : "提名窗口";
                if (phaseAssistHintText != null)
                {
                    phaseAssistHintText.text = status == "expired" || status == "passed"
                        ? "窗口已耗尽；可以空过今日进入夜晚。"
                        : $"剩余 {remaining}/{total} 步。选中一名玩家后可由你提名，也可以让 AI 主动提名。";
                }
                SetPhaseAssistStatus(closed ? "结束" : "提名", closed ? "窗口已结束" : $"剩余 {remaining}/{total}", closed ? new Color(0.16f, 0.080f, 0.040f, 0.90f) : new Color(0.055f, 0.14f, 0.080f, 0.90f), closed ? new Color(1f, 0.70f, 0.34f, 0.98f) : new Color(0.78f, 1f, 0.72f, 0.98f));
                SetPhaseAssistProgressVisible(true);
                SetPhaseAssistProgress(closed ? 1f : Mathf.Clamp01(elapsed));
                var hasExecutionCandidate = vm?.executionCandidate != null && vm.executionCandidate.active;
                if (vm?.phaseAdvance != null && vm.phaseAdvance.targetStage == "night" && (hasExecutionCandidate || closed))
                {
                    SetPhaseAssistButtons(FirstNonEmpty(vm.phaseAdvance.label, "Night"), "Nominate", "Pass", true, true, true);
                    RenderPhaseAssistSignalStrip(conversation, clock, debate);
                    return;
                }
                SetPhaseAssistButtons("AI 提名", "你提名", "空过", true, true, true);
                RenderPhaseAssistSignalStrip(conversation, clock, debate);
                return;
            }

            SetPublicSpeechInputVisible(true);
            if (phaseAssistProgressText != null) phaseAssistProgressText.gameObject.SetActive(false);
            var pressure = Mathf.RoundToInt(Mathf.Clamp01(conversation.pressure) * 100f);
            SetPhaseAssistStatus("公聊", $"压力 {pressure}%", pressure >= 85 ? new Color(0.22f, 0.075f, 0.040f, 0.90f) : new Color(0.050f, 0.095f, 0.15f, 0.90f), pressure >= 85 ? new Color(1f, 0.66f, 0.36f, 0.98f) : new Color(0.70f, 0.90f, 1f, 0.96f));
            SetPhaseAssistProgress(Mathf.Clamp01(conversation.pressure));
            SetPhaseAssistProgressVisible(false);
            if (phaseAssistTitleText != null)
            {
                var speaker = FirstNonEmpty(conversation.speakerName, NameForPlayerId(conversation.speakerId), "AI");
                var focus = FirstNonEmpty(conversation.focusName, NameForPlayerId(conversation.focusId), "全桌");
                phaseAssistTitleText.text = $"公聊 · {speaker} -> {focus}";
            }
            if (phaseAssistHintText != null)
            {
                var latestLine = FirstNonEmpty(vm?.dialogueText, publicSpeechStatus, "先听一轮公聊，再决定是否追问或开启提名。");
                var actionHint = string.IsNullOrWhiteSpace(publicSpeechStatus)
                    ? "下一步：AI 接话、开提名窗，或输入你的发言。"
                    : publicSpeechStatus;
                phaseAssistHintText.text = ClampTextBlock($"{Ellipsize(latestLine, 64)}\n{actionHint}", 2, 74);
            }
            SetPhaseAssistButtons("AI 接话", "开提名窗", "你发言", true, true, true);
            if (phaseAssistSignalRoot != null) phaseAssistSignalRoot.gameObject.SetActive(false);
        }


        private void RenderPhaseAssistSignalStrip(PublicConversationViewModel conversation, NominationClockViewModel clock, NominationDebateViewModel debate)
        {
            if (phaseAssistSignalRoot == null) return;
            phaseAssistSignalRoot.gameObject.SetActive(true);
            ClearChildren(phaseAssistSignalRoot);
            AddFrame(phaseAssistSignalRoot, "Phase Assist Signal Frame", 0.55f, new Color(1f, 0.78f, 0.40f, 0.16f));

            if (debate != null && debate.active)
            {
                AddPhaseAssistSignalChip(phaseAssistSignalRoot, "路线", PhaseAssistRouteLabel(debate), 10f, 116f, new Color(0.82f, 0.38f, 0.12f, 0.70f));
                AddPhaseAssistSignalChip(phaseAssistSignalRoot, "状态", NominationDebateDuelStateLabel(debate), 126f, 100f, new Color(0.96f, 0.70f, 0.26f, 0.62f));
                AddPhaseAssistSignalChip(phaseAssistSignalRoot, "下一步", "投票", 226f, 104f, new Color(0.70f, 0.44f, 0.88f, 0.58f));
                return;
            }

            if (clock != null && (clock.active || vm?.dayStage == "nomination"))
            {
                var total = Mathf.Max(1, clock.totalTicks);
                var remaining = Mathf.Clamp(clock.ticksRemaining, 0, total);
                var closed = clock.status == "expired" || clock.status == "passed";
                AddPhaseAssistSignalChip(phaseAssistSignalRoot, "窗口", PhaseAssistNominationStatusLabel(clock.status), 10f, 108f, closed ? new Color(0.64f, 0.34f, 0.16f, 0.66f) : new Color(0.22f, 0.52f, 0.30f, 0.60f));
                AddPhaseAssistSignalChip(phaseAssistSignalRoot, "余量", closed ? "0" : $"{remaining}/{total}", 118f, 86f, new Color(0.96f, 0.70f, 0.26f, 0.62f));
                AddPhaseAssistSignalChip(phaseAssistSignalRoot, "下一步", closed ? "进夜" : "选目标", 204f, 126f, closed ? new Color(0.70f, 0.44f, 0.88f, 0.58f) : new Color(0.72f, 0.86f, 0.96f, 0.48f));
                return;
            }

            var speaker = FirstNonEmpty(conversation?.speakerName, NameForPlayerId(conversation?.speakerId), "AI");
            var focus = FirstNonEmpty(conversation?.focusName, NameForPlayerId(conversation?.focusId), "全桌");
            AddPhaseAssistSignalChip(phaseAssistSignalRoot, "说话", Ellipsize(speaker, 7), 10f, 100f, new Color(0.28f, 0.50f, 0.82f, 0.60f));
            AddPhaseAssistSignalChip(phaseAssistSignalRoot, "焦点", Ellipsize(focus, 7), 110f, 100f, new Color(0.82f, 0.48f, 0.18f, 0.62f));
            AddPhaseAssistSignalChip(phaseAssistSignalRoot, "下一步", PhaseAssistPublicActionLabel(conversation), 210f, 120f, new Color(0.42f, 0.62f, 0.42f, 0.54f));
        }


        private void AddPhaseAssistSignalChip(Transform parent, string label, string value, float x, float width, Color accent)
        {
            var chip = AddPanel($"Phase Assist Signal Chip {label}", parent, Vector2.zero, Vector2.zero, new Vector2(x, 7f), new Vector2(x + width, 29f), new Color(0.24f, 0.145f, 0.065f, 0.58f));
            AddFrame(chip.transform, "Phase Assist Signal Chip Frame", 0.45f, new Color(1f, 0.78f, 0.40f, 0.14f));
            AddImage("Phase Assist Signal Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), accent);
            AddText("Phase Assist Signal Chip Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(8f, 0f), new Vector2(-52f, 0f), label, 9, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.88f, 0.78f, 0.62f, 0.84f);
            AddText("Phase Assist Signal Chip Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(42f, 0f), new Vector2(-8f, 0f), value, 10, TextAnchor.MiddleRight, FontStyle.Bold).color = new Color(1f, 0.90f, 0.66f, 0.94f);
        }


        private string PhaseAssistRouteLabel(NominationDebateViewModel debate)
        {
            if (debate == null) return "待定";
            var nominator = Ellipsize(FirstNonEmpty(debate.nominatorName, NameForPlayerId(debate.nominatorId), "提名"), 4);
            var nominee = Ellipsize(FirstNonEmpty(debate.nomineeName, NameForPlayerId(debate.nomineeId), "目标"), 4);
            return $"{nominator}->{nominee}";
        }


        private static string PhaseAssistNominationStatusLabel(string status)
        {
            if (status == "expired") return "耗尽";
            if (status == "passed") return "空过";
            if (status == "nomination-made") return "已提";
            if (status == "active") return "开启";
            return "待提";
        }


        private static string PhaseAssistPublicActionLabel(PublicConversationViewModel conversation)
        {
            var actions = conversation?.suggestedActions ?? Array.Empty<string>();
            var first = actions.FirstOrDefault((entry) => !string.IsNullOrWhiteSpace(entry)) ?? "";
            if (first.Contains("nomination")) return "开提名";
            if (first.Contains("followup") || first.Contains("addressed")) return "追问";
            if (first.Contains("continue")) return "AI接话";
            return conversation != null && conversation.canContinue ? "AI接话" : "等待";
        }


        private void SetPublicSpeechInputVisible(bool visible)
        {
            if (publicSpeechInput != null) publicSpeechInput.gameObject.SetActive(visible);
        }

        private void SetPhaseAssistProgressVisible(bool visible)
        {
            if (phaseAssistProgressTrack != null) phaseAssistProgressTrack.gameObject.SetActive(visible);
            if (phaseAssistProgressFill != null) phaseAssistProgressFill.gameObject.SetActive(visible);
            if (phaseAssistProgressKnob != null) phaseAssistProgressKnob.gameObject.SetActive(visible);
        }


        private void SetPhaseAssistButtons(string primary, string secondary, string tertiary, bool primaryVisible, bool secondaryVisible, bool tertiaryVisible)
        {
            if (phaseAssistPrimaryButton != null) phaseAssistPrimaryButton.gameObject.SetActive(primaryVisible);
            if (phaseAssistSecondaryButton != null) phaseAssistSecondaryButton.gameObject.SetActive(secondaryVisible);
            if (phaseAssistTertiaryButton != null) phaseAssistTertiaryButton.gameObject.SetActive(tertiaryVisible);
            if (phaseAssistPrimaryLabel != null) phaseAssistPrimaryLabel.text = primary;
            if (phaseAssistSecondaryLabel != null) phaseAssistSecondaryLabel.text = secondary;
            if (phaseAssistTertiaryLabel != null) phaseAssistTertiaryLabel.text = tertiary;
        }


        private void SetPhaseAssistStatus(string badge, string detail, Color badgeFill, Color textColor)
        {
            if (phaseAssistBadgeImage != null) phaseAssistBadgeImage.color = badgeFill;
            if (phaseAssistBadgeText != null)
            {
                phaseAssistBadgeText.text = string.IsNullOrWhiteSpace(badge) ? "流程" : badge;
                phaseAssistBadgeText.color = textColor;
            }
            if (phaseAssistProgressText != null)
            {
                phaseAssistProgressText.text = detail ?? "";
                phaseAssistProgressText.color = textColor;
            }
        }


        private void SetPhaseAssistProgress(float value)
        {
            if (phaseAssistProgressFill == null) return;
            var clamped = Mathf.Clamp01(value);
            phaseAssistProgressFill.rectTransform.offsetMin = new Vector2(24f, 46f);
            phaseAssistProgressFill.rectTransform.offsetMax = new Vector2(Mathf.Lerp(86f, 560f, clamped), 52f);
            phaseAssistProgressFill.color = clamped >= 0.85f
                ? new Color(1f, 0.45f, 0.22f, 0.70f)
                : new Color(1f, 0.72f, 0.30f, 0.62f);
            if (phaseAssistProgressKnob != null)
            {
                var x = Mathf.Lerp(86f, 560f, clamped);
                var knobRect = phaseAssistProgressKnob.rectTransform;
                knobRect.offsetMin = new Vector2(x - 5f, 43f);
                knobRect.offsetMax = new Vector2(x + 5f, 55f);
                phaseAssistProgressKnob.color = clamped >= 0.85f
                    ? new Color(1f, 0.62f, 0.34f, 0.94f)
                    : new Color(1f, 0.82f, 0.42f, 0.88f);
            }
        }


        private void UpdatePhaseAssistProgress()
        {
            if (phaseAssistPanel == null || !phaseAssistPanel.gameObject.activeSelf) return;
            if (vm?.nominationClock != null && (vm.nominationClock.active || vm.dayStage == "nomination"))
            {
                var total = Mathf.Max(1, vm.nominationClock.totalTicks);
                var remaining = Mathf.Clamp(vm.nominationClock.ticksRemaining, 0, total);
                if (phaseAssistProgressText != null) phaseAssistProgressText.text = vm.nominationClock.status == "expired" || vm.nominationClock.status == "passed" ? "窗口已结束" : $"剩余 {remaining}/{total}";
                SetPhaseAssistProgress(vm.nominationClock.status == "expired" || vm.nominationClock.status == "passed" ? 1f : 1f - remaining / (float)total);
            }
        }


        private void PhaseAssistPrimaryAction()
        {
            if (TrySendDefaultNightAction()) return;
            if (vm?.nominationDebate != null && vm.nominationDebate.active)
            {
                ResolveNominationDebateToVote(true);
                return;
            }
            if (vm?.dayStage == "nomination")
            {
                var status = vm?.nominationClock?.status ?? "";
                var windowClosed = status == "expired" || status == "passed";
                var hasExecutionCandidate = vm?.executionCandidate != null && vm.executionCandidate.active;
                if (vm?.phaseAdvance != null && vm.phaseAdvance.targetStage == "night" && (hasExecutionCandidate || windowClosed))
                {
                    RequestPhaseStage("night", FirstNonEmpty(vm.phaseAdvance.label, "Night"));
                    return;
                }
                SendUnityAction("auto-advance", mode: "decision");
                return;
            }
            publicSpeechStatus = "";
            SendUnityAction("auto-advance", mode: "decision");
        }


        private void PhaseAssistSecondaryAction()
        {
            if (vm?.nominationDebate != null && vm.nominationDebate.active)
            {
                ResolveNominationDebateToVote(false);
                return;
            }
            if (vm?.dayStage == "nomination")
            {
                SendHumanNominationIntent();
                return;
            }
            SendUnityAction("open-nomination-window");
        }


        private void PhaseAssistTertiaryAction()
        {
            if (vm?.dayStage == "nomination")
            {
                SendUnityAction("pass-nomination-window", toNight: false);
                return;
            }
            SubmitHumanPublicSpeech();
        }


        private void SubmitHumanPublicSpeech()
        {
            if (vm?.phase != "day" || vm?.dayStage != "public")
            {
                publicSpeechStatus = "当前不在公聊阶段。";
                RenderPhaseAssistPanel();
                return;
            }
            var text = publicSpeechInput == null ? "" : publicSpeechInput.text.Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                publicSpeechStatus = "先输入一句你想在公聊里说的话。";
                RenderPhaseAssistPanel();
                return;
            }
            var focus = SelectedPlayer();
            var focusId = focus != null && !focus.human ? focus.id : "";
            if (!SendUnityAction("human-public-speech", focusId, "", text, "human-public")) return;
            publicSpeechStatus = "已发送你的公聊发言；下一步可以让 AI 接话。";
            if (publicSpeechInput != null) publicSpeechInput.text = "";
            RenderPhaseAssistPanel();
        }


        private void SendHumanNominationIntent()
        {
            var target = SelectedPlayer();
            if (target == null || target.human)
            {
                dialogueTitle.text = "提名窗口";
                dialogueBody.text = "请先在魔典上选中一名非主视角玩家，再点击“你提名”。";
                tokenInspectorOpen = true;
                ApplyTokenInspectorVisibility();
                return;
            }
            var reason = publicSpeechInput == null ? "" : publicSpeechInput.text.Trim();
            if (SendUnityAction("human-nomination-intent", playerId: target.id, text: reason) && !string.IsNullOrWhiteSpace(reason))
            {
                publicSpeechInput.text = "";
            }
        }


        private void RenderNominationDebatePanel()
        {
            if (nominationDebatePanel == null) return;
            var debate = vm?.nominationDebate;
            var visible = gameplayEntered
                && debate != null
                && debate.active
                && (votePanel == null || !votePanel.gameObject.activeSelf)
                && !GameplayOverlayOpen()
                && (stageDialoguePanel == null || !stageDialoguePanel.gameObject.activeSelf);
            nominationDebatePanel.gameObject.SetActive(visible);
            ApplyBottomDockVisibility();
            ApplyFocusChromeVisibility();
            if (!visible) return;
            nominationDebatePanel.SetAsLastSibling();
            if (nominationDebateTitleText != null) nominationDebateTitleText.text = $"提名互辩 · {debate.nominatorName} → {debate.nomineeName}";
            if (nominationDebateStatusText != null) nominationDebateStatusText.text = BuildNominationDebateStatus(debate);
            if (nominationDebateBodyText != null)
            {
                nominationDebateBodyText.gameObject.SetActive(nominationDebateCardRoot == null);
                nominationDebateBodyText.text = BuildNominationDebateText(debate);
            }
            RenderNominationDebateFocusStrip(debate);
            RenderNominationDebateDuelRail(debate);
            RenderNominationDebateCards(debate);
            var canRespond = debate.canHumanRespond;
            if (nominationDebateResponseInput != null)
            {
                nominationDebateResponseInput.gameObject.SetActive(canRespond);
                if (canRespond && string.IsNullOrWhiteSpace(nominationDebateResponseInput.text))
                {
                    nominationDebateResponseInput.placeholder.GetComponent<Text>().text = string.IsNullOrWhiteSpace(debate.responsePrompt) ? "输入你的互辩回应" : debate.responsePrompt;
                }
            }
            if (nominationDebateResponseButton != null) nominationDebateResponseButton.gameObject.SetActive(canRespond);
        }


        private void RenderNominationDebateDuelRail(NominationDebateViewModel debate)
        {
            if (nominationDebateDuelRoot == null) return;
            var showDuelRail = false;
            if (!showDuelRail || debate == null)
            {
                nominationDebateDuelRoot.gameObject.SetActive(false);
                return;
            }

            nominationDebateDuelRoot.gameObject.SetActive(true);
            ClearChildren(nominationDebateDuelRoot);
            AddFrame(nominationDebateDuelRoot, "Nomination Debate Duel Frame", 0.65f, new Color(0.92f, 0.62f, 0.28f, 0.22f));
            AddImage("Nomination Debate Duel Accent", nominationDebateDuelRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(0.86f, 0.42f, 0.14f, 0.76f));

            var nominator = FirstNonEmpty(debate.nominatorName, NameForPlayerId(debate.nominatorId), "提名者");
            var nominee = FirstNonEmpty(debate.nomineeName, NameForPlayerId(debate.nomineeId), "被提名者");
            var lineCount = NominationDebateVisibleLineCount(debate);
            var stageIndex = NominationDebateDuelStageIndex(debate);
            var stageRatio = Mathf.Clamp01(stageIndex / 2f);

            AddText("Nomination Debate Duel Label", nominationDebateDuelRoot, Vector2.zero, Vector2.one, new Vector2(14f, 36f), new Vector2(-150f, -6f), "攻防轨", 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.96f);
            AddText("Nomination Debate Duel Meta", nominationDebateDuelRoot, Vector2.zero, Vector2.one, new Vector2(126f, 36f), new Vector2(-12f, -6f), $"{lineCount}条 · {NominationDebateDuelStateLabel(debate)}", 10, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.80f, 0.92f, 1f, 0.78f);
            AddText("Nomination Debate Duel Route", nominationDebateDuelRoot, Vector2.zero, Vector2.one, new Vector2(14f, 20f), new Vector2(-12f, -22f), $"{Ellipsize(nominator, 8)} → {Ellipsize(nominee, 8)}", 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.92f, 0.72f, 0.95f);

            const float trackLeft = 22f;
            const float trackRight = 214f;
            const float trackY = 12f;
            AddImage("Nomination Debate Duel Track", nominationDebateDuelRoot, Vector2.zero, Vector2.zero, new Vector2(trackLeft, trackY), new Vector2(trackRight, trackY + 3f), new Color(0.46f, 0.50f, 0.56f, 0.30f));
            AddImage("Nomination Debate Duel Fill", nominationDebateDuelRoot, Vector2.zero, Vector2.zero, new Vector2(trackLeft, trackY), new Vector2(Mathf.Lerp(trackLeft + 2f, trackRight, stageRatio), trackY + 3f), new Color(1f, 0.70f, 0.28f, 0.66f));
            AddNominationDebateDuelNode(nominationDebateDuelRoot, "Accuse", trackLeft, stageIndex == 0, stageIndex >= 0);
            AddNominationDebateDuelNode(nominationDebateDuelRoot, "Defense", (trackLeft + trackRight) * 0.5f, stageIndex == 1, stageIndex >= 1);
            AddNominationDebateDuelNode(nominationDebateDuelRoot, "Vote", trackRight, stageIndex == 2, stageIndex >= 2);
        }

        private void RenderNominationDebateFocusStrip(NominationDebateViewModel debate)
        {
            if (nominationDebateFocusRoot == null) return;
            var showFocusStrip = false;
            if (!showFocusStrip || debate == null)
            {
                nominationDebateFocusRoot.gameObject.SetActive(false);
                return;
            }

            nominationDebateFocusRoot.gameObject.SetActive(true);
            ClearChildren(nominationDebateFocusRoot);
            AddFrame(nominationDebateFocusRoot, "Nomination Debate Focus Frame", 0.55f, new Color(0.92f, 0.62f, 0.28f, 0.18f));

            var stageIndex = NominationDebateDuelStageIndex(debate);
            var stageRatio = Mathf.Clamp01(stageIndex / 2f);
            var nominator = FirstNonEmpty(debate.nominatorName, NameForPlayerId(debate.nominatorId), "Nominator");
            var nominee = FirstNonEmpty(debate.nomineeName, NameForPlayerId(debate.nomineeId), "Nominee");
            var state = NominationDebateDuelStateLabel(debate);

            AddImage("Nomination Debate Focus Track", nominationDebateFocusRoot, Vector2.zero, Vector2.zero, new Vector2(26f, 22f), new Vector2(474f, 25f), new Color(0.40f, 0.46f, 0.54f, 0.24f));
            AddImage("Nomination Debate Focus Fill", nominationDebateFocusRoot, Vector2.zero, Vector2.zero, new Vector2(26f, 22f), new Vector2(Mathf.Lerp(116f, 474f, stageRatio), 25f), new Color(1f, 0.70f, 0.30f, 0.48f));
            AddImage("Nomination Debate Focus Route Beam A", nominationDebateFocusRoot, Vector2.zero, Vector2.zero, new Vector2(136f, 20f), new Vector2(172f, 27f), new Color(1f, 0.70f, 0.28f, 0.30f));
            AddImage("Nomination Debate Focus Route Beam B", nominationDebateFocusRoot, Vector2.zero, Vector2.zero, new Vector2(304f, 20f), new Vector2(338f, 27f), new Color(1f, 0.70f, 0.28f, 0.30f));

            AddNominationDebateFocusChip(nominationDebateFocusRoot, "Nominator", new Vector2(10f, 8f), new Vector2(132f, 38f), Ellipsize(nominator, 10), stageIndex == 0, new Color(0.90f, 0.42f, 0.14f, 0.92f));
            AddNominationDebateFocusChip(nominationDebateFocusRoot, "Nominee", new Vector2(174f, 8f), new Vector2(300f, 38f), Ellipsize(nominee, 10), stageIndex == 1, new Color(0.92f, 0.24f, 0.22f, 0.92f));
            AddNominationDebateFocusChip(nominationDebateFocusRoot, "State", new Vector2(340f, 8f), new Vector2(490f, 38f), Ellipsize(state, 12), stageIndex == 2, new Color(0.42f, 0.70f, 1f, 0.90f));
        }

        private void AddNominationDebateFocusChip(Transform parent, string key, Vector2 bottomLeft, Vector2 topRight, string text, bool active, Color accent)
        {
            var fill = active
                ? new Color(accent.r, accent.g, accent.b, 0.24f)
                : new Color(0.20f, 0.125f, 0.055f, 0.48f);
            var frame = active
                ? new Color(accent.r, accent.g, accent.b, 0.42f)
                : new Color(0.92f, 0.62f, 0.28f, 0.14f);
            var chip = AddPanel($"Nomination Debate Focus Chip {key}", parent, Vector2.zero, Vector2.zero, bottomLeft, topRight, fill);
            AddFrame(chip.transform, "Nomination Debate Focus Chip Frame", 0.55f, frame);
            AddImage("Nomination Debate Focus Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), active ? accent : new Color(accent.r, accent.g, accent.b, 0.42f));
            AddText("Nomination Debate Focus Chip Text", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 4f), new Vector2(-10f, -4f), text, 11, TextAnchor.MiddleCenter, FontStyle.Bold).color = active
                ? new Color(1f, 0.94f, 0.74f, 0.98f)
                : new Color(0.96f, 0.88f, 0.70f, 0.82f);
            if (!active) return;
            AddImage("Nomination Debate Focus Active Underline", chip.transform, Vector2.zero, new Vector2(1f, 0f), new Vector2(10f, 3f), new Vector2(-10f, 6f), new Color(1f, 0.80f, 0.34f, 0.74f));
        }


        private void AddNominationDebateDuelNode(Transform parent, string key, float x, bool active, bool done)
        {
            var fill = done
                ? new Color(1f, 0.72f, 0.30f, active ? 0.98f : 0.76f)
                : new Color(0.34f, 0.40f, 0.48f, 0.64f);
            var node = AddCircleImage($"Nomination Debate Duel Node {key}", parent, active ? 8f : 6f, fill, false);
            node.rectTransform.anchoredPosition = new Vector2(x, 13f);
            if (!active) return;
            var ring = AddCircleImage($"Nomination Debate Duel Active Ring {key}", parent, 11f, new Color(1f, 0.84f, 0.44f, 0.52f), true);
            ring.rectTransform.anchoredPosition = node.rectTransform.anchoredPosition;
        }


        private static int NominationDebateDuelStageIndex(NominationDebateViewModel debate)
        {
            if (debate == null) return 0;
            if (string.Equals(debate.nextAction, "vote", StringComparison.OrdinalIgnoreCase)) return 2;
            var lines = debate.lines ?? Array.Empty<NominationDebateLineViewModel>();
            if (lines.Any((line) => line != null && !line.pending && string.Equals(line.role, "nominee", StringComparison.OrdinalIgnoreCase))) return 1;
            if (debate.canHumanRespond) return 1;
            return 0;
        }


        private static int NominationDebateVisibleLineCount(NominationDebateViewModel debate)
        {
            if (debate == null) return 0;
            return (debate.lines ?? Array.Empty<NominationDebateLineViewModel>())
                .Count((line) => line != null && (line.pending || !string.IsNullOrWhiteSpace(line.text)));
        }


        private static string NominationDebateDuelStateLabel(NominationDebateViewModel debate)
        {
            if (debate == null) return "待开始";
            if (debate.canHumanRespond) return "等你回应";
            if (string.Equals(debate.nextAction, "vote", StringComparison.OrdinalIgnoreCase)) return "可投票";
            var lines = debate.lines ?? Array.Empty<NominationDebateLineViewModel>();
            if (lines.Any((line) => line != null && !line.pending && string.Equals(line.role, "nominee", StringComparison.OrdinalIgnoreCase))) return "已辩解";
            return "待辩解";
        }


        private void RenderNominationDebateCards(NominationDebateViewModel debate)
        {
            if (nominationDebateCardRoot == null || debate == null) return;
            ClearChildren(nominationDebateCardRoot);

            AddNominationDebateSeatCard(
                nominationDebateCardRoot,
                new Vector2(0f, 86f),
                "提名者",
                FirstNonEmpty(debate.nominatorName, NameForPlayerId(debate.nominatorId), "未知"),
                "提出指控",
                new Color(0.18f, 0.085f, 0.040f, 0.90f)
            );
            AddNominationDebateSeatCard(
                nominationDebateCardRoot,
                new Vector2(226f, 86f),
                "被提名者",
                FirstNonEmpty(debate.nomineeName, NameForPlayerId(debate.nomineeId), "未知"),
                debate.canHumanRespond ? "等待你回应" : "等待辩解",
                new Color(0.26f, 0.035f, 0.044f, 0.90f)
            );
            AddText("Nomination Debate Versus", nominationDebateCardRoot, Vector2.zero, Vector2.zero, new Vector2(204f, 116f), new Vector2(250f, 156f), "→", 24, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.78f, 0.36f, 0.96f);

            var reasonCard = AddPanel("Nomination Debate Reason Card", nominationDebateCardRoot, Vector2.zero, Vector2.zero, new Vector2(0f, 14f), new Vector2(452f, 76f), new Color(0.16f, 0.10f, 0.040f, 0.74f));
            AddFrame(reasonCard.transform, "Nomination Debate Reason Frame", 0.7f, new Color(0.92f, 0.62f, 0.28f, 0.24f));
            AddImage("Nomination Debate Reason Accent", reasonCard.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.68f, 0.36f, 0.12f, 0.78f));
            AddText("Nomination Debate Reason Title", reasonCard.transform, Vector2.zero, Vector2.one, new Vector2(16f, 38f), new Vector2(-16f, -6f), "提名理由", 13, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddText("Nomination Debate Reason Body", reasonCard.transform, Vector2.zero, Vector2.one, new Vector2(16f, 10f), new Vector2(-16f, -28f), Ellipsize(FirstNonEmpty(debate.reason, "等待提名者补充理由。"), 46), 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.90f);

            var showRationaleCards = false;
            var rationaleCards = showRationaleCards
                ? VisibleNominationRationaleCards(debate.rationaleCards)
                : Array.Empty<RationaleCardViewModel>();
            var hasRationaleCards = rationaleCards.Length > 0;
            if (hasRationaleCards) RenderNominationRationaleCards(nominationDebateCardRoot, rationaleCards);

            var linePanelTop = hasRationaleCards ? 94f : 170f;
            var lineTitleY = hasRationaleCards ? 56f : 132f;
            var linePanel = AddPanel("Nomination Debate Line Panel", nominationDebateCardRoot, Vector2.zero, Vector2.zero, new Vector2(476f, 14f), new Vector2(1176f, linePanelTop), new Color(0.20f, 0.125f, 0.055f, 0.60f));
            AddFrame(linePanel.transform, "Nomination Debate Line Panel Frame", 0.7f, new Color(0.92f, 0.62f, 0.28f, 0.20f));
            AddText("Nomination Debate Line Title", linePanel.transform, Vector2.zero, Vector2.one, new Vector2(14f, lineTitleY), new Vector2(-250f, -6f), "互辩记录", 14, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddText("Nomination Debate Line Status", linePanel.transform, Vector2.zero, Vector2.one, new Vector2(420f, lineTitleY), new Vector2(-14f, -7f), BuildNominationDebateStatus(debate), 11, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.98f, 0.88f, 0.68f, 0.76f);

            var maxVisibleLines = hasRationaleCards ? 1 : 3;
            var lineStartY = hasRationaleCards ? 10f : 84f;
            var lines = (debate.lines ?? Array.Empty<NominationDebateLineViewModel>()).TakeLast(maxVisibleLines).ToArray();
            if (lines.Length == 0)
            {
                AddNominationDebateLineCard(linePanel.transform, null, debate, 0, lineStartY);
                return;
            }

            for (var i = 0; i < lines.Length; i++)
            {
                AddNominationDebateLineCard(linePanel.transform, lines[i], debate, i, lineStartY - i * 40f);
            }
        }


        private static RationaleCardViewModel[] VisibleNominationRationaleCards(RationaleCardViewModel[] cards)
        {
            return (cards ?? Array.Empty<RationaleCardViewModel>())
                .Where(RationaleCardHasVisibleText)
                .Take(3)
                .ToArray();
        }


        private void RenderNominationRationaleCards(Transform parent, RationaleCardViewModel[] cards)
        {
            const float cardWidth = 226f;
            const float cardGap = 10f;
            for (var i = 0; i < cards.Length; i++)
            {
                var bottomLeft = new Vector2(476f + i * (cardWidth + cardGap), 104f);
                AddNominationRationaleCard(parent, cards[i], i, bottomLeft, new Vector2(cardWidth, 66f));
            }
        }


        private void AddNominationRationaleCard(Transform parent, RationaleCardViewModel card, int index, Vector2 bottomLeft, Vector2 size)
        {
            var accent = NominationRationaleAccent(card?.kind, index);
            var cardPanel = AddPanel($"Nomination Rationale Card {index}", parent, Vector2.zero, Vector2.zero, bottomLeft, bottomLeft + size, new Color(0.92f, 0.76f, 0.44f, 0.11f));
            AddFrame(cardPanel.transform, "Nomination Rationale Frame", 0.6f, new Color(0.92f, 0.62f, 0.28f, 0.18f));
            AddImage("Nomination Rationale Accent", cardPanel.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), accent);
            AddText("Nomination Rationale Title", cardPanel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 42f), new Vector2(-10f, -5f), Ellipsize(FirstNonEmpty(card?.title, NominationRationaleKindLabel(card?.kind)), 12), 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.96f);
            AddText("Nomination Rationale Summary", cardPanel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 22f), new Vector2(-10f, -24f), Ellipsize(FirstNonEmpty(card?.summary, RationaleCardSectionLine(card, 1), card?.detail), 24), 10, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.90f);
            AddText("Nomination Rationale Detail", cardPanel.transform, Vector2.zero, Vector2.one, new Vector2(12f, 5f), new Vector2(-10f, -44f), Ellipsize(BuildNominationRationaleDetail(card), 26), 9, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.88f, 0.68f, 0.72f);
        }


        private static string NominationRationaleKindLabel(string kind)
        {
            if (string.Equals(kind, "decision", StringComparison.OrdinalIgnoreCase)) return "目标选择";
            if (string.Equals(kind, "strategy", StringComparison.OrdinalIgnoreCase)) return "票面策略";
            if (string.Equals(kind, "verification", StringComparison.OrdinalIgnoreCase)) return "下一步验证";
            return "推理卡";
        }


        private static Color NominationRationaleAccent(string kind, int index)
        {
            if (string.Equals(kind, "decision", StringComparison.OrdinalIgnoreCase)) return new Color(0.86f, 0.38f, 0.13f, 0.84f);
            if (string.Equals(kind, "strategy", StringComparison.OrdinalIgnoreCase)) return new Color(0.22f, 0.42f, 0.52f, 0.82f);
            if (string.Equals(kind, "verification", StringComparison.OrdinalIgnoreCase)) return new Color(0.44f, 0.30f, 0.70f, 0.80f);
            return index % 2 == 0 ? new Color(0.62f, 0.36f, 0.16f, 0.78f) : new Color(0.28f, 0.40f, 0.44f, 0.78f);
        }


        private static string BuildNominationRationaleDetail(RationaleCardViewModel card)
        {
            if (card == null) return "";
            var sectionLine = RationaleCardSectionLine(card, 3);
            if (!string.IsNullOrWhiteSpace(sectionLine)) return sectionLine;
            var detail = FirstNonEmpty(card.detail);
            if (!string.IsNullOrWhiteSpace(detail)) return detail;
            var rawLine = RationaleCardRawLine(card);
            if (!string.IsNullOrWhiteSpace(rawLine)) return rawLine;
            if (string.Equals(card.kind, "strategy", StringComparison.OrdinalIgnoreCase) && card.threshold > 0f)
            {
                return $"票面 {FormatRationaleNumber(card.expectedSupport)}/{FormatRationaleNumber(card.threshold)} · 差额 {FormatRationaleNumber(card.margin)}";
            }
            if (!string.IsNullOrWhiteSpace(card.runnerUpName)) return $"对照：{card.runnerUpName}";
            return FirstNonEmpty(card.confidenceBand, card.reasonKey, card.displayIntent);
        }


        private static string FormatRationaleNumber(float value)
        {
            return Mathf.Abs(value - Mathf.Round(value)) < 0.01f ? Mathf.RoundToInt(value).ToString() : value.ToString("0.0");
        }


        private void AddNominationDebateSeatCard(Transform parent, Vector2 bottomLeft, string label, string name, string meta, Color accent)
        {
            var card = AddPanel($"Nomination Debate Seat {label}", parent, Vector2.zero, Vector2.zero, bottomLeft, bottomLeft + new Vector2(198f, 84f), new Color(0.19f, 0.115f, 0.050f, 0.66f));
            AddFrame(card.transform, "Nomination Debate Seat Frame", 0.7f, new Color(0.92f, 0.62f, 0.28f, 0.28f));
            AddImage("Nomination Debate Seat Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), accent);
            AddText("Nomination Debate Seat Label", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 58f), new Vector2(-14f, -8f), label, 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.42f, 0.94f);
            AddText("Nomination Debate Seat Name", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 30f), new Vector2(-14f, -22f), Ellipsize(name, 12), 19, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.93f, 0.78f, 0.98f);
            AddText("Nomination Debate Seat Meta", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 10f), new Vector2(-14f, -58f), Ellipsize(meta, 14), 11, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.88f, 0.68f, 0.74f);
        }


        private void AddNominationDebateLineCard(Transform parent, NominationDebateLineViewModel line, NominationDebateViewModel debate, int index, float y)
        {
            var pending = line == null || line.pending;
            var card = AddPanel($"Nomination Debate Line {index}", parent, Vector2.zero, Vector2.zero, new Vector2(14f, y), new Vector2(686f, y + 34f), pending ? new Color(0.18f, 0.10f, 0.040f, 0.72f) : new Color(0.16f, 0.11f, 0.050f, 0.72f));
            AddFrame(card.transform, "Nomination Debate Line Frame", 0.6f, pending ? new Color(1f, 0.74f, 0.34f, 0.30f) : new Color(0.92f, 0.62f, 0.28f, 0.16f));
            var accent = pending ? new Color(0.72f, 0.38f, 0.12f, 0.82f) : new Color(0.12f, 0.16f, 0.18f, 0.78f);
            AddImage("Nomination Debate Line Accent", card.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), accent);
            var speaker = line == null ? "等待回应" : FirstNonEmpty(line.speakerName, NameForPlayerId(line.speakerId), "发言");
            var role = line == null ? "待回应" : FirstNonEmpty(DebateRoleLabel(line.role).Replace(" · ", ""), "陈述");
            var text = line == null
                ? FirstNonEmpty(debate.responsePrompt, "双方陈述还在整理中。")
                : line.pending ? FirstNonEmpty(debate.responsePrompt, line.text, "等待回应。") : line.text;
            AddText("Nomination Debate Line Speaker", card.transform, Vector2.zero, Vector2.one, new Vector2(14f, 16f), new Vector2(-500f, -4f), Ellipsize(speaker, 14), 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.94f);
            AddText("Nomination Debate Line Role", card.transform, Vector2.zero, Vector2.one, new Vector2(172f, 16f), new Vector2(-414f, -5f), role, 10, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.98f, 0.88f, 0.68f, 0.68f);
            AddText("Nomination Debate Line Body", card.transform, Vector2.zero, Vector2.one, new Vector2(248f, 16f), new Vector2(-14f, -4f), Ellipsize(text, 42), 11, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.88f);
        }


        private static string BuildNominationDebateStatus(NominationDebateViewModel debate)
        {
            if (debate == null) return "";
            var day = debate.day > 0 ? $"第 {debate.day} 天" : "今日";
            if (debate.canHumanRespond) return $"{day} · 等待你回应";
            if (string.Equals(debate.nextAction, "vote", StringComparison.OrdinalIgnoreCase)) return $"{day} · 准备投票";
            return $"{day} · 互辩进行中";
        }


        private string BuildNominationDebateText(NominationDebateViewModel debate)
        {
            if (debate == null) return "";
            var lines = new List<string>();
            if (!string.IsNullOrWhiteSpace(debate.reason)) lines.Add($"提名理由：{debate.reason}");
            foreach (var line in (debate.lines ?? Array.Empty<NominationDebateLineViewModel>()).Take(4))
            {
                var speaker = string.IsNullOrWhiteSpace(line.speakerName) ? NameForPlayerId(line.speakerId) : line.speakerName;
                var text = line.pending ? (string.IsNullOrWhiteSpace(debate.responsePrompt) ? line.text : debate.responsePrompt) : line.text;
                lines.Add($"{speaker}：{text}");
            }
            if (lines.Count == 0)
            {
                lines.Add($"{debate.nominatorName} 发起提名。");
                lines.Add($"{debate.nomineeName} 等待辩解。");
            }
            return ClampTextLines(lines, 5, 66);
        }


        private static string DebateRoleLabel(string role)
        {
            if (string.IsNullOrWhiteSpace(role)) return "";
            if (role == "nominator") return "提名者 · ";
            if (role == "nominee") return "被提名者 · ";
            return "";
        }


        private void ResolveNominationDebateToVote(bool humanVoteYes)
        {
            SendUnityAction("resolve-nomination-vote", humanVoteYes: humanVoteYes);
        }


        private void SubmitNominationDebateResponse()
        {
            var text = nominationDebateResponseInput == null ? "" : nominationDebateResponseInput.text;
            if (string.IsNullOrWhiteSpace(text))
            {
                text = "我先回应这票：别急着锁。我会把身份和昨晚信息讲清楚，大家听完再决定。";
            }
            if (nominationDebateResponseInput != null) nominationDebateResponseInput.text = "";
            SendUnityAction("nomination-debate-response", text: text);
        }


        private void OpenVotePanel()
        {
            CloseMoreActionsPanel();
            CloseAuxPanels();
            if (privateChatPanel != null) privateChatPanel.gameObject.SetActive(false);
            CloseTokenInspector();
            CloseActionFormPanel();
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(false);
            if (handbookPanel != null) handbookPanel.gameObject.SetActive(false);
            if (nominationDebatePanel != null) nominationDebatePanel.gameObject.SetActive(false);
            if (phaseAssistPanel != null) phaseAssistPanel.gameObject.SetActive(false);
            if (votePanel != null)
            {
                votePanel.gameObject.SetActive(true);
                votePanel.SetAsLastSibling();
            }
            ApplyVoteChromeVisibility();
            RenderGrimoire();
            ApplyBottomDockVisibility();
            RestartVoteAnimation();
        }


        private void UpdateVotePanelText()
        {
            if (voteTitle != null) voteTitle.text = vm.voteCeremony == null ? "投票仪式" : $"投票仪式 · 第 {vm.voteCeremony.day} 天";
            if (voteBody == null) return;
            var vote = vm.voteCeremony;
            if (vote == null)
            {
                voteBody.text = "暂无投票\n先进入提名";
                RenderVoteTokenCeremony(0, true);
                return;
            }
            var voters = (vote.voters ?? Array.Empty<VoteViewModel>()).OrderBy((entry) => entry.seat).ToArray();
            var key = VoteAnimationKey(vote);
            if (key != voteAnimationKey)
            {
                voteAnimationKey = key;
                voteAnimationStartTime = Time.time;
                voteAnimationStep = -1;
            }
            var visible = Mathf.Clamp(voteAnimationStep, 0, voters.Length);
            var shownYes = voters.Take(visible).Count((entry) => entry.vote);
            var status = visible >= voters.Length ? (vote.passed ? "通过" : "未通过") : $"询问 {visible}/{voters.Length}";
            voteBody.text = $"{shownYes}/{vote.threshold} 赞成\n{status}\n{VoteCurrentLine(voters, visible)}";
            RenderVoteTokenCeremony(visible, false);
        }

        private void RestartVoteAnimation()
        {
            voteAnimationKey = VoteAnimationKey(vm.voteCeremony);
            voteAnimationStartTime = Time.time;
            voteAnimationStep = -1;
            UpdateVotePanelText();
        }


        private void UpdateVoteAnimationFrame()
        {
            if (votePanel == null || !votePanel.gameObject.activeSelf || vm.voteCeremony == null) return;
            var voters = vm.voteCeremony.voters ?? Array.Empty<VoteViewModel>();
            if (voters.Length == 0) return;
            var nextStep = Mathf.Clamp(Mathf.FloorToInt((Time.time - voteAnimationStartTime) / 0.42f) + 1, 0, voters.Length);
            if (nextStep == voteAnimationStep) return;
            voteAnimationStep = nextStep;
            UpdateVotePanelText();
        }


        private void RenderVoteTokenCeremony(int visibleCount, bool forceEmpty)
        {
            if (voteAnimationRoot == null || voteAnimationRowsRoot == null) return;
            for (var i = voteAnimationRoot.childCount - 1; i >= 0; i--) Destroy(voteAnimationRoot.GetChild(i).gameObject);
            for (var i = voteAnimationRowsRoot.childCount - 1; i >= 0; i--) Destroy(voteAnimationRowsRoot.GetChild(i).gameObject);
            SetRect(voteAnimationRowsRoot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero);

            var rootWidth = voteAnimationRoot.rect.width > 10f ? voteAnimationRoot.rect.width : 1040f;
            var rootHeight = voteAnimationRoot.rect.height > 10f ? voteAnimationRoot.rect.height : 700f;
            var center = new Vector2(rootWidth * 0.5f, rootHeight * 0.54f);

            var centerGlow = AddCircleImage("Vote Center Glow", voteAnimationRoot, 228f, new Color(0f, 0f, 0f, 0.42f), false);
            centerGlow.rectTransform.anchoredPosition = center - new Vector2(rootWidth * 0.5f, rootHeight * 0.5f);

            if (forceEmpty || vm.voteCeremony == null)
            {
                AddText("Vote Empty", voteAnimationRoot, Vector2.zero, Vector2.one, new Vector2(220f, 248f), new Vector2(-220f, -248f), "暂无可播放的投票数据。", 17, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var voters = (vm.voteCeremony.voters ?? Array.Empty<VoteViewModel>()).OrderBy((entry) => entry.seat).Take(15).ToArray();
            var voterCount = Mathf.Max(1, voters.Length);
            var dense = voterCount > 12;
            var radius = dense ? 260f : 242f;
            var baseSize = dense ? 52f : 60f;
            var currentSize = dense ? 70f : 80f;
            var labelSize = dense ? new Vector2(66f, 24f) : new Vector2(74f, 26f);
            var labelFontSize = dense ? 12 : 13;
            for (var i = 0; i < voters.Length; i++)
            {
                var voter = voters[i];
                var revealed = i < visibleCount;
                var raised = revealed && voter.vote;
                var abstain = revealed && voter.abstain;
                var angle = Mathf.PI * 0.5f - Mathf.PI * 2f * i / voterCount;
                var pos = new Vector2(center.x + Mathf.Cos(angle) * radius, center.y + Mathf.Sin(angle) * radius);
                var current = i == Mathf.Clamp(visibleCount - 1, 0, voters.Length - 1);
                var size = current ? currentSize : baseSize;
                var color = !revealed
                    ? new Color(0.035f, 0.040f, 0.050f, 0.68f)
                    : raised ? new Color(0.48f, 0.31f, 0.10f, 0.88f) : new Color(0.050f, 0.055f, 0.062f, 0.78f);
                if (current) RenderVoteActiveVoterSpotlight(center, pos, size, rootWidth, rootHeight, revealed, raised, abstain);
                var token = AddPanel($"Vote Token {i}", voteAnimationRoot, Vector2.zero, Vector2.zero, pos - new Vector2(size, size) * 0.5f, pos + new Vector2(size, size) * 0.5f, color);
                var image = token.GetComponent<Image>();
                image.sprite = GetCircleFillSprite();
                image.preserveAspect = true;
                AddCircleImage("Vote Token Ring", token.transform, size * 0.50f, raised ? new Color(1f, 0.76f, 0.32f, 0.72f) : new Color(0.72f, 0.55f, 0.34f, revealed ? 0.34f : 0.16f), true);
                var mark = !revealed ? "?" : raised ? "举" : abstain ? "弃" : "落";
                AddText("Vote Token Mark", token.transform, Vector2.zero, Vector2.one, new Vector2(0f, 12f), new Vector2(0f, -8f), mark, current ? 24 : 20, TextAnchor.MiddleCenter, FontStyle.Bold).color = raised ? new Color(1f, 0.86f, 0.48f, 1f) : new Color(0.86f, 0.82f, 0.74f, 0.92f);
                var labelCenter = pos + VoteTokenLabelOffset(pos, center, dense);
                var labelPlate = AddPanel($"Vote Token Label {i}", voteAnimationRoot, Vector2.zero, Vector2.zero, labelCenter - labelSize * 0.5f, labelCenter + labelSize * 0.5f, current ? new Color(0.18f, 0.10f, 0.030f, 0.82f) : new Color(0.010f, 0.014f, 0.020f, 0.58f));
                AddFrame(labelPlate.transform, "Vote Token Label Frame", 0.55f, current ? new Color(1f, 0.76f, 0.32f, 0.34f) : new Color(0.72f, 0.55f, 0.34f, 0.14f));
                AddText("Vote Token Name", labelPlate.transform, Vector2.zero, Vector2.one, new Vector2(2f, 0f), new Vector2(-2f, 0f), $"{voter.seat}号", labelFontSize, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.90f, 0.66f, current ? 1f : 0.82f);
            }

            var vote = vm.voteCeremony;
            var asked = Mathf.Clamp(visibleCount, 0, voters.Length);
            var shownYes = voters.Take(asked).Count((entry) => entry.vote);
            var finalRevealed = asked >= voters.Length;
            var livePassed = shownYes >= vote.threshold;
            var passedText = finalRevealed
                ? livePassed ? $"满 {vote.threshold} 票通过" : $"未满 {vote.threshold} 票"
                : $"已问 {asked}/{voters.Length}";
            var currentLine = VoteCurrentLine(voters, visibleCount);
            var countLabel = AddText("Vote Center Count", voteAnimationRoot, Vector2.zero, Vector2.zero, center + new Vector2(-260f, 34f), center + new Vector2(260f, 82f), $"{shownYes}/{vote.threshold} 赞成", 32, TextAnchor.MiddleCenter, FontStyle.Bold);
            countLabel.color = livePassed ? new Color(1f, 0.38f, 0.30f, 1f) : new Color(0.42f, 0.62f, 1f, 1f);
            var thresholdText = livePassed ? "已过线" : $"差 {Mathf.Max(0, vote.threshold - shownYes)} 票";
            AddText("Vote Center Status", voteAnimationRoot, Vector2.zero, Vector2.zero, center + new Vector2(-300f, -12f), center + new Vector2(300f, 28f), $"{passedText} · {thresholdText} · {currentLine}", 22, TextAnchor.MiddleCenter, FontStyle.Bold).color = new Color(1f, 0.90f, 0.62f, 0.98f);
            AddText("Vote Center Nomination", voteAnimationRoot, Vector2.zero, Vector2.zero, center + new Vector2(-230f, 88f), center + new Vector2(230f, 124f), $"{vote.nominatorName} 提名了 {vote.nomineeName}", 22, TextAnchor.MiddleCenter, FontStyle.Bold);
        }

        private void RenderVoteActiveVoterSpotlight(Vector2 center, Vector2 position, float tokenSize, float rootWidth, float rootHeight, bool revealed, bool raised, bool abstain)
        {
            if (voteAnimationRoot == null) return;
            var direction = position - center;
            if (direction.sqrMagnitude < 0.001f) direction = Vector2.up;
            var distance = direction.magnitude;
            direction.Normalize();

            var accent = VoteActiveVoterAccent(revealed, raised, abstain);
            var beamStart = center + direction * 88f;
            var beamEnd = position - direction * (tokenSize * 0.24f);
            var beamMid = (beamStart + beamEnd) * 0.5f;
            var beamLength = Mathf.Max(32f, (beamEnd - beamStart).magnitude);
            var beamAngle = Mathf.Atan2(direction.y, direction.x) * Mathf.Rad2Deg;

            var beam = AddImage("Vote Active Voter Beam", voteAnimationRoot, Vector2.zero, Vector2.zero, beamMid - new Vector2(beamLength * 0.5f, 4f), beamMid + new Vector2(beamLength * 0.5f, 4f), new Color(accent.r, accent.g, accent.b, revealed ? 0.15f : 0.11f));
            beam.raycastTarget = false;
            beam.rectTransform.localRotation = Quaternion.Euler(0f, 0f, beamAngle);
            var core = AddImage("Vote Active Voter Beam Core", voteAnimationRoot, Vector2.zero, Vector2.zero, beamMid - new Vector2(beamLength * 0.5f, 1.2f), beamMid + new Vector2(beamLength * 0.5f, 1.2f), new Color(1f, 0.90f, 0.60f, revealed ? 0.52f : 0.34f));
            core.raycastTarget = false;
            core.rectTransform.localRotation = Quaternion.Euler(0f, 0f, beamAngle);

            var rootCenter = new Vector2(rootWidth * 0.5f, rootHeight * 0.5f);
            var glow = AddCircleImage("Vote Active Voter Spotlight", voteAnimationRoot, tokenSize * 0.78f, new Color(accent.r, accent.g, accent.b, revealed ? 0.24f : 0.16f), false);
            glow.rectTransform.anchoredPosition = position - rootCenter;
            var halo = AddCircleImage("Vote Active Voter Halo", voteAnimationRoot, tokenSize * 0.61f, new Color(accent.r, accent.g, accent.b, revealed ? 0.58f : 0.38f), true);
            halo.rectTransform.anchoredPosition = position - rootCenter;
            var pin = AddCircleImage("Vote Active Voter Pin", voteAnimationRoot, Mathf.Clamp(distance * 0.020f, 5f, 8f), new Color(1f, 0.90f, 0.58f, 0.86f), false);
            pin.rectTransform.anchoredPosition = position - direction * (tokenSize * 0.66f) - rootCenter;
        }

        private static Color VoteActiveVoterAccent(bool revealed, bool raised, bool abstain)
        {
            if (!revealed) return new Color(0.62f, 0.78f, 1f, 0.90f);
            if (raised) return new Color(1f, 0.58f, 0.28f, 0.94f);
            if (abstain) return new Color(0.72f, 0.84f, 0.96f, 0.90f);
            return new Color(0.38f, 0.62f, 1f, 0.90f);
        }

        private static Vector2 VoteTokenLabelOffset(Vector2 tokenPosition, Vector2 center, bool dense)
        {
            var direction = tokenPosition - center;
            if (direction.sqrMagnitude < 0.001f) direction = Vector2.down;
            direction.Normalize();
            return direction * (dense ? 36f : 42f);
        }

        private void RenderVoteTallyRail(VoteCeremonyViewModel vote, VoteViewModel[] voters, int visibleCount, Vector2 center)
        {
            if (voteAnimationRoot == null || vote == null || voters == null || voters.Length == 0) return;
            var asked = Mathf.Clamp(visibleCount, 0, voters.Length);
            var yes = voters.Take(asked).Count((entry) => entry.vote);
            var no = asked - yes;
            var pending = Mathf.Max(0, voters.Length - asked);
            var rail = AddPanel("Vote Tally Rail", voteAnimationRoot, Vector2.zero, Vector2.zero, center + new Vector2(-240f, -150f), center + new Vector2(240f, -44f), new Color(0.004f, 0.008f, 0.012f, 0.80f));
            AddFrame(rail.transform, "Vote Tally Rail Frame", 0.65f, new Color(0.92f, 0.62f, 0.28f, 0.32f));
            AddVoteTallyChip(rail.transform, "已问", $"{asked}/{voters.Length}", 10f, new Color(0.050f, 0.085f, 0.11f, 0.78f), new Color(0.68f, 0.86f, 0.96f, 0.28f));
            AddVoteTallyChip(rail.transform, "举手", yes.ToString(), 124f, new Color(0.17f, 0.095f, 0.030f, 0.78f), new Color(1f, 0.72f, 0.28f, 0.30f));
            AddVoteTallyChip(rail.transform, "未举", no.ToString(), 238f, new Color(0.030f, 0.045f, 0.064f, 0.72f), new Color(0.52f, 0.72f, 0.96f, 0.22f));
            AddVoteTallyChip(rail.transform, "待问", pending.ToString(), 352f, new Color(0.030f, 0.034f, 0.042f, 0.68f), new Color(0.68f, 0.62f, 0.54f, 0.18f));
            RenderVoteThresholdMeter(rail.transform, vote, yes, voters.Length);
        }

        private void AddVoteTallyChip(Transform parent, string label, string value, float x, Color fill, Color frame)
        {
            var chip = AddPanel($"Vote Tally {label}", parent, Vector2.zero, Vector2.zero, new Vector2(x, 58f), new Vector2(x + 100f, 96f), fill);
            AddFrame(chip.transform, "Vote Tally Chip Frame", 0.55f, frame);
            AddText("Vote Tally Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(8f, 0f), new Vector2(-50f, 0f), label, 11, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.74f, 0.84f, 0.88f, 0.82f);
            AddText("Vote Tally Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(50f, 0f), new Vector2(-8f, 0f), value, 16, TextAnchor.MiddleRight, FontStyle.Bold).color = new Color(1f, 0.88f, 0.52f, 0.98f);
        }

        private void RenderVoteThresholdMeter(Transform parent, VoteCeremonyViewModel vote, int shownYes, int voterCount)
        {
            if (parent == null || vote == null) return;
            var threshold = Mathf.Max(1, vote.threshold);
            var denominator = Mathf.Max(threshold, voterCount);
            var trackX = 102f;
            var trackY = 22f;
            var trackWidth = 272f;
            var yesRatio = Mathf.Clamp01(shownYes / (float)denominator);
            var thresholdRatio = Mathf.Clamp01(threshold / (float)denominator);
            var fillWidth = Mathf.Max(0f, trackWidth * yesRatio);
            var markerX = trackX + trackWidth * thresholdRatio;
            var livePassed = shownYes >= threshold;

            AddText("Vote Threshold Label", parent, Vector2.zero, Vector2.one, new Vector2(18f, 12f), new Vector2(-384f, -62f), "处决线", 12, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.76f, 0.86f, 0.88f, 0.82f);
            AddImage("Vote Threshold Track", parent, Vector2.zero, Vector2.zero, new Vector2(trackX, trackY), new Vector2(trackX + trackWidth, trackY + 10f), new Color(0.25f, 0.30f, 0.36f, 0.42f));
            if (fillWidth > 0.1f)
            {
                AddImage("Vote Threshold Fill", parent, Vector2.zero, Vector2.zero, new Vector2(trackX, trackY), new Vector2(trackX + fillWidth, trackY + 10f), livePassed ? new Color(1f, 0.30f, 0.24f, 0.78f) : new Color(1f, 0.68f, 0.24f, 0.70f));
            }
            AddImage("Vote Threshold Marker", parent, Vector2.zero, Vector2.zero, new Vector2(markerX - 2f, trackY - 6f), new Vector2(markerX + 2f, trackY + 16f), new Color(1f, 0.86f, 0.46f, 0.88f));
            var status = livePassed ? $"已过线 +{shownYes - threshold}" : $"差 {threshold - shownYes}";
            AddText("Vote Threshold Status", parent, Vector2.zero, Vector2.one, new Vector2(386f, 12f), new Vector2(-18f, -62f), status, 12, TextAnchor.MiddleRight, FontStyle.Bold).color = livePassed ? new Color(1f, 0.56f, 0.42f, 0.96f) : new Color(0.82f, 0.92f, 1f, 0.88f);
        }

        private void RenderVoteRationaleCards(VoteCeremonyViewModel vote, VoteViewModel[] voters, int visibleCount)
        {
            if (voteAnimationRowsRoot == null || vote == null || voters == null || voters.Length == 0) return;
            var asked = Mathf.Clamp(visibleCount, 0, voters.Length);
            var currentIndex = asked <= 0 ? 0 : Mathf.Clamp(asked - 1, 0, voters.Length - 1);
            var current = voters[currentIndex];
            var currentRevealed = asked > 0;
            var currentCard = AddPanel("Vote Current Rationale Card", voteAnimationRowsRoot, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(36f, -318f), new Vector2(430f, -184f), new Color(0.004f, 0.009f, 0.014f, 0.78f));
            AddFrame(currentCard.transform, "Vote Current Rationale Frame", 0.85f, new Color(0.94f, 0.68f, 0.34f, 0.30f));
            AddImage("Vote Current Rationale Accent", currentCard.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), currentRevealed && current.vote ? new Color(1f, 0.68f, 0.25f, 0.70f) : new Color(0.34f, 0.56f, 0.92f, 0.60f));

            var currentTitle = currentRevealed
                ? $"{current.seat}号 {current.voterName} · {VoteDecisionLabel(current)}"
                : $"下一位：{current.seat}号 {current.voterName}";
            var currentMeta = currentRevealed
                ? VoteRationaleMeta(current.voteRationale)
                : "等待询问时揭示票意";
            var currentLine = currentRevealed
                ? VoteRationaleLine(current, vote)
                : "投票理由会跟随逐位询问出现，不提前显示未询问玩家的判断。";
            AddText("Vote Current Rationale Label", currentCard.transform, Vector2.zero, Vector2.one, new Vector2(18f, 104f), new Vector2(-18f, -10f), "当前票意", 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.94f);
            AddText("Vote Current Rationale Title", currentCard.transform, Vector2.zero, Vector2.one, new Vector2(18f, 76f), new Vector2(-18f, -32f), Ellipsize(currentTitle, 24), 18, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.94f, 0.78f, 0.98f);
            AddText("Vote Current Rationale Meta", currentCard.transform, Vector2.zero, Vector2.one, new Vector2(18f, 54f), new Vector2(-18f, -58f), Ellipsize(currentMeta, 36), 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.74f, 0.88f, 0.92f, 0.78f);
            AddText("Vote Current Rationale Body", currentCard.transform, Vector2.zero, Vector2.one, new Vector2(18f, 14f), new Vector2(-18f, -84f), ClampTextBlock(currentLine, 2, 36), 12, TextAnchor.UpperLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.90f);

            var revealedRationales = voters
                .Take(asked)
                .Where((entry) => entry.voteRationale != null && !string.IsNullOrWhiteSpace(entry.voteRationale.line))
                .Reverse()
                .Take(3)
                .ToArray();
            var history = AddPanel("Vote Rationale History", voteAnimationRowsRoot, new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(-430f, -318f), new Vector2(-36f, -184f), new Color(0.004f, 0.009f, 0.014f, 0.72f));
            AddFrame(history.transform, "Vote Rationale History Frame", 0.85f, new Color(0.70f, 0.82f, 0.92f, 0.24f));
            AddText("Vote Rationale History Label", history.transform, Vector2.zero, Vector2.one, new Vector2(16f, 104f), new Vector2(-16f, -10f), "已揭示理由", 12, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.94f);
            AddText("Vote Rationale History Count", history.transform, Vector2.zero, Vector2.one, new Vector2(256f, 104f), new Vector2(-14f, -10f), $"{revealedRationales.Length}/{asked}", 12, TextAnchor.UpperRight, FontStyle.Bold).color = new Color(0.74f, 0.88f, 0.92f, 0.78f);

            if (revealedRationales.Length == 0)
            {
                AddText("Vote Rationale History Empty", history.transform, Vector2.zero, Vector2.one, new Vector2(16f, 18f), new Vector2(-16f, -44f), asked <= 0 ? "投票尚未开始。" : "本轮暂时没有结构化理由。", 13, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.74f);
                return;
            }

            for (var i = 0; i < revealedRationales.Length; i++)
            {
                AddVoteRationaleHistoryChip(history.transform, revealedRationales[i], i);
            }
        }

        private void AddVoteRationaleHistoryChip(Transform parent, VoteViewModel voter, int index)
        {
            var y = 70f - index * 31f;
            var chip = AddPanel($"Vote Rationale Chip {index}", parent, Vector2.zero, Vector2.zero, new Vector2(14f, y), new Vector2(380f, y + 26f), voter.vote ? new Color(0.18f, 0.10f, 0.030f, 0.70f) : new Color(0.030f, 0.045f, 0.065f, 0.66f));
            AddFrame(chip.transform, "Vote Rationale Chip Frame", 0.6f, voter.vote ? new Color(1f, 0.72f, 0.30f, 0.24f) : new Color(0.58f, 0.74f, 0.94f, 0.18f));
            AddText("Vote Rationale Chip Seat", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 2f), new Vector2(-304f, -2f), $"{voter.seat}号", 11, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(1f, 0.82f, 0.44f, 0.94f);
            AddText("Vote Rationale Chip Decision", chip.transform, Vector2.zero, Vector2.one, new Vector2(60f, 2f), new Vector2(-252f, -2f), VoteDecisionLabel(voter), 11, TextAnchor.MiddleLeft, FontStyle.Bold).color = voter.vote ? new Color(1f, 0.82f, 0.44f, 0.94f) : new Color(0.74f, 0.88f, 0.92f, 0.86f);
            AddText("Vote Rationale Chip Line", chip.transform, Vector2.zero, Vector2.one, new Vector2(118f, 2f), new Vector2(-10f, -2f), Ellipsize(VoteRationaleLine(voter, null), 34), 10, TextAnchor.MiddleLeft, FontStyle.Normal).color = new Color(0.96f, 0.90f, 0.78f, 0.82f);
        }

        private static string VoteDecisionLabel(VoteViewModel voter)
        {
            if (voter == null) return "待定";
            if (voter.ghostVote) return "鬼票";
            if (voter.vote) return "举手";
            if (voter.abstain) return "弃权";
            return "不举手";
        }

        private static string VoteRationaleMeta(VoteRationaleViewModel rationale)
        {
            if (rationale == null) return "无结构化理由";
            var reason = VoteReasonLabel(rationale.reasonKey);
            var confidence = string.IsNullOrWhiteSpace(rationale.confidenceBand) ? "" : rationale.confidenceBand;
            var evidence = rationale.evidenceCount > 0.1f ? $"{FormatRationaleNumber(rationale.evidenceCount)}条证据" : "";
            var margin = Mathf.Abs(rationale.margin) > 0.001f ? $"差值 {FormatRationaleNumber(rationale.margin)}" : "";
            return string.Join(" · ", new[] { reason, confidence, evidence, margin }.Where((entry) => !string.IsNullOrWhiteSpace(entry)));
        }

        private static string VoteRationaleLine(VoteViewModel voter, VoteCeremonyViewModel vote)
        {
            var rationale = voter?.voteRationale;
            if (rationale != null && !string.IsNullOrWhiteSpace(rationale.line)) return rationale.line;
            if (voter == null) return "";
            var nominee = vote == null ? "" : FirstNonEmpty(vote.nomineeName, vote.nomineeId);
            var target = string.IsNullOrWhiteSpace(nominee) ? "被提名者" : nominee;
            return voter.vote
                ? $"{voter.voterName} 支持把 {target} 推过处决线。"
                : $"{voter.voterName} 暂时不把票压到 {target} 身上。";
        }

        private static string VoteReasonLabel(string reasonKey)
        {
            if (string.IsNullOrWhiteSpace(reasonKey)) return "桌面判断";
            if (reasonKey.Contains("evidence")) return "证据";
            if (reasonKey.Contains("threshold") || reasonKey.Contains("window")) return "门槛";
            if (reasonKey.Contains("ghost")) return "鬼票";
            if (reasonKey.Contains("cannot") || reasonKey.Contains("blocked") || reasonKey.Contains("butler")) return "受限";
            if (reasonKey.Contains("balance")) return "票面";
            if (reasonKey.Contains("evil") || reasonKey.Contains("cover")) return "公开口径";
            return reasonKey;
        }

        private void RenderVoteProgressStrip(VoteCeremonyViewModel vote, VoteViewModel[] voters, int visibleCount, Vector2 center)
        {
            if (voteAnimationRoot == null || vote == null || voters == null || voters.Length == 0) return;
            var strip = AddPanel("Vote Progress Strip", voteAnimationRoot, Vector2.zero, Vector2.zero, center + new Vector2(-244f, -158f), center + new Vector2(244f, -104f), new Color(0.004f, 0.008f, 0.012f, 0.42f));
            AddFrame(strip.transform, "Vote Progress Strip Frame", 0.6f, new Color(0.92f, 0.62f, 0.28f, 0.22f));
            AddText("Vote Progress Label", strip.transform, Vector2.zero, Vector2.one, new Vector2(14f, 28f), new Vector2(-250f, -6f), "投票顺序", 12, TextAnchor.MiddleLeft, FontStyle.Bold);

            var currentIndex = visibleCount <= 0 ? 0 : Mathf.Clamp(visibleCount - 1, 0, voters.Length - 1);
            var span = voters.Length <= 1 ? 0f : 392f / (voters.Length - 1);
            for (var i = 0; i < voters.Length; i++)
            {
                var revealed = i < visibleCount;
                var active = i == currentIndex && visibleCount < voters.Length;
                var color = !revealed
                    ? new Color(0.40f, 0.44f, 0.50f, 0.48f)
                    : voters[i].vote ? new Color(1f, 0.72f, 0.26f, 0.90f) : new Color(0.32f, 0.50f, 0.86f, 0.76f);
                var pip = AddCircleImage($"Vote Progress Pip {i}", strip.transform, active ? 8f : 6f, color, false);
                pip.rectTransform.anchoredPosition = new Vector2(-196f + span * i, -9f);
                if (active)
                {
                    var ring = AddCircleImage($"Vote Progress Active Ring {i}", strip.transform, 11f, new Color(1f, 0.88f, 0.48f, 0.50f), true);
                    ring.rectTransform.anchoredPosition = pip.rectTransform.anchoredPosition;
                }
            }

            var asked = Mathf.Clamp(visibleCount, 0, voters.Length);
            var line = asked >= voters.Length
                ? $"{vote.yesVotes}/{vote.threshold} · 清点完成"
                : $"{asked}/{voters.Length} · {VoteCurrentLine(voters, visibleCount)}";
            AddText("Vote Progress Current", strip.transform, Vector2.zero, Vector2.one, new Vector2(250f, 28f), new Vector2(-14f, -6f), line, 12, TextAnchor.MiddleRight, FontStyle.Bold);
        }

        private static string VoteCurrentLine(VoteViewModel[] voters, int visibleCount)
        {
            if (voters == null || voters.Length == 0) return "等待投票";
            if (visibleCount <= 0) return $"下一位：{voters[0].seat}号";
            var index = Mathf.Clamp(visibleCount - 1, 0, voters.Length - 1);
            var voter = voters[index];
            var decision = voter.vote ? "举手" : voter.abstain ? "弃权" : "不举手";
            return visibleCount >= voters.Length ? "清点完成" : $"当前：{voter.seat}号 {decision}";
        }

        private static string VoteAnimationKey(VoteCeremonyViewModel vote)
        {
            if (vote == null) return "";
            var voters = vote.voters ?? Array.Empty<VoteViewModel>();
            var voterBits = string.Join(",", voters.OrderBy((entry) => entry.seat).Select((entry) => $"{entry.voterId}:{entry.vote}:{entry.abstain}:{entry.ghostVote}"));
            return $"{vote.day}:{vote.nominatorId}:{vote.nomineeId}:{vote.yesVotes}:{vote.threshold}:{voterBits}";
        }
    }
}
