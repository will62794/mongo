set term pdf
set datafile separator ","
set output "write-latencies-out.pdf"
set xlabel "Time (s)"
set ylabel "latency (ms)"
set multiplot layout 2,1 rowsfirst

set key off
set title 'Majority Write Latencies with Raft Reconfiguration'
plot "write-latencies-standardraft.csv" using 1:2 with lines linetype 2

set title 'Majority Write Latencies with Logless Reconfiguration'
plot "write-latencies-logless.csv" using 1:2 with lines
