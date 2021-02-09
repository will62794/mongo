#
# Run the standard Raft reconfiguration experiment.
#

# Kill old mongods and wait for them to die.
echo "Killing mongods and waiting for them to die..."
killall mongod
sleep 10

# Run logless experiment.
echo "### Running 'standard Raft' reconfiguration experiment. ###"
./replset_start.sh
python3 reconfig_perf.py standardraft

# Kill mongods and wait for them to die.
echo "Killing mongods after experiment completed."
killall mongod

# Re-generate graphs from the recorded data.
echo "Creating graphs."
cd graphs
./makegraphs.sh
