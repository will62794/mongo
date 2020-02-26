/**
 * Make sure that reconfig waits for the config document to be durable on nodes before returning.
 *
 * @tags: [requires_persistence, requires_fcv_44]
 */
(function() {
const rst = new ReplSetTest({
    nodes: [{}, {rsConfig: {priority: 0}}],
    nodeOptions: {
        // Turn up the syncdelay (in seconds) to effectively disable background checkpoints.
        syncdelay: 600,
        setParameter: {logComponentVerbosity: tojson({storage: 2})}
    },
    useBridge: true
});
rst.startSet();
rst.initiate();

// We will kill node 1 after it installs and acknowledges a config to make sure it has made it
// durable. Disable journaling on the node so we are sure that the config write is flushed
// explicitly.
let nodeIdToKill = 1;
let journalFp = configureFailPoint(rst.nodes[nodeIdToKill], "pauseJournalFlusherThread");
journalFp.wait();

// Do a reconfig and wait for propagation to all nodes.
jsTestLog("Doing a reconfig.");
let config = rst.getReplSetConfigFromNode();
let newConfigVersion = config.version + 1;
config.version = newConfigVersion;
assert.commandWorked(rst.getPrimary().adminCommand({replSetReconfig: config}));
rst.awaitNodesAgreeOnConfigVersion();

// Verify the node has the right config.
assert.eq(rst.getReplSetConfigFromNode(nodeIdToKill).version, newConfigVersion);
jsTestLog("Finished waiting for reconfig to propagate.");

// Isolate node 1 so that it does not automatically learn of a new config via heartbeat after
// restart.
rst.nodes[1].disconnect([rst.nodes[0]]);

jsTestLog("Kill and restart the secondary node.");
rst.stop(nodeIdToKill, 9, {allowedExitCode: MongoRunner.EXIT_SIGKILL}, {forRestart: true});
rst.start(nodeIdToKill, undefined, true /* restart */);

// Make sure that node 1 still has the config it acknowledged.
assert.eq(rst.getReplSetConfigFromNode(nodeIdToKill).version, newConfigVersion);

// Re-connect the node to let the test complete.
rst.nodes[1].reconnect([rst.nodes[0]]);
rst.stopSet();
}());
