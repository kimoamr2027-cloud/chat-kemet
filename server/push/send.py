#!/usr/bin/env python3
"""بيبعت إشعار لموبايلات عضو (Web Push). PocketBase بيناديه ويديله ملف JSON:
{"subs": [{"id", "endpoint", "keys": {"p256dh", "auth"}}], "payload": {...}}
وبيطبع {"sent": n, "gone": [ids]} (الاشتراكات اللي اتلغت من الموبايل علشان تتمسح)."""
import json, os, sys
from pywebpush import webpush, WebPushException

d = os.environ.get('KEMET_PUSH_DIR', '/opt/kemet/push')
job = json.load(open(sys.argv[1]))
sent, gone = 0, []
for s in job.get('subs', []):
    try:
        webpush(subscription_info={'endpoint': s['endpoint'], 'keys': s['keys']},
                data=json.dumps(job['payload'], ensure_ascii=False),
                vapid_private_key=os.path.join(d, 'vapid.pem'),
                vapid_claims={'sub': 'https://kimoamr2027-cloud.github.io'},
                ttl=86400, timeout=10)
        sent += 1
    except WebPushException as e:
        code = e.response.status_code if e.response is not None else 0
        if code in (404, 410):
            gone.append(s['id'])
    except Exception:
        pass
print(json.dumps({'sent': sent, 'gone': gone}))
