cmake_minimum_required(VERSION 3.22.1)
project(probe)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(probe SHARED
        src/main/cpp/jni.cpp
        ../cpp/probe.cpp
)

target_include_directories(probe PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../cpp)

find_library(log-lib log)
target_link_libraries(probe ${log-lib})
