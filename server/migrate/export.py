#!/usr/bin/env python3
"""نقل بيانات شات كيمت من Firebase (Firestore) لسيرفر PocketBase.

بيقرا كل حاجة من Firestore ويعمل فولدر فيه data.json + الصور والفويس كملفات.
البيانات دي خاصة: الفولدر بيتقفل بالمفتاح العام بتاع السيرفر (pack.sh) قبل أي رفع،
ومابيترفعش مفتوح أبدًا.

python3 export.py OUT_DIR   (محتاج gcloud داخل بحساب ليه صلاحية على المشروع)
"""
import base64, json, os, subprocess, sys, urllib.request, urllib.parse

PROJECT = 'chat-kemet'
B = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'
OUT = sys.argv[1]
os.makedirs(os.path.join(OUT, 'media'), exist_ok=True)
env = {k: v for k, v in os.environ.items() if k != 'CLOUDSDK_AUTH_ACCESS_TOKEN'}
TOK = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], env=env).decode().strip()


def get(url):
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + TOK, 'x-goog-user-project': PROJECT})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def val(v):
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return v['doubleValue']
    if 'booleanValue' in v: return v['booleanValue']
    if 'nullValue' in v: return None
    if 'timestampValue' in v: return v['timestampValue']
    if 'mapValue' in v: return {k: val(x) for k, x in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v: return [val(x) for x in v['arrayValue'].get('values', [])]
    return None


def docs(path):
    out, tok = [], ''
    while True:
        u = f'{B}/{path}?pageSize=300' + (f'&pageToken={urllib.parse.quote(tok)}' if tok else '')
        try:
            d = get(u)
        except urllib.error.HTTPError as e:
            if e.code == 404: return out
            raise
        for x in d.get('documents', []):
            f = {k: val(v) for k, v in x.get('fields', {}).items()}
            f['_id'] = x['name'].split('/')[-1]
            f['_created'] = x.get('createTime')
            out.append(f)
        tok = d.get('nextPageToken')
        if not tok: return out


def ts(x):
    return x if isinstance(x, str) else None


EXT = {'image/jpeg': 'jpg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/aac': 'aac', 'audio/ogg': 'ogg'}
D = {'users': [], 'photos': [], 'settings': [], 'rooms': [], 'media': [], 'messages': [], 'chats': [], 'dms': [],
     'wallets': [], 'coinlog': [], 'scores': [], 'bans': [], 'restrict': [], 'reports': []}
mimes = {}


def media_of(base, scope):
    keys = {}
    for m in docs(base + '/media'):
        mime = m.get('mime') or ('image/jpeg' if m.get('type') == 'image' else 'audio/mpeg')
        mimes[mime] = mimes.get(mime, 0) + 1
        key = base.replace('/', '_') + '_' + m['_id']
        fn = f"media/{key}.{EXT.get(mime, 'bin')}"
        with open(os.path.join(OUT, fn), 'wb') as f:
            f.write(base64.b64decode(m.get('data') or ''))
        D['media'].append({'key': key, 'owner': m.get('uid'), 'type': m.get('type'), **scope, 'file': fn, 'created': ts(m.get('createdAt'))})
        keys[m['_id']] = key
    return keys


def msg(m, keys):
    rep = m.get('replyTo')
    return {
        'uid': m.get('uid'), 'kind': m.get('kind'), 'text': m.get('text') or '', 'sticker': m.get('sticker'),
        'w': m.get('w'), 'h': m.get('h'), 'dur': m.get('dur'), 'thumb': m.get('thumb') or '', 'table': m.get('table') or '',
        'replyTo': ({'name': rep.get('name', ''), 'text': rep.get('text', ''), **({'uid': rep['uid']} if rep.get('uid') else {})} if rep else None),
        'reactions': m.get('reactions') or {}, 'edited': bool(m.get('edited')),
        'mediaKey': keys.get(m.get('media')) if m.get('media') else None, 'created': ts(m.get('createdAt')) or m['_created'],
    }


# ===== الأدوار =====
roles = {d['_id']: d for d in docs('config')}
admins = []
if 'roles' in roles:
    admins = roles['roles'].get('admins') or []
    D['roles'] = {'admins': admins, 'mods': roles['roles'].get('mods') or {}}

# ===== الأعضاء =====
for u in docs('users'):
    if not u.get('name'): continue
    age = u.get('age')
    D['users'].append({'id': u['_id'], 'name': u['name'][:30], 'gender': u.get('gender') if u.get('gender') in ('male', 'female') else 'male',
                       'bio': (u.get('bio') or '')[:200], 'city': (u.get('city') or '')[:40], 'age': age if isinstance(age, int) and 13 <= age <= 100 else None,
                       'avatar': u.get('avatar') or '', 'rooms': (u.get('rooms') or [])[-100:], 'created': ts(u.get('createdAt'))})
    for p in docs(f"users/{u['_id']}/photos"):
        if str(p['_id']).isdigit() and p.get('data'):
            D['photos'].append({'owner': u['_id'], 'slot': int(p['_id']), 'data': p['data']})
for s in docs('settings'):
    D['settings'].append({'id': s['_id'], 'blocked': s.get('blocked') or {}, 'dmWho': s.get('dmWho') or 'rooms',
                          'noReceipts': s.get('receipts') is False, 'hideOnline': s.get('showOnline') is False, 'notif': s.get('notif') or {}})

# ===== الغرف ورسايلها =====
for r in docs('rooms'):
    D['rooms'].append({'id': r['_id'], 'name': r.get('name'), 'order': r.get('order') or 0, 'photo': r.get('photo') or '', 'pinned': r.get('pinned')})
    keys = media_of(f"rooms/{r['_id']}", {'room': r['_id']})
    for m in docs(f"rooms/{r['_id']}/messages"):
        if m.get('kind') == 'join': continue
        D['messages'].append({**msg(m, keys), 'room': r['_id'], 'name': (m.get('name') or '')[:30], 'gender': m.get('gender') or ''})

# ===== الخاص =====
for c in docs('chats'):
    a, b = sorted(c.get('members') or c['_id'].split('_'))
    keys = media_of(f"chats/{c['_id']}", {'chat': c['_id']})
    ms = []
    for m in docs(f"chats/{c['_id']}/messages"):
        x = {**msg(m, keys), 'chat': c['_id'], 'key': m['_id']}
        ms.append(x)
    ms.sort(key=lambda x: x['created'] or '')
    D['dms'] += ms
    last = c.get('last')
    if last:
        last = {'uid': last.get('uid'), 'text': last.get('text'), 'at': ts(last.get('at')),
                'key': ms[-1]['key'] if ms and ms[-1]['uid'] == last.get('uid') else None}
    D['chats'].append({'id': c['_id'], 'a': a, 'b': b, 'last': last, 'unread': c.get('unread') or {}, 'readAt': c.get('readAt') or {},
                       'active': c.get('active') or {}, 'updatedAt': ts(c.get('updatedAt')), 'created': ts(c.get('createdAt'))})

# ===== الكوينز =====
wallets = {}
for w in docs('wallets'):
    wallets[w['_id']] = {'id': w['_id'], 'coins': int(w.get('coins') or 0), 'day': int(w.get('day') or 0), 'streak': int(w.get('streak') or 0)}
    for l in docs(f"wallets/{w['_id']}/log"):
        D['coinlog'].append({'owner': w['_id'], 'amount': l.get('amount'), 'kind': l.get('kind'), 'note': l.get('note'), 'created': ts(l.get('at'))})
# الترابيزات اللي لسه شغالة مش هتتنقل: كل اللي دفع دخولية ولسه مارجعتلوش بترجعله
refunds = []
for kind in ('ludo', 'snakes', 'domino'):
    for t in docs(kind):
        fee = t.get('fee') or 0
        if not fee or t.get('status') == 'done' and t.get('winner') not in admins: continue
        for u in t.get('seats') or []:
            if u in admins or (t.get('refunded') or {}).get(u) or u not in wallets: continue
            wallets[u]['coins'] += fee
            refunds.append((u, fee))
            D['coinlog'].append({'owner': u, 'amount': fee, 'kind': 'refund', 'note': 'رجوع دخولية (نقل السيرفر)', 'created': None})
D['wallets'] = list(wallets.values())

# ===== الترتيب =====
for s in docs('scores'):
    D['scores'].append({'id': 'quiz_' + s['_id'], 'board': 'quiz', 'uid': s['_id'], 'name': s.get('name'), 'week': s.get('week'), 'n': s.get('points') or 0})
    if s.get('total'):
        D['scores'].append({'id': 'quizall_' + s['_id'], 'board': 'quizall', 'uid': s['_id'], 'name': s.get('name'), 'week': '', 'n': s['total']})
for kind in ('ludo', 'snakes', 'domino'):
    for s in docs(kind + 'Scores'):
        D['scores'].append({'id': f"{kind}_{s['_id']}", 'board': kind, 'uid': s['_id'], 'name': s.get('name'), 'week': s.get('week'), 'n': s.get('wins') or 0})

# ===== الحظر والكتم والبلاغات =====
for b in docs('bans'):
    D['bans'].append({'id': b['_id'], 'name': b.get('name'), 'reason': b.get('reason'), 'by': b.get('by')})
for x in docs('reports'):
    D['reports'].append({k: x.get(k) for k in ('reporter', 'reported', 'reportedName', 'reason', 'chatId')})
# الكتم والطرد في Firestore جوه كل غرفة
for r in D['rooms']:
    for x in docs(f"rooms/{r['id']}/restrict"):
        D['restrict'].append({'id': f"{r['id']}_{x['_id']}", 'room': r['id'], 'uid': x['_id'], 'type': x.get('type'), 'until': ts(x.get('until')),
                              'name': x.get('name'), 'by': x.get('by'), 'byName': x.get('byName')})

with open(os.path.join(OUT, 'data.json'), 'w') as f:
    json.dump(D, f, ensure_ascii=False)
print(json.dumps({k: len(v) for k, v in D.items() if isinstance(v, list)}), 'mimes:', mimes, 'refunds:', len(refunds))
