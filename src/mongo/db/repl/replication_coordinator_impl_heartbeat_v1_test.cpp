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

#define MONGO_LOG_DEFAULT_COMPONENT ::mongo::logger::LogComponent::kReplication

#include "mongo/platform/basic.h"

#include "mongo/bson/json.h"
#include "mongo/db/jsobj.h"
#include "mongo/db/operation_context_noop.h"
#include "mongo/db/repl/repl_set_config.h"
#include "mongo/db/repl/repl_set_heartbeat_args_v1.h"
#include "mongo/db/repl/replication_coordinator_external_state_mock.h"
#include "mongo/db/repl/replication_coordinator_impl.h"
#include "mongo/db/repl/replication_coordinator_test_fixture.h"
#include "mongo/db/repl/topology_coordinator.h"
#include "mongo/executor/network_interface_mock.h"
#include "mongo/rpc/metadata/repl_set_metadata.h"
#include "mongo/unittest/unittest.h"
#include "mongo/util/log.h"

namespace mongo {
namespace repl {
namespace {

using executor::NetworkInterfaceMock;
using executor::RemoteCommandRequest;
using executor::RemoteCommandResponse;

class ReplCoordHBV1Test : public ReplCoordTest {
protected:
    void assertMemberState(MemberState expected, std::string msg = "");
    ReplSetHeartbeatResponse receiveHeartbeatFrom(const ReplSetConfig& rsConfig,
                                                  int sourceId,
                                                  const HostAndPort& source);
};

void ReplCoordHBV1Test::assertMemberState(const MemberState expected, std::string msg) {
    const MemberState actual = getReplCoord()->getMemberState();
    ASSERT(expected == actual) << "Expected coordinator to report state " << expected.toString()
                               << " but found " << actual.toString() << " - " << msg;
}

ReplSetHeartbeatResponse ReplCoordHBV1Test::receiveHeartbeatFrom(const ReplSetConfig& rsConfig,
                                                                 int sourceId,
                                                                 const HostAndPort& source) {
    ReplSetHeartbeatArgsV1 hbArgs;
    hbArgs.setConfigVersion(rsConfig.getConfigVersion());
    hbArgs.setConfigTerm(rsConfig.getConfigTerm());
    hbArgs.setSetName(rsConfig.getReplSetName());
    hbArgs.setSenderHost(source);
    hbArgs.setSenderId(sourceId);
    hbArgs.setTerm(1);
    ASSERT(hbArgs.isInitialized());

    ReplSetHeartbeatResponse response;
    ASSERT_OK(getReplCoord()->processHeartbeatV1(hbArgs, &response));
    return response;
}

TEST_F(ReplCoordHBV1Test,
       NodeJoinsExistingReplSetWhenReceivingAConfigContainingTheNodeViaHeartbeat) {
    setMinimumLoggedSeverity(logger::LogSeverity::Debug(3));
    ReplSetConfig rsConfig = assertMakeRSConfig(BSON("_id"
                                                     << "mySet"
                                                     << "version" << 3 << "members"
                                                     << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                                              << "h1:1")
                                                                   << BSON("_id" << 2 << "host"
                                                                                 << "h2:1")
                                                                   << BSON("_id" << 3 << "host"
                                                                                 << "h3:1"))
                                                     << "protocolVersion" << 1));
    init("mySet");
    addSelf(HostAndPort("h2", 1));
    const Date_t startDate = getNet()->now();
    start();
    enterNetwork();
    assertMemberState(MemberState::RS_STARTUP);
    NetworkInterfaceMock* net = getNet();
    ASSERT_FALSE(net->hasReadyRequests());
    exitNetwork();
    receiveHeartbeatFrom(rsConfig, 1, HostAndPort("h1", 1));

    enterNetwork();
    NetworkInterfaceMock::NetworkOperationIterator noi = net->getNextReadyRequest();
    const RemoteCommandRequest& request = noi->getRequest();
    ASSERT_EQUALS(HostAndPort("h1", 1), request.target);
    ReplSetHeartbeatArgsV1 hbArgs;
    ASSERT_OK(hbArgs.initialize(request.cmdObj));
    ASSERT_EQUALS("mySet", hbArgs.getSetName());
    ASSERT_EQUALS(-2, hbArgs.getConfigVersion());
    ASSERT_EQUALS(OpTime::kInitialTerm, hbArgs.getTerm());
    ReplSetHeartbeatResponse hbResp;
    hbResp.setSetName("mySet");
    hbResp.setState(MemberState::RS_PRIMARY);
    hbResp.setConfigVersion(rsConfig.getConfigVersion());
    hbResp.setConfig(rsConfig);
    // The smallest valid optime in PV1.
    OpTime opTime(Timestamp(), 0);
    hbResp.setAppliedOpTimeAndWallTime({opTime, Date_t()});
    hbResp.setDurableOpTimeAndWallTime({opTime, Date_t()});
    BSONObjBuilder responseBuilder;
    responseBuilder << "ok" << 1;
    hbResp.addToBSON(&responseBuilder);
    net->scheduleResponse(
        noi, startDate + Milliseconds(200), makeResponseStatus(responseBuilder.obj()));
    assertRunUntil(startDate + Milliseconds(200));

