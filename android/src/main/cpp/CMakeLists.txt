cmake_minimum_required(VERSION 3.22.1)
project(hotswap)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(hotswap SHARED agent.cpp native_swap.cpp)

# The NDK ships jni.h but not jvmti.h, so the ART header is vendored in.
target_include_directories(hotswap PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/vendor)

find_library(log-lib log)
target_link_libraries(hotswap ${log-lib})
