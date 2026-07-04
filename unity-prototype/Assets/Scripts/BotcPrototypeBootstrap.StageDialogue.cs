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
            stageDialoguePanel = AddPanel("Stage Dialogue Panel", canvas.transform, new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(-700f, 198f), new Vector2(700f, 384f), new Color(0.17f, 0.095f, 0.040f, 0.82f)).GetComponent<RectTransform>();
            var group = stageDialoguePanel.gameObject.AddComponent<CanvasGroup>();
            group.alpha = 0f;
            group.blocksRaycasts = false;
            AddFrame(stageDialoguePanel, "Stage Dialogue Frame", 1.2f, new Color(0.96f, 0.68f, 0.30f, 0.38f));
            AddImage("Stage Dialogue Header Wash", stageDialoguePanel, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, -58f), new Vector2(-1f, -1f), new Color(1f, 0.72f, 0.30f, 0.11f));
            AddImage("Stage Dialogue Body Wash", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(28f, 16f), new Vector2(-150f, -58f), new Color(0.27f, 0.160f, 0.070f, 0.28f));
            AddImage("Stage Dialogue Bottom Accent", stageDialoguePanel, Vector2.zero, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-1f, 4f), new Color(1f, 0.72f, 0.30f, 0.14f));
            BuildStageDialogueSpeakerSpotlight();
            var portrait = AddPanel("Stage Dialogue Portrait", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(24f, 20f), new Vector2(-1334f, -20f), new Color(0.20f, 0.130f, 0.070f, 0.46f));
            AddFrame(portrait.transform, "Stage Dialogue Portrait Frame", 1f, new Color(0.92f, 0.64f, 0.30f, 0.30f));
            stageDialoguePortraitAuraImage = AddCircleImage("Stage Dialogue Portrait Aura", portrait.transform, 78f, new Color(1f, 0.76f, 0.30f, 0.16f), true);
            stageDialoguePortraitAuraRect = stageDialoguePortraitAuraImage.rectTransform;
            stageDialoguePortraitAuraImage.raycastTarget = false;
            stageDialoguePortraitGlowImage = AddImage("Stage Dialogue Portrait Glow", portrait.transform, Vector2.zero, Vector2.one, new Vector2(8f, 8f), new Vector2(-8f, -8f), new Color(1f, 0.76f, 0.30f, 0.052f));
            stageDialoguePortraitGlowImage.raycastTarget = false;
            stageDialoguePortraitTokenImage = AddImage("Stage Dialogue Portrait Token", portrait.transform, Vector2.zero, Vector2.one, new Vector2(18f, 42f), new Vector2(-18f, -48f), new Color(0.92f, 0.82f, 0.60f, 0.90f));
            stageDialoguePortraitTokenImage.sprite = SpriteFromResource("Botc/ui/vote1") ?? GetCircleFillSprite();
            stageDialoguePortraitTokenImage.preserveAspect = true;
            stageDialoguePortraitRoleImage = AddImage("Stage Dialogue Portrait Role", portrait.transform, Vector2.zero, Vector2.one, new Vector2(44f, 72f), new Vector2(-44f, -80f), Color.white);
            stageDialoguePortraitRoleImage.preserveAspect = true;
            stageDialoguePortraitText = AddText("Stage Dialogue Portrait Text", portrait.transform, Vector2.zero, Vector2.one, new Vector2(20f, 14f), new Vector2(-20f, -124f), "说", 30, TextAnchor.MiddleCenter, FontStyle.Bold);
            stageDialoguePortraitNameText = AddText("Stage Dialogue Portrait Name", portrait.transform, Vector2.zero, Vector2.one, new Vector2(12f, 12f), new Vector2(-12f, -154f), "说书人", 14, TextAnchor.LowerCenter, FontStyle.Bold);
            stageDialoguePortraitNameText.color = new Color(0.94f, 0.88f, 0.72f, 0.88f);
            portrait.gameObject.SetActive(false);
            stageDialogueSpeakerText = AddText("Stage Dialogue Speaker", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(38f, 106f), new Vector2(-360f, -16f), "说书人", 24, TextAnchor.UpperLeft, FontStyle.Bold);
            stageDialogueTagText = AddText("Stage Dialogue Tag", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(820f, 108f), new Vector2(-158f, -20f), "", 15, TextAnchor.UpperRight, FontStyle.Bold);
            stageDialogueMetaText = AddText("Stage Dialogue Meta", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(38f, 78f), new Vector2(-680f, -50f), "", 13, TextAnchor.UpperLeft, FontStyle.Normal);
            stageDialogueMetaText.color = new Color(0.78f, 0.86f, 0.90f, 0.86f);
            var routeRibbon = AddPanel("Stage Dialogue Route Ribbon", stageDialoguePanel, Vector2.zero, Vector2.zero, new Vector2(642f, 126f), new Vector2(1090f, 150f), new Color(0.22f, 0.135f, 0.060f, 0.44f));
            AddFrame(routeRibbon.transform, "Stage Dialogue Route Frame", 0.6f, new Color(0.70f, 0.82f, 0.92f, 0.16f));
            stageDialogueRouteAccentImage = AddImage("Stage Dialogue Route Accent", routeRibbon.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.44f));
            AddText("Stage Dialogue Route Label", routeRibbon.transform, Vector2.zero, Vector2.one, new Vector2(12f, 1f), new Vector2(-374f, -1f), "路径", 9, TextAnchor.MiddleLeft, FontStyle.Bold).color = new Color(0.82f, 0.90f, 0.94f, 0.70f);
            stageDialogueRouteText = AddText("Stage Dialogue Route Text", routeRibbon.transform, Vector2.zero, Vector2.one, new Vector2(52f, 1f), new Vector2(-12f, -1f), "", 11, TextAnchor.MiddleLeft, FontStyle.Bold);
            stageDialogueRouteText.color = new Color(1f, 0.92f, 0.74f, 0.96f);
            routeRibbon.gameObject.SetActive(false);
            var speechCard = AddPanel("Stage Dialogue Speech Card", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(34f, 34f), new Vector2(-170f, -64f), new Color(0.20f, 0.120f, 0.050f, 0.50f));
            AddFrame(speechCard.transform, "Stage Dialogue Speech Card Frame", 0.75f, new Color(0.70f, 0.82f, 0.92f, 0.18f));
            AddImage("Stage Dialogue Speech Accent", speechCard.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(5f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.50f));
            AddImage("Stage Dialogue Speech Top Rule", speechCard.transform, new Vector2(0f, 1f), Vector2.one, new Vector2(12f, -2f), new Vector2(-12f, 0f), new Color(0.96f, 0.70f, 0.34f, 0.16f));
            AddImage("Stage Dialogue Speaker Bridge", speechCard.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(42f, 14f), new Vector2(47f, -14f), new Color(0.96f, 0.64f, 0.24f, 0.46f));
            var quoteMark = AddText("Stage Dialogue Quote Mark", speechCard.transform, Vector2.zero, Vector2.one, new Vector2(76f, 28f), new Vector2(-1040f, -18f), "\"", 46, TextAnchor.MiddleCenter, FontStyle.Bold);
            quoteMark.color = new Color(1f, 0.78f, 0.36f, 0.58f);
            stageDialogueBodyText = AddText("Stage Dialogue Body", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(204f, 54f), new Vector2(-318f, -88f), "", 18, TextAnchor.UpperLeft, FontStyle.Normal);
            stageDialogueBodyText.color = new Color(0.98f, 0.94f, 0.84f, 1f);
            stageDialogueContextRailRoot = AddPanel("Stage Dialogue Context Rail", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(1138f, 28f), new Vector2(-208f, -88f), new Color(0.20f, 0.125f, 0.060f, 0.54f)).GetComponent<RectTransform>();
            AddFrame(stageDialogueContextRailRoot, "Stage Dialogue Context Rail Frame", 0.65f, new Color(0.70f, 0.82f, 0.92f, 0.16f));
            stageDialogueContextRailRoot.gameObject.SetActive(false);
            stageDialogueQueueStripRoot = AddPanel("Stage Dialogue Queue Strip", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(204f, 12f), new Vector2(-430f, -184f), new Color(0.20f, 0.125f, 0.060f, 0.58f)).GetComponent<RectTransform>();
            AddFrame(stageDialogueQueueStripRoot, "Stage Dialogue Queue Strip Frame", 0.7f, new Color(0.70f, 0.82f, 0.92f, 0.18f));
            AddImage("Stage Dialogue Queue Strip Accent", stageDialogueQueueStripRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(0.96f, 0.64f, 0.24f, 0.44f));
            AddImage("Stage Dialogue Queue Progress Track", stageDialogueQueueStripRoot, Vector2.zero, Vector2.zero, new Vector2(14f, 4f), new Vector2(720f, 7f), new Color(0.34f, 0.40f, 0.45f, 0.20f));
            stageDialogueQueueProgressFill = AddImage("Stage Dialogue Queue Progress Fill", stageDialogueQueueStripRoot, Vector2.zero, Vector2.zero, new Vector2(14f, 4f), new Vector2(14f, 7f), new Color(1f, 0.72f, 0.30f, 0.70f));
            stageDialogueQueueProgressKnob = AddImage("Stage Dialogue Queue Progress Knob", stageDialogueQueueStripRoot, Vector2.zero, Vector2.zero, new Vector2(10f, 1f), new Vector2(18f, 9f), new Color(1f, 0.82f, 0.42f, 0.92f));
            stageDialogueQueueProgressKnob.sprite = GetCircleFillSprite();
            stageDialogueQueueProgressKnob.preserveAspect = true;
            stageDialogueQueueStatusText = AddText("Stage Dialogue Queue Status", stageDialogueQueueStripRoot, Vector2.zero, Vector2.one, new Vector2(14f, 10f), new Vector2(-668f, -3f), "", 12, TextAnchor.UpperLeft, FontStyle.Bold);
            stageDialogueQueueStatusText.color = new Color(1f, 0.82f, 0.44f, 0.98f);
            stageDialogueQueueNextText = AddText("Stage Dialogue Queue Next", stageDialogueQueueStripRoot, Vector2.zero, Vector2.one, new Vector2(188f, 10f), new Vector2(-146f, -3f), "", 12, TextAnchor.UpperLeft, FontStyle.Normal);
            stageDialogueQueueNextText.color = new Color(0.78f, 0.86f, 0.90f, 0.86f);
            stageDialogueQueuePipImages.Clear();
            for (var i = 0; i < 5; i++)
            {
                var x = 740f + i * 18f;
                var pip = AddImage($"Stage Dialogue Queue Pip {i + 1}", stageDialogueQueueStripRoot, Vector2.zero, Vector2.zero, new Vector2(x, 10f), new Vector2(x + 12f, 22f), new Color(0.42f, 0.48f, 0.52f, 0.30f));
                pip.raycastTarget = false;
                stageDialogueQueuePipImages.Add(pip);
            }
            stageDialogueQueueOverflowText = AddText("Stage Dialogue Queue Overflow", stageDialogueQueueStripRoot, Vector2.zero, Vector2.one, new Vector2(834f, 9f), new Vector2(-8f, -4f), "", 11, TextAnchor.UpperRight, FontStyle.Bold);
            stageDialogueQueueOverflowText.color = new Color(1f, 0.82f, 0.44f, 0.88f);
            stageDialogueQueueStripRoot.gameObject.SetActive(false);
            var sourceButton = AddToolActionButton("源", "来源", stageDialoguePanel, new Vector2(1328f, 146f), new Vector2(118f, 34f), OpenStageDialogueSource, true);
            sourceButton.gameObject.SetActive(false);
            stageDialogueSourceText = ToolButtonLabel(sourceButton);
            var continueButton = AddToolActionButton("▶", "继续", stageDialoguePanel, new Vector2(1248f, 78f), new Vector2(118f, 38f), AdvanceStageDialogue, true);
            stageDialogueContinueText = ToolButtonLabel(continueButton);
            AddToolActionButton("收", "收起", stageDialoguePanel, new Vector2(1248f, 28f), new Vector2(118f, 34f), () => HideStageDialogue(), true);
            stageDialoguePanel.gameObject.SetActive(false);
        }


        private void BuildStageDialogueSpeakerSpotlight()
        {
            stageDialogueSpeakerSpotlightImage = AddImage("Stage Dialogue Speaker Spotlight", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(166f, 38f), new Vector2(-388f, -58f), new Color(1f, 0.72f, 0.30f, 0.044f));
            stageDialogueSpeakerSpotlightImage.raycastTarget = false;
            stageDialogueSpeakerBeamImage = AddImage("Stage Dialogue Speaker Beam", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(174f, 88f), new Vector2(-1082f, -116f), new Color(1f, 0.72f, 0.30f, 0.105f));
            stageDialogueSpeakerBeamImage.raycastTarget = false;
            stageDialogueSpeakerBeamCoreImage = AddImage("Stage Dialogue Speaker Beam Core", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(184f, 99f), new Vector2(-1218f, -128f), new Color(1f, 0.86f, 0.52f, 0.42f));
            stageDialogueSpeakerBeamCoreImage.raycastTarget = false;
            stageDialogueSpeakerBeamPinImage = AddImage("Stage Dialogue Speaker Beam Pin", stageDialoguePanel, Vector2.zero, Vector2.one, new Vector2(182f, 92f), new Vector2(-1324f, -114f), new Color(1f, 0.84f, 0.48f, 0.72f));
            stageDialogueSpeakerBeamPinImage.sprite = GetCircleFillSprite();
            stageDialogueSpeakerBeamPinImage.preserveAspect = true;
            stageDialogueSpeakerBeamPinImage.raycastTarget = false;
            stageDialogueSpeakerSpotlightImage.gameObject.SetActive(false);
            stageDialogueSpeakerBeamImage.gameObject.SetActive(false);
            stageDialogueSpeakerBeamCoreImage.gameObject.SetActive(false);
            stageDialogueSpeakerBeamPinImage.gameObject.SetActive(false);
        }


        private void BuildPhaseTransitionOverlay()
        {
            phaseTransitionRoot = AddPanel("Phase Transition Overlay", canvas.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0f)).GetComponent<RectTransform>();
            phaseTransitionGroup = phaseTransitionRoot.gameObject.AddComponent<CanvasGroup>();
            phaseTransitionGroup.alpha = 0f;
            phaseTransitionGroup.blocksRaycasts = false;

            phaseTransitionTint = AddImage("Phase Transition Tint", phaseTransitionRoot, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0.010f, 0.014f, 0.022f, 0.44f));
            phaseTransitionTint.raycastTarget = true;
            AddImage("Phase Transition Top Vignette", phaseTransitionRoot, new Vector2(0f, 0.64f), Vector2.one, Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.16f));
            AddImage("Phase Transition Bottom Vignette", phaseTransitionRoot, Vector2.zero, new Vector2(1f, 0.38f), Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.18f));
            phaseTransitionGlow = AddCircleImage("Phase Transition Glow", phaseTransitionRoot, 540f, new Color(0.95f, 0.70f, 0.34f, 0.18f), false);
            phaseTransitionHorizon = AddImage("Phase Transition Contained Horizon", phaseTransitionRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-468f, -20f), new Vector2(468f, 20f), new Color(1f, 0.76f, 0.36f, 0.18f));
            AddImage("Phase Transition Horizon Core", phaseTransitionRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-430f, -1.2f), new Vector2(430f, 1.2f), new Color(1f, 0.86f, 0.54f, 0.30f));

            phaseTransitionContent = AddPanel("Phase Transition Content", phaseTransitionRoot, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-520f, -176f), new Vector2(520f, 184f), new Color(0.006f, 0.010f, 0.016f, 0.34f)).GetComponent<RectTransform>();
            AddFrame(phaseTransitionContent, "Phase Transition Content Frame", 1.2f, new Color(0.96f, 0.70f, 0.34f, 0.38f));
            AddImage("Phase Transition Content Wash", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(12f, 12f), new Vector2(-12f, -12f), new Color(0.96f, 0.64f, 0.24f, 0.045f));
            phaseTransitionKickerText = AddText("Phase Transition Kicker", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(36f, 278f), new Vector2(-36f, -36f), "钟声", 18, TextAnchor.UpperCenter, FontStyle.Bold);
            phaseTransitionTitleText = AddText("Phase Transition Title", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(36f, 152f), new Vector2(-36f, -72f), "天亮了", 56, TextAnchor.MiddleCenter, FontStyle.Bold);
            phaseTransitionSubtitleText = AddText("Phase Transition Subtitle", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(52f, 112f), new Vector2(-52f, -200f), "小镇重新睁开眼睛。", 22, TextAnchor.MiddleCenter, FontStyle.Normal);
            phaseTransitionHintText = AddText("Phase Transition Hint", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(52f, 74f), new Vector2(-52f, -250f), "阶段目标与可用行动已更新。", 14, TextAnchor.MiddleCenter, FontStyle.Normal);
            phaseTransitionHintText.color = new Color(0.80f, 0.86f, 0.90f, 0.88f);
            phaseTransitionRouteRoot = AddPanel("Phase Transition Route Strip", phaseTransitionContent, Vector2.zero, Vector2.one, new Vector2(148f, 16f), new Vector2(-148f, -298f), new Color(0.004f, 0.010f, 0.016f, 0.42f)).GetComponent<RectTransform>();
            phaseTransitionRouteRoot.GetComponent<Image>().raycastTarget = false;
            AddFrame(phaseTransitionRouteRoot, "Phase Transition Route Frame", 0.75f, new Color(0.96f, 0.70f, 0.34f, 0.20f));
            phaseTransitionRouteAccent = AddImage("Phase Transition Route Accent", phaseTransitionRouteRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), new Color(1f, 0.76f, 0.34f, 0.40f));
            phaseTransitionRouteConnectorA = AddImage("Phase Transition Route Connector A", phaseTransitionRouteRoot, Vector2.zero, Vector2.zero, new Vector2(182f, 22f), new Vector2(202f, 25f), new Color(1f, 0.76f, 0.34f, 0.28f));
            phaseTransitionRouteConnectorB = AddImage("Phase Transition Route Connector B", phaseTransitionRouteRoot, Vector2.zero, Vector2.zero, new Vector2(404f, 22f), new Vector2(424f, 25f), new Color(1f, 0.76f, 0.34f, 0.28f));
            phaseTransitionCueStageText = AddPhaseTransitionRouteChip("Stage", "当前", new Vector2(16f, 6f), new Vector2(178f, 42f));
            phaseTransitionCueActionText = AddPhaseTransitionRouteChip("Action", "下一步", new Vector2(206f, 6f), new Vector2(400f, 42f));
            phaseTransitionCueStateText = AddPhaseTransitionRouteChip("State", "同步", new Vector2(428f, 6f), new Vector2(588f, 42f));
            SetRaycastTargetsExceptButtons(phaseTransitionRouteRoot);

            phaseTransitionRoot.gameObject.SetActive(false);
        }


        private Text AddPhaseTransitionRouteChip(string key, string label, Vector2 bottomLeft, Vector2 topRight)
        {
            var chip = AddPanel($"Phase Transition Route Chip {key}", phaseTransitionRouteRoot, Vector2.zero, Vector2.zero, bottomLeft, topRight, new Color(0.010f, 0.016f, 0.022f, 0.48f));
            AddFrame(chip.transform, "Phase Transition Route Chip Frame", 0.55f, new Color(0.96f, 0.70f, 0.34f, 0.18f));
            AddImage("Phase Transition Route Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(3f, 0f), new Color(1f, 0.76f, 0.34f, 0.34f));
            AddText("Phase Transition Route Chip Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 20f), new Vector2(-8f, -3f), label, 8, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.74f, 0.82f, 0.86f, 0.74f);
            var value = AddText("Phase Transition Route Chip Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 5f), new Vector2(-8f, -18f), "", 11, TextAnchor.UpperLeft, FontStyle.Bold);
            value.color = new Color(0.98f, 0.91f, 0.78f, 0.94f);
            SetRaycastTargetsExceptButtons(chip.transform);
            return value;
        }


        private void BeginPhaseTransition(string stage, bool pending)
        {
            if (phaseTransitionRoot == null || phaseTransitionGroup == null) return;
            if (!StageDialogueLifecycleAllowed())
            {
                ClearStageDialogueLifecycle(false);
                return;
            }
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
            if (!StageDialogueLifecycleAllowed()) return;
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

            yield return FadePhaseTransition(0f, 1f, 0.24f, 0.96f, 1.00f);
            yield return new WaitForSecondsRealtime(PhaseTransitionHoldSeconds(stage, pending));
            yield return FadePhaseTransition(1f, 0f, pending ? 0.26f : 0.34f, 1.00f, 1.035f);

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
            if (pending) return stage == "night" ? 1.20f : 0.55f;
            if (stage == "night") return 2.10f;
            if (stage == "private") return 1.05f;
            if (stage == "public") return 1.15f;
            if (stage == "nomination") return 0.90f;
            return 0.95f;
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
            var accent = PhaseTransitionAccentColor(stage);
            if (phaseTransitionRouteAccent != null) phaseTransitionRouteAccent.color = new Color(accent.r, accent.g, accent.b, pending ? 0.32f : 0.46f);
            if (phaseTransitionRouteConnectorA != null) phaseTransitionRouteConnectorA.color = new Color(accent.r, accent.g, accent.b, pending ? 0.22f : 0.34f);
            if (phaseTransitionRouteConnectorB != null) phaseTransitionRouteConnectorB.color = new Color(accent.r, accent.g, accent.b, pending ? 0.22f : 0.34f);

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
                ? "等待新阶段返回，棋盘会自动刷新。"
                : PhaseTransitionHint(stage);
            UpdatePhaseTransitionCue(stage, pending);
        }


        private bool StageDialogueLifecycleAllowed()
        {
            if (!gameplayEntered || vm == null) return false;
            if (mainMenuRoot != null && mainMenuRoot.gameObject.activeSelf) return false;
            if (rolePickerPanel != null && rolePickerPanel.gameObject.activeSelf) return false;
            if (settingsPanel != null && settingsPanel.gameObject.activeSelf) return false;
            var phase = (vm.phase ?? "").Trim().ToLowerInvariant();
            if (phase != "night" && phase != "day" && phase != "ended") return false;
            return true;
        }


        private void ClearStageDialogueLifecycle(bool clearPendingAction)
        {
            stageDialogueQueue.Clear();
            stageDialoguePages.Clear();
            stageDialoguePageIndex = 0;
            stageDialogueTyping = false;
            stageDialogueCurrentPageText = "";
            stageDialogueBaseTag = "";
            stageDialogueFocusPlayerId = "";
            stageDialogueSpeakerPlayerId = "";
            stageDialogueTargetPlayerId = "";
            hasQueuedPhaseTransitionAfterDialogue = false;
            queuedPhaseTransitionAfterDialogueStage = "";
            queuedPhaseTransitionAfterDialoguePending = false;
            queuedPhaseTransitionStage = "";
            queuedPhaseTransitionPending = false;
            hasPendingPostPhaseNarration = false;
            pendingPostPhaseTimelinePreviousKey = "";
            pendingPostPhaseTimelineNextKey = "";
            pendingPostPhasePrivateInfoPreviousKey = "";
            pendingPostPhasePrivateInfoNextKey = "";
            pendingPostPhaseNightActionPreviousKey = "";
            pendingPostPhaseNightActionNextKey = "";
            lastPhaseTransitionKey = "";
            lastTimelineNarrationKey = "";
            lastPrivateInfoNarrationKey = "";
            lastNightActionNarrationKey = "";
            lastNominationDebateNarrationKey = "";
            lastVoteCeremonyNarrationKey = "";
            lastActionStatusNarrationKey = "";
            voteAnimationKey = "";
            voteAnimationStep = -1;
            lastProactiveOfferQueueKey = "";
            snoozedProactiveOfferId = "";

            if (stageDialogueRoutine != null)
            {
                StopCoroutine(stageDialogueRoutine);
                stageDialogueRoutine = null;
            }
            if (phaseTransitionRoutine != null)
            {
                StopCoroutine(phaseTransitionRoutine);
                phaseTransitionRoutine = null;
            }
            if (delayedPhaseActionRoutine != null)
            {
                StopCoroutine(delayedPhaseActionRoutine);
                delayedPhaseActionRoutine = null;
            }
            if (delayedEntryDialogueRoutine != null)
            {
                StopCoroutine(delayedEntryDialogueRoutine);
                delayedEntryDialogueRoutine = null;
            }

            if (stageDialogueBodyText != null) stageDialogueBodyText.text = "";
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
            if (stageDialogueQueueStripRoot != null) stageDialogueQueueStripRoot.gameObject.SetActive(false);
            if (stageDialogueContextRailRoot != null) stageDialogueContextRailRoot.gameObject.SetActive(false);

            if (phaseTransitionGroup != null)
            {
                phaseTransitionGroup.alpha = 0f;
                phaseTransitionGroup.blocksRaycasts = false;
            }
            if (phaseTransitionContent != null) phaseTransitionContent.localScale = Vector3.one;
            if (phaseTransitionRoot != null) phaseTransitionRoot.gameObject.SetActive(false);

            if (proactiveWhisperPanel != null) proactiveWhisperPanel.gameObject.SetActive(false);
            if (nominationDebatePanel != null) nominationDebatePanel.gameObject.SetActive(false);
            if (votePanel != null) votePanel.gameObject.SetActive(false);
            if (clearPendingAction) ClearPendingAction();
            ApplyBottomDockVisibility();
            ApplyModalBackdropVisibility();
            RenderGrimoire();
        }


        private void UpdatePhaseTransitionCue(string stage, bool pending)
        {
            var accent = PhaseTransitionAccentColor(stage);
            if (phaseTransitionCueStageText != null)
            {
                phaseTransitionCueStageText.text = $"目标：{PhaseTransitionStageName(stage)}";
                phaseTransitionCueStageText.color = accent;
            }
            if (phaseTransitionCueActionText != null)
            {
                phaseTransitionCueActionText.text = pending ? "等待核心同步" : $"下一步：{PhaseTransitionNextAction(stage)}";
                phaseTransitionCueActionText.color = new Color(0.98f, 0.91f, 0.78f, 0.94f);
            }
            if (phaseTransitionCueStateText != null)
            {
                phaseTransitionCueStateText.text = pending ? "状态：推进中" : "状态：已刷新";
                phaseTransitionCueStateText.color = pending
                    ? new Color(0.78f, 0.88f, 1f, 0.90f)
                    : new Color(0.78f, 1f, 0.72f, 0.90f);
            }
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
            if (stage == "nomination") return "选择玩家后可提名，投票结果会以仪式镜头展示。";
            if (stage == "public") return "可公聊、查看日志，或继续观察玩家发言。";
            if (stage == "ended") return "可打开复盘、时间线和全知视角检查结果。";
            return "私聊面板、行动区和阶段目标已刷新。";
        }


        private static string PhaseTransitionNextAction(string stage)
        {
            if (stage == "night") return "处理夜间行动";
            if (stage == "nomination") return "选择玩家提名";
            if (stage == "public") return "推进公聊";
            if (stage == "ended") return "打开复盘";
            return "收集私聊线索";
        }


        private static Color PhaseTransitionTintColor(string stage, bool pending)
        {
            var alpha = pending ? 0.30f : 0.44f;
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
            if (!StageDialogueLifecycleAllowed()) return;
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
            if (!StageDialogueLifecycleAllowed())
            {
                hasQueuedPhaseTransitionAfterDialogue = false;
                queuedPhaseTransitionAfterDialogueStage = "";
                queuedPhaseTransitionAfterDialoguePending = false;
                return false;
            }
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
                    return "第一夜降临。所有人闭眼，夜间顺序从这里开始。\n如果你的身份此夜需要主动选择，先打开夜间行动；否则可以点击右侧的“结算夜晚”，处理首夜信息并天亮。";
                }
                return "夜幕降临。所有人闭眼，角色按夜晚顺序依次行动。就算你没有可选行动，夜晚也会先流动一会儿。";
            }
            if (stage == "public")
            {
                return "公聊开始。公开发言会在底部对话框出现，也会写入右侧时间线。先听一轮，再决定是否进入提名。";
            }
            if (stage == "nomination")
            {
                return "提名阶段开启。选择玩家后可以提名；投票会进入仪式镜头，结果会标在对应玩家上。";
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
                .Select(PlayerFacingEventLine)
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
            var humanPublicAbility = speaker != null
                && speaker.human
                && IsPublicTimelineEntry(mode)
                && (string.Equals(entry.intent, "public-ability", StringComparison.OrdinalIgnoreCase)
                    || !string.IsNullOrWhiteSpace(entry.abilityRoleId));
            if (speaker != null && speaker.human && !humanPublicAbility) return false;
            return true;
        }


        private PlayerViewModel StageDialoguePlayerById(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return null;
            return (vm?.players ?? Array.Empty<PlayerViewModel>()).FirstOrDefault((player) => player != null && player.id == playerId);
        }


        private void MaybeQueueNominationDebateNarration(string previousKey, string nextKey)
        {
            if (!gameplayEntered || vm?.nominationDebate == null) return;
            if (string.IsNullOrWhiteSpace(nextKey) || nextKey == previousKey) return;
            var debate = vm.nominationDebate;
            if (!debate.active) return;
            var intro = $"{FirstNonEmpty(debate.nominatorName, "提名者")} 提名 {FirstNonEmpty(debate.nomineeName, "被提名者")}";
            if (!string.IsNullOrWhiteSpace(debate.reason)) intro += $"。\n理由：{debate.reason.Trim()}";
            QueueStageDialogue("说书人", intro, "提名互辩", debate.nominatorId, debate.nomineeId);
            foreach (var line in (debate.lines ?? Array.Empty<NominationDebateLineViewModel>()).Where((entry) => entry != null && !entry.pending && !string.IsNullOrWhiteSpace(entry.text)).TakeLast(4))
            {
                QueueStageDialogue(FirstNonEmpty(line.speakerName, NameForPlayerId(line.speakerId)), line.text.Trim(), "提名互辩", line.speakerId, debate.nomineeId);
            }
        }


        private void MaybeQueueVoteCeremonyNarration(string previousKey, string nextKey)
        {
            if (!gameplayEntered || vm?.voteCeremony == null) return;
            if (string.IsNullOrWhiteSpace(nextKey) || nextKey == previousKey) return;
            var vote = vm.voteCeremony;
            if (string.IsNullOrWhiteSpace(vote.nomineeId)) return;
            var yesVoters = (vote.voters ?? Array.Empty<VoteViewModel>())
                .Where((entry) => entry != null && entry.vote)
                .OrderBy((entry) => entry.seat)
                .Select((entry) => FirstNonEmpty(entry.voterName, $"{entry.seat}号"))
                .Take(8)
                .ToArray();
            var yesLine = yesVoters.Length == 0 ? "无人举手" : string.Join(" / ", yesVoters);
            var body = $"{FirstNonEmpty(vote.nominatorName, "提名者")} 提名 {FirstNonEmpty(vote.nomineeName, "被提名者")}。\n"
                + $"票数：{vote.yesVotes}/{vote.threshold}，{FirstNonEmpty(vote.resultText, vote.passed ? "通过" : "未通过")}。\n"
                + $"举手：{yesLine}\n"
                + "投票标记已同步到魔典；需要回放时可打开投票仪式。";
            QueueStageDialogue("说书人", body, "投票结果", vote.nominatorId, vote.nomineeId);
        }


        private void MaybeQueueActionStatusNarration(string previousKey, string nextKey)
        {
            if (!gameplayEntered || vm?.action == null) return;
            if (string.IsNullOrWhiteSpace(nextKey) || nextKey == previousKey) return;
            var action = vm.action;
            if (string.IsNullOrWhiteSpace(action.lastActionId) || string.IsNullOrWhiteSpace(action.lastActionType)) return;
            if (!ShouldNarrateActionStatus(action.lastActionType)) return;
            var ok = !string.Equals(action.status, "error", StringComparison.OrdinalIgnoreCase);
            var title = ok ? "行动已同步" : "行动同步失败";
            var message = FirstNonEmpty(action.message, ok ? "本次行动已处理。" : "请检查同步状态。");
            QueueStageDialogue("说书人", $"{ActionStatusDisplayName(action.lastActionType)}：{message}", title, "", action.selectedPlayerId);
        }


        private static bool ShouldNarrateActionStatus(string actionType)
        {
            if (string.IsNullOrWhiteSpace(actionType)) return false;
            var type = actionType.Trim().ToLowerInvariant();
            if (type == "select-token") return false;
            if (type == "grimoire-reminder" || type == "grimoire-mark-role") return false;
            if (type == "ai-public-step" || type == "ai-nomination-step") return false;
            if (type == "ai-private-whispers" || type == "ai-proactive-whispers") return false;
            if (type == "resolve-nomination-vote" || type == "human-nomination-intent" || type == "nomination-debate-response") return false;
            if (type == "decline-proactive-whisper") return false;
            return type.Contains("action")
                || type.Contains("storyteller")
                || type.Contains("nomination")
                || type.Contains("vote")
                || type.Contains("whisper")
                || type.Contains("private")
                || type.Contains("phase");
        }


        private static string ActionStatusDisplayName(string actionType)
        {
            var type = (actionType ?? "").Trim().ToLowerInvariant();
            if (type.Contains("storyteller")) return "说书人行动";
            if (type.Contains("vote")) return "投票";
            if (type.Contains("nomination")) return "提名";
            if (type.Contains("private") || type.Contains("whisper")) return "私聊";
            if (type.Contains("phase")) return "阶段推进";
            if (type.Contains("night")) return "夜间行动";
            if (type.Contains("day")) return "白天行动";
            return "行动";
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


        private static string NominationDebateNarrationKey(PrototypeViewModel model)
        {
            var debate = model?.nominationDebate;
            if (debate == null || !debate.active) return "";
            var lines = debate.lines ?? Array.Empty<NominationDebateLineViewModel>();
            var lineBits = string.Join("|", lines.Where((entry) => entry != null && !entry.pending).Select((entry) => $"{entry.speakerId}:{entry.role}:{entry.text}").TakeLast(5));
            return $"{debate.nominationId}:{debate.day}:{debate.nominatorId}:{debate.nomineeId}:{debate.reason}:{lineBits}";
        }


        private static string VoteCeremonyNarrationKey(PrototypeViewModel model)
        {
            var vote = model?.voteCeremony;
            if (vote == null || string.IsNullOrWhiteSpace(vote.nomineeId)) return "";
            var voters = vote.voters ?? Array.Empty<VoteViewModel>();
            var voterBits = string.Join(",", voters.OrderBy((entry) => entry.seat).Select((entry) => $"{entry.voterId}:{entry.vote}:{entry.abstain}:{entry.ghostVote}"));
            return $"{vote.day}:{vote.nominatorId}:{vote.nomineeId}:{vote.yesVotes}:{vote.threshold}:{vote.passed}:{voterBits}";
        }


        private static string ActionStatusNarrationKey(PrototypeViewModel model)
        {
            var action = model?.action;
            if (action == null || string.IsNullOrWhiteSpace(action.lastActionId)) return "";
            return $"{action.revision}:{action.lastActionId}:{action.lastActionType}:{action.status}:{action.message}";
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
            if (!StageDialogueLifecycleAllowed()) return;
            HideProactiveWhisperForStageDialogue();
            if (stageDialogueRoutine != null) StopCoroutine(stageDialogueRoutine);
            PrepareStageDialogue(speaker, body, tag, speakerId, targetId);
            stageDialoguePanel.SetAsLastSibling();
            stageDialogueRoutine = StartCoroutine(PlayStageDialoguePage(true));
        }


        private void QueueStageDialogue(string speaker, string body, string tag, string speakerId = "", string targetId = "")
        {
            if (!StageDialogueLifecycleAllowed()) return;
            HideProactiveWhisperForStageDialogue();
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
            if (!StageDialogueLifecycleAllowed()) return;
            if (vm == null || vm.phase != "night" || vm.night != 1 || vm.day != 0) return;
            BeginPhaseTransition("night", false);
        }


        private void ShowStageDialogueStill(string speaker, string body, string tag)
        {
            if (stageDialoguePanel == null || stageDialogueBodyText == null) return;
            if (!StageDialogueLifecycleAllowed()) return;
            HideProactiveWhisperForStageDialogue();
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
            ApplyBottomDockVisibility();
            stageDialoguePages.Clear();
            stageDialoguePages.AddRange(BuildDialoguePages(body, 3, 34));
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
            stageDialogueBaseTag = safeTag;
            if (stageDialogueSpeakerText != null) stageDialogueSpeakerText.text = Ellipsize(safeSpeaker, 26);
            UpdateStageDialogueTag();
            if (stageDialogueSourceText != null) stageDialogueSourceText.text = StageDialogueSourceLabel(stageDialogueSourceMode);
            RenderStageDialoguePortrait(safeSpeaker);
            UpdateStageDialogueMeta();
        }


        private void UpdateStageDialogueTag()
        {
            if (stageDialogueTagText == null) return;
            var tag = FirstNonEmpty(stageDialogueBaseTag, "发言");
            if (stageDialogueQueue.Count > 0) tag = $"{tag} · 待播 {stageDialogueQueue.Count}";
            else if (hasQueuedPhaseTransitionAfterDialogue) tag = $"{tag} · 转场待播";
            stageDialogueTagText.text = Ellipsize(tag, 18);
            stageDialogueTagText.color = stageDialogueQueue.Count > 0
                ? new Color(1f, 0.82f, 0.42f, 0.98f)
                : new Color(0.98f, 0.91f, 0.78f, 0.92f);
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
            if (mode == "nomination")
            {
                RenderNominationDebatePanel();
                return;
            }
            ShowInfoDrawer("events");
        }


        private void UpdateStageDialogueMeta()
        {
            UpdateStageDialogueTag();
            if (stageDialogueMetaText != null)
            {
                var page = stageDialoguePages.Count > 1 ? $"第 {stageDialoguePageIndex + 1}/{stageDialoguePages.Count} 段 · " : "";
                var queued = stageDialogueQueue.Count > 0 ? $" · 后续 {stageDialogueQueue.Count} 条" : "";
                var hint = stageDialogueTyping
                    ? "点击继续可直接显示整句"
                    : stageDialoguePageIndex + 1 < stageDialoguePages.Count ? "点击继续查看下一段" : "读完后可收起";
                stageDialogueMetaText.text = $"{page}{hint}{queued}";
            }
            UpdateStageDialogueContextRail();
            UpdateStageDialogueRouteRibbon();
            UpdateStageDialogueQueueStrip();
            if (stageDialogueContinueText != null)
            {
                stageDialogueContinueText.text = stageDialogueTyping
                    ? "跳过"
                    : stageDialoguePageIndex + 1 < stageDialoguePages.Count || stageDialogueQueue.Count > 0 ? "继续" : "完成";
            }
        }

        private void UpdateStageDialogueContextRail()
        {
            if (stageDialogueContextRailRoot == null) return;
            stageDialogueContextRailRoot.gameObject.SetActive(false);
            if (!StageDialogueAuxiliaryChromeEnabled()) return;
            ClearChildren(stageDialogueContextRailRoot);

            var accent = StageDialogueContextAccent(stageDialogueSourceMode);
            AddFrame(stageDialogueContextRailRoot, "Stage Dialogue Context Rail Frame", 0.65f, new Color(0.70f, 0.82f, 0.92f, 0.16f));
            AddImage("Stage Dialogue Context Rail Accent", stageDialogueContextRailRoot, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), accent);
            AddStageDialogueContextChip(stageDialogueContextRailRoot, 0, "来源", StageDialogueSourceLabel(stageDialogueSourceMode), accent);
            AddStageDialogueContextChip(stageDialogueContextRailRoot, 1, "焦点", StageDialogueFocusLabel(), new Color(0.22f, 0.46f, 0.78f, 0.78f));
            AddStageDialogueContextChip(stageDialogueContextRailRoot, 2, "进度", StageDialogueProgressLabel(), new Color(0.45f, 0.28f, 0.78f, 0.76f));
        }

        private void AddStageDialogueContextChip(Transform parent, int index, string label, string value, Color accent)
        {
            const float height = 30f;
            const float gap = 7f;
            var y = 78f - index * (height + gap);
            var fill = new Color(accent.r * 0.32f, accent.g * 0.32f, accent.b * 0.32f, 0.74f);
            var border = new Color(accent.r, accent.g, accent.b, 0.34f);
            var chip = AddPanel("Stage Dialogue Context Chip", parent, Vector2.zero, Vector2.zero, new Vector2(12f, y), new Vector2(166f, y + height), fill);
            AddFrame(chip.transform, "Stage Dialogue Context Chip Frame", 0.55f, border);
            AddImage("Stage Dialogue Context Chip Accent", chip.transform, Vector2.zero, new Vector2(0f, 1f), Vector2.zero, new Vector2(4f, 0f), border);
            AddText("Stage Dialogue Context Chip Label", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 15f), new Vector2(-8f, -2f), label, 9, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(0.88f, 0.92f, 0.96f, 0.70f);
            AddText("Stage Dialogue Context Chip Value", chip.transform, Vector2.zero, Vector2.one, new Vector2(10f, 3f), new Vector2(-8f, -15f), Ellipsize(FirstNonEmpty(value, "--"), 12), 11, TextAnchor.UpperLeft, FontStyle.Bold).color = new Color(1f, 0.92f, 0.74f, 0.96f);
        }

        private string StageDialogueFocusLabel()
        {
            var speaker = StageDialoguePlayerById(stageDialogueSpeakerPlayerId);
            var target = StageDialoguePlayerById(stageDialogueTargetPlayerId);
            if (speaker != null && target != null && speaker.id != target.id) return $"{speaker.seat}号->{target.seat}号";
            if (speaker != null) return $"{speaker.seat}号发言";
            if (target != null) return $"{target.seat}号焦点";
            var focus = StageDialoguePlayerById(stageDialogueFocusPlayerId);
            if (focus != null) return $"{focus.seat}号焦点";
            return stageDialogueSourceMode == "events" ? "说书人" : "时间线";
        }

        private string StageDialogueProgressLabel()
        {
            var pageCount = Mathf.Max(1, stageDialoguePages.Count);
            var page = pageCount > 1 ? $"{stageDialoguePageIndex + 1}/{pageCount}" : "1段";
            if (stageDialogueTyping) return $"{page} 打字中";
            if (stageDialogueQueue.Count > 0) return $"{page} +{stageDialogueQueue.Count}";
            if (hasQueuedPhaseTransitionAfterDialogue) return $"{page} 转场";
            return page;
        }

        private void UpdateStageDialogueRouteRibbon()
        {
            var accent = StageDialogueContextAccent(stageDialogueSourceMode);
            if (stageDialogueRouteAccentImage != null)
            {
                stageDialogueRouteAccentImage.color = new Color(accent.r, accent.g, accent.b, 0.54f);
            }
            UpdateStageDialogueSpeakerSpotlight(accent);
            if (stageDialogueRouteText != null)
            {
                stageDialogueRouteText.text = Ellipsize(StageDialogueRouteLabel(), 42);
                stageDialogueRouteText.color = new Color(1f, 0.92f, 0.74f, stageDialogueTyping ? 0.86f : 0.96f);
            }
        }

        private void UpdateStageDialogueSpeakerSpotlight(Color accent)
        {
            if (stageDialogueSpeakerSpotlightImage != null) stageDialogueSpeakerSpotlightImage.gameObject.SetActive(false);
            if (stageDialogueSpeakerBeamImage != null) stageDialogueSpeakerBeamImage.gameObject.SetActive(false);
            if (stageDialogueSpeakerBeamCoreImage != null) stageDialogueSpeakerBeamCoreImage.gameObject.SetActive(false);
            if (stageDialogueSpeakerBeamPinImage != null) stageDialogueSpeakerBeamPinImage.gameObject.SetActive(false);
            if (!StageDialogueAuxiliaryChromeEnabled()) return;
            var typingEase = stageDialogueTyping ? 0.78f : 1f;
            if (stageDialogueSpeakerSpotlightImage != null)
            {
                stageDialogueSpeakerSpotlightImage.color = new Color(accent.r, accent.g, accent.b, 0.046f * typingEase);
            }
            if (stageDialogueSpeakerBeamImage != null)
            {
                stageDialogueSpeakerBeamImage.color = new Color(accent.r, accent.g, accent.b, 0.120f * typingEase);
            }
            if (stageDialogueSpeakerBeamCoreImage != null)
            {
                stageDialogueSpeakerBeamCoreImage.color = new Color(1f, 0.90f, 0.62f, 0.42f * typingEase);
            }
            if (stageDialogueSpeakerBeamPinImage != null)
            {
                stageDialogueSpeakerBeamPinImage.color = new Color(accent.r, accent.g, accent.b, 0.74f * typingEase);
            }
        }

        private string StageDialogueRouteLabel()
        {
            var source = StageDialogueSourceLabel(stageDialogueSourceMode);
            var speaker = StageDialoguePlayerById(stageDialogueSpeakerPlayerId);
            var target = StageDialoguePlayerById(stageDialogueTargetPlayerId);
            if (speaker != null && target != null && speaker.id != target.id)
            {
                return $"{source} · {StageDialoguePlayerRouteName(speaker)} -> {StageDialoguePlayerRouteName(target)}";
            }
            if (speaker != null)
            {
                return $"{source} · {StageDialoguePlayerRouteName(speaker)} -> 全桌";
            }
            if (target != null)
            {
                return $"{source} · 说书人 -> {StageDialoguePlayerRouteName(target)}";
            }
            return stageDialogueSourceMode == "private"
                ? $"{source} · 私密频道回放"
                : $"{source} · 全桌广播";
        }

        private static string StageDialoguePlayerRouteName(PlayerViewModel player)
        {
            if (player == null) return "未知";
            var name = FirstNonEmpty(player.name, $"{player.seat}号");
            return $"{player.seat}号 {name}";
        }

        private static Color StageDialogueContextAccent(string mode)
        {
            if (mode == "private") return new Color(0.22f, 0.62f, 0.48f, 0.78f);
            if (mode == "timeline") return new Color(0.24f, 0.44f, 0.78f, 0.78f);
            if (mode == "recap") return new Color(0.46f, 0.30f, 0.78f, 0.78f);
            if (mode == "nomination") return new Color(0.82f, 0.38f, 0.16f, 0.80f);
            return new Color(0.82f, 0.56f, 0.24f, 0.78f);
        }


        private void UpdateStageDialogueQueueStrip()
        {
            if (stageDialogueQueueStripRoot == null) return;
            stageDialogueQueueStripRoot.gameObject.SetActive(false);
            if (!StageDialogueAuxiliaryChromeEnabled()) return;
            var pageCount = Mathf.Max(1, stageDialoguePages.Count);
            var queuedCount = stageDialogueQueue.Count;
            var transitionQueued = hasQueuedPhaseTransitionAfterDialogue;
            var show = pageCount > 1 || queuedCount > 0 || transitionQueued;
            stageDialogueQueueStripRoot.gameObject.SetActive(show);
            if (!show) return;

            if (stageDialogueQueueStatusText != null)
            {
                var page = pageCount > 1 ? $"当前 {stageDialoguePageIndex + 1}/{pageCount}" : "当前 1 段";
                var queue = queuedCount > 0 ? $" · 待播 {queuedCount}" : transitionQueued ? " · 转场待播" : "";
                stageDialogueQueueStatusText.text = $"{page}{queue}";
            }

            if (stageDialogueQueueNextText != null)
            {
                if (queuedCount > 0)
                {
                    var next = stageDialogueQueue.Peek();
                    stageDialogueQueueNextText.text = Ellipsize($"下一条：{FirstNonEmpty(next.speaker, "说书人")} · {FirstNonEmpty(next.tag, "发言")}", 34);
                }
                else if (transitionQueued)
                {
                    stageDialogueQueueNextText.text = Ellipsize($"下一条：{PhaseTransitionStageName(NormalizePhaseTransitionStage(queuedPhaseTransitionAfterDialogueStage))}", 34);
                }
                else
                {
                    stageDialogueQueueNextText.text = "继续当前长段";
                }
            }

            var totalSteps = Mathf.Max(1, pageCount + queuedCount + (transitionQueued ? 1 : 0));
            var visibleSteps = Mathf.Min(stageDialogueQueuePipImages.Count, totalSteps);
            var currentStepIndex = Mathf.Clamp(stageDialoguePageIndex, 0, Mathf.Max(0, visibleSteps - 1));
            var progress = totalSteps <= 1 ? 1f : Mathf.Clamp01((stageDialoguePageIndex + 1f) / totalSteps);
            UpdateStageDialogueQueueProgress(progress);
            for (var i = 0; i < stageDialogueQueuePipImages.Count; i++)
            {
                var pip = stageDialogueQueuePipImages[i];
                if (pip == null) continue;
                var active = i < visibleSteps;
                pip.gameObject.SetActive(active);
                if (!active) continue;
                pip.color = i < currentStepIndex
                    ? new Color(1f, 0.72f, 0.30f, 0.70f)
                    : i == currentStepIndex
                    ? new Color(1f, 0.78f, 0.30f, 0.96f)
                    : i <= Mathf.Min(queuedCount, visibleSteps - 1)
                        ? new Color(0.78f, 0.86f, 0.90f, 0.68f)
                        : new Color(0.50f, 0.58f, 0.64f, 0.42f);
            }
            if (stageDialogueQueueOverflowText != null)
            {
                stageDialogueQueueOverflowText.text = totalSteps > stageDialogueQueuePipImages.Count ? $"+{totalSteps - stageDialogueQueuePipImages.Count}" : "";
            }
        }


        private static bool StageDialogueAuxiliaryChromeEnabled()
        {
            return false;
        }

        private void UpdateStageDialogueQueueProgress(float progress)
        {
            var clamped = Mathf.Clamp01(progress);
            var fillRight = Mathf.Lerp(14f, 720f, clamped);
            if (stageDialogueQueueProgressFill != null)
            {
                stageDialogueQueueProgressFill.rectTransform.offsetMin = new Vector2(14f, 4f);
                stageDialogueQueueProgressFill.rectTransform.offsetMax = new Vector2(fillRight, 7f);
                stageDialogueQueueProgressFill.color = new Color(1f, 0.72f, 0.30f, Mathf.Lerp(0.48f, 0.82f, clamped));
            }
            if (stageDialogueQueueProgressKnob != null)
            {
                stageDialogueQueueProgressKnob.rectTransform.offsetMin = new Vector2(fillRight - 4f, 1f);
                stageDialogueQueueProgressKnob.rectTransform.offsetMax = new Vector2(fillRight + 4f, 9f);
                stageDialogueQueueProgressKnob.color = new Color(1f, 0.82f, 0.42f, 0.94f);
            }
        }


        private void RenderStageDialoguePortrait(string speaker)
        {
            var player = !string.IsNullOrWhiteSpace(stageDialogueSpeakerPlayerId)
                ? StageDialoguePlayerById(stageDialogueSpeakerPlayerId)
                : PlayerFromDialogueHeading(speaker);
            var storyteller = player == null && (string.IsNullOrWhiteSpace(speaker) || speaker.Contains("说书人") || speaker.Contains("Storyteller"));
            if (stageDialoguePortraitAuraImage != null)
            {
                stageDialoguePortraitAuraImage.color = storyteller
                    ? new Color(1f, 0.76f, 0.30f, 0.20f)
                    : new Color(0.46f, 0.74f, 1f, 0.15f);
            }
            if (stageDialoguePortraitGlowImage != null)
            {
                stageDialoguePortraitGlowImage.color = storyteller
                    ? new Color(1f, 0.76f, 0.30f, 0.075f)
                    : new Color(0.44f, 0.72f, 1f, 0.060f);
            }
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
            if (stageDialoguePortraitNameText != null)
            {
                stageDialoguePortraitNameText.text = storyteller
                    ? "说书人"
                    : player != null
                        ? (player.human ? "你" : $"{player.seat}号")
                        : Ellipsize(FirstNonEmpty(speaker, "发言者"), 6);
                stageDialoguePortraitNameText.color = storyteller ? new Color(1f, 0.84f, 0.48f, 0.92f) : new Color(0.76f, 0.88f, 1f, 0.88f);
            }
        }


        private void UpdateStageDialogueMotion()
        {
            if (UiMotionDisabled() || stageDialoguePanel == null || !stageDialoguePanel.gameObject.activeSelf) return;
            var time = Time.realtimeSinceStartup;
            var breath = 0.5f + 0.5f * Mathf.Sin(time * 2.6f);
            var storyteller = stageDialogueSpeakerText == null
                || string.IsNullOrWhiteSpace(stageDialogueSpeakerText.text)
                || stageDialogueSpeakerText.text.Contains("说书人")
                || stageDialogueSpeakerText.text.Contains("Storyteller");
            if (stageDialoguePortraitAuraRect != null)
            {
                stageDialoguePortraitAuraRect.localScale = Vector3.one * (1.0f + breath * 0.050f);
            }
            if (stageDialoguePortraitAuraImage != null)
            {
                stageDialoguePortraitAuraImage.color = storyteller
                    ? new Color(1f, 0.76f, 0.30f, 0.16f + breath * 0.11f)
                    : new Color(0.46f, 0.74f, 1f, 0.11f + breath * 0.085f);
            }
            if (stageDialoguePortraitGlowImage != null)
            {
                stageDialoguePortraitGlowImage.color = storyteller
                    ? new Color(1f, 0.76f, 0.30f, 0.052f + breath * 0.050f)
                    : new Color(0.44f, 0.72f, 1f, 0.042f + breath * 0.040f);
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
            stageDialogueBaseTag = "";
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
            ApplyBottomDockVisibility();
            RenderGrimoire();
            if (StageDialogueLifecycleAllowed())
            {
                StartQueuedPhaseTransitionAfterDialogue();
                ScheduleProactiveWhisperRenderAfterDialogue();
            }
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
            if (value.Contains("提名")) return "nomination";
            return "events";
        }


        private static string StageDialogueSourceLabel(string mode)
        {
            if (mode == "private") return "私聊";
            if (mode == "timeline") return "时间线";
            if (mode == "recap") return "复盘";
            if (mode == "nomination") return "投票";
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
