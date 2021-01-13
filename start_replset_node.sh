#!/bin/sh
n=$1
./build/install/bin/mongod --setParameter enableTestCommands=true --setParameter logComponentVerbosity='{command:0}' --port 2800$n --dbpath dbdata/test$n --replSet will-replset | tee node$n.log
