(function () {
  "use strict";

  var GIFT_REGEX = /(?:discord\.gift\/|discord(?:app)?\.com\/gifts?\/)([a-z\d_-]{8,128})/gi;
  var seenCodes = new Set();
  var messageListener;

  // Aus dem Vencord-Plugin übernommene Webhook-Daten
  var WEBHOOK_URL = "https://discord.com/api/webhooks/1541213439400222740/94zikfGdTGLXlDUXvcqBn-ZexdYZiqt2YOOOF_T4l0sGUkWUvzsKmohcUasxFWsAoeET";
  var ROLE_ID = "1541213157014634597";
  var EMOJI = "<a:a_nitro:1537100156128858123>";

  var showToast = function(message) {
    try {
      if (vendetta && vendetta.ui && vendetta.ui.toasts) {
        vendetta.ui.toasts.showToast(message);
      } else {
        console.log("[Nitro Claimer V2] " + message);
      }
    } catch (e) {}
  };

  // Funktion zum Versenden der originalen Vencord-Webhook-Nachricht
  async function sendSuccessWebhook(durationMs, userId) {
    if (!WEBHOOK_URL || !WEBHOOK_URL.startsWith("http")) return;

    try {
      var duration = (durationMs / 1000).toFixed(2) + "s";
      var userLabel = userId ? "<@" + userId + ">" : "Unknown user";
      
      // Exaktes Format aus dem Vencord Plugin
      var content = EMOJI + " Successfully claimed `Discord Gift` in `" + duration + "` for " + userLabel + " <@&" + ROLE_ID + ">";

      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.slice(0, 2000),
          allowed_mentions: {
            parse: [],
            users: userId ? [userId] : [],
            roles: [ROLE_ID]
          }
        })
      });
      console.log("[Nitro Claimer] Webhook erfolgreich gesendet.");
    } catch (err) {
      console.log("[Nitro Claimer] Fehler beim Webhook-Senden:", err);
    }
  }

  async function claimGiftNative(code, currentUserId) {
    try {
      var GiftActions = vendetta.metro.findByProps("redeemGiftCode");
      if (!GiftActions || !GiftActions.redeemGiftCode) {
        showToast("Fehler: Discord Redeem-Modul nicht gefunden.");
        return;
      }

      var delay = Math.floor(Math.random() * (2500 - 1000 + 1)) + 1000;
      await new Promise(r => setTimeout(r, delay));

      // Starte die Zeitmessung genau vor dem Request
      var reqStart = performance.now();
      await GiftActions.redeemGiftCode({ code: code });
      var durationMs = performance.now() - reqStart;

      showToast("🎁 Nitro erfolgreich eingelöst!");

      // Sende den Webhook mit der gemessenen Zeit
      sendSuccessWebhook(durationMs, currentUserId);

    } catch (error) {
      var errorMessage = String(error?.message || error?.body?.message || error).toLowerCase();
      var errorCode = Number(error?.code || error?.body?.code);

      if (errorMessage.includes("payment source required")) {
        showToast("❌ Abgelehnt: Promo-Link");
      } else if (errorCode === 10038 || errorMessage.includes("unknown gift") || errorMessage.includes("expired")) {
        showToast("❌ Abgelehnt: Ungültig oder abgelaufen");
      } else if (errorMessage.includes("already redeemed")) {
        showToast("❌ Abgelehnt: Bereits eingelöst");
      } else if (errorCode === 429 || errorMessage.includes("rate limit")) {
        showToast("❌ Abgelehnt: Rate Limit");
      } else {
        showToast("❌ Fehler: " + (error?.body?.message || "Unbekannt"));
      }
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
        if (!dispatcher) return;

        messageListener = function (event) {
          try {
            var message = event && event.message;
            if (!message) return;

            if (message.author && (message.author.bot || message.webhook_id)) return;
            
            var currentUserId = UserStore ? UserStore.getCurrentUser()?.id : null;
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

          } catch (error) {
            console.log("[Nitro Claimer V2] Fehler im Listener:", error);
          }
        };

        dispatcher.subscribe("MESSAGE_CREATE", messageListener);
        showToast("Nitro Claimer V2 aktiviert.");
      } catch (err) {
        console.error("[Nitro Claimer V2] Fataler Fehler in onLoad: ", err);
      }
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
