/*
 * Test that replSetReconfig waits for a majority of voting nodes to replicate the config
 * before starting another reconfig.
 *
 * @tags: [requires_fcv_44]
 */
// TODO: This test is expected to fail until SERVER-46473 is fixed.
(function() {
"use strict";

load("jstests/replsets/rslib.js");
load("jstests/libs/write_concern_util.js");

var replTest = new ReplSetTest({
    nodes: [
        {rsConfig: {priority: 1, votes: 1}},
        {rsConfig: {priority: 0, votes: 1}},
        {rsConfig: {priority: 0, votes: 1}},
        {rsConfig: {priority: 0, votes: 0}},
        {rsConfig: {priority: 0, votes: 0}}
    ],
    useBridge: true
});
var nodes = replTest.startSet();
replTest.initiate();
var primary = replTest.getPrimary();
var secondary = replTest.getSecondary();

// Stop replication so writes shouldn't be able to commit on a majority of voting nodes.
stopServerReplication(nodes[1]);
stopServerReplication(nodes[2]);

// Do a write that should not be able to replicate to any voting secondaries.
assert.commandWorked(primary.getDB("test")["test"].insert({x: 1}));

try {
    // Run a reconfig with a timeout of 5 seconds, this should fail with a maxTimeMSExpired error.
    jsTestLog("Doing reconfig.");
    var config = primary.getDB("local").system.replset.findOne();
    config.version++;
    assert.commandFailedWithCode(
        primary.getDB("admin").runCommand({replSetReconfig: config, maxTimeMS: 5000}),
        ErrorCodes.MaxTimeMSExpired);
} catch (e) {
    restartServerReplication(nodes[1]);
    restartServerReplication(nodes[2]);
    throw e;
}

replTest.stopSet();
}());