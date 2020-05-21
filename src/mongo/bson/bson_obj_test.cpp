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
#include "mongo/logv2/log.h"
#include "mongo/platform/decimal128.h"
#include "mongo/platform/mutex.h"
#include "mongo/platform/random.h"
#include "mongo/stdx/thread.h"

#include "mongo/unittest/unittest.h"

namespace {
using namespace mongo;


TEST(BSONObj, threads) {
    Mutex lock = MONGO_MAKE_LATCH("testmutex");
    std::vector<int> history;
    int iters = 3;

    AtomicWord<int> nextThread{0};

    AtomicWord<int> t1Waiting{0};
    AtomicWord<int> t2Waiting{0};

    // Is the thread finished.
    AtomicWord<int> done1{0};
    AtomicWord<int> done2{0};

    // Is a thread done its critical section.
    AtomicWord<int> doneCS{0};


    stdx::thread arbiter = stdx::thread([&] {
        // Wait for both threads to start up fully.
        mongo::sleepmillis(200);

        auto srand = SecureRandom();
        while (done1.load() + done2.load() < 2) {
            // Wait 50ms, after which we assume that any runnable threads that need the mutex will
            // now be blocked on it.
//            logd("Arbiter waiting for both threads.");
            mongo::sleepmillis(50);

            // Let a random next thread to proceed and acquire the mutex.
            bool threadWent = lock.allowNextThread();
            if(!threadWent){
                return;
            }

//            // If both threads are waiting, pick a random one to proceed.
//            int next;
//            if(t1Waiting.load()==1 && t2Waiting.load()==1){
//                next = srand.nextInt64(2) + 1;
//            } else{
//                if(t1Waiting.load() || t2Waiting.load() == 1){
//                    next = t1Waiting.load() == 1 ? 1 : 2;
//                } else{
//                    // Terminate if no threads are waiting.
//                    return;
//                }
//            }


//            // Wait until all threads are waiting to proceed.
//            // Wait for T1, only if it's still running.
//            while (!t1Waiting.load() && done1.load() == 0) {
//                mongo::sleepmicros(50);
//            }
//            // Wait for T2, only if it's still running.
//            while (!t2Waiting.load() && done2.load() == 0) {
//                mongo::sleepmicros(50);
//            }
//
//            // Pick a random thread to proceed.
//            int next = srand.nextInt64(2) + 1;
//            // If either thread has finished, we must schedule the other thread.
//            if (done1.load()) {
//                next = 2;
//            }
//            if (done2.load()) {
//                next = 1;
//            }
//            logd("Arbiter letting thread {} proceed.", next);

            // Let the thread proceed.
//            nextThread.store(next);

//            // Wait for the thread to have finished its critical section.
//            logd("Arbiter waiting for thread {} to complete critical section.", next);
//            while (doneCS.load() != 1) {
//                mongo::sleepmicros(50);
//            }
//
//            // Reset the flag.
//            doneCS.store(0);
        }
    });

//    // Start two threads that each push a value to a history vector inside a critical section some
//    // number of times. The end state of the vector represents the interleaving of the two threads
//    // for that execution.
//    stdx::thread t1 = stdx::thread([&] {
//        for (int i = 0; i < iters; i++) {
//            // Wait for your turn.
//            t1Waiting.store(1);
//            logd("T1 waiting to proceed. nextThread: {}", nextThread.load());
//            while (nextThread.load() != 1) {
//                mongo::sleepmicros(50);
//            }
//
//            // We are now proceeding, so no longer waiting.
//            t1Waiting.store(0);
//
//            // Reset so you don't get through immediately next time.
//            nextThread.store(0);
//
//            lock.lock();
//            logd("t1 pushing 1");
//            history.push_back(1);
//            lock.unlock();
//
//            logd("T1 completed critical section.");
//            doneCS.store(1);
//        }
//
//        done1.store(1);
//    });
//    stdx::thread t2 = stdx::thread([&] {
//        for (int i = 0; i < iters; i++) {
//            // Wait for your turn.
//            t2Waiting.store(1);
//            logd("T2 waiting to proceed. nextThread: {}", nextThread.load());
//            while (nextThread.load() != 2) {
//                mongo::sleepmicros(50);
//            }
//
//            // We are now proceeding, so no longer waiting.
//            t2Waiting.store(0);
//
//            // Reset so you don't get through immediately next time.
//            nextThread.store(0);
//
//            lock.lock();
//            logd("t2 pushing 2");
//            history.push_back(2);
//            lock.unlock();
//            doneCS.store(1);
//        }
//
//        done2.store(1);
//    });


    // Start two threads that each push a value to a history vector inside a critical section some
    // number of times. The end state of the vector represents the interleaving of the two threads
    // for that execution.
    stdx::thread t1 = stdx::thread([&] {
        for (int i = 0; i < iters; i++) {
            lock.lock();
            logd("t1 pushing");
            history.push_back(1);
            lock.unlock();
        }
    });

    stdx::thread t2 = stdx::thread([&] {
        for (int i = 0; i < iters; i++) {
            lock.lock();
            logd("t2 pushing");
            history.push_back(2);
            lock.unlock();
        }
    });

    t1.join();
    t2.join();
    arbiter.join();
    logd("final history: {}", history);
}

}  // unnamed namespace
