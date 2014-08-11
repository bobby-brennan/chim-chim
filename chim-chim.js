var Prefetch = {};

var BASE_URL = "http://www.bbrennan.info:8000";

var EXTENSION_MODE = 1;
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

var cacheLinks = function(links, callback) {
  getCacheableLinks(links, function(cacheable) {
    console.log("got all cacheable links:" + cacheable.length);
    addIFrames(cacheable);
    if (callback) {
      callback(cacheable);
    }
  }, function(cacheableLink) {
    addToPrefetch(cacheableLink);
    addToPrerender(cacheableLink);
    addToXhrCache(cacheableLink);
    if (OPTIONS["markFetchedLinks"]) {
      //markLink(cacheableLink);
    }
  });
}

var getCacheableLinks = function(links, onDone, onCacheable) {
  if (!links) {
    onDone(links);
    return;
  }
  links = links.filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });
  var cacheableLinks = [];
  var maxToCheck = OPTIONS["maxLinks"] * 3;
  var checkNext = function(linklist, index, doNext, onFinish) {
    checkIfCacheable(linklist[index], function(cacheable) {
      if (cacheable) {
        onCacheable(linklist[index]);
        cacheableLinks.push(linklist[index]);
      }
      if (++index < linklist.length &&
          index < maxToCheck &&
          cacheableLinks.length < OPTIONS["maxLinks"]) {
        doNext(linklist, index, doNext, onFinish)
      } else {
        onFinish();
      }
    })
  }
  checkNext(links, 0, checkNext, function() {
    onDone(cacheableLinks);
  });
}

var checkIfCacheable = function(url, onCheck) {
  if (url === document.location.href) {
    onCheck(false);
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (this.readyState === this.DONE) {
      var cacheOpts = xhr.getResponseHeader("Cache-Control");
      cacheOpts = cacheOpts ? cacheOpts.toLowerCase() : ""
      if (cacheOpts.indexOf('no-cache') !== -1 ||
          cacheOpts.indexOf('max-age=0') !== -1 ||
          // TODO: hacks?
          cacheOpts.indexOf('s-maxage') !== -1 ||
          cacheOpts.indexOf('private') !== -1) {
        console.log("skipping:" + cacheOpts);
        onCheck(false);
      } else {
        console.log("adding:" + cacheOpts);
        onCheck(true);
      }
    }
  }
  xhr.open('HEAD', url);
  xhr.send('');
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
  console.log("prerender:" + url);
  var id = getNextPrefetchId();
  $("body").append($('<link>')
    .attr('id', id)
    .attr('rel', "prerender")
    .attr('class', PREFETCH_CLASS)
    .attr('href', url)
  );
}

var addIFrames = function(links) {
  if (OPTIONS["disableIFrameCache"]) {return;}
  var addNextToIFrame = function(linkset, index, onDone) {
    console.log("adding to iframe:" + linkset[index]);
    addToIFrameCache(linkset[index], function(){
      if (++index < linkset.length) {
        onDone(linkset, index, onDone);
      }
    });
  };
  addNextToIFrame(links, 0, addNextToIFrame)
}

var addToIFrameCache = function(url, onDone) {
  if (OPTIONS["disableIFrameCache"]) {return;}
  var id = getNextPrefetchId();

  $("body").append($('<iframe>')
    .attr('id', id)
    .attr('src', url)
    .attr('class', PREFETCH_CLASS)
    .load(function() {
      console.log("load frame " + id);
      onDone();
    })
    .hide()
  );
}

var addToXhrCache = function(url) {
  if (OPTIONS["disableXhrCache"]) {return;}
  console.log("add to xhr:" + url);
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (this.readyState == this.DONE) {
      markLink(url);
    }
  }
  xhr.open('GET', url);
  xhr.send('')
}

var maybeRepost = function(url, ttl) {
  console.log("maybe repost");
  var matchstr = "." + PREFETCH_CLASS + "[src='" + url + "'], " +
      "." + PREFETCH_CLASS + "[href='" + url + "']";
  var matching = $(matchstr);
  if (matching.length > 0) {
    console.log("replacing all:" + matching.length);
    cacheLinks([url]);
  }
  setTimeout(function() {
    maybeRepost(url, ttl)
  }, ttl);
}

