/**
 * Make sure that reconfig waits for the config document to be durable on nodes before returning.
 *
 * @tags: [requires_persistence]
 */
(function() {
const rst = new ReplSetTest({
    nodes: 3,
    nodeOptions: {
        // Turn up the syncdelay (in seconds) to effectively disable background checkpoints.
        syncdelay: 600,
        setParameter: {logComponentVerbosity: tojson({storage: 2})}
    }
});
rst.startSet();
rst.initiate();

// Do a reconfig and wait for propagation.
jsTestLog("Doing a reconfig.");
let config = rst.getReplSetConfigFromNode(0);
config.version++;
let start = new Date();
rst.getPrimary().adminCommand({replSetReconfig: config});
rst.awaitNodesAgreeOnConfigVersion();
jsTestLog("Finished waiting for reconfig to propagate. Took: " + (new Date() - start) + "ms");

rst.stopSet();
}());
