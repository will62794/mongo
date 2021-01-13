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

def write_thread(k):
    client = pymongo.MongoClient('localhost', 28000)
    db = client[db_name]
    collection = db[coll_name]
    collection = collection.with_options(write_concern=pymongo.WriteConcern(w="majority",wtimeout=100))
    longStr = "a"*1024
    time_limit_secs = 10
    i=0
    tbegin = time.time() 
    while (time.time()-tbegin) < time_limit_secs:
        doc = {"tid": k, "x": i, "data": longStr}
        start = time.time()
        try:
            res = collection.insert_one(doc)
            assert res.acknowledged
            latencyMS = (time.time() - start) * 1000.0
            if i%10 == 0:
                print("w:majority write latency: %d ms" % latencyMS)
        except pymongo.errors.WTimeoutError as e:
                latencyMS = (time.time() - start) * 1000.0
                print("w:majority write TIMEOUT: %d ms" % latencyMS)
        i+=1


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
print("*** initial reconfig")
res = client.admin.command("replSetReconfig", config)
assert res["ok"] == 1.0

# Remove votes from n3 and n4.
for mi in [3,4]:
    config["version"] = config["version"] + 1
    config["members"][mi]["votes"] = 0
    res = client.admin.command("replSetReconfig", config)
    assert res["ok"] == 1.0

# Start writer threads.
nWriters = 1
writers = []
for tid in range(nWriters):
    print("Starting writer thread %d" % tid)
    t = threading.Thread(target=write_thread, args=(tid,))
    t.start()
    writers.append(t)

time.sleep(0.5)

# Let the system run for N seconds, then introduce slowness on the 
# secondaries by adding a slave delay.
time.sleep(4)

# Introduce simulated degradation by stopping replication on two 
# voting secondaries and then restarting it after a few seconds.
def fault_injector_thread():
    print("Simulating replication degradation on n1 and n2")
    n1client = pymongo.MongoClient('localhost', 28001)
    n2client = pymongo.MongoClient('localhost', 28002)

    # Simulate a period of degradation.
    res = n1client.admin.command({"configureFailPoint": 'rsSyncApplyStop', "mode": 'alwaysOn'})
    assert res["ok"] == 1.0
    res = n2client.admin.command({"configureFailPoint": 'rsSyncApplyStop', "mode": 'alwaysOn'})
    assert res["ok"] == 1.0
    downTimeSecs = 3
    print("Degradation beginning for %d secs" % downTimeSecs)
    time.sleep(downTimeSecs)

    res = n1client.admin.command({"configureFailPoint": 'rsSyncApplyStop', "mode": 'off'})
    assert res["ok"] == 1.0
    res = n2client.admin.command({"configureFailPoint": 'rsSyncApplyStop', "mode": 'off'})
    assert res["ok"] == 1.0
    print("Degradation period over.")


tfault = threading.Thread(target=fault_injector_thread)
tfault.start()


# config["version"] = config["version"] + 1
# for mi in [1,2]:
#     config["members"][mi]["slaveDelay"] = 3
#     config["members"][mi]["priority"] = 0
# print("*** starting reconfig to version " + str(config["version"]))
# start = time.time()
# res = client.admin.command("replSetReconfig", config)
# durationMS = (time.time() - start) * 1000
# if res["ok"] == 1.0:
#     print("*** reconfig success in %f ms" % durationMS)

# Simulate quick failure detection.
print("Simulated wait to detect degradation.")
time.sleep(0.5)

# Now reconfigure to add in two healthy nodes.
print("Degradation detected. Trying to add two new healthy nodes.")
for mi in [3,4]:
    config["version"] = config["version"] + 1
    config["members"][mi]["votes"] = 1
    start = time.time()
    res = client.admin.command("replSetReconfig", config)
    durationMS = (time.time() - start) * 1000
    if res["ok"] == 1.0:
        print("*** reconfig added healthy node %d in %f ms" % (mi, durationMS))

# Wait until degraded period has ended.
tfault.join()

reconfig_latencies = []
# time_limit_secs = 25
# tbegin = time.time() 
# while (time.time()-tbegin) < time_limit_secs:
#     config["version"] = config["version"] + 1
#     print("*** starting reconfig to version " + str(config["version"]))
#     start = time.time()
#     res = client.admin.command("replSetReconfig", config)
#     # time.sleep(0.010)

#     durationMS = (time.time() - start) * 1000
#     reconfig_latencies.append(durationMS)
#     if res["ok"] == 1.0:
#         print("*** reconfig success in %f ms" % durationMS)
#         # Print bar representing duration.
#         bar_len = int(durationMS/3)
#         print("+"*bar_len)

# print("Mean reconfig latency: %d ms" % avg(reconfig_latencies))

# Save the latencies to a file, one per row.
f = open("reconfig-latencies.csv", 'w')
for l in reconfig_latencies:
    f.write(str(l))
f.close()

for w in writers:
    w.join()