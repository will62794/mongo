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
const coll = primary.getDB(dbName)[collName];

// This makes the test run faster.

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
let config = rst.getReplSetConfigFromNode();

//
// TEST SINGLE NODE REMOVALS.
//

// Start out with 5 nodes and commit an op on a minimal majority of nodes. Then, reconfig to remove
// a node that replicated the committed op. The reconfig should not succeed until the op is
// committed in the current config.

// Stop replication to a maximal minority of nodes in the current config.
jsTestLog("Stopping server replication on minority.");
stopServerReplication([rst.nodes[1], rst.nodes[2]]);

// Commit an op in this config with the minimum set of nodes needed to satisfy a majority.
jsTestLog("Committing a majority write.");
assert.commandWorked(coll.insert({x: 1}, {writeConcern: {w: "majority", wtimeout: 10 * 1000}}));

const members = config.members;

// Remove a node that replicated the majority write. We expect this reconfig to time out since the
// committed op cannot become committed in the new config.
jsTestLog("Removing node " + members[4]);
config.version++;
config.members = [members[0], members[1], members[2], members[3]];
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: config, maxTimeMS: 1000}),
                             ErrorCodes.MaxTimeMSExpired);

// Installing a new config should be prohibited since the op is not committed.
config.version++;
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: config, maxTimeMS: 1000}),
                             ErrorCodes.ConfigurationInProgress);

// Restart replication to one node of the minority. Reconfig should now eventually succeed.
restartServerReplication(rst.nodes[1]);
assert.soonNoExcept(function() {
    assert.commandWorked(primary.adminCommand({replSetReconfig: config}));
    return true;
});

// Verify the current configuration size.
assert.eq(rst.getReplSetConfigFromNode().members.length, 4);

// Remove another node that replicated the committed op. This should succeed since the committed op
// will already be committed in the new config.
config.version++;
config.members = [members[0], members[1], members[2]];
assert.commandWorked(primary.adminCommand({replSetReconfig: config}));

// Remove another node that replicated the committed op.
config.version++;
config.members = [members[0], members[2]];
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: config, maxTimeMS: 1000}),
                             ErrorCodes.MaxTimeMSExpired);

config.version++;
assert.commandFailedWithCode(primary.adminCommand({replSetReconfig: config, maxTimeMS: 1000}),
                             ErrorCodes.ConfigurationInProgress);

// Allow op to commit in current config and complete reconfig.
restartServerReplication(rst.nodes[2]);
assert.soonNoExcept(function() {
    assert.commandWorked(primary.adminCommand({replSetReconfig: config}));
    return true;
});

// Add everyone back into the config before shutting down.
assert.commandWorked(primary.adminCommand({replSetReconfig: origConfig, force: true}));
rst.stopSet();
}());
