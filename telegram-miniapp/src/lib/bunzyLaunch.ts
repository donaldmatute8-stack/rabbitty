export const BUNZY_LAUNCH_EVENT = 'bunzy:launch';

export function openBunzy(prefill?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BUNZY_LAUNCH_EVENT, { detail: { prefill } }));
}
