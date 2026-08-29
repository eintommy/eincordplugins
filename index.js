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
          allowed_mentions: { parse: [], users: pingUser ? [pingUser] : [], roles: [ROLE_ID] }
        })
      });
    } catch (err) {}
  }

  // Verbesserte Namenserkennung: Liest nun API-Antwort UND die Original-Nachricht (Embeds) aus
  function getGiftName(result, message) {
    var combinedData = { r: result, m: message?.embeds, g: message?.gift_info, gi: message?.giftInfo };
    var text = JSON.stringify(combinedData).toLowerCase();
    
    // 1. Dekorationen filtern
    if (text.includes("avatar decoration") || text.includes("collectibles") || text.includes("avatardecoration")) {
        var decoName = result?.collectibles_product?.name || result?.collectiblesProduct?.name || result?.sku?.name || result?.store_listing?.sku?.name || message?.gift_info?.name;
        return decoName ? decoName : "Avatar Decoration";
    }
    // 2. Nitro Basic filtern
    if (text.includes("basic")) {
        return (text.includes("year") || text.includes("annual")) ? "Nitro Basic Yearly" : "Nitro Basic Monthly";
    }
    // 3. Normales Nitro / Boost filtern
    if (text.includes("year") || text.includes("annual")) return "Nitro Yearly";
    if (text.includes("nitro")) return "Nitro Monthly";
    
    // 4. Fallback auf den direkten Namen
    return result?.sku?.name || result?.store_listing?.sku?.name || message?.gift_info?.name || "Discord Gift";
  }

  async function claimGiftNative(code, currentUserId, message) {
    try {
      var GiftActions = vendetta.metro.findByProps("redeemGiftCode");
      if (!GiftActions || !GiftActions.redeemGiftCode) return;

      // KÜNSTLICHE VERZÖGERUNG WURDE ENTFERNT FÜR MAXIMALE GESCHWINDIGKEIT
      var reqStart = performance.now();
      
      // Führt den Claim direkt aus
      var result = await GiftActions.redeemGiftCode({ code: code });
      var duration = ((performance.now() - reqStart) / 1000).toFixed(2) + "s";
      
      // Liest den korrekten Namen aus API und Nachricht aus
      var giftName = getGiftName(result, message);

      showToast("🎁 " + giftName + " eingelöst (" + duration + ")");

      var userLabel = currentUserId ? "<@" + currentUserId + ">" : "Unknown user";
      sendWebhookMessage(EMOJI + " Successfully claimed `" + giftName + "` in `" + duration + "` for " + userLabel + " <@&" + ROLE_ID + ">", currentUserId);

    } catch (error) {
      var errorMessage = String(error?.message || error?.body?.message || error).toLowerCase();
      var errorCode = Number(error?.code || error?.body?.code);
      var reason = "Abgelehnt";

      if (errorMessage.includes("payment source required")) reason = "Promo-Link (Zahlungsmethode benötigt)";
      else if (errorCode === 10038 || errorMessage.includes("unknown gift") || errorMessage.includes("expired")) reason = "Ungültig oder abgelaufen";
      else if (errorMessage.includes("already redeemed")) reason = "Bereits eingelöst";
      else if (errorCode === 429 || errorMessage.includes("rate limit")) reason = "Rate Limit erreicht";

      showToast("❌ " + reason);
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

              // Übergibt nun auch die "message" für die Namenserkennung
              claimGiftNative(code, currentUserId, message);
            });
          } catch (error) {}
        };

        dispatcher.subscribe("MESSAGE_CREATE", messageListener);
        showToast("Nitro Claimer aktiviert (Fast Mode).");
      } catch (err) {}
    },
    onUnload: function () {
      try {
        if (messageListener && vendetta.metro.common.FluxDispatcher) {
          vendetta.metro.common.FluxDispatcher.unsubscribe("MESSAGE_CREATE", messageListener);
          messageListener = undefined;
        }
        seenCodes.clear();
        showToast("Nitro Claimer deaktiviert.");
      } catch (err) {}
    }
  };
})();
