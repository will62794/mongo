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
    Mutex lock = MONGO_MAKE_LATCH("interleavemutex");
    std::vector<int> history;
    int iters = 3;

    AtomicWord<int> nextThread{0};
    AtomicWord<int> numWaiters{0};

    AtomicWord<int> t1Waiting{0};
    AtomicWord<int> t2Waiting{0};

    // Is the thread finished.
    AtomicWord<int> done1{0};
    AtomicWord<int> done2{0};


    stdx::thread arbiter = stdx::thread([&] {
        PseudoRandom rand((unsigned)curTimeMicros64());
        while(done1.load() + done2.load() < 2){
            // Wait until all threads are waiting to proceed.
            logd("Arbiter waiting for both threads.");
            while(t1Waiting.load() + t2Waiting.load() < 2){
                mongo::sleepmillis(2);
            }

            // Pick a random thread to proceed.
            int next = rand.nextInt64(2) + 1;
            // If either thread has finished, we must schedule the other thread.
            if(done1.load()){
                next = 2;
            }
            if(done2.load()){
                next = 1;
            }
            logd("Arbiter letting thread {} proceed.", next);

            // Clear the bits.
            t1Waiting.store(0);
            t2Waiting.store(0);

            // Let the thread proceed.
            nextThread.store(next);
        }
    });

    // Start two threads that each push a value to a history vector inside a critical section some
    // number of times. The end state of the vector represents the interleaving of the two threads
    // for that execution.
    stdx::thread t1 = stdx::thread([&] {
        for (int i = 0; i < iters; i++) {

            // Wait for your turn.
            logd("T1 waiting to proceed. numWaiters: {}, nextThread: {}", numWaiters.load(), nextThread.load());
            while(nextThread.load() != 1){
                t1Waiting.store(1);
                mongo::sleepmillis(2);
            }

            // Reset so you don't get through immediately next time.
            nextThread.store(0);

            lock.lock();
            logd("t1 pushing 1");
            history.push_back(1);
            lock.unlock();
        }

        done1.store(1);
    });
    stdx::thread t2 = stdx::thread([&] {
        for (int i = 0; i < iters; i++) {
            // Wait for your turn.
            logd("T2 waiting to proceed. numWaiters: {}, nextThread: {}", numWaiters.load(), nextThread.load());
            while(nextThread.load() != 2){
                t2Waiting.store(1);
                mongo::sleepmillis(2);
            }

            // Reset so you don't get through immediately next time.
            nextThread.store(0);

            lock.lock();
            logd("t2 pushing 2");
            history.push_back(2);
            lock.unlock();
        }

        done2.store(1);
    });

    t1.join();
    t2.join();
    arbiter.join();
    logd("final history: {}", history);
}

}  // unnamed namespace