    // Because the new config is stored using an out-of-band thread, we need to perform some
    // extra synchronization to let the executor finish the heartbeat reconfig.  We know that
    // after the out-of-band thread completes, it schedules new heartbeats.  We assume that no
    // other network operations get scheduled during or before the reconfig, though this may
    // cease to be true in the future.
    noi = net->getNextReadyRequest();

    assertMemberState(MemberState::RS_STARTUP2);
    OperationContextNoop opCtx;
    ReplSetConfig storedConfig;
    ASSERT_OK(storedConfig.initialize(
        unittest::assertGet(getExternalState()->loadLocalConfigDocument(&opCtx))));
    ASSERT_OK(storedConfig.validate());
    ASSERT_EQUALS(3, storedConfig.getConfigVersion());
    ASSERT_EQUALS(3, storedConfig.getNumMembers());
    exitNetwork();

    ASSERT_TRUE(getExternalState()->threadsStarted());
}

TEST_F(ReplCoordHBV1Test, NodeSchedulesHeartbeatToFetchConfigIfItHearsAboutNewerConfig) {
    setMinimumLoggedSeverity(logger::LogSeverity::Debug(3));
    auto configTerm = 1;
    auto lowerConfigVersion = 3;
    auto higherConfigVersion = 4;
    ReplSetConfig rsConfig = assertMakeRSConfig(BSON("_id"
                                                     << "mySet"
                                                     << "version" << lowerConfigVersion << "term"
                                                     << configTerm << "members"
                                                     << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                                              << "h1:1")
                                                                   << BSON("_id" << 2 << "host"
                                                                                 << "h2:1")
                                                                   << BSON("_id" << 3 << "host"
                                                                                 << "h3:1"))
                                                     << "protocolVersion" << 1));
    init("mySet");
    addSelf(HostAndPort("h2", 1));
    const Date_t startDate = getNet()->now();
    start();
    enterNetwork();
    assertMemberState(MemberState::RS_STARTUP);
    NetworkInterfaceMock* net = getNet();
    ASSERT_FALSE(net->hasReadyRequests());
    exitNetwork();

    // Learn about a newer config via heartbeat request.
    log() << "### RECEIVING heartbeat with config version: " << rsConfig.getConfigVersion();
    receiveHeartbeatFrom(rsConfig, 1, HostAndPort("h1", 1));

    //
    // Install the initial config.
    //
    enterNetwork();
    NetworkInterfaceMock::NetworkOperationIterator noi = net->getNextReadyRequest();
    const RemoteCommandRequest& request = noi->getRequest();
    ASSERT_EQUALS(HostAndPort("h1", 1), request.target);
    ReplSetHeartbeatArgsV1 hbArgs;
    ASSERT_OK(hbArgs.initialize(request.cmdObj));
    ASSERT_EQUALS("mySet", hbArgs.getSetName());
    ASSERT_EQUALS(-2, hbArgs.getConfigVersion());
    ASSERT_EQUALS(OpTime::kInitialTerm, hbArgs.getTerm());
    ReplSetHeartbeatResponse hbResp;
    hbResp.setSetName("mySet");
    hbResp.setState(MemberState::RS_PRIMARY);
    hbResp.setConfigVersion(rsConfig.getConfigVersion());
    hbResp.setConfig(rsConfig);
    // The smallest valid optime in PV1.
    OpTime opTime(Timestamp(), 0);
    hbResp.setAppliedOpTimeAndWallTime({opTime, Date_t()});
    hbResp.setDurableOpTimeAndWallTime({opTime, Date_t()});
    BSONObjBuilder responseBuilder;
    responseBuilder << "ok" << 1;
    hbResp.addToBSON(&responseBuilder);
    log() << "### SCHEDULING response to heartbeat to give new config with version: "
          << rsConfig.getConfigVersion();
    net->scheduleResponse(
        noi, startDate + Milliseconds(200), makeResponseStatus(responseBuilder.obj()));
    assertRunUntil(startDate + Milliseconds(200));

    // Blackhole the two outstanding heartbeat requests since we're not interested in them.
    log() << "### Black-holing two oustanding hb requests.";
    net->blackHole(net->getNextReadyRequest());
    net->blackHole(net->getNextReadyRequest());

    ////////////////////////////


    ReplSetConfig rsConfigNew = assertMakeRSConfig(BSON("_id"
                                                        << "mySet"
                                                        << "version" << higherConfigVersion
                                                        << "term" << configTerm << "members"
                                                        << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                                                 << "h1:1")
                                                                      << BSON("_id" << 2 << "host"
                                                                                    << "h2:1")
                                                                      << BSON("_id" << 3 << "host"
                                                                                    << "h3:1"))
                                                        << "protocolVersion" << 1));
    log() << "### RECEIVING heartbeat with config version: " << rsConfigNew.getConfigVersion();
    receiveHeartbeatFrom(rsConfigNew, 1, HostAndPort("h1", 1));

    noi = net->getNextReadyRequest();
    const RemoteCommandRequest& hbrequest1 = noi->getRequest();
    ASSERT_EQUALS(HostAndPort("h1", 1), hbrequest1.target);
    ASSERT_OK(hbArgs.initialize(hbrequest1.cmdObj));
    ASSERT_EQUALS("mySet", hbArgs.getSetName());
    ASSERT_EQUALS(3, hbArgs.getConfigVersion());
    ASSERT_EQUALS(OpTime::kInitialTerm, hbArgs.getTerm());
    unittest::log() << "### REQUEST SCHEDULED: " << hbrequest1.cmdObj;

    // Don't respond to this request.
    net->blackHole(noi);

    // Config with newer term.
    ReplSetConfig rsConfigNewTerm =
        assertMakeRSConfig(BSON("_id"
                                << "mySet"
                                << "version" << lowerConfigVersion << "term" << (configTerm + 1)
                                << "members"
                                << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                         << "h1:1")
                                              << BSON("_id" << 2 << "host"
                                                            << "h2:1")
                                              << BSON("_id" << 3 << "host"
                                                            << "h3:1"))
                                << "protocolVersion" << 1));


    log() << "### RECEIVING heartbeat with config term: " << rsConfigNewTerm.getConfigTerm();
    receiveHeartbeatFrom(rsConfigNewTerm, 1, HostAndPort("h1", 1));

    log() << "Going to get next ready request.";
    noi = net->getNextReadyRequest();
    const RemoteCommandRequest& hbrequest2 = noi->getRequest();
    ASSERT_EQUALS(HostAndPort("h1", 1), hbrequest2.target);
    ASSERT_OK(hbArgs.initialize(hbrequest2.cmdObj));
    ASSERT_EQUALS("mySet", hbArgs.getSetName());
    ASSERT_EQUALS(3, hbArgs.getConfigVersion());
    ASSERT_EQUALS(OpTime::kInitialTerm, hbArgs.getTerm());
    unittest::log() << "### REQUEST SCHEDULED: " << hbrequest2.cmdObj;
    net->blackHole(noi);

    // Shouldn't schedule any heartbeat.
    log() << "### RECEIVING heartbeat with config term: " << rsConfigNewTerm.getConfigTerm();
    receiveHeartbeatFrom(rsConfig, 1, HostAndPort("h1", 1));
    ASSERT_FALSE(net->hasReadyRequests());
}

