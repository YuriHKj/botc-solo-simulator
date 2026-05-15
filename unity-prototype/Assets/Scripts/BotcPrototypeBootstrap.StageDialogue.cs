using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap
    {

        private void BuildStageDialoguePanel()
        {
            stageDialoguePanel = AddPanel("Stage Dialogue Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-760f, 184f), new Vector2(760f, 414f), new Color(0.004f, 0.010f, 0.016f, 0.94f)).GetComponent<RectTransform>();
            var group = stageDialoguePanel.gameObject.AddComponent<CanvasGroup>();
            group.alpha = 0f;
            group.blocksRaycasts = false;
            AddFrame(stageDialoguePanel, "Stage Dialogue Frame", 1.2f, new Color(0.96f, 0.68f, 0.30f, 0.38f));
            AddImage("Stage Dialogue Header Wash", stageDialoguePanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -58f), new Vector2(-1f, -1f), new Color(0.72f, 0.46f, 0.18f, 0.080f));
            AddImage("Stage Dialogue Body Wash", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(190f, 18f), new Vector2(-168f, -68f), new Color(0.015f, 0.024f, 0.034f, 0.42f));
            AddImage("Stage Dialogue Bottom Accent", stageDialoguePanel, Vector2.zero, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-1f, 4f), new Color(1f, 0.72f, 0.30f, 0.14f));
            var portrait = AddPanel("Stage Dialogue Portrait", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(24f, 20f), new Vector2(-1334f, -20f), new Color(0.010f, 0.018f, 0.028f, 0.66f));
            AddFrame(portrait.transform, "Stage Dialogue Portrait Frame", 1f, new Color(0.92f, 0.64f, 0.30f, 0.30f));
            AddImage("Stage Dialogue Portrait Glow", portrait.transform, Vector2.zero, Vector2.one, new Vector2(8f, 8f), new Vector2(-8f, -8f), new Color(1f, 0.76f, 0.30f, 0.052f));
            stageDialoguePortraitTokenImage = AddImage("Stage Dialogue Portrait Token", portrait.transform, Vector2.zero, Vector2.one, new Vector2(18f, 42f), new Vector2(-18f, -48f), new Color(0.92f, 0.82f, 0.60f, 0.90f));
            stageDialoguePortraitTokenImage.sprite = SpriteFromResource("Botc/ui/vote1") ?? GetCircleFillSprite();
            stageDialoguePortraitTokenImage.preserveAspect = true;
            stageDialoguePortraitRoleImage = AddImage("Stage Dialogue Portrait Role", portrait.transform, Vector2.zero, Vector2.one, new Vector2(44f, 72f), new Vector2(-44f, -80f), Color.white);
            stageDialoguePortraitRoleImage.preserveAspect = true;
            stageDialoguePortraitText = AddText("Stage Dialogue Portrait Text", portrait.transform, Vector2.zero, Vector2.one, new Vector2(20f, 14f), new Vector2(-20f, -124f), "说", 30, TextAnchor.MiddleCenter, FontStyle.Bold);
            stageDialogueSpeakerText = AddText("Stage Dialogue Speaker", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(204f, 148f), new Vector2(-430f, -18f), "说书人", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            stageDialogueTagText = AddText("Stage Dialogue Tag", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(930f, 150f), new Vector2(-190f, -22f), "", 15, TextAnchor.UpperRight, FontStyle.Bold);
            stageDialogueMetaText = AddText("Stage Dialogue Meta", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(204f, 118f), new Vector2(-430f, -58f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            stageDialogueMetaText.color = new Color(0.78f, 0.86f, 0.90f, 0.86f);
            stageDialogueBodyText = AddText("Stage Dialogue Body", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(204f, 32f), new Vector2(-210f, -90f), "", 20, TextAnchor.UpperLeft, FontStyle.Normal);
            stageDialogueBodyText.color = new Color(0.98f, 0.94f, 0.84f, 1f);
            var sourceButton = AddToolActionButton("源", "来源", stageDialoguePanel, new Vector2(1328f, 146f), new Vector2(118f, 34f), OpenStageDialogueSource, true);
            stageDialogueSourceText = ToolButtonLabel(sourceButton);
            var continueButton = AddToolActionButton("▶", "继续", stageDialoguePanel, new Vector2(1328f, 92f), new Vector2(118f, 36f), AdvanceStageDialogue, true);
            stageDialogueContinueText = ToolButtonLabel(continueButton);
            AddToolActionButton("收", "收起", stageDialoguePanel, new Vector2(1328f, 38f), new Vector2(118f, 34f), () => HideStageDialogue(), true);
            stageDialoguePanel.gameObject.SetActive(false);
        }


        private void BuildPhaseTransitionOverlay()
        {
            phaseTransitionRoot = AddPanel("Phase Transition Overlay", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            phaseTransitionGroup = phaseTransitionRoot.gameObject.AddComponent<CanvasGroup>();
            phaseTransitionGroup.alpha = 0f;
            phaseTransitionGroup.blocksRaycasts = false;

            phaseTransitionTint = AddImage("Phase Transition Tint", phaseTransitionRoot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0.010f, 0.014f, 0.022f, 0.88f));
            phaseTransitionTint.raycastTarget = true;
            AddImage("Phase Transition Top Vignette", phaseTransitionRoot, new Vector2(0f, 0.64f), Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.42f));
            AddImage("Phase Transition Bottom Vignette", phaseTransitionRoot, Vector2.zero, new Vector2(1f, 0.38f), Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.44f));
            phaseTransitionGlow = AddCircleImage("Phase Transition Glow", phaseTransitionRoot, 540f, new Color(0.95f, 0.70f, 0.34f, 0.18f), false);
            phaseTransitionHorizon = AddImage("Phase Transition Horizon", phaseTransitionRoot, new Vector2(0f, 0.49f), new Vector2(1f, 0.51f), new Vector2(0f, -22f), new Vector2(0f, 22f), new Color(1f, 0.76f, 0.36f, 0.18f));
            AddImage("Phase Transition Fine Line", phaseTransitionRoot, new Vector2(0f, 0.5f), new Vector2(1f, 0.5f), new Vector2(0f, -1f), new Vector2(0f, 1f), new Color(1f, 0.86f, 0.54f, 0.32f));

            phaseTransitionContent = AddPanel("Phase Transition Content", phaseTransitionRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-520f, -176f), new Vector2(520f, 184f), new Color(0.006f, 0.010f, 0.016f, 0.48f)).GetComponent<RectTransform>();
            AddFrame(phaseTransitionContent, "Phase Transition Content Frame", 1.2f, new Color(0.96f, 0.70f, 0.34f, 0.38f));
            AddImage("Phase Transition Content Wash", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(12f, 12f), new Vector2(-12f, -12f), new Color(0.96f, 0.64f, 0.24f, 0.045f));
            phaseTransitionKickerText = AddText("Phase Transition Kicker", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(36f, 278f), new Vector2(-36f, -36f), "钟声", 18, TextAnchor.UpperCenter, FontStyle.Bold);
            phaseTransitionTitleText = AddText("Phase Transition Title", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(36f, 152f), new Vector2(-36f, -72f), "天亮了", 56, TextAnchor.MiddleCenter, FontStyle.Bold);
            phaseTransitionSubtitleText = AddText("Phase Transition Subtitle", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(52f, 92f), new Vector2(-52f, -218f), "小镇重新睁开眼睛。", 22, TextAnchor.MiddleCenter, FontStyle.Normal);
            phaseTransitionHintText = AddText("Phase Transition Hint", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(52f, 32f), new Vector2(-52f, -280f), "阶段目标与可用行动已更新。", 15, TextAnchor.MiddleCenter, FontStyle.Normal);
            phaseTransitionHintText.color = new Color(0.80f, 0.86f, 0.90f, 0.88f);

            phaseTransitionRoot.gameObject.SetActive(false);
        }


        private void BeginPhaseTransition(string stage, bool pending)
        {
            if (phaseTransitionRoot == null || phaseTransitionGroup == null) return;
            var normalizedStage = NormalizePhaseTransitionStage(stage);
            if (!pending) HideStageDialogue();
            if (phaseTransitionRoutine != null)
            {
                queuedPhaseTransitionStage = normalizedStage;
                queuedPhaseTransitionPending = pending;
                return;
            }
            phaseTransitionRoot.SetAsLastSibling();
            ApplyPhaseTransitionVisuals(normalizedStage, pending);
            phaseTransitionRoutine = StartCoroutine(PlayPhaseTransition(normalizedStage, pending));
        }


        private void ShowPhaseTransitionStill(string stage)
        {
            if (phaseTransitionRoot == null || phaseTransitionGroup == null) return;
            if (phaseTransitionRoutine != null)
            {
                StopCoroutine(phaseTransitionRoutine);
                phaseTransitionRoutine = null;
            }
            queuedPhaseTransitionStage = "";
            queuedPhaseTransitionPending = false;
            ApplyPhaseTransitionVisuals(NormalizePhaseTransitionStage(stage), false);
            phaseTransitionRoot.gameObject.SetActive(true);
            phaseTransitionRoot.SetAsLastSibling();
            phaseTransitionGroup.alpha = 1f;
            phaseTransitionGroup.blocksRaycasts = true;
            if (phaseTransitionContent != null) phaseTransitionContent.localScale = Vector3.one;
        }


        private IEnumerator PlayPhaseTransition(string stage, bool pending)
        {
            phaseTransitionRoot.gameObject.SetActive(true);
            phaseTransitionGroup.blocksRaycasts = true;
            if (phaseTransitionContent != null) phaseTransitionContent.localScale = Vector3.one * 0.96f;

            yield return FadePhaseTransition(0f, 1f, 0.30f, 0.96f, 1.00f);
            yield return new WaitForSecondsRealtime(PhaseTransitionHoldSeconds(stage, pending));
            yield return FadePhaseTransition(1f, 0f, pending ? 0.34f : 0.48f, 1.00f, 1.035f);

            phaseTransitionGroup.alpha = 0f;
            phaseTransitionGroup.blocksRaycasts = false;
            phaseTransitionRoot.gameObject.SetActive(false);
            phaseTransitionRoutine = null;
            var queuedStage = queuedPhaseTransitionStage;
            var queuedPending = queuedPhaseTransitionPending;
            queuedPhaseTransitionStage = "";
            queuedPhaseTransitionPending = false;
            if (!string.IsNullOrWhiteSpace(queuedStage))
            {
                BeginPhaseTransition(queuedStage, queuedPending);
                yield break;
            }
            if (!pending)
            {
                QueuePhaseNarration(stage);
                FlushPostPhaseNarration();
            }
        }


        private static float PhaseTransitionHoldSeconds(string stage, bool pending)
        {
            if (pending) return stage == "night" ? 1.70f : 0.80f;
            if (stage == "night") return 2.65f;
            if (stage == "private") return 1.50f;
            if (stage == "public") return 1.70f;
            if (stage == "nomination") return 1.85f;
            return 1.25f;
        }


        private IEnumerator FadePhaseTransition(float fromAlpha, float toAlpha, float duration, float fromScale, float toScale)
        {
            var elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                var t = duration <= 0f ? 1f : Mathf.Clamp01(elapsed / duration);
                var eased = SmoothStep(0f, 1f, t);
                phaseTransitionGroup.alpha = Mathf.Lerp(fromAlpha, toAlpha, eased);
                if (phaseTransitionContent != null) phaseTransitionContent.localScale = Vector3.one * Mathf.Lerp(fromScale, toScale, eased);
                if (phaseTransitionHorizon != null)
                {
                    var horizonScale = Mathf.Lerp(0.82f, 1.12f, eased);
                    phaseTransitionHorizon.rectTransform.localScale = new Vector3(1f, horizonScale, 1f);
                }
                yield return null;
            }
        }


        private void ApplyPhaseTransitionVisuals(string stage, bool pending)
        {
            if (phaseTransitionTint != null) phaseTransitionTint.color = PhaseTransitionTintColor(stage, pending);
            if (phaseTransitionGlow != null) phaseTransitionGlow.color = PhaseTransitionGlowColor(stage, pending);
            if (phaseTransitionHorizon != null) phaseTransitionHorizon.color = PhaseTransitionLineColor(stage, pending);

            if (phaseTransitionKickerText != null)
            {
                phaseTransitionKickerText.text = pending ? "钟声响起" : PhaseTransitionKicker(stage);
                phaseTransitionKickerText.color = PhaseTransitionAccentColor(stage);
            }
            if (phaseTransitionTitleText != null)
            {
                phaseTransitionTitleText.text = pending ? "正在推进阶段" : PhaseTransitionTitle(stage);
                phaseTransitionTitleText.color = PhaseTransitionTitleColor(stage);
            }
            if (phaseTransitionSubtitleText != null)
            {
                phaseTransitionSubtitleText.text = pending
                    ? $"目标阶段：{PhaseTransitionStageName(stage)}"
                    : PhaseTransitionSubtitle(stage);
                phaseTransitionSubtitleText.color = new Color(0.98f, 0.91f, 0.78f, 0.96f);
            }
            if (phaseTransitionHintText != null) phaseTransitionHintText.text = pending
                ? "等待 JS Core 返回新阶段，棋盘会自动刷新。"
                : PhaseTransitionHint(stage);
        }


        private static string PhaseTransitionKey(PrototypeViewModel model)
        {
            if (model == null) return "";
            if (model.gameOver || string.Equals(model.phase, "ended", StringComparison.OrdinalIgnoreCase)) return "ended";
            if (string.Equals(model.phase, "night", StringComparison.OrdinalIgnoreCase)) return "night";
            if (string.Equals(model.dayStage, "nomination", StringComparison.OrdinalIgnoreCase)) return "nomination";
            if (string.Equals(model.dayStage, "public", StringComparison.OrdinalIgnoreCase)) return "public";
            if (string.Equals(model.phase, "day", StringComparison.OrdinalIgnoreCase)) return "private";
            return NormalizePhaseTransitionStage(model.phase);
        }


        private static string NormalizePhaseTransitionStage(string stage)
        {
            var value = (stage ?? "").Trim().ToLowerInvariant();
            if (value.Contains("ended") || value.Contains("gameover")) return "ended";
            if (value.Contains("night")) return "night";
            if (value.Contains("nomination")) return "nomination";
            if (value.Contains("public")) return "public";
            if (value.Contains("private")) return "private";
            if (value.Contains("day")) return "private";
            return string.IsNullOrWhiteSpace(value) ? "private" : value;
        }


        private static string PhaseTransitionKicker(string stage)
        {
            if (stage == "night") return "入夜";
            if (stage == "nomination") return "提名";
            if (stage == "public") return "公聊";
            if (stage == "ended") return "终局";
            return "天亮";
        }


        private static string PhaseTransitionTitle(string stage)
        {
            if (stage == "night") return "夜幕降临";
            if (stage == "nomination") return "提名开启";
            if (stage == "public") return "公聊开始";
            if (stage == "ended") return "终局揭晓";
            return "天亮了";
        }


        private static string PhaseTransitionStageName(string stage)
        {
            if (stage == "night") return "夜晚";
            if (stage == "nomination") return "提名 / 投票";
            if (stage == "public") return "白天公聊";
            if (stage == "ended") return "终局";
            return "白天私聊";
        }


        private static string PhaseTransitionSubtitle(string stage)
        {
            if (stage == "night") return "所有人闭眼，夜间行动开始。";
            if (stage == "nomination") return "小镇进入提名，投票仪式即将开始。";
            if (stage == "public") return "玩家开始交换信息，怀疑会浮上水面。";
            if (stage == "ended") return "胜负已定，复盘线索即将展开。";
            return "小镇重新睁开眼睛，先收集私聊线索。";
        }


        private static string PhaseTransitionHint(string stage)
        {
            if (stage == "night") return "夜间行动、被动信息和 Storyteller 队列已更新。";
            if (stage == "nomination") return "选择 token 后可提名，投票结果会以仪式镜头展示。";
            if (stage == "public") return "可公聊、查看日志，或继续观察玩家发言。";
            if (stage == "ended") return "可打开复盘、时间线和全知视角检查结果。";
            return "私聊面板、行动区和阶段目标已刷新。";
        }


        private static Color PhaseTransitionTintColor(string stage, bool pending)
        {
            var alpha = pending ? 0.58f : 0.86f;
            if (stage == "night") return new Color(0.006f, 0.010f, 0.030f, alpha);
            if (stage == "nomination") return new Color(0.030f, 0.008f, 0.010f, alpha);
            if (stage == "ended") return new Color(0.018f, 0.010f, 0.006f, alpha);
            return new Color(0.035f, 0.028f, 0.018f, alpha);
        }


        private static Color PhaseTransitionGlowColor(string stage, bool pending)
        {
            var alpha = pending ? 0.11f : 0.20f;
            if (stage == "night") return new Color(0.28f, 0.44f, 0.92f, alpha);
            if (stage == "nomination") return new Color(0.92f, 0.20f, 0.16f, alpha);
            if (stage == "ended") return new Color(0.96f, 0.72f, 0.32f, alpha);
            return new Color(1f, 0.78f, 0.36f, alpha);
        }


        private static Color PhaseTransitionLineColor(string stage, bool pending)
        {
            var alpha = pending ? 0.28f : 0.42f;
            if (stage == "night") return new Color(0.50f, 0.66f, 1f, alpha);
            if (stage == "nomination") return new Color(1f, 0.32f, 0.24f, alpha);
            if (stage == "ended") return new Color(1f, 0.78f, 0.38f, alpha);
            return new Color(1f, 0.84f, 0.48f, alpha);
        }


        private static Color PhaseTransitionAccentColor(string stage)
        {
            if (stage == "night") return new Color(0.70f, 0.82f, 1f, 0.98f);
            if (stage == "nomination") return new Color(1f, 0.58f, 0.46f, 0.98f);
            if (stage == "ended") return new Color(1f, 0.82f, 0.44f, 0.98f);
            return new Color(1f, 0.86f, 0.52f, 0.98f);
        }


        private static Color PhaseTransitionTitleColor(string stage)
        {
            if (stage == "night") return new Color(0.86f, 0.92f, 1f, 1f);
            if (stage == "nomination") return new Color(1f, 0.72f, 0.58f, 1f);
            return new Color(1f, 0.86f, 0.58f, 1f);
        }


        private void QueuePhaseNarration(string stage)
        {
            var speaker = "说书人";
            var tag = PhaseTransitionStageName(stage);
            var body = PhaseNarrationBody(stage);
            ShowStageDialogue(speaker, body, tag);
        }


        private void CapturePostPhaseNarration(
            string previousTimelineKey,
            string nextTimelineKey,
            string previousPrivateInfoKey,
            string nextPrivateInfoKey,
            string previousNightActionKey,
            string nextNightActionKey)
        {
            hasPendingPostPhaseNarration = true;
            pendingPostPhaseTimelinePreviousKey = previousTimelineKey ?? "";
            pendingPostPhaseTimelineNextKey = nextTimelineKey ?? "";
            pendingPostPhasePrivateInfoPreviousKey = previousPrivateInfoKey ?? "";
            pendingPostPhasePrivateInfoNextKey = nextPrivateInfoKey ?? "";
            pendingPostPhaseNightActionPreviousKey = previousNightActionKey ?? "";
            pendingPostPhaseNightActionNextKey = nextNightActionKey ?? "";
        }


        private void FlushPostPhaseNarration()
        {
            if (!hasPendingPostPhaseNarration) return;
            var previousTimelineKey = pendingPostPhaseTimelinePreviousKey;
            var nextTimelineKey = pendingPostPhaseTimelineNextKey;
            var previousPrivateInfoKey = pendingPostPhasePrivateInfoPreviousKey;
            var nextPrivateInfoKey = pendingPostPhasePrivateInfoNextKey;
            var previousNightActionKey = pendingPostPhaseNightActionPreviousKey;
            var nextNightActionKey = pendingPostPhaseNightActionNextKey;
            hasPendingPostPhaseNarration = false;
            pendingPostPhaseTimelinePreviousKey = "";
            pendingPostPhaseTimelineNextKey = "";
            pendingPostPhasePrivateInfoPreviousKey = "";
            pendingPostPhasePrivateInfoNextKey = "";
            pendingPostPhaseNightActionPreviousKey = "";
            pendingPostPhaseNightActionNextKey = "";
            MaybeQueueNightStorytellerNarration(previousPrivateInfoKey, nextPrivateInfoKey, previousNightActionKey, nextNightActionKey);
            MaybeQueueTimelineNarration(previousTimelineKey, nextTimelineKey);
        }


        private bool ShouldNarrateNightInfoBeforePhaseTransition(string previousPhaseKey, string nextPhaseKey, string previousPrivateInfoKey, string nextPrivateInfoKey)
        {
            return gameplayEntered
                && string.Equals(previousPhaseKey, "night", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(nextPhaseKey, "night", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(nextPrivateInfoKey)
                && nextPrivateInfoKey != previousPrivateInfoKey;
        }


        private void QueuePhaseTransitionAfterDialogue(string stage, bool pending)
        {
            hasQueuedPhaseTransitionAfterDialogue = true;
            queuedPhaseTransitionAfterDialogueStage = stage ?? "";
            queuedPhaseTransitionAfterDialoguePending = pending;
            if (stageDialoguePanel == null || !stageDialoguePanel.gameObject.activeSelf)
            {
                StartQueuedPhaseTransitionAfterDialogue();
            }
        }


        private bool StartQueuedPhaseTransitionAfterDialogue()
        {
            if (!hasQueuedPhaseTransitionAfterDialogue) return false;
            var stage = queuedPhaseTransitionAfterDialogueStage;
            var pending = queuedPhaseTransitionAfterDialoguePending;
            hasQueuedPhaseTransitionAfterDialogue = false;
            queuedPhaseTransitionAfterDialogueStage = "";
            queuedPhaseTransitionAfterDialoguePending = false;
            if (string.IsNullOrWhiteSpace(stage)) return false;
            BeginPhaseTransition(stage, pending);
            return true;
        }


        private string PhaseNarrationBody(string stage)
        {
            if (stage == "night")
            {
                if (vm != null && vm.day == 0 && vm.night <= 1)
                {
                    return "第一夜降临。所有人闭眼，夜间顺序从这里开始。\n如果你的身份此夜需要主动选择，先打开夜间行动表单；否则可以点击右侧的“结算夜晚”，让 JS Core 处理首夜信息并天亮。";
                }
                return "夜幕降临。所有人闭眼，角色按夜晚顺序依次行动。就算你没有可选行动，夜晚也会先流动一会儿。";
            }
            if (stage == "public")
            {
                return "公聊开始。公开发言会在底部对话框出现，也会写入右侧时间线。先听一轮，再决定是否进入提名。";
            }
            if (stage == "nomination")
            {
                return "提名阶段开启。选择 token 后可以提名；投票会进入仪式镜头，结果会标在对应 token 上。";
            }
            if (stage == "ended")
            {
                return "对局已经结束。打开复盘或时间线，可以把最后几步重新看一遍。";
            }
            var info = RecentPrivateInfoSummary(3);
            if (!string.IsNullOrWhiteSpace(info))
            {
                return $"天亮了。你昨晚得到的信息：{info}\n这些内容已经收进右侧“资料 > 信息”，不会和普通聊天混在一起。";
            }
            var events = RecentEventSummary(3);
            return string.IsNullOrWhiteSpace(events)
                ? "天亮了。昨夜没有需要公开宣布的新事件。先从私聊收集线索开始。"
                : $"天亮了。昨夜公开信息：{events}。\n先从私聊收集线索开始，完整记录可以在右侧日志和时间线查看。";
        }


        private string RecentEventSummary(int maxCount)
        {
            var events = vm?.events ?? Array.Empty<string>();
            var values = events
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Select(NormalizeMorningSummaryEvent)
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .Where(IsMorningSummarySafeEvent)
                .TakeLast(Mathf.Max(1, maxCount))
                .Select((entry) => entry.TrimEnd('。', '，', '；', ' '))
                .ToArray();
            return values.Length == 0 ? "" : string.Join("；", values);
        }


        private string RecentPrivateInfoSummary(int maxCount)
        {
            var info = vm?.privateInfo ?? Array.Empty<string>();
            var values = info
                .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                .TakeLast(Mathf.Max(1, maxCount))
                .Select((entry) => entry.Trim().TrimStart('-', '·', '路', ' '))
                .ToArray();
            return values.Length == 0 ? "" : string.Join("；", values);
        }


        private string NormalizeMorningSummaryEvent(string entry)
        {
            if (string.IsNullOrWhiteSpace(entry)) return "";
            var text = entry.Trim().TrimStart('-', '·', ' ');
            text = text.Replace("；", "，").Replace(";", "，");
            while (text.Contains("。。")) text = text.Replace("。。", "。");
            return text.Trim();
        }


        private bool IsMorningSummarySafeEvent(string entry)
        {
            if (string.IsNullOrWhiteSpace(entry)) return false;
            var text = entry.Trim();
            if (text.Contains("暂无")) return false;
            if (text.Contains("天亮") || (text.Contains("第 ") && text.Contains("天开始"))) return false;
            if (text.Contains("白天流程") || text.Contains("先私聊") || text.Contains("再公聊")) return false;
            if (text.Contains("私聊") || text.Contains("悄悄") || text.Contains("耳语")) return false;
            if (text.Contains("主动找你") || text.Contains("找你聊") || text.Contains("找玩家")) return false;
            if (text.Contains("报身份") || text.Contains("声称身份")) return false;
            if (text.IndexOf("whisper", StringComparison.OrdinalIgnoreCase) >= 0) return false;
            if (text.IndexOf("private", StringComparison.OrdinalIgnoreCase) >= 0) return false;
            return true;
        }


        private void MaybeQueueTimelineNarration(string previousKey, string nextKey)
        {
            if (string.IsNullOrWhiteSpace(nextKey) || nextKey == previousKey) return;
            foreach (var entry in TimelineEntriesAfterKey(previousKey))
            {
                if (!ShouldNarrateTimelineEntry(entry)) continue;
                var tag = TimelineModeLabel(entry.mode);
                var speaker = NameForPlayerId(entry.speakerId);
                var target = string.IsNullOrWhiteSpace(entry.targetId) ? "" : NameForPlayerId(entry.targetId);
                var heading = string.IsNullOrWhiteSpace(target) ? speaker : $"{speaker} -> {target}";
                QueueStageDialogue(heading, entry.text, tag, entry.speakerId, entry.targetId);
            }
        }


        private bool ShouldNarrateTimelineEntry(TimelineEntryViewModel entry)
        {
            if (entry == null || string.IsNullOrWhiteSpace(entry.text)) return false;
            var mode = entry.mode ?? "";
            if (!IsPublicTimelineEntry(mode) && !IsPrivateTimelineEntry(mode)) return false;
            if (mode.IndexOf("ai-private", StringComparison.OrdinalIgnoreCase) >= 0) return false;
            var speaker = StageDialoguePlayerById(entry.speakerId);
            if (speaker != null && speaker.human) return false;
            return true;
        }


        private PlayerViewModel StageDialoguePlayerById(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return null;
            return (vm?.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && player.id == playerId);
        }


        private void MaybeQueueNightStorytellerNarration(string previousPrivateInfoKey, string nextPrivateInfoKey, string previousNightActionKey, string nextNightActionKey)
        {
            if (!gameplayEntered || vm == null) return;

            if (!string.IsNullOrWhiteSpace(nextPrivateInfoKey) && nextPrivateInfoKey != previousPrivateInfoKey)
            {
                var latestInfo = (vm.privateInfo ?? Array.Empty<string>())
                    .Where((entry) => !string.IsNullOrWhiteSpace(entry))
                    .TakeLast(3)
                    .ToArray();
                if (latestInfo.Length > 0)
                {
                    QueueStageDialogue(
                        "说书人",
                        $"你在夜里得到新的信息：\n{string.Join("\n", latestInfo.Select((entry) => $"· {entry.Trim()}"))}\n这条内容也会保存在右侧“资料 > 信息”里。",
                        "夜间信息");
                }
            }

            if (string.Equals(vm.phase, "night", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrWhiteSpace(nextNightActionKey)
                && nextNightActionKey != previousNightActionKey)
            {
                var action = CurrentNightActionForNarration();
                if (action != null && action.available)
                {
                    QueueStageDialogue(
                        "说书人",
                        $"{FirstNonEmpty(action.prompt, "你的夜间行动可用了。")}\n可以直接在魔典上点选目标，再打开夜间行动表单确认；如果没有要选的目标，按表单提示提交即可。",
                        "夜间行动");
                }
            }
        }


        private static string PrivateInfoNarrationKey(PrototypeViewModel model)
        {
            var info = model?.privateInfo ?? Array.Empty<string>();
            return info.Length == 0 ? "" : string.Join("|", info.Where((entry) => !string.IsNullOrWhiteSpace(entry)).TakeLast(4));
        }


        private string NightActionNarrationKey(PrototypeViewModel model)
        {
            if (model == null || !string.Equals(model.phase, "night", StringComparison.OrdinalIgnoreCase)) return "";
            var action = model.humanNightAction;
            if (action != null && action.available)
            {
                return $"{model.day}:{model.night}:{action.roleId}:{action.inputType}:{action.prompt}:{action.targetCount}:{action.minTargetCount}:{action.maxTargetCount}";
            }
            var form = (model.actionForms ?? Array.Empty<ActionFormViewModel>()).FirstOrDefault((entry) => entry != null && entry.id == "night-action" && entry.available);
            if (form == null) return "";
            return $"{model.day}:{model.night}:{form.roleId}:{form.inputType}:{form.prompt}:{form.targetCount}:{form.minTargetCount}:{form.maxTargetCount}";
        }


        private RoleActionViewModel CurrentNightActionForNarration()
        {
            if (vm == null) return null;
            if (vm.humanNightAction != null && vm.humanNightAction.available) return vm.humanNightAction;
            var form = (vm.actionForms ?? Array.Empty<ActionFormViewModel>()).FirstOrDefault((entry) => entry != null && entry.id == "night-action" && entry.available);
            if (form == null) return null;
            return new RoleActionViewModel
            {
                available = form.available,
                reason = form.reason,
                type = form.type,
                roleId = form.roleId,
                roleName = form.roleName,
                inputType = form.inputType,
                prompt = form.prompt,
                minTargetCount = form.minTargetCount,
                maxTargetCount = form.maxTargetCount,
                targetCount = form.targetCount,
                options = form.options,
                roleOptions = form.roleOptions,
                modes = form.modes,
                selectedTargetIds = form.selectedTargetIds
            };
        }


        private string LatestTimelineNarrationKey(PrototypeViewModel model)
        {
            var entry = LatestTimelineEntry(model);
            if (entry == null) return "";
            return TimelineEntryKey(entry);
        }


        private IEnumerable<TimelineEntryViewModel> TimelineEntriesAfterKey(string previousKey)
        {
            var timeline = vm?.timeline ?? Array.Empty<TimelineEntryViewModel>();
            if (timeline.Length == 0) yield break;

            var start = -1;
            if (!string.IsNullOrWhiteSpace(previousKey))
            {
                for (var i = timeline.Length - 1; i >= 0; i--)
                {
                    if (TimelineEntryKey(timeline[i]) == previousKey)
                    {
                        start = i;
                        break;
                    }
                }
            }

            if (start < 0)
            {
                foreach (var entry in timeline)
                {
                    yield return entry;
                }
                yield break;
            }

            for (var i = start + 1; i < timeline.Length; i++)
            {
                yield return timeline[i];
            }
        }


        private static string TimelineEntryKey(TimelineEntryViewModel entry)
        {
            if (entry == null) return "";
            return FirstNonEmpty(entry.id, $"{entry.day}:{entry.night}:{entry.mode}:{entry.speakerId}:{entry.targetId}:{entry.text}");
        }


        private static TimelineEntryViewModel LatestTimelineEntry(PrototypeViewModel model)
        {
            var timeline = model?.timeline ?? Array.Empty<TimelineEntryViewModel>();
            return timeline.Length == 0 ? null : timeline[timeline.Length - 1];
        }


        private static bool IsPublicTimelineEntry(string mode)
        {
            return !string.IsNullOrWhiteSpace(mode)
                && mode.IndexOf("public", StringComparison.OrdinalIgnoreCase) >= 0;
        }


        private static bool IsPrivateTimelineEntry(string mode)
        {
            return !string.IsNullOrWhiteSpace(mode)
                && (mode.IndexOf("whisper", StringComparison.OrdinalIgnoreCase) >= 0
                    || mode.IndexOf("private", StringComparison.OrdinalIgnoreCase) >= 0);
        }


        private void ShowStageDialogue(string speaker, string body, string tag, string speakerId = "", string targetId = "")
        {
            if (stageDialoguePanel == null || stageDialogueBodyText == null) return;
            if (stageDialogueRoutine != null) StopCoroutine(stageDialogueRoutine);
            PrepareStageDialogue(speaker, body, tag, speakerId, targetId);
            stageDialoguePanel.SetAsLastSibling();
            stageDialogueRoutine = StartCoroutine(PlayStageDialoguePage(true));
        }


        private void QueueStageDialogue(string speaker, string body, string tag, string speakerId = "", string targetId = "")
        {
            if (stageDialoguePanel != null && stageDialoguePanel.gameObject.activeSelf)
            {
                while (stageDialogueQueue.Count >= StageDialogueQueueLimit) stageDialogueQueue.Dequeue();
                stageDialogueQueue.Enqueue(new StageDialogueEntry(speaker, body, tag, speakerId, targetId));
                UpdateStageDialogueMeta();
                return;
            }
            ShowStageDialogue(speaker, body, tag, speakerId, targetId);
        }


        private void MaybeShowInitialNightDialogue()
        {
            if (vm == null || vm.phase != "night" || vm.night != 1 || vm.day != 0) return;
            BeginPhaseTransition("night", false);
        }


        private void ShowStageDialogueStill(string speaker, string body, string tag)
        {
            if (stageDialoguePanel == null || stageDialogueBodyText == null) return;
            stageDialogueQueue.Clear();
            if (stageDialogueRoutine != null)
            {
                StopCoroutine(stageDialogueRoutine);
                stageDialogueRoutine = null;
            }
            PrepareStageDialogue(speaker, body, tag);
            stageDialoguePanel.gameObject.SetActive(true);
            stageDialoguePanel.SetAsLastSibling();
            var group = stageDialoguePanel.GetComponent<CanvasGroup>();
            if (group != null)
            {
                group.alpha = 1f;
                group.blocksRaycasts = true;
            }
            stageDialogueTyping = false;
            stageDialogueCurrentPageText = stageDialoguePages.Count == 0 ? "" : stageDialoguePages[0];
            stageDialogueBodyText.text = stageDialogueCurrentPageText;
            UpdateStageDialogueMeta();
        }


        private void PrepareStageDialogue(string speaker, string body, string tag, string speakerId = "", string targetId = "")
        {
            stageDialoguePanel.gameObject.SetActive(true);
            stageDialoguePages.Clear();
            stageDialoguePages.AddRange(BuildDialoguePages(body, 4, 36));
            if (stageDialoguePages.Count == 0) stageDialoguePages.Add("");
            stageDialoguePageIndex = 0;
            stageDialogueCurrentPageText = stageDialoguePages[0];
            stageDialogueSpeakerPlayerId = FirstNonEmpty(speakerId, PlayerIdFromDialogueSpeakerHeading(speaker));
            stageDialogueTargetPlayerId = FirstNonEmpty(targetId, PlayerIdFromDialogueTargetHeading(speaker));
            stageDialogueFocusPlayerId = PlayerIdFromDialogueHeading(speaker);
            stageDialogueSourceMode = StageDialogueSourceMode(tag);
            dialoguePulseStartTime = Time.realtimeSinceStartup;
            ConfigureStageDialogueChrome(speaker, tag);
            RenderGrimoire();
        }


        private void ConfigureStageDialogueChrome(string speaker, string tag)
        {
            var safeSpeaker = FirstNonEmpty(speaker, "说书人");
            var safeTag = FirstNonEmpty(tag, "发言");
            if (stageDialogueSpeakerText != null) stageDialogueSpeakerText.text = Ellipsize(safeSpeaker, 26);
            if (stageDialogueTagText != null) stageDialogueTagText.text = Ellipsize(safeTag, 18);
            if (stageDialogueSourceText != null) stageDialogueSourceText.text = StageDialogueSourceLabel(stageDialogueSourceMode);
            RenderStageDialoguePortrait(safeSpeaker);
            UpdateStageDialogueMeta();
        }


        private IEnumerator PlayStageDialoguePage(bool fadeIn)
        {
            var group = stageDialoguePanel.GetComponent<CanvasGroup>();
            stageDialogueCurrentPageText = stageDialoguePages.Count == 0 ? "" : stageDialoguePages[Mathf.Clamp(stageDialoguePageIndex, 0, stageDialoguePages.Count - 1)];
            stageDialogueTyping = true;
            UpdateStageDialogueMeta();
            stageDialogueBodyText.text = "";

            stageDialoguePanel.gameObject.SetActive(true);
            if (group != null)
            {
                group.blocksRaycasts = true;
                if (fadeIn) group.alpha = 0f;
            }

            if (fadeIn && !UiMotionDisabled()) yield return FadeStageDialogue(group, 0f, 1f, 0.16f, 0.985f, 1f);
            else if (group != null) group.alpha = 1f;

            if (UiMotionDisabled())
            {
                stageDialogueBodyText.text = stageDialogueCurrentPageText;
            }
            else
            {
                for (var i = 1; i <= stageDialogueCurrentPageText.Length; i++)
                {
                    stageDialogueBodyText.text = stageDialogueCurrentPageText.Substring(0, i);
                    if (i % 2 == 0) PlayTypeTick();
                    yield return new WaitForSecondsRealtime(0.017f);
                }
            }

            stageDialogueTyping = false;
            stageDialogueBodyText.text = stageDialogueCurrentPageText;
            UpdateStageDialogueMeta();
            stageDialogueRoutine = null;
        }


        private void AdvanceStageDialogue()
        {
            if (stageDialoguePanel == null || !stageDialoguePanel.gameObject.activeSelf) return;
            if (stageDialogueTyping)
            {
                if (stageDialogueRoutine != null)
                {
                    StopCoroutine(stageDialogueRoutine);
                    stageDialogueRoutine = null;
                }
                stageDialogueTyping = false;
                if (stageDialogueBodyText != null) stageDialogueBodyText.text = stageDialogueCurrentPageText;
                UpdateStageDialogueMeta();
                return;
            }
            if (stageDialoguePageIndex + 1 < stageDialoguePages.Count)
            {
                stageDialoguePageIndex++;
                if (stageDialogueRoutine != null) StopCoroutine(stageDialogueRoutine);
                stageDialogueRoutine = StartCoroutine(PlayStageDialoguePage(false));
                return;
            }
            CompleteStageDialogue();
        }


        private void CompleteStageDialogue()
        {
            if (stageDialogueQueue.Count > 0)
            {
                var next = stageDialogueQueue.Dequeue();
                ShowStageDialogue(next.speaker, next.body, next.tag, next.speakerId, next.targetId);
                return;
            }
            if (hasQueuedPhaseTransitionAfterDialogue)
            {
                HideStageDialogue(false);
                StartQueuedPhaseTransitionAfterDialogue();
                return;
            }
            HideStageDialogue(false);
        }


        private void OpenStageDialogueSource()
        {
            var mode = stageDialogueSourceMode;
            var focusPlayerId = stageDialogueFocusPlayerId;
            HideStageDialogue();
            if (mode == "private")
            {
                if (!string.IsNullOrWhiteSpace(focusPlayerId)) selectedPlayerId = focusPlayerId;
                OpenPrivateChatPanel();
                return;
            }
            if (mode == "timeline")
            {
                ShowInfoDrawer("timeline");
                return;
            }
            if (mode == "recap")
            {
                ShowInfoDrawer("recap");
                return;
            }
            ShowInfoDrawer("events");
        }


        private void UpdateStageDialogueMeta()
        {
            if (stageDialogueMetaText != null)
            {
                var page = stageDialoguePages.Count > 1 ? $"第 {stageDialoguePageIndex + 1}/{stageDialoguePages.Count} 段 · " : "";
                var queued = stageDialogueQueue.Count > 0 ? $" · 后续 {stageDialogueQueue.Count} 条" : "";
                var hint = stageDialogueTyping
                    ? "点击继续可直接显示整句"
                    : stageDialoguePageIndex + 1 < stageDialoguePages.Count ? "点击继续查看下一段" : "读完后可收起";
                stageDialogueMetaText.text = $"{page}{hint}{queued}";
            }
            if (stageDialogueContinueText != null)
            {
                stageDialogueContinueText.text = stageDialogueTyping
                    ? "跳过"
                    : stageDialoguePageIndex + 1 < stageDialoguePages.Count || stageDialogueQueue.Count > 0 ? "继续" : "完成";
            }
        }


        private void RenderStageDialoguePortrait(string speaker)
        {
            var player = PlayerFromDialogueHeading(speaker);
            var storyteller = player == null && (string.IsNullOrWhiteSpace(speaker) || speaker.Contains("说书人") || speaker.Contains("Storyteller"));
            if (stageDialoguePortraitTokenImage != null)
            {
                stageDialoguePortraitTokenImage.sprite = SpriteFromResource(storyteller || player?.revealed == true ? "Botc/ui/token1" : "Botc/ui/vote1") ?? GetCircleFillSprite();
                stageDialoguePortraitTokenImage.color = storyteller ? new Color(0.95f, 0.84f, 0.62f, 0.86f) : new Color(0.92f, 0.82f, 0.60f, 0.90f);
            }
            if (stageDialoguePortraitRoleImage != null)
            {
                var roleSprite = player != null && player.revealed && !string.IsNullOrWhiteSpace(player.roleId)
                    ? SpriteFromResource($"Botc/roles/{player.roleId}")
                    : null;
                stageDialoguePortraitRoleImage.sprite = roleSprite;
                stageDialoguePortraitRoleImage.color = roleSprite == null ? new Color(1f, 1f, 1f, 0f) : Color.white;
            }
            if (stageDialoguePortraitText != null)
            {
                stageDialoguePortraitText.text = player == null ? (storyteller ? "说" : StagePortraitLabel(speaker)) : $"{player.seat}号";
                stageDialoguePortraitText.fontSize = player == null && storyteller ? 34 : 21;
                stageDialoguePortraitText.color = storyteller ? new Color(1f, 0.84f, 0.48f, 0.98f) : new Color(0.98f, 0.91f, 0.78f, 1f);
            }
        }


        private IEnumerator FadeStageDialogue(CanvasGroup group, float from, float to, float duration, float fromScale = 1f, float toScale = 1f)
        {
            if (group == null) yield break;
            var elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                var t = duration <= 0f ? 1f : Mathf.Clamp01(elapsed / duration);
                var eased = SmoothStep(0f, 1f, t);
                group.alpha = Mathf.Lerp(from, to, eased);
                if (stageDialoguePanel != null) stageDialoguePanel.localScale = Vector3.one * Mathf.Lerp(fromScale, toScale, eased);
                yield return null;
            }
            group.alpha = to;
            if (stageDialoguePanel != null) stageDialoguePanel.localScale = Vector3.one * toScale;
        }


        private void HideStageDialogue(bool clearQueue = true)
        {
            if (clearQueue) stageDialogueQueue.Clear();
            stageDialogueSpeakerPlayerId = "";
            stageDialogueTargetPlayerId = "";
            if (stageDialogueRoutine != null)
            {
                StopCoroutine(stageDialogueRoutine);
                stageDialogueRoutine = null;
            }
            stageDialogueTyping = false;
            if (stageDialoguePanel != null)
            {
                var group = stageDialoguePanel.GetComponent<CanvasGroup>();
                if (group != null)
                {
                    group.alpha = 0f;
                    group.blocksRaycasts = false;
                }
                stageDialoguePanel.gameObject.SetActive(false);
                stageDialoguePanel.localScale = Vector3.one;
            }
            RenderGrimoire();
            StartQueuedPhaseTransitionAfterDialogue();
        }


        private static string StagePortraitLabel(string speaker)
        {
            if (string.IsNullOrWhiteSpace(speaker)) return "说";
            var trimmed = speaker.Trim();
            if (trimmed.Contains("说书人") || trimmed.Contains("Storyteller")) return "说";
            var seat = new string(trimmed.TakeWhile(char.IsDigit).ToArray());
            if (!string.IsNullOrWhiteSpace(seat)) return seat;
            return trimmed.Substring(0, Math.Min(1, trimmed.Length));
        }


        private static List<string> BuildDialoguePages(string value, int maxLines, int maxCharsPerLine)
        {
            var pages = new List<string>();
            var current = new List<string>();
            foreach (var raw in (value ?? "").Split('\n'))
            {
                var wrapped = WrapDialogueLine(raw, maxCharsPerLine).ToArray();
                if (wrapped.Length == 0) wrapped = new[] { "" };
                foreach (var line in wrapped)
                {
                    current.Add(line);
                    if (current.Count >= maxLines)
                    {
                        pages.Add(string.Join("\n", current));
                        current.Clear();
                    }
                }
            }
            if (current.Count > 0) pages.Add(string.Join("\n", current));
            return pages;
        }


        private static IEnumerable<string> WrapDialogueLine(string raw, int maxCharsPerLine)
        {
            var line = (raw ?? "").Trim();
            if (line.Length == 0)
            {
                yield return "";
                yield break;
            }
            while (line.Length > maxCharsPerLine)
            {
                var split = DialogueLineSplitIndex(line, maxCharsPerLine);
                yield return line.Substring(0, split).TrimEnd();
                line = line.Substring(split).TrimStart();
            }
            if (line.Length > 0) yield return line;
        }


        private static int DialogueLineSplitIndex(string line, int maxCharsPerLine)
        {
            var limit = Mathf.Clamp(maxCharsPerLine, 12, Mathf.Max(12, line.Length));
            for (var i = limit - 1; i >= Mathf.Max(10, limit - 18); i--)
            {
                var c = line[i];
                if (char.IsWhiteSpace(c) || "，。；、：？！,.!?:;".IndexOf(c) >= 0) return i + 1;
            }
            return limit;
        }


        private string StageDialogueSourceMode(string tag)
        {
            var value = tag ?? "";
            if (value.Contains("私聊")) return "private";
            if (value.Contains("公聊") || value.Contains("时间") || value.Contains("发言")) return "timeline";
            if (value.Contains("复盘")) return "recap";
            return "events";
        }


        private static string StageDialogueSourceLabel(string mode)
        {
            if (mode == "private") return "私聊";
            if (mode == "timeline") return "时间线";
            if (mode == "recap") return "复盘";
            return "日志";
        }


        private string PlayerIdFromDialogueHeading(string heading)
        {
            var player = PlayerFromDialogueHeading(heading);
            return player?.id ?? "";
        }


        private string PlayerIdFromDialogueSpeakerHeading(string heading)
        {
            var player = PlayerFromDialogueSegment(DialogueHeadingSegment(heading, true), true);
            return player?.id ?? "";
        }


        private string PlayerIdFromDialogueTargetHeading(string heading)
        {
            var player = PlayerFromDialogueSegment(DialogueHeadingSegment(heading, false), true);
            return player?.id ?? "";
        }


        private static string DialogueHeadingSegment(string heading, bool speaker)
        {
            var text = heading ?? "";
            var arrowIndex = text.IndexOf("->", StringComparison.Ordinal);
            var arrowLength = 2;
            if (arrowIndex < 0)
            {
                arrowIndex = text.IndexOf("→", StringComparison.Ordinal);
                arrowLength = 1;
            }
            if (arrowIndex < 0) return speaker ? text.Trim() : "";
            return speaker ? text.Substring(0, arrowIndex).Trim() : text.Substring(arrowIndex + arrowLength).Trim();
        }


        private PlayerViewModel PlayerFromDialogueHeading(string heading)
        {
            if (string.IsNullOrWhiteSpace(heading) || vm?.players == null) return null;
            foreach (var player in vm.players.Where((entry) => entry != null && !entry.human).OrderByDescending((entry) => entry.name?.Length ?? 0))
            {
                if (!string.IsNullOrWhiteSpace(player.name) && heading.Contains(player.name)) return player;
                if (heading.Contains($"{player.seat}号")) return player;
            }
            return null;
        }


        private PlayerViewModel PlayerFromDialogueSegment(string segment, bool includeHuman)
        {
            if (string.IsNullOrWhiteSpace(segment) || vm?.players == null) return null;
            foreach (var player in vm.players.Where((entry) => entry != null && (includeHuman || !entry.human)).OrderByDescending((entry) => entry.name?.Length ?? 0))
            {
                if (!string.IsNullOrWhiteSpace(player.name) && segment.Contains(player.name)) return player;
                if (segment.Contains($"{player.seat}号")) return player;
            }
            return null;
        }


        private void PlayTypeTick()
        {
            if (UiMotionDisabled() || uiAudioSource == null || typeTickClip == null) return;
            uiAudioSource.pitch = UnityEngine.Random.Range(0.94f, 1.06f);
            uiAudioSource.PlayOneShot(typeTickClip, 0.48f);
        }


        private static AudioClip CreateTypeTickClip()
        {
            const int sampleRate = 22050;
            const float duration = 0.026f;
            var sampleCount = Mathf.CeilToInt(sampleRate * duration);
            var data = new float[sampleCount];
            for (var i = 0; i < sampleCount; i++)
            {
                var t = i / (float)sampleRate;
                var envelope = Mathf.Exp(-80f * t);
                data[i] = Mathf.Sin(2f * Mathf.PI * 880f * t) * envelope * 0.18f;
            }
            var clip = AudioClip.Create("BotcTypeTick", sampleCount, 1, sampleRate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
