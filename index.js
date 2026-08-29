(function () {
  "use strict";

  // Aktualisierter Regex mit Capture-Group (Klammern) für den 16-24 stelligen Nitro-Code
  var GIFT_REGEX = /(?:discord\.gift\/|discord(?:app)?\.com\/gifts?\/)([a-zA-Z0-9]{16,24})/i;
  var seenMessageIds = Object.create(null);
  var messageListener;

  function showToast(message) {
    try {
      var getAssetId = vendetta.ui.assets.getAssetIDByName;
      var show = vendetta.ui.toasts.showToast;
      show(message, getAssetId("Check"));
    } catch (error) {
      console.log("[Nitro Auto-Claim] " + message, error);
    }
  }

  // Neue Funktion für den API-Request an Discord
  async function claimGift(code, channelId) {
    try {
      // Discord User-Token über Vendettas Metro-Bundler abrufen
      var TokenStore = vendetta.metro.findByProps("getToken");
      var token = TokenStore ? TokenStore.getToken() : null;

      if (!token) {
        showToast("Fehler: Discord-Token nicht gefunden.");
        return;
      }

      // Claim-Request direkt an Discord senden
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

      var data = await response.json();

      if (response.ok) {
        showToast("🎁 Nitro erfolgreich eingelöst!");
      } else {
        showToast("❌ Code ungültig oder schon geclaimt.");
        console.log("[Nitro Auto-Claim] API Fehler:", data);
      }
    } catch (error) {
      console.log("[Nitro Auto-Claim] Netzwerk-Fehler:", error);
    }
  }

  return {
    onLoad: function () {
      var dispatcher = vendetta.metro.common.FluxDispatcher;

      messageListener = function (event) {
        try {
          var message = event && event.message;
          if (!message || typeof message.content !== "string") return;[cite: 1]

          var messageId = String(message.id || message.channel_id + ":" + message.content);[cite: 1]
          if (seenMessageIds[messageId]) return;[cite: 1]

          // Prüfen, ob ein Link existiert und den eigentlichen Code extrahieren
          var match = GIFT_REGEX.exec(message.content);
          if (!match) return;

          seenMessageIds[messageId] = true;[cite: 1]
          
          var code = match[1];
          showToast("Gift-Link erkannt! Versuche einzulösen...");
          
          // Auto-Claim starten
          claimGift(code, message.channel_id);

        } catch (error) {
          console.log("[Nitro Auto-Claim] Nachricht konnte nicht geprüft werden", error);[cite: 1]
        }
      };

      dispatcher.subscribe("MESSAGE_CREATE", messageListener);[cite: 1]
      showToast("Nitro Auto-Claimer aktiviert.");[cite: 1]
    },

    onUnload: function () {
      if (messageListener) {
        vendetta.metro.common.FluxDispatcher.unsubscribe("MESSAGE_CREATE", messageListener);[cite: 1]
        messageListener = undefined;[cite: 1]
      }

      seenMessageIds = Object.create(null);[cite: 1]
      showToast("Nitro Auto-Claimer deaktiviert.");[cite: 1]
    }
  };
})()
