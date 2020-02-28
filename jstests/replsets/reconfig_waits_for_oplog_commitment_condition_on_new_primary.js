/**
 * Verify that a non force replica set reconfig waits for all oplog entries committed in the
 * previous config to be committed in the current config when run against a primary that has just
 * stepped up.
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
