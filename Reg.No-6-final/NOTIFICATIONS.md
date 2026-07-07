# Background Notification Service Configuration

## Overview
The application includes an optional background notification service that automatically sends project notifications on a scheduled basis.

## Status

**Current Status:** ✓ App running on `http://127.0.0.1:5000`

**Scheduler Status:** ⚠ Disabled (APScheduler not installed)

## Installation

### Full Setup (with Background Notifications)
```bash
pip install apscheduler
python app.py
```

### Minimal Setup (without Background Notifications)
The app runs fine without APScheduler. Just run:
```bash
python app.py
```

## Configuration

Edit `config.json` to control the scheduler behavior:

### Option 1: Enable Scheduler (requires APScheduler)
```json
{
  "scheduler": {
    "enabled": true,
    "schedule": "cron",
    "hour": 6,
    "minute": 0
  },
  "debug": false
}
```

This runs the notification cycle **daily at 6:00 AM**.

### Option 2: Disable Scheduler (no APScheduler needed)
```json
{
  "scheduler": {
    "enabled": false
  },
  "debug": false
}
```

No warnings will appear, and the app runs normally without background notifications.

## Notification Types

The background service (when enabled) generates three types of notifications:

1. **Monthly Reminder** — Every 28 days
   - Keeps DT Team Accountable updated on project status

2. **Proactive Warning** — When deadline is within 28 days
   - Notifies owner at 5-day intervals (25, 20, 15, 10, 5 days before deadline)

3. **Breach Alert** — When deadline has passed
   - Immediately alerts owner that deadline is overdue

All notifications are logged to `data/notification_log.json`.

## How It Works

### With APScheduler Installed
- Scheduler runs in background when app starts
- Daily at configured time (default: 6:00 AM)
- All notifications logged to JSON automatically
- No manual intervention needed

### Without APScheduler
- App continues to function normally
- Dashboard displays all 94 projects
- Users can still manually trigger via API if needed
- Manual button removed from UI to avoid confusion

## Troubleshooting

**Issue:** "APScheduler not installed" warning on startup
- **Solution 1:** Install APScheduler: `pip install apscheduler`
- **Solution 2:** Suppress warning: Set `scheduler.enabled=false` in `config.json`

**Issue:** Scheduler not running even after installing
- **Check:** Verify `scheduler.enabled=true` in `config.json`
- **Check:** No errors in console output on startup
- **Verify:** New entries added to `data/notification_log.json` daily

**Issue:** Want to change schedule time
- Edit `config.json` and update `hour` and `minute` values
- Restart the app for changes to take effect

## API Endpoint

Even without the scheduler running, you can still trigger notifications via API:

```bash
POST /project/api/notifications/run
```

Response:
```json
{
  "success": true,
  "count": <number of notifications created>,
  "notifications": [...]
}
```

This endpoint is accessible to all users (not admin-restricted) when APScheduler is disabled.
