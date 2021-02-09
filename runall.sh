#!/bin/sh

#
# Run all the experiments for comparing "logless" and "standard Raft" reconfiguration.
# We restart the replica set with a clean dbpath before running each experiment.

# Kill old mongods and wait for them to die.
echo "Killing mongods and waiting for them to die..."
killall mongod
sleep 10

# Run standard Raft experiment.
echo "##########################################################"
echo "### Running 'standard Raft' reconfiguration experiment. ##"
echo "##########################################################"
./replset_start.sh
python3 reconfig_perf.py standardraft

# Kill mongods and wait for them to die.
echo "Killing mongods and waiting for them to die..."
killall mongod
sleep 10

# Run logless experiment.
echo "#####################################################"
echo "### Running 'logless' reconfiguration experiment. ###"
echo "#####################################################"
./replset_start.sh
python3 reconfig_perf.py logless

# Shut down the mongods after running the experiment.
killall mongod

# Re-generate graphs from the recorded data.
echo "Creating graphs."
cd graphs
./makegraphs.sh

