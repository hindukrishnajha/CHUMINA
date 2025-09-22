if (event.type === 'message_unsend' && botState.deleteNotifyEnabled[threadID]) {
  console.log(`[DEBUG] Processing message_unsend event: threadID=${threadID}, messageID=${event.messageID}, logMessageData=${JSON.stringify(event.logMessageData)}`);
  
  // Extract messageID correctly
  const deletedMessageID = event.logMessageData?.messageID || event.messageID;
  if (!deletedMessageID) {
    console.log(`[ERROR] No valid messageID found in unsend event for threadID=${threadID}`);
    sendBotMessage(api, '❌ डिलीट किया गया मैसेज का ID नहीं मिला।', threadID);
    return;
  }

  // Check if event is already processed for unsend specifically
  if (botState.eventProcessed[`unsend_${deletedMessageID}`]) {
    console.log(`[DEBUG] Skipping duplicate unsend event: messageID=${deletedMessageID}`);
    return;
  }

  // Mark unsend event as processed with a unique key
  botState.eventProcessed[`unsend_${deletedMessageID}`] = { timestamp: Date.now() };

  // Check bot admin status
  api.getThreadInfo(threadID, (err, info) => {
    if (err) {
      console.error(`[ERROR] Failed to fetch thread info for unsend: ${err.message}`);
      sendBotMessage(api, '⚠️ ग्रुप जानकारी लाने में गलती।', threadID);
      return;
    }

    const isBotAdmin = Array.isArray(info.adminIDs) && info.adminIDs.some(admin => admin.id === botID);
    if (!isBotAdmin) {
      console.log(`[DEBUG] Bot (ID: ${botID}) is not admin in thread ${threadID} for unsend notification`);
      sendBotMessage(api, 'मालिक, मुझे एडमिन बनाओ ताकि मैं डिलीट नोटिफिकेशन भेज सकूं! 🙏', threadID);
      return;
    }

    // Fetch deleted message from store
    const deletedMsg = messageStore.getMessage(deletedMessageID);
    if (deletedMsg) {
      console.log(`[DEBUG] Retrieved deleted message: ${JSON.stringify(deletedMsg)}`);
      // Fetch sender info
      api.getUserInfo(deletedMsg.senderID, (err, info) => {
        if (err || !info || !info[deletedMsg.senderID]) {
          console.error(`[ERROR] Failed to fetch user info for senderID=${deletedMsg.senderID}: ${err?.message || 'Unknown error'}`);
          sendBotMessage(api, `Unknown ने मैसेज डिलीट किया: "${deletedMsg.content || '(attachment or empty message)'}"`, threadID);
          if (deletedMsg.attachment && deletedMsg.attachment.url) {
            sendBotMessage(api, { url: deletedMsg.attachment.url }, threadID);
          }
          messageStore.removeMessage(deletedMessageID);
          return;
        }

        const senderName = info[deletedMsg.senderID].name || 'Unknown';
        console.log(`[DEBUG] Sending unsend notification for ${senderName}, message: ${deletedMsg.content}`);
        sendBotMessage(api, `${senderName} ने मैसेज डिलीट किया: "${deletedMsg.content || '(attachment or empty message)'}"`, threadID);
        if (deletedMsg.attachment && deletedMsg.attachment.url) {
          console.log(`[DEBUG] Resending attachment: ${deletedMsg.attachment.url}`);
          sendBotMessage(api, { url: deletedMsg.attachment.url }, threadID);
        }
        messageStore.removeMessage(deletedMessageID);
      });
    } else {
      console.log(`[DEBUG] No message found for unsend event: messageID=${deletedMessageID}`);
      sendBotMessage(api, '❌ डिलीट किया गया मैसेज नहीं मिला। शायद मैसेज स्टोर में नहीं था।', threadID);
    }
  });
  return;
      }
