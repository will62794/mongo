#!/bin/python
import gdb

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
incbp = gdb.Breakpoint("_changeNumRecords")
incbp.commands  = """silent
if $_streq(_ns.c_str(), "{0}")
    printf "namespace: %s\\n", _ns.c_str()
    printf "current count: %ld, diff: +%ld, new: %ld\\n", _sizeInfo->numRecords.load(), diff, (_sizeInfo->numRecords.load()+diff)
    bt 8
    uinfo time
    printf "\\n"
else
end
continue
""".format(nss)

# Set breakpoint on when we decrement the number of records on a collection (record store).
decbp = gdb.Breakpoint("WiredTigerRecordStore::NumRecordsChange::rollback")
decbp.commands = """silent
if $_streq(_rs->_ns.c_str(), "{0}")
    printf "namespace: %s\\n", _rs->_ns.c_str()
    printf "current count: %ld, diff: -%ld, new: %ld\\n", _rs->_sizeInfo->numRecords.load(), _diff, (_rs->_sizeInfo->numRecords.load()-_diff)
    bt 8
    uinfo time
    printf "\\n"
else
end
continue
end
""".format(nss)

#
# Add after explanation.
#
rbp = gdb.Breakpoint("updateStatsAfterRepair")
rbp.commands  = """silent
if $_streq(_ns.c_str(), "{0}")
    printf "namespace: %s\\n", _ns.c_str()
    printf "current count: %ld, new: %ld\\n", _sizeInfo->numRecords.load(), numRecords
    bt 8
    uinfo time
    printf "\\n"
else
end
continue
""".format(nss)

# Run the recorded execution.
gdb.execute("continue")
gdb.execute("set logging off")

# class SizeStorerBreakpoint(gdb.Breakpoint):
#     def stop (self):
#         gdb.write('MyBreakpoint\n')
#         # Continue automatically.
#         return False
#         # Actually stop.
#         return True