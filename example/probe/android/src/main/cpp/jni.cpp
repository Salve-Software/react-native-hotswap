#include <jni.h>

#include "probe.hpp"

namespace {
Probe* shared = new Probe();
}

extern "C" JNIEXPORT jint JNICALL
Java_com_probe_ProbeNative_cppValue(JNIEnv*, jobject) {
  return probeValue();
}

extern "C" JNIEXPORT jint JNICALL
Java_com_probe_ProbeNative_cppShape(JNIEnv*, jobject) {
  return shared->shape();
}
