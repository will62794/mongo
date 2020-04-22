import gdb

#
# Trace sizeStorer updates via hardware watchpoints.
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
gdb.execute("set logging file gdb_watch_counts.txt")
gdb.execute("set logging on")

# The collection whose counts we want to inspect.
nss = "test.coll1"

# Set breakpoint on when we increment the number of records on a collection (record store).
class SizeStorerBreakpoint(gdb.Breakpoint):
    # Commands to execute when the breakpoint is hit.
    def stop (self):
        if bool(gdb.parse_and_eval('$_streq(_ns.c_str(), "%s")' % nss)):
            # Set a hardware watchpoint for future updates.
            gdb.execute('set $addr1 = &(_sizeInfo->numRecords._value._M_i)')
            gdb.execute('watch *$addr1')
            gdb.execute("uinfo time")
            print("*** Set hardware watchpoint on the size storer ***")
            return True
        # Don't continue automatically.
        return False

# Enable the breakpoint.       
bp = SizeStorerBreakpoint("_changeNumRecords")

# Go to the start of the program.
gdb.execute("ugo start")

# Run the recorded execution until we hit the breakpoint which will set the watchpoint. 
gdb.execute("continue")

# Now disable the breakpoint so we only hit the watchpoint.
bp.enabled = False

# At this point we can manually run 'continue' to inspect each location at which we hit the watchpoint.
