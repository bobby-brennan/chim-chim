var Prefetch = {};

var PREFETCH_CLASS = "pfpf";
var COOKIE_NAME = "pf-session-id";
var SESSION_TIMEOUT_MS = 10 * 1000 * 60;
var INITIALIZE_WAIT_TIME_MS = 1 * 1000;

var mUrl = "unknown";
var mReferrer = "unknown";
var mLinks = [];
var mInitialized = false;
var mIframe = false;

var mPrefetchNum = 0;
var getNextPrefetchId = function() {
  return "pf-" + mPrefetchNum++;
}

var addToPrefetch = function(url) {
  if (OPTIONS["disablePrefetch"]) {return;}
  var id = getNextPrefetchId();

  $("body").append($('<link>')
    .attr('id', id)
    .attr('rel', "prefetch")
    .attr('class', PREFETCH_CLASS)
    .attr('href', url)
  );
}

var addToPrerender = function(url) {
  if (OPTIONS["disablePrerender"]) {return;}
  var id = getNextPrefetchId();

  $("body").append($('<link>')
    .attr('id', id)
    .attr('rel', "prerender")
    .attr('class', PREFETCH_CLASS)
    .attr('href', url)
  );
}

// TODO: load iFrames sequentially
var addToIFrameCache = function(url) {
  if (OPTIONS["disableIFrameCache"]) {return;}
  var id = getNextPrefetchId();

  $("body").append($('<iframe>')
    .attr('id', id)
    .attr('src', url)
    .attr('class', PREFETCH_CLASS)
    .load(function() {
      console.log("load frame " + id);
    })
    .hide()
  );
}

var maybeRepost = function(url, ttl) {
  console.log("maybe repost");
  var matchstr = "." + PREFETCH_CLASS + "[src='" + url + "'], " +
      "." + PREFETCH_CLASS + "[href='" + url + "']";
  var matching = $(matchstr);
  if (matching.length > 0) {
    console.log("replacing all:" + matching.length);
    matching.remove();
    addToPrefetch(url);
    addToPrerender(url);
    addToIFrameCache(url);
  }
  setTimeout(function() {
    maybeRepost(url, ttl)
  }, ttl);
}

var postClick = function(clickedUrl) {
  console.log("posting click");
  $.ajax("http://www.bbrennan.info:8081/postClick", {
    data: JSON.stringify({sessionId:mSessionId, source:mUrl, target:clickedUrl}),
    contentType : 'application/json',
    type : 'POST',
    success: function() {
      console.log("Success");
      window.location.href = clickedUrl;
    },
    error: function() {
      console.log("err");
      window.location.href = clickedUrl;
    }
  });
  setTimeout(function() {
    window.location.href = clickedUrl;
  }, OPTIONS["requestTimeout"]);
}

var setSessionCookie = function(sessionId) {
  console.log("setting new session:" + sessionId);
  mSessionId = sessionId;
  console.log('cookie1:' + document.cookie);
  var time = new Date(new Date().getMilliseconds() + SESSION_TIMEOUT_MS);
  document.cookie = COOKIE_NAME + "=" + sessionId + "; expires " + time.toUTCString() + "; path=/";
  console.log('cookie2:' + document.cookie);
}

var getSessionCookie = function() {
  var cookies = document.cookie.split(";");
  for (var i = 0; i < cookies.length; ++i) {
    var cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {cookie = cookie.substring(1, cookie.length);}
    if (cookie.indexOf(COOKIE_NAME + "=") === 0) {
      console.log("found cookie:" + cookie);
      return cookie.substring(COOKIE_NAME.length + 1, cookie.length);
    }
  }
  return "";
}

