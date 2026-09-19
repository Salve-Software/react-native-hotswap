#!/usr/bin/env bash
# Proves a swap reaches a running app. Needs a device on adb and a built example.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE="$ROOT/example"
PACKAGE=com.hotswapexample
VALUES="$EXAMPLE/probe/android/src/main/java/com/probe/ProbeValues.kt"
NATIVE="$EXAMPLE/probe/cpp/probe.cpp"
BORN="$EXAMPLE/probe/android/src/main/java/com/probe/BornAtRuntime.kt"
METRO_LOG=${METRO_LOG:-$(mktemp)}
FAILED=0

cleanup() {
  if [ "$FAILED" -ne 0 ] || [ -n "${DYING:-}" ]; then
    printf '\n== what metro was doing\n'
    tail -40 "$METRO_LOG" 2>/dev/null | sed 's/^/   /' || true
  fi

  [ -n "${METRO_PID:-}" ] && kill "$METRO_PID" 2>/dev/null || true
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
# so the edit goes through a temp outside the tree and lands as one rename.
edit() {
  local file=$1 pattern=$2 replacement=$3 tmp
  tmp=$(mktemp)
  sed "s/$pattern/$replacement/" "$file" >"$tmp"
  cat "$tmp" >"$file"
  rm -f "$tmp"
}

# Counting any swap lets a duplicate event from the previous step satisfy the wait
# before this file has swapped at all, so the assertion that follows fails for the
# wrong reason. The watcher does emit duplicates.
swaps_of() {
  local file=$1 n
  n=$(grep -E '✅|♻️' "$METRO_LOG" 2>/dev/null | grep -c "$file") || n=0
  printf '%s' "$n"
}

probe() { adb logcat -d -s Probe 2>/dev/null | grep "kotlin=" | tail -1; }
pid_of() { adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r'; }

say "installing the example"
(cd "$EXAMPLE/android" && ./gradlew :app:installDebug --no-daemon -q)

say "starting metro with the watcher"
(cd "$EXAMPLE" && node node_modules/.bin/react-native start >"$METRO_LOG" 2>&1) &
METRO_PID=$!
await "metro" 240 "grep -q 'hotswap  watching' '$METRO_LOG'" || { DYING=1; exit 1; }
await "the dev server" 240 "grep -q 'Dev server ready' '$METRO_LOG'" || { DYING=1; exit 1; }
pass "watcher is up"

adb reverse tcp:8081 tcp:8081 >/dev/null
adb forward tcp:8099 tcp:8099 >/dev/null

say "launching the app"
adb shell am force-stop "$PACKAGE" || true
adb logcat -c 2>/dev/null || true
adb shell am start -n "$PACKAGE/.MainActivity" >/dev/null
await "the agent attaching" 180 "adb logcat -d -s Hotswap | grep -q listening" || { DYING=1; exit 1; }
pass "agent is listening"
await "the probe reporting" 120 "probe | grep -q kotlin=" || { DYING=1; exit 1; }

BEFORE_PID=$(pid_of)
pass "app is $PACKAGE, pid $BEFORE_PID"

say "patching kotlin"
COUNT=$(swaps_of ProbeValues.kt)
edit "$VALUES" 'fun value(): Int = .*' 'fun value(): Int = 424242'
# The warm build is still compiling when this lands, so the first save waits it out.
await "a swap of ProbeValues.kt" 600 "[ \$(swaps_of ProbeValues.kt) -gt $COUNT ]" || { DYING=1; exit 1; }
await "kotlin=424242 on the device" 60 "probe | grep -q kotlin=424242" \
  && pass "kotlin=424242 reached the app" || fail "the value never changed: $(probe)"

say "patching c++"
COUNT=$(swaps_of probe.cpp)
edit "$NATIVE" 'int Probe::shape() { return [0-9]*; }' 'int Probe::shape() { return 31337; }'
await "a swap of probe.cpp" 300 "[ \$(swaps_of probe.cpp) -gt $COUNT ]" || { DYING=1; exit 1; }
await "shape=31337 on the device" 60 "probe | grep -q shape=31337" \
  && pass "shape=31337 reached the app" || fail "the value never changed: $(probe)"

say "publishing a generation"
cat > "$BORN" <<'KOTLIN'
package com.probe

internal object BornAtRuntime {

  fun value(): Int = 777777
}
KOTLIN
sleep 8
edit "$VALUES" 'fun value(): Int = .*' 'fun value(): Int = BornAtRuntime.value()'
await "a generation of ProbeValues.kt" 300 "grep '♻️' '$METRO_LOG' | grep -q BornAtRuntime" || { DYING=1; exit 1; }
await "kotlin=777777 on the device" 90 "probe | grep -q kotlin=777777" \
  && pass "a class the apk never had is running" || fail "the generation never reached it: $(probe)"

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