TEST_F(ReplCoordHBV1Test, AwaitIsMasterReturnsResponseOnReconfigViaHeartbeat) {
    init();
    assertStartSuccess(BSON("_id"
                            << "mySet"
                            << "version" << 2 << "members"
                            << BSON_ARRAY(BSON("host"
                                               << "node1:12345"
                                               << "_id" << 0)
                                          << BSON("host"
                                                  << "node2:12345"
                                                  << "_id" << 1))),
                       HostAndPort("node1", 12345));

    // Become primary.
    ASSERT_OK(getReplCoord()->setFollowerMode(MemberState::RS_SECONDARY));
    replCoordSetMyLastAppliedOpTime(OpTime(Timestamp(100, 1), 0), Date_t() + Seconds(100));
    replCoordSetMyLastDurableOpTime(OpTime(Timestamp(100, 1), 0), Date_t() + Seconds(100));
    simulateSuccessfulV1Election();
    ASSERT(getReplCoord()->getMemberState().primary());

    auto maxAwaitTime = Milliseconds(5000);
    auto deadline = getNet()->now() + maxAwaitTime;

    auto currentTopologyVersion = getTopoCoord().getTopologyVersion();
    auto expectedProcessId = currentTopologyVersion.getProcessId();
    // A reconfig should increment the TopologyVersion counter.
    auto expectedCounter = currentTopologyVersion.getCounter() + 1;
    auto opCtx = makeOperationContext();
    // awaitIsMasterResponse blocks and waits on a future when the request TopologyVersion equals
    // the current TopologyVersion of the server.
    stdx::thread getIsMasterThread([&] {
        auto response = getReplCoord()->awaitIsMasterResponse(
            opCtx.get(), {}, currentTopologyVersion, deadline);
        auto topologyVersion = response->getTopologyVersion();
        ASSERT_EQUALS(topologyVersion->getCounter(), expectedCounter);
        ASSERT_EQUALS(topologyVersion->getProcessId(), expectedProcessId);

        // Ensure the isMasterResponse contains the newly added node.
        const auto hosts = response->getHosts();
        ASSERT_EQUALS(3, hosts.size());
        ASSERT_EQUALS("node3", hosts[2].host());
    });

    setMinimumLoggedSeverity(logger::LogSeverity::Debug(3));
    ReplSetConfig rsConfig =
        assertMakeRSConfig(BSON("_id"
                                << "mySet"
                                << "version" << 3 << "protocolVersion" << 1 << "members"
                                << BSON_ARRAY(BSON("_id" << 0 << "host"
                                                         << "node1:12345"
                                                         << "priority" << 3)
                                              << BSON("_id" << 1 << "host"
                                                            << "node2:12345")
                                              << BSON("_id" << 2 << "host"
                                                            << "node3:12345"))));
    const Date_t startDate = getNet()->now();

    enterNetwork();
    NetworkInterfaceMock* net = getNet();
    ASSERT_FALSE(net->hasReadyRequests());
    exitNetwork();
    receiveHeartbeatFrom(rsConfig, 1, HostAndPort("node2", 12345));

    enterNetwork();
    NetworkInterfaceMock::NetworkOperationIterator noi = net->getNextReadyRequest();
    ReplSetHeartbeatResponse hbResp;
    hbResp.setSetName("mySet");
    hbResp.setState(MemberState::RS_PRIMARY);
    hbResp.setConfigVersion(rsConfig.getConfigVersion());
    hbResp.setConfig(rsConfig);
    // The smallest valid optime in PV1.
    OpTime opTime(Timestamp(), 0);
    hbResp.setAppliedOpTimeAndWallTime({opTime, Date_t()});
    hbResp.setDurableOpTimeAndWallTime({opTime, Date_t()});
    BSONObjBuilder responseBuilder;
    responseBuilder << "ok" << 1;
    hbResp.addToBSON(&responseBuilder);
    net->scheduleResponse(
        noi, startDate + Milliseconds(200), makeResponseStatus(responseBuilder.obj()));
    assertRunUntil(startDate + Milliseconds(200));

    // Because the new config is stored using an out-of-band thread, we need to perform some
    // extra synchronization to let the executor finish the heartbeat reconfig.  We know that
    // after the out-of-band thread completes, it schedules new heartbeats.  We assume that no
    // other network operations get scheduled during or before the reconfig, though this may
    // cease to be true in the future.
    noi = net->getNextReadyRequest();

    exitNetwork();
    getIsMasterThread.join();
}

