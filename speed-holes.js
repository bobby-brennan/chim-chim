var SpeedHoles = {};

var BASE_URL = "http://www.bbrennan.info:3000/";

var EXTENSION_MODE = 1;
var PREFETCH_CLASS = "pfpf";
var COOKIE_NAME = "speedholes";
var SESSION_TIMEOUT_MS = 10 * 1000 * 60;
var INITIALIZE_WAIT_TIME_MS = 1 * 1000;
var CACHE_LATENCY_CUTOFF = 15;

var LOAD_HOOKS = [
  "navigationStart",
  "fetchStart",
  "domainLookupStart",
  "domainLookupEnd",
  "connectStart",
  "connectEnd",
  "requestStart",
  "responseStart",
  "responseEnd",
  "domLoading",
  "domInteractive",
  "domComplete",
  "loadEventStart",
  "loadEventEnd"
];

var printLoadTimes = function(timing) {
  for (var i = 0; i < LOAD_HOOKS.length - 1; ++i) {
    var time = timing[LOAD_HOOKS[i+1]] - timing[LOAD_HOOKS[i]];
    console.log(LOAD_HOOKS[i+1] + " - " + LOAD_HOOKS[i] + " = " + time);
  }
}

var mLandingPage = {};
var mHostname;
var mAssets = [];
var mAssetLatencies = {};
var mInitialized = false;
var mIneligible = false;
var mSessionId = "";
var mCache = [];
var mLastPrefetched = [];

var mPrefetchNum = 0;
var getNextPrefetchId = function() {
  return "speedholes-" + mPrefetchNum++;
}

