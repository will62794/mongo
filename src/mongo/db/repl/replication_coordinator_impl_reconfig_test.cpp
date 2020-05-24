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

#define MONGO_LOGV2_DEFAULT_COMPONENT ::mongo::logv2::LogComponent::kDefault

#include "mongo/platform/basic.h"
#include <mongo/executor/thread_pool_mock.h>

#include "mongo/db/jsobj.h"
#include "mongo/db/repl/repl_server_parameters_gen.h"
#include "mongo/db/repl/repl_set_config.h"
#include "mongo/db/repl/repl_set_heartbeat_args_v1.h"
#include "mongo/db/repl/repl_set_heartbeat_response.h"
#include "mongo/db/repl/replication_coordinator.h"  // ReplSetReconfigArgs
#include "mongo/db/repl/replication_coordinator_external_state_mock.h"
#include "mongo/db/repl/replication_coordinator_impl.h"
#include "mongo/db/repl/replication_coordinator_test_fixture.h"
#include "mongo/executor/network_interface_mock.h"
#include "mongo/executor/thread_pool_mock.h"
#include "mongo/logv2/log.h"
#include "mongo/unittest/log_test.h"
#include "mongo/unittest/unittest.h"
#include "mongo/util/fail_point.h"

namespace mongo {
namespace repl {
namespace {

using executor::NetworkInterfaceMock;
using executor::RemoteCommandRequest;
using executor::RemoteCommandResponse;

typedef ReplicationCoordinator::ReplSetReconfigArgs ReplSetReconfigArgs;


TEST_F(ReplCoordTest, StepUpAndHeartbeatReconfigConcurrentNew) {
    auto severityGuard = unittest::MinimumLoggedSeverityGuard{logv2::LogComponent::kReplication,
                                                              logv2::LogSeverity::Debug(3)};
    auto electionTimeoutMillis = 10;
    assertStartSuccess(BSON("_id"
                            << "mySet"
                            << "settings"
                            << BSON("electionTimeoutMillis" << electionTimeoutMillis
                                                            << "heartbeatIntervalMillis" << 2)
                            << "version" << 2 << "term" << 0 << "members"
                            << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                     << "node1:12345")
                                          << BSON("_id" << 2 << "host"
                                                        << "node2:12345"))),
                       HostAndPort("node1", 12345));
    ASSERT_OK(getReplCoord()->setFollowerMode(MemberState::RS_SECONDARY));
    ASSERT_EQUALS(getReplCoord()->getTerm(), 0);
    replCoordSetMyLastAppliedOpTime(OpTime(Timestamp(100, 1), 0), Date_t() + Seconds(100));
    replCoordSetMyLastDurableOpTime(OpTime(Timestamp(100, 1), 0), Date_t() + Seconds(100));
    auto rsConfig = getReplCoord()->getConfig();
    auto electionTime = getReplCoord()->getElectionTimeout_forTest();
    NetworkInterfaceMock* net = getNet();

    //
    // Respond to a bunch of heartbeats so we know about other nodes health.
    //
    int responses = 0;
    auto beforeElectionTime = electionTime - Milliseconds(1);
    while (net->now() < beforeElectionTime && responses < 3) {
        getNet()->enterNetwork();
        net->runUntil(beforeElectionTime);
        logd("Ran clock until: {}", net->now());
        if (net->now() == beforeElectionTime) {
            break;
        }
        const NetworkInterfaceMock::NetworkOperationIterator noi = net->getNextReadyRequest();
        const RemoteCommandRequest& request = noi->getRequest();
        LOGV2(215240188,
              "{request_target} processing {request_cmdObj}",
              "request_target"_attr = request.target.toString(),
              "request_cmdObj"_attr = request.cmdObj);
        ReplSetHeartbeatArgsV1 hbArgs;
        Status status = hbArgs.initialize(request.cmdObj);
        if (status.isOK()) {
            ReplSetHeartbeatResponse hbResp;
            hbResp.setSetName(rsConfig.getReplSetName());
            hbResp.setState(MemberState::RS_SECONDARY);
            // The smallest valid optime in PV1.
            OpTime opTime(Timestamp(), 0);
            hbResp.setAppliedOpTimeAndWallTime({opTime, Date_t() + Seconds(opTime.getSecs())});
            hbResp.setDurableOpTimeAndWallTime({opTime, Date_t() + Seconds(opTime.getSecs())});
            hbResp.setConfigVersion(rsConfig.getConfigVersion());
            net->scheduleResponse(noi, net->now(), makeResponseStatus(hbResp.toBSON()));
            responses++;
        }
        net->runReadyNetworkOperations();
        mongo::sleepmillis(10);
        getNet()->exitNetwork();
    }

