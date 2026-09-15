// WeChat/WebViews may resize only the visual viewport when the keyboard opens.
export function trackPrematchViewport(view = window, style = document.body.style) {
  const viewport = view.visualViewport;
  const update = () => {
    // Leave pinch zoom to the browser instead of reflowing the chat while zooming.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
    style.setProperty('--prematch-viewport-height', `${viewport?.height || view.innerHeight}px`);
    style.setProperty('--prematch-viewport-top', `${viewport?.offsetTop || 0}px`);
  };
  update();
  view.addEventListener('resize', update);
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  return () => {
    view.removeEventListener('resize', update);
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    style.removeProperty('--prematch-viewport-height');
    style.removeProperty('--prematch-viewport-top');
  };
}
