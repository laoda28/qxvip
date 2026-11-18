console.log('[Y-ALIVE] v10 ' + $request.method + ' ' + $request.url);

const TRUE_KEYS = /^(is_vip|isVip|isVIP|vip|is_member|isMember|is_premium|isPremium|premium|is_pro|isPro|subscribed|is_subscribed|isSubscribed|vip_status|is_vip_user|is_permanent|isPermanent|has_vip)$/;
const CAN_KEYS  = /^can_(?!admin)/;
const NEED_KEYS = /^(need_vip|needVip|need_pay|pay_required|require_vip|requireVip|is_locked|locked|vip_required|need_upgrade|needUpgrade)$/;
const END_KEYS  = /^(vip_end_time|vipEndTime|memberVipEndTime|member_vip_end_time|vip_expire|vipExpire|vip_expire_time|expire_time|expires_at|expired_at|vip_end|vipEnd|member_expire|member_expire_time|vip_expire_at|vip_end_date)$/;
const DAY_KEYS  = /^(have_days|haveDays|remain_days|remainDays|vip_days)$/;
const MASK = /[*＊]/;

const DATE_STR = '2099-12-31 23:59:59';

function fixEnd(v) {
  if (typeof v === 'number') return v > 1e12 ? 4102444800000 : 4102444800;
  if (typeof v === 'string') {
    if (/^\d{13,}$/.test(v)) return '4102444800000';
    if (/^\d{9,12}$/.test(v)) return '4102444800';
    return DATE_STR;
  }
  return DATE_STR;
}

function fixMaskedName(o) {
  try {
    const ni = o.name_info;
    if (!ni || typeof ni !== 'object') return;
    if (typeof o.name === 'string' && MASK.test(o.name)) {
      o.name = ni.zh || ni.tw || ni.en || ni.ja || o.name;
    }
    if (typeof o.name_easy === 'string' && MASK.test(o.name_easy)) {
      o.name_easy = o.name;
    }
  } catch (e) {}
}

let hits = 0, names = 0;
function walk(o, path) {
  if (Array.isArray(o)) { o.forEach(function (x, i) { walk(x, path + '[' + i + ']'); }); return; }
  if (!o || typeof o !== 'object') return;
  if (o.name_info && typeof o.name === 'string' && MASK.test(o.name)) { fixMaskedName(o); names++; }
  for (const k of Object.keys(o)) {
    const v = o[k], p = path ? path + '.' + k : k;
    if (TRUE_KEYS.test(k) && typeof v === 'boolean') { o[k] = true; hits++; continue; }
    if (CAN_KEYS.test(k) && typeof v === 'boolean') { o[k] = true; hits++; continue; }
    if (NEED_KEYS.test(k)) {
      if (typeof v === 'boolean' && v === true) { o[k] = false; hits++; continue; }
      if (typeof v === 'number' && v > 0) { o[k] = 0; hits++; continue; }
    }
    if (END_KEYS.test(k) && (typeof v === 'number' || typeof v === 'string' || v === null)) { o[k] = fixEnd(v); hits++; continue; }
    if (DAY_KEYS.test(k) && typeof v === 'number') { o[k] = 3650; hits++; continue; }
    if (k === 'member_level' && typeof v === 'string' && /^(none|)$/i.test(v)) { o[k] = 'year'; hits++; continue; }
    if (k === 'role_id' && typeof v === 'number' && v < 4) { o[k] = 4; hits++; continue; }
    if ((k === 'role_name' || /\.role\.name$/.test(p)) && v === '普通用户') { o[k] = '高级会员'; hits++; continue; }
    walk(v, p);
  }
}

const url = $request.url;
let body = ($response && $response.body) || '';
const short = url.replace(/^https?:\/\/[^\/]+/, '');

try {
  const j = JSON.parse(body);
  walk(j, '');
  if (hits || names) {
    console.log('[Y-HIT] ' + short + '  flags=' + hits + ' names=' + names);
    body = JSON.stringify(j);
  }
} catch (e) {
  console.log('[Y-ERR] ' + short + ' ' + e + ' len=' + body.length);
}
$done({ body });
