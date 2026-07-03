import 'reflect-metadata';

/**
 * Background worker entrypoint. In M0 the directory-sync cron runs inside the
 * API process; this process becomes the home of BullMQ processors (automation
 * rules, SLA timers, notifications, PDF generation) starting with M2.
 */
const HEARTBEAT_MS = 60_000;

console.log('[worker] placeholder up — automation processors arrive in M2');
setInterval(() => {
  // keep the container alive and visibly healthy in `docker compose ps`
}, HEARTBEAT_MS);
