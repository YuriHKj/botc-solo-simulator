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
            phaseAssistPanel = AddPanel("Phase Assist Panel", canvas.transform, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(-500f, -172f), new Vector2(500f, -102f), new Color(0.004f, 0.010f, 0.016f, 0.72f)).GetComponent<RectTransform>();
            AddFrame(phaseAssistPanel, "Phase Assist Frame", 0.9f, new Color(0.92f, 0.62f, 0.28f, 0.26f));
            AddImage("Phase Assist Track", phaseAssistPanel, Vector2.zero, Vector2.zero, new Vector2(24f, 12f), new Vector2(608f, 18f), new Color(0.62f, 0.48f, 0.30f, 0.18f));
            phaseAssistProgressFill = AddImage("Phase Assist Progress", phaseAssistPanel, Vector2.zero, Vector2.zero, new Vector2(24f, 12f), new Vector2(86f, 18f), new Color(1f, 0.72f, 0.30f, 0.62f));
            phaseAssistTitleText = AddText("Phase Assist Title", phaseAssistPanel, Vector2.zero, Vector2.one, new Vector2(24f, 44f), new Vector2(-430f, -8f), "流程提示", 18, TextAnchor.UpperLeft, FontStyle.Bold);
            phaseAssistHintText = AddText("Phase Assist Hint", phaseAssistPanel, Vector2.zero, Vector2.one, new Vector2(24f, 20f), new Vector2(-430f, -36f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            phaseAssistPrimaryButton = AddToolActionButton("▶", "推进", phaseAssistPanel, new Vector2(690f, 36f), new Vector2(112f, 34f), PhaseAssistPrimaryAction, true);
            phaseAssistSecondaryButton = AddToolActionButton("◇", "提名", phaseAssistPanel, new Vector2(812f, 36f), new Vector2(112f, 34f), PhaseAssistSecondaryAction, true);
            phaseAssistTertiaryButton = AddToolActionButton("○", "空过", phaseAssistPanel, new Vector2(934f, 36f), new Vector2(112f, 34f), PhaseAssistTertiaryAction, true);
            phaseAssistPrimaryLabel = ToolButtonLabel(phaseAssistPrimaryButton);
            phaseAssistSecondaryLabel = ToolButtonLabel(phaseAssistSecondaryButton);
            phaseAssistTertiaryLabel = ToolButtonLabel(phaseAssistTertiaryButton);
            phaseAssistPanel.gameObject.SetActive(false);
        }


        private void BuildNominationDebatePanel()
        {
            nominationDebatePanel = AddPanel("Nomination Debate Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-760f, 430f), new Vector2(760f, 622f), new Color(0.004f, 0.010f, 0.016f, 0.92f)).GetComponent<RectTransform>();
            AddFrame(nominationDebatePanel, "Nomination Debate Frame", 1f, new Color(0.92f, 0.62f, 0.28f, 0.36f));
            AddImage("Nomination Debate Header Wash", nominationDebatePanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -52f), new Vector2(-1f, -1f), new Color(0.76f, 0.48f, 0.18f, 0.070f));
            nominationDebateTitleText = AddText("Nomination Debate Title", nominationDebatePanel, Vector2.zero, Vector2.one, new Vector2(26f, 148f), new Vector2(-300f, -12f), "提名互辩", 23, TextAnchor.UpperLeft, FontStyle.Bold);
            nominationDebateBodyText = AddText("Nomination Debate Body", nominationDebatePanel, Vector2.zero, Vector2.one, new Vector2(28f, 70f), new Vector2(-286f, -56f), "", 16, TextAnchor.UpperLeft, FontStyle.Normal);
            nominationDebateResponseInput = AddInputField("Nomination Debate Response Input", nominationDebatePanel, new Vector2(28f, 18f), new Vector2(1030f, 56f), "输入你的互辩回应");
            nominationDebateResponseButton = AddButton("回应", nominationDebatePanel, new Vector2(1124f, 36f), new Vector2(128f, 36f), SubmitNominationDebateResponse);
            AddToolActionButton("票", "进入投票", nominationDebatePanel, new Vector2(1326f, 112f), new Vector2(132f, 36f), ResolveNominationDebateToVote, true);
            AddToolActionButton("线", "看时间线", nominationDebatePanel, new Vector2(1326f, 66f), new Vector2(132f, 34f), () => ShowInfoDrawer("timeline"), true);
            AddToolActionButton("收", "收起", nominationDebatePanel, new Vector2(1326f, 24f), new Vector2(132f, 32f), () => nominationDebatePanel.gameObject.SetActive(false), true);
            nominationDebatePanel.gameObject.SetActive(false);
        }


        private void BuildVotePanel()
        {
            votePanel = AddPanel("Vote Panel", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            var votePanelImage = votePanel.GetComponent<Image>();
            if (votePanelImage != null) votePanelImage.raycastTarget = false;
            var centerShade = AddImage("Vote Center Shade", votePanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-430f, -310f), new Vector2(430f, 330f), new Color(0f, 0f, 0f, 0.18f));
            centerShade.raycastTarget = false;
            voteTitle = AddText("Vote Title", votePanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-260f, 156f), new Vector2(260f, 206f), "投票仪式", 30, TextAnchor.MiddleCenter, FontStyle.Bold);
            voteBody = AddText("Vote Body", votePanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-190f, -36f), new Vector2(190f, 80f), "", 22, TextAnchor.MiddleCenter, FontStyle.Bold);
            voteAnimationRoot = AddPanel("Vote Animation Root", votePanel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-480f, -340f), new Vector2(480f, 340f), new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            voteAnimationRowsRoot = AddPanel("Vote Animation Rows", votePanel, Vector2.zero, Vector2.zero, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            AddButton("打开提名", votePanel, new Vector2(820f, 374f), new Vector2(132f, 36f), () => SelectDialoguePreset("nomination"));
            AddButton("重播", votePanel, new Vector2(960f, 374f), new Vector2(104f, 36f), () => RestartVoteAnimation());
            AddButton("关闭", votePanel, new Vector2(1088f, 374f), new Vector2(104f, 36f), CloseVotePanel);
            votePanel.gameObject.SetActive(false);
        }

        private void CloseVotePanel()
        {
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            ApplyModalBackdropVisibility();
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
            var visible = gameplayEntered && !GameplayOverlayOpen() && (showPublic || showNomination || showDebate);
            phaseAssistPanel.gameObject.SetActive(visible);
            if (!visible) return;

            phaseAssistPanel.SetAsLastSibling();
            if (showDebate)
            {
                if (phaseAssistTitleText != null) phaseAssistTitleText.text = "提名互辩";
                if (phaseAssistHintText != null) phaseAssistHintText.text = $"{debate.nominatorName} 提名 {debate.nomineeName}，读完双方陈述后进入投票。";
                SetPhaseAssistProgress(1f);
                SetPhaseAssistButtons("进入投票", "AI 提名", "空过", true, false, false);
                return;
            }

            if (showNomination)
            {
                var total = Mathf.Max(1, clock?.totalTicks ?? 0);
                var remaining = Mathf.Clamp(clock?.ticksRemaining ?? 0, 0, total);
                var elapsed = clock != null && clock.active ? 1f - remaining / (float)total : 0.08f;
                var status = clock?.status ?? "idle";
                if (phaseAssistTitleText != null) phaseAssistTitleText.text = status == "expired" || status == "passed" ? "提名窗口 · 今日空过" : "提名窗口";
                if (phaseAssistHintText != null)
                {
                    phaseAssistHintText.text = status == "expired" || status == "passed"
                        ? "窗口已耗尽；可以空过今日进入夜晚。"
                        : $"剩余 {remaining}/{total} 步。选中一名玩家后可由你提名，也可以让 AI 主动提名。";
                }
                SetPhaseAssistProgress(status == "expired" || status == "passed" ? 1f : Mathf.Clamp01(elapsed));
                SetPhaseAssistButtons("AI 提名", "你提名", "空过", true, true, true);
                return;
            }

            if (phaseAssistTitleText != null) phaseAssistTitleText.text = $"公聊时钟 · {conversation.label}";
            if (phaseAssistHintText != null)
            {
                var pressure = Mathf.RoundToInt(Mathf.Clamp01(conversation.pressure) * 100f);
                phaseAssistHintText.text = conversation.step > 0 ? $"当前压力 {pressure}%。继续接话，或在焦点清晰后开启提名窗口。" : "让 AI 按开场、回应、交锋、提名压力、冷却自然推进。";
            }
            SetPhaseAssistProgress(Mathf.Clamp01(conversation.pressure));
            SetPhaseAssistButtons("继续公聊", "开提名窗", "", true, true, false);
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


        private void SetPhaseAssistProgress(float value)
        {
            if (phaseAssistProgressFill == null) return;
            var clamped = Mathf.Clamp01(value);
            phaseAssistProgressFill.rectTransform.offsetMin = new Vector2(24f, 12f);
            phaseAssistProgressFill.rectTransform.offsetMax = new Vector2(Mathf.Lerp(86f, 608f, clamped), 18f);
            phaseAssistProgressFill.color = clamped >= 0.85f
                ? new Color(1f, 0.45f, 0.22f, 0.70f)
                : new Color(1f, 0.72f, 0.30f, 0.62f);
        }


        private void UpdatePhaseAssistProgress()
        {
            if (phaseAssistPanel == null || !phaseAssistPanel.gameObject.activeSelf) return;
            if (vm?.nominationClock != null && (vm.nominationClock.active || vm.dayStage == "nomination"))
            {
                var total = Mathf.Max(1, vm.nominationClock.totalTicks);
                var remaining = Mathf.Clamp(vm.nominationClock.ticksRemaining, 0, total);
                SetPhaseAssistProgress(vm.nominationClock.status == "expired" || vm.nominationClock.status == "passed" ? 1f : 1f - remaining / (float)total);
            }
        }


        private void PhaseAssistPrimaryAction()
        {
            if (vm?.nominationDebate != null && vm.nominationDebate.active)
            {
                ResolveNominationDebateToVote();
                return;
            }
            if (vm?.dayStage == "nomination")
            {
                SendUnityAction("ai-nomination-step");
                return;
            }
            SendUnityAction("ai-public-step");
        }


        private void PhaseAssistSecondaryAction()
        {
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
                SendUnityAction("pass-nomination-window");
            }
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
            SendUnityAction("human-nomination-intent", playerId: target.id);
        }


        private void RenderNominationDebatePanel()
        {
            if (nominationDebatePanel == null) return;
            var debate = vm?.nominationDebate;
            var visible = gameplayEntered
                && debate != null
                && debate.active
                && !GameplayOverlayOpen()
                && (stageDialoguePanel == null || !stageDialoguePanel.gameObject.activeSelf);
            nominationDebatePanel.gameObject.SetActive(visible);
            if (!visible) return;
            nominationDebatePanel.SetAsLastSibling();
            if (nominationDebateTitleText != null) nominationDebateTitleText.text = $"提名互辩 · {debate.nominatorName} → {debate.nomineeName}";
            if (nominationDebateBodyText != null) nominationDebateBodyText.text = BuildNominationDebateText(debate);
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


        private void ResolveNominationDebateToVote()
        {
            SendUnityAction("resolve-nomination-vote");
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
            CloseActionFormPanel();
            if (storytellerPanel != null) storytellerPanel.gameObject.SetActive(false);
            if (handbookPanel != null) handbookPanel.gameObject.SetActive(false);
            if (votePanel != null)
            {
                votePanel.gameObject.SetActive(true);
                votePanel.SetAsLastSibling();
            }
            RestartVoteAnimation();
        }


        private void UpdateVotePanelText()
        {
            if (voteTitle != null) voteTitle.text = vm.voteCeremony == null ? "投票仪式" : $"投票仪式 · 第 {vm.voteCeremony.day} 天";
            if (voteBody == null) return;
            var vote = vm.voteCeremony;
            if (vote == null)
            {
                voteBody.text = "暂无投票\n先进入提名并结算。";
                RenderVoteTokenCeremony(0, true);
                return;
            }
            var voters = vote.voters ?? Array.Empty<VoteViewModel>();
            var key = VoteAnimationKey(vote);
            if (key != voteAnimationKey)
            {
                voteAnimationKey = key;
                voteAnimationStartTime = Time.time;
                voteAnimationStep = -1;
            }
            var visible = Mathf.Clamp(voteAnimationStep, 0, voters.Length);
            var shownYes = voters.OrderBy((entry) => entry.seat).Take(visible).Count((entry) => entry.vote);
            var status = visible >= voters.Length ? (vote.passed ? "通过" : "未通过") : $"询问 {visible}/{voters.Length}";
            voteBody.text = $"{vote.nomineeName}\n{shownYes} 票\n{status}";
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

            var rootWidth = voteAnimationRoot.rect.width > 10f ? voteAnimationRoot.rect.width : 876f;
            var rootHeight = voteAnimationRoot.rect.height > 10f ? voteAnimationRoot.rect.height : 488f;
            var center = new Vector2(rootWidth * 0.5f, rootHeight * 0.52f);

            var centerGlow = AddCircleImage("Vote Center Glow", voteAnimationRoot, 212f, new Color(0f, 0f, 0f, 0.34f), false);
            centerGlow.rectTransform.anchoredPosition = center - new Vector2(rootWidth * 0.5f, rootHeight * 0.5f);

            var bluePointer = AddImage("Vote Blue Pointer", voteAnimationRoot, Vector2.zero, Vector2.zero, center + new Vector2(-28f, -26f), center + new Vector2(28f, 286f), Color.white);
            bluePointer.sprite = SpriteFromResource("Botc/ui/clock-small");
            bluePointer.preserveAspect = false;
            bluePointer.raycastTarget = false;
            bluePointer.rectTransform.localRotation = Quaternion.Euler(0f, 0f, -92f);
            bluePointer.color = new Color(1f, 1f, 1f, 0.92f);

            var redPointer = AddImage("Vote Red Pointer", voteAnimationRoot, Vector2.zero, Vector2.zero, center + new Vector2(-28f, -28f), center + new Vector2(34f, 280f), Color.white);
            redPointer.sprite = SpriteFromResource("Botc/ui/clock-big");
            redPointer.preserveAspect = false;
            redPointer.raycastTarget = false;
            redPointer.rectTransform.localRotation = Quaternion.Euler(0f, 0f, -19f);
            redPointer.color = new Color(1f, 1f, 1f, 0.94f);

            var sigil = AddImage("Vote Center Sigil", voteAnimationRoot, Vector2.zero, Vector2.zero, center - new Vector2(84f, 84f), center + new Vector2(84f, 84f), new Color(0.62f, 0.68f, 0.72f, 0.68f));
            sigil.sprite = SpriteFromResource("Botc/ui/demon-head") ?? GetCircleFillSprite();
            sigil.preserveAspect = true;
            sigil.raycastTarget = false;

            if (forceEmpty || vm.voteCeremony == null)
            {
                AddText("Vote Empty", voteAnimationRoot, Vector2.zero, Vector2.one, new Vector2(220f, 248f), new Vector2(-220f, -248f), "暂无可播放的投票数据。", 17, TextAnchor.MiddleCenter, FontStyle.Normal);
                return;
            }

            var voters = (vm.voteCeremony.voters ?? Array.Empty<VoteViewModel>()).OrderBy((entry) => entry.seat).Take(15).ToArray();
            var voterCount = Mathf.Max(1, voters.Length);
            var dense = voterCount > 12;
            var radius = dense ? 248f : 236f;
            var baseSize = dense ? 48f : 56f;
            var currentSize = dense ? 62f : 70f;
            var labelHalfWidth = dense ? 44f : 54f;
            var labelFontSize = dense ? 11 : 12;
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
                var token = AddPanel($"Vote Token {i}", voteAnimationRoot, Vector2.zero, Vector2.zero, pos - new Vector2(size, size) * 0.5f, pos + new Vector2(size, size) * 0.5f, color);
                var image = token.GetComponent<Image>();
                image.sprite = GetCircleFillSprite();
                image.preserveAspect = true;
                AddCircleImage("Vote Token Ring", token.transform, size * 0.50f, raised ? new Color(1f, 0.76f, 0.32f, 0.72f) : new Color(0.72f, 0.55f, 0.34f, revealed ? 0.34f : 0.16f), true);
                var mark = !revealed ? "?" : raised ? "举" : abstain ? "弃" : "落";
                AddText("Vote Token Mark", token.transform, Vector2.zero, Vector2.one, new Vector2(0f, 12f), new Vector2(0f, -8f), mark, current ? 22 : 18, TextAnchor.MiddleCenter, FontStyle.Bold).color = raised ? new Color(1f, 0.86f, 0.48f, 1f) : new Color(0.86f, 0.82f, 0.74f, 0.92f);
                AddText("Vote Token Name", voteAnimationRoot, Vector2.zero, Vector2.zero, pos + new Vector2(-labelHalfWidth, -44f), pos + new Vector2(labelHalfWidth, -20f), $"{voter.seat}号", labelFontSize, TextAnchor.MiddleCenter, FontStyle.Bold);
            }

            var vote = vm.voteCeremony;
            var passedText = vote.passed ? $"满 {vote.threshold} 票通过" : $"需 {vote.threshold} 票";
            var countLabel = AddText("Vote Center Count", voteAnimationRoot, Vector2.zero, Vector2.zero, center + new Vector2(-160f, 52f), center + new Vector2(160f, 90f), $"{vote.yesVotes} 票  ({passedText})", 22, TextAnchor.MiddleCenter, FontStyle.Bold);
            countLabel.color = vote.passed ? new Color(1f, 0.38f, 0.30f, 1f) : new Color(0.42f, 0.62f, 1f, 1f);
            AddText("Vote Center Nomination", voteAnimationRoot, Vector2.zero, Vector2.zero, center + new Vector2(-190f, 94f), center + new Vector2(190f, 132f), $"{vote.nominatorName} 提名了 {vote.nomineeName}", 20, TextAnchor.MiddleCenter, FontStyle.Bold);
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
