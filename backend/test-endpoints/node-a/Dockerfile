# test-node-a: general service and account node (research.md R1)
# OpenSSH, a lightweight init.d-managed dummy service, and seeded local test accounts.
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server sudo procps iputils-ping \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/sshd

# SSH access: key-based only, one non-root account the executor connects as.
RUN useradd -m -s /bin/bash remediation \
    && mkdir -p /home/remediation/.ssh \
    && chmod 700 /home/remediation/.ssh

COPY authorized_keys /home/remediation/.ssh/authorized_keys
RUN chown -R remediation:remediation /home/remediation/.ssh \
    && chmod 600 /home/remediation/.ssh/authorized_keys

COPY sshd_config /etc/ssh/sshd_config.d/remediation.conf

# Seeded local test accounts (FR-8 password/login remediation, R11).
# test-user-locked starts locked; unlock-account acts on it.
# test-user-active starts unlocked; expire-password flags it for a forced change.
RUN useradd -m test-user-locked \
    && useradd -m test-user-active \
    && echo "test-user-locked:TestPass123!" | chpasswd \
    && echo "test-user-active:TestPass123!" | chpasswd \
    && usermod -L test-user-locked

# Dummy "widget-service": a sysvinit-style script managing a background process,
# so `service widget-service status|restart` behaves like a real service on the
# endpoint without requiring systemd inside the container.
COPY widget-service.init /etc/init.d/widget-service
RUN chmod 755 /etc/init.d/widget-service

COPY scripts/ /usr/local/bin/
RUN chmod 755 /usr/local/bin/*.sh

# Passwordless sudo restricted to exactly the remediation scripts (least privilege).
COPY sudoers.remediation /etc/sudoers.d/remediation
RUN chmod 440 /etc/sudoers.d/remediation

# Host keys regenerate on every container start (fresh each `reset.ps1` run,
# since `down -v` discards the container filesystem). capture-host-keys.mjs
# reads the resulting fingerprint after `up -d` and writes it into the
# registry, so pinning always matches the environment currently running.
EXPOSE 22
CMD ["/bin/sh", "-c", "ssh-keygen -A && exec /usr/sbin/sshd -D -e"]
