let showToastFn = null;

export function registerToast(fn) {
  showToastFn = fn;
}

export function toast({ message, type = 'info', duration = 3000 }) {
  if (showToastFn) showToastFn({ message, type, duration });
}
