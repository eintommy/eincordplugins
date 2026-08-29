(function () {
  "use strict";

  var GIFT_REGEX = /(?:discord\.gift\/|discord(?:app)?\.com\/gifts?\/)([a-zA-Z0-9]{16,24})/i;
  var seenMessageIds = Object.create(null);
  var messageListener;

  // Sichere Importe. Falls etwas fehlt, fangen wir den Fehler ab, anstatt das Plugin crashen zu lassen.
  var showToast = function(message) {
    try {
      if (vendetta && vendetta.ui && vendetta.ui.toasts) {
        vendetta.ui.toasts.showToast(message);
      } else {
        console.log("[Nitro Claimer] " + message);
      }
    } catch (e) {
      console.log("[Nitro Claimer] Toast-Fehler: ", e);
    }
  };

  async function claimGift(code, channelId) {
    try {
      // Versuche Token über verschiedene Kettu/Vendetta Methoden zu finden
      var TokenStore = vendetta.metro.findByStoreName("AuthenticationStore") || vendetta.metro.findByProps("getToken");
      var token = TokenStore ? TokenStore.getToken() : null;

      if (!token) {
        showToast("Fehler: Discord-Token nicht gefunden.");
        return;
      }

      var response = await fetch("https://discord.com/api/v9/entitlements/gift-codes/" + code + "/redeem", {
        method: "POST",
        headers: {
          "Authorization": token,
          "Content-Type": "application/json",
          "Accept": "*/*"
        },
        body: JSON.stringify({
          channel_id: channelId,
          payment_source_id: null
        })
      });

      if (response.ok) {
        showToast("🎁 Nitro erfolgreich eingelöst!");
      } else {
        var data = await response.json();
        console.log("[Nitro Claimer] API Fehler:", data);
        showToast("❌ Code ungültig oder schon eingelöst.");
      }
    } catch (error) {
      console.log("[Nitro Claimer] Netzwerk-Fehler:", error);
    }
  }

  return {
    onLoad: function () {
      try {
        var dispatcher = vendetta.metro.common.FluxDispatcher;
        
        if (!dispatcher) {
          console.error("[Nitro Claimer] Dispatcher nicht gefunden!");
          return;
        }

        messageListener = function (event) {
          try {
            var message = event && event.message;
            if (!message || typeof message.content !== "string") return;

            var messageId = String(message.id || message.channel_id + ":" + message.content);
            if (seenMessageIds[messageId]) return;

            var match = GIFT_REGEX.exec(message.content);
            if (!match) return;

            seenMessageIds[messageId] = true;
            var code = match[1];
            
            showToast("Gift-Link erkannt! Versuche Claim...");
            claimGift(code, message.channel_id);

          } catch (error) {
            console.log("[Nitro Claimer] Fehler im Listener:", error);
          }
        };

        dispatcher.subscribe("MESSAGE_CREATE", messageListener);
        showToast("Nitro Claimer aktiviert.");
        console.log("[Nitro Claimer] Plugin erfolgreich geladen.");
      } catch (err) {
        console.error("[Nitro Claimer] Fataler Fehler in onLoad: ", err);
      }
    },

    onUnload: function () {
      try {
        if (messageListener && vendetta.metro.common.FluxDispatcher) {
          vendetta.metro.common.FluxDispatcher.unsubscribe("MESSAGE_CREATE", messageListener);
          messageListener = undefined;
        }
        seenMessageIds = Object.create(null);
        showToast("Nitro Claimer deaktiviert.");
      } catch (err) {
        console.error("[Nitro Claimer] Fehler in onUnload: ", err);
      }
    }
  };
})();
