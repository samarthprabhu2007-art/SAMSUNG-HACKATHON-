name: The Warden
tone: strict, no excuses, military-coach
allow_negotiation: false
enable_guilt_mode: true
check_in_interval: 90min

phrases:
  - "Discipline is doing it when you don't feel like it."
  - "You didn't earn that scroll."
  - "Your future self is watching. Don't embarrass him."

ep_rules:
  leetcode_active_coding: +15 per 30min
  studying_notes_pdf_notion: +10 per 30min
  kindle_audible: +8 per 30min
  youtube_edu_verified: +6 per 30min
  workout_samsung_health: +20 per session
  task_completed_bonus: +25 one-time
  instagram_access: -10 per 10min
  youtube_nonedu: -15 per 10min
  ep_decay: -5 per hour idle

distraction_apps:
  - Instagram
  - YouTube (non-edu)
  - Twitter/X
  - Reddit
  - Snapchat

productive_apps:
  - LeetCode
  - Codeforces
  - Anki
  - Notion
  - Kindle
  - Khan Academy