TEST_F(ReplCoordHBV1Test,
       ArbiterJoinsExistingReplSetWhenReceivingAConfigContainingTheArbiterViaHeartbeat) {
    setMinimumLoggedSeverity(logger::LogSeverity::Debug(3));
    ReplSetConfig rsConfig =
        assertMakeRSConfig(BSON("_id"
                                << "mySet"
                                << "version" << 3 << "members"
                                << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                         << "h1:1")
                                              << BSON("_id" << 2 << "host"
                                                            << "h2:1"
                                                            << "arbiterOnly" << true)
                                              << BSON("_id" << 3 << "host"
                                                            << "h3:1"))
                                << "protocolVersion" << 1));
    init("mySet");
    addSelf(HostAndPort("h2", 1));
    const Date_t startDate = getNet()->now();
    start();
    enterNetwork();
    assertMemberState(MemberState::RS_STARTUP);
    NetworkInterfaceMock* net = getNet();
    ASSERT_FALSE(net->hasReadyRequests());
    exitNetwork();
    receiveHeartbeatFrom(rsConfig, 1, HostAndPort("h1", 1));

    enterNetwork();
    NetworkInterfaceMock::NetworkOperationIterator noi = net->getNextReadyRequest();
    const RemoteCommandRequest& request = noi->getRequest();
    ASSERT_EQUALS(HostAndPort("h1", 1), request.target);
    ReplSetHeartbeatArgsV1 hbArgs;
    ASSERT_OK(hbArgs.initialize(request.cmdObj));
    ASSERT_EQUALS("mySet", hbArgs.getSetName());
    ASSERT_EQUALS(-2, hbArgs.getConfigVersion());
    ASSERT_EQUALS(OpTime::kInitialTerm, hbArgs.getTerm());
    ReplSetHeartbeatResponse hbResp;
    hbResp.setSetName("mySet");
    hbResp.setState(MemberState::RS_PRIMARY);
    hbResp.setConfigVersion(rsConfig.getConfigVersion());
    hbResp.setConfig(rsConfig);
    // The smallest valid optime in PV1.
    OpTime opTime(Timestamp(), 0);
    hbResp.setAppliedOpTimeAndWallTime({opTime, Date_t()});
    hbResp.setDurableOpTimeAndWallTime({opTime, Date_t()});
    BSONObjBuilder responseBuilder;
    responseBuilder << "ok" << 1;
    hbResp.addToBSON(&responseBuilder);
    net->scheduleResponse(
        noi, startDate + Milliseconds(200), makeResponseStatus(responseBuilder.obj()));
    assertRunUntil(startDate + Milliseconds(200));

    // Because the new config is stored using an out-of-band thread, we need to perform some
    // extra synchronization to let the executor finish the heartbeat reconfig.  We know that
    // after the out-of-band thread completes, it schedules new heartbeats.  We assume that no
    // other network operations get scheduled during or before the reconfig, though this may
    // cease to be true in the future.
    noi = net->getNextReadyRequest();

    assertMemberState(MemberState::RS_ARBITER);
    OperationContextNoop opCtx;
    ReplSetConfig storedConfig;
    ASSERT_OK(storedConfig.initialize(
        unittest::assertGet(getExternalState()->loadLocalConfigDocument(&opCtx))));
    ASSERT_OK(storedConfig.validate());
    ASSERT_EQUALS(3, storedConfig.getConfigVersion());
    ASSERT_EQUALS(3, storedConfig.getNumMembers());
    exitNetwork();

    ASSERT_FALSE(getExternalState()->threadsStarted());
}

