/**
 * Make sure that reconfig waits for the config document to be durable on nodes before returning.
 *
 * @tags: [requires_persistence, requires_fcv_44]
 */
(function() {
const rst = new ReplSetTest({
    nodes: 3,
    nodeOptions: {
        // Turn up the syncdelay (in seconds) to effectively disable background checkpoints.
        syncdelay: 600,
        setParameter: {logComponentVerbosity: tojson({storage: 2})}
    },
    useBridge: true
});
rst.startSet();
rst.initiate();

assert.commandWorked(rst.getPrimary().getDB("test")["test"].insert({x: 1}));
rst.awaitReplication();
rst.awaitLastOpCommitted();

let nodeIdToKill = 1;
let journalFp = configureFailPoint(rst.nodes[nodeIdToKill], "pauseJournalFlusherThread");
journalFp.wait();

// Do a reconfig and wait for propagation.
jsTestLog("Doing a reconfig.");
let config = rst.getReplSetConfigFromNode(0);

jsTestLog("Original config: " + tojson(config));
config.version++;
let newConfigVersion = config.version;
let start = new Date();
assert.commandWorked(rst.getPrimary().adminCommand({replSetReconfig: config}));
rst.awaitNodesAgreeOnConfigVersion();
jsTestLog("Finished waiting for reconfig to propagate. Took: " + (new Date() - start) + "ms");

rst.nodes[1].disconnect([rst.nodes[0], rst.nodes[2]]);

jsTestLog("Kill and restart a secondary node.");
rst.stop(nodeIdToKill, 9, {allowedExitCode: MongoRunner.EXIT_SIGKILL}, {forRestart: true});
rst.start(nodeIdToKill, undefined, true /* restart */);

config = rst.getReplSetConfigFromNode(nodeIdToKill);
jsTestLog("New config: " + tojson(config));
assert.eq(config.version, newConfigVersion);

rst.nodes[1].reconnect([rst.nodes[0], rst.nodes[2]]);

rst.awaitNodesAgreeOnConfigVersion();

rst.stopSet();
}());
