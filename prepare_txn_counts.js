
load("jstests/core/txns/libs/prepare_helpers.js");
load("jstests/hooks/validate_collections.js");

const name = "prepare_counts";
const rst = new ReplSetTest({nodes: 1});
const nodes = rst.startSet();
rst.initiate();
const dbName = "test";
const collName = name;

const primary = rst.getPrimary();
const secondary = rst.getSecondary();
const testDB = primary.getDB(dbName);

assert.commandWorked(testDB.runCommand({create: collName, writeConcern: {w: "majority"}}));

const session = primary.startSession({causalConsistency: false});
const sessionDB = session.getDatabase(dbName);
const sessionColl = sessionDB.getCollection(collName);

jsTestLog("Inserting 9 documents");
for(var i=0;i<9;i++){
    assert.commandWorked(primary.getDB(dbName).getCollection(collName).insert({x:i}));
}

jsTestLog("Starting transaction.");
session.startTransaction();
var txnNum = session.getTxnNumber_forTesting();
assert.commandWorked(sessionColl.insert({_id:1}));
assert.commandWorked(sessionColl.insert({_id:2}));
jsTestLog("Preparing transaction.");
PrepareHelpers.prepareTransaction(session);


jsTestLog("Restarting node.");
rst.restart(0);

// jsTestLog("Validating collection.");
// assert.commandWorked(primary.adminCommand({replSetStepDown: 5, force: true}));
// assert.commandWorked(testDB.runCommand({validate: collName, full: true}));

var session1 = PrepareHelpers.createSessionWithGivenId(rst.getPrimary(), session.getSessionId());
var session1DB = session1.getDatabase(dbName);

jsTestLog("Aborting transaction.");
assert.commandWorked(session1DB.adminCommand(
    {abortTransaction: 1, txnNumber: txnNum, stmtid: NumberInt(3), autocommit: false}));

rst.checkCollectionCounts();
rst.stopSet();