TEST_F(ReplCoordHBV1Test,
       NodeDoesNotJoinExistingReplSetWhenReceivingAConfigNotContainingTheNodeViaHeartbeat) {
    // Tests that a node in RS_STARTUP will not transition to RS_REMOVED if it receives a
    // configuration that does not contain it.
    setMinimumLoggedSeverity(logger::LogSeverity::Debug(3));
    ReplSetConfig rsConfig = assertMakeRSConfig(BSON("_id"
                                                     << "mySet"
                                                     << "version" << 3 << "members"
                                                     << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                                              << "h1:1")
                                                                   << BSON("_id" << 2 << "host"
                                                                                 << "h2:1")
                                                                   << BSON("_id" << 3 << "host"
                                                                                 << "h3:1"))
                                                     << "protocolVersion" << 1));
    init("mySet");
    addSelf(HostAndPort("h4", 1));
    const Date_t startDate = getNet()->now();
    start();
    enterNetwork();
    assertMemberState(MemberState::RS_STARTUP, "1");
    NetworkInterfaceMock* net = getNet();
    ASSERT_FALSE(net->hasReadyRequests());
    exitNetwork();
    receiveHeartbeatFrom(rsConfig, 1, HostAndPort("h1", 1));

    enterNetwork();
    NetworkInterfaceMock::NetworkOperationIterator noi = net->getNextReadyRequest();
    const RemoteCommandRequest& request = noi->getRequest();
    ASSERT_EQUALS(HostAndPort("h1", 1), request.target);
    ReplSetHeartbeatArgsV1 hbArgs;
    ASSERT_OK(hbArgs.initialize(request.cmdObj));
    ASSERT_EQUALS("mySet", hbArgs.getSetName());
    ASSERT_EQUALS(-2, hbArgs.getConfigVersion());
    ASSERT_EQUALS(OpTime::kInitialTerm, hbArgs.getTerm());
    ReplSetHeartbeatResponse hbResp;
    hbResp.setSetName("mySet");
    hbResp.setState(MemberState::RS_PRIMARY);
    hbResp.setConfigVersion(rsConfig.getConfigVersion());
    hbResp.setConfig(rsConfig);
    // The smallest valid optime in PV1.
    OpTime opTime(Timestamp(), 0);
    hbResp.setAppliedOpTimeAndWallTime({opTime, Date_t()});
    hbResp.setDurableOpTimeAndWallTime({opTime, Date_t()});
    BSONObjBuilder responseBuilder;
    responseBuilder << "ok" << 1;
    hbResp.addToBSON(&responseBuilder);
    net->scheduleResponse(
        noi, startDate + Milliseconds(50), makeResponseStatus(responseBuilder.obj()));
    assertRunUntil(startDate + Milliseconds(550));

    // Because the new config is stored using an out-of-band thread, we need to perform some
    // extra synchronization to let the executor finish the heartbeat reconfig.  We know that
    // after the out-of-band thread completes, it schedules new heartbeats.  We assume that no
    // other network operations get scheduled during or before the reconfig, though this may
    // cease to be true in the future.
    noi = net->getNextReadyRequest();

    assertMemberState(MemberState::RS_STARTUP, "2");
    OperationContextNoop opCtx;

    StatusWith<BSONObj> loadedConfig(getExternalState()->loadLocalConfigDocument(&opCtx));
    ASSERT_NOT_OK(loadedConfig.getStatus()) << loadedConfig.getValue();
    exitNetwork();
}

