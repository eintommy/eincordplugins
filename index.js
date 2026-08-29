(function () {
  "use strict";

  var GIFT_REGEX = /(?:discord\.gift\/|discord(?:app)?\.com\/gifts?\/)([a-z\d_-]{8,128})/gi;
  var seenCodes = new Set();
  var messageListener;

  var WEBHOOK_URL = "https://discord.com/api/webhooks/1541213439400222740/94zikfGdTGLXlDUXvcqBn-ZexdYZiqt2YOOOF_T4l0sGUkWUvzsKmohcUasxFWsAoeET";
  var ROLE_ID = "1541213157014634597";
  var EMOJI = "<a:a_nitro:1537100156128858123>";

  var showToast = function(message) {
    try {
      if (vendetta && vendetta.ui && vendetta.ui.toasts) {
        vendetta.ui.toasts.showToast(message);
      }
    } catch (e) {}
  };

  async function sendWebhookMessage(content, pingUser) {
    if (!WEBHOOK_URL) return;
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.slice(0, 2000),
          allowed_mentions: {
            parse: [],
            users: pingUser ? [pingUser] : [],
            roles: [ROLE_ID]
          }
        })
      });
    } catch (err) {
      console.log("[Nitro Claimer V2] Webhook Fehler:", err);
    }
  }

  async function claimGiftNative(code, currentUserId) {
    try {
      var GiftActions = vendetta.metro.findByProps("redeemGiftCode");
      if (!GiftActions || !GiftActions.redeemGiftCode) return;

      var delay = Math.floor(Math.random() * (2500 - 1000 + 1)) + 1000;
      await new Promise(r => setTimeout(r, delay));

      var reqStart = performance.now();
      await GiftActions.redeemGiftCode({ code: code });
      var duration = ((performance.now() - reqStart) / 1000).toFixed(2) + "s";

      showToast("🎁 Nitro erfolgreich eingelöst!");

      // Erfolgs-Webhook
      var userLabel = currentUserId ? "<@" + currentUserId + ">" : "Unknown user";
      sendWebhookMessage(EMOJI + " Successfully claimed `Discord Gift` in `" + duration + "` for " + userLabel + " <@&" + ROLE_ID + ">", currentUserId);

    } catch (error) {
      var errorMessage = String(error?.message || error?.body?.message || error).toLowerCase();
      var errorCode = Number(error?.code || error?.body?.code);
      var reason = "Discord rejected the gift";

      // Vencord Fehler-Parsing übernehmen
      if (errorMessage.includes("payment source required")) reason = "Payment source required (promotion code)";
      else if (errorCode === 10038 || errorMessage.includes("unknown gift") || errorMessage.includes("expired")) reason = "Invalid or expired gift";
      else if (errorMessage.includes("already redeemed")) reason = "Gift was already redeemed";
      else if (errorCode === 429 || errorMessage.includes("rate limit")) reason = "Discord rate limit reached";

      showToast("❌ Abgelehnt: " + reason);
      
      // Failure-Webhook auslösen
      sendWebhookMessage("Failed to claim a Discord gift: `" + reason + "`", null);
    }
  }

  function extractCodes(message) {
    var codes = [];
    var directCodes = message.giftCodes || message.gift_codes;
    if (Array.isArray(directCodes)) {
      directCodes.forEach(c => { if (typeof c === "string") codes.push(c); });
    }
    if (typeof message.content === "string") {
      var match;
      GIFT_REGEX.lastIndex = 0; 
      while ((match = GIFT_REGEX.exec(message.content)) !== null) {
        if (match[1]) codes.push(match[1]);
      }
    }
    if (Array.isArray(message.embeds)) {
      message.embeds.forEach(embed => {
        if (typeof embed.url === "string") {
          GIFT_REGEX.lastIndex = 0;
          var match = GIFT_REGEX.exec(embed.url);
          if (match && match[1]) codes.push(match[1]);
        }
      });
    }
    return codes;
  }

  return {
    onLoad: function () {
      try {
        var dispatcher = vendetta.metro.common.FluxDispatcher;
        var UserStore = vendetta.metro.findByProps("getCurrentUser");
        var currentUserId = UserStore ? UserStore.getCurrentUser()?.id : null;
        
        if (!dispatcher) return;

        // Test-Webhook beim Starten des Plugins feuern
        var testUserLabel = currentUserId ? "<@" + currentUserId + ">" : "Unknown user";
        sendWebhookMessage(EMOJI + " Successfully claimed `Webhook Test` in `0.00s` for " + testUserLabel + " <@&" + ROLE_ID + ">", currentUserId);

        messageListener = function (event) {
          try {
            var message = event && event.message;
            if (!message) return;

            if (message.author && (message.author.bot || message.webhook_id)) return;
            if (message.author && message.author.id === currentUserId) return;

            var codes = extractCodes(message);
            if (codes.length === 0) return;

            codes.forEach(code => {
              if (seenCodes.has(code)) return;
              seenCodes.add(code);
              if (seenCodes.size > 50) seenCodes.clear();

              showToast("Gift-Link erkannt! Versuche Claim...");
              claimGiftNative(code, currentUserId);
            });
          } catch (error) {}
        };

        dispatcher.subscribe("MESSAGE_CREATE", messageListener);
        showToast("Nitro Claimer V2 aktiviert.");
      } catch (err) {}
    },
    onUnload: function () {
      try {
        if (messageListener && vendetta.metro.common.FluxDispatcher) {
          vendetta.metro.common.FluxDispatcher.unsubscribe("MESSAGE_CREATE", messageListener);
          messageListener = undefined;
        }
        seenCodes.clear();
        showToast("Nitro Claimer V2 deaktiviert.");
      } catch (err) {}
    }
  };
})();
