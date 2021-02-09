set term pdf
set datafile separator ","
set output "write-latencies-out.pdf"
set xlabel "Time (s)"
set ylabel "latency (ms)"
set multiplot layout 2,1 rowsfirst

set palette model RGB defined ( 0 'orange', 1 "white", 2 "red", 3 "sea-green")
unset colorbox

set yrange [-20:];
set xrange [*:60]
set xtics 0,5,60
set key off
set title 'Majority Write Latencies with Raft Reconfiguration'
plot "write-latencies-standardraft.csv" using 1:2:($3+2) with points palette pt 2 ps 0.25 lt 8 lw 0.1, \
"fault-events-standardraft.csv" using ($1):($2*0-5):($2) with lines palette lw 6

set palette model RGB defined ( 0 'orange', 1 "white", 2 "red", 3 "dark-turquoise")

set title 'Majority Write Latencies with Logless Reconfiguration'
plot "write-latencies-logless.csv" using 1:2:($3+2) with points palette pt 2 ps 0.25 lt 4 lw 0.1, \
"fault-events-logless.csv" using ($1):($2*0-5):($2) with lines palette lw 6


# set style fill solid
# plot "fault-events-logless.csv" using 1:(1):2 with boxes
#  linecolor palette axes x1y2
    #  '$data' using 1:3 with lines axes x1y1

# set ytics (0 "steady", "degraded" 1)
# set title 'Fault Events'
# set yrange [-0.25:1.5];
# set ytics ("steady" 0, "degraded" 1)
# plot "fault-events-logless.csv" using 1:2:yticlabels(2) with steps linetype 3
