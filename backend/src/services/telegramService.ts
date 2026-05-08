export async function sendTelegramMessage(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Telegram skipped: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required.");
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Telegram API error:", data);
      return;
    }

    console.log("Telegram message sent:", data);
  } catch (error) {
    console.error("Telegram Error:", error);
  }
}
