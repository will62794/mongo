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

#include "mongo/platform/mutex.h"
#include "mongo/platform/random.h"

#include "mongo/base/init.h"
#include "mongo/util/time_support.h"
#include "mongo/logv2/log.h"

namespace mongo::latch_detail {

Mutex::Mutex(std::shared_ptr<Data> data) : _data{std::move(data)}, _waiters{}, _allowedToProceed{} {
    invariant(_data);

    _data->counts().created.fetchAndAdd(1);
}

Mutex::~Mutex() {
    invariant(!_isLocked);

    _data->counts().destroyed.fetchAndAdd(1);
}

bool Mutex::allowNextThread() {
    auto srand = SecureRandom();
    // Pick a random thread in the waiters set and let it proceed.
    _internalMutex.lock();
    logd("Allow next thread. Waiters size : {}", _waiters.size());
    if(_waiters.size()==0){
        _internalMutex.unlock();
        return false;
    }

    int64_t nextThreadIndex = srand.nextInt64(_waiters.size());
    int currIdx = 0;
    logd("Allowing next thread index: {}", nextThreadIndex);
    for(auto tid : _waiters){
        if(currIdx == nextThreadIndex){
            _nextAllowedThread = tid;
        }
        currIdx++;
    }
    _internalMutex.unlock();
    return true;
}

void Mutex::enableScheduleControl() {
    _enableScheduleControl.store(true);
}

void Mutex::disableScheduleControl() {
    _enableScheduleControl.store(false);
}

void Mutex::lock() {
    // Only order the mutex we care about.
    if(getName() == "ReplicationCoordinatorImpl::_mutex" && _enableScheduleControl.load()){
        // Mark yourself as a waiter on this mutex.
        _internalMutex.lock();
        _waiters.insert(std::this_thread::get_id());
        logd("Added self to waiter set. Num waiters: {}", _waiters.size());
        _internalMutex.unlock();

        // Wait until you are allowed to proceed.
        while(true){
            _internalMutex.lock();
            if(_nextAllowedThread == std::this_thread::get_id()){
                // Reset the flag before proceeding.
                _nextAllowedThread = std::thread::id();
                _waiters.erase(std::this_thread::get_id());
                logd("I am proceeding to acquire mutex.");
                _internalMutex.unlock();
                break;
            }
            _internalMutex.unlock();
            mongo::sleepmicros(100);
        }
    }

    if (_mutex.try_lock()) {
        _isLocked = true;
        _onQuickLock();
        return;
    }

    _onContendedLock();
    _mutex.lock();
    _isLocked = true;
    _onSlowLock();
}

void Mutex::unlock() {
    _onUnlock();
    _isLocked = false;
    _mutex.unlock();
}
bool Mutex::try_lock() {
    if (!_mutex.try_lock()) {
        return false;
    }

    _isLocked = true;
    _onQuickLock();
    return true;
}

StringData Mutex::getName() const {
    return StringData(_data->identity().name());
}

void Mutex::_onContendedLock() noexcept {
    _data->counts().contended.fetchAndAdd(1);

    auto& state = getDiagnosticListenerState();
    if (!state.isFinalized.load()) {
        return;
    }

    for (auto listener : state.listeners) {
        listener->onContendedLock(_data->identity());
    }
}

void Mutex::_onQuickLock() noexcept {
    _data->counts().acquired.fetchAndAdd(1);

    auto& state = getDiagnosticListenerState();
    if (!state.isFinalized.load()) {
        return;
    }

    for (auto listener : state.listeners) {
        listener->onQuickLock(_data->identity());
    }
}

void Mutex::_onSlowLock() noexcept {
    _data->counts().acquired.fetchAndAdd(1);

    auto& state = getDiagnosticListenerState();
    if (!state.isFinalized.load()) {
        return;
    }

    for (auto listener : state.listeners) {
        listener->onSlowLock(_data->identity());
    }
}

void Mutex::_onUnlock() noexcept {
    _data->counts().released.fetchAndAdd(1);

    auto& state = getDiagnosticListenerState();
    if (!state.isFinalized.load()) {
        return;
    }

    for (auto listener : state.listeners) {
        listener->onUnlock(_data->identity());
    }
}

/**
 * Any MONGO_INITIALIZER that adds a DiagnosticListener will want to list
 * FinalizeDiagnosticListeners as a dependent initializer. This means that all DiagnosticListeners
 * are certified to be added before main and no DiagnosticListeners are ever invoked before main.
 */
MONGO_INITIALIZER(FinalizeDiagnosticListeners)(InitializerContext* context) {
    auto& state = latch_detail::getDiagnosticListenerState();
    state.isFinalized.store(true);

    return Status::OK();
}

}  // namespace mongo::latch_detail
