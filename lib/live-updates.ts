export function notifyDataChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rinseline:data-changed'));
}
