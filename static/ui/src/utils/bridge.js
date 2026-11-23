import { invoke, view, router, rovo } from '@forge/bridge';

export async function getForgeContext() {
  try {
    if (view?.theme?.enable) {
      await view.theme.enable();
    }
  } catch {
    // Non-fatal outside Atlassian host
  }
  return view.getContext();
}

export async function callBackend(fnKey, payload = {}) {
  return invoke(fnKey, payload);
}

export async function openExternalUrl(url) {
  if (!url) return;
  try {
    await router.open(url);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export async function openMedTraceRovo(promptText) {
  try {
    if (rovo?.open) {
      await rovo.open({
        type: 'forge',
        agentName: 'MedTrace QMS Copilot',
        agentKey: 'medtrace-copilot',
        prompt: promptText,
      });
      return { opened: true };
    }
  } catch (err) {
    console.warn('rovo.open fallback:', err?.message);
  }
  return { opened: false, promptText };
}
