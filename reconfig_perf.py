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
        {'_id': 2, 'host': 'localhost:28002'}]}
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
    for i in range(500):
        doc = {"tid": k, "x": i}
        res = collection.insert_one(doc)
        # print(doc)
        assert res.acknowledged

res = client.admin.command("replSetGetConfig")
config = res["config"]

# Set fast heartbeat interval.
heartbeatIntervalMS = 2000 # milliseconds.

# Use slave delay to simulate lagged secondaries.
config["members"][1]["slaveDelay"] = 1
config["members"][1]["priority"] = 0
config["members"][2]["slaveDelay"] = 1
config["members"][2]["priority"] = 0

settings = config["settings"]
settings["heartbeatIntervalMillis"] = heartbeatIntervalMS
config["version"] = config["version"] + 1
config["settings"] = settings
print("*** reconfig to set heartbeat interval to %dms" % heartbeatIntervalMS)
res = client.admin.command("replSetReconfig", config)
assert res["ok"] == 1.0

# Start writer threads.
writers = []
# for tid in range(5):
#     print("Starting writer thread %d" % tid)
#     t = threading.Thread(target=write_thread, args=(tid,))
#     t.start()
#     writers.append(t)

time.sleep(0.5)

def restartHbs(client):
    # Restart heartbeats on the primary.
    reshb = client.admin.command({"replSetTest":1, "restartHeartbeats":1})
    assert reshb["ok"] == 1.0

reconfig_latencies = []
for i in range(20):
    config["version"] = config["version"] + 1
    print("*** starting reconfig to version " + str(config["version"]))
    # print(config)
    start = time.time()
    res = client.admin.command("replSetReconfig", config)
    # time.sleep(0.010)

    db = client[db_name]
    collection = db[coll_name]
    collection = collection.with_options(write_concern=pymongo.WriteConcern(w="majority"))
    doc = {"noop": 1}
    writeres = collection.insert_one(doc)

    durationMS = (time.time() - start) * 1000
    reconfig_latencies.append(durationMS)
    if res["ok"] == 1.0:
        print("*** reconfig success in %f ms" % durationMS)

write_latencies = []
# for i in range(10):
#     # print(config)
#     start = time.time()
#     db = client[db_name]
#     collection = db[coll_name]
#     collection = collection.with_options(write_concern=pymongo.WriteConcern(w="majority"))
#     doc = {"tid": 1, "x": i}
#     res = collection.insert_one(doc)
#     # print(doc)
#     assert res.acknowledged
#     durationMS = (time.time() - start) * 1000
#     write_latencies.append(durationMS)

print("Mean reconfig latency: %d ms" % avg(reconfig_latencies))
# print("Mean majority write latency: %d ms" % avg(write_latencies))

for w in writers:
    w.join()