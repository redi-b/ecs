const animations = new WeakMap<HTMLDetailsElement, Animation>();

export const initAnimatedDetails = (
  root: ParentNode,
  selector: string,
  contentSelector: string,
) => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  root.querySelectorAll<HTMLDetailsElement>(selector).forEach((details) => {
    const summary = details.querySelector<HTMLElement>(":scope > summary");
    const content = details.querySelector<HTMLElement>(contentSelector);
    if (!summary || !content) return;

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      animations.get(details)?.cancel();

      const opening = !details.open;
      if (reduceMotion.matches) {
        details.open = opening;
        return;
      }

      if (opening) details.open = true;
      const expandedHeight = content.scrollHeight;
      const animation = content.animate(
        opening
          ? [{ height: "0px", opacity: 0 }, { height: `${expandedHeight}px`, opacity: 1 }]
          : [{ height: `${expandedHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }],
        { duration: opening ? 220 : 180, easing: "cubic-bezier(.2,.8,.2,1)" },
      );

      animations.set(details, animation);
      animation.finished
        .then(() => {
          if (!opening) details.open = false;
          animations.delete(details);
        })
        .catch(() => undefined);
    });
  });
};
