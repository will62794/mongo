/**
 *    Copyright (C) 2018-present MongoDB, Inc.
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the Server Side Public License, version 1,
 *    as published by MongoDB, Inc.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    Server Side Public License for more details.
 *
 *    You should have received a copy of the Server Side Public License
 *    along with this program. If not, see
 *    <http://www.mongodb.com/licensing/server-side-public-license>.
 *
 *    As a special exception, the copyright holders give permission to link the
 *    code of portions of this program with the OpenSSL library under certain
 *    conditions as described in each individual source file and distribute
 *    linked combinations including the program with the OpenSSL library. You
 *    must comply with the Server Side Public License in all respects for
 *    all of the code used other than as permitted herein. If you modify file(s)
 *    with this exception, you may extend this exception to your version of the
 *    file(s), but you are not obligated to do so. If you do not wish to do so,
 *    delete this exception statement from your version. If you delete this
 *    exception statement from all source files in the program, then also delete
 *    it in the license file.
 */

#define MONGO_LOGV2_DEFAULT_COMPONENT ::mongo::logv2::LogComponent::kControl

#include "mongo/bson/bsonelement_comparator.h"
#include "mongo/bson/bsonobj_comparator.h"
#include "mongo/bson/simple_bsonelement_comparator.h"
#include "mongo/bson/simple_bsonobj_comparator.h"
#include "mongo/bson/unordered_fields_bsonobj_comparator.h"
#include "mongo/db/jsobj.h"
#include "mongo/db/json.h"
#include "mongo/platform/decimal128.h"
#include "mongo/platform/mutex.h"
#include "mongo/logv2/log.h"
#include "mongo/stdx/thread.h"
#include "mongo/platform/random.h"

#include "mongo/unittest/unittest.h"

namespace {
using namespace mongo;

TEST(BSONObj, threads) {
    Mutex lock = MONGO_MAKE_LATCH("mymutex");
    std::vector<int> history;
    int iters = 5;


// Start two threads that each push a value to a history vector inside a critical section some
    // number of times. The end state of the vector represents the interleaving of the two threads
    // for that execution.
    stdx::thread t1 = stdx::thread([&] {
        PseudoRandom rand((unsigned)curTimeMicros64());
        for (int i = 0; i < iters; i++) {
            mongo::sleepmillis(rand.nextInt64(8));
            lock.lock();
            history.push_back(1);
            lock.unlock();
        }
    });
    stdx::thread t2 = stdx::thread([&] {
        PseudoRandom rand((unsigned)curTimeMicros64());
        for (int i = 0; i < iters; i++) {
            mongo::sleepmillis(rand.nextInt64(8));
            lock.lock();
            history.push_back(2);
            lock.unlock();
        }
    });
    t1.join();
    t2.join();
    logd("final history: {}", history);
}

}  // unnamed namespace