var cacheLinks = function(links, onFetchCallback) {
  var newlyCached = [];
  mLastPrefetched = [];
  for (var i = 0; i < links.length; ++i) {
    var hash = computeUrlHash(links[i]);
    if (mCache.indexOf(hash) == -1) {
      if (newlyCached.length == 0) {
        addToPrerender(links[i]);
      }
      addToPrefetch(links[i]);
      if (OPTIONS["verbose"]) console.log("prefetching:" + links[i]);
      newlyCached.push(links[i]);
      mLastPrefetched.push(hash);
    }
  }
  setSpeedholesCookie(mSessionId, mCache, mLastPrefetched);
  if (onFetchCallback) {
    onFetchCallback(newlyCached);
  }
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

var setSpeedholesCookie = function(sessionId, cachedLinks, prefetchedLinks) {
  var newObj = {sessionId: sessionId, cache: cachedLinks, prefetch: prefetchedLinks};
  var newCookie = constructCookie(JSON.stringify(newObj), SESSION_TIMEOUT_MS);
  document.cookie = newCookie;
}

var constructCookie = function(value, timeout) {
  var time = new Date(new Date().getTime() + timeout);
  return COOKIE_NAME + "=" + encodeURIComponent(value) + ";" +
      "expires=" + time.toUTCString() + ";" + "path=/";
}

var getCurrentCookie = function() {
  var curCookies = document.cookie.split(';');
  for (var i = 0; i < curCookies.length; ++i) {
    var cookie = curCookies[i];
    while (cookie.charAt(0) === ' ') {cookie = cookie.substring(1, cookie.length);}
    if (cookie.indexOf(COOKIE_NAME + "=") === 0) {
      var value = cookie.substring(COOKIE_NAME.length + 1, cookie.length);
      try {
        return JSON.parse(decodeURIComponent(value));
      } catch (e) {
        return {};
      }
    }
  }
  return {sessionId: "", cache: [], prefetch: []};
}

var computeUrlHash = function(url) {
  var hash = 0, i, chr, len;
  if (url.length == 0) return hash;
  for (i = 0, len = url.length; i < len; i++) {
    chr   = url.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

var markLinks = function(links) {
  for (var i = 0; i < links.length; ++i) {
    markLink(links[i]);
  }
}

var markLink = function(link) {
  $("a[href='" + link + "']").css('background-color', '#FF0000');
}

var setOptions = function(opts) {
  if (!("confidenceThreshold" in opts)) {
    opts["confidenceThreshold"] = 0.0;
  }
  if (!opts["maxLinks"]) {
    opts["maxLinks"] = 20;
  }
  if (!opts["user"]) {
    opts["user"] = "";
  }
  if (!("disablePrerender" in opts)) {
    opts["disablePrerender"] = false;
  }
  if (!("disablePrefetch" in opts)) {
    opts["disablePrefetch"] = false;
  }
  if (!("markFetchedLinks" in opts)) {
    opts["markFetchedLinks"] = false;
  }
  if (!("verbose" in opts)) {
    // STOPSHIP: turn verbose off.
    opts["verbose"] = true;
  }
  OPTIONS = opts;
}

var constructUri = function(url) {
  var l = document.createElement("a");
  l.href = url;
  return l;
}

var isValidUrl = function(url) {
  return url in mAssetLatencies;
}

var maybeVoidSessionId = function(curId) {
  if (curId && document.referrer.length > 0 &&
      constructUri(document.referrer).hostname === constructUri(mLandingPage.url).hostname) {
    return curId;
  }
  return "";
}

SpeedHoles.initialize = function(opts, onDone) {
  setOptions(opts);

  if (document.webkitHidden) {
    if (OPTIONS["verbose"]) console.log("webkitHidden (i.e. inside Chrome prerender), not running SpeedHoles.")
    mIneligible = true;
    onDone(1);
    return;
  }

  if (location.protocol === 'https:') {
    if (OPTIONS["verbose"]) console.log("Page is running over https. Not running SpeedHoles.");
    mIneligible = true;
    onDone(2);
    return;
  }

  if (OPTIONS["disablePrerender"] &&
      OPTIONS["disablePrefetch"]) {
    if (OPTIONS["verbose"]) console.log("No prefteching options enabled. Will only check latency numbers.");
    mIneligible = true;
  }

  var timing = performance.timing;
  var latency = timing.responseStart - timing.fetchStart;
  var loadTime = timing.loadEventEnd - timing.responseEnd;
  var loadStats = {
    latency: latency,
    loadTime: loadTime,
    location: mLandingPage.url,
  };

  var cookie = getCurrentCookie();
  mSessionId = cookie ? maybeVoidSessionId(cookie.sessionId) : "";
  mCache = cookie && mSessionId ? cookie.cache : [];
  mLastPrefetched = cookie && mSessionId ? cookie.prefetch : [];

  mLandingPage = {};
  mLandingPage["url"] = document.URL;
  mLandingPage["latency"] = latency;
  mLandingPage["cached"] = latency < CACHE_LATENCY_CUTOFF;
  mLandingPage["prefetched"] = mLastPrefetched.indexOf[mLandingPage.url] !== -1;

  mHostname = constructUri(document.URL).hostname;

  var pe = performance.getEntries();
  for (var i = 0; i < pe.length; i++) {
    mAssetLatencies[pe[i].name] = pe[i].duration;
  }
  mAssetLatencies[mLandingPage.url] = mLandingPage.latency;

  // Remove items from cache if they're still being loaded from server
  // Add them to the cache if they're being loaded from cache
  for (key in mAssetLatencies) {
    var hash = computeUrlHash(key);
    if (mAssetLatencies[key] > CACHE_LATENCY_CUTOFF) {
      var index = mCache.indexOf(hash);
      while (index !== -1) {
        mCache.splice(index, 1);
        index = mCache.indexOf(hash);
      }
    } else if (mCache.indexOf(hash) == -1) {
      mCache.push(hash);
    }
  }

  mInitialized = true;
  onDone(false, loadStats);
}

SpeedHoles.addAsset = function(url) {
  if (mIneligible) {return;}
  url = constructUri(url).href;
  if (!isValidUrl(url)) {
    if (OPTIONS["verbose"]) console.log("invalid url:" + url);
    return false;
  }

  var latency = url === mLandingPage.url ? mLandingPage.latency : mAssetLatencies[url];
  var hash = computeUrlHash(url);
  var prefetched = mLastPrefetched.indexOf(hash) !== -1;
  var cached = mCache.indexOf(hash) !== -1;
  var asset = {url:url, latency: Math.floor(latency), cached: cached, prefetched: prefetched};
  if (OPTIONS["verbose"]) console.log("adding asset:" + JSON.stringify(asset));
  mAssets.push(asset);
  return true;
}

SpeedHoles.addAssets = function(elems) {
  if (mIneligible) {return;}
  if (OPTIONS["verbose"]) console.log("Adding " + elems.length + " SpeedHoles candidates");
  elems.each(function() {
    var url = $(this).prop("src");
    SpeedHoles.addAsset(url);
  });
}

SpeedHoles.addAllAssets = function(elems) {
  var pe = performance.getEntries();
  for (var i = 0; i < pe.length; i++) {
    SpeedHoles.addAsset(pe[i].name);
  }
  SpeedHoles.addAsset(document.location.href);
}

SpeedHoles.run = function(onFetchCallback) {
  if (mIneligible) {return;}
  if (!mInitialized) {
    throw "SpeedHoles not initialized yet!";
  }
  if (mAssets.length < 1) {
    if (OPTIONS["verbose"]) console.log("No valid candidates added, SpeedHoles bailing out.");
    return;
  }
  var thresh = OPTIONS["confidenceThreshold"];
  $.ajax(BASE_URL + "referral", {
    data: JSON.stringify({
      referrer: document.referrer,
      assets: mAssets,
      landingPage: mLandingPage,
      confidence: thresh,
      noFetch: [],
      prefetched: mLastPrefetched,
      cached: mCache,
      sessionId: mSessionId,
      user: OPTIONS["user"],
    }),
    contentType : 'application/json',
    type : 'POST',
    success: function(data) {
      data = JSON.parse(data);
      var links = data["links"];
      mSessionId = data["sessionId"];
      cacheLinks(links, onFetchCallback);
      if (data["message"] && data["message"].length > 0) {
        if (OPTIONS["verbose"]) console.log("SpeedHoles response:" + data["message"]);
      }
    },
    error: function() {
      if (OPTIONS["verbose"]) console.log("Error contacting SpeedHoles");
    }
  });
}
