// src/lib/onesignal.ts
// Call initOneSignal() once on app load

const APP_ID = process.env.REACT_APP_ONESIGNAL_APP_ID ?? "";

export async function initOneSignal() {
  if (!APP_ID) return;
  if (typeof window === "undefined") return;

  // Load OneSignal SDK
  await loadScript("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js");

  const OneSignal = (window as any).OneSignal || [];
  (window as any).OneSignal = OneSignal;

  OneSignal.push(function () {
    OneSignal.init({
      appId: APP_ID,
      safari_web_id: "", // leave blank for now
      notifyButton: { enable: false }, // we use our own UI
      allowLocalhostAsSecureOrigin: true,
    });
  });
}

export async function subscribeUser(userId: string) {
  if (!APP_ID) return;
  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return;

  OneSignal.push(async function () {
    await OneSignal.login(userId); // ties the device to the user
    await OneSignal.Notifications.requestPermission();
  });
}

export async function unsubscribeUser() {
  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return;
  OneSignal.push(function () {
    OneSignal.logout();
  });
}

export async function sendNotification({
  userIds,
  title,
  message,
  url = "https://playrunit.com",
}: {
  userIds: string[];
  title: string;
  message: string;
  url?: string;
}) {
  // This should be called from your backend (pickup-api)
  // We expose it here for reference — don't call from frontend with REST API key
  console.log("Send notification to", userIds, title, message);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}
