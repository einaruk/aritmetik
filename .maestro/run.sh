#!/usr/bin/env bash
# CI'da emülatör açıkken çalışır: APK'yı kurar, akışları koşar.
set -euo pipefail
maestro --version
adb install -r aritmetik.apk
adb shell dumpsys package com.google.android.webview | grep -m1 versionName || true
mkdir -p maestro-out
maestro test .maestro/aritmetik.yaml --format junit --output maestro-out/rapor.xml
