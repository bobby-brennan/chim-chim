window.onload = function() {
  console.log("onload!");
  chrome.storage.sync.get("userid", function(obj) {
    var userid = obj["userid"];
    if (!userid) {
      $.ajax("http://www.bbrennan.info:8081/getUserId", {
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
      console.log("FOUND ID:" + userid);
      getOptionsAndRun(userid);
    }
  });
}

var getOptionsAndRun = function (userid) {
  chrome.storage.local.get("options", function(obj) {
    runChimChim(userid, obj["options"]);
  });
}

var runChimChim = function(userid, options) {
  Prefetch.initialize({
    userid: userid,
    disablePrerender: !options.prerender,
    disablePrefetch: !options.prefetch,
    disableXhrCache: !options.xhr,
    disableIFrameCache: !options.iframes,
    useServer: options.useServer,
    markFetchedLinks: true
  }, function(err, loadStats) {
    if (err) {
      console.log("Error initializing chim chim");
    } else {
      chrome.storage.local.set({'loadStats': loadStats});
      var allLinks = $("a").filter(":not([href^='#'])");
      Prefetch.registerLinks(allLinks, -1);
      Prefetch.startPrefetch(function(links) {
        console.log("callback!");
        chrome.storage.local.set({'links':links});
      });
    }
  });
}
