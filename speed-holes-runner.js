var INIT_SESSION_DATA = {
  numLoads: 0,
  avgLoadTime: 0,
  avgLatency: 0
};

window.onload = function() {
  chrome.storage.sync.get("userid", function(obj) {
    var userid = obj["userid"];
    if (!userid) {
      chrome.storage.local.set({"sessionData": INIT_SESSION_DATA});
      $.ajax(SpeedHoles.BASE_URL + "/getUserId", {
        data: JSON.stringify({}),
        contentType : 'application/json',
        type : 'POST',
        success: function(data) {
          data = JSON.parse(data);
          userid = data["userid"];
          chrome.storage.sync.set({'userid':userid})
          getOptionsAndRun(userid)
        }
      });
    } else {
      getOptionsAndRun(userid);
    }
  });
}

var updateSessionData = function(loadStats) {
  chrome.storage.local.get("sessionData", function(obj){
    var data = obj["sessionData"];
    var avgLatency = (data.avgLatency * data.numLoads + loadStats.latency) / (data.numLoads + 1);
    var avgLoadTime = (data.avgLoadTime * data.numLoads + loadStats.loadTime) / (data.numLoads + 1);
    chrome.storage.local.set({"sessionData": {
      avgLatency: avgLatency,
      avgLoadTime: avgLoadTime,
      numLoads: data.numLoads + 1
    }});
  });
}

var getOptionsAndRun = function (userid) {
  chrome.storage.local.get("options", function(obj) {
    runSpeedHoles(userid, obj["options"]);
  });
}

var runSpeedHoles = function(userid, options) {
  SpeedHoles.initialize({
    userid: userid,
    disablePrerender: !options.prerender,
    disablePrefetch: !options.prefetch,
    disableXhrCache: !options.xhr,
    disableIFrameCache: !options.iframes,
    disableClickTracking: true,
    useServer: options.useServer,
    checkIfCacheable: options.xhr || options.iframes,
    markFetchedLinks: true
  }, function(err, loadStats) {
    if (err) {
      console.log("Error initializing SpeedHoles");
    } else {
      chrome.storage.local.set({'loadStats': loadStats});
      chrome.storage.local.set({'links': []});
      updateSessionData(loadStats);

      var allLinks = $("a").filter(":not([href^='#'])");
      SpeedHoles.addCandidates(allLinks, -1);
      SpeedHoles.run(function(fetchedLink) {
        chrome.storage.local.get("links", function(obj){
          obj["links"].push(fetchedLink);
          chrome.storage.local.set(obj);
        });
      });
    }
  });
}
