# HEARTBEAT

## Every 5 minutes
- Trigger `screen_watch` skill
- If distracting app detected and EP > 0: start countdown timer, send warning
- If distracting app detected and EP = 0: trigger `app_lock` immediately

## Every 90 minutes
- Check goal progress from memory YAML
- Send check-in message via Warden: "It's [time]. You said you'd [goal]. Current EP: [n]."

## Daily at 9 PM
- If goals incomplete: send guilt-mode message with remaining tasks

## Every Sunday at 9 PM
- Trigger weekly report generation
- Send EP history, streak data, goal completion rate, best/worst day, next week targets

## On app launch event
- Check if app is on blacklist
- If EP == 0: block + send Warden ping
- If EP > 0: allow + start EP countdown timer
