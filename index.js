(function () {
  "use strict";

  var GIFT_LINK = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gift|discord(?:app)?\.com\/gifts?)\/[A-Za-z0-9_-]{8,128}/i;
  var seenMessageIds = Object.create(null);
  var messageListener;

  function showToast(message) {
    try {
      var getAssetId = vendetta.ui.assets.getAssetIDByName;
      var show = vendetta.ui.toasts.showToast;
      show(message, getAssetId("Check"));
    } catch (error) {
      console.log("[Kettu Plugin Starter] " + message, error);
    }
  }

  return {
    onLoad: function () {
      var dispatcher = vendetta.metro.common.FluxDispatcher;

      messageListener = function (event) {
        try {
          var message = event && event.message;
          if (!message || typeof message.content !== "string") return;

          var messageId = String(message.id || message.channel_id + ":" + message.content);
          if (seenMessageIds[messageId] || !GIFT_LINK.test(message.content)) return;

          seenMessageIds[messageId] = true;
          showToast("Discord-Geschenklink erkannt.");
        } catch (error) {
          console.log("[Kettu Plugin Starter] Nachricht konnte nicht geprüft werden", error);
        }
      };

      dispatcher.subscribe("MESSAGE_CREATE", messageListener);
      showToast("Gift-Link-Erkennung aktiviert.");
      console.log("[Kettu Plugin Starter] Gift-Link-Erkennung aktiviert");
    },

    onUnload: function () {
      if (messageListener) {
        vendetta.metro.common.FluxDispatcher.unsubscribe("MESSAGE_CREATE", messageListener);
        messageListener = undefined;
      }

      seenMessageIds = Object.create(null);
      showToast("Gift-Link-Erkennung deaktiviert.");
      console.log("[Kettu Plugin Starter] Gift-Link-Erkennung deaktiviert");
    }
  };
})()
