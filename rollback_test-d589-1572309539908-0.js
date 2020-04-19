(function (shell) {
'use strict';

// Collection name with 113 characters, so the full namespace when running on a four letter db
// would be 4 + 1 + 113 = 119 characters. So an index name with more than 8 characters would
// fail to be created, including the leading dot (e.g. ".a_bb", ".b_ffffff")
var kCollName113Char = 'long_ns_113_'.repeat(113).substring(0, 113);
var kCollName128KB = 'long_ns_1mb_'.repeat(100); //.substring(0, 128 * 1024);

const steps = [
    {
        steadyStateOps: [
            
            ["prepareTransaction",{}, 0 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [{"insert": 'three', "documents": [{"_id": "1", e: {"bin_f": BinData(0x02,'aGVsbG8='), }, a: BinData(0x80,'aGVsbG8=')}], "ordered": false, }, {"delete": kCollName128KB, "deletes": [{"q": {"_id": "6", }, "limit": 1, }], }, ], }, 1 ],
            ["admin", {"renameCollection": `db_0.${kCollName113Char}`, "to": `db_1.${'three'}`, "dropTarget": true, }, 2 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 15, }, 3 ],
            ["admin", {"renameCollection": `db_0.${'three'}`, "to": `db_0.${kCollName113Char}`, "dropTarget": false, }, 4 ],
            ["commitTransaction",{}, 5 ],
            ["db_1", {"dropIndexes": 'one', "index": "*", }, 6 ],
            ["db_0", {"createIndexes": 'one', "indexes": [{"key": {"_id": -1, }, "name": "ix_eeeee", "background": true, "sparse": true, },{"key": {"_id": "hashed", "c": "text", }, "name": "ix_bb", "unique": false, "sparse": true, },], }, 7 ],
            ["db_1", {"convertToCapped": kCollName113Char, "size": 5460, }, 8 ],
            ["runTransaction",{"dbName": "db_0", "commandObjs": [{"insert": 'three', "documents": [{"_id": "6", f: "￿f", b: [{"num_e": -314159265359, }, [], [BinData(0x05,'aGVsbG8='), ], ]}], "ordered": false, }, {"delete": kCollName113Char, "deletes": [{"q": {"_id": "2", }, "limit": 1, }], }, ], }, 9 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 1, "signal": 15, }, 10 ],
            ["admin", {"renameCollection": `db_0.${kCollName113Char}`, "to": `db_1.${'one'}`, "dropTarget": true, }, 11 ],
            ["commitTransaction",{}, 12 ],
            ["admin", {"renameCollection": `db_0.${kCollName113Char}`, "to": `db_0.${'two'}`, "dropTarget": false, }, 13 ],
            ["db_1", {"drop": 'one', }, 14 ],
        ],
        rolledBackOps: [
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"update": kCollName113Char, "updates": [{"q": {"_id": "9", }, "u": {e: {"str_c": "abc6ef", }, b: []}, }], }, {"update": 'three', "updates": [{"q": {"_id": "0", }, "u": {b: "axxxxxxxyz", d: {f: [["  ", ], [BinData(0x80,'aGVsbG8='), BinData(0x01,'aGVsbG8='), ], ]}}, }], }, {"update": 'one', "updates": [{"q": {"_id": "5", }, "u": {d: "caselesS", b: [2.225073858072009e308, -3.14159265859, 2.225073858072009e308, ]}, }], }, ], }, 15 ],
            ["db_1", {"dropIndexes": kCollName113Char, "index": "*", }, 16 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"update": 'one', "updates": [{"q": {"_id": "4", }, "u": {e: "  ", f: {d: [{"bin_e": BinData(0x04,'aGVsbG8='), }, {"bin_b": BinData(0x80,'aGVsbG8='), }, ]}}, }], }, ], }, 17 ],
            ["db_0", {"create": 'one', "validationAction": "error", }, 18 ],
            ["runTransaction",{"dbName": "db_0", "commandObjs": [{"update": kCollName113Char, "updates": [{"q": {"_id": "5", }, "u": {c: [-314159265359, -0, ], d: "x1B"}, }], }, {"insert": 'three', "documents": [{"_id": "5", c: [[BinData(0x03,'aGVsbG8='), BinData(0x05,'aGVsbG8='), BinData(0x00,'aGVsbG8='), ], 1, ], e: {e: [BinData(0x05,'aGVsbG8='), {"str_b": "axxxxxxxyz", }, [{"str_a": " ", }, ], ]}}], "ordered": true, }, ], }, 19 ],
            ["db_1", {"collMod": 'one', "validator": {"f": {$ne: 100}, }, "validationLevel": "moderate", }, 20 ],
            ["db_1", {"createIndexes": 'one', "indexes": [{"key": {"d": "hashed", }, "name": "ix_a", "background": false, "unique": true, "sparse": true, },{"key": {"_id": "text", "_id": "hashed", }, "name": "ix_dddd", "expireAfterSeconds": 616, },], }, 21 ],
            ["commitTransaction",{}, 22 ],
            ["db_0", {"collMod": 'two', }, 23 ],
            ["db_1", {"convertToCapped": kCollName113Char, "size": 392, }, 24 ],
            ["admin", {"renameCollection": `db_1.${kCollName113Char}`, "to": `db_0.${kCollName128KB}`, }, 25 ],
            ["db_1", {"drop": kCollName128KB, }, 26 ],
            ["db_1", {"drop": kCollName128KB, }, 27 ],
            ["db_0", {"insert": 'one', "documents": [{"_id": "772244892604840", a: {c: []}, e: [{"num_c": 1.7976931348623157e308, }, ]}], "ordered": false, }, 28 ],
            ["db_1", {"insert": kCollName113Char, "documents": [{"_id": "805670152135109", c: "bcxyz", d: {a: [[BinData(0x02,'aGVsbG8='), BinData(0x01,'aGVsbG8='), BinData(0x04,'aGVsbG8='), ], ]}}], "ordered": true, }, 29 ],
            ["db_1", {"collMod": 'three', "validationLevel": "off", "validationAction": "error", }, 30 ],
            ["db_1", {"drop": 'one', }, 31 ],
            ["db_1", {"convertToCapped": 'three', "size": 50, }, 32 ],
        ],
        syncSourceBeforeRollbackOps: [
            ["db_0", {"create": 'three', "size": 67, "validator": {"e": {$ne: 100}, }, "validationAction": "error", }, 33 ],
            ["db_1", {"create": kCollName113Char, "size": 79, "max": 759, "validator": {"a": {$ne: 100}, }, "validationLevel": "moderate", "flags": 3, }, 34 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"insert": 'one', "documents": [{"_id": "6", e: "x1B", b: {d: [{"num_a": -1, }, {"num_c": -3.14159265859, }, {"num_e": -Infinity, }, ]}}], "ordered": true, }, {"delete": kCollName113Char, "deletes": [{"q": {"_id": "3", }, "limit": 1, }], }, ], }, 35 ],
            ["db_0", {"collMod": 'one', "validationAction": "error", }, 36 ],
            ["prepareTransaction",{}, 37 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [{"insert": 'three', "documents": [{"_id": "0", d: [BinData(0x04,'aGVsbG8='), BinData(0x00,'aGVsbG8='), BinData(0x80,'aGVsbG8='), ], f: [{"bin_a": BinData(0x00,'aGVsbG8='), }, ]}], "ordered": false, }, {"insert": 'one', "documents": [{"_id": "4", f: [BinData(0x01,'aGVsbG8='), ], d: ""}], "ordered": false, }, ], }, 38 ],
            ["abortTransaction",{}, 39 ],
            ["admin", {"renameCollection": `db_1.${'two'}`, "to": `db_1.${'one'}`, }, 40 ],
            ["admin", {"renameCollection": `db_1.${kCollName128KB}`, "to": `db_0.${kCollName113Char}`, }, 41 ],
            ["db_0", {"create": kCollName113Char, "size": 75, "validator": {"d": {$ne: 100}, }, "validationLevel": "strict", }, 42 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 15, }, 43 ],
            ["db_0", {"dropIndexes": 'one', "index": "*", }, 44 ],
            ["commitTransaction",{}, 45 ],
            ["db_0", {"drop": 'two', }, 46 ],
            ["db_0", {"create": kCollName113Char, "capped": false, "size": 562, "max": 912, "validator": {"c": {$ne: 100}, }, "validationLevel": "off", "flags": 3, }, 47 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"delete": 'one', "deletes": [{"q": {"_id": "1", }, "limit": 1, }], }, ], }, 48 ],
            ["db_1", {"collMod": 'one', "validationLevel": "moderate", }, 49 ],
            ["commitTransaction",{}, 50 ],
            ["db_1", {"drop": 'two', }, 51 ],
            ["db_1", {"createIndexes": 'two', "indexes": [{"key": {"$**": 1, }, "name": "ix_bb", "background": true, },{"key": {"$**": 1, }, "name": "ix_ccc", "unique": false, "expireAfterSeconds": 62, },], }, 52 ],
            ["db_1", {"create": 'three', "validator": {"f": {$ne: 100}, }, "validationLevel": "strict", "validationAction": "warn", }, 53 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"delete": 'one', "deletes": [{"q": {"_id": "9", }, "limit": 1, }], }, {"delete": kCollName128KB, "deletes": [{"q": {"_id": "3", }, "limit": 1, }], }, ], }, 54 ],
            ["db_1", {"createIndexes": 'two', "indexes": [{"key": {"_id": 1, }, "name": "ix_ffffff", "unique": false, },{"key": {"$**": 1, }, "name": "ix_ffffff", "background": false, "sparse": true, "expireAfterSeconds": 96, },], }, 55 ],
            ["db_0", {"dropIndexes": kCollName113Char, "index": "*", }, 56 ],
            ["db_0", {"drop": kCollName128KB, }, 57 ],
            ["db_1", {"convertToCapped": 'two', "size": 61, }, 58 ],
            ["commitTransaction",{}, 59 ],
            ["commitTransaction",{}, 60 ],
            ["db_1", {"createIndexes": kCollName128KB, "indexes": [{"key": {"_id": "hashed", "b": 1, }, "name": "ix_bb", "background": true, },{"key": {"$**": 1, }, "name": "ix_a", "background": false, "unique": true, "sparse": false, "expireAfterSeconds": 54, },{"key": {"e": "text", }, "name": "ix_eeeee", "expireAfterSeconds": 23, },], }, 61 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 1, "signal": 15, }, 62 ],
            ["commitTransaction",{}, 63 ],
            ["db_0", {"collMod": kCollName113Char, }, 64 ],
            ["admin", {"renameCollection": `db_0.${kCollName128KB}`, "to": `db_0.${'two'}`, "dropTarget": true, }, 65 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 9, }, 66 ],
            ["db_0", {"dropIndexes": 'two', "index": "ix_ccc", }, 67 ],
        ],
        syncSourceDuringRollbackOps: [
        ],
    },
    {
        steadyStateOps: [
            
            ["db_1", {"dropIndexes": kCollName113Char, "index": "ix_ffffff", }, 68 ],
            ["db_0", {"convertToCapped": kCollName113Char, "size": 69, }, 69 ],
            ["db_0", {"createIndexes": 'one', "indexes": [{"key": {"_id": 1, "c": "text", }, "name": "ix_bb", "background": true, "sparse": false, "expireAfterSeconds": 45, },{"key": {"$**": 1, }, "name": "ix_ffffff", "unique": false, "sparse": true, "expireAfterSeconds": 57637, },], }, 70 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [{"delete": 'one', "deletes": [{"q": {"_id": "0", }, "limit": 1, }], }, {"update": kCollName113Char, "updates": [{"q": {"_id": "3", }, "u": {d: {a: "A0B"}, d: [[{"bin_b": BinData(0x00,'aGVsbG8='), }, {"bin_f": BinData(0x05,'aGVsbG8='), }, ], ]}, }], }, {"insert": 'one', "documents": [{"_id": "0", e: {b: []}, e: {a: " "}}], "ordered": false, }, ], }, 71 ],
            ["db_1", {"drop": 'two', }, 72 ],
            ["db_1", {"collMod": kCollName113Char, }, 73 ],
            ["db_0", {"createIndexes": kCollName128KB, "indexes": [{"key": {"_id": 1, "_id": "text", }, "name": "ix_eeeee", "background": true, "unique": false, },{"key": {"$**": 1, }, "name": "ix_ccc", "sparse": true, "expireAfterSeconds": 435, },], }, 74 ],
            ["db_1", {"dropIndexes": 'three', "index": "*", }, 75 ],
            ["db_0", {"drop": 'two', }, 76 ],
            ["abortTransaction",{}, 77 ],
            ["db_1", {"convertToCapped": 'two', "size": 50, }, 78 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [], }, 79 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [{"delete": 'two', "deletes": [{"q": {"_id": "3", }, "limit": 1, }], }, {"update": kCollName128KB, "updates": [{"q": {"_id": "5", }, "u": {f: {c: "an y thing"}, a: "abc\def"}, }], }, ], }, 80 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"insert": kCollName113Char, "documents": [{"_id": "1", d: {c: "axyz"}, e: [BinData(0x03,'aGVsbG8='), [{"num_f": 3.14159265359, }, ], +0, ]}], "ordered": true, }, {"insert": 'two', "documents": [{"_id": "5", b: "caseLESS", e: {"num_f": 1.7976931348623157e308, }}], "ordered": false, }, ], }, 81 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 1, "signal": 9, }, 82 ],
            ["prepareTransaction",{}, 83 ],
            ["db_1", {"collMod": kCollName128KB, "validationAction": "warn", }, 84 ],
            ["db_0", {"createIndexes": kCollName128KB, "indexes": [{"key": {"_id": -1, "e": -1, }, "name": "ix_eeeee", "background": true, "unique": false, "sparse": true, },{"key": {"$**": 1, }, "name": "ix_eeeee", "unique": true, "sparse": true, "expireAfterSeconds": 514, },], }, 85 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"insert": kCollName128KB, "documents": [{"_id": "7", e: {e: [[2.225073858072009e308, +0, ], ]}, b: "axyz"}], "ordered": true, }, ], }, 86 ],
            ["prepareTransaction",{}, 87 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"update": kCollName113Char, "updates": [{"q": {"_id": "9", }, "u": {b: "anything", f: "axxxxxxxyz"}, }], }, ], }, 88 ],
            ["db_0", {"create": 'one', "size": 26, "validator": {"b": {$ne: 100}, }, }, 89 ],
            ["db_0", {"convertToCapped": 'one', "size": 21, }, 90 ],
            ["db_1", {"drop": kCollName128KB, }, 91 ],
            ["db_0", {"drop": kCollName128KB, }, 92 ],
            ["db_1", {"collMod": 'two', "validationLevel": "off", "validationAction": "warn", }, 93 ],
            ["prepareTransaction",{}, 94 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"delete": 'two', "deletes": [{"q": {"_id": "8", }, "limit": 1, }], }, ], }, 95 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"update": 'two', "updates": [{"q": {"_id": "5", }, "u": {d: "  ", c: [["", "an y thing", ], [{"num_b": -8, }, {"num_f": 314159265000, }, {"num_b": 1.0, }, ], ]}, }], }, {"delete": kCollName128KB, "deletes": [{"q": {"_id": "4", }, "limit": 1, }], }, ], }, 96 ],
            ["abortTransaction",{}, 97 ],
            ["prepareTransaction",{}, 98 ],
            ["db_0", {"convertToCapped": kCollName128KB, "size": 5932, }, 99 ],
            ["admin", {"renameCollection": `db_1.${'two'}`, "to": `db_0.${'two'}`, "dropTarget": true, }, 100 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 2, "signal": 9, }, 101 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"insert": 'one', "documents": [{"_id": "4", d: [], b: [BinData(0x02,'aGVsbG8='), BinData(0x01,'aGVsbG8='), ]}], "ordered": true, }, ], }, 102 ],
            ["db_0", {"drop": kCollName113Char, }, 103 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 15, }, 104 ],
            ["admin", {"renameCollection": `db_1.${kCollName113Char}`, "to": `db_0.${'three'}`, "dropTarget": false, }, 105 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [{"update": 'three', "updates": [{"q": {"_id": "8", }, "u": {f: " a ", a: {d: BinData(0x02,'aGVsbG8=')}}, }], }, {"update": kCollName113Char, "updates": [{"q": {"_id": "6", }, "u": {c: [0.0, -3.14159265000, 0, ], a: [{"bin_c": BinData(0x00,'aGVsbG8='), }, [BinData(0x04,'aGVsbG8='), BinData(0x04,'aGVsbG8='), BinData(0x03,'aGVsbG8='), ], [{"str_b": "x1B", }, {"str_f": "CASELESS", }, ], ]}, }], }, {"insert": kCollName128KB, "documents": [{"_id": "2", a: {"num_e": 10, }, e: {d: "￿f"}}], "ordered": true, }, ], }, 106 ],
            ["db_1", {"insert": 'two', "documents": [{"_id": "708061135243988", c: {e: [[{"num_f": 0, }, {"num_d": 2.225073858072014e-308, }, {"num_c": Infinity, }, ], [{"str_f": "any thing", }, ], [{"bin_c": BinData(0x00,'aGVsbG8='), }, {"bin_d": BinData(0x05,'aGVsbG8='), }, ], ]}, b: ""}], "ordered": false, }, 107 ],
            ["db_1", {"convertToCapped": kCollName128KB, "size": 71, }, 108 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [], }, 109 ],
            ["db_0", {"createIndexes": kCollName128KB, "indexes": [{"key": {"d": "hashed", }, "name": "ix_bb", "unique": false, "sparse": false, "expireAfterSeconds": 4797, },{"key": {"$**": 1, }, "name": "ix_dddd", "background": true, "unique": false, "sparse": true, },{"key": {"$**": 1, }, "name": "ix_ffffff", "background": false, "unique": true, "expireAfterSeconds": 212, },], }, 110 ],
            ["abortTransaction",{}, 111 ],
            ["db_0", {"collMod": 'two', "validator": {"f": {$ne: 100}, }, }, 112 ],
            ["prepareTransaction",{}, 113 ],
            ["prepareTransaction",{}, 114 ],
        ],
        rolledBackOps: [
            ["prepareTransaction",{}, 115 ],
            ["commitTransaction",{}, 116 ],
            ["db_0", {"create": 'one', "capped": true, "max": 20, "validationAction": "error", "flags": 3, }, 117 ],
            ["db_0", {"collMod": 'two', "validationLevel": "off", }, 118 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [{"delete": 'three', "deletes": [{"q": {"_id": "6", }, "limit": 1, }], }, ], }, 119 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [{"update": 'two', "updates": [{"q": {"_id": "2", }, "u": {b: "axyz", a: []}, }], }, {"insert": kCollName128KB, "documents": [{"_id": "4", c: "  ", a: BinData(0x02,'aGVsbG8=')}], "ordered": true, }, {"delete": 'three', "deletes": [{"q": {"_id": "4", }, "limit": 1, }], }, ], }, 120 ],
            ["db_1", {"createIndexes": 'one', "indexes": [{"key": {"$**": 1, }, "name": "ix_ffffff", "background": false, "sparse": true, },{"key": {"$**": 1, }, "name": "ix_ffffff", "unique": true, },], }, 121 ],
            ["admin", {"renameCollection": `db_0.${'three'}`, "to": `db_1.${kCollName113Char}`, "dropTarget": true, }, 122 ],
            ["prepareTransaction",{}, 123 ],
            ["commitTransaction",{}, 124 ],
            ["db_1", {"dropIndexes": kCollName113Char, "index": "*", }, 125 ],
            ["prepareTransaction",{}, 126 ],
        ],
        syncSourceBeforeRollbackOps: [
            ["prepareTransaction",{}, 127 ],
            ["commitTransaction",{}, 128 ],
            ["db_0", {"dropIndexes": 'three', "index": "*", }, 129 ],
            ["db_1", {"convertToCapped": 'one', "size": 49, }, 130 ],
            ["db_1", {"createIndexes": 'one', "indexes": [{"key": {"_id": -1, }, "name": "ix_ccc", "background": false, },{"key": {"$**": 1, }, "name": "ix_dddd", "unique": true, "sparse": true, },], }, 131 ],
            ["db_0", {"convertToCapped": 'three', "size": 7321, }, 132 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [], }, 133 ],
            ["db_0", {"insert": 'one', "documents": [{"_id": "704723585938301", b: "abc6ef", a: {b: "  "}}], "ordered": true, }, 134 ],
            ["db_0", {"createIndexes": 'three', "indexes": [{"key": {"$**": 1, }, "name": "ix_ffffff", "background": false, "unique": false, },{"key": {"_id": 1, "a": "hashed", }, "name": "ix_ccc", "unique": true, "sparse": true, },], }, 135 ],
            ["db_0", {"collMod": 'two', "validator": {"d": {$ne: 100}, }, "validationLevel": "strict", "validationAction": "warn", }, 136 ],
            ["db_0", {"collMod": 'three', "validator": {"c": {$ne: 100}, }, "validationLevel": "moderate", }, 137 ],
            ["admin", {"renameCollection": `db_0.${kCollName128KB}`, "to": `db_1.${'three'}`, }, 138 ],
            ["db_1", {"insert": kCollName128KB, "documents": [{"_id": "761185830846587", f: [BinData(0x05,'aGVsbG8='), "caseLESS", ], d: {a: {c: "caselesS"}}}], "ordered": true, }, 139 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 15, }, 140 ],
            ["db_1", {"insert": kCollName113Char, "documents": [{"_id": "619355712883844", f: "abc\def", a: BinData(0x05,'aGVsbG8=')}], "ordered": false, }, 141 ],
            ["commitTransaction",{}, 142 ],
            ["db_1", {"create": 'three', "capped": false, }, 143 ],
            ["db_1", {"collMod": kCollName128KB, "validator": {"b": {$ne: 100}, }, "validationLevel": "moderate", }, 144 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 15, }, 145 ],
            ["commitTransaction",{}, 146 ],
            ["db_1", {"convertToCapped": 'three', "size": 53808, }, 147 ],
            ["db_0", {"collMod": kCollName113Char, "validationAction": "warn", }, 148 ],
            ["db_0", {"dropIndexes": kCollName113Char, "index": "ix_bb", }, 149 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 2, "signal": 9, }, 150 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"insert": 'three', "documents": [{"_id": "2", c: {a: [-1, ]}, e: [[" ", ], {"bin_b": BinData(0x03,'aGVsbG8='), }, ]}], "ordered": false, }, ], }, 151 ],
            ["db_1", {"insert": kCollName128KB, "documents": [{"_id": "643883744100408", d: "any thing", f: {a: [" a ", ]}}], "ordered": true, }, 152 ],
            ["db_0", {"collMod": 'one', "validator": {"f": {$ne: 100}, }, "validationAction": "warn", }, 153 ],
            ["db_1", {"dropIndexes": 'one', "index": "ix_ffffff", }, 154 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"insert": kCollName113Char, "documents": [{"_id": "3", c: {b: [-1, 3.14159265359, ]}, c: [[{"bin_c": BinData(0x05,'aGVsbG8='), }, ], ]}], "ordered": false, }, ], }, 155 ],
            ["db_0", {"collMod": 'one', "validator": {"f": {$ne: 100}, }, "validationLevel": "off", "validationAction": "warn", }, 156 ],
            ["db_0", {"collMod": kCollName128KB, }, 157 ],
        ],
        syncSourceDuringRollbackOps: [
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"delete": 'one', "deletes": [{"q": {"_id": "2", }, "limit": 1, }], }, ], }, 158 ],
            ["db_1", {"drop": kCollName128KB, }, 159 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"update": kCollName113Char, "updates": [{"q": {"_id": "6", }, "u": {a: {"bin_c": BinData(0x05,'aGVsbG8='), }, d: "thing"}, }], }, {"insert": kCollName128KB, "documents": [{"_id": "5", f: {f: [[BinData(0x01,'aGVsbG8='), ], ]}, e: "A0B"}], "ordered": false, }, ], }, 160 ],
            ["db_1", {"drop": 'three', }, 161 ],
            ["db_1", {"insert": 'two', "documents": [{"_id": "025313212706244", e: {e: []}, d: []}], "ordered": true, }, 162 ],
            ["db_1", {"createIndexes": 'two', "indexes": [{"key": {"_id": -1, }, "name": "ix_ffffff", "background": false, "unique": false, "expireAfterSeconds": 44, },], }, 163 ],
            ["prepareTransaction",{}, 164 ],
            ["prepareTransaction",{}, 165 ],
            ["db_0", {"drop": kCollName113Char, }, 166 ],
            ["abortTransaction",{}, 167 ],
            ["db_0", {"createIndexes": 'two', "indexes": [{"key": {"a": "text", }, "name": "ix_bb", "background": false, "sparse": false, "expireAfterSeconds": 6346, },{"key": {"$**": 1, }, "name": "ix_ffffff", "sparse": true, },{"key": {"$**": 1, }, "name": "ix_a", "unique": true, },], }, 168 ],
            ["db_0", {"dropIndexes": 'one', "index": "*", }, 169 ],
            ["db_0", {"create": 'one', "capped": false, "size": 335, }, 170 ],
            ["db_1", {"insert": 'three', "documents": [{"_id": "861386583927075", d: ["A0B", {"num_e": 10, }, -3.14159265000, ], b: {f: [{"num_c": 0.0, }, ]}}], "ordered": true, }, 171 ],
            ["db_1", {"collMod": 'three', "validator": {"e": {$ne: 100}, }, "validationLevel": "moderate", }, 172 ],
            ["db_0", {"convertToCapped": kCollName128KB, "size": 54, }, 173 ],
            ["db_0", {"convertToCapped": 'one', "size": 22, }, 174 ],
            ["commitTransaction",{}, 175 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"insert": kCollName128KB, "documents": [{"_id": "7", f: BinData(0x80,'aGVsbG8='), e: ["x7F", ["any thing", "￿f", ], ]}], "ordered": false, }, {"update": 'three', "updates": [{"q": {"_id": "0", }, "u": {d: [[{"str_a": "axyz", }, {"str_b": "caseLESS", }, ], [{"bin_d": BinData(0x04,'aGVsbG8='), }, ], ], c: [{"num_e": 0.0, }, {"num_d": Infinity, }, {"num_a": NaN, }, ]}, }], }, {"delete": kCollName128KB, "deletes": [{"q": {"_id": "6", }, "limit": 1, }], }, ], }, 176 ],
            ["db_0", {"drop": 'two', }, 177 ],
            ["prepareTransaction",{}, 178 ],
            ["db_0", {"createIndexes": 'two', "indexes": [{"key": {"_id": "hashed", }, "name": "ix_dddd", "background": false, "unique": true, "sparse": false, "expireAfterSeconds": 600, },{"key": {"c": "text", "c": 1, }, "name": "ix_dddd", "unique": false, },], }, 179 ],
            ["abortTransaction",{}, 180 ],
            ["admin", {"renameCollection": `db_1.${'two'}`, "to": `db_0.${kCollName128KB}`, }, 181 ],
            ["runTransaction",{"dbName": "db_0", "commandObjs": [{"delete": kCollName128KB, "deletes": [{"q": {"_id": "1", }, "limit": 1, }], }, {"insert": 'one', "documents": [{"_id": "9", e: [[], [{"str_b": "axxxxxxxyz", }, {"str_a": "bcxyz", }, {"str_c": "CASELESS", }, ], ], f: "an y thing"}], "ordered": true, }, ], }, 182 ],
            ["abortTransaction",{}, 183 ],
            ["db_1", {"dropIndexes": 'two', "index": "*", }, 184 ],
        ],
    },
    {
        steadyStateOps: [
            
            ["commitTransaction",{}, 185 ],
            ["db_0", {"convertToCapped": 'two', "size": 72, }, 186 ],
            ["db_0", {"dropIndexes": 'two', "index": "ix_ccc", }, 187 ],
            ["db_0", {"collMod": 'three', "validator": {"a": {$ne: 100}, }, }, 188 ],
            ["commitTransaction",{}, 189 ],
            ["admin", {"renameCollection": `db_0.${'two'}`, "to": `db_1.${kCollName113Char}`, "dropTarget": true, }, 190 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"delete": kCollName113Char, "deletes": [{"q": {"_id": "9", }, "limit": 1, }], }, {"delete": 'three', "deletes": [{"q": {"_id": "4", }, "limit": 1, }], }, {"update": 'one', "updates": [{"q": {"_id": "1", }, "u": {c: [[], ], f: {"str_b": " ", }}, }], }, ], }, 191 ],
            ["admin", {"renameCollection": `db_1.${kCollName128KB}`, "to": `db_0.${kCollName113Char}`, }, 192 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"insert": 'three', "documents": [{"_id": "7", e: {e: "A0B"}, e: BinData(0x80,'aGVsbG8=')}], "ordered": false, }, ], }, 193 ],
            ["db_1", {"createIndexes": 'three', "indexes": [{"key": {"_id": -1, "_id": -1, }, "name": "ix_ccc", "background": false, },{"key": {"$**": 1, }, "name": "ix_dddd", "unique": false, "sparse": true, "expireAfterSeconds": 50, },{"key": {"_id": "text", "_id": "text", }, "name": "ix_ffffff", "unique": true, "expireAfterSeconds": 6591, },{"key": {"$**": 1, }, "name": "ix_bb", "background": true, "sparse": false, "expireAfterSeconds": 616, },], }, 194 ],
            ["db_0", {"dropIndexes": 'two', "index": "ix_bb", }, 195 ],
            ["db_1", {"convertToCapped": 'three', "size": 3370, }, 196 ],
            ["db_1", {"create": 'three', "capped": false, "size": 1036, "validator": {"e": {$ne: 100}, }, "validationAction": "error", }, 197 ],
            ["runTransaction",{"dbName": "db_0", "commandObjs": [{"insert": 'two', "documents": [{"_id": "1", e: [[{"bin_d": BinData(0x03,'aGVsbG8='), }, {"bin_f": BinData(0x80,'aGVsbG8='), }, {"bin_c": BinData(0x00,'aGVsbG8='), }, ], "caseLESS", [BinData(0x05,'aGVsbG8='), BinData(0x80,'aGVsbG8='), BinData(0x00,'aGVsbG8='), ], ], f: [{"str_a": "caselesS", }, ]}], "ordered": false, }, {"delete": 'one', "deletes": [{"q": {"_id": "1", }, "limit": 1, }], }, ], }, 198 ],
        ],
        rolledBackOps: [
            ["db_0", {"insert": kCollName128KB, "documents": [{"_id": "796736353422257", a: [{"num_b": 314.15, }, {"num_e": -0, }, ], c: [{"bin_b": BinData(0x05,'aGVsbG8='), }, ]}], "ordered": false, }, 199 ],
            ["db_0", {"convertToCapped": 'one', "size": 975, }, 200 ],
            ["db_1", {"drop": 'three', }, 201 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"update": kCollName128KB, "updates": [{"q": {"_id": "8", }, "u": {c: {b: []}, c: "bcxyz"}, }], }, {"insert": kCollName128KB, "documents": [{"_id": "5", c: {a: [[{"str_f": "axyz", }, {"str_e": "abc6ef", }, {"str_d": "CASELESS", }, ], {"num_e": 3.14159265359, }, ]}, a: {d: " a "}}], "ordered": true, }, {"update": 'one', "updates": [{"q": {"_id": "5", }, "u": {f: [BinData(0x01,'aGVsbG8='), BinData(0x80,'aGVsbG8='), BinData(0x02,'aGVsbG8='), ], d: "anything"}, }], }, ], }, 202 ],
            ["db_0", {"create": kCollName128KB, "capped": false, "max": 712, "validator": {"e": {$ne: 100}, }, }, 203 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 1, "signal": 15, }, 204 ],
            ["db_1", {"dropIndexes": 'two', "index": "ix_bb", }, 205 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 9, }, 206 ],
            ["db_0", {"drop": kCollName128KB, }, 207 ],
            ["admin", {"renameCollection": `db_0.${kCollName113Char}`, "to": `db_0.${'three'}`, }, 208 ],
            ["db_0", {"insert": kCollName113Char, "documents": [{"_id": "920271154631429", d: [["abc6ef", "any thing", "CASELESS", ], ], e: {b: {f: "A0B"}}}], "ordered": true, }, 209 ],
            ["db_1", {"createIndexes": 'two', "indexes": [{"key": {"c": 1, "_id": 1, }, "name": "ix_eeeee", "expireAfterSeconds": 98, },{"key": {"$**": 1, }, "name": "ix_ccc", "background": false, "unique": true, "sparse": false, "expireAfterSeconds": 1656, },], }, 210 ],
            ["db_0", {"insert": kCollName113Char, "documents": [{"_id": "345427583677755", f: [], e: "axyz"}], "ordered": true, }, 211 ],
            ["commitTransaction",{}, 212 ],
            ["db_0", {"collMod": kCollName128KB, "validator": {"d": {$ne: 100}, }, }, 213 ],
            ["db_0", {"collMod": 'two', "validationLevel": "off", "validationAction": "error", }, 214 ],
            ["commitTransaction",{}, 215 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 9, }, 216 ],
            ["db_1", {"dropIndexes": kCollName128KB, "index": "*", }, 217 ],
            ["db_1", {"collMod": 'two', "validationAction": "warn", }, 218 ],
            ["runTransaction",{"dbName": "db_0", "commandObjs": [], }, 219 ],
            ["db_1", {"createIndexes": 'three', "indexes": [{"key": {"f": "text", }, "name": "ix_a", "unique": true, "sparse": true, "expireAfterSeconds": 3768, },{"key": {"$**": 1, }, "name": "ix_bb", "background": false, "expireAfterSeconds": 77, },], }, 220 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [], }, 221 ],
            ["db_1", {"create": 'three', "validator": {"b": {$ne: 100}, }, "validationLevel": "moderate", "validationAction": "warn", }, 222 ],
            ["commitTransaction",{}, 223 ],
            ["db_0", {"createIndexes": 'one', "indexes": [{"key": {"$**": 1, }, "name": "ix_dddd", "background": true, "unique": false, "sparse": false, "expireAfterSeconds": 95, },{"key": {"$**": 1, }, "name": "ix_ffffff", "background": true, "expireAfterSeconds": 55, },], }, 224 ],
            ["db_0", {"dropIndexes": kCollName113Char, "index": "*", }, 225 ],
            ["commitTransaction",{}, 226 ],
            ["db_0", {"dropIndexes": 'one', "index": "*", }, 227 ],
            ["prepareTransaction",{}, 228 ],
            ["db_0", {"createIndexes": 'three', "indexes": [{"key": {"e": "hashed", }, "name": "ix_a", "expireAfterSeconds": 47, },{"key": {"$**": 1, }, "name": "ix_ffffff", "background": true, "sparse": true, },], }, 229 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"insert": kCollName128KB, "documents": [{"_id": "5", c: {b: 314.15}, d: "x1B"}], "ordered": false, }, {"delete": 'two', "deletes": [{"q": {"_id": "8", }, "limit": 1, }], }, {"insert": 'one', "documents": [{"_id": "2", e: {f: [[{"str_a": "CASELESS", }, {"str_e": "caselesS", }, {"str_c": "abc6ef", }, ], [{"num_f": -8, }, {"num_b": 31.415, }, {"num_f": 0.0, }, ], [{"bin_a": BinData(0x05,'aGVsbG8='), }, {"bin_e": BinData(0x80,'aGVsbG8='), }, ], ]}, b: BinData(0x03,'aGVsbG8=')}], "ordered": false, }, ], }, 230 ],
            ["db_0", {"drop": 'three', }, 231 ],
            ["db_0", {"dropIndexes": kCollName128KB, "index": "ix_bb", }, 232 ],
            ["prepareTransaction",{}, 233 ],
            ["db_1", {"dropIndexes": 'two', "index": "*", }, 234 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 15, }, 235 ],
        ],
        syncSourceBeforeRollbackOps: [
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 9, }, 236 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"insert": kCollName128KB, "documents": [{"_id": "3", d: [31.415, NaN, ], f: [[{"bin_a": BinData(0x02,'aGVsbG8='), }, ], ]}], "ordered": true, }, {"update": 'three', "updates": [{"q": {"_id": "0", }, "u": {b: {c: "any thing"}, b: [["abc6ef", "CASELESS", ], BinData(0x01,'aGVsbG8='), ]}, }], }, ], }, 237 ],
            ["abortTransaction",{}, 238 ],
            ["db_1", {"createIndexes": 'one', "indexes": [{"key": {"a": -1, "_id": -1, }, "name": "ix_ccc", "background": true, "sparse": false, },], }, 239 ],
            ["db_1", {"drop": 'two', }, 240 ],
            ["admin", {"renameCollection": `db_1.${'one'}`, "to": `db_0.${kCollName113Char}`, }, 241 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [], }, 242 ],
            ["db_1", {"create": 'two', "capped": true, "size": 300, "max": 459, "validator": {"b": {$ne: 100}, }, "validationAction": "error", }, 243 ],
            ["db_0", {"createIndexes": 'one', "indexes": [{"key": {"$**": 1, }, "name": "ix_bb", "unique": false, "sparse": true, },{"key": {"f": -1, }, "name": "ix_a", "sparse": false, },], }, 244 ],
            ["db_1", {"createIndexes": kCollName128KB, "indexes": [{"key": {"_id": -1, "e": 1, }, "name": "ix_a", },{"key": {"$**": 1, }, "name": "ix_ccc", "background": false, "unique": false, "sparse": true, },{"key": {"e": 1, }, "name": "ix_eeeee", "sparse": false, "expireAfterSeconds": 858, },], }, 245 ],
            ["db_0", {"createIndexes": 'two', "indexes": [{"key": {"b": 1, }, "name": "ix_bb", "unique": false, "sparse": false, "expireAfterSeconds": 94, },{"key": {"$**": 1, }, "name": "ix_ccc", "background": true, "unique": true, "expireAfterSeconds": 90, },], }, 246 ],
            ["db_0", {"create": 'one', "capped": true, "size": 82, "validator": {"d": {$ne: 100}, }, "validationLevel": "strict", "validationAction": "error", "flags": 3, }, 247 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"delete": kCollName128KB, "deletes": [{"q": {"_id": "2", }, "limit": 1, }], }, {"update": 'one', "updates": [{"q": {"_id": "0", }, "u": {c: "an y thing", b: [[{"str_c": "abc6ef", }, ], {"num_e": 2.225073858072014e-308, }, BinData(0x03,'aGVsbG8='), ]}, }], }, {"update": 'three', "updates": [{"q": {"_id": "6", }, "u": {d: [["abc6ef", "abc6ef", ], ], a: 4.940656484124654e-324}, }], }, ], }, 248 ],
            ["prepareTransaction",{}, 249 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 2, "signal": 9, }, 250 ],
            ["db_0", {"dropIndexes": kCollName128KB, "index": "*", }, 251 ],
            ["admin", {"renameCollection": `db_0.${kCollName128KB}`, "to": `db_1.${'two'}`, "dropTarget": true, }, 252 ],
            ["db_1", {"dropIndexes": kCollName113Char, "index": "ix_bb", }, 253 ],
            ["db_1", {"insert": kCollName113Char, "documents": [{"_id": "712164916859208", f: [BinData(0x05,'aGVsbG8='), BinData(0x03,'aGVsbG8='), BinData(0x80,'aGVsbG8='), ], a: ["￿f", ]}], "ordered": false, }, 254 ],
            ["db_1", {"create": 'two', "size": 25, "max": 29, "validationLevel": "strict", }, 255 ],
            ["db_1", {"dropIndexes": 'two', "index": "*", }, 256 ],
            ["db_1", {"collMod": kCollName113Char, "validationLevel": "moderate", "validationAction": "error", }, 257 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 1, "signal": 9, }, 258 ],
            ["admin", {"renameCollection": `db_1.${kCollName113Char}`, "to": `db_1.${'three'}`, }, 259 ],
            ["db_1", {"insert": 'three', "documents": [{"_id": "710963680204237", c: {e: [["caselesS", ], ]}, d: 31.415}], "ordered": true, }, 260 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"insert": 'three', "documents": [{"_id": "2", f: {a: {e: 31.415}}, c: [["A0B", "x1B", "", ], [Infinity, ], BinData(0x00,'aGVsbG8='), ]}], "ordered": false, }, ], }, 261 ],
            ["db_0", {"createIndexes": kCollName113Char, "indexes": [{"key": {"$**": 1, }, "name": "ix_dddd", "background": false, "sparse": true, },{"key": {"_id": "text", }, "name": "ix_a", "unique": true, "expireAfterSeconds": 4176, },], }, 262 ],
            ["db_0", {"convertToCapped": kCollName128KB, "size": 158, }, 263 ],
            ["db_1", {"convertToCapped": kCollName128KB, "size": 7952, }, 264 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [], }, 265 ],
            ["prepareTransaction",{}, 266 ],
            ["startTransaction",{"dbName": "db_1", "commandObjs": [{"update": kCollName113Char, "updates": [{"q": {"_id": "5", }, "u": {f: {e: [[{"bin_a": BinData(0x03,'aGVsbG8='), }, ], [" ", "A0B", ], ]}, b: [[-314159265359, -3.14159265859, ], [{"num_a": +0, }, {"num_d": 1.0, }, ], ]}, }], }, {"delete": kCollName128KB, "deletes": [{"q": {"_id": "8", }, "limit": 1, }], }, ], }, 267 ],
            ["admin", {"renameCollection": `db_0.${'three'}`, "to": `db_1.${'one'}`, "dropTarget": true, }, 268 ],
            ["db_1", {"createIndexes": kCollName113Char, "indexes": [{"key": {"$**": 1, }, "name": "ix_eeeee", "unique": true, "sparse": false, },{"key": {"f": 1, "_id": -1, }, "name": "ix_a", "background": true, "sparse": false, },], }, 269 ],
            ["db_1", {"collMod": 'two', "validationLevel": "strict", }, 270 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 1, "signal": 9, }, 271 ],
            ["db_1", {"createIndexes": kCollName113Char, "indexes": [{"key": {"d": -1, "f": "text", }, "name": "ix_bb", "sparse": false, "expireAfterSeconds": 1947, },{"key": {"$**": 1, }, "name": "ix_a", "background": false, "unique": true, "sparse": false, "expireAfterSeconds": 70, },], }, 272 ],
            ["prepareTransaction",{}, 273 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [], }, 274 ],
            ["prepareTransaction",{}, 275 ],
            ["admin", {"renameCollection": `db_0.${kCollName113Char}`, "to": `db_0.${kCollName128KB}`, "dropTarget": false, }, 276 ],
        ],
        syncSourceDuringRollbackOps: [
            ["abortTransaction",{}, 277 ],
            ["db_1", {"convertToCapped": 'one', "size": 52, }, 278 ],
            ["db_1", {"dropIndexes": 'two', "index": "ix_ccc", }, 279 ],
            ["$fixtureCmd",{"restartNode": 1, "nodeId": 2, "signal": 9, }, 280 ],
            ["db_0", {"dropIndexes": kCollName113Char, "index": "*", }, 281 ],
            ["admin", {"renameCollection": `db_0.${'two'}`, "to": `db_1.${'one'}`, "dropTarget": true, }, 282 ],
            ["db_0", {"insert": 'three', "documents": [{"_id": "390766428872096", e: "abc\def", a: "an y thing"}], "ordered": false, }, 283 ],
            ["db_1", {"collMod": kCollName128KB, "validationLevel": "moderate", "validationAction": "warn", }, 284 ],
            ["runTransaction",{"dbName": "db_1", "commandObjs": [{"insert": 'one', "documents": [{"_id": "3", a: [[{"num_f": -314159265359, }, {"num_c": -1.0, }, ], ], b: {e: ["x7F", "  ", ]}}], "ordered": false, }, {"update": 'three', "updates": [{"q": {"_id": "9", }, "u": {f: "x1B", a: {c: [[{"str_f": "axxxxxxxyz", }, ], ]}}, }], }, {"delete": 'three', "deletes": [{"q": {"_id": "6", }, "limit": 1, }], }, ], }, 285 ],
            ["db_0", {"createIndexes": 'one', "indexes": [{"key": {"$**": 1, }, "name": "ix_ffffff", },], }, 286 ],
            ["db_1", {"insert": kCollName113Char, "documents": [{"_id": "947424624318828", c: [{"num_e": -0, }, ], b: [{"str_b": "abc6ef", }, ]}], "ordered": false, }, 287 ],
            ["abortTransaction",{}, 288 ],
            ["db_1", {"dropIndexes": 'one', "index": "*", }, 289 ],
            ["db_0", {"drop": kCollName113Char, }, 290 ],
            ["admin", {"renameCollection": `db_1.${'three'}`, "to": `db_1.${'two'}`, "dropTarget": true, }, 291 ],
            ["db_0", {"dropIndexes": kCollName128KB, "index": "*", }, 292 ],
            ["prepareTransaction",{}, 293 ],
            ["abortTransaction",{}, 294 ],
        ],
    },
    {
        steadyStateOps: [
            
            ["db_1", {"convertToCapped": kCollName128KB, "size": 68, }, 295 ],
            ["db_0", {"collMod": kCollName128KB, "validationAction": "warn", }, 296 ],
            ["db_0", {"create": 'three', "size": 761, "validationLevel": "off", "validationAction": "warn", "flags": 3, }, 297 ],
            ["db_1", {"create": 'three', "validationLevel": "moderate", "flags": 3, }, 298 ],
            ["startTransaction",{"dbName": "db_0", "commandObjs": [{"delete": kCollName128KB, "deletes": [{"q": {"_id": "9", }, "limit": 1, }], }, ], }, 299 ],
        ],
        rolledBackOps: [
        ],
        syncSourceBeforeRollbackOps: [
        ],
        syncSourceDuringRollbackOps: [
        ],
    },
];

