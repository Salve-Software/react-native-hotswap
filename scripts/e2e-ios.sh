#!/usr/bin/env bash
# Proves a swap reaches a running app. Needs a booted simulator and a built example.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE="$ROOT/example"
BUNDLE=org.reactjs.native.example.HotswapExample
WORKSPACE="$EXAMPLE/ios/HotswapExample.xcworkspace"
SCHEME=HotswapExample
IOS_PORT=8100
DERIVED=${DERIVED:-$EXAMPLE/ios/build}
VALUES="$EXAMPLE/probe/ios/ProbeValues.swift"
NATIVE="$EXAMPLE/probe/cpp/probe.cpp"
BORN="$EXAMPLE/probe/ios/BornAtRuntime.swift"
METRO_LOG=${METRO_LOG:-$(mktemp)}
# os_log is a stream, not a buffer that can be asked after the fact the way logcat can,
# so a reader is left running and the assertions read what it has collected.
PROBE_LOG=$(mktemp)
FAILED=0

cleanup() {
  [ -n "${METRO_PID:-}" ] && kill "$METRO_PID" 2>/dev/null || true
  [ -n "${LOG_PID:-}" ] && kill "$LOG_PID" 2>/dev/null || true
  rm -f "$BORN"
  git -C "$ROOT" checkout -- "$VALUES" "$NATIVE" 2>/dev/null || true
}
trap cleanup EXIT

say() { printf '\n== %s\n' "$1"; }
fail() { printf '   FAIL  %s\n' "$1"; FAILED=1; }
pass() { printf '   ok    %s\n' "$1"; }

await() {
  local what=$1 seconds=$2 check=$3 waited=0
  while ! eval "$check" >/dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge "$seconds" ]; then
      fail "$what did not happen in ${seconds}s"
      return 1
    fi
  done
  return 0
}

# `sed -i` drops a sibling temp file into the watched tree and the watcher reports it,
# so the edit goes through a temp outside the tree and lands as one write.
edit() {
  local file=$1 pattern=$2 replacement=$3 tmp
  tmp=$(mktemp)
  sed "s/$pattern/$replacement/" "$file" >"$tmp"
  cat "$tmp" >"$file"
  rm -f "$tmp"
}

probe() { grep "\[Probe\]" "$PROBE_LOG" 2>/dev/null | tail -1; }
pid_of() { xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | awk -v b="$BUNDLE" '$3 ~ b {print $1; exit}'; }
swaps() {
  local n
  n=$(grep -cE '✅|♻️' "$METRO_LOG" 2>/dev/null) || n=0
  printf '%s' "$n"
}

UDID=${UDID:-$(xcrun simctl list devices available -j | python3 -c "
import json,sys
for _, devices in json.load(sys.stdin)['devices'].items():
    for device in devices:
        if device.get('state') == 'Booted':
            print(device['udid']); sys.exit()
")}
[ -n "$UDID" ] || { fail "no booted simulator"; exit 1; }

say "building the example"
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Debug \
  -sdk iphonesimulator -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED" build >/tmp/e2e-ios-build.log 2>&1 \
  || { fail "the build failed, see /tmp/e2e-ios-build.log"; tail -20 /tmp/e2e-ios-build.log; exit 1; }

APP="$DERIVED/Build/Products/Debug-iphonesimulator/$SCHEME.app"
[ -d "$APP" ] || { fail "no app at $APP"; exit 1; }
pass "built $SCHEME.app"

say "starting metro with the watcher"
(cd "$EXAMPLE" && node node_modules/.bin/react-native start >"$METRO_LOG" 2>&1) &
METRO_PID=$!
await "metro" 180 "grep -q 'hotswap  watching' '$METRO_LOG'" || exit 1
await "the dev server" 180 "grep -q 'Dev server ready' '$METRO_LOG'" || exit 1
pass "watcher is up"

say "launching the app"
xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
xcrun simctl spawn "$UDID" log stream --style compact \
  --predicate 'eventMessage CONTAINS "[Probe]" OR eventMessage CONTAINS "Hotswap"' >"$PROBE_LOG" 2>&1 &
LOG_PID=$!
sleep 3
xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null

await "the agent listening" 180 "nc -z -w2 127.0.0.1 $IOS_PORT" || exit 1
pass "agent is listening on $IOS_PORT"
await "the probe reporting" 120 "probe | grep -q swift=" || exit 1

BEFORE_PID=$(pid_of)
pass "app is $BUNDLE, pid $BEFORE_PID"

say "patching swift"
COUNT=$(swaps)
edit "$VALUES" 'return 1$' 'return 424242'
# The warm build is still capturing the compile when this lands, so the first save waits it out.
await "a swap" 600 "[ \$(grep -cE '✅|♻️' '$METRO_LOG') -gt $COUNT ]" || exit 1
await "swift=424242 on the device" 60 "probe | grep -q swift=424242" \
  && pass "swift=424242 reached the app" || fail "the value never changed: $(probe)"

say "patching c++"
COUNT=$(swaps)
edit "$NATIVE" 'int Probe::shape() { return [0-9]*; }' 'int Probe::shape() { return 31337; }'
await "a swap" 300 "[ \$(grep -cE '✅|♻️' '$METRO_LOG') -gt $COUNT ]" || exit 1
await "shape=31337 on the device" 60 "probe | grep -q shape=31337" \
  && pass "shape=31337 reached the app" || fail "the value never changed: $(probe)"

# Android has to publish a whole new generation to reach a class the apk never had.
# iOS does not: the recompiled dylib carries the new class, so this arrives as an
# ordinary patch. What has to be true on both is that the class runs.
say "reaching a class the app never had"
cat > "$BORN" <<'SWIFT'
import Foundation

@objc public class BornAtRuntime: NSObject {

  @objc public func value() -> Int {
    return 777777
  }
}
SWIFT
sleep 8
COUNT=$(swaps)
edit "$VALUES" 'return 424242' 'return BornAtRuntime().value()'
await "a swap" 300 "[ \$(grep -cE '✅|♻️' '$METRO_LOG') -gt $COUNT ]" || exit 1
await "swift=777777 on the device" 90 "probe | grep -q swift=777777" \
  && pass "a class the app never had is running" || fail "it never reached the app: $(probe)"

say "checking the process never restarted"
AFTER_PID=$(pid_of)
if [ "$BEFORE_PID" = "$AFTER_PID" ]; then
  pass "same pid throughout: $AFTER_PID"
else
  fail "the app restarted: $BEFORE_PID then $AFTER_PID"
fi

say "what the watcher reported"
grep -E '✅|❌|↻|♻️|⛔' "$METRO_LOG" | tail -8 || true

[ "$FAILED" -eq 0 ] && { printf '\nall of it swapped\n'; exit 0; }
printf '\nsomething did not swap\n'
exit 1
