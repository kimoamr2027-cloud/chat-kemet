#!/usr/bin/env python3
"""مفاتيح VAPID لإشعارات الموبايل (بتتعمل مرة واحدة على السيرفر).
المفتاح الخاص بيفضل على السيرفر، والعام بيروح للتطبيق علشان يشترك."""
import base64, os, sys
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

d = sys.argv[1] if len(sys.argv) > 1 else '/opt/kemet/push'
os.makedirs(d, exist_ok=True)
pem, pub = os.path.join(d, 'vapid.pem'), os.path.join(d, 'vapid.pub')
if not os.path.exists(pem):
    k = ec.generate_private_key(ec.SECP256R1())
    with open(pem, 'wb') as f:
        f.write(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    os.chmod(pem, 0o600)
    raw = k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    with open(pub, 'w') as f:
        f.write(base64.urlsafe_b64encode(raw).decode().rstrip('='))
print(open(pub).read())
