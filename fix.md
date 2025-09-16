There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.

---

Country Name (2 letter code) [AU]:
State or Province Name (full name) [Some-State]:
Locality Name (eg, city) []:
Organization Name (eg, company) [Internet Widgits Pty Ltd]:
Organizational Unit Name (eg, section) []:
Common Name (e.g. server FQDN or YOUR name) []:
Email Address []:

Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []:
An optional company name []:
Certificate request self-signature ok
subject=C=AU, ST=Some-State, O=Internet Widgits Pty Ltd
-----> Installing certificate and key...
-----> Unsetting DOKKU_PROXY_PORT
-----> Skipping: api.syykick.com already added to yo-api
! Please run dokku letsencrypt:enable to add https support to the new domain
-----> No matching configured domains for yo-api found in SSL certificate. Your app will show as insecure in a browser if accessed via SSL
-----> Please add appropriate domains via the dokku domains command
-----> Configured domains for app:
=====> api.syykick.com
-----> Configuring api.syykick.com...(using built-in template)
-----> Creating https nginx.conf
Enabling HSTS (using built-in template)
Reloading nginx
-----> The following is a certificate signing request that can be used
-----> to generate an 'officially' signed SSL certificate for yo-api at api.syykick.com
-----> by a CA of your choosing.
-----BEGIN CERTIFICATE REQUEST-----
MIICijCCAXICAQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUx
ITAfBgNVBAoMGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAMM1pn4oGS0rrTZZowEUdB4qbGp1TgcaUY3y830l
BdjLw39NHByNlaYOrksuaOr9PyHhxPSQq+bSCQfzunFDhWhJrzgrgHPwwc+HfsDx
64y68DaGiwD5X2ReH+oEdlRy1iTCmF2vAa4vsarkoVPApKXxkaodd2381IeKR8Z7
xhtZMY5dSNh0oRbPS2du0J0buTDz8yexE73aczxQql9nEofbX4uHhnEnMLnGFrA4
CVj7eC2xbTB1KMA0B97fVw9lqG0JHRBUg1mr4kCoIJMHSOCAu2ZK4iaGm3dT9h0k
l65/jLYv8igbscwO+VAaIj9Tcpq17GeP3zQl+s8oHNurI+0CAwEAAaAAMA0GCSqG
SIb3DQEBCwUAA4IBAQC0pY9MZnFHFi8jG4l94A5HFgBOtpdMtKxd8v0dCf7pbsES
EZnU/g34gXqhoewn5LKaYDT8B7rIf7yI01sfD8+4ArrBVz6hJDUY354qTUwsma1N
qHCbhX4N/vVWOGtxMaOokokRXZ/B79ODiQDT+AQZjTdfMGEXMEhFOWwMEvpZcTX2
DScdg8FpgcDZmKlnI1bMfvgfjNIxxJmmlzWyRvxEMRd4RlOYKR3pSvRp7unvVuCD
LAVRtCeeCgRoH8Zrs5KFmOkLaa6fwCNv+Y+FykYXwmVvIVDuOEm4C9LMDOPBVRZY
ueGa+jviPx4Il1JNohh1WfrDOwZYpp35eIPaYHOE
-----END CERTIFICATE REQUEST-----
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# systemctl restart nginx
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku ps:restart yo-api

-----> Deploying web (count=1)
Attempting pre-flight checks (web.1)
-----> Executing 2 healthchecks
Running healthcheck name='default' type='uptime' uptime=10
Running healthcheck name='port listening check' attempts=3 port=4000 retries=2 timeout=5 type='listening' wait=5
Healthcheck succeeded name='port listening check'
Healthcheck succeeded name='default'
All checks successful (web.1)
=====> Start of yo-api container output (9277c530d92d web.1)
$ bun run app/server.ts
Server is running on http://localhost:4000
=====> End of yo-api container output (9277c530d92d web.1)
Scheduling old container shutdown in 60 seconds (web.1)
=====> Triggering early nginx proxy rebuild
-----> Ensuring network configuration is in sync for yo-api
-----> No matching configured domains for yo-api found in SSL certificate. Your app will show as insecure in a browser if accessed via SSL
-----> Please add appropriate domains via the dokku domains command
-----> Configured domains for app:
=====> api.syykick.com
-----> Configuring api.syykick.com...(using built-in template)
-----> Creating https nginx.conf
Enabling HSTS (using built-in template)
Reloading nginx
-----> Running post-deploy
! Detected IPv4 domain name with nginx proxy enabled.
! Ensure the default nginx site is removed before continuing.
-----> Ensuring network configuration is in sync for yo-api
-----> No matching configured domains for yo-api found in SSL certificate. Your app will show as insecure in a browser if accessed via SSL
-----> Please add appropriate domains via the dokku domains command
-----> Configured domains for app:
=====> api.syykick.com
-----> Configuring api.syykick.com...(using built-in template)
-----> Creating https nginx.conf
Enabling HSTS (using built-in template)
Reloading nginx

