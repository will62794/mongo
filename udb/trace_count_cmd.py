#!/bin/python
import gdb

#
# Trace calls to the 'count' command.
#

# Delete all breakpoints.
gdb.execute("delete")

# Turn on logging to external gdb.txt file.
gdb.execute("set print thread-events off")

# Don't print structures in call frame args.
gdb.execute("set print frame-arguments none")

gdb.execute("set pagination off")
gdb.execute("set logging overwrite on")
gdb.execute("set logging off")
gdb.execute("set logging file gdb_trace_count_cmd.txt")
gdb.execute("set logging on")

# Set breakpoint on when we increment the number of records on a collection (record store).
class CountCmdBreakpoint(gdb.Breakpoint):
    # Commands to execute when the breakpoint is hit.
    def stop (self):
        print("-----" * 10)
        gdb.execute('print nss')
        gdb.execute("uinfo time")
        print("-----" * 10)
        # Don't continue automatically.
        return True

# Enable the breakpoint.       
CountCmdBreakpoint("count_cmd.cpp:195")

# Go to the start of the program and then run the recorded execution.
gdb.execute("ugo start")
# gdb.execute("continue")
# gdb.execute("set logging off")

