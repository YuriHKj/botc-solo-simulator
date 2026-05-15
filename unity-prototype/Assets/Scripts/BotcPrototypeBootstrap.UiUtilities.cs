using System;
using System.Collections;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed partial class BotcPrototypeBootstrap : MonoBehaviour
    {
        private static string RoleFallbackLabel(string roleId, string roleName)
        {
            if (!string.IsNullOrWhiteSpace(roleName)) return roleName.Substring(0, Mathf.Min(1, roleName.Length));
            return string.IsNullOrWhiteSpace(roleId) ? "?" : roleId.Substring(0, 1).ToUpperInvariant();
        }

        private static Color RoleHaloColor(string category, string team, bool selected)
        {
            if (selected) return new Color(1f, 0.76f, 0.30f, 0.96f);
            if (string.Equals(team, "evil", StringComparison.OrdinalIgnoreCase) || category == "minion" || category == "demon")
            {
                return category == "demon" ? new Color(0.72f, 0.05f, 0.10f, 0.86f) : new Color(0.78f, 0.10f, 0.18f, 0.74f);
            }
            if (category == "outsider") return new Color(0.18f, 0.45f, 0.92f, 0.72f);
            return new Color(0.16f, 0.50f, 0.95f, 0.76f);
        }

        private static string ReminderShort(string reminder)
        {
            if (string.IsNullOrWhiteSpace(reminder)) return "?";
            var lower = reminder.ToLowerInvariant();
            if (lower.Contains("poison") || reminder.Contains("毒")) return "P";
            if (lower.Contains("drunk") || reminder.Contains("醉")) return "D";
            if (lower.Contains("ghost") || reminder.Contains("鬼")) return "G";
            if (lower.Contains("guard") || reminder.Contains("守")) return "S";
            return reminder.Length <= 2 ? reminder : reminder.Substring(0, Mathf.Min(2, reminder.Length));
        }

        private Image AddImage(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            go.transform.SetParent(parent, false);
            SetRect(go.GetComponent<RectTransform>(), anchorMin, anchorMax, offsetMin, offsetMax);
            var image = go.GetComponent<Image>();
            image.color = color;
            return image;
        }

        private Image AddCircleImage(string name, Transform parent, float radius, Color color, bool ring)
        {
            var image = AddImage(name, parent, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-radius, -radius), new Vector2(radius, radius), color);
            image.sprite = ring ? GetCircleRingSprite() : GetCircleFillSprite();
            image.preserveAspect = true;
            image.raycastTarget = false;
            return image;
        }

        private GameObject AddPanel(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax, Color color)
        {
            return AddImage(name, parent, anchorMin, anchorMax, offsetMin, offsetMax, color).gameObject;
        }

        private Text AddText(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax, string text, int size, TextAnchor anchor, FontStyle style)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            go.transform.SetParent(parent, false);
            SetRect(go.GetComponent<RectTransform>(), anchorMin, anchorMax, offsetMin, offsetMax);
            var label = go.GetComponent<Text>();
            label.font = GetUiFont(text, size, style);
            label.text = text;
            label.fontSize = size;
            label.alignment = anchor;
            label.fontStyle = style;
            label.color = new Color(0.98f, 0.91f, 0.78f, 1f);
            label.horizontalOverflow = HorizontalWrapMode.Wrap;
            label.verticalOverflow = VerticalWrapMode.Truncate;
            if (size >= 22 || style != FontStyle.Normal)
            {
                var shadow = go.AddComponent<Shadow>();
                shadow.effectColor = new Color(0f, 0f, 0f, 0.72f);
                shadow.effectDistance = new Vector2(2f, -2f);
            }
            return label;
        }

        private InputField AddInputField(string name, Transform parent, Vector2 offsetMin, Vector2 offsetMax, string placeholderText)
        {
            var panel = AddPanel(name, parent, Vector2.zero, Vector2.zero, offsetMin, offsetMax, new Color(0.020f, 0.026f, 0.032f, 0.92f));
            AddFrame(panel.transform, $"{name} Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.34f));
            var input = panel.AddComponent<InputField>();
            var text = AddText("Text", panel.transform, Vector2.zero, Vector2.one, new Vector2(10f, 2f), new Vector2(-10f, -2f), "", 14, TextAnchor.MiddleLeft, FontStyle.Normal);
            text.color = new Color(0.98f, 0.93f, 0.82f, 1f);
            text.supportRichText = false;
            var placeholder = AddText("Placeholder", panel.transform, Vector2.zero, Vector2.one, new Vector2(10f, 2f), new Vector2(-10f, -2f), placeholderText, 13, TextAnchor.MiddleLeft, FontStyle.Italic);
            placeholder.color = new Color(0.76f, 0.70f, 0.62f, 0.72f);
            input.textComponent = text;
            input.placeholder = placeholder;
            input.lineType = InputField.LineType.SingleLine;
            input.characterLimit = 120;
            input.caretColor = new Color(1f, 0.82f, 0.48f, 1f);
            input.selectionColor = new Color(0.8f, 0.55f, 0.25f, 0.36f);
            return input;
        }

        private Toggle AddToggle(string name, Transform parent, Vector2 anchoredPosition, string label)
        {
            var root = new GameObject(name, typeof(RectTransform), typeof(Toggle));
            root.transform.SetParent(parent, false);
            SetRect(root.GetComponent<RectTransform>(), Vector2.zero, Vector2.zero, anchoredPosition, anchoredPosition + new Vector2(320f, 32f));
            var box = AddImage("Box", root.transform, Vector2.zero, Vector2.zero, new Vector2(0f, 4f), new Vector2(20f, 24f), new Color(0.020f, 0.026f, 0.032f, 0.95f));
            AddFrame(box.transform, "Box Frame", 0.8f, new Color(0.86f, 0.58f, 0.26f, 0.45f));
            var check = AddImage("Checkmark", box.transform, Vector2.zero, Vector2.one, new Vector2(4f, 4f), new Vector2(-4f, -4f), new Color(1f, 0.76f, 0.32f, 0.95f));
            AddText("Label", root.transform, Vector2.zero, Vector2.one, new Vector2(36f, 0f), Vector2.zero, label, 14, TextAnchor.MiddleLeft, FontStyle.Normal);
            var toggle = root.GetComponent<Toggle>();
            toggle.targetGraphic = box;
            toggle.graphic = check;
            toggle.isOn = false;
            return toggle;
        }

        private void AddFrame(Transform parent, string name, float thickness, Color color)
        {
            AddImage($"{name} Top", parent, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, -thickness), new Vector2(0f, 0f), color);
            AddImage($"{name} Bottom", parent, new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 0f), new Vector2(0f, thickness), color);
            AddImage($"{name} Left", parent, new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(thickness, 0f), color);
            AddImage($"{name} Right", parent, new Vector2(1f, 0f), new Vector2(1f, 1f), new Vector2(-thickness, 0f), new Vector2(0f, 0f), color);
        }

        private static void ClearChildren(Transform parent)
        {
            if (parent == null) return;
            for (var i = parent.childCount - 1; i >= 0; i--) Destroy(parent.GetChild(i).gameObject);
        }

        private static void SetRaycastTargetsExceptButtons(Transform root)
        {
            if (root == null) return;
            foreach (var graphic in root.GetComponentsInChildren<Graphic>(true))
            {
                graphic.raycastTarget = graphic.GetComponentInParent<Button>() != null;
            }
        }

        private void AddRightClickHandler(GameObject target, Action onRightClick)
        {
            if (target == null || onRightClick == null) return;
            var trigger = target.GetComponent<UnityEngine.EventSystems.EventTrigger>() ?? target.AddComponent<UnityEngine.EventSystems.EventTrigger>();
            var entry = new UnityEngine.EventSystems.EventTrigger.Entry
            {
                eventID = UnityEngine.EventSystems.EventTriggerType.PointerClick
            };
            entry.callback.AddListener((eventData) =>
            {
                var pointer = eventData as UnityEngine.EventSystems.PointerEventData;
                if (pointer == null || pointer.button != UnityEngine.EventSystems.PointerEventData.InputButton.Right) return;
                onRightClick();
            });
            trigger.triggers.Add(entry);
        }

        private Button AddButton(string label, Transform parent, Vector2 anchoredPosition, Vector2 size, UnityEngine.Events.UnityAction onClick)
        {
            var half = size * 0.5f;
            var panel = AddPanel($"Button {label}", parent, Vector2.zero, Vector2.zero, anchoredPosition - half, anchoredPosition + half, new Color(0.18f, 0.095f, 0.036f, 0.82f));
            AddImage("Button Glow", panel.transform, new Vector2(0f, 0.55f), new Vector2(1f, 1f), new Vector2(3f, -3f), new Vector2(-3f, -3f), new Color(1f, 0.76f, 0.36f, 0.075f));
            AddImage("Button Left Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(3f, 0f), new Color(0.96f, 0.65f, 0.26f, 0.38f));
            AddFrame(panel.transform, "Button Frame", 0.9f, new Color(0.94f, 0.68f, 0.34f, 0.44f));
            var button = panel.AddComponent<Button>();
            button.onClick.AddListener(onClick);
            ApplyButtonStyle(button);
            var fontSize = size.y <= 28f ? 14 : label.Length > 8 ? 16 : 19;
            AddText("Label", panel.transform, Vector2.zero, Vector2.one, new Vector2(3f, 0f), new Vector2(-3f, 0f), label, fontSize, TextAnchor.MiddleCenter, FontStyle.Bold);
            return button;
        }

        private Button AddToolActionButton(string icon, string label, Transform parent, Vector2 anchoredPosition, Vector2 size, UnityEngine.Events.UnityAction onClick, bool compact = false)
        {
            var half = size * 0.5f;
            var panel = AddPanel($"Tool Button {label}", parent, Vector2.zero, Vector2.zero, anchoredPosition - half, anchoredPosition + half, new Color(0.12f, 0.065f, 0.030f, compact ? 0.82f : 0.86f));
            AddImage("Tool Button Glow", panel.transform, new Vector2(0f, 0.55f), new Vector2(1f, 1f), new Vector2(3f, -3f), new Vector2(-3f, -3f), new Color(1f, 0.72f, 0.30f, compact ? 0.055f : 0.085f));
            AddFrame(panel.transform, "Tool Button Frame", 0.9f, new Color(0.94f, 0.68f, 0.34f, compact ? 0.38f : 0.48f));

            var button = panel.AddComponent<Button>();
            panel.AddComponent<CanvasGroup>();
            button.onClick.AddListener(onClick);
            ApplyButtonStyle(button);

            var iconSize = compact ? Mathf.Min(24f, size.y - 6f) : Mathf.Min(30f, size.y - 6f);
            var iconLeft = 7f;
            var iconBottom = (size.y - iconSize) * 0.5f;
            var badge = AddImage("Tool Icon Badge", panel.transform, Vector2.zero, Vector2.zero, new Vector2(iconLeft, iconBottom), new Vector2(iconLeft + iconSize, iconBottom + iconSize), new Color(0.020f, 0.030f, 0.040f, 0.76f));
            AddFrame(badge.transform, "Tool Icon Badge Frame", 0.7f, new Color(0.70f, 0.82f, 0.92f, 0.24f));
            var iconText = AddText("Tool Icon", badge.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, icon, compact ? 13 : 16, TextAnchor.MiddleCenter, FontStyle.Bold);
            iconText.color = new Color(1f, 0.82f, 0.42f, 0.98f);

            var labelLeft = iconLeft + iconSize + (compact ? 6f : 8f);
            var fontSize = compact ? label.Length > 3 ? 13 : 14 : label.Length > 4 ? 15 : 17;
            AddText("Tool Label", panel.transform, Vector2.zero, Vector2.one, new Vector2(labelLeft, 0f), new Vector2(-6f, 0f), label, fontSize, TextAnchor.MiddleLeft, FontStyle.Bold);
            return button;
        }

        private static Text ToolButtonLabel(Button button)
        {
            if (button == null) return null;
            return button.GetComponentsInChildren<Text>(true).FirstOrDefault((entry) => entry != null && entry.name == "Tool Label")
                ?? button.GetComponentsInChildren<Text>(true).FirstOrDefault();
        }

        private static void SetToolButtonEnabled(Button button, bool enabled)
        {
            if (button == null) return;
            button.interactable = enabled;
            var group = button.GetComponent<CanvasGroup>();
            if (group != null) group.alpha = enabled ? 1f : 0.42f;
        }

        private void SetButtonSuggested(Button button, bool suggested)
        {
            if (button == null) return;
            var root = button.transform as RectTransform;
            if (root == null) return;
            var glow = root.Find("Suggested Glow")?.GetComponent<Image>();
            if (glow == null)
            {
                glow = AddImage("Suggested Glow", root, Vector2.zero, Vector2.one, new Vector2(-5f, -5f), new Vector2(5f, 5f), new Color(1f, 0.76f, 0.24f, 0.28f));
                glow.raycastTarget = false;
                glow.transform.SetAsFirstSibling();
                suggestedButtonGlows.Add(glow);
            }
            if (!suggestedButtonGlows.Contains(glow)) suggestedButtonGlows.Add(glow);
            var marker = root.Find("Suggested Marker")?.GetComponent<Text>();
            if (marker == null)
            {
                marker = AddText("Suggested Marker", root, new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(7f, -13f), new Vector2(29f, 13f), ">", 20, TextAnchor.MiddleCenter, FontStyle.Bold);
                marker.raycastTarget = false;
                marker.transform.SetAsLastSibling();
                suggestedButtonMarkers.Add(marker);
            }
            marker.color = new Color(1f, 0.82f, 0.28f, 1f);
            if (!suggestedButtonMarkers.Contains(marker)) suggestedButtonMarkers.Add(marker);
            var active = suggested && button.interactable;
            glow.gameObject.SetActive(active);
            marker.gameObject.SetActive(active);
        }

        private Button AddRoleTokenButton(Transform parent, string roleId, string roleName, string category, string team, Vector2 center, float tokenSize, bool selected, UnityEngine.Events.UnityAction onClick)
        {
            var width = tokenSize + 22f;
            var height = tokenSize + 36f;
            var root = AddPanel($"Role Token {roleId}", parent, Vector2.zero, Vector2.zero, center - new Vector2(width, height) * 0.5f, center + new Vector2(width, height) * 0.5f, new Color(0f, 0f, 0f, 0f));
            var rootImage = root.GetComponent<Image>();
            rootImage.raycastTarget = true;

            var button = root.AddComponent<Button>();
            button.targetGraphic = rootImage;
            ApplyButtonStyle(button);
            button.onClick.AddListener(onClick);

            var tokenBottom = 28f;
            var halo = AddImage("Role Halo", root.transform, Vector2.zero, Vector2.zero, new Vector2(5f, tokenBottom - 7f), new Vector2(width - 5f, tokenBottom + tokenSize + 7f), RoleHaloColor(category, team, selected));
            halo.sprite = GetCircleRingSprite();
            halo.preserveAspect = true;
            halo.raycastTarget = false;

            var token = AddImage("Role Parchment", root.transform, Vector2.zero, Vector2.zero, new Vector2(11f, tokenBottom), new Vector2(width - 11f, tokenBottom + tokenSize), Color.white);
            token.sprite = SpriteFromResource("Botc/ui/token1") ?? GetCircleFillSprite();
            token.preserveAspect = true;
            token.raycastTarget = false;

            var icon = AddImage("Role Icon", root.transform, Vector2.zero, Vector2.zero, new Vector2(18f, tokenBottom + 10f), new Vector2(width - 18f, tokenBottom + tokenSize - 14f), Color.white);
            icon.sprite = string.IsNullOrWhiteSpace(roleId) ? null : SpriteFromResource($"Botc/roles/{roleId}");
            icon.preserveAspect = true;
            icon.raycastTarget = false;
            if (icon.sprite == null)
            {
                icon.color = new Color(1f, 1f, 1f, 0f);
                AddText("Role Fallback", root.transform, Vector2.zero, Vector2.zero, new Vector2(18f, tokenBottom + 10f), new Vector2(width - 18f, tokenBottom + tokenSize - 14f), RoleFallbackLabel(roleId, roleName), Mathf.RoundToInt(tokenSize * 0.30f), TextAnchor.MiddleCenter, FontStyle.Bold);
            }

            var label = AddText("Role Label", root.transform, Vector2.zero, Vector2.zero, new Vector2(0f, 0f), new Vector2(width, 30f), Ellipsize(string.IsNullOrWhiteSpace(roleName) ? roleId : roleName, tokenSize < 58f ? 4 : 7), tokenSize < 58f ? 12 : 15, TextAnchor.MiddleCenter, FontStyle.Bold);
            label.color = selected ? new Color(1f, 0.84f, 0.42f, 1f) : new Color(0.95f, 0.89f, 0.76f, 0.98f);
            return button;
        }

        private Button AddBlankRoleTokenButton(Transform parent, string label, Vector2 center, float tokenSize, bool selected, UnityEngine.Events.UnityAction onClick)
        {
            var button = AddRoleTokenButton(parent, "", label, "", "", center, tokenSize, selected, onClick);
            return button;
        }

        private Button AddNavButton(string label, Transform parent, Vector2 anchoredPosition, Vector2 size, UnityEngine.Events.UnityAction onClick)
        {
            var half = size * 0.5f;
            var panel = AddPanel($"Nav Button {label}", parent, Vector2.zero, Vector2.zero, anchoredPosition - half, anchoredPosition + half, new Color(0.060f, 0.036f, 0.018f, 0.56f));
            AddImage("Nav Button Wash", panel.transform, new Vector2(0f, 0.52f), new Vector2(1f, 1f), new Vector2(2f, -2f), new Vector2(-2f, -2f), new Color(0.85f, 0.54f, 0.20f, 0.065f));
            AddImage("Nav Button Accent", panel.transform, Vector2.zero, new Vector2(0f, 1f), new Vector2(0f, 0f), new Vector2(3f, 0f), new Color(0.95f, 0.64f, 0.26f, 0.36f));
            AddFrame(panel.transform, "Nav Button Frame", 0.8f, new Color(0.88f, 0.60f, 0.28f, 0.26f));
            var button = panel.AddComponent<Button>();
            button.onClick.AddListener(onClick);
            ApplyButtonStyle(button);
            AddText("Label", panel.transform, Vector2.zero, Vector2.one, new Vector2(4f, 0f), new Vector2(-4f, 0f), label, label.Length > 5 ? 16 : 18, TextAnchor.MiddleCenter, FontStyle.Bold);
            return button;
        }

        private static void ApplyButtonStyle(Button button)
        {
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1f, 0.94f, 0.70f, 1f);
            colors.pressedColor = new Color(0.82f, 0.56f, 0.30f, 1f);
            colors.selectedColor = colors.highlightedColor;
            colors.disabledColor = new Color(0.25f, 0.23f, 0.22f, 0.55f);
            colors.fadeDuration = 0.12f;
            button.colors = colors;
        }

        private bool UiMotionDisabled()
        {
            return !string.IsNullOrWhiteSpace(CommandLineValue("-botc-ui-smoke"))
                || CommandLineFlag("-botc-reduced-motion");
        }

        private CanvasGroup EnsureCanvasGroup(RectTransform panel)
        {
            if (panel == null) return null;
            var group = panel.GetComponent<CanvasGroup>();
            return group != null ? group : panel.gameObject.AddComponent<CanvasGroup>();
        }

        private void ShowModalPanel(RectTransform panel)
        {
            if (panel == null) return;
            panel.gameObject.SetActive(true);
            if (modalBackdrop != null) modalBackdrop.SetAsLastSibling();
            panel.SetAsLastSibling();
            var group = EnsureCanvasGroup(panel);
            if (group != null)
            {
                group.alpha = 1f;
                group.blocksRaycasts = true;
                group.interactable = true;
            }
            panel.localScale = Vector3.one;
            ApplyModalBackdropVisibility();

            if (UiMotionDisabled()) return;
            if (panelMotionRoutines.TryGetValue(panel, out var existing) && existing != null) StopCoroutine(existing);
            panelMotionRoutines[panel] = StartCoroutine(PlayPanelEntrance(panel, group));
        }

        private IEnumerator PlayPanelEntrance(RectTransform panel, CanvasGroup group)
        {
            if (panel == null || group == null) yield break;
            const float duration = 0.18f;
            var elapsed = 0f;
            group.alpha = 0f;
            panel.localScale = Vector3.one * 0.975f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                var t = SmoothStep(0f, 1f, Mathf.Clamp01(elapsed / duration));
                group.alpha = Mathf.Lerp(0f, 1f, t);
                panel.localScale = Vector3.one * Mathf.Lerp(0.975f, 1f, t);
                yield return null;
            }

            group.alpha = 1f;
            panel.localScale = Vector3.one;
            panelMotionRoutines.Remove(panel);
        }

        private void ShowDrawerPanel(RectTransform panel, Vector2 targetOffsetMin, Vector2 targetOffsetMax)
        {
            if (panel == null) return;
            panel.offsetMin = targetOffsetMin;
            panel.offsetMax = targetOffsetMax;
            panel.gameObject.SetActive(true);
            var group = EnsureCanvasGroup(panel);
            if (group != null)
            {
                group.alpha = 1f;
                group.blocksRaycasts = true;
                group.interactable = true;
            }

            if (UiMotionDisabled()) return;
            if (panelMotionRoutines.TryGetValue(panel, out var existing) && existing != null) StopCoroutine(existing);
            panelMotionRoutines[panel] = StartCoroutine(PlayDrawerEntrance(panel, group, targetOffsetMin, targetOffsetMax));
        }

        private IEnumerator PlayDrawerEntrance(RectTransform panel, CanvasGroup group, Vector2 targetOffsetMin, Vector2 targetOffsetMax)
        {
            if (panel == null || group == null) yield break;
            const float duration = 0.26f;
            var slideDistance = Mathf.Max(180f, targetOffsetMax.x - targetOffsetMin.x + 96f);
            var startOffsetMin = targetOffsetMin + new Vector2(slideDistance, 0f);
            var startOffsetMax = targetOffsetMax + new Vector2(slideDistance, 0f);
            var elapsed = 0f;
            panel.offsetMin = startOffsetMin;
            panel.offsetMax = startOffsetMax;
            group.alpha = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.unscaledDeltaTime;
                var t = SmoothStep(0f, 1f, Mathf.Clamp01(elapsed / duration));
                panel.offsetMin = Vector2.Lerp(startOffsetMin, targetOffsetMin, t);
                panel.offsetMax = Vector2.Lerp(startOffsetMax, targetOffsetMax, t);
                group.alpha = Mathf.Lerp(0f, 1f, t);
                yield return null;
            }

            panel.offsetMin = targetOffsetMin;
            panel.offsetMax = targetOffsetMax;
            group.alpha = 1f;
            panelMotionRoutines.Remove(panel);
        }

        private void UpdateSelectedTokenPulse()
        {
            if (selectedTokenPulseImages.Count == 0) return;
            var elapsed = Mathf.Max(0f, Time.realtimeSinceStartup - selectionPulseStartTime);
            var burst = Mathf.Clamp01(1f - elapsed / 0.62f);
            var breath = 0.5f + 0.5f * Mathf.Sin(Time.realtimeSinceStartup * 3.4f);
            var alpha = 0.14f + breath * 0.10f + burst * 0.22f;
            var scale = 1.02f + breath * 0.045f + burst * 0.12f;

            for (var i = selectedTokenPulseImages.Count - 1; i >= 0; i--)
            {
                var image = selectedTokenPulseImages[i];
                var rect = i < selectedTokenPulseRects.Count ? selectedTokenPulseRects[i] : null;
                if (image == null || rect == null)
                {
                    selectedTokenPulseImages.RemoveAt(i);
                    if (i < selectedTokenPulseRects.Count) selectedTokenPulseRects.RemoveAt(i);
                    continue;
                }
                image.color = new Color(1f, 0.80f, 0.32f, alpha);
                rect.localScale = Vector3.one * scale;
            }
        }

        private void UpdateDialogueTokenPulse()
        {
            if (dialogueTokenPulseImages.Count == 0) return;
            var elapsed = Mathf.Max(0f, Time.realtimeSinceStartup - dialoguePulseStartTime);
            var burst = Mathf.Clamp01(1f - elapsed / 0.84f);
            var breath = 0.5f + 0.5f * Mathf.Sin(Time.realtimeSinceStartup * 2.6f);
            var alpha = 0.18f + breath * 0.12f + burst * 0.24f;
            var scale = 1.03f + breath * 0.050f + burst * 0.13f;

            for (var i = dialogueTokenPulseImages.Count - 1; i >= 0; i--)
            {
                var image = dialogueTokenPulseImages[i];
                var rect = i < dialogueTokenPulseRects.Count ? dialogueTokenPulseRects[i] : null;
                if (image == null || rect == null)
                {
                    dialogueTokenPulseImages.RemoveAt(i);
                    if (i < dialogueTokenPulseRects.Count) dialogueTokenPulseRects.RemoveAt(i);
                    continue;
                }
                image.color = new Color(image.color.r, image.color.g, image.color.b, alpha);
                rect.localScale = Vector3.one * scale;
            }
        }

        private void UpdateSuggestedButtonPulse()
        {
            if (suggestedButtonGlows.Count == 0) return;
            var breath = 0.5f + 0.5f * Mathf.Sin(Time.realtimeSinceStartup * 4.2f);
            var alpha = 0.20f + breath * 0.20f;
            for (var i = suggestedButtonGlows.Count - 1; i >= 0; i--)
            {
                var glow = suggestedButtonGlows[i];
                if (glow == null)
                {
                    suggestedButtonGlows.RemoveAt(i);
                    continue;
                }
                if (!glow.gameObject.activeSelf) continue;
                glow.color = new Color(1f, 0.76f, 0.24f, alpha);
            }
            for (var i = suggestedButtonMarkers.Count - 1; i >= 0; i--)
            {
                var marker = suggestedButtonMarkers[i];
                if (marker == null)
                {
                    suggestedButtonMarkers.RemoveAt(i);
                    continue;
                }
                if (!marker.gameObject.activeSelf) continue;
                marker.color = new Color(1f, 0.82f, 0.34f, 0.72f + breath * 0.28f);
            }
        }

        private void UpdateAmbientMotion()
        {
            if (UiMotionDisabled()) return;
            var time = Time.realtimeSinceStartup;
            var phaseNight = vm != null && vm.phase == "night";
            if (ambientGlowImage != null)
            {
                var breath = 0.5f + 0.5f * Mathf.Sin(time * 0.55f);
                ambientGlowImage.color = phaseNight
                    ? new Color(0.38f, 0.52f, 1f, 0.025f + breath * 0.020f)
                    : new Color(1f, 0.78f, 0.38f, 0.028f + breath * 0.022f);
            }
            if (ambientGlowRoot != null)
            {
                var scale = 1f + Mathf.Sin(time * 0.36f) * 0.018f;
                ambientGlowRoot.localScale = Vector3.one * scale;
            }
            if (ambientMoonImage != null)
            {
                var alpha = phaseNight ? 0.055f : 0.030f;
                ambientMoonImage.color = new Color(0.78f, 0.86f, 1f, alpha + Mathf.Sin(time * 0.42f) * 0.012f);
                ambientMoonImage.rectTransform.anchoredPosition = new Vector2(Mathf.Sin(time * 0.18f) * 10f, Mathf.Cos(time * 0.21f) * 6f);
            }
            if (ambientFogA != null)
            {
                ambientFogA.anchoredPosition = new Vector2(Mathf.Sin(time * 0.18f) * 44f, Mathf.Sin(time * 0.27f) * 8f);
                if (ambientFogAImage != null) ambientFogAImage.color = new Color(0.62f, 0.72f, 0.78f, phaseNight ? 0.060f : 0.040f);
            }
            if (ambientFogB != null)
            {
                ambientFogB.anchoredPosition = new Vector2(Mathf.Cos(time * 0.14f) * 62f, Mathf.Sin(time * 0.22f) * 10f);
                if (ambientFogBImage != null) ambientFogBImage.color = new Color(0.50f, 0.58f, 0.66f, phaseNight ? 0.052f : 0.030f);
            }
            if (background != null)
            {
                var bgScale = 1.004f + Mathf.Sin(time * 0.12f) * 0.003f;
                background.rectTransform.localScale = Vector3.one * bgScale;
            }
        }

        private static void SetRect(RectTransform rt, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin, Vector2 offsetMax)
        {
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = offsetMin;
            rt.offsetMax = offsetMax;
        }

        private Sprite SpriteFromResource(string path)
        {
            var texture = Resources.Load<Texture2D>(path);
            if (texture == null) return null;
            return Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(0.5f, 0.5f), 100f);
        }

        private Sprite GetCircleFillSprite()
        {
            if (circleFillSprite == null) circleFillSprite = CreateCircleSprite(false);
            return circleFillSprite;
        }

        private Sprite GetCircleRingSprite()
        {
            if (circleRingSprite == null) circleRingSprite = CreateCircleSprite(true);
            return circleRingSprite;
        }

        private static Sprite CreateCircleSprite(bool ring)
        {
            const int size = 512;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            var pixels = new Color32[size * size];
            var center = (size - 1) * 0.5f;
            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    var dx = (x - center) / center;
                    var dy = (y - center) / center;
                    var distance = Mathf.Sqrt(dx * dx + dy * dy);
                    var alpha = ring
                        ? Mathf.Clamp01((1f - SmoothStep(0.965f, 1.01f, distance)) * SmoothStep(0.925f, 0.965f, distance))
                        : 1f - SmoothStep(0.46f, 1.0f, distance);
                    pixels[y * size + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(alpha * 255f));
                }
            }
            texture.SetPixels32(pixels);
            texture.Apply(false, true);
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
        }

        private static float SmoothStep(float edge0, float edge1, float value)
        {
            var t = Mathf.Clamp01((value - edge0) / (edge1 - edge0));
            return t * t * (3f - 2f * t);
        }

        private Font GetUiFont(string text, int size, FontStyle style)
        {
            if (asciiFont == null) asciiFont = Resources.Load<Font>("Botc/fonts/piratesbay");
            if (size >= 34 && !ContainsCjk(text) && asciiFont != null) return asciiFont;
            if (size >= 22 || style != FontStyle.Normal)
            {
                if (titleFont == null) titleFont = Font.CreateDynamicFontFromOSFont(new[] { "KaiTi", "FZYaoti", "FZShuTi", "Microsoft YaHei", "SimHei", "Arial" }, 20);
                if (titleFont != null) return titleFont;
            }
            if (bodyFont == null) bodyFont = Font.CreateDynamicFontFromOSFont(new[] { "Microsoft YaHei", "SimHei", "KaiTi", "Arial" }, 18);
            return bodyFont != null ? bodyFont : Resources.GetBuiltinResource<Font>("Arial.ttf");
        }

        private static bool ContainsCjk(string text)
        {
            if (string.IsNullOrEmpty(text)) return false;
            foreach (var ch in text) if (ch >= 0x4E00 && ch <= 0x9FFF) return true;
            return false;
        }

        private static Color SuspicionColor(int suspicion)
        {
            if (suspicion >= 65) return new Color(0.78f, 0.14f, 0.11f, 0.68f);
            if (suspicion >= 42) return new Color(0.86f, 0.55f, 0.18f, 0.62f);
            return new Color(0.50f, 0.62f, 0.78f, 0.44f);
        }
    }
}