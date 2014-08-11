
window.onload = function() {
  chrome.storage.local.get("options", function(options) {
    console.log("key1" + Object.keys(options)[0]);
    options = options["options"];
    console.log("key2" + Object.keys(options)[0]);
    console.log("got opts:" + options);
    if (!options) {
      console.log("reverting to defaults");
      options = gatherOptions();
      chrome.storage.local.set({'options': options});
    }

    console.log("setting checks:" + options["useServer"]);

    $("#chimchim-use-server").prop("checked", options["useServer"]);
    $("#chimchim-iframes").prop("checked", options["iframes"]);
    $("#chimchim-prefetch").prop("checked", options["prefetch"]);
    $("#chimchim-prerender").prop("checked", options["prerender"]);
    $("#chimchim-xhr").prop("checked", options["xhr"]);
    console.log("listening to inputs:" + $("input").length);
    $("input").change(function() {
      console.log("change, storing...");
      chrome.storage.local.set({"options": gatherOptions()});
    });
  });

  chrome.storage.local.get("loadStats", function(loadStats) {
    loadStats = loadStats["loadStats"];
    if (loadStats) {
      $("#chimchim-latency").empty()
        .append("latency: " + loadStats.latency + "ms<br>")
        .append("load time: " + loadStats.loadTime + "ms<br>");
    }
  })

  chrome.storage.local.get("links", function(links){
    links = links["links"];
    if (links) {
      $("#chimchim-links").empty();
      for (var i = 0; i < links.length; ++i) {
        $("#chimchim-links").append("<a href='" + links[i] + "'>" + links[i] + "</a><br>");
      }
    }
  });
}

var gatherOptions = function() {
  var options = {
    useServer: $("#chimchim-use-server").prop("checked"),
    iframes: $("#chimchim-iframes").prop("checked"),
    prefetch: $("#chimchim-prefetch").prop("checked"),
    prerender: $("#chimchim-prerender").prop("checked"),
    xhr: $("#chimchim-xhr").prop("checked")
  };
  console.log("gathered:" + options["useServer"]);
  return options;
}