    // Data to keep for controlling concurrency.
    AtomicWord<bool> hbThreadDone{false};
    AtomicWord<bool> electionThreadDone{false};
    AtomicWord<bool> stepUpDone{false};
    AtomicWord<bool> mainThreadRunnable{false};
    AtomicWord<bool> mainThreadDone{false};

    //
    // Take control of mutex acquisition order.
    //
    logd("######## Enabling schedule control. ########");
    auto& replMutex = getReplCoord()->getMutex();
    replMutex.enableScheduleControl();

    auto inSet = [&](std::set<std::string> s, std::string item) { return s.find(item) != s.end(); };

    // Consider the set of runnable threads i.e. those not terminated or blocking on work. This
    // function waits for all of them to hit the synchronization point before proceeding.
    auto waitForAllThreads = [&]() {
        // Wait until all threads are either blocked on mutex, or not runnable.
        int numRunnable = 0;
        std::set<std::string> runnable;

        logd("Waiting for hbReconfig thread to be blocked or terminated");
        while (!inSet(replMutex.waiterThreadNames(), "hbReconfig") && !hbThreadDone.load()) {
            mongo::sleepmicros(100);
        }

        logd("Waiting for replexec thread to be blocked or terminated");
        while (true) {
            // Blocked on mutex.
            if (inSet(replMutex.waiterThreadNames(), "replexec")) {
                logd("replexec is blocked on mutex");
                break;
            }
            // Idle with no tasks
            if (executor::ThreadPoolMock::tpMockIsIdle.load() &&
                executor::ThreadPoolMock::numTasks.load() == 0) {
                logd("replexec is idle with no tasks");
                break;
            }
            mongo::sleepmicros(100);
        }

        logd("Waiting for main thread to be blocked or terminated");
        while(true){
            // Blocked on mutex.
            if(inSet(replMutex.waiterThreadNames(), "main")){
                logd("main is blocked on mutex");
                break;
            }
            // Not runnable and no ready requests to process.
            if(!getNet()->hasReadyRequests()){
                logd("main is not runnable");
                break;
            }

            if(mainThreadDone.load()){
                logd("main has terminated");
                break;
            }
            mongo::sleepmicros(100);
        }

        logd("Waiting for stepUp thread to be blocked or terminated");
        while (!inSet(replMutex.waiterThreadNames(), "stepUp") &&
               getReplCoord()->isStepUpRunnable() && !stepUpDone.load()) {
            mongo::sleepmicros(100);
        }

        // For now, sleep to make sure any threads that need to make progress have.
        // TODO: Fix racy behavior of waiting on threads.
        //        mongo::sleepmillis(5);
    };

    // The arbiter thread is the "scheduler" thread i.e. it determines which thread gets to acquire
    // the mutex at each synchronization point. Threads cannot proceed unless the arbiter threads
    // let them.
    stdx::thread arbiter = stdx::thread([&] {
        setThreadName("ARBITER");
        logd("Starting arbiter thread");
        // Wait for all threads to start up fully.
        mongo::sleepmillis(200);
        while (true) {
            // Wait for all runnable threads to be blocked on the mutex.
            waitForAllThreads();
            //            mongo::sleepmillis(10);

            // Record the current number of mutex releases.
            int initNumReleases = getReplCoord()->getMutex().numReleases();

            // Now we know that all runnable threads are blocked at the mutex synchronization point.
            // Now we just pick one of them to proceed. We  let a random next thread to proceed and
            // acquire the mutex.
            bool threadWent = getReplCoord()->getMutex().allowNextThread();
            if (!threadWent) {
                break;
            }

            // Wait until the thread finished its critical section.
            while (getReplCoord()->getMutex().numReleases() == initNumReleases) {
                mongo::sleepmicros(100);
            }
        }
        logd("### Arbiter quitting");
    });

    //
    // The thread to trigger the heartbeat reconfig.
    //
    stdx::thread hbReconfigThread([&] {
        setThreadName("hbReconfig");

        logd("### Starting hb reconfig thread.");
        // Receive a heartbeat that schedules a new heartbeat to fetch a newer config.
        ReplSetHeartbeatArgsV1 hbArgs;
        hbArgs.setConfigVersion(3);  // simulate a newer config version.
        hbArgs.setConfigTerm(0);     // force config.
        hbArgs.setSetName(rsConfig.getReplSetName());
        hbArgs.setSenderHost(HostAndPort("node2", 12345));

        hbArgs.setSenderId(2);
        hbArgs.setTerm(0);
        ASSERT(hbArgs.isInitialized());

        logd("### Processing heartbeat request.");
        ReplSetHeartbeatResponse response;
        ASSERT_OK(getReplCoord()->processHeartbeatV1(hbArgs, &response));

        // Schedule a response with a newer config.
        auto newerConfigVersion = 3;
        auto newerConfig = BSON("_id"
                                << "mySet"
                                << "settings"
                                << BSON("electionTimeoutMillis" << electionTimeoutMillis
                                                                << "heartbeatIntervalMillis" << 2)
                                << "version" << newerConfigVersion << "term" << 0 << "members"
                                << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                         << "node1:12345")
                                              << BSON("_id" << 2 << "host"
                                                            << "node2:12345")));

