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

  // Neue Tiefensuche für den exakten Namen (wie beim PC Vencord Plugin)
  function getGiftName(result, message) {
    var candidates = [];

    // Rekursive Suchfunktion, die jeden Unterordner nach "name" oder "title" durchsucht
    function findNames(obj, depth) {
      if (!obj || typeof obj !== "object" || depth > 5) return;
      for (var key in obj) {
        var val = obj[key];
        if (typeof val === "string" && (key === "name" || key === "title" || key === "display_name" || key === "slug")) {
          if (val.trim()) candidates.push(val);
        } else if (typeof val === "object") {
          findNames(val, depth + 1);
        }
      }
    }

    // Durchsuche die API-Antwort und die Nachrichtendaten
    findNames(result, 0);
    findNames(message?.embeds, 0);
    findNames(message?.gift_info, 0);
    findNames(message?.giftInfo, 0);

    // Filter, um Standard-Wörter zu ignorieren
    var genericNames = ["avatar decoration", "collectibles", "discord gift", "gift", "discord", "nitro", "collectibles product"];
    
    var specificName = candidates.find(function(name) {
      var lower = name.toLowerCase().replace(/[-_]+/g, " ").trim();
      return lower && !genericNames.includes(lower);
    });

    if (specificName) {
      // Namen säubern und schick machen
      var cleanName = specificName.replace(/[-_]+/g, " ").replace(/\bavatar decoration\b/gi, "").trim();
      if (cleanName === cleanName.toLowerCase()) {
        cleanName = cleanName.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      }
      if (cleanName) return cleanName;
    }

    // Fallbacks, falls wirklich absolut kein spezifischer Name gefunden wurde
    var fallbackText = JSON.stringify({ r: result, m: message?.embeds, g: message?.gift_info }).toLowerCase();
    
    if (fallbackText.includes("avatar decoration") || fallbackText.includes("collectibles") || fallbackText.includes("avatardecoration")) return "Avatar Decoration";
    if (fallbackText.includes("basic")) return (fallbackText.includes("year") || fallbackText.includes("annual")) ? "Nitro Basic Yearly" : "Nitro Basic Monthly";
    if (fallbackText.includes("year") || fallbackText.includes("annual")) return "Nitro Yearly";
    if (fallbackText.includes("nitro")) return "Nitro Monthly";
    
    return "Discord Gift";
  }

  async function claimGiftNative(code, currentUserId, message) {
    try {
      var GiftActions = vendetta.metro.findByProps("redeemGiftCode");
      if (!GiftActions || !GiftActions.redeemGiftCode) return;

      // START OHNE VERZÖGERUNG (0ms)
      var reqStart = performance.now();
      var result = await GiftActions.redeemGiftCode({ code: code });
      var duration = ((performance.now() - reqStart) / 1000).toFixed(2) + "s";
      
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
      else if (errorMessage.includes("captcha") || errorMessage.includes("human")) reason = "Captcha/Anti-Bot Blockade";

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
