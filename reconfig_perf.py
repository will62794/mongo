import pymongo
import time
import threading
import sys

def avg(vals):
    return sum(vals)/float(len(vals))

# Parse command line argument.
# Pass either 'logless' or 'standardraft' as arguments to determine which test to run.
TESTARG = None
if len(sys.argv)<2:
    print("Missing argument.\nUsage: \n\t python reconfig_perf.py <'logless'|'standardraft'>")
    exit(0)
else:
    TESTARG = sys.argv[1]
    if TESTARG not in ["logless", "standardraft"]:
        print("Error: unknown argument: '%s'" % TESTARG)
        exit(0)

#
# Initiate the replica set first if it has not already been initiated.
#

client = pymongo.MongoClient('localhost', 28000)
res = client.admin.command("ismaster")
if "setName" not in res:
    initConfig = {'_id': 'will-replset', 'members': [
        {'_id': 0, 'host': 'localhost:28000'},
        {'_id': 1, 'host': 'localhost:28001'},
        {'_id': 2, 'host': 'localhost:28002'},
        {'_id': 3, 'host': 'localhost:28003'},
        {'_id': 4, 'host': 'localhost:28004'}]}
    res = client.admin.command("replSetInitiate", initConfig)

# Connect with a replset connection.
client = pymongo.MongoClient('localhost', 28000, replicaset='will-replset')

db_name = "test-db"
coll_name = "test-coll"

# Remove all documents from the test collection.
print("Removing all documents from '%s.%s'" % (db_name, coll_name))
client[db_name][coll_name].delete_many({})

# Retrieve the current configuration.
res = client.admin.command("replSetGetConfig")
config = res["config"]

# Make all secondaries unelectable.
for mi in [1,2,3,4]:
    config["members"][mi]["priority"] = 0

# The heartbeat interval to set initially.
heartbeatIntervalMS = 2000

settings = config["settings"]
settings["heartbeatIntervalMillis"] = heartbeatIntervalMS
config["version"] = config["version"] + 1
config["settings"] = settings
print("*** initial reconfig")
res = client.admin.command("replSetReconfig", config)
assert res["ok"] == 1.0

def write_thread(time_limit_secs, tag, killEv):
    """ 
    Starts up a thread that connects to server and continually inserts documents into
    a test collection with w:majority. Records the latency of each write and writes it to a file when
    the thread terminates. Keeps running until it is killed by external event.
    """
    client = pymongo.MongoClient('localhost', 28000)
    write_latencies = []
    db = client[db_name]
    collection = db[coll_name]
    collection = collection.with_options(write_concern=pymongo.WriteConcern(w="majority",wtimeout=100))
    
    # Constants for recording whether a write succeeded or timed out.
    WRITE_ACK = 1
    WRITE_TIMEOUT = 0 
    payload = "a"*1024
    i=0
    tbegin = time.time() 
    while not killEv.is_set():
        doc = {"x": i, "data": payload}
        curr_time = time.time()-tbegin
        write_start_time = time.time()
        try:
            res = collection.insert_one(doc)
            assert res.acknowledged
            latencyMS = (time.time() - write_start_time) * 1000.0
            write_latencies.append((curr_time,latencyMS, WRITE_ACK))
            if i%20 == 0:
                print("w:majority write latency: %d ms" % latencyMS)
        except pymongo.errors.WTimeoutError as e:
            # Capture timeout errors as well and record their latency.
            latencyMS = (time.time() - write_start_time) * 1000.0
            write_latencies.append((curr_time,latencyMS, WRITE_TIMEOUT))
            print("w:majority write TIMEOUT: %d ms" % latencyMS)
        i+=1

    # Save the write latencies to a file, one per row.
    fname = "graphs/write-latencies-%s.csv" % tag
    f = open(fname, 'w')
    for (t,l,res) in write_latencies:
        f.write(str(t)+","+str(l)+","+str(res))
        f.write("\n")
    f.close()

# Introduce simulated degradation by stopping replication on two 
# voting secondaries and then restarting it after a few seconds.
def fault_injector_thread(degrade_secs, ports):
    # Simulate a period of degradation.
    for port in ports:
        print("Simulating replication degradation on node %d" % port)
        nclient = pymongo.MongoClient('localhost', port)
        res = nclient.admin.command({"configureFailPoint": 'rsSyncApplyStop', "mode": 'alwaysOn'})
        assert res["ok"] == 1.0

    print("Degradation beginning for %d secs" % degrade_secs)
    time.sleep(degrade_secs)

    for port in ports:
        print("Ending replication degradation on node %d" % port)
        nclient = pymongo.MongoClient('localhost', port)
        res = nclient.admin.command({"configureFailPoint": 'rsSyncApplyStop', "mode": 'off'})
        assert res["ok"] == 1.0
    print("Degradation period over.")


# Run the experiment for this much time.
TOTAL_DURATION_SECS = 60
# How much time elapses between degraded modes.
BETWEEN_DEGRADED_SECS = 5
# How long degraded period lasts.
DEGRADE_DURATION_SECS = 2.5
# How long we simulate that it takes for the system to detect a degradation.
DETECT_DEGRADE_SECS = 0.5

