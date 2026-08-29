(function () {
  "use strict";

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
      showToast("Kettu Plugin Starter aktiviert.");
      console.log("[Kettu Plugin Starter] aktiviert");
    },

    onUnload: function () {
      showToast("Kettu Plugin Starter deaktiviert.");
      console.log("[Kettu Plugin Starter] deaktiviert");
    }
  };
})()
