
window.onload = function() {
  $("#clear-button").click(function() {
    clearSession();
  })

  chrome.storage.local.get("options", function(options) {
    options = options["options"];
    if (!options) {
      options = gatherOptions();
      chrome.storage.local.set({'options': options});
    }

    $("#use-server").prop("checked", options["useServer"]);
    $("#iframes").prop("checked", options["iframes"]);
    $("#prefetch").prop("checked", options["prefetch"]);
    $("#prerender").prop("checked", options["prerender"]);
    $("#xhr").prop("checked", options["xhr"]);

    $("input").change(function() {
      chrome.storage.local.set({"options": gatherOptions()});
    });
  });

  chrome.storage.local.get("loadStats", function(loadStats) {
    loadStats = loadStats["loadStats"];
    if (loadStats) {
      $("#latency").empty()
        .append("location: " + loadStats.location + "<br>")
        .append("latency: " + loadStats.latency + "ms<br>")
        .append("load time: " + loadStats.loadTime + "ms<br>");
    }
  })

  chrome.storage.local.get("sessionData", function(obj) {
    var data = obj["sessionData"];
    if (!data) {return;}
    $("#session-data").empty()
      .append("latency: " + data.avgLatency + "ms<br>")
      .append("load time: " + data.avgLoadTime + "ms<br>")
      .append("loads: " + data.numLoads + "<br>");
  })

  chrome.storage.local.get("links", function(links){
    links = links["links"];
    if (links) {
      $("#links").empty();
      for (var i = 0; i < links.length; ++i) {
        $("#links").append("<a href='" + links[i] + "'>" + links[i] + "</a><br>");
      }
    }
  });
}

var gatherOptions = function() {
  var options = {
    useServer: $("#use-server").prop("checked"),
    iframes: $("#iframes").prop("checked"),
    prefetch: $("#prefetch").prop("checked"),
    prerender: $("#prerender").prop("checked"),
    xhr: $("#xhr").prop("checked")
  };
  return options;
}

var INIT_SESSION_DATA = {
  numLoads: 0,
  avgLoadTime: 0,
  avgLatency: 0
};

var clearSession = function() {
  chrome.storage.local.set({"sessionData": INIT_SESSION_DATA});
}