        auto net = getNet();
        OpTime lastApplied(Timestamp(100, 1), 0);
        ReplSetHeartbeatResponse hbResp;
        rsConfig = ReplSetConfig::parse(newerConfig);
        hbResp.setConfig(rsConfig);
        hbResp.setSetName(rsConfig.getReplSetName());
        hbResp.setState(MemberState::RS_SECONDARY);
        hbResp.setConfigVersion(rsConfig.getConfigVersion());
        hbResp.setConfigTerm(rsConfig.getConfigTerm());
        hbResp.setAppliedOpTimeAndWallTime(
            {lastApplied, Date_t() + Seconds(lastApplied.getSecs())});
        hbResp.setDurableOpTimeAndWallTime(
            {lastApplied, Date_t() + Seconds(lastApplied.getSecs())});

        logd("### Scheduling response to heartbeat.");
        getReplCoord()->handleHeartbeatResponse_forTest(hbResp.toBSON(), 1, Milliseconds(10));
        net->signalWorkAvailable();

        logd("### Heartbeat thread done.");
        hbThreadDone.store(true);
    });

    //
    // The thread to run the election.
    //
    stdx::thread stepUpThread([&] {
        setThreadName("stepUp");

        logd("### Starting step up thread.");
        auto st = getReplCoord()->stepUpIfEligible(false);
        logd("### step up result: {}", st);
        stepUpDone.store(true);
    });


    // Process requests until we're primary and consume the heartbeats for the notification
    // of election win.
    ReplicationCoordinatorImpl* replCoord = getReplCoord();
    bool hasReadyRequests = true;
    responses = 0;
    while (!replCoord->getMemberState().primary() || hasReadyRequests) {
        LOGV2(215230088, "Waiting on network");
        logd("Entering network.");
        getNet()->enterNetwork();

        // Don't respond to requests indefinitely.
        // TODO: Figure out how to determine the right number of requests to respond to here.
        if (responses > 8) {
            break;
        }

        // If the heartbeat thread is already done, quit.
        if (hbThreadDone.load() && responses == 0) {
            break;
        }

        // Wait for ready requests.
        logd("Waiting for next request");
        while(true){
            mainThreadRunnable.store(false);
            if (net->hasReadyRequests()) {
                break;
            }
            mongo::sleepmicros(100);
        }

        const NetworkInterfaceMock::NetworkOperationIterator noi = net->getNextReadyRequest();
        const RemoteCommandRequest& request = noi->getRequest();
        LOGV2(215240199,
              "{request_target} processing {request_cmdObj}",
              "request_target"_attr = request.target.toString(),
              "request_cmdObj"_attr = request.cmdObj);
        ReplSetHeartbeatArgsV1 hbArgs;
        Status status = hbArgs.initialize(request.cmdObj);
        if (status.isOK()) {
            ReplSetHeartbeatResponse hbResp;
            hbResp.setSetName(rsConfig.getReplSetName());
            hbResp.setState(MemberState::RS_SECONDARY);
            // The smallest valid optime in PV1.
            OpTime opTime(Timestamp(), 0);
            hbResp.setAppliedOpTimeAndWallTime({opTime, Date_t() + Seconds(opTime.getSecs())});
            hbResp.setDurableOpTimeAndWallTime({opTime, Date_t() + Seconds(opTime.getSecs())});
            hbResp.setConfigVersion(rsConfig.getConfigVersion());
            net->scheduleResponse(noi, net->now(), makeResponseStatus(hbResp.toBSON()));
            responses++;
            logd("Responded to {} requests.", responses);
        } else if (request.cmdObj.firstElement().fieldNameStringData() == "replSetRequestVotes") {
            net->scheduleResponse(
                noi,
                net->now(),
                makeResponseStatus(BSON("ok" << 1 << "reason"
                                             << ""
                                             << "term" << request.cmdObj["term"].Long()
                                             << "voteGranted" << true)));
            responses++;
            logd("Responded to {} requests.", responses);
        } else {
            net->blackHole(noi);
        }
        mainThreadRunnable.store(true);
        net->runReadyNetworkOperations();
        hasReadyRequests = net->hasReadyRequests();
        getNet()->exitNetwork();
    }

    // Complete drain mode if necessary.
    auto nowPrimary = replCoord->getMemberState().primary();
    if (nowPrimary) {
        // Wait a bit to make sure drain mode finished.
        mongo::sleepmillis(50);
        logd("### Running drain mode.");
        const auto opCtx = makeOperationContext();
        signalDrainComplete(opCtx.get());
    } else {
        logd("### Skipping drain mode.");
    }

    mainThreadRunnable.store(false);
    mainThreadDone.store(true);

    logd("### Waiting for thread completions.");
    stepUpThread.join();
    hbReconfigThread.join();

    logd("### Waiting for arbiter thread completion.");
    arbiter.join();
    logd("### Arbiter thread joined.");

    logd("######## Disabling schedule control. ########");
    getReplCoord()->getMutex().disableScheduleControl();

    if (nowPrimary) {
        // If we ran drain mode, ensure our config is in the right term.
        ASSERT_EQ(getReplCoord()->getConfig().getConfigTerm(), getReplCoord()->getTerm());
    }
}


