import pymongo
import time
import threading

def avg(vals):
    return sum(vals)/float(len(vals))

client = pymongo.MongoClient('localhost', 28000)

# Disable any previous failpoints.
print("Disabling previous failpoints.")
for i in [0,1,2,3,4]:
    nclient = pymongo.MongoClient('localhost', 28000 + i)
    res = nclient.admin.command({"configureFailPoint": 'rsSyncApplyStop', "mode": 'off'})
    assert res["ok"] == 1.0

res = client.admin.command("ismaster")
print(res)

if "setName" not in res:
    # Initiate the replica set first.
    initConfig = {'_id': 'will-replset', 'members': [
        {'_id': 0, 'host': 'localhost:28000'},
        {'_id': 1, 'host': 'localhost:28001'},
        {'_id': 2, 'host': 'localhost:28002'},
        {'_id': 3, 'host': 'localhost:28003'},
        {'_id': 4, 'host': 'localhost:28004'}]}
    res = client.admin.command("replSetInitiate", initConfig)

client = pymongo.MongoClient('localhost', 28000, replicaset='will-replset')

db_name = "test-db"
coll_name = "test-coll"

# Remove all documents from test collection.
print("Removing all documents from '%s.%s'" % (db_name, coll_name))
db = client[db_name][coll_name].delete_many({})

def write_thread(k, time_limit_secs):
    client = pymongo.MongoClient('localhost', 28000)
    write_latencies = []
    db = client[db_name]
    collection = db[coll_name]
    collection = collection.with_options(write_concern=pymongo.WriteConcern(w="majority",wtimeout=100))
    longStr = "a"*1024
    i=0
    tbegin = time.time() 
    while (time.time()-tbegin) < time_limit_secs:
        doc = {"tid": k, "x": i, "data": longStr}
        currtime = time.time()-tbegin
        start = time.time()
        try:
            res = collection.insert_one(doc)
            assert res.acknowledged
            latencyMS = (time.time() - start) * 1000.0
            write_latencies.append((currtime,latencyMS))
            if i%10 == 0:
                print("w:majority write latency: %d ms" % latencyMS)
        except pymongo.errors.WTimeoutError as e:
                latencyMS = (time.time() - start) * 1000.0
                write_latencies.append((currtime,latencyMS))
                print("w:majority write TIMEOUT: %d ms" % latencyMS)
        i+=1

    # Save the write latencies to a file, one per row.
    f = open("write-latencies.csv", 'w')
    for (t,l) in write_latencies:
        f.write(str(t)+","+str(l))
        f.write("\n")
    f.close()

res = client.admin.command("replSetGetConfig")
config = res["config"]

# Set heartbeat interval.
heartbeatIntervalMS = 2000 # milliseconds.

# Make secondaries unelectable
for mi in [1,2,3,4]:
    config["members"][mi]["priority"] = 0

settings = config["settings"]
settings["heartbeatIntervalMillis"] = heartbeatIntervalMS
config["version"] = config["version"] + 1
config["settings"] = settings
print("*** initial reconfig")
res = client.admin.command("replSetReconfig", config)
assert res["ok"] == 1.0

# Remove votes from n3 and n4.
for mi in [3,4]:
    config["version"] = config["version"] + 1
    config["members"][mi]["votes"] = 0
    res = client.admin.command("replSetReconfig", config)
    assert res["ok"] == 1.0

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

#
# EXPERIMENT BEGINS.
#

# Run the experiment for this much time.
TOTAL_DURATION_SECS = 20
# How much time elapses between degraded modes.
BETWEEN_DEGRADED_SECS = 5
# How long degraded period lasts.
DEGRADE_DURATION_SECS = 2.5
# How long we simulate that it takes for the system to detect a degradation.
DETECT_DEGRADE_SECS = 0.5

# Start the writer threads.
nWriters = 1
writers = []
# TODO: Pass experiment duration to the writers.
for tid in range(nWriters):
    print("Starting writer thread %d" % tid)
    t = threading.Thread(target=write_thread, args=(tid,TOTAL_DURATION_SECS,))
    t.start()
    writers.append(t)

iteration = 0
start_time = time.time()
degraded_nodes = [1,2]
healthy_nodes = [3,4]
while (time.time()-start_time) < TOTAL_DURATION_SECS:


    # Let the system run for N seconds, then introduce slowness on the 
    # secondaries by pausing replication temporarily.
    time.sleep(BETWEEN_DEGRADED_SECS)

    # Run the fault injection thread.

    degraded_ports = [28000+n for n in degraded_nodes]
    tfault = threading.Thread(target=fault_injector_thread,args=(DEGRADE_DURATION_SECS,degraded_ports,))
    tfault.start()

    # Simulate quick failure detection.
    print("Simulated wait to detect degradation.")
    time.sleep(DETECT_DEGRADE_SECS)

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

    # Wait until degraded period has ended.
    tfault.join()

    # Remove the previously degraded nodes.
    print("Removing the nodes that were degraded.")
    for mi in degraded_nodes:
        config["version"] = config["version"] + 1
        config["members"][mi]["votes"] = 0
        start = time.time()
        res = client.admin.command("replSetReconfig", config)
        durationMS = (time.time() - start) * 1000
        if res["ok"] == 1.0:
            print("*** reconfig removed degraded node %d in %f ms" % (mi, durationMS))
    
    # Now swap the set of healthy nodes and degraded nodes for the next iteration.
    degraded_nodes, healthy_nodes = healthy_nodes, degraded_nodes

for w in writers:
    w.join()