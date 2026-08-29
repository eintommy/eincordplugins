(function () {
  "use strict";

  // Filter für Discord Nitro Gift-Codes (greift 16-24 stellige Codes ab)
  var GIFT_REGEX = /(?:discord\.gift\/|discord(?:app)?\.com\/gifts?\/)([a-zA-Z0-9]{16,24})/i;
  var seenMessageIds = Object.create(null);
  var messageListener;

  // Nutze die standardmäßige Vendetta/Kettu API für UI-Toasts
  function showToast(message) {
    try {
      var getAssetId = vendetta.ui.assets.getAssetIDByName;
      var show = vendetta.ui.toasts.showToast;
      show(message, getAssetId("Check"));
    } catch (error) {
      console.log("[Nitro Auto-Claim] " + message, error);
    }
  }

  // Funktion, die den Request direkt an den Discord-Server sendet
  async function claimGift(code, channelId) {
    try {
      // Token-Store über den Metro-Bundler finden (funktioniert in Kettu & Bunny)
      var TokenStore = vendetta.metro.findByProps("getToken");
      var token = TokenStore ? TokenStore.getToken() : null;

      if (!token) {
        showToast("Fehler: Discord-Token nicht gefunden.");
        return;
      }

      // API Call an Discord
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
        showToast("❌ Code ungültig oder schon eingelöst.");
        console.log("[Nitro Auto-Claim] API Fehler:", data);
      }
    } catch (error) {
      console.log("[Nitro Auto-Claim] Netzwerk-Fehler:", error);
    }
  }

  return {
    onLoad: function () {
      // FluxDispatcher für eingehende Events (z.B. neue Nachrichten)
      var dispatcher = vendetta.metro.common.FluxDispatcher;

      messageListener = function (event) {
        try {
          var message = event && event.message;
          if (!message || typeof message.content !== "string") return;

          var messageId = String(message.id || message.channel_id + ":" + message.content);
          if (seenMessageIds[messageId]) return;

          // Regex Check: Ist ein Gift-Link in der Nachricht?
          var match = GIFT_REGEX.exec(message.content);
          if (!match) return;

          seenMessageIds[messageId] = true;
          
          var code = match[1]; // Den Code aus der Regex-Gruppe auslesen
          showToast("Gift-Link erkannt! Versuche Claim...");
          
          // Claim-Funktion auslösen
          claimGift(code, message.channel_id);

        } catch (error) {
          console.log("[Nitro Auto-Claim] Fehler beim Lesen der Nachricht", error);
        }
      };

      // Listener an den Dispatcher hängen
      dispatcher.subscribe("MESSAGE_CREATE", messageListener);
      showToast("Nitro Auto-Claimer aktiviert.");
    },

    onUnload: function () {
      if (messageListener) {
        // Listener beim Beenden des Plugins wieder entfernen
        vendetta.metro.common.FluxDispatcher.unsubscribe("MESSAGE_CREATE", messageListener);
        messageListener = undefined;
      }

      seenMessageIds = Object.create(null);
      showToast("Nitro Auto-Claimer deaktiviert.");
    }
  };
})();
