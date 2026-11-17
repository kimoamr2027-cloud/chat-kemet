#!/bin/bash
# الكود ده بيتحط في "Initialization script" وانت بتعمل السيرفر في Oracle
curl -fsSL https://raw.githubusercontent.com/kimoamr2027-cloud/chat-kemet/main/server/setup.sh -o /root/kemet-setup.sh && bash /root/kemet-setup.sh > /var/log/kemet-setup.log 2>&1
