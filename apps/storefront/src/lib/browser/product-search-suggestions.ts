type SearchSuggestion = {
  handle: string;
  title: string;
  thumbnail: string | null;
  price: string | null;
  collection: string | null;
};

type SearchSuggestionsResponse = {
  suggestions?: SearchSuggestion[];
};

import { localizeBrowserPath } from "./localized-path";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 220;

export function initProductSearchSuggestions(form: HTMLFormElement | null) {
  const input = form?.querySelector<HTMLInputElement>('input[name="q"]');
  if (!form || !input || form.dataset.searchSuggestionsReady === "true") return;
  form.dataset.searchSuggestionsReady = "true";

  const list = document.createElement("div");
  list.className = "product-search-suggestions";
  list.id = `${input.id || "product-search"}-suggestions`;
  list.setAttribute("role", "listbox");
  list.hidden = true;
  const anchor = input.closest<HTMLElement>("[data-search-suggestions-anchor]") ?? form;
  anchor.append(list);

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  let timer = 0;
  let controller: AbortController | null = null;
  let activeIndex = -1;
  let renderedQuery = "";
  const cache = new Map<string, SearchSuggestion[]>();
  const locale = document.documentElement.lang || "en";
  const cacheKey = (query: string) => `${locale}:${query.toLocaleLowerCase(locale)}`;

  const options = () => Array.from(list.querySelectorAll<HTMLAnchorElement>('[role="option"]'));
  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  };
  const activate = (index: number) => {
    const entries = options();
    if (!entries.length) return;
    activeIndex = (index + entries.length) % entries.length;
    entries.forEach((entry, position) => {
      const selected = position === activeIndex;
      entry.toggleAttribute("data-active", selected);
      entry.setAttribute("aria-selected", String(selected));
    });
    const active = entries[activeIndex];
    if (active) {
      input.setAttribute("aria-activedescendant", active.id);
      active.scrollIntoView({ block: "nearest" });
    }
  };
  const render = (query: string, suggestions: SearchSuggestion[]) => {
    renderedQuery = query;
    list.replaceChildren();
    activeIndex = -1;
    for (const [index, suggestion] of suggestions.entries()) {
      const link = document.createElement("a");
      link.className = "product-search-suggestions__item";
      link.href = localizeBrowserPath(`/products/${encodeURIComponent(suggestion.handle)}`);
      link.id = `${list.id}-${index}`;
      link.setAttribute("role", "option");
      link.setAttribute("aria-selected", "false");
      link.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("ecs:product-search-suggestion-selected", {
          detail: { handle: suggestion.handle, position: index + 1, query },
        }));
      });

      const media = document.createElement("span");
      media.className = "product-search-suggestions__media";
      if (suggestion.thumbnail) {
        const image = document.createElement("img");
        image.src = suggestion.thumbnail;
        image.alt = "";
        image.loading = "lazy";
        media.append(image);
      }
      const copy = document.createElement("span");
      copy.className = "product-search-suggestions__copy";
      const title = document.createElement("strong");
      title.textContent = suggestion.title;
      copy.append(title);
      if (suggestion.collection) {
        const context = document.createElement("small");
        context.textContent = suggestion.collection;
        copy.append(context);
      }
      if (suggestion.price) {
        const price = document.createElement("b");
        price.textContent = suggestion.price;
        link.append(media, copy, price);
      } else {
        link.append(media, copy);
      }
      link.addEventListener("pointermove", () => activate(index));
      list.append(link);
    }

    const all = document.createElement("a");
    all.className = "product-search-suggestions__all";
    const allParams = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string") allParams.append(key, value);
    }
    allParams.set("q", query);
    allParams.delete("offset");
    for (const [key, value] of [...allParams]) {
      if (!value.trim()) allParams.delete(key);
    }
    all.href = localizeBrowserPath(`/products?${allParams.toString()}`);
    const viewAll = form.dataset.searchViewAll ?? "View all results for {query}";
    const searchFor = form.dataset.searchFor ?? "Search for {query}";
    all.textContent = (suggestions.length ? viewAll : searchFor).replace("{query}", `“${query}”`);
    list.append(all);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };
  const search = async () => {
    const query = input.value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      controller?.abort();
      close();
      return;
    }
    controller?.abort();
    const cached = cache.get(cacheKey(query));
    if (cached) {
      render(query, cached);
      return;
    }
    const requestController = new AbortController();
    controller = requestController;
    input.setAttribute("aria-busy", "true");
    try {
      const response = await fetch(`/search-suggestions?q=${encodeURIComponent(query)}`, {
        headers: { accept: "application/json" },
        signal: requestController.signal,
      });
      if (!response.ok || input.value.trim() !== query) return;
      const payload = (await response.json()) as SearchSuggestionsResponse;
      const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      cache.set(cacheKey(query), suggestions);
      if (cache.size > 20) cache.delete(cache.keys().next().value ?? "");
      render(query, suggestions);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) close();
    } finally {
      if (controller === requestController) {
        controller = null;
        input.removeAttribute("aria-busy");
      }
    }
  };

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    close();
    timer = window.setTimeout(() => void search(), DEBOUNCE_MS);
  });
  input.addEventListener("focus", () => {
    if (input.value.trim() === renderedQuery && list.childElementCount) {
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (list.hidden || !options().length) return;
      event.preventDefault();
      activate(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      const active = options()[activeIndex];
      if (active) {
        event.preventDefault();
        active.click();
      }
    } else if (event.key === "Escape" && !list.hidden) {
      event.preventDefault();
      close();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Node && !form.contains(event.target)) close();
  });
}