TEST_F(ReplCoordHBV1Test,
       NodeReturnsNotYetInitializedInResponseToAHeartbeatReceivedPriorToAConfig) {
    // ensure that if we've yet to receive an initial config, we return NotYetInitialized
    init("mySet");
    ReplSetHeartbeatArgsV1 hbArgs;
    hbArgs.setConfigVersion(3);
    hbArgs.setSetName("mySet");
    hbArgs.setSenderHost(HostAndPort("h1:1"));
    hbArgs.setSenderId(1);
    hbArgs.setTerm(1);
    ASSERT(hbArgs.isInitialized());

    ReplSetHeartbeatResponse response;
    Status status = getReplCoord()->processHeartbeatV1(hbArgs, &response);
    ASSERT_EQUALS(ErrorCodes::NotYetInitialized, status.code());
}

TEST_F(ReplCoordHBV1Test,
       NodeChangesToRecoveringStateWhenAllNodesRespondToHeartbeatsWithUnauthorized) {
    // Tests that a node that only has auth error heartbeats is recovering
    setMinimumLoggedSeverity(logger::LogSeverity::Debug(3));
    assertStartSuccess(BSON("_id"
                            << "mySet"
                            << "version" << 1 << "members"
                            << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                     << "node1:12345")
                                          << BSON("_id" << 2 << "host"
                                                        << "node2:12345"))),
                       HostAndPort("node1", 12345));
    ASSERT_OK(getReplCoord()->setFollowerMode(MemberState::RS_SECONDARY));

    // process heartbeat
    enterNetwork();
    const NetworkInterfaceMock::NetworkOperationIterator noi = getNet()->getNextReadyRequest();
    const RemoteCommandRequest& request = noi->getRequest();
    log() << request.target.toString() << " processing " << request.cmdObj;
    getNet()->scheduleResponse(
        noi,
        getNet()->now(),
        makeResponseStatus(BSON("ok" << 0.0 << "errmsg"
                                     << "unauth'd"
                                     << "code" << ErrorCodes::Unauthorized)));

    if (request.target != HostAndPort("node2", 12345) &&
        request.cmdObj.firstElement().fieldNameStringData() != "replSetHeartbeat") {
        error() << "Black holing unexpected request to " << request.target << ": "
                << request.cmdObj;
        getNet()->blackHole(noi);
    }
    getNet()->runReadyNetworkOperations();
    exitNetwork();

    ASSERT_TRUE(getTopoCoord().getMemberState().recovering());
    assertMemberState(MemberState::RS_RECOVERING, "0");
}

