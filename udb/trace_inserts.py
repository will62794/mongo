#!/bin/python
import gdb

#
# Trace all inserts via CollectionImpl class.
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
gdb.execute("set logging file gdb_trace_inserts.txt")
gdb.execute("set logging on")

# The collection whose counts we want to inspect.
nss = "test.coll1"

# Set breakpoint on when we insert documents to a collection.
class SizeStorerIncBreakpoint(gdb.Breakpoint):
    # Commands to execute when the breakpoint is hit.
    def stop (self):
        if bool(gdb.parse_and_eval('$_streq(_ns.ns().c_str(), "%s")' % nss)):
            gdb.execute('printf "namespace: %s\\n", _ns.ns().c_str()')
            gdb.execute("print it->doc")
            gdb.execute("print loc")
            gdb.execute("uinfo time")
            print("")
        # Continue automatically.
        return False

# Enable the breakpoint.       
SizeStorerIncBreakpoint("collection_impl.cpp:548")

# Run the recorded execution.
gdb.execute("continue")
gdb.execute("set logging off")
