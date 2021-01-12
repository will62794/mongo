#!/bin/sh
export SCONSFLAGS='--disable-warnings-as-errors'
python3 buildscripts/scons.py CC=/usr/bin/clang CXX=/usr/bin/clang++ -j4 --implicit-cache --cache=nolinked --use-libunwind=off install-mongod
