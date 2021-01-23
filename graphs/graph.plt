set term pdf
set datafile separator ","
set output "write-latencies-out.pdf"
set xlabel "Time (s)"
set ylabel "latency (ms)"
set multiplot layout 2,1 rowsfirst

set palette model RGB defined ( 0 '#e55964', 1 "white" )
unset colorbox

set yrange [-20:];
set key off
set title 'Majority Write Latencies with Raft Reconfiguration'
plot "write-latencies-standardraft.csv" using 1:2 with lines lt 3, \
"fault-events-standardraft.csv" using ($1):($2*0-10):($2) with lines palette lw 4

set title 'Majority Write Latencies with Logless Reconfiguration'
plot "write-latencies-logless.csv" using 1:2 with lines lt 4, \
"fault-events-logless.csv" using ($1):($2*0-10):($2) with lines palette lw 4


# "fault-events-logless.csv" using 1:2:yticlabels(2) with steps

# set style fill solid
# plot "fault-events-logless.csv" using 1:(1):2 with boxes
#  linecolor palette axes x1y2
    #  '$data' using 1:3 with lines axes x1y1

# set ytics (0 "steady", "degraded" 1)
# set title 'Fault Events'
# set yrange [-0.25:1.5];
# set ytics ("steady" 0, "degraded" 1)
# plot "fault-events-logless.csv" using 1:2:yticlabels(2) with steps linetype 3