/**
 * Log a string to output.
 *
 * The log destination and an optional prefix are configurable by calling `log.setup`.
 *
 * The `log` variable is a singleton. If you `require` this module in multiple other modules,
 * the setup parameters are retained. In this way you can call `log.setup({prefix: 'my fuzzer '})`
 * at the beginning of your `main` function and all subsequent uses of `log('foo')` will have the
 * prefix prepended.
 *
 * @param {any} msg
 */
const log = function(msg) {
    log.printer(`${log.prefix}${msg}`);
};

/**
 * @param prefix prefix to add before every log call. You probably want a space at the end of your prefix.
 * @param printer callback that takes the `prefix + msg` as a parameter.
 */
log.setup = function({prefix, printer} = {prefix: ''}) {
    if (typeof prefix !== 'undefined') {
        log.prefix = prefix;
    }
    if (typeof printer !== 'undefined') {
        log.printer = printer;
    }
};

/**
 * Reset the `log` singleton to its original state.
 *
 * The prefix is cleared, and the `printer` callback (from calls to `log.setup()`) is reverted
 * to either `shell.print` or `console.log` depending on the environment.
 */
log.reset = function() {
    log.prefix = '';
    log.printer =
        typeof shell !== 'undefined' && typeof shell.print !== 'undefined'
            ? shell.print
            : Function.prototype;
};

