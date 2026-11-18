// TuneTally VIP unlock -- v6  (fix Content-Encoding + full non_subscriptions + wide entitlement ids)
var PROD = 'tunetally_pro';
var PRODUCTS = ['tunetally_pro','tunetally_kindtip','tunetally_amazingtip','tunetally_outrageoustip','tunetally_greattip'];
var IDS = ['pro','premium','plus','vip','lifetime','unlock','unlocked','access','all_access','full','full_access',
  'premium_access','pro_access','vip_access','subscriber','subscription','standard','member','membership',
  'tunetally','tunetally_pro','tunetally_premium','tunetally_lifetime','tunetally_pro_lifetime',
  'TuneTally Pro','TuneTally Premium','tt_pro','tt_premium','paid','upgrade','gold','elite',
  'no_ads','remove_ads','ad_free','ads_free','ads_removed','removeAds','noAds','premium_member','vip_member',
  'pro_entitlement','premium_entitlement','lifetime_access','pro_lifetime','lifetime_pro','premium_lifetime',
  'ultimate','advanced','basic','unlimited','unlimited_access','full_version','full_unlock','pro_version',
  'premium_version','paid_access','all_features','all_access_pass','vip_pass','pro_pass'];

var url  = $request.url;
var path = url.replace(/^https?:\/\/[^\/]+/,'');

if (typeof $response === 'undefined') {
  var h = $request.headers || {};
  var kill = ['X-RevenueCat-ETag','x-revenuecat-etag','If-None-Match','if-none-match','If-Modified-Since','if-modified-since'];
  for (var i = 0; i < kill.length; i++) { try { delete h[kill[i]]; } catch (e) {} }
  h['Cache-Control'] = 'no-cache';
  h['Pragma'] = 'no-cache';
  console.log('[TT6-REQ] ' + url);
  $done({ headers: h });
} else {
  var body = ($response && $response.body) || '';
  var hdrs = ($response && $response.headers) || {};
  var changed = false;

  console.log('[TT6] ' + $request.method + ' ' + path + ' len=' + body.length);

  if (path.indexOf('/v1/subscribers/') >= 0 || path.indexOf('/v1/receipts') >= 0) {
    try {
      var j = JSON.parse(body);
      if (j && j.subscriber) {
        var sub = j.subscriber;
        var now = '2020-01-01T00:00:00Z';

        if (!sub.non_subscriptions) sub.non_subscriptions = {};
        for (var q = 0; q < PRODUCTS.length; q++) {
          sub.non_subscriptions[PRODUCTS[q]] = [{
            id: PRODUCTS[q], is_sandbox: false, purchase_date: now,
            store: 'app_store', store_transaction_id: '20000000000000' + (q + 1)
          }];
        }

        if (!sub.entitlements) sub.entitlements = {};
        for (var a = 0; a < IDS.length; a++) {
          sub.entitlements[IDS[a]] = {
            expires_date: null, grace_period_expires_date: null,
            purchase_date: now, product_identifier: PROD, store: 'app_store'
          };
        }

        if (!sub.subscriptions) sub.subscriptions = {};
        if (!sub.subscriptions[PROD]) {
          sub.subscriptions[PROD] = {
            billing_issues_detected_at: null, expires_date: '2099-12-31T23:59:59Z',
            grace_period_expires_date: null, is_sandbox: false,
            original_purchase_date: now, period_type: 'normal',
            purchase_date: now, refunded_at: null, store: 'app_store',
            unsubscribe_detected_at: null
          };
        }

        if (!sub.first_seen) sub.first_seen = now;
        if (!sub.original_purchase_date) sub.original_purchase_date = now;
        if (!sub.original_app_user_id) sub.original_app_user_id = sub.original_app_user_id || '$RCAnonymousID';
        if (!sub.management_url) sub.management_url = 'https://apps.apple.com/account/subscriptions';

        body = JSON.stringify(j); changed = true;
        console.log('[TT6-HIT] ents=' + IDS.length + ' nsub=' + PRODUCTS.length + ' len=' + body.length);
      } else {
        console.log('[TT6-NOSUB] keys=' + Object.keys(j || {}).join('|'));
      }
    } catch (err) { console.log('[TT6-ERR] ' + path + ' ' + err + ' raw=' + body.slice(0, 300)); }
  } else if (path.indexOf('/offerings') >= 0) {
    try {
      var o = JSON.parse(body), all = o.offerings || {}, out = [];
      for (var ok in all) {
        var pk = (all[ok] || {}).packages || [];
        for (var p = 0; p < pk.length; p++) out.push(pk[p].platform_product_identifier || '?');
      }
      console.log('[TT6-OFF] ' + out.join('|'));
    } catch (err2) { console.log('[TT6-OFF-ERR] ' + err2); }
  }

  if (changed) {
    // 关键：body 变了就必须去掉压缩/长度头，否则 SDK 解出来的是一堆乱码
    var dead = ['Content-Encoding','content-encoding','Content-Length','content-length',
                'Transfer-Encoding','transfer-encoding','x-signature','X-Signature',
                'x-revenuecat-etag','X-RevenueCat-ETag','ETag','etag','Vary','vary'];
    for (var d = 0; d < dead.length; d++) { try { delete hdrs[dead[d]]; } catch (e2) {} }
    hdrs['Content-Type'] = 'application/json';
    $done({ body: body, headers: hdrs });
  } else {
    $done({ headers: hdrs });
  }
}
