
load("jstests/hooks/validate_collections.js");
load("jstests/core/txns/libs/prepare_helpers.js");

//
// Simplified version of the original test discovered by the rollback fuzzer in BF-15552. Tries to 
// simulate some of the randomness in the original generated test for sake of debugging demonstration.
//

const name = "bf-15552-demo";
const rst = new ReplSetTest({nodes: 1});
const nodes = rst.startSet();
rst.initiate();
const dbName = "test";
const collName1 = "coll1";
const collName2 = "coll2";

let primary = rst.getPrimary();
let secondary = rst.getSecondary();
let testDB = primary.getDB(dbName);

// Create a few collections.
assert.commandWorked(testDB.runCommand({create: collName1, writeConcern: {w: "majority"}}));
assert.commandWorked(testDB.runCommand({create: collName2, writeConcern: {w: "majority"}}));

// Create two sessions.
const session1 = primary.startSession({causalConsistency: false});
const session1DB = session1.getDatabase(dbName);
const session1Coll = session1DB.getCollection(collName1);

const session2 = primary.startSession({causalConsistency: false});
const session2DB = session2.getDatabase(dbName);
const session2Coll = session2DB.getCollection(collName2);

//
// Do some random operations on both collections.
//
assert.commandWorked(primary.getDB(dbName).getCollection(collName1).insert({x:1}));
assert.commandWorked(primary.getDB(dbName).getCollection(collName2).insert({x:2}));
assert.commandWorked(primary.getDB(dbName).getCollection(collName2).insert({x:3}));
assert.commandWorked(primary.getDB(dbName).getCollection(collName2).remove({x:2}));
assert.commandWorked(primary.getDB(dbName).getCollection(collName1).insert({x:4}));
assert.commandWorked(primary.getDB(dbName).getCollection(collName1).update({x:1}, {$set: {y:6}}));
assert.commandWorked(primary.getDB(dbName).getCollection(collName1).insert({x:3}));

//
// Do some transaction operations.
//
session2.startTransaction();
var txnNum = session2.getTxnNumber_forTesting();
assert.commandWorked(session2Coll.insert({_id:1}));
assert.commandWorked(session2Coll.insert({_id:2}));
session2.commitTransaction();

session1.startTransaction();
var txnNum = session1.getTxnNumber_forTesting();
assert.commandWorked(session1Coll.insert({_id:32}));
assert.commandWorked(session1Coll.insert({_id:33}));
PrepareHelpers.prepareTransaction(session1);

//
// Do some more operations.
assert.commandWorked(primary.getDB(dbName).getCollection(collName1).insert({x:4}));
assert.commandWorked(primary.getDB(dbName).getCollection(collName1).update({x:4}, {$set: {x:6}}));
assert.commandWorked(primary.getDB(dbName).getCollection(collName1).insert({x:3}));
assert.commandWorked(primary.getDB(dbName).getCollection(collName1).insert({x:4}));

//
// Do some more transaction operations.
//
session2.startTransaction();
var txnNum = session2.getTxnNumber_forTesting();
assert.commandWorked(session2Coll.insert({_id:4}));
assert.commandWorked(session2Coll.insert({_id:5}));
assert.commandWorked(session2Coll.insert({_id:6}));
assert.commandWorked(session2Coll.insert({_id:7}));
session2.abortTransaction();

//
// Restart the primary node.
//
jsTestLog("Restarting node.");
rst.restart(0);

// Abort all remaining open transactions before stopping the set.
primary = rst.getPrimary();
let res = primary.adminCommand({currentOp: 1, "transaction": {$exists: true}});
jsTestLog(res);
res.inprog.forEach(op => {
    let sess = PrepareHelpers.createSessionWithGivenId(rst.getPrimary(), op.lsid);
    let sessDB = sess.getDatabase(dbName);
    assert.commandWorked(sessDB.adminCommand({abortTransaction: 1, txnNumber: op.transaction.parameters.txnNumber, stmtid: NumberInt(3), autocommit: false}));
})

rst.checkCollectionCounts();
rst.stopSet();