var setOptions = function(opts) {
  if (!opts["prerenderingConfidence"]) {
    opts["prerenderingConfidence"] = -1;
  }
  if (!opts["requestTimeout"]) {
    opts["requestTimeout"] = 150;
  }
  if (!opts["confidenceThreshold"]) {
    opts["confidenceThreshold"] = .25;
  }
  if (typeof opts["disableClickTracking"] === undefined) {
    opts["disableClickTracking"] = false;
  }
  if (typeof opts["disablePrerender"] === undefined) {
    opts["disablePrerender"] = false;
  }
  if (typeof opts["disablePrefetch"] === undefined) {
    opts["disablePrefetch"] = false;
  }
  if (typeof opts["disableIFrameCache"] === undefined) {
    opts["disableIFrameCache"] = false;
  }
  if (typeof opts["forceEnabled"] === undefined) {
    opts["forceEnabled"] = false;
  }
  if (typeof opts["forceDisabled"] === undefined) {
    opts["forceDisabled"] = false;
  }
  OPTIONS = opts;
}

Prefetch.initialize = function(opts) {
  if (window.self !== window.top) {
    console.log("in an iFrame, not running prefetch.")
    mIframe = true;
    return;
  }
  setOptions(opts);

  mUrl = document.URL;
  var timing = performance.timing;
  var latency = timing.responseEnd - timing.fetchStart;

  mSessionId = getSessionCookie();
  console.log("session:" + mSessionId);

  console.log("latency:" + latency);

  $.ajax("http://www.bbrennan.info:8081/initialize", {
    data: JSON.stringify({
      sessionId:mSessionId,
      url:mUrl,
      referrer: document.referrer,
      latency: latency,

    }),
    contentType : 'application/json',
    type : 'POST',
    success: function(data) {
      console.log("initialized:" + data);
      data = JSON.parse(data);
      mInitialized = true;
      if (mSessionId !== data["sessionId"]) {
        setSessionCookie(data["sessionId"]);
      }
    },
    error: function() {
      console.log("error initializing prefetch");
    }
  });
}

// TODO: consider just taking in URLs and abandoning click tracking.
Prefetch.registerLink = function(elem, url, ttl) {
  if (mIframe) {return;}
  if (!url) {
    url = elem.href;
  }
  mLinks.push(url);
  if (!OPTIONS["disableClickTracking"]) {
    elem.on("click", function(e) {
      e.preventDefault();
      postClick(url);
    })
  }
  // TODO: only do this for links that get added
  if (ttl && ttl > 0) {
    setTimeout(function() {
      maybeRepost(url, ttl);
    }, ttl);
  }
}

Prefetch.registerLinks = function(elems, ttl) {
  if (mIframe) {return;}
  elems.each(function(){
    var url = $(this).attr('href');
    if (url && url.length > 1) {
      Prefetch.registerLink($(this), url, ttl);
    }
  });
}

Prefetch.startPrefetch = function() {
  if (mIframe) {return;}
  if (!mInitialized) {
    setTimeout(function() {Prefetch.startPrefetch()}, INITIALIZE_WAIT_TIME_MS);
    return;
  }
  var thresh = OPTIONS["confidenceThreshold"];
  $.ajax("http://www.bbrennan.info:8081/getPrefetch", {
    data: JSON.stringify({
      targets: mLinks,
      source: mUrl,
      threshold: thresh,
      forceEnabled: OPTIONS["forceEnabled"],
      forceDisabled: OPTIONS["forceDisabled"],
      sessionId: mSessionId
    }),
    contentType : 'application/json',
    type : 'POST',
    success: function(data) {
      data = JSON.parse(data);
      var links = data["links"];
      for (var i = 0; links && i < links.length; ++i) {
        console.log("prefetching:" + links[i]);
        addToPrefetch(links[i]);
        addToPrerender(links[i]);
        addToIFrameCache(links[i]);
      }
      console.log("msg:" + data["message"]);
    }
  });
  // GET SESSION_ID back
}

console.log("RUNNING CHIM CHIM");
Prefetch.initialize({});
Prefetch.registerLinks($("a"), -1);
Prefetch.startPrefetch();