//////////////////////////////////
//////////////////////////////////
//////////////////////////////////

TEST_F(ReplCoordTest, SimpleElection) {
    auto severityGuard = unittest::MinimumLoggedSeverityGuard{logv2::LogComponent::kReplication,
                                                              logv2::LogSeverity::Debug(3)};
    auto electionTimeoutMillis = 10;
    assertStartSuccess(BSON("_id"
                            << "mySet"
                            << "settings" << BSON("electionTimeoutMillis" << electionTimeoutMillis)
                            << "version" << 2 << "term" << 0 << "members"
                            << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                     << "node1:12345")
                                          << BSON("_id" << 2 << "host"
                                                        << "node2:12345"))),
                       HostAndPort("node1", 12345));
    ASSERT_OK(getReplCoord()->setFollowerMode(MemberState::RS_SECONDARY));
    ASSERT_EQUALS(getReplCoord()->getTerm(), 0);
    replCoordSetMyLastAppliedOpTime(OpTime(Timestamp(100, 1), 0), Date_t() + Seconds(100));
    replCoordSetMyLastDurableOpTime(OpTime(Timestamp(100, 1), 0), Date_t() + Seconds(100));
    auto rsConfig = getReplCoord()->getConfig();
    auto electionTime = getReplCoord()->getElectionTimeout_forTest();
    electionTime = electionTime + Milliseconds(1000);
    NetworkInterfaceMock* net = getNet();

    // Data to keep for controlling concurrency.
    AtomicWord<bool> electionThreadDone{false};

    // Take control of mutex acquisition order.
    logd("##################### Enabling schedule control. ###############");
    getReplCoord()->getMutex().enableScheduleControl();

    auto waitForAllThreads = [&]() {
        // Consider the set of runnable threads i.e. those not terminated or blocking on work. Wait
        // for all of them to hit the synchronization point before proceeding.
        int numRunnable = 0;
        numRunnable += (electionThreadDone.load() ? 0 : 1);
        numRunnable += (executor::ThreadPoolMock::tpMockIsIdle.load() ? 0 : 1);
        logd("Waiting for {} runnable threads.", numRunnable);
        while (getReplCoord()->getMutex().numWaiters() < numRunnable) {
            mongo::sleepmicros(100);
        }
    };

    stdx::thread arbiter = stdx::thread([&] {
        setThreadName("ARBITER");
        logd("Starting arbiter thread");
        // Wait for all threads to start up fully.
        mongo::sleepmillis(200);
        while (true) {
            // Wait for all runnable threads to be blocked on the mutex.
            waitForAllThreads();

            // Record the current number of mutex releases.
            int initNumReleases = getReplCoord()->getMutex().numReleases();

            // Now we know that all runnable threads are blocked at the mutex synchronization point.
            // Now we just pick one of them to proceed. We  let a random next thread to proceed and
            // acquire the mutex.
            bool threadWent = getReplCoord()->getMutex().allowNextThread();
            if (!threadWent) {
                logd("Arbiter quitting");
                break;
            }

            // Wait until the thread finished its critical section.
            while (getReplCoord()->getMutex().numReleases() == initNumReleases) {
                mongo::sleepmicros(100);
            }
        }
    });

    simulateSuccessfulV1Election();
    electionThreadDone.store(true);
    arbiter.join();
}

}  // anonymous namespace
}  // namespace repl
}  // namespace mongo