TEST_F(ReplCoordHBV1Test, IgnoreTheContentsOfMetadataWhenItsReplicaSetIdDoesNotMatchOurs) {
    // Tests that a secondary node will not update its committed optime from the heartbeat metadata
    // if the replica set ID is inconsistent with the existing configuration.
    HostAndPort host2("node2:12345");
    assertStartSuccess(BSON("_id"
                            << "mySet"
                            << "version" << 1 << "members"
                            << BSON_ARRAY(BSON("_id" << 1 << "host"
                                                     << "node1:12345")
                                          << BSON("_id" << 2 << "host" << host2.toString()))
                            << "settings" << BSON("replicaSetId" << OID::gen()) << "protocolVersion"
                            << 1),
                       HostAndPort("node1", 12345));
    ASSERT_OK(getReplCoord()->setFollowerMode(MemberState::RS_SECONDARY));

    auto rsConfig = getReplCoord()->getConfig();

    // Prepare heartbeat response.
    OID unexpectedId = OID::gen();
    OpTime opTime{Timestamp{10, 10}, 10};
    RemoteCommandResponse heartbeatResponse(ErrorCodes::InternalError, "not initialized");
    {
        ReplSetHeartbeatResponse hbResp;
        hbResp.setSetName(rsConfig.getReplSetName());
        hbResp.setState(MemberState::RS_PRIMARY);
        hbResp.setConfigVersion(rsConfig.getConfigVersion());
        hbResp.setAppliedOpTimeAndWallTime({opTime, Date_t()});
        hbResp.setDurableOpTimeAndWallTime({opTime, Date_t()});

        BSONObjBuilder responseBuilder;
        responseBuilder << "ok" << 1;
        hbResp.addToBSON(&responseBuilder);

        rpc::ReplSetMetadata metadata(opTime.getTerm(),
                                      {opTime, Date_t()},
                                      opTime,
                                      rsConfig.getConfigVersion(),
                                      unexpectedId,
                                      1,
                                      -1);
        uassertStatusOK(metadata.writeToMetadata(&responseBuilder));

        heartbeatResponse = makeResponseStatus(responseBuilder.obj());
    }

    // process heartbeat
    enterNetwork();
    auto net = getNet();
    while (net->hasReadyRequests()) {
        const NetworkInterfaceMock::NetworkOperationIterator noi = net->getNextReadyRequest();
        const RemoteCommandRequest& request = noi->getRequest();
        if (request.target == host2 &&
            request.cmdObj.firstElement().fieldNameStringData() == "replSetHeartbeat") {
            log() << request.target.toString() << " processing " << request.cmdObj;
            net->scheduleResponse(noi, net->now(), heartbeatResponse);
        } else {
            log() << "blackholing request to " << request.target.toString() << ": "
                  << request.cmdObj;
            net->blackHole(noi);
        }
        net->runReadyNetworkOperations();
    }
    exitNetwork();

    ASSERT_NOT_EQUALS(opTime, getReplCoord()->getLastCommittedOpTime());
    ASSERT_NOT_EQUALS(opTime.getTerm(), getTopoCoord().getTerm());

    BSONObjBuilder statusBuilder;
    ASSERT_OK(getReplCoord()->processReplSetGetStatus(
        &statusBuilder, ReplicationCoordinator::ReplSetGetStatusResponseStyle::kBasic));
    auto statusObj = statusBuilder.obj();
    unittest::log() << "replica set status = " << statusObj;

    ASSERT_EQ(mongo::Array, statusObj["members"].type());
    auto members = statusObj["members"].Array();
    ASSERT_EQ(2U, members.size());
    ASSERT_TRUE(members[1].isABSONObj());
    auto member = members[1].Obj();
    ASSERT_EQ(host2, HostAndPort(member["name"].String()));
    ASSERT_EQ(MemberState(MemberState::RS_DOWN).toString(),
              MemberState(member["state"].numberInt()).toString());
    ASSERT_EQ(member["lastHeartbeatMessage"].String(),
              std::string(str::stream()
                          << "replica set IDs do not match, ours: " << rsConfig.getReplicaSetId()
                          << "; remote node's: " << unexpectedId));
}

TEST_F(ReplCoordHBV1Test,
       LastCommittedOpTimeOnlyUpdatesFromHeartbeatWhenLastAppliedHasTheSameTerm) {
    // Ensure that the metadata is processed if it is contained in a heartbeat response.
    assertStartSuccess(BSON("_id"
                            << "mySet"
                            << "version" << 2 << "members"
                            << BSON_ARRAY(BSON("host"
                                               << "node1:12345"
                                               << "_id" << 0)
                                          << BSON("host"
                                                  << "node2:12345"
                                                  << "_id" << 1))
                            << "protocolVersion" << 1),
                       HostAndPort("node1", 12345));
    ASSERT_OK(getReplCoord()->setFollowerMode(MemberState::RS_SECONDARY));
    ASSERT_EQUALS(OpTime(), getReplCoord()->getLastCommittedOpTime());

    auto config = getReplCoord()->getConfig();

    auto opTime1 = OpTime({10, 1}, 1);
    auto opTime2 = OpTime({11, 1}, 2);  // In higher term.
    auto commitPoint = OpTime({15, 1}, 2);
    replCoordSetMyLastAppliedOpTime(opTime1, Date_t() + Seconds(100));

    // Node 1 is the current primary. The commit point has a higher term than lastApplied.
    rpc::ReplSetMetadata metadata(
        2,                                                         // term
        {commitPoint, Date_t() + Seconds(commitPoint.getSecs())},  // committed OpTime
        commitPoint,                                               // visibleOpTime
        config.getConfigVersion(),
        {},  // replset id
        1,   // currentPrimaryIndex,
        1);  // currentSyncSourceIndex

    auto net = getNet();
    BSONObjBuilder responseBuilder;
    ASSERT_OK(metadata.writeToMetadata(&responseBuilder));

    ReplSetHeartbeatResponse hbResp;
    hbResp.setConfigVersion(config.getConfigVersion());
    hbResp.setSetName(config.getReplSetName());
    hbResp.setState(MemberState::RS_PRIMARY);
    responseBuilder.appendElements(hbResp.toBSON());
    auto hbRespObj = responseBuilder.obj();
    {
        net->enterNetwork();
        ASSERT_TRUE(net->hasReadyRequests());
        auto noi = net->getNextReadyRequest();
        auto& request = noi->getRequest();
        ASSERT_EQUALS(config.getMemberAt(1).getHostAndPort(), request.target);
        ASSERT_EQUALS("replSetHeartbeat", request.cmdObj.firstElement().fieldNameStringData());

        net->scheduleResponse(noi, net->now(), makeResponseStatus(hbRespObj));
        net->runReadyNetworkOperations();
        net->exitNetwork();

        ASSERT_EQUALS(OpTime(), getReplCoord()->getLastCommittedOpTime());
        ASSERT_EQUALS(2, getReplCoord()->getTerm());
    }

    // Update lastApplied, so commit point can be advanced.
    replCoordSetMyLastAppliedOpTime(opTime2, Date_t() + Seconds(100));
    {
        net->enterNetwork();
        net->runUntil(net->now() + config.getHeartbeatInterval());
        auto noi = net->getNextReadyRequest();
        auto& request = noi->getRequest();
        ASSERT_EQUALS("replSetHeartbeat", request.cmdObj.firstElement().fieldNameStringData());

        net->scheduleResponse(noi, net->now(), makeResponseStatus(hbRespObj));
        net->runReadyNetworkOperations();
        net->exitNetwork();

        ASSERT_EQUALS(commitPoint, getReplCoord()->getLastCommittedOpTime());
    }
}

