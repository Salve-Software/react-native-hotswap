#pragma once

// Edit this and every translation unit that includes it is swapped.
constexpr int PROBE_BASE = 10;

struct Probe {
  virtual ~Probe();
  virtual int shape();
};

int probeValue();
