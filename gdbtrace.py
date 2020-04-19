#!/bin/python
import gdb

# Delete all breakpoints.
gdb.execute("delete")

# Turn on logging to external gdb.txt file.
gdb.execute("set print thread-events off")

# Don't print structures in call frame args.
gdb.execute("set print frame-arguments scalars")
gdb.execute("set print frame-arguments none")

gdb.execute("set pagination off")
gdb.execute("set logging overwrite on")
gdb.execute("set logging off")
gdb.execute("set logging on")

bp = """break _changeNumRecords
commands
printf "namespace: "
print _ns
printf "current count: "
print _sizeInfo->numRecords.load() 
printf "count diff: "
print diff 
bt 8
printf "\\n"
continue
end
"""
gdb.execute(bp)


bp2 = """break WiredTigerRecordStore::NumRecordsChange::rollback
commands
printf "namespace: "
print _rs->_ns
printf "current count: "
print _rs->_sizeInfo->numRecords.load() 
printf "negative count diff: "
print diff 
bt 8
printf "\\n"
continue
end
"""
gdb.execute(bp2)

gdb.execute("continue")