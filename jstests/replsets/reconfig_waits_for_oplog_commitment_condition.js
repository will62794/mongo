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
// Make the secondary unelectable.
let rst = new ReplSetTest({nodes: [{}, {rsConfig: {priority: 0}}]});
rst.startSet();
rst.initiate();

const primary = rst.getPrimary();
const secondary = rst.getSecondary();
const coll = primary.getDB(dbName)[collName];

// This makes the test run faster.
assert.commandWorked(secondary.adminCommand(
    {configureFailPoint: 'setSmallOplogGetMoreMaxTimeMS', mode: 'alwaysOn'}));

// Create collection.
assert.commandWorked(coll.insert({}));
rst.awaitReplication();

// Stop replication on the secondary.
stopServerReplication(secondary);

// Reconfig down to a 1 node replica set.
let origConfig = rst.getReplSetConfigFromNode();
let singleNodeConfig = Object.assign({}, origConfig);
singleNodeConfig.members = singleNodeConfig.members.slice(0, 1);  // Remove the second node.
singleNodeConfig.version++;
assert.commandWorked(primary.adminCommand({replSetReconfig: singleNodeConfig}));

//
// Below we start out in config C1 = {n0}, try to reconfig to C2 = {n0,n1}, and then to C3 =
// {n0,n1}. When we move from C1 -> C2, the last committed op in C1 cannot become committed in C2,
// because replication is paused on n1. We will install C2, but time out while waiting for the op to
// commit in C2. If we try then to execute another reconfig to move from C2 -> C3, it should fail
// immediately since the last committed op from C1 is still not committed in C2. Once replication is
// restarted on n1, the op can commit in C2 and we can complete a reconfig to C3.
//
jsTestLog("Test that reconfig waits for last op committed in previous config.");

// {n0}
let C1 = singleNodeConfig;

// {n0, n1}
let C2 = Object.assign({}, origConfig);
C2.version = C1.version + 1;

// {n0, n1}
let C3 = Object.assign({}, origConfig);
C3.version = C2.version + 1;

jsTestLog("Do a write on primary and commit it in the current config.");
assert.commandWorked(coll.insert({x: 1}, {writeConcern: {w: "majority"}}));

jsTestLog("Reconfig to add the secondary back in.");
// We expect this to fail with a time out since the last committed op from C1 cannot become
// committed in C2.
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: C2, maxTimeMS: 1000}),
                             ErrorCodes.MaxTimeMSExpired);

// Wait until the config has propagated to the secondary and the primary has learned of it, so that
// the config replication check is satisfied.
// TODO (SERVER-44812): Wait for this by checking commitment status.
assert.soon(function() {
    const res = primary.adminCommand({replSetGetStatus: 1});
    return res.members[1].configVersion === rst.getReplSetConfigFromNode().version;
})

// Reconfig should fail immediately since we have not committed the last committed op from C1 in C2.
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: C3}),
                             ErrorCodes.ConfigurationInProgress);

// Make sure we can connect to the secondary after it was REMOVED.
reconnect(secondary);

// Let the last committed op from C1 become committed in the current config.
restartServerReplication(secondary);
rst.awaitReplication();

// Now that we can commit the op in the new config, reconfig should succeed.
assert.commandWorked(primary.adminCommand({replSetReconfig: C3}));

rst.awaitReplication();

//
// Test that a primary executing a reconfig waits for the first op time of its term to commit if it
// is newer than the latest committed op in a previous config.
//
jsTestLog("Test that reconfig waits for first op time of term to commit.");

let config = rst.getReplSetConfigFromNode();

// Pause replication on secondary so ops don't commit in this config.
stopServerReplication(secondary);

// A reconfig should succeed now since all ops from previous configs are committed in the current
// config.
config.version++;
assert.commandWorked(primary.adminCommand({replSetReconfig: config}));

jsTestLog("Stepping down the primary.");
// Step down the primary and then step it back up so that it writes a log entry in a newer term.
// This new op won't become committed yet, though, since we have paused replication.
assert.commandWorked(primary.adminCommand({replSetStepDown: 1, force: 1}));
assert.commandWorked(primary.adminCommand({replSetFreeze: 0}));  // end the stepdown period.

jsTestLog("Stepping the primary back up.");
rst.stepUpNoAwaitReplication(primary);
assert.eq(primary, rst.getPrimary());

// Reconfig should now fail since the primary has not yet committed an op in its term.
config.version++;
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: config}),
                             ErrorCodes.ConfigurationInProgress);

// Restart server replication to let the primary commit an op.
restartServerReplication(secondary);
rst.awaitLastOpCommitted();

// Reconfig should now succeed.
config.version++;
assert.commandWorked(primary.adminCommand({replSetReconfig: config}));

rst.stopSet();
}());
