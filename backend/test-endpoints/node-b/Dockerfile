# test-node-b: print node, and the unregistered-target contrast case (research.md R1).
# OpenSSH, CUPS with a virtual PDF-backed printer (no physical hardware needed).
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server sudo procps \
       iputils-ping cups printer-driver-cups-pdf \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/sshd

RUN useradd -m -s /bin/bash -G lpadmin remediation \
    && mkdir -p /home/remediation/.ssh \
    && chmod 700 /home/remediation/.ssh

COPY authorized_keys /home/remediation/.ssh/authorized_keys
RUN chown -R remediation:remediation /home/remediation/.ssh \
    && chmod 600 /home/remediation/.ssh/authorized_keys

COPY sshd_config /etc/ssh/sshd_config.d/remediation.conf

# Virtual printer: cups-pdf renders raw print jobs to PDF instead of hardware,
# which is what makes queue listing and clearing genuine without a physical
# printer (research.md R11 honesty note).
RUN lpadmin -p test-printer -E -v cups-pdf:/ -m drv:///cups-pdf.drv/CUPS-PDF_opt.ppd \
    && cupsenable test-printer \
    && cupsaccept test-printer

COPY scripts/ /usr/local/bin/
RUN chmod 755 /usr/local/bin/*.sh

COPY sudoers.remediation /etc/sudoers.d/remediation
RUN chmod 440 /etc/sudoers.d/remediation

# Host keys regenerate on every container start (see node-a/Dockerfile).
EXPOSE 22
CMD ["/bin/sh", "-c", "ssh-keygen -A && /usr/sbin/cupsd && exec /usr/sbin/sshd -D -e"]
