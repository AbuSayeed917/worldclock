/**
 * Pinned cities, persisted to localStorage.
 *
 * Deliberately tiny: a Set of city ids, a change callback, and defensive reads.
 * localStorage throws in Safari private browsing and when quota is exhausted, so
 * every access is guarded — a storage failure should cost you persistence, never
 * a working page.
 */

import { DEFAULT_CITY_IDS, cityById, type City } from '../data/cities';

const STORAGE_KEY = 'worldclock.pinned.v1';

type Listener = (cities: City[]) => void;

export class CityStore {
  #ids: string[];
  #listeners = new Set<Listener>();

  constructor() {
    this.#ids = this.#read() ?? [...DEFAULT_CITY_IDS];
  }

  get cities(): City[] {
    return this.#ids
      .map((id) => cityById(id))
      .filter((city): city is City => city !== undefined);
  }

  has(id: string): boolean {
    return this.#ids.includes(id);
  }

  add(id: string): void {
    if (this.#ids.includes(id) || !cityById(id)) return;
    this.#ids = [...this.#ids, id];
    this.#commit();
  }

  remove(id: string): void {
    if (!this.#ids.includes(id)) return;
    this.#ids = this.#ids.filter((existing) => existing !== id);
    this.#commit();
  }

  toggle(id: string): void {
    this.has(id) ? this.remove(id) : this.add(id);
  }

  reset(): void {
    this.#ids = [...DEFAULT_CITY_IDS];
    this.#commit();
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #commit(): void {
    this.#write();
    const cities = this.cities;
    for (const listener of this.#listeners) listener(cities);
  }

  #read(): string[] | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const ids = parsed.filter(
        (id): id is string => typeof id === 'string' && cityById(id) !== undefined,
      );
      return ids.length ? ids : null;
    } catch {
      return null;
    }
  }

  #write(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#ids));
    } catch {
      // Private browsing or a full quota. Losing persistence is acceptable;
      // throwing here would take the whole page down.
    }
  }
}
