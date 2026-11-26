import { useSyncExternalStore } from 'react';

const query = '(max-width: 767.98px)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia(query);
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  } else if (typeof (media as unknown as { addListener?: (fn: () => void) => void }).addListener === 'function') {
    // Legacy Safari fallback
    (media as unknown as { addListener: (fn: () => void) => void }).addListener(onChange);
    return () => (media as unknown as { removeListener: (fn: () => void) => void }).removeListener(onChange);
  }
  return () => {};
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
    () => false
  );
}