var postClick = function(clickedUrl) {
  $.ajax(BASE_URL + "postClick", {
    data: JSON.stringify({
      sessionId:mSessionId,
      source:mUrl,
      target:clickedUrl,
      userid:OPTIONS["userid"]
    }),
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

var markLinks = function(links) {
  for (var i = 0; i < links.length; ++i) {
    markLink(links[i]);
  }
}

var markLink = function(link) {
  console.log("marked:" + link);
  $("a[href='" + link + "']").css('background-color', '#FF0000');
}

var setOptions = function(opts) {
  if (!opts["prerenderingConfidence"]) {
    opts["prerenderingConfidence"] = -1;
  }
  if (!opts["requestTimeout"]) {
    opts["requestTimeout"] = 150;
  }
  if (!opts["confidenceThreshold"]) {
    opts["confidenceThreshold"] = 0.0;
  }
  if (!opts["maxLinks"]) {
    opts["maxLinks"] = 10;
  }
  if (!opts["userid"]) {
    // Implicitly anonymous
  }
  if (typeof opts["useServer"] === undefined) {
    opts["useServer"] = true;
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
    opts["disableIFrameCache"] = true;
  }
  if (typeof opts["disableXhrCache"] === undefined) {
    opts["disableXhrCache"] = false;
  }
  if (typeof opts["forceEnabled"] === undefined) {
    opts["forceEnabled"] = false;
  }
  if (typeof opts["forceDisabled"] === undefined) {
    opts["forceDisabled"] = false;
  }
  if (typeof opts["markFetchedLinks"] === undefined) {
    opts["markFetchedLinks"] = false;
  }
  OPTIONS = opts;
}

var isValidUrl = function(url) {
  // TODO: consolidate w/ server logic
  return url && url.indexOf("http") == 0 && url.indexOf("?") == -1;
}

Prefetch.initialize = function(opts, onDone) {
  if (window.self !== window.top || document.webkitHidden) {
    console.log("in an iFrame, not running prefetch.")
    mIframe = true;
    return;
  }

  setOptions(opts);

  mUrl = document.URL;
  var timing = performance.timing;
  var latency = timing.responseStart - timing.fetchStart;
  var loadTime = timing.loadEventEnd - timing.responseEnd;
  var loadStats = {latency: latency, loadTime: loadTime};
  var pe = performance.getEntries();
  for (var i = 0; i < pe.length; i++) {
    console.log(
      "Name: " + pe[i].name +
      " Start Time: " + pe[i].startTime +
      " Duration: " + pe[i].duration + "\n");
  }
  mSessionId = getSessionCookie();
  console.log("session:" + mSessionId);

  console.log("latency:" + latency);
  console.log("load time:" + loadTime);
  $.ajax(BASE_URL + "/initialize", {
    data: JSON.stringify({
      sessionId:mSessionId,
      userid: OPTIONS["userid"],
      url:mUrl,
      referrer: document.referrer,
      latency: latency,
    }),
    contentType : 'application/json',
    type : 'POST',
    success: function(data) {
      console.log("success:" + data);
      data = JSON.parse(data);
      mInitialized = true;
      if (mSessionId !== data["sessionId"]) {
        setSessionCookie(data["sessionId"]);
      }
      onDone(false, loadStats);
      if (data["message"]) {
        console.log("init message:" + data["message"]);
      }
    },
    error: function() {
      console.log("error initializing prefetch");
      onDone(true, loadStats);
    }
  });
}

// TODO: consider just taking in URLs and abandoning click tracking.
Prefetch.registerLink = function(elem, url, ttl) {
  if (mIframe) {return;}
  if (!url) {
    url = elem.href;
  }
  if (!isValidUrl(url)) {
    console.log("invalid url:" + url);
    return;
  }
  console.log("register:" + url);
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
  console.log("found " + elems.length + " links");
  if (mIframe) {return;}
  elems.each(function(){
    var url = $(this).prop("href");
    //console.log("register:" + url);
    if (url && url.length > 1) {
      Prefetch.registerLink($(this), url, ttl);
    }
  });
}

Prefetch.startPrefetch = function(callback) {
  if (mIframe) {return;}
  if (!mInitialized) {
    throw "Chim Chim not initialized yet!";
  }
  if (mLinks.length < 1) {
    console.log("no links, bailing on prefetch");
    return;
  }
  if (!OPTIONS["useServer"]) {
    cacheLinks(mLinks, callback);
  } else {
    var thresh = OPTIONS["confidenceThreshold"];
      $.ajax(BASE_URL + "getPrefetch", {
      data: JSON.stringify({
        targets: mLinks,
        source: mUrl,
        threshold: thresh,
        forceEnabled: OPTIONS["forceEnabled"],
        forceDisabled: OPTIONS["forceDisabled"],
        userid: OPTIONS["userid"],
        sessionId: mSessionId
      }),
      contentType : 'application/json',
      type : 'POST',
      success: function(data) {
        data = JSON.parse(data);
        var links = data["links"];
        cacheLinks(links, callback)
        console.log("msg:" + data["message"]);
      }
    });
  }
}
