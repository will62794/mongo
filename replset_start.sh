#!/bin/sh
n=$1
mongodexe="./build/install/bin/mongod"
setParams="--setParameter enableTestCommands=true --setParameter logComponentVerbosity='{command:0}'"

echo "Killing existing mongod processes."
killall mongod

# Wait for old mongods to die.
sleep 2

# Clean up.
rm -rf logs/*

for i in `seq 0 4`
do
    rm -rf dbdata/test$i
    mkdir -p dbdata/test$i
    $mongodexe --setParameter enableTestCommands=true --fork --pidfilepath /tmp/mongod-node-$i.pid --port 2800$i --dbpath dbdata/test$i --replSet will-replset --logpath logs/node$i.log
done