TEST_F(ReplCoordHBV1Test, LastCommittedOpTimeOnlyUpdatesFromHeartbeatIfNotInStartup) {
    // Ensure that the metadata is not processed if it is contained in a heartbeat response,
    // if we are in STARTUP2.
    assertStartSuccess(BSON("_id"
                            << "mySet"
                            << "version" << 2 << "members"
                            << BSON_ARRAY(BSON("host"
                                               << "node1:12345"
                                               << "_id" << 0)
                                          << BSON("host"
                                                  << "node2:12345"
                                                  << "_id" << 1))
                            << "protocolVersion" << 1),
                       HostAndPort("node1", 12345));
    ASSERT_EQUALS(OpTime(), getReplCoord()->getLastCommittedOpTime());

    auto config = getReplCoord()->getConfig();

    auto lastAppliedOpTime = OpTime({11, 1}, 2);
    auto commitPoint = OpTime({15, 1}, 2);
    replCoordSetMyLastAppliedOpTime(lastAppliedOpTime, Date_t() + Seconds(100));

    // Node 1 is the current primary.
    rpc::ReplSetMetadata metadata(
        2,                                                         // term
        {commitPoint, Date_t() + Seconds(commitPoint.getSecs())},  // committed OpTime
        commitPoint,                                               // visibleOpTime
        config.getConfigVersion(),
        {},  // replset id
        1,   // currentPrimaryIndex,
        1);  // currentSyncSourceIndex

    auto net = getNet();
    BSONObjBuilder responseBuilder;
    ASSERT_OK(metadata.writeToMetadata(&responseBuilder));

    ReplSetHeartbeatResponse hbResp;
    hbResp.setConfigVersion(config.getConfigVersion());
    hbResp.setSetName(config.getReplSetName());
    hbResp.setState(MemberState::RS_PRIMARY);
    responseBuilder.appendElements(hbResp.toBSON());
    auto hbRespObj = responseBuilder.obj();
    // Last committed optime should not advance in STARTUP2.
    ASSERT_EQ(getReplCoord()->getMemberState(), MemberState::RS_STARTUP2);
    {
        net->enterNetwork();
        ASSERT_TRUE(net->hasReadyRequests());
        auto noi = net->getNextReadyRequest();
        auto& request = noi->getRequest();
        ASSERT_EQUALS(config.getMemberAt(1).getHostAndPort(), request.target);
        ASSERT_EQUALS("replSetHeartbeat", request.cmdObj.firstElement().fieldNameStringData());

        net->scheduleResponse(noi, net->now(), makeResponseStatus(hbRespObj));
        net->runReadyNetworkOperations();
        net->exitNetwork();

        ASSERT_EQUALS(OpTime(), getReplCoord()->getLastCommittedOpTime());
        ASSERT_EQUALS(2, getReplCoord()->getTerm());
    }

    // Set follower mode to SECONDARY so commit point can be advanced through heartbeats.
    ASSERT_OK(getReplCoord()->setFollowerMode(MemberState::RS_SECONDARY));
    {
        net->enterNetwork();
        net->runUntil(net->now() + config.getHeartbeatInterval());
        auto noi = net->getNextReadyRequest();
        auto& request = noi->getRequest();
        ASSERT_EQUALS("replSetHeartbeat", request.cmdObj.firstElement().fieldNameStringData());

        net->scheduleResponse(noi, net->now(), makeResponseStatus(hbRespObj));
        net->runReadyNetworkOperations();
        net->exitNetwork();

        ASSERT_EQUALS(commitPoint, getReplCoord()->getLastCommittedOpTime());
    }
}

}  // namespace
}  // namespace repl
}  // namespace mongo
