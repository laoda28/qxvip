console.log('[TT2] ' + $request.method + ' ' + $request.url);

var STORE = 'tt_ent_v2';
var FALLBACK_IDS = ['pro','premium','plus','vip','lifetime','unlock','access','all_access','full','full_access',
  'premium_access','pro_access','vip_access','subscriber','subscription','standard','member','membership',
  'tunetally','tunetally_pro','tunetally_premium','TuneTally Pro','TuneTally Premium','tt_pro','tt_premium',
  'paid','upgrade','unlocked','gold','elite','no_ads','remove_ads','ad_free'];

function readState(){ try{ var s=$persistentStore.read(STORE); if(s) return JSON.parse(s); }catch(e){} return null; }
function writeState(o){ try{ $persistentStore.write(JSON.stringify(o), STORE); }catch(e){} }

var url  = $request.url;
var host = url.replace(/^https?:\/\//,'').split('/')[0];
var path = url.replace(/^https?:\/\/[^\/]+/,'');
var body = ($response && $response.body) || '';
var hdrs = ($response && $response.headers) || {};
var changed = false;

if (path.indexOf('product_entitlement_mapping') >= 0) {
  console.log('[TT2-MAP-RAW] len=' + body.length + ' head=' + body.slice(0, 1200));
  try {
    var m = JSON.parse(body), map = m.product_entitlement_mapping || {}, ids = {}, prods = {};
    for (var k in map) {
      var e = map[k] || {}, ents = e.entitlements || [];
      for (var i = 0; i < ents.length; i++) ids[ents[i]] = 1;
      prods[k] = 1;
    }
    writeState({ ids: Object.keys(ids), products: Object.keys(prods) });
    console.log('[TT2-MAP] ids=' + Object.keys(ids).join('|') + ' products=' + Object.keys(prods).join('|'));
  } catch (err) { console.log('[TT2-MAP-ERR] ' + err); }
}

if (path.indexOf('/v1/subscribers/') >= 0 || path.indexOf('/v1/receipts') >= 0) {
  console.log('[TT2-HDRS] ' + Object.keys(hdrs).join(','));
  try {
    var j = JSON.parse(body);
    if (j && j.subscriber) {
      var sub = j.subscriber;
      console.log('[TT2-PRE] ents=' + JSON.stringify(sub.entitlements || {}).slice(0, 400) +
                  ' subs=' + JSON.stringify(Object.keys(sub.subscriptions || {})) +
                  ' nsub=' + JSON.stringify(Object.keys(sub.non_subscriptions || {})) +
                  ' appuid=' + (sub.original_app_user_id || ''));
      var st = readState();
      var learned = (st && st.ids && st.ids.length) ? st.ids : [];
      var ids = learned.slice(0);
      for (var f = 0; f < FALLBACK_IDS.length; f++) if (ids.indexOf(FALLBACK_IDS[f]) < 0) ids.push(FALLBACK_IDS[f]);
      var prods = (st && st.products) ? st.products : [];
      var prodId = (prods.length ? prods[0] : 'com.universeye.TuneTally.premium');
      var ex = sub.entitlements || {};
      for (var k2 in ex) { if (ex[k2] && ex[k2].product_identifier) { prodId = ex[k2].product_identifier; break; } }
      if (!sub.entitlements) sub.entitlements = {};
      for (var a = 0; a < ids.length; a++) {
        sub.entitlements[ids[a]] = {
          expires_date: null, grace_period_expires_date: null,
          purchase_date: '2020-01-01T00:00:00Z',
          product_identifier: prodId, store: 'app_store'
        };
      }
      if (!sub.subscriptions) sub.subscriptions = {};
      sub.subscriptions[prodId] = {
        billing_issues_detected_at: null, expires_date: '2099-12-31T23:59:59Z',
        grace_period_expires_date: null, is_sandbox: false,
        original_purchase_date: '2020-01-01T00:00:00Z', period_type: 'normal',
        purchase_date: '2020-01-01T00:00:00Z', refunded_at: null,
        store: 'app_store', unsubscribe_detected_at: null
      };
      if (!sub.non_subscriptions) sub.non_subscriptions = {};
      if (!sub.first_seen) sub.first_seen = '2020-01-01T00:00:00Z';
      if (!sub.original_purchase_date) sub.original_purchase_date = '2020-01-01T00:00:00Z';
      body = JSON.stringify(j); changed = true;
      console.log('[TT2-HIT] ' + path + ' ents=' + ids.length + ' learned=' + learned.length + ' prod=' + prodId);
    } else {
      console.log('[TT2-NOSUB] ' + path + ' keys=' + Object.keys(j || {}).join('|'));
    }
  } catch (err) { console.log('[TT2-ERR] ' + path + ' ' + err + ' len=' + body.length); }
}

var BOOL_RE = /^(is_?premium|is_?pro|is_?vip|premium|pro|vip|is_?subscribed|subscribed|is_?member|is_?plus|unlocked|has_?premium|has_?vip|paid|is_?paid|active)$/i;
var DATE_RE = /(premium|vip|pro|subscri|member|expire|paid|trial).*(_at|_date|_time|_end|end)$|^(expire_at|expires_at|premium_end|vip_end|end_date|end_time)$/i;
var NUM_RE  = /^(premium_expire|vip_expire|expire_ts|expires_ts|premium_expire_ts)$/i;

function walk(o) {
  if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i]); return 0; }
  if (!o || typeof o !== 'object') return 0;
  var n = 0;
  for (var k in o) {
    var v = o[k];
    if (typeof v === 'boolean' && BOOL_RE.test(k) && v !== true) { o[k] = true; n++; continue; }
    if (typeof v === 'string' && DATE_RE.test(k)) { o[k] = '2099-12-31T23:59:59Z'; n++; continue; }
    if (typeof v === 'number' && (NUM_RE.test(k) || DATE_RE.test(k))) { o[k] = 4102444800; n++; continue; }
    if (typeof v === 'string' && /^(plan|tier|level|membership|account_type)$/i.test(k) && /^(free|basic|none|standard)$/i.test(v)) { o[k] = 'premium'; n++; continue; }
    n += walk(v);
  }
  return n;
}

if (host.indexOf('supabase.co') >= 0) {
  console.log('[TT2-SB-RAW] ' + path + ' len=' + body.length + ' head=' + body.slice(0, 400));
  if (path.indexOf('/rest/v1/') >= 0) {
    try {
      var sj = JSON.parse(body);
      var cnt = walk(sj);
      if (cnt > 0) { body = JSON.stringify(sj); changed = true; console.log('[TT2-SB-HIT] ' + path + ' fields=' + cnt); }
    } catch (err) { console.log('[TT2-SB-ERR] ' + path + ' ' + err); }
  }
}

if (changed) { $done({ body: body }); } else { $done({}); }
