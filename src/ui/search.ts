/**
 * City search.
 *
 * Results show each city's current local time, which turns the dropdown into a
 * useful preview rather than a plain list — you often know the time you are
 * looking for better than the spelling of the city.
 */

import { searchCities, type City } from '../data/cities';
import { zonedParts, pad2 } from '../core/time';

export interface Search {
  refresh(): void;
}

export interface SearchOptions {
  root: HTMLElement;
  onPick(city: City): void;
  isPinned(id: string): boolean;
}

export function createSearch({ root, onPick, isPinned }: SearchOptions): Search {
  const input = root.querySelector<HTMLInputElement>('[data-role="search-input"]')!;
  const list = root.querySelector<HTMLUListElement>('[data-role="search-results"]')!;

  let results: City[] = [];
  let activeIndex = -1;

  function render(): void {
    list.replaceChildren();
    activeIndex = -1;

    for (const city of results) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result';
      button.dataset.pinned = String(isPinned(city.id));
      button.setAttribute('role', 'option');

      const now = zonedParts(new Date(), city.zone);
      button.innerHTML = `
        <span>
          <span class="search-result-name">${escapeHtml(city.name)}</span>
          <span class="search-result-meta"> ${escapeHtml(city.country)}</span>
        </span>
        <span class="search-result-meta">${pad2(now.hour)}:${pad2(now.minute)}</span>
      `;

      button.addEventListener('click', () => pick(city));
      item.append(button);
      list.append(item);
    }
  }

  function pick(city: City): void {
    onPick(city);
    input.value = '';
    results = [];
    render();
    input.focus();
  }

  function runQuery(): void {
    results = searchCities(input.value);
    render();
  }

  input.addEventListener('input', runQuery);

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      results = [];
      render();
      return;
    }

    if (!results.length) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      pick(results[activeIndex >= 0 ? activeIndex : 0]);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + step + results.length) % results.length;
      const buttons = list.querySelectorAll<HTMLButtonElement>('.search-result');
      buttons[activeIndex]?.focus();
    }
  });

  // Clicking away closes the list. Using focusout on the container rather than a
  // document click handler keeps keyboard and pointer behaviour identical.
  root.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && root.contains(next)) return;
    results = [];
    render();
  });

  return {
    refresh(): void {
      if (results.length) render();
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}
