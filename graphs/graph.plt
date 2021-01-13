set title 'Majority Write Latencies with Reconfiguration'
# set term svg
set term pdf
set output "write-latencies-out.pdf"
set datafile separator ","
plot "write-latencies-logless.csv" using 1:2 with lines, "write-latencies-standardraft.csv" using 1:2 with lines