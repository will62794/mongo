#!/bin/python
import gdb

#
# Trace sizeStorer updates via breakpoints on method calls.
#

# Go to the start of the program.
gdb.execute("ugo start")

# Delete all breakpoints.
gdb.execute("delete")

# Turn on logging to external gdb.txt file.
gdb.execute("set print thread-events off")

# Don't print structures in call frame args.
gdb.execute("set print frame-arguments none")

gdb.execute("set pagination off")
gdb.execute("set logging overwrite on")
gdb.execute("set logging off")
gdb.execute("set logging on")

# The collection whose counts we want to inspect.
nss = "test.coll1"

# Set breakpoint on when we increment the number of records on a collection (record store).
class SizeStorerIncBreakpoint(gdb.Breakpoint):
    # Commands to execute when the breakpoint is hit.
    def stop (self):
        if bool(gdb.parse_and_eval('$_streq(_ns.c_str(), "%s")' % nss)):
            gdb.execute('printf "namespace: %s\\n", _ns.c_str()')
            gdb.execute('printf "current count: %ld, diff: +%ld\\n", _sizeInfo->numRecords.load(), diff')
            gdb.execute('printf "new count: %ld\\n", (_sizeInfo->numRecords.load()+diff)')
            gdb.execute("bt 8")
            gdb.execute("uinfo time")
            print("")
        # Continue automatically.
        return False

# Enable the breakpoint.       
SizeStorerIncBreakpoint("_changeNumRecords")

# Set breakpoint on when we decrement the number of records on a collection (record store).
class SizeStorerDecBreakpoint(gdb.Breakpoint):
    # Commands to execute when the breakpoint is hit.
    def stop (self):
        if bool(gdb.parse_and_eval('$_streq(_rs->_ns.c_str(), "%s")' % nss)):
            gdb.execute('printf "namespace: %s\\n", _rs->_ns.c_str()')
            gdb.execute('printf "current count: %ld, diff: -%ld\\n", _rs->_sizeInfo->numRecords.load(), _diff')
            gdb.execute('printf "new count: %ld\\n", (_rs->_sizeInfo->numRecords.load()-_diff)')
            gdb.execute("bt 8")
            gdb.execute("uinfo time")
            print("")
        # Continue automatically.
        return False

# Enable the breakpoint.       
SizeStorerDecBreakpoint("WiredTigerRecordStore::NumRecordsChange::rollback")

# #
# # Add after explanation.
# #
# class SizeStorerRepairBreakpoint(gdb.Breakpoint):
#     # Commands to execute when the breakpoint is hit.
#     def stop (self):
#         if bool(gdb.parse_and_eval('$_streq(_ns.c_str(), "%s")' % nss)):
#             gdb.execute('printf "namespace: %s\\n", _ns.c_str()')
#             gdb.execute('printf "current count: %ld\\n", _sizeInfo->numRecords.load()')
#             gdb.execute('printf "new count: %ld\\n",numRecords')
#             gdb.execute("bt 8")
#             gdb.execute("uinfo time")
#             print("")
#         # Continue automatically.
#         return False

# # Enable the breakpoint.       
# SizeStorerRepairBreakpoint("updateStatsAfterRepair")

# Run the recorded execution.
gdb.execute("continue")
gdb.execute("set logging off")