// Reset prior to exposing log to set the prefix and printer initial values.
log.reset();

var kStartedState = 'started';
var kPreparedState = 'prepared';
var kCommittedState = 'committed';
var kAbortedState = 'aborted';
var kNoDecisionYet = undefined;
var kCommitDecision = 'commit';
var kAbortDecision = 'abort';
var TransactionManager = /** @class */ (function () {
    function TransactionManager(_a) {
        var primary = _a.primary, sessionOptions = _a.sessionOptions, journalPreparedTxns = _a.journalPreparedTxns, fuzzerName = _a.fuzzerName;
        this._primary = primary;
        this._sessionOptions = sessionOptions;
        this._journalPreparedTxns = journalPreparedTxns;
        this._fuzzerName = fuzzerName;
        this._txns = [];
        this._sessions = [];
        this._stats = {
            startTransaction: 0,
            commitTransaction: 0,
            abortTransaction: 0,
            prepareTransaction: 0,
            skippedTransaction: 0,
        };
        this._subsequentOpsWillBeRolledBack = false;
    }
    Object.defineProperty(TransactionManager, "kInitialSync", {
        get: function () {
            return 'initial sync';
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TransactionManager, "kRollback", {
        get: function () {
            return 'rollback';
        },
        enumerable: true,
        configurable: true
    });
    TransactionManager.prototype.stats = function () {
        return this._stats;
    };
    TransactionManager._newTransaction = function (session, startedCommandIndex, involvesCappedCollection) {
        return {
            state: kStartedState,
            session: session,
            startedCommandIndex: startedCommandIndex,
            involvesCappedCollection: involvesCappedCollection,
            preparedCommandIndex: undefined,
            prepareTimestamp: undefined,
            coordinatorDecision: kNoDecisionYet,
            majorityCommittedState: undefined,
        };
    };
    TransactionManager.prototype.hasOutstandingTransactions = function () {
        return this._txns.some(function (txnInfo) { return txnInfo.state === kStartedState || txnInfo.state === kPreparedState; });
    };
    TransactionManager.prototype._beginTransaction = function (ops, commandIndex) {
        if (ops.length === 0) {
            // It is an error to have the prepareTransaction, commitTransaction, or
            // abortTransaction commands be the first command in a multi-statement transaction.
            // Ideally the grammar would never generate an empty 'ops' array, but for now we
            // skip these commands explicitly.
            log("Skipping empty transaction of cmd " + commandIndex);
            this._stats.skippedTransaction++;
            return null;
        }
        var session = this._primary.startSession(this._sessionOptions);
        this._sessions.push(session);
        session.startTransaction();
        this._stats.startTransaction++;
        var cmdRes;
        var shouldAbort = false;
        for (var _i = 0, ops_1 = ops; _i < ops_1.length; _i++) {
            var _a = ops_1[_i], dbName = _a.dbName, commandObj = _a.commandObj;
            cmdRes = session.getDatabase(dbName).runCommand(commandObj);
            if (cmdRes.ok !== 1 || cmdRes.hasOwnProperty('writeErrors')) {
                shouldAbort = true;
                break;
            }
            shell.assert.commandWorked(cmdRes);
        }
        if (shouldAbort) {
            var abortRes = session.abortTransaction_forTesting();
            if (abortRes.ok === 1) {
                shell.assert.commandWorked(abortRes);
            }
            else {
                // The transaction may have been implicitly aborted by the server.
                shell.assert.commandFailedWithCode(abortRes, shell.ErrorCodes.NoSuchTransaction);
            }
            log("Completed transaction of cmd " + commandIndex + " with lsid" +
                (" " + shell.tojson(session.getSessionId()) + ". Aborted due to an error:") +
                (" " + shell.tojson(cmdRes)));
            this._stats.abortTransaction++;
            session.endSession();
            return null;
        }
        return session;
    };
    TransactionManager.prototype.runTransaction = function (ops, commandIndex) {
        var session = this._beginTransaction(ops, commandIndex);
        if (session === null) {
            return;
        }
        shell.assert.commandWorked(session.commitTransaction_forTesting());
        log("Committed transaction of cmd " + commandIndex + "." +
            (" LSID: " + shell.tojson(session.getSessionId())) +
            (" COMMAND: " + shell.tojsononeline(ops)));
        session.endSession();
    };
    TransactionManager.prototype.startTransaction = function (ops, commandIndex) {
        var session = this._beginTransaction(ops, commandIndex);
        if (session === null) {
            return;
        }
        var involvesCappedCollection = false;
        for (var _i = 0, ops_2 = ops; _i < ops_2.length; _i++) {
            var _a = ops_2[_i], dbName = _a.dbName, commandObj = _a.commandObj;
            var collName = commandObj[Object.keys(commandObj)[0]];
            var cmdRes = session
                .getClient()
                .getDB(dbName)
                .runCommand({
                collStats: collName,
            });
            // It shouldn't be possible for the collStats command to return a NamespaceNotFound
            // error response because the collection must exist for us to have successfully run
            // operations in a transaction against it.
            shell.assert.commandWorked(cmdRes);
            if (cmdRes.capped) {
                involvesCappedCollection = true;
                break;
            }
        }
        log("Started transaction of cmd " + commandIndex + " with lsid" +
            (" " + shell.tojson(session.getSessionId()) + ". It") +
            (" " + (involvesCappedCollection ? 'does' : 'does not') + " involve a capped collection") +
            (" and therefore " + (involvesCappedCollection ? 'cannot' : 'can') + " be prepared."));
        this._txns.push(TransactionManager._newTransaction(session, commandIndex, involvesCappedCollection));
    };
    TransactionManager._canPrepareTransaction = function (txnInfo) {
        // Attempting to run a multi-statement transaction on a capped collection in a sharded
        // cluster returns an error. We skip running the prepareTransaction command in this case
        // in order to continue exercising the behavior of multi-statement transactions on a
        // capped collection in a replica set.
        return txnInfo.state === kStartedState && !txnInfo.involvesCappedCollection;
    };
    TransactionManager._prepareTransaction = function (primary, txnInfo, journalPreparedTxns, commandIndex) {
        var commandObj = { prepareTransaction: 1, writeConcern: { j: journalPreparedTxns } };
        var delegatingSession = new shell._DelegatingDriverSession(primary, txnInfo.session);
        var res = delegatingSession.getDatabase('admin').runCommand(commandObj);
        shell.assert.commandWorked(res);
        txnInfo.state = kPreparedState;
        txnInfo.preparedCommandIndex = commandIndex;
        txnInfo.prepareTimestamp = res.prepareTimestamp;
        log("Prepared transaction of cmd " + commandIndex + " from" +
            (" " + txnInfo.startedCommandIndex + " with lsid") +
            (" " + shell.tojson(txnInfo.session.getSessionId()) + " at timestamp") +
            (" " + shell.tojson(txnInfo.prepareTimestamp) + "."));
    };
    TransactionManager.prototype.prepareTransaction = function (commandIndex) {
        var txnInfo = this._txns.find(TransactionManager._canPrepareTransaction, this);
        if (txnInfo === undefined) {
            log("Skipping prepareTransaction of cmd " + commandIndex);
            return;
        }
        TransactionManager._prepareTransaction(this._primary, txnInfo, this._journalPreparedTxns, commandIndex);
        this._stats.prepareTransaction++;
    };
    TransactionManager.prototype._canCommitTransaction = function (txnInfo) {
        if (txnInfo.state === kStartedState) {
            return true;
        }
        if (txnInfo.state === kPreparedState) {
            // In MongoDB's distributed commit protocol, the coordinator won't run the
            // commitTransaction command until the prepareTransaction operation is
            // majority-committed. The rollback fuzzer doesn't run the prepareTransaction
            // command with w="majority" in order to avoid hanging forever while the primary is
            // connected only to tiebreaker node. (The latter having paused replication.) In
            // order to match the coordinator's behavior, the rollback fuzzer must not attempt
            // to commit a transaction for which both the prepareTransaction and
            // commitTransaction operations would be rolled back. If
            // `this._subsequentOpsWillBeRolledBack === false`, then we are guaranteed that the
            // commitTransaction will eventually become majority-committed.
            if (this._subsequentOpsWillBeRolledBack &&
                txnInfo.majorityCommittedState !== kPreparedState) {
                return false;
            }
            return (txnInfo.coordinatorDecision === kNoDecisionYet ||
                txnInfo.coordinatorDecision === kCommitDecision);
        }
        return false;
    };
    TransactionManager._commitTransaction = function (primary, txnInfo, journalPreparedTxns, commandIndex) {
        shell.assert.neq(txnInfo.coordinatorDecision, kAbortDecision, 'attempted to commit transaction that was previously attempted to be aborted');
        var msg;
        var commandObj = { commitTransaction: 1 };
        if (txnInfo.state === kPreparedState) {
            txnInfo.coordinatorDecision = kCommitDecision;
            // We use prepare timestamp as the commit timestamp in order to match the behavior
            // of the PrepareHelpers.commitTransaction() helper in
            // jstests/core/txns/libs/prepare_helper.js.
            commandObj.commitTimestamp = txnInfo.prepareTimestamp;
            commandObj.writeConcern = { j: journalPreparedTxns };
            msg =
                "Committed prepared transaction of cmd " + commandIndex + " from" +
                    (" " + txnInfo.preparedCommandIndex + " with lsid") +
                    (" " + shell.tojson(txnInfo.session.getSessionId()) + " at timestamp") +
                    (" " + shell.tojson(commandObj.commitTimestamp) + ".");
        }
        else {
            msg =
                "Committed non-prepared transaction of cmd " + commandIndex + " from" +
                    (" " + txnInfo.startedCommandIndex + " with lsid") +
                    (" " + shell.tojson(txnInfo.session.getSessionId()) + ".");
        }
        var delegatingSession = new shell._DelegatingDriverSession(primary, txnInfo.session);
        var res = delegatingSession.getDatabase('admin').runCommand(commandObj);
        shell.assert.commandWorked(res);
        txnInfo.state = kCommittedState;
        log(msg);
    };
    TransactionManager.prototype.commitTransaction = function (commandIndex) {
        var txnInfo = this._txns.find(this._canCommitTransaction, this);
        if (txnInfo === undefined) {
            log("Skipping commitTransaction of cmd " + commandIndex);
            return;
        }
        TransactionManager._commitTransaction(this._primary, txnInfo, this._journalPreparedTxns, commandIndex);
        this._stats.commitTransaction++;
    };
    TransactionManager._canAbortTransaction = function (txnInfo) {
        return (txnInfo.state === kStartedState ||
            (txnInfo.state === kPreparedState &&
                (txnInfo.coordinatorDecision === kNoDecisionYet ||
                    txnInfo.coordinatorDecision === kAbortDecision)));
    };
    TransactionManager._abortTransaction = function (primary, txnInfo, journalPreparedTxns, commandIndex) {
        shell.assert.neq(txnInfo.coordinatorDecision, kCommitDecision, 'attempted to abort transaction that was previously attempted to be committed');
        var msg;
        var commandObj = { abortTransaction: 1 };
        if (txnInfo.state === kPreparedState) {
            txnInfo.coordinatorDecision = kAbortDecision;
            commandObj.writeConcern = { j: journalPreparedTxns };
            msg =
                "Aborted prepared transaction of cmd " + commandIndex + " from" +
                    (" " + txnInfo.preparedCommandIndex + " with lsid") +
                    (" " + shell.tojson(txnInfo.session.getSessionId()) + ".");
        }
        else {
            msg =
                "Aborted non-prepared transaction of cmd " + commandIndex + " from" +
                    (" " + txnInfo.startedCommandIndex + " with lsid") +
                    (" " + shell.tojson(txnInfo.session.getSessionId()) + ".");
        }
        var delegatingSession = new shell._DelegatingDriverSession(primary, txnInfo.session);
        var res = delegatingSession.getDatabase('admin').runCommand(commandObj);
        shell.assert.commandWorked(res);
        txnInfo.state = kAbortedState;
        log(msg);
    };
    TransactionManager.prototype.abortTransaction = function (commandIndex) {
        var txnInfo = this._txns.find(TransactionManager._canAbortTransaction, this);
        if (txnInfo === undefined) {
            log("Skipping abortTransaction of cmd " + commandIndex);
            return;
        }
        TransactionManager._abortTransaction(this._primary, txnInfo, this._journalPreparedTxns, commandIndex);
        this._stats.abortTransaction++;
    };
    TransactionManager.prototype.endSessions = function () {
        for (var _i = 0, _a = this._sessions; _i < _a.length; _i++) {
            var session = _a[_i];
            session.endSession();
        }
    };
    /**
     * Saves the current state of each transaction as being majority-committed due to how their
     * effect has replicated to the secondary node (if it was prepared).
     *
     * This function is intended to be called immediately after
     * shell.RollbackTest#transitionToRollbackOperations() is called. Any subsequent operations
     * performed against the current primary will therefore be undone as part of rollback.
     */
    TransactionManager.prototype.markTransactionsAsMajorityCommitted = function () {
        // This function is only applicable to the rollback fuzzer.
        shell.assert.eq(this._fuzzerName, TransactionManager.kRollback);
        shell.assert(!this._subsequentOpsWillBeRolledBack, 'expected earlier call to resetTransactionsToMajorityCommittedState()');
        this._subsequentOpsWillBeRolledBack = true;
        // Transactions in the 'kStartedState' are preserved in order to exercise what happens
        // if the prepareTransaction operation is rolled back (possibly in addition to a
        // abortTransaction operation). Note that 'this._primary' hasn't changed and so the
        // server still has all the in-memory state about the transactions.
        this._txns = this._txns.filter(function (txnInfo) {
            txnInfo.majorityCommittedState = txnInfo.state;
            return txnInfo.state === kStartedState || txnInfo.state === kPreparedState;
        });
    };
    /**
     * Restores the current state of each transaction as the majority-committed state saved in
     * the prior call to markTransactionsAsMajorityCommitted(). Any transaction that wasn't in
     * the prepared state at or before the common point is ignored because no information about
     * it would have been replicated to the secondary (now 'newPrimary') node.
     *
     * This function is intended to be called immediately after
     * shell.RollbackTest#transitionToSyncSourceOperationsBeforeRollback() is called.
     */
    TransactionManager.prototype.resetTransactionsToMajorityCommittedState = function (newPrimary) {
        // This function is only applicable to the rollback fuzzer.
        shell.assert.eq(this._fuzzerName, TransactionManager.kRollback);
        shell.assert(this._subsequentOpsWillBeRolledBack, 'expected earlier call to markTransactionsAsMajorityCommitted()');
        this._primary = newPrimary;
        this._subsequentOpsWillBeRolledBack = false;
        this._txns = this._txns.filter(function (txnInfo) {
            txnInfo.state = txnInfo.majorityCommittedState;
            return txnInfo.majorityCommittedState === kPreparedState;
        });
    };
    /**
     * Discard the in-memory state of any transactions that are not in the prepared state. Any
     * transaction that wasn't in the prepared state is ignored because no information about it
     * would have been replicated to the secondary (now 'newPrimary') node.
     *
     * This is only intended to be called by the rollback fuzzer.
     *
     * @param newPrimary Node
     * @return void
     */
    TransactionManager.prototype.discardNonPreparedTransactions = function (newPrimary) {
        shell.assert.eq(this._fuzzerName, TransactionManager.kRollback);
        this._primary = newPrimary;
        // Transactions in the 'kCommittedState' and 'kAbortedState' states are preserved
        // because it is possible for their majority-committed state to be 'kPreparedState' and
        // for resetTransactionsToMajorityCommittedState() to be called later on.
        this._txns = this._txns.filter(function (txnInfo) { return txnInfo.state !== kStartedState; });
    };
    TransactionManager.prototype.drainOutstandingTransactions = function (commandIndex) {
        for (var i = 0; i < this._txns.length; ++i) {
            var txnInfo = this._txns[i];
            if (TransactionManager._canPrepareTransaction(txnInfo) && i % 3 === 0) {
                TransactionManager._prepareTransaction(this._primary, txnInfo, this._journalPreparedTxns, commandIndex);
            }
            if (this._canCommitTransaction(txnInfo) &&
                (txnInfo.coordinatorDecision === kCommitDecision || i % 2 === 0)) {
                TransactionManager._commitTransaction(this._primary, txnInfo, this._journalPreparedTxns, commandIndex);
            }
            else if (TransactionManager._canAbortTransaction(txnInfo)) {
                TransactionManager._abortTransaction(this._primary, txnInfo, this._journalPreparedTxns, commandIndex);
            }
        }
        // Sanity check the post-condition of calling drainOutstandingTransactions(). The
        // earlier for-loop should have aborted the transactions it had decided not to commit
        // that were still active.
        shell.assert(!this.hasOutstandingTransactions(), 'drainOutstandingTransactions() left behind outstanding transactions');
    };
    return TransactionManager;
}());

function rbstartCollectingStats({isV40, isV42OrNewer}) {
    const stats = {success: 0, failure: 0, skipped: 0};

    const runCommandOriginal = shell.Mongo.prototype.runCommand;

    shell.Mongo.prototype.runCommand = function(dbName, commandObj, options) {
        const commandName = Object.keys(commandObj)[0];
        let res;

        // We do not test capped collections on storage engines that use rollbackViaRefetch, since
        // they can hit SERVER-37172.
        const skipCappedCollections =
            shell.TestData.storageEngine === 'mmapv1' ||
            (shell.TestData.storageEngine === 'inMemory' && !isV42OrNewer) ||
            shell.TestData.storageEngine === 'ephemeralForTest' ||
            shell.TestData.enableMajorityReadConcern === false;

        const commandCreatesCappedCollection =
            (commandName === 'create' && commandObj.capped) || commandName === 'convertToCapped';

        // SERVER-16049: We force capped collections to be created with size=4GB to prevent
        // truncation from occuring.
        if (commandCreatesCappedCollection && !skipCappedCollections) {
            commandObj.size = 4 * 1024 * 1024 * 1024; // 4GB
            shell.print('Forcing capped collection size to 4GB to prevent truncation.');
        }

        // If we are skipping capped collections, change capped collection creation to non-capped.
        if (commandName === 'create' && commandObj.capped && skipCappedCollections) {
            commandObj.capped = false;
            shell.print(
                'Forcing create command to create non-capped collection on this storage engine.'
            );
        }

        // If we are skipping capped collection, skip 'convertToCapped' commands.
        if (commandName === 'convertToCapped' && skipCappedCollections) {
            ++stats.skipped;
            shell.print('Skipping convertToCapped command on this storage engine.');
            return {ok: 1};
        }

        // SERVER-32727: For capped collections prevent the creation of unique indexes.
        if (commandName === 'createIndexes') {
            let collStatsCalled = false;
            for (let indexSpec of commandObj.indexes) {
                if (indexSpec.unique) {
                    if (!collStatsCalled) {
                        // collStats may fail if the collection does not exist yet.
                        res = runCommandOriginal.call(
                            this,
                            dbName,
                            {collStats: commandObj.createIndexes},
                            options
                        );
                        collStatsCalled = true;
                    }
                    // If the collStats above fails, we skip disabling unique indexes.
                    if (res.ok === 1 && res.capped) {
                        indexSpec.unique = false;
                        shell.print('SERVER-32727: setting the "unique" field to false');
                    }
                }
            }
        }

        res = runCommandOriginal.apply(this, arguments);

        if (res.ok === 1 && !res.hasOwnProperty('writeErrors')) {
            ++stats.success;
        } else {
            ++stats.failure;
        }

        return res;
    };

    return function stopCollectingStats() {
        shell.Mongo.prototype.runCommand = runCommandOriginal;
        return stats;
    };
}

function rbprintStats(stats) {
    const totalCommandCount = stats.success + stats.failure + stats.skipped;

    shell.print(`[summary] ${stats.skipped} of ${totalCommandCount} commands were skipped`);
    shell.print(`[summary] ${stats.failure} of ${totalCommandCount} commands failed`);
}

const convertNewTransactionActionType = (action, fixture) => {
    if (
        shell.TestData.storageEngine &&
        shell.TestData.storageEngine !== 'wiredTiger' &&
        shell.TestData.storageEngine !== 'inMemory'
    ) {
        // Only the WiredTiger and InMemory storage engines supports transactions.
        // The InMemory storage engine only started to support transactions in MongoDB 4.2.
        return null;
    } else if (fixture.isV40 && shell.TestData.storageEngine !== 'inMemory') {
        // The "startTransaction" action type leaves the started transaction in an active state.
        // This behavior is geared around prepared transactions and is therefore not applicable when
        // running with a version earlier than MongoDB 4.2. We just treat it as if the
        // "runTransaction" action type had been specified when running with MongoDB 4.0.
        return 'runTransaction';
    } else if (fixture.isV42OrNewer) {
        if (shell.TestData.enableMajorityReadConcern === false) {
            // The "startTransaction" action type leaves the started transaction in an active state.
            // This behavior is geared around prepared transactions and is therefore not applicable when
            // running with --enableMajorityReadConcern=false. We just treat it as if the
            // "runTransaction" action type had been specified when the prepareTransaction command isn't
            // supported.
            return 'runTransaction';
        }
        return action;
    }

    return null;
};

const enableFailpointsImpl = (conn, fixture) => {
    // We set the "failNonIntentLocksIfWaitNeeded", "skipWriteConflictRetries", and
    // "WTSkipPrepareConflictRetries" failpoints so that running a command doesn't block forever if
    // there is an active transaction running.
    //
    // We additionally set the "skipCommitTxnCheckPrepareMajorityCommitted" failpoint in order to
    // always be able to run the prepareTransaction command without w="majority" (i.e. thus
    // implicitly run it with w=1) and for the server to not error when running the
    // commitTransaction command thereafter. This ensures we are always able to shell.assert that the
    // commitTransaction command succeeds.
    const canHaveOutstandingTxns =
        convertNewTransactionActionType('startTransaction', fixture) === 'startTransaction';

    const failpoints = [
        'failNonIntentLocksIfWaitNeeded',
        'skipCommitTxnCheckPrepareMajorityCommitted',
        'skipWriteConflictRetries',
        'WTSkipPrepareConflictRetries',
    ];

    if (canHaveOutstandingTxns) {
        for (let fp of failpoints) {
            shell.assert.commandWorked(
                conn.adminCommand({configureFailPoint: fp, mode: 'alwaysOn'})
            );
        }
    }

    return () => {
        if (canHaveOutstandingTxns) {
            for (let fp of failpoints) {
                shell.assert.commandWorked(
                    conn.adminCommand({configureFailPoint: fp, mode: 'off'})
                );
            }
        }
    };
};

// Exported so we can override in unit-testing.
const params = {
    enableFailpoints: enableFailpointsImpl,
};

/**
 * @typedef CmdWrapperType
 * @type {function(action, ops, commandIndex, fixture)}
 * @param {string} action
 * @param {Object} ops
 * @param {number} commandIndex
 * @param {RBFixture} fixture
 */

// Declare up front to work around the eslint no-use-before-define rule.
// takes params (action, ops, commandIndex, fixture)
/** @type {CmdWrapperType} */
let cmdWrapper;

/**
 * This function is called in place of a regular applyOps command.
 * One or more oplog entries is selected, massaged to remove unnecessary fields, and re-applied
 * through applyOps.
 */
const applyOpsWrapper = (commandIndex, fixture) => {
    const localDb = fixture.rollbackTest.getPrimary().getDB('local');
    // Randomly pick between 1 and 3 operations to include. We use commandIndex here so numOps
    // is fixed each time.
    const numOps = (commandIndex % 2) + 1;

    // Skip the 5 latest entries so we don't always apply the same entries that we just saw.
    // Ignore noop oplog entries as well.
    const oplogEntries = localDb.oplog.rs
        .find({op: {$ne: 'n'}})
        .sort({$natural: -1})
        .skip(5)
        .limit(numOps)
        .toArray();

    cmdWrapper(
        'admin',
        (() => {
            let applyOpsCmd;
            if (fixture.applyOpsCommands[commandIndex]) {
                applyOpsCmd = {applyOps: fixture.applyOpsCommands[commandIndex]};
            } else {
                fixture.applyOpsCommands[commandIndex] = oplogEntries;
                applyOpsCmd = {applyOps: oplogEntries};
            }
            return applyOpsCmd;
        })(),
        commandIndex,
        fixture
    );
};

cmdWrapper = (action, ops, commandIndex, fixture) => {
    if (action === '$fixtureCmd') {
        const cmdName = Object.keys(ops)[0];
        if (cmdName === 'restartNode') {
            // shell.RollbackTest#restartNode() is a no-op if shell.TestData.rollbackShutdowns isn't a truthy
            // value. We don't want to call TransactionManager#discardNonPreparedTransactions()
            // unless the in-memory state of the mongod process is actually being cleared and built
            // back up from replication startup recovery.
            if (shell.TestData.rollbackShutdowns) {
                // tslint:disable-next-line:ban
                const nodeId = parseInt(ops.nodeId, 10);
                // tslint:disable-next-line:ban
                const signal = parseInt(ops.signal, 10);
                const startOptions = undefined;
                const allowedExitCode = undefined;

                const rst = fixture.rollbackTest.getTestFixture();
                const primaryNodeId = rst.getNodeId(fixture.rollbackTest.getPrimary());
                const restartingPrimary = nodeId === primaryNodeId;

                const canHaveOutstandingTxns =
                    convertNewTransactionActionType('startTransaction', fixture) ===
                    'startTransaction';

                if (restartingPrimary) {
                    // A secondary may attempt to read from the oplog of the primary while we're
                    // running the validate command on it. We temporarily disable the
                    // failNonIntentLocksIfWaitNeeded failpoint in order to avoid causing the server
                    // to fassert() in this situation.
                    fixture.runFailPointCallback();
                }

                fixture.rollbackTest.restartNode(nodeId, signal, startOptions, allowedExitCode);

                if (restartingPrimary) {
                    // The primary may have changed after restarting the original primary if both it
                    // and the secondary were connected to the tiebreaker node.
                    const newPrimary = fixture.rollbackTest.getPrimary();
                    fixture.rollbackTxnManager.discardNonPreparedTransactions(newPrimary);
                    fixture.setFailPointCallback(params.enableFailpoints(newPrimary, fixture));
                }
            }
        } else if (cmdName === 'drainTransactions') {
            fixture.rollbackTxnManager.drainOutstandingTransactions(commandIndex);
        } else {
            throw new Error(`Unrecognized fixture command: ${cmdName}`);
        }
    } else if (action === 'applyOps') {
        applyOpsWrapper(commandIndex, fixture);
    } else if (action === 'startTransaction' || action === 'runTransaction') {
        action = convertNewTransactionActionType(action, fixture);
        ops = ops.commandObjs.map(cmdObj => ({dbName: ops.dbName, commandObj: cmdObj}));

        if (action === 'runTransaction') {
            fixture.rollbackTxnManager.runTransaction(ops, commandIndex);
        } else if (action === 'startTransaction') {
            fixture.rollbackTxnManager.startTransaction(ops, commandIndex);
        }
    } else if (action === 'prepareTransaction') {
        // The "prepareTransaction" action type is only relevant if we ran the "startTransaction"
        // action type earlier. This is only possible when running with MongoDB 4.2 or later.
        if (fixture.isV42OrNewer) {
            fixture.rollbackTxnManager.prepareTransaction(commandIndex);
        }
    } else if (action === 'commitTransaction') {
        // The "commitTransaction" action type is only relevant if we ran the "startTransaction"
        // action type earlier. This is only possible when running with MongoDB 4.2 or later.
        if (fixture.isV42OrNewer) {
            fixture.rollbackTxnManager.commitTransaction(commandIndex);
        }
    } else if (action === 'abortTransaction') {
        // The "abortTransaction" action type is only relevant if we ran the "startTransaction"
        // action type earlier. This is only possible when running with MongoDB 4.2 or later.
        if (fixture.isV42OrNewer) {
            fixture.rollbackTxnManager.abortTransaction(commandIndex);
        }
    } else {
        // We pass the dbName as the first argument if no special handling is needed.
        const dbName = action;
        const conn = fixture.rollbackTest.getPrimary();

        const myDb = conn.getDB(dbName);
        const res = myDb.runCommand(ops);

        let status = 'FAIL';
        if (res.ok) {
            // The "ok" field won't accurately track whether or not a write via the "insert",
            // "update", or "delete" commands actually happened since those would be reported in
            // writeErrors or writeConcernError. But we should never modify the database when ok=0.
            status = 'PASS';
        }
        let msg =
            `Completed cmd ${commandIndex}. STATUS: ${status}, PRIMARY: ${conn.host},` +
            ` DB: ${dbName}, COMMAND: ${shell.tojsononeline(ops)}`;
        if (!res.ok) {
            msg += `\nCmd ${commandIndex} Error: ${shell.tojsononeline(res)}`;
        }
        shell.print(msg);
    }
};

// This could definitely use some refactoring to make it more OO.
class RBFixture {
    constructor() {
        // Keep a record of all the applyOps commands and shell.print them out at the end. If a repro is needed,
        // copy and paste the list of applyOps commands from the original failed run.
        this.applyOpsCommands = {};

        if (shell.TestData.useRollbackTestDeluxe) {
            shell.load('jstests/replsets/libs/rollback_test_deluxe.js');
            this.rollbackTest = new shell.RollbackTestDeluxe('FiveNodeRollbackFuzzerTest');
        } else {
            shell.load('jstests/replsets/libs/rollback_test.js');
            this.rollbackTest = new shell.RollbackTest('RollbackFuzzerTest');
        }

        const mongodVersion = (() => {
            const res = this.rollbackTest
                .getPrimary()
                .getDB('test')
                .serverBuildInfo();
            shell.assert.commandWorked(res);

            return res.versionArray;
        })();

        this.isV40 = mongodVersion[0] === 4 && mongodVersion[1] === 0;
        this.isV42OrNewer =
            mongodVersion[0] > 4 || (mongodVersion[0] === 4 && mongodVersion[1] > 0);

        const replConfig = shell.assert.commandWorked(
            this.rollbackTest.getPrimary().adminCommand({replSetGetConfig: 1})
        ).config;
        const sessionOptions = {causalConsistency: false};
        const fuzzerName = TransactionManager.kRollback;

        this.rollbackTxnManager = new TransactionManager({
            primary: this.rollbackTest.getPrimary(),
            sessionOptions: sessionOptions,
            // When running transaction commands we set the j flag equal to the
            // writeConcernMajorityJournalDefault in order to match the durability
            // the operation would have from the coordinator running the command with
            // w="majority". Doing so also ensures that calling discardNonPreparedTransactions()
            // after the primary has been killed and restarted leads to the '_txns' array being
            // consistent with server's post-replication startup recovery state.
            journalPreparedTxns: replConfig.writeConcernMajorityJournalDefault,
            fuzzerName: fuzzerName,
        });
    }

    setFailPointCallback(cb) {
        this._disableFailpoints = cb;
    }

    runFailPointCallback() {
        this._disableFailpoints();
    }

    teardown() {
        this.rollbackTest.stop();
    }
}

/**
 * @param {RBFixture} fixture
 */
function runSteps(fixture) {
    fixture.setFailPointCallback(
        params.enableFailpoints(fixture.rollbackTest.getPrimary(), fixture)
    );

    for (let step of steps) {
        for (let op of step.steadyStateOps) {
            // Examples of op:
            //
            //  ["db_1", {"insert": "two", "documents": [{"_id": "293263403547384", c: {b: ["A0B", ]}, a: "CASELESS"}], "ordered": true, }, 0 ],
            //  ["commitTransaction",{}, 4 ],
            //  ["$fixtureCmd",{"restartNode": 1, "nodeId": 0, "signal": 9, }, 7 ]
            //
            // See rollbackGenerated.j2
            cmdWrapper(op[0], op[1], op[2], fixture);
        }

        fixture.runFailPointCallback();
        fixture.rollbackTest.transitionToRollbackOperations();
        fixture.rollbackTxnManager.markTransactionsAsMajorityCommitted();
        const rollbackNode = fixture.rollbackTest.getPrimary();
        fixture.setFailPointCallback(params.enableFailpoints(rollbackNode, fixture));

        for (let op of step.rolledBackOps) {
            cmdWrapper(op[0], op[1], op[2], fixture);
        }

        fixture.runFailPointCallback();

        const newPrimary = fixture.rollbackTest.transitionToSyncSourceOperationsBeforeRollback();
        fixture.rollbackTxnManager.resetTransactionsToMajorityCommittedState(newPrimary);
        fixture.setFailPointCallback(params.enableFailpoints(newPrimary, fixture));

        for (let op of step.syncSourceBeforeRollbackOps) {
            cmdWrapper(op[0], op[1], op[2], fixture);
        }

        fixture.rollbackTest.transitionToSyncSourceOperationsDuringRollback();

        for (let op of step.syncSourceDuringRollbackOps) {
            cmdWrapper(op[0], op[1], op[2], fixture);
        }

        // We skip running the data consistency checks if there any transactions outstanding. This
        // is necessary to avoid acquiring strong locks when there are still active transactions and
        // causing a hang. Note that this option doesn't exist in the version of shell.RollbackTest on the
        // 4.0 branch and so the extra argument to the transitionToSteadyStateOperations() method is
        // simply ignored.
        const skipDataConsistencyChecks = fixture.rollbackTxnManager.hasOutstandingTransactions();

        if (!skipDataConsistencyChecks) {
            // The second phase of two-phase collection drop is asynchronous and holds the global
            // lock in intent mode. The {fsync: 1, lock: 1} command may therefore need to wait for
            // the second phase to complete in order to acquire the global lock. We temporarily
            // disable the failNonIntentLocksIfWaitNeeded failpoint in order to avoid causing the
            // server to fassert in this situation.
            fixture.runFailPointCallback();
        }

        // The primary may no longer be 'newPrimary' if the node was restarted after 'rollbackNode'
        // finished its rollback.
        const currentPrimary = fixture.rollbackTest.transitionToSteadyStateOperations({
            skipDataConsistencyChecks: skipDataConsistencyChecks,
        });

        if (!skipDataConsistencyChecks) {
            fixture.setFailPointCallback(params.enableFailpoints(currentPrimary, fixture));
        }
    }

    // Drain any active transactions so running the data consistency checks won't lead to a hang.
    if (fixture.rollbackTxnManager.hasOutstandingTransactions()) {
        shell.jsTest.log('Draining active transactions before end of test');
        cmdWrapper('$fixtureCmd', {drainTransactions: 1}, -1, fixture);
    }

    fixture.runFailPointCallback();
}

function main() {
    log.setup({prefix: '[RollbackFuzzer] '});

    const fixture = new RBFixture();

    const stopCollectingStats = rbstartCollectingStats({
        isV40: fixture.isV40,
        isV42OrNewer: fixture.isV42OrNewer,
    });

    runSteps(fixture);

    const stats = stopCollectingStats();

    fixture.teardown();

    if (Object.keys(fixture.applyOpsCommands).length > 0) {
        shell.print(
            'Printing the list of applyOps commands. Please replace the' +
                ' `const applyOpsCommands = {}` line with the following for a more reliable repro:' +
                `\nconst applyOpsCommands = ${shell.tojsononeline(fixture.applyOpsCommands)}`
        );
    }

    rbprintStats(stats);
    shell.print('Transaction stats: ' + shell.tojson(fixture.rollbackTxnManager.stats()));
}

// import generated first: rollup puts it first

main();

}(this));
