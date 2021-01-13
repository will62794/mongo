import pymongo
import time
import threading

def avg(vals):
    return sum(vals)/float(len(vals))

client = pymongo.MongoClient('localhost', 28000)

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

#
# Artificially delay secondaries to simulate slowness in the oplog replication
# pipeline. We then set up a series of concurrent writer threads, which continually
# insert documents into a collection, and a reconfig thread that runs concurrently. The
# reconfig thread repeatedly executes reconfigurations to go from C5 -> C4 -> C3 -> C4 -> C5
# in a loop, where:
#
#   C5 = {n0,n1,n2,n3,n4} 
#   C4 = {n0,n1,n2,n3}
#   C3 = {n0,n1,n2}
#
# We measure reconfiguration throughput over some fixed period of execution time. The expectation
# is that standard Raft reconfig, which requires the latest op on a primary to be committed
# in the new config, pays an extra cost for replicating these writes unnecessarily, which should
# show up in the reconfiguration throughput metrics.
#
#

def write_thread(k):
    client = pymongo.MongoClient('localhost', 28000)
    db = client[db_name]
    collection = db[coll_name]
    for i in range(500):
        doc = {"tid": k, "x": i}
        res = collection.insert_one(doc)
        # print(doc)
        assert res.acknowledged

res = client.admin.command("replSetGetConfig")
config = res["config"]

# Set heartbeat interval.
heartbeatIntervalMS = 2000 # milliseconds.

# Use slave delay to simulate lagged secondaries and give them priority:0 so they cannot
# be elected.
for mi in [1,2,3,4]:
    config["members"][mi]["slaveDelay"] = 0
    config["members"][mi]["priority"] = 0

settings = config["settings"]
settings["heartbeatIntervalMillis"] = heartbeatIntervalMS
config["version"] = config["version"] + 1
config["settings"] = settings
print("*** reconfig to set heartbeat interval to %dms" % heartbeatIntervalMS)
res = client.admin.command("replSetReconfig", config)
assert res["ok"] == 1.0

# Start writer threads.
nWriters = 5
writers = []
for tid in range(nWriters):
    print("Starting writer thread %d" % tid)
    t = threading.Thread(target=write_thread, args=(tid,))
    t.start()
    writers.append(t)

time.sleep(0.5)

reconfig_latencies = []
time_limit_secs = 10
tbegin = time.time() 
while (time.time()-tbegin) < time_limit_secs:
    config["version"] = config["version"] + 1
    print("*** starting reconfig to version " + str(config["version"]))
    start = time.time()
    res = client.admin.command("replSetReconfig", config)
    # time.sleep(0.010)

    durationMS = (time.time() - start) * 1000
    reconfig_latencies.append(durationMS)
    if res["ok"] == 1.0:
        print("*** reconfig success in %f ms" % durationMS)
        # Print bar representing duration.
        bar_len = int(durationMS/3)
        print("+"*bar_len)

print("Mean reconfig latency: %d ms" % avg(reconfig_latencies))

for w in writers:
    w.join()