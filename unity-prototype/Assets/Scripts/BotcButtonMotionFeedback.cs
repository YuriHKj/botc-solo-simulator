using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace BotcSolo.UnityPrototype
{
    public sealed class BotcButtonMotionFeedback : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IPointerDownHandler, IPointerUpHandler, IPointerClickHandler, ISelectHandler, IDeselectHandler
    {
        private RectTransform rectTransform;
        private Button button;
        private Image glow;
        private Vector3 baseScale = Vector3.one;
        private float currentScale = 1f;
        private float clickFlash;
        private bool hovered;
        private bool pressed;
        private bool selected;
        private float baseGlowAlpha = -1f;

        private void Awake()
        {
            rectTransform = transform as RectTransform;
            button = GetComponent<Button>();
            glow = FindGlowImage();
            if (glow != null) baseGlowAlpha = glow.color.a;
        }

        private void OnEnable()
        {
            baseScale = rectTransform == null ? transform.localScale : rectTransform.localScale;
            if (baseScale == Vector3.zero) baseScale = Vector3.one;
            currentScale = 1f;
            pressed = false;
            hovered = false;
            selected = false;
            clickFlash = 0f;
        }

        private void OnDisable()
        {
            if (rectTransform != null) rectTransform.localScale = baseScale;
            if (glow != null && baseGlowAlpha >= 0f)
            {
                var color = glow.color;
                color.a = baseGlowAlpha;
                glow.color = color;
            }
        }

        private void Update()
        {
            if (rectTransform == null) return;
            var active = button == null || button.interactable;
            var targetScale = !active ? 1f : pressed ? 0.965f : hovered ? 1.026f : selected ? 1.014f : 1f;
            var t = 1f - Mathf.Exp(-Time.unscaledDeltaTime * 18f);
            currentScale = Mathf.Lerp(currentScale, targetScale, t);
            rectTransform.localScale = baseScale * currentScale;

            if (clickFlash > 0f) clickFlash = Mathf.Max(0f, clickFlash - Time.unscaledDeltaTime * 5.6f);
            if (glow == null || baseGlowAlpha < 0f) return;

            var glowColor = glow.color;
            var hoverAlpha = active && hovered ? 0.055f : 0f;
            var pressAlpha = active && pressed ? 0.085f : 0f;
            glowColor.a = Mathf.Clamp01(baseGlowAlpha + hoverAlpha + pressAlpha + clickFlash * 0.16f);
            glow.color = glowColor;
        }

        public void OnPointerEnter(PointerEventData eventData)
        {
            hovered = true;
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            hovered = false;
            pressed = false;
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (button != null && !button.interactable) return;
            pressed = true;
        }

        public void OnPointerUp(PointerEventData eventData)
        {
            pressed = false;
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (button != null && !button.interactable) return;
            clickFlash = 1f;
        }

        public void OnSelect(BaseEventData eventData)
        {
            selected = true;
        }

        public void OnDeselect(BaseEventData eventData)
        {
            selected = false;
        }

        private Image FindGlowImage()
        {
            var direct = transform.Find("Tool Button Glow") ?? transform.Find("Button Glow") ?? transform.Find("Nav Button Wash");
            if (direct != null && direct.TryGetComponent<Image>(out var directImage)) return directImage;
            foreach (var image in GetComponentsInChildren<Image>(true))
            {
                if (image == null || image.gameObject == gameObject) continue;
                if (image.name.IndexOf("Glow", System.StringComparison.OrdinalIgnoreCase) >= 0
                    || image.name.IndexOf("Wash", System.StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return image;
                }
            }
            return null;
        }
    }
}