def reconfig_test(enableRaftBehavior, tag):
    """ The main experiment. """

    # Disable any previous failpoints.
    print("Disabling previous failpoints.")
    for i in [0,1,2,3,4]:
        nclient = pymongo.MongoClient('localhost', 28000 + i)
        res = nclient.admin.command({"configureFailPoint": 'rsSyncApplyStop', "mode": 'off'})
        assert res["ok"] == 1.0

    primaryclient = pymongo.MongoClient('localhost', 28000)
    
    # Verify the primary.
    res = primaryclient.admin.command("ismaster")
    assert res["ismaster"]

    # Set the failpoint that simulates Raft behavior, if needed.
    failpoint_setting = "alwaysOn" if enableRaftBehavior else "off"
    res = primaryclient.admin.command({"configureFailPoint": 'enableMajorityNoopWriteOnReconfig', "mode": failpoint_setting})
    assert res["ok"] == 1.0

    #
    # Make sure that n1 and n2 initally have votes and that n3 and n4 do not.
    #
    for mi in [1,2]:
        config["version"] = config["version"] + 1
        config["members"][mi]["votes"] = 1
        res = client.admin.command("replSetReconfig", config)
        assert res["ok"] == 1.0

    for mi in [3,4]:
        config["version"] = config["version"] + 1
        config["members"][mi]["votes"] = 0
        res = client.admin.command("replSetReconfig", config)
        assert res["ok"] == 1.0

    # Start the writer threads.
    writerKillEv = threading.Event()
    print("Starting writer thread.")
    writerThread = threading.Thread(target=write_thread, args=(TOTAL_DURATION_SECS,tag,writerKillEv))
    writerThread.start()

    # Create file for saving fault events.
    fname = "graphs/fault-events-%s.csv" % tag
    f = open(fname, 'w')
    f.close()

    iteration = 0
    start_time = time.time()
    degraded_nodes = [1,2]
    healthy_nodes = [3,4]
    STATE_STEADY = 0
    STATE_DEGRADED = 1
    fault_events = [(0, STATE_STEADY)]
    reconfig_events = []
    while (time.time()-start_time) < TOTAL_DURATION_SECS:

        # Let the system run for N seconds, then introduce slowness on the 
        # secondaries by pausing replication temporarily.
        time.sleep(BETWEEN_DEGRADED_SECS)

        # Run the fault injection thread.
        degraded_ports = [28000+n for n in degraded_nodes]
        faultInjectorThread = threading.Thread(target=fault_injector_thread,args=(DEGRADE_DURATION_SECS,degraded_ports,))
        faultInjectorThread.start()

        fault_events.append((time.time()-start_time, STATE_DEGRADED))

        # Simulate quick failure detection.
        print("Simulated wait to detect degradation.")
        time.sleep(DETECT_DEGRADE_SECS)

        EVENT_RECONFIG_ADD_HEALTHY = 4
        EVENT_RECONFIG_REMOVE_DEGRADED = 4
        # Now reconfigure to add in two healthy nodes.
        print("Degradation detected. Trying to add two new healthy nodes.")
        for mi in healthy_nodes:
            config["version"] = config["version"] + 1
            config["members"][mi]["votes"] = 1
            start = time.time()
            res = client.admin.command("replSetReconfig", config)
            durationMS = (time.time() - start) * 1000
            if res["ok"] == 1.0:
                print("*** reconfig added healthy node %d in %f ms" % (mi, durationMS))
                # Record the successful reconfig.
                reconfig_events.append((time.time()-start_time, EVENT_RECONFIG_ADD_HEALTHY))

        # Remove the degraded nodes.
        print("Removing the nodes that were degraded.")
        for mi in degraded_nodes:
            config["version"] = config["version"] + 1
            config["members"][mi]["votes"] = 0
            start = time.time()
            res = client.admin.command("replSetReconfig", config)
            durationMS = (time.time() - start) * 1000
            if res["ok"] == 1.0:
                print("*** reconfig removed degraded node %d in %f ms" % (mi, durationMS))
                reconfig_events.append((time.time()-start_time, EVENT_RECONFIG_REMOVE_DEGRADED))

        # Wait until degraded period has ended.
        faultInjectorThread.join()

        fault_events.append((time.time()-start_time, STATE_STEADY))

        # Wait for degration to clear up, and then remove the
        # originally degraded nodes.
        # time.sleep(0.5)



        # Swap the set of healthy nodes and degraded nodes for the next iteration.
        degraded_nodes, healthy_nodes = healthy_nodes, degraded_nodes

    # Shut down the writer thread and wait for it to finish.
    writerKillEv.set()
    writerThread.join()

    print("Saving event data points to files.")

    # Create file for saving fault events.
    fname = "graphs/fault-events-%s.csv" % tag
    f = open(fname, 'w')
    for (t,e) in fault_events:
        f.write(str(t)+","+str(e))
        f.write("\n")
    f.close()

    # Create file for saving reconfig events.
    fname = "graphs/reconfig-events-%s.csv" % tag
    f = open(fname, 'w')
    for (t,e) in reconfig_events:
        f.write(str(t)+","+str(e))
        f.write("\n")
    f.close()

#
# Run the experiment, based on command line argument passed.
#
if TESTARG == "logless":
    reconfig_test(False, TESTARG)
if TESTARG == "standardraft":
    reconfig_test(True, TESTARG)

# reconfig_test(False, "logless")
# reconfig_test(True, "standardraft")
