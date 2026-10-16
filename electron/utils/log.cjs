
function safeLog(...args) {
  try { console.log(...args); } catch (e) { /* ignore */ }
}

// Shared sendLog factory for installer IPC
function createSendLog(event, appid) {
  const cleaned = [];
  const rawMessages = [];
  return {
    sendLog: (message) => {
      // Clean ANSI codes and control chars for display
      const clean = String(message).replace(/\x1b\[[0-9;]*m/g, '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim();
      cleaned.push(clean);
      rawMessages.push(message);
      console.log('[INSTALL]', appid, message);
      try {
        if (event && event.sender && !event.sender.isDestroyed()) {
          event.sender.send('install-log', { appid, message: clean });
        }
      } catch (e) { /* ignore */ }
    },
    getCleaned: () => cleaned,
    getRaw: () => rawMessages,
  };
}

module.exports = { safeLog, createSendLog };
