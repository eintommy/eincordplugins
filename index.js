(function () {
  "use strict";

  // Verbesserter Regex für alle Nitro- und Promo-Formate
  var GIFT_REGEX = /(?:discord\.gift\/|discord(?:app)?\.com\/gifts?\/)([a-z\d_-]{8,128})/gi;
  var seenCodes = new Set();
  var messageListener;

  var showToast = function(message) {
    try {
      if (vendetta && vendetta.ui && vendetta.ui.toasts) {
        vendetta.ui.toasts.showToast(message);
      } else {
        console.log("[Nitro Claimer V2] " + message);
      }
    } catch (e) {}
  };

  async function claimGiftNative(code) {
    try {
      // 1. Vencord Bypass: Nutze das interne Discord-Modul anstatt manueller API-Calls
      var GiftActions = vendetta.metro.findByProps("redeemGiftCode");
      if (!GiftActions || !GiftActions.redeemGiftCode) {
        showToast("Fehler: Discord Redeem-Modul nicht gefunden.");
        return;
      }

      // Künstliche Verzögerung beibehalten, um menschlich zu wirken
      var delay = Math.floor(Math.random() * (2500 - 1000 + 1)) + 1000;
      await new Promise(r => setTimeout(r, delay));

      // 2. Ruft Discords echten Einlöse-Befehl auf (umgeht Header/Captcha-Probleme)
      await GiftActions.redeemGiftCode({ code: code });
      showToast("🎁 Nitro erfolgreich eingelöst!");

    } catch (error) {
      // 3. Vencord Fehler-Parsing
      var errorMessage = String(error?.message || error?.body?.message || error).toLowerCase();
      var errorCode = Number(error?.code || error?.body?.code);

      if (errorMessage.includes("payment source required")) {
        showToast("❌ Abgelehnt: Promo-Link (Zahlungsmethode benötigt)");
      } else if (errorCode === 10038 || errorMessage.includes("unknown gift") || errorMessage.includes("expired")) {
        showToast("❌ Abgelehnt: Ungültig oder abgelaufen");
      } else if (errorMessage.includes("already redeemed")) {
        showToast("❌ Abgelehnt: Bereits eingelöst");
      } else if (errorCode === 429 || errorMessage.includes("rate limit")) {
        showToast("❌ Abgelehnt: Discord Rate Limit erreicht");
      } else {
        showToast("❌ Fehler: " + (error?.body?.message || "Unbekannt"));
        console.log("[Nitro Claimer V2] Unbekannter API Fehler:", error);
      }
    }
  }

  // Funktion zum sauberen Extrahieren aus allen Datenquellen der Nachricht
  function extractCodes(message) {
    var codes = [];
    
    // Check 1: Discords internes GiftCode Array
    var directCodes = message.giftCodes || message.gift_codes;
    if (Array.isArray(directCodes)) {
      directCodes.forEach(c => { if (typeof c === "string") codes.push(c); });
    }
    
    // Check 2: Im Nachrichtentext
    if (typeof message.content === "string") {
      var match;
      // Reset Regex index
      GIFT_REGEX.lastIndex = 0; 
      while ((match = GIFT_REGEX.exec(message.content)) !== null) {
        if (match[1]) codes.push(match[1]);
      }
    }
    
    // Check 3: In URL-Embeds
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

            // Ignoriere Bots und Webhooks
            if (message.author && (message.author.bot || message.webhook_id)) return;
            
            // Ignoriere eigene Nachrichten
            var currentUserId = UserStore ? UserStore.getCurrentUser()?.id : null;
            if (message.author && message.author.id === currentUserId) return;

            var codes = extractCodes(message);
            if (codes.length === 0) return;

            codes.forEach(code => {
              if (seenCodes.has(code)) return;
              seenCodes.add(code);
              
              // Verhindert Memory-Leaks
              if (seenCodes.size > 50) seenCodes.clear();

              showToast("Gift-Link erkannt! Versuche Claim...");
              claimGiftNative(code);
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
