/**
 * Verify that a non force replica set reconfig waits for all oplog entries committed in the
 * previous config to be committed in the current config.
 *
 * @tags: [requires_fcv_44]
 */
(function() {
"use strict";
load("jstests/libs/write_concern_util.js");

const dbName = "test";
const collName = "coll";
// Use 5 nodes and make the secondaries unelectable.
let rst = new ReplSetTest({
    nodes: [
        {},
        {rsConfig: {priority: 0}},
        {rsConfig: {priority: 0}},
        {rsConfig: {priority: 0}},
        {rsConfig: {priority: 0}}
    ]
});
rst.startSet();
rst.initiate();

const primary = rst.getPrimary();
const secondary = rst.getSecondary();
const coll = primary.getDB(dbName)[collName];

// This makes the test run faster.
rst.getSecondaries().forEach((node) => {
    assert.commandWorked(
        node.adminCommand({configureFailPoint: 'setSmallOplogGetMoreMaxTimeMS', mode: 'alwaysOn'}));
})

// Create collection.
assert.commandWorked(coll.insert({}));
rst.awaitReplication();

jsTestLog("Test that reconfig waits for last op committed in previous config.");

// Pause replication on a minority of nodes in the current config, commit an op on the remaining
// majority of the current config, and then try to run a reconfig that removes one of the nodes on
// which replication is currently paused. The reconfig should initially fail due to a timeout.
// Retrying the reconfig with a higher version should also fail since the op won't be committed in
// the current config.

// Test a node removal case. Commit an op on 3/5 nodes. If you remove one of the nodes
// from the write majority from the config, there will now be 2/4 nodes in the new config with the
// op, which means the op is not committed in that config.

// Test a node addition case. Commit an op on 2/3 nodes. If you add one more node to the set this
// means that the original op is no longer committed in the new config.

// In general, goal is to test cases where an op that can be committed in W nodes in config Ci
// would not be committed in Cj if we add a node, or if we remove one of the W nodes that committed
// the write.
//
// Node add cases:
// 1 (w:1) -> 2 (w:2), w'=1 - TEST
// 2 (w:2) -> 3 (w:2), w'=2
// 3 (w:2) -> 4 (w:3), w'=2 - TEST
// 4 (w:3) -> 5 (w:3), w'=3
//
// Node removal cases (remove a node with the committed write):
// 5 (w:3) -> 4 (w:3), w'=2 - TEST
// 4 (w:3) -> 3 (w:2), w'=2
// 3 (w:2) -> 2 (w:2), w'=1 - TEST
// 2 (w:2) -> 1 (w:1), w'=1
//
// For adds, ODD -> EVEN may be unsafe.
// For removes, ODD -> EVEN may be unsafe.

let origConfig = rst.getReplSetConfigFromNode();

//
// Test removal, 5 -> 4.
//
let config = rst.getReplSetConfigFromNode();
let count = config.members.length - 1;

jsTestLog("Reconfiguring down to " + count + " nodes.");
// Stop replication to a maximal minority of nodes in the current config.
let currMajority = Math.floor(config.members.length / 2) + 1;
let minority = rst.nodes.slice(0, config.members.length).slice(currMajority);
stopServerReplication(minority);
jsTestLog("Stopped server replication on: " + tojson(minority));

// Commit an op in this config with the minimum set of nodes needed to satisfy a majority.
assert.commandWorked(coll.insert({x: count}, {writeConcern: {w: "majority"}}));

// Remove one node from the config.
let newConfigMembers = config.members.slice(0, count);
let newConfigNodes = config.members.slice(0, count);
let origMembers = config.members;
config.members = newConfigMembers;
config.version++;

// Commit an op in this config with the minimum set of nodes needed to satisfy a majority.
assert.commandWorked(coll.insert({x: count}, {writeConcern: {w: "majority"}}));

// Attempt to move to new config. Expect failure since the op cannot commit in the new config.
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: config, maxTimeMS: 1000}),
                             ErrorCodes.MaxTimeMSExpired);

// Leaving the current config should be prohibited since the op is not committed.
config.version++
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: config, maxTimeMS: 1000}),
                             ErrorCodes.ConfigurationInProgress);

// Restart replication to one node of the minority. Reconfig should now eventually succeed.
restartServerReplication(minority[0]);
assert.soonNoExcept(function() {
    assert.commandWorked(primary.adminCommand({replSetReconfig: config}));
    return true;
});

// Restart replication to all minority members.
assert.soonNoExcept(function() {
    restartServerReplication(minority);
    return true;
});

// Remove 1 node at a time and test safe reconfig succeeds in correct scenario.
assert.eq(rst.getReplSetConfigFromNode().members.length, 4);

// Reconfig down to 3 nodes.
config.version++;
config.members = config.members.slice(0, 3);
assert.commandWorked(primary.adminCommand({replSetReconfig: config, force: true}));

//
// Test removal, 3 -> 2.
//
config = rst.getReplSetConfigFromNode();
count = config.members.length - 1;

jsTestLog("Reconfiguring down to " + count + " nodes.");
// Stop replication to a maximal minority of nodes in the current config.
currMajority = Math.floor(config.members.length / 2) + 1;
minority = rst.nodes.slice(0, config.members.length).slice(currMajority);
jsTestLog("Stopping server replication on: " + tojson(minority));
minority.forEach(reconnect);
stopServerReplication(minority);
jsTestLog("Stopped server replication on: " + tojson(minority));

// Remove one node from the config.
newConfigMembers = config.members.slice(0, count);
newConfigNodes = config.members.slice(0, count);
origMembers = config.members;
config.members = newConfigMembers;
config.version++;

// Commit an op in this config with the minimum set of nodes needed to satisfy a majority.
assert.commandWorked(coll.insert({x: count}, {writeConcern: {w: "majority"}}));

// Attempt to move to new config. Expect failure since the op cannot commit in the new config.
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: config, maxTimeMS: 1000}),
                             ErrorCodes.MaxTimeMSExpired);

// Leaving the current config should be prohibited since the op is not committed.
config.version++
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: config, maxTimeMS: 1000}),
                             ErrorCodes.ConfigurationInProgress);

// Restart replication to one node of the minority. Reconfig should now eventually succeed.
restartServerReplication(minority[0]);
assert.soonNoExcept(function() {
    assert.commandWorked(primary.adminCommand({replSetReconfig: config}));
    return true;
});

// Restart replication to all minority members.
assert.soonNoExcept(function() {
    restartServerReplication(minority);
    return true;
});

// Force reconfig back to the original set to stop test.
origConfig.version = rst.getReplSetConfigFromNode().version + 1;
assert.commandWorked(primary.adminCommand({replSetReconfig: origConfig, force: true}));

rst.stopSet();
return;
}());