-----> Renaming containers
Found previous container(s) (80fc6a645c73) named yo-api.web.1
Renaming container (80fc6a645c73) yo-api.web.1 to yo-api.web.1.1751029579
Renaming container yo-api.web.1.upcoming-940 (9277c530d92d) to yo-api.web.1
-----> Checking for postdeploy task
No postdeploy task found, skipping
-----> Updated schedule file
-----> Shutting down old containers in 60 seconds
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku logs yo-api
2025-06-27T13:05:56.967102223Z app[web.1]: $ bun run app/server.ts
2025-06-27T13:05:58.407877943Z app[web.1]: Server is running on http://localhost:4000
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku letsencrypt:enable yo-api
=====> Enabling letsencrypt for yo-api
-----> Enabling ACME proxy for yo-api...
-----> Getting letsencrypt certificate for yo-api via HTTP-01 - Domain 'api.syykick.com'
2025/06/27 13:06:30 [INFO] [api.syykick.com] acme: Obtaining bundled SAN certificate
2025/06/27 13:06:30 [INFO] [api.syykick.com] AuthURL: https://acme-v02.api.letsencrypt.org/acme/authz/2492515101/543124287351
2025/06/27 13:06:30 [INFO] [api.syykick.com] acme: Could not find solver for: tls-alpn-01
2025/06/27 13:06:30 [INFO] [api.syykick.com] acme: use http-01 solver
2025/06/27 13:06:30 [INFO] [api.syykick.com] acme: Trying to solve HTTP-01
2025/06/27 13:06:34 [INFO] Deactivating auth: https://acme-v02.api.letsencrypt.org/acme/authz/2492515101/543124287351
2025/06/27 13:06:34 Could not obtain certificates:
error: one or more domains had a problem:
[api.syykick.com] acme: error: 403 :: urn:ietf:params:acme:error:unauthorized :: 165.22.46.191: Invalid response from http://api.syykick.com/.well-known/acme-challenge/kA00GiMtyvQfOnQRtAUXNJeK7LaHYUe8yAwN4aO1CWA: 404
-----> Certificate retrieval failed!
-----> Disabling ACME proxy for yo-api...
! Failed to setup letsencrypt
! Check log output for further information on failure
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku proxy:ports-set yo-api http:80:4000
! Invalid plugin subcommand call: ports-set
root@ubuntu-s-1vcpu-1gb-nyc3-01:~#
root@ubuntu-s-1vcpu-1gb-nyc3-01:~#
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku letsencrypt:cleanup yo-api  
 ! Cannot resolve the 'current' certificate directory!
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku proxy:ports-set yo-api http:80:4000
! Invalid plugin subcommand call: ports-set
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# rm /etc/nginx/sites-enabled/default 2>/dev/null || true
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# rm /etc/nginx/sites-available/default 2>/dev/null || true
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# systemctl reload nginx
root@ubuntu-s-1vcpu-1gb-nyc3-01:~#
root@ubuntu-s-1vcpu-1gb-nyc3-01:~#
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku letsencrypt:cleanup yo-api || true
! Cannot resolve the 'current' certificate directory!
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# rm /etc/nginx/sites-available/default 2>/dev/null || true
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku domains:clear yo-api
-----> Global server virtual host not set, disabling app vhost...
-----> No port set, setting to random open high port
-----> Random port 43369
-----> No ssl port set, setting to random open high port
-----> No matching configured domains for yo-api found in SSL certificate. Your app will show as insecure in a browser if accessed via SSL
-----> Please add appropriate domains via the dokku domains command
-----> Configuring 165.22.46.191...(using built-in template)
-----> Creating https nginx.conf
Enabling HSTS (using built-in template)
Reloading nginx
-----> Cleared domains in yo-api
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku domains:add yo-api api.syykick.com
-----> Added api.syykick.com to yo-api
! Please run dokku letsencrypt:enable to add https support to the new domain
-----> No matching configured domains for yo-api found in SSL certificate. Your app will show as insecure in a browser if accessed via SSL
-----> Please add appropriate domains via the dokku domains command
-----> Configured domains for app:
=====> api.syykick.com
-----> Configuring api.syykick.com...(using built-in template)
-----> Creating https nginx.conf
Enabling HSTS (using built-in template)
Reloading nginx
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku ps:restart yo-api
-----> Deploying web (count=1)
Attempting pre-flight checks (web.1)
-----> Executing 2 healthchecks
Running healthcheck name='default' type='uptime' uptime=10
Running healthcheck name='port listening check' attempts=3 port=5000 retries=2 timeout=5 type='listening' wait=5
Healthcheck succeeded name='port listening check'
Healthcheck succeeded name='default'
All checks successful (web.1)
=====> Start of yo-api container output (0f772f62fe4e web.1)
$ bun run app/server.ts
Server is running on http://localhost:5000
=====> End of yo-api container output (0f772f62fe4e web.1)
Scheduling old container shutdown in 60 seconds (web.1)
=====> Triggering early nginx proxy rebuild
-----> Ensuring network configuration is in sync for yo-api
-----> No matching configured domains for yo-api found in SSL certificate. Your app will show as insecure in a browser if accessed via SSL
-----> Please add appropriate domains via the dokku domains command
-----> Configured domains for app:
=====> api.syykick.com
-----> Configuring api.syykick.com...(using built-in template)
-----> Creating https nginx.conf
Enabling HSTS (using built-in template)
Reloading nginx
-----> Running post-deploy
-----> Ensuring network configuration is in sync for yo-api
-----> No matching configured domains for yo-api found in SSL certificate. Your app will show as insecure in a browser if accessed via SSL
-----> Please add appropriate domains via the dokku domains command
-----> Configured domains for app:
=====> api.syykick.com
-----> Configuring api.syykick.com...(using built-in template)
-----> Creating https nginx.conf
Enabling HSTS (using built-in template)
Reloading nginx
-----> Renaming containers
Found previous container(s) (9277c530d92d) named yo-api.web.1
Renaming container (9277c530d92d) yo-api.web.1 to yo-api.web.1.1751029889
Renaming container yo-api.web.1.upcoming-30595 (0f772f62fe4e) to yo-api.web.1
-----> Checking for postdeploy task
No postdeploy task found, skipping
-----> Updated schedule file
-----> Shutting down old containers in 60 seconds
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku config:set --global DOKKU_LETSENCRYPT_EMAIL=^C
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# ^C
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku config:set --global DOKKU_LETSENCRYPT_EMAIL=anthony.demattos@syyclops.com
-----> Setting config vars
DOKKU_LETSENCRYPT_EMAIL: anthony.demattos@syyclops.com
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku letsencrypt:enable yo-api
=====> Enabling letsencrypt for yo-api
-----> Enabling ACME proxy for yo-api...
-----> Getting letsencrypt certificate for yo-api via HTTP-01 - Domain 'api.syykick.com'
2025/06/27 13:12:34 [INFO] [api.syykick.com] acme: Obtaining bundled SAN certificate
2025/06/27 13:12:34 [INFO] [api.syykick.com] AuthURL: https://acme-v02.api.letsencrypt.org/acme/authz/2492515101/543126389491
2025/06/27 13:12:34 [INFO] [api.syykick.com] acme: Could not find solver for: tls-alpn-01
2025/06/27 13:12:34 [INFO] [api.syykick.com] acme: use http-01 solver
2025/06/27 13:12:34 [INFO] [api.syykick.com] acme: Trying to solve HTTP-01
2025/06/27 13:12:41 [INFO] [api.syykick.com] The server validated our request
2025/06/27 13:12:41 [INFO] [api.syykick.com] acme: Validations succeeded; requesting certificates
2025/06/27 13:12:43 [INFO] [api.syykick.com] Server responded with a certificate.
-----> Certificate retrieved successfully.
-----> Installing let's encrypt certificates
-----> Unsetting DOKKU_PROXY_PORT
-----> Unsetting DOKKU_PROXY_SSL_PORT
-----> Configuring api.syykick.com...(using built-in template)
-----> Creating https nginx.conf
Enabling HSTS (using built-in template)
Reloading nginx
-----> Ensuring network configuration is in sync for yo-api
-----> Configuring api.syykick.com...(using built-in template)
-----> Creating https nginx.conf
Enabling HSTS (using built-in template)
Reloading nginx
-----> Disabling ACME proxy for yo-api...
-----> Done
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku letsencrypt:cron-job --add
-----> Added cron job to dokku's crontab.
root@ubuntu-s-1vcpu-1gb-nyc3-01:~# dokku certs:info yo-api
! `certs:info yo-api` is not a dokku command.
! See `dokku help` for a list of available commands.
root@ubuntu-s-1vcpu-1gb-nyc3-01:~#
