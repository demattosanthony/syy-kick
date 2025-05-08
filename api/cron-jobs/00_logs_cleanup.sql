DELETE FROM logs WHERE timestamp < NOW() - INTERVAL '30 days';

--> run with: psql '{conn_string}' -f 00_logs_cleanup.sql
--> to run everyday at 2AM: 0 2 * * * psql '{conn_string}' -f 00_logs_cleanup.